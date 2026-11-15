-- =====================================================================
-- 0012 — WhatsApp (API oficial da Meta)
-- =====================================================================
--  * Conversas e mensagens recebidas/enviadas pelo número da clínica.
--  * Quem grava são só as funções Edge `whatsapp-webhook` (recebe da Meta)
--    e `whatsapp-enviar` (envia em nome da equipe), com a chave de serviço.
--    A equipe só LÊ pelo sistema (e marca como lida / liga ao paciente).
--  * Lembrete de consulta com botões "Confirmar" / "Preciso remarcar":
--    o "Confirmar" muda o agendamento para "confirmado" (canal whatsapp).
--  * Autorização do paciente (LGPD + regra da Meta): pacientes.whatsapp_autorizado.
--    null = ainda não perguntado; true = aceita; false = não aceita / pediu para sair.
--  * Faturamento NÃO vê conversas (podem ter conteúdo de saúde).
-- =====================================================================

-- ---------- Autorização do paciente ----------
alter table public.pacientes
  add column whatsapp_autorizado    boolean,
  add column whatsapp_autorizado_em timestamptz;
comment on column public.pacientes.whatsapp_autorizado is
  'Aceita receber mensagens da clínica pelo WhatsApp? null = não perguntado; false = recusou ou pediu para sair.';

create or replace function interno.tg_paciente_whatsapp_em()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.whatsapp_autorizado is distinct from old.whatsapp_autorizado then
    new.whatsapp_autorizado_em := case when new.whatsapp_autorizado is null then null else now() end;
  end if;
  return new;
end $$;
create trigger whatsapp_autorizado_em before insert or update of whatsapp_autorizado on public.pacientes
  for each row execute function interno.tg_paciente_whatsapp_em();

-- ---------- Telefones ----------
-- Chave de comparação: DDD + últimos 8 dígitos (o WhatsApp às vezes manda sem o 9).
create or replace function interno.chave_telefone(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when length(n) >= 12 and left(n, 2) = '55' then substr(n, 3, 2) || right(n, 8)
    when length(n) in (10, 11) then left(n, 2) || right(n, 8)
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as n) x
$$;

-- Número no formato do WhatsApp (55 + DDD + celular). Fixo ou inválido → null.
create or replace function public.telefone_whatsapp(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when length(n) = 11 and substr(n, 3, 1) = '9' then '55' || n
    when length(n) = 10 and substr(n, 3, 1) in ('6', '7', '8', '9') then '55' || left(n, 2) || '9' || right(n, 8)
  end
  from (select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^55(?=\d{10,11}$)', '') as n) x
$$;

-- ---------- Conversas ----------
create table public.whatsapp_conversas (
  id                  uuid primary key default gen_random_uuid(),
  telefone            text not null unique check (telefone ~ '^[0-9]{10,15}$'),  -- como a Meta identifica (wa_id)
  nome_contato        text,                                                    -- nome do perfil no WhatsApp
  paciente_id         uuid references public.pacientes(id),
  ultima_mensagem_em  timestamptz,
  ultima_recebida_em  timestamptz,   -- abre a "janela de 24 h" para responder sem modelo
  nao_lidas           integer not null default 0 check (nao_lidas >= 0),
  arquivada           boolean not null default false,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index whatsapp_conversas_recentes_idx on public.whatsapp_conversas (ultima_mensagem_em desc nulls last);
create index whatsapp_conversas_paciente_idx on public.whatsapp_conversas (paciente_id);
comment on table public.whatsapp_conversas is 'Uma conversa por número de WhatsApp. Gravada pelas funções Edge do WhatsApp.';

-- ---------- Mensagens ----------
create table public.whatsapp_mensagens (
  id              uuid primary key default gen_random_uuid(),
  conversa_id     uuid not null references public.whatsapp_conversas(id),
  direcao         text not null check (direcao in ('recebida', 'enviada')),
  wa_id           text unique,     -- id da mensagem na Meta (evita duplicar quando a Meta reenvia)
  tipo            text not null default 'texto'
                  check (tipo in ('texto', 'modelo', 'botao', 'imagem', 'audio', 'video', 'documento',
                                  'figurinha', 'localizacao', 'contato', 'reacao', 'outro')),
  texto           text,
  modelo          text,            -- nome do modelo aprovado, quando tipo = 'modelo'
  midia_id        text,            -- id do arquivo na Meta (imagem, áudio, documento…)
  midia_tipo      text,            -- ex.: image/jpeg
  midia_nome      text,
  situacao        text not null
                  check (situacao in ('recebida', 'enviada', 'entregue', 'lida', 'falhou')),
  erro            text,
  agendamento_id  uuid references public.agendamentos(id),
  enviado_por     uuid references public.profissionais(id),
  em_resposta_a   text,            -- wa_id da mensagem respondida
  quando          timestamptz not null default now(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index whatsapp_mensagens_conversa_idx on public.whatsapp_mensagens (conversa_id, quando);
create index whatsapp_mensagens_agendamento_idx on public.whatsapp_mensagens (agendamento_id);
create index whatsapp_mensagens_enviado_por_idx on public.whatsapp_mensagens (enviado_por);
comment on table public.whatsapp_mensagens is 'Histórico de mensagens do WhatsApp. Não se apaga nem se altera pelo sistema.';

-- ---------- Modelos aprovados pela Meta ----------
-- Mensagens que a clínica INICIA (fora da janela de 24 h) precisam de modelo aprovado.
create table public.whatsapp_modelos (
  id             uuid primary key default gen_random_uuid(),
  finalidade     text not null unique check (finalidade in ('lembrete_consulta', 'retomar_conversa')),
  nome           text not null,             -- nome exato do modelo na Meta
  idioma         text not null default 'pt_BR',
  corpo          text not null,             -- texto (só para mostrar na tela)
  parametros     text[] not null default '{}',  -- ordem das variáveis {{1}}, {{2}}…: paciente, data, hora, medico, dia_semana
  botoes         boolean not null default false, -- tem botões "Confirmar" / "Preciso remarcar"
  ativo          boolean not null default false, -- ligue só depois que a Meta aprovar
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (parametros <@ array['paciente', 'data', 'hora', 'medico', 'dia_semana']::text[])
);

insert into public.whatsapp_modelos (finalidade, nome, corpo, parametros, botoes) values
  ('lembrete_consulta', 'lembrete_consulta',
   'Olá, {{1}}! Passando para lembrar da sua consulta na Consumed Clínica de Olhos: {{2}}, às {{3}}, com {{4}}. Endereço: Rua Coronel Bernardino de Melo, 1679 – Centro – Nova Iguaçu. Toque em um dos botões abaixo para confirmar ou pedir para remarcar.',
   array['paciente', 'data', 'hora', 'medico'], true),
  ('retomar_conversa', 'retomar_conversa',
   'Olá, {{1}}! Aqui é da Consumed Clínica de Olhos. Queremos continuar o seu atendimento por aqui. Pode nos responder esta mensagem?',
   array['paciente'], false);

-- ---------- Gatilhos ----------
create trigger atualizado_em before update on public.whatsapp_conversas
  for each row execute function interno.tg_atualizado_em();
create trigger atualizado_em before update on public.whatsapp_mensagens
  for each row execute function interno.tg_atualizado_em();
create trigger atualizado_em before update on public.whatsapp_modelos
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.whatsapp_modelos
  for each row execute function interno.tg_auditoria();

-- ---------- Funções usadas pelas funções Edge (só chave de serviço) ----------

-- Paciente dono do número (só se houver exatamente um; famílias que dividem o
-- mesmo celular ficam para a recepção escolher na tela).
create or replace function public.whatsapp_paciente_do_numero(p_telefone text)
returns uuid language sql stable set search_path = '' as $$
  select case when count(*) = 1 then min(id::text)::uuid end
  from public.pacientes
  where ativo
    and interno.chave_telefone(p_telefone) is not null
    and (interno.chave_telefone(telefone) = interno.chave_telefone(p_telefone)
         or interno.chave_telefone(telefone_secundario) = interno.chave_telefone(p_telefone))
$$;

-- Conversa do número (cria se não existir)
create or replace function public.whatsapp_conversa(p_telefone text, p_nome text default null, p_paciente uuid default null)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.whatsapp_conversas (telefone, nome_contato, paciente_id)
  values (p_telefone, p_nome, coalesce(p_paciente, public.whatsapp_paciente_do_numero(p_telefone)))
  on conflict (telefone) do update
    set nome_contato = coalesce(excluded.nome_contato, public.whatsapp_conversas.nome_contato),
        paciente_id  = coalesce(public.whatsapp_conversas.paciente_id, excluded.paciente_id)
  returning id into v_id;
  return v_id;
end $$;

-- Mensagem recebida (chamada pelo webhook). Idempotente pelo wa_id.
create or replace function public.whatsapp_receber(
  p_telefone text, p_nome text, p_wa_id text, p_tipo text, p_texto text,
  p_midia_id text default null, p_midia_tipo text default null, p_midia_nome text default null,
  p_em_resposta_a text default null, p_quando timestamptz default now(), p_botao text default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_conversa uuid;
  v_msg      uuid;
  v_paciente uuid;
  v_ag       uuid;
  v_acao     text;
  v_resultado text := null;
begin
  v_conversa := public.whatsapp_conversa(p_telefone, p_nome);

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
         arquivada = false
   where id = v_conversa
  returning paciente_id into v_paciente;

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

  return jsonb_build_object('mensagem_id', v_msg, 'conversa_id', v_conversa, 'resultado', v_resultado);
end $$;

-- Atualização de situação (enviada → entregue → lida, ou falhou)
create or replace function public.whatsapp_situacao(p_wa_id text, p_situacao text, p_erro text default null)
returns void language sql set search_path = '' as $$
  update public.whatsapp_mensagens
     set situacao = p_situacao,
         erro = coalesce(p_erro, erro)
   where wa_id = p_wa_id
     and direcao = 'enviada'
     and (p_situacao = 'falhou'
          or array_position(array['enviada', 'entregue', 'lida'], p_situacao)
             > coalesce(array_position(array['enviada', 'entregue', 'lida'], situacao), 0))
$$;

-- Funções acima: só a chave de serviço (funções Edge) executa
revoke execute on function public.whatsapp_paciente_do_numero(text) from public, anon, authenticated;
revoke execute on function public.whatsapp_conversa(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.whatsapp_receber(text, text, text, text, text, text, text, text, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.whatsapp_situacao(text, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_paciente_do_numero(text) to service_role;
grant execute on function public.whatsapp_conversa(text, text, uuid) to service_role;
grant execute on function public.whatsapp_receber(text, text, text, text, text, text, text, text, text, timestamptz, text) to service_role;
grant execute on function public.whatsapp_situacao(text, text, text) to service_role;

revoke execute on function public.telefone_whatsapp(text) from public, anon;
grant execute on function public.telefone_whatsapp(text) to authenticated, service_role;
revoke execute on function interno.chave_telefone(text) from public, anon;
grant execute on function interno.chave_telefone(text) to authenticated, service_role;
revoke execute on function interno.tg_paciente_whatsapp_em() from public, anon;

-- ---------- Segurança (RLS) ----------
alter table public.whatsapp_conversas enable row level security;
alter table public.whatsapp_mensagens enable row level security;
alter table public.whatsapp_modelos   enable row level security;

revoke all on public.whatsapp_conversas, public.whatsapp_mensagens, public.whatsapp_modelos from anon;
-- A equipe não cria nem apaga conversas/mensagens: só as funções Edge.
revoke insert, update, delete, truncate on public.whatsapp_conversas, public.whatsapp_mensagens from authenticated;
grant select on public.whatsapp_conversas, public.whatsapp_mensagens to authenticated;
-- Na conversa, a equipe só pode: marcar como lida, ligar ao paciente e arquivar.
grant update (nao_lidas, paciente_id, arquivada) on public.whatsapp_conversas to authenticated;

create policy atendimento_le on public.whatsapp_conversas for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
create policy atendimento_altera on public.whatsapp_conversas for update to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')))
  with check ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));

create policy atendimento_le on public.whatsapp_mensagens for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));

create policy equipe_le on public.whatsapp_modelos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
create policy admin_inclui on public.whatsapp_modelos for insert to authenticated
  with check ((select interno.tem_funcao('admin')));
create policy admin_altera on public.whatsapp_modelos for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));
