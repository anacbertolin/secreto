-- =====================================================================
-- 0080 — Central de atendimento, passo 2: status da atendente e fila do WhatsApp
-- =====================================================================
-- Pedido da dona (23/11/2026). 5 atendentes na Central (telefone + WhatsApp) e 1 na Orientação Cirúrgica.
--  * Status único da atendente (vale para WhatsApp e telefone): Disponível / Pausa / Almoço (escolha da dona:
--    poucas opções, fácil para a equipe).
--  * Ao sair de "Disponível", as conversas dela voltam para a fila (as que esperam resposta) ou ficam livres.
--  * Fila do WhatsApp com tempo de espera (whatsapp_conversas.fila_desde) e "Pegar o próximo" (o mais antigo).
--  * Filas separadas por setor: 'clinica' (Central) e 'orientacao' (Orientação Cirúrgica).
-- Só acrescenta (coluna opcional nova e tabela nova); nada existente muda de comportamento.
-- =====================================================================

-- ---------- Fila: desde quando a conversa espera alguém ----------
alter table public.whatsapp_conversas add column fila_desde timestamptz;
comment on column public.whatsapp_conversas.fila_desde is
  'Desde quando a conversa espera na fila (sem responsável e com mensagem do paciente sem resposta). Nulo = fora da fila.';
create index whatsapp_conversas_fila_idx on public.whatsapp_conversas (setor, fila_desde)
  where fila_desde is not null and responsavel_id is null and not arquivada;

-- Mensagem do paciente numa conversa sem responsável → entra na fila (mantém a hora em que entrou)
create or replace function interno.tg_whatsapp_fila_mensagem()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.direcao = 'recebida' then
    update public.whatsapp_conversas
       set fila_desde = coalesce(fila_desde, new.quando)
     where id = new.conversa_id and responsavel_id is null and not arquivada;
  end if;
  return null;
end $$;
create trigger fila after insert on public.whatsapp_mensagens
  for each row execute function interno.tg_whatsapp_fila_mensagem();

-- Alguém assumiu → sai da fila; ficou sem responsável esperando resposta → volta para a fila; arquivou → sai
create or replace function interno.tg_whatsapp_fila_conversa()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.arquivada or new.responsavel_id is not null then
    new.fila_desde := null;
  elsif old.responsavel_id is not null or old.arquivada then
    -- devolvida (pausa/almoço/soltar) ou desarquivada: entra na fila só se a última mensagem é do paciente
    new.fila_desde := case
      when new.ultima_recebida_em is not null
       and new.ultima_recebida_em >= coalesce(new.ultima_mensagem_em, new.ultima_recebida_em)
      then coalesce(new.fila_desde, new.ultima_recebida_em) end;
  end if;
  return new;
end $$;
create trigger fila before update of responsavel_id, arquivada on public.whatsapp_conversas
  for each row execute function interno.tg_whatsapp_fila_conversa();

-- Conversas que já estão esperando hoje entram na fila
update public.whatsapp_conversas c
   set fila_desde = c.ultima_recebida_em
 where c.responsavel_id is null and not c.arquivada and c.ultima_recebida_em is not null
   and c.ultima_recebida_em >= coalesce(c.ultima_mensagem_em, c.ultima_recebida_em);

-- ---------- Status da atendente ----------
create table public.central_status (
  profissional_id uuid primary key references public.profissionais(id),
  status          text not null default 'disponivel' check (status in ('disponivel', 'pausa', 'almoco')),
  desde           timestamptz not null default now()
);
comment on table public.central_status is
  'Status da atendente na Central (vale para WhatsApp e telefone). Gravado só pela função central_mudar_status.';

-- Setor de quem está logado: quem atende a Orientação Cirúrgica fica na fila dela; os demais, na Central
create or replace function interno.central_meu_setor()
returns text language sql stable security definer set search_path = '' as $$
  select case when interno.atende_orientacao() then 'orientacao' else 'clinica' end
$$;

create or replace function interno.central_pode_atender(p_setor text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_setor
    when 'orientacao' then interno.atende_orientacao()
    else interno.tem_funcao('recepcao', 'admin') and not interno.atende_orientacao()
  end
$$;

-- Mudar o próprio status. Saindo de "Disponível", devolve as conversas abertas da pessoa:
-- as que esperam resposta voltam para a fila (gatilho acima); as demais só ficam sem responsável.
create or replace function public.central_mudar_status(p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := interno.profissional_atual();
  n  int := 0;
begin
  if eu is null or not interno.central_pode_atender(interno.central_meu_setor()) then
    raise exception 'Só quem atende a Central ou a Orientação Cirúrgica usa o status.' using errcode = '42501';
  end if;
  if p_status not in ('disponivel', 'pausa', 'almoco') then
    raise exception 'Status inválido.';
  end if;
  insert into public.central_status (profissional_id, status, desde) values (eu, p_status, now())
  on conflict (profissional_id) do update
    set status = excluded.status,
        desde  = case when public.central_status.status = excluded.status then public.central_status.desde else now() end;
  if p_status <> 'disponivel' then
    update public.whatsapp_conversas set responsavel_id = null
     where responsavel_id = eu and not arquivada;
    get diagnostics n = row_count;
  end if;
  return jsonb_build_object('status', p_status, 'devolvidas', n);
end $$;

-- Pegar o próximo da fila (o que espera há mais tempo, no setor da pessoa). Só para quem está Disponível.
create or replace function public.central_pegar_proximo()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  eu      uuid := interno.profissional_atual();
  v_setor text := interno.central_meu_setor();
  st      text;
  v       uuid;
begin
  if eu is null or not interno.central_pode_atender(v_setor) then
    raise exception 'Só quem atende a Central ou a Orientação Cirúrgica pega conversas da fila.' using errcode = '42501';
  end if;
  select status into st from public.central_status where profissional_id = eu;
  if coalesce(st, 'disponivel') <> 'disponivel' then
    raise exception 'Você está em pausa. Clique em Disponível para pegar conversas.';
  end if;
  select id into v from public.whatsapp_conversas
   where setor = v_setor
     and responsavel_id is null and not arquivada and fila_desde is not null
   order by fila_desde
   limit 1
   for update skip locked;
  if v is null then return null; end if;
  update public.whatsapp_conversas set responsavel_id = eu where id = v;
  return v;
end $$;

-- ---------- Permissões ----------
revoke execute on function interno.tg_whatsapp_fila_mensagem() from public, anon, authenticated;
revoke execute on function interno.tg_whatsapp_fila_conversa() from public, anon, authenticated;
revoke execute on function interno.central_meu_setor() from public, anon;
revoke execute on function interno.central_pode_atender(text) from public, anon;
grant execute on function interno.central_meu_setor() to authenticated;
grant execute on function interno.central_pode_atender(text) to authenticated;
revoke execute on function public.central_mudar_status(text) from public, anon;
revoke execute on function public.central_pegar_proximo() from public, anon;
grant execute on function public.central_mudar_status(text) to authenticated;
grant execute on function public.central_pegar_proximo() to authenticated;

alter table public.central_status enable row level security;
revoke all on public.central_status from anon;
revoke insert, update, delete, truncate on public.central_status from authenticated;
-- A equipe vê o status de todos (para saber quem está livre); ninguém grava direto
create policy equipe_le on public.central_status for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));

alter publication supabase_realtime add table public.central_status;
