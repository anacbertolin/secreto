-- =====================================================================
-- 0052 — WhatsApp da Orientação Cirúrgica (segundo número oficial)
-- =====================================================================
-- Pedido da dona (16/11/2026): o número da Alessandra (orientação cirúrgica,
-- pacientes com complicação ou dúvida depois da cirurgia) passa a ser atendido
-- pelo sistema, numa aba própria, pela API oficial da Meta (mesma conta do
-- número da clínica). Decisões da dona:
--   * o número sai do aplicativo do celular e é usado só pelo sistema;
--   * quem VÊ as conversas da orientação: quem atende a orientação (Alessandra),
--     médicos e administração. Recepção, enfermagem e faturamento NÃO veem;
--   * quem RESPONDE: só quem atende a orientação (marcado no cadastro da equipe).
--
--  * whatsapp_conversas.setor: 'clinica' (número da clínica) ou 'orientacao'.
--    O mesmo paciente pode ter uma conversa em cada número.
--  * profissionais.orientacao_cirurgica: a pessoa atende a orientação cirúrgica.
--  * O assistente de IA (extrator de pedidos de agendamento), os lembretes, os
--    botões Confirmar/Remarcar e o "SAIR" continuam só no número da clínica.
--  * Modelo novo "retomar_orientacao" para chamar o paciente depois de 24 h.
-- =====================================================================

-- ---------- Quem atende a orientação ----------
alter table public.profissionais
  add column orientacao_cirurgica boolean not null default false;
comment on column public.profissionais.orientacao_cirurgica is
  'Atende o WhatsApp da Orientação Cirúrgica (vê e responde as conversas desse número).';
-- a política admin_altera já limita a alteração à administração
grant update (orientacao_cirurgica) on public.profissionais to authenticated;

create or replace function interno.atende_orientacao()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.orientacao_cirurgica from public.profissionais p
      where p.email = interno.email_atual() and p.ativo),
    false)
$$;
revoke execute on function interno.atende_orientacao() from public, anon;
grant execute on function interno.atende_orientacao() to authenticated, service_role;

-- ---------- Setor da conversa ----------
alter table public.whatsapp_conversas
  add column setor text not null default 'clinica' check (setor in ('clinica', 'orientacao'));
comment on column public.whatsapp_conversas.setor is
  'Número que recebeu a conversa: clinica (número oficial da clínica) ou orientacao (Orientação Cirúrgica).';
alter table public.whatsapp_conversas drop constraint whatsapp_conversas_telefone_key;
alter table public.whatsapp_conversas add constraint whatsapp_conversas_setor_telefone_key unique (setor, telefone);
create index whatsapp_conversas_setor_recentes_idx
  on public.whatsapp_conversas (setor, ultima_mensagem_em desc nulls last);

-- ---------- Quem vê / quem mexe ----------
drop policy equipe_le on public.whatsapp_conversas;
drop policy recepcao_admin_altera on public.whatsapp_conversas;
drop policy equipe_le on public.whatsapp_mensagens;

create policy equipe_le on public.whatsapp_conversas for select to authenticated
  using (
    (setor = 'clinica'
     and (select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')))
    or (setor = 'orientacao'
        and ((select interno.tem_funcao('medico', 'admin')) or (select interno.atende_orientacao())))
  );

create policy quem_atende_altera on public.whatsapp_conversas for update to authenticated
  using (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and (select interno.atende_orientacao()))
  )
  with check (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and (select interno.atende_orientacao()))
  );

-- Mensagem: vê quem vê a conversa (a subconsulta respeita as regras da tabela de conversas)
create policy equipe_le on public.whatsapp_mensagens for select to authenticated
  using (exists (select 1 from public.whatsapp_conversas c where c.id = conversa_id));

-- ---------- Modelo para chamar o paciente da orientação depois de 24 h ----------
alter table public.whatsapp_modelos drop constraint whatsapp_modelos_finalidade_check;
alter table public.whatsapp_modelos add constraint whatsapp_modelos_finalidade_check
  check (finalidade in ('lembrete_consulta', 'retomar_conversa', 'retomar_orientacao'));
insert into public.whatsapp_modelos (finalidade, nome, corpo, parametros, botoes) values
  ('retomar_orientacao', 'retomar_orientacao',
   'Olá, {{1}}! Aqui é da Orientação Cirúrgica da Consumed Clínica de Olhos. Queremos saber como você está e continuar o seu acompanhamento por aqui. Pode nos responder esta mensagem?',
   array['paciente'], false);

-- ---------- Funções usadas pelas funções Edge ----------
drop function public.whatsapp_conversa(text, text, uuid);
create function public.whatsapp_conversa(
  p_telefone text, p_nome text default null, p_paciente uuid default null, p_setor text default 'clinica'
) returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.whatsapp_conversas (telefone, nome_contato, paciente_id, setor)
  values (p_telefone, p_nome, coalesce(p_paciente, public.whatsapp_paciente_do_numero(p_telefone)), p_setor)
  on conflict (setor, telefone) do update
    set nome_contato = coalesce(excluded.nome_contato, public.whatsapp_conversas.nome_contato),
        paciente_id  = coalesce(public.whatsapp_conversas.paciente_id, excluded.paciente_id)
  returning id into v_id;
  return v_id;
end $$;

drop function public.whatsapp_receber(text, text, text, text, text, text, text, text, text, timestamptz, text);
create function public.whatsapp_receber(
  p_telefone text, p_nome text, p_wa_id text, p_tipo text, p_texto text,
  p_midia_id text default null, p_midia_tipo text default null, p_midia_nome text default null,
  p_em_resposta_a text default null, p_quando timestamptz default now(), p_botao text default null,
  p_setor text default 'clinica'
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_conversa uuid;
  v_msg      uuid;
  v_paciente uuid;
  v_ag       uuid;
  v_acao     text;
  v_resultado text := null;
begin
  v_conversa := public.whatsapp_conversa(p_telefone, p_nome, null, p_setor);

  insert into public.whatsapp_mensagens
    (conversa_id, direcao, wa_id, tipo, texto, midia_id, midia_tipo, midia_nome, situacao, em_resposta_a, quando)
  values
    (v_conversa, 'recebida', p_wa_id, p_tipo, p_texto, p_midia_id, p_midia_tipo, p_midia_nome, 'recebida',
     p_em_resposta_a, coalesce(p_quando, now()))
  on conflict (wa_id) do nothing
  returning id into v_msg;

  if v_msg is null then
    return jsonb_build_object('duplicada', true);   -- a Meta reenviou: nada a fazer
  end if;

  update public.whatsapp_conversas
     set ultima_mensagem_em = greatest(coalesce(ultima_mensagem_em, p_quando), p_quando),
         ultima_recebida_em = greatest(coalesce(ultima_recebida_em, p_quando), p_quando),
         nao_lidas = nao_lidas + 1,
         -- conversa arquivada que volta: ninguém está mais cuidando dela
         responsavel_id = case when arquivada then null else responsavel_id end,
         arquivada = false
   where id = v_conversa
  returning paciente_id into v_paciente;

  -- Lembretes, botões e "SAIR" são só do número da clínica
  if p_setor = 'clinica' then
    -- Botão do lembrete: "CONFIRMAR:<agendamento>" ou "REMARCAR:<agendamento>"
    if p_botao ~ '^(CONFIRMAR|REMARCAR):[0-9a-f-]{36}$' then
      v_acao := split_part(p_botao, ':', 1);
      v_ag := split_part(p_botao, ':', 2)::uuid;
      -- só vale se o lembrete desse agendamento foi mandado para ESTE número
      if exists (select 1 from public.whatsapp_mensagens
                 where conversa_id = v_conversa and agendamento_id = v_ag and direcao = 'enviada') then
        update public.whatsapp_mensagens set agendamento_id = v_ag where id = v_msg;
        if v_acao = 'CONFIRMAR' then
          update public.agendamentos
             set status = 'confirmado', canal_confirmacao = 'whatsapp'
           where id = v_ag and status = 'agendado';
          v_resultado := case when found then 'confirmado' else 'ja_estava' end;
        else
          v_resultado := 'quer_remarcar';
        end if;
      end if;
    end if;

    -- Pedido para não receber mais mensagens
    if p_tipo = 'texto' and v_paciente is not null
       and upper(trim(both ' .!' from coalesce(p_texto, ''))) in ('SAIR', 'PARAR', 'CANCELAR MENSAGENS', 'STOP') then
      update public.pacientes set whatsapp_autorizado = false where id = v_paciente;
      v_resultado := 'saiu';
    end if;
  end if;

  return jsonb_build_object('mensagem_id', v_msg, 'conversa_id', v_conversa, 'resultado', v_resultado);
end $$;

revoke execute on function public.whatsapp_conversa(text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.whatsapp_receber(text, text, text, text, text, text, text, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_conversa(text, text, uuid, text) to service_role;
grant execute on function public.whatsapp_receber(text, text, text, text, text, text, text, text, text, timestamptz, text, text) to service_role;

-- ---------- Assistente de IA: só conversas do número da clínica ----------
create or replace function interno.extrator_tem_trabalho()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select ligado from public.whatsapp_extrator_config where id = 1), false)
     and exists (
       select 1 from public.whatsapp_conversas c
         left join public.whatsapp_extrator_estado e on e.conversa_id = c.id
        where c.setor = 'clinica'
          and c.ultima_mensagem_em > coalesce(e.analisado_ate, '-infinity'::timestamptz)
          and c.ultima_mensagem_em <= now() - make_interval(mins => (select silencio_minutos from public.whatsapp_extrator_config where id = 1))
          and coalesce(e.tentativas, 0) < 5
          and (e.em_processo_desde is null or e.em_processo_desde < now() - interval '15 minutes'))
$$;

create or replace function public.whatsapp_extrator_pegar(p_limite integer, p_silencio integer, p_conversa uuid default null)
returns table(conversa_id uuid, analisado_ate timestamptz) language plpgsql set search_path = '' as $$
#variable_conflict use_column
begin
  insert into public.whatsapp_extrator_estado (conversa_id)
  select c.id from public.whatsapp_conversas c
  where c.setor = 'clinica' and c.ultima_mensagem_em is not null and (p_conversa is null or c.id = p_conversa)
  on conflict do nothing;

  return query
  with escolhidas as (
    select e.conversa_id as cid
      from public.whatsapp_extrator_estado e
      join public.whatsapp_conversas c on c.id = e.conversa_id
     where c.setor = 'clinica'
       and ((p_conversa is not null and e.conversa_id = p_conversa)
            or (p_conversa is null
                and c.ultima_mensagem_em > coalesce(e.analisado_ate, '-infinity'::timestamptz)
                and c.ultima_mensagem_em <= now() - make_interval(mins => p_silencio)
                and e.tentativas < 5))
       and (e.em_processo_desde is null or e.em_processo_desde < now() - interval '15 minutes')
     order by c.ultima_mensagem_em
     limit p_limite
     for update of e skip locked
  ), marcadas as (
    update public.whatsapp_extrator_estado e
       set em_processo_desde = now(), atualizado_em = now()
      from escolhidas x
     where e.conversa_id = x.cid
    returning e.conversa_id as cid, e.analisado_ate as ate
  )
  select m.cid, m.ate from marcadas m;
end $$;
