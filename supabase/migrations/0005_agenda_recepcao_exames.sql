-- =====================================================================
-- 0005 — Sistema v1: agenda com horários, recepção, exames e laudos,
--        modelos de texto e acesso (login) restrito à equipe
-- =====================================================================

-- ---------- Locais de atendimento (consultórios, salas de exame) ----------
create table public.locais (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique,
  tipo          text not null default 'consultorio'
                check (tipo in ('consultorio', 'sala_exame', 'centro_cirurgico', 'outro')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- Horários de atendimento de cada profissional ----------
create table public.horarios_profissional (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.profissionais(id),
  dia_semana      smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo
  hora_inicio     time not null,
  hora_fim        time not null,
  duracao_min     int not null default 15 check (duracao_min between 5 and 240),
  local_id        uuid references public.locais(id),
  vigente_de      date,
  vigente_ate     date,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);
create index horarios_profissional_idx on public.horarios_profissional (profissional_id);
create index horarios_local_idx on public.horarios_profissional (local_id);

-- ---------- Bloqueios (férias, congresso, feriado) ----------
create table public.bloqueios_agenda (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid references public.profissionais(id),   -- vazio = vale para todos
  inicio          timestamptz not null,
  fim             timestamptz not null,
  motivo          text not null,
  ativo           boolean not null default true,
  criado_por      uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check (fim > inicio)
);
create index bloqueios_profissional_idx on public.bloqueios_agenda (profissional_id);
create index bloqueios_inicio_idx on public.bloqueios_agenda (inicio);
create index bloqueios_criado_por_idx on public.bloqueios_agenda (criado_por);

-- ---------- Agenda: dados da recepção ----------
alter table public.agendamentos
  add column local_id      uuid references public.locais(id),
  add column primeira_vez  boolean not null default false,
  add column encaixe       boolean not null default false,
  add column canal_confirmacao text
             check (canal_confirmacao in ('telefone', 'whatsapp', 'presencial', 'email', 'sms')),
  add column confirmado_em timestamptz,
  add column chegada_em    timestamptz,
  add column chamado_em    timestamptz,
  add column concluido_em  timestamptz;
create index agendamentos_local_idx on public.agendamentos (local_id);
create index agendamentos_profissional_inicio_idx on public.agendamentos (profissional_id, inicio);

-- Marca automaticamente a hora de cada mudança de situação
create or replace function interno.tg_agendamento_horarios()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'confirmado'     then new.confirmado_em := coalesce(new.confirmado_em, now());
      when 'chegou'         then new.chegada_em    := coalesce(new.chegada_em, now());
      when 'em_atendimento' then new.chamado_em    := coalesce(new.chamado_em, now());
                                 new.chegada_em    := coalesce(new.chegada_em, now());
      when 'atendido'       then new.concluido_em  := coalesce(new.concluido_em, now());
      else null;
    end case;
  end if;
  return new;
end $$;
create trigger horarios_status before insert or update on public.agendamentos
  for each row execute function interno.tg_agendamento_horarios();

-- ---------- Atendimento: um por agendamento ----------
create unique index atendimentos_agendamento_unico on public.atendimentos (agendamento_id)
  where agendamento_id is not null;
drop index if exists public.atendimentos_agendamento_idx;

-- Abre (ou reabre) a folha de atendimento de um agendamento.
-- Enfermagem pode abrir para fazer a triagem; o atendimento fica em nome do médico da agenda.
create or replace function public.abrir_atendimento(p_agendamento_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_ag   public.agendamentos;
  v_id   uuid;
  v_eu   uuid := interno.profissional_atual();
begin
  if not interno.tem_funcao('medico', 'enfermagem') then
    raise exception 'Somente médicos e enfermagem podem abrir atendimentos.';
  end if;

  select * into v_ag from public.agendamentos where id = p_agendamento_id;
  if not found then
    raise exception 'Agendamento não encontrado.';
  end if;
  if v_ag.status in ('cancelado', 'faltou') then
    raise exception 'Este agendamento está cancelado ou o paciente faltou.';
  end if;

  select id into v_id from public.atendimentos where agendamento_id = p_agendamento_id;
  if v_id is null then
    insert into public.atendimentos (paciente_id, agendamento_id, profissional_id, tipo)
    values (v_ag.paciente_id, v_ag.id, v_ag.profissional_id, v_ag.tipo)
    returning id into v_id;
  end if;

  -- Quando o próprio médico abre, o paciente passa a "em atendimento"
  if v_eu = v_ag.profissional_id and v_ag.status in ('agendado', 'confirmado', 'chegou') then
    update public.agendamentos set status = 'em_atendimento' where id = v_ag.id;
  end if;

  return v_id;
end $$;

-- Ao finalizar o atendimento, a agenda passa para "atendido"
create or replace function interno.tg_atendimento_finalizado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'finalizado' and old.status <> 'finalizado' and new.agendamento_id is not null then
    update public.agendamentos set status = 'atendido'
    where id = new.agendamento_id and status not in ('cancelado', 'faltou', 'atendido');
  end if;
  return null;
end $$;
create trigger agenda_atendido after update on public.atendimentos
  for each row execute function interno.tg_atendimento_finalizado();

-- ---------- Catálogo de exames ----------
create table public.exames_catalogo (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique,
  codigo_tuss   text,
  requer_laudo  boolean not null default true,
  duracao_min   int not null default 15 check (duracao_min between 5 and 480),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- Exames realizados e laudos ----------
create type public.status_exame as enum
  ('aguardando', 'em_execucao', 'aguardando_laudo', 'laudado', 'cancelado');

create table public.exames_realizados (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null references public.pacientes(id),
  agendamento_id      uuid references public.agendamentos(id),
  solicitacao_id      uuid references public.solicitacoes_exames(id),
  exame_catalogo_id   uuid references public.exames_catalogo(id),
  exame               text not null,
  olho                public.olho,
  status              public.status_exame not null default 'aguardando',
  executado_por       uuid references public.profissionais(id),
  executado_em        timestamptz,
  observacoes_execucao text,
  laudo               text,
  conclusao           text,
  laudado_por         uuid references public.profissionais(id),
  laudado_em          timestamptz,
  motivo_cancelamento text,
  criado_por          uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index exames_realizados_paciente_idx on public.exames_realizados (paciente_id, criado_em desc);
create index exames_realizados_status_idx on public.exames_realizados (status);
create index exames_realizados_agendamento_idx on public.exames_realizados (agendamento_id);
create index exames_realizados_solicitacao_idx on public.exames_realizados (solicitacao_id);
create index exames_realizados_catalogo_idx on public.exames_realizados (exame_catalogo_id);
create index exames_realizados_executado_por_idx on public.exames_realizados (executado_por);
create index exames_realizados_laudado_por_idx on public.exames_realizados (laudado_por);
create index exames_realizados_criado_por_idx on public.exames_realizados (criado_por);

-- Regras do laudo: só médico escreve/assina; laudo assinado não muda mais
create or replace function interno.tg_exame_regras()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status in ('laudado', 'cancelado') then
    raise exception 'Este exame já foi laudado ou cancelado e não pode ser alterado.';
  end if;

  if (new.laudo is distinct from case when tg_op = 'UPDATE' then old.laudo end
      or new.conclusao is distinct from case when tg_op = 'UPDATE' then old.conclusao end
      or new.status = 'laudado')
     and not interno.tem_funcao('medico') then
    raise exception 'Somente médicos podem escrever ou assinar laudos.';
  end if;

  if new.status in ('aguardando_laudo', 'laudado')
     and (tg_op = 'INSERT' or old.status in ('aguardando', 'em_execucao')) then
    new.executado_em  := coalesce(new.executado_em, now());
    new.executado_por := coalesce(new.executado_por, interno.profissional_atual());
  end if;

  if new.status = 'laudado' then
    if coalesce(trim(new.laudo), '') = '' then
      raise exception 'Escreva o laudo antes de assinar.';
    end if;
    new.laudado_em  := now();
    new.laudado_por := interno.profissional_atual();
  end if;

  if new.status = 'cancelado' and coalesce(trim(new.motivo_cancelamento), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  return new;
end $$;
create trigger regras_exame before insert or update on public.exames_realizados
  for each row execute function interno.tg_exame_regras();

-- Quando o exame é laudado, o pedido de exame (se houver) vira "realizado"
create or replace function interno.tg_exame_atualiza_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.solicitacao_id is not null and new.status in ('aguardando_laudo', 'laudado') then
    update public.solicitacoes_exames set status = 'realizado'
    where id = new.solicitacao_id and status <> 'realizado'
      and not exists (select 1 from public.atendimentos a
                      where a.id = solicitacoes_exames.atendimento_id and a.status = 'finalizado');
  end if;
  return null;
end $$;
create trigger atualiza_pedido after insert or update on public.exames_realizados
  for each row execute function interno.tg_exame_atualiza_pedido();

-- Arquivos (imagens, PDFs) do exame — guardados no Storage, bucket "exames"
create table public.exame_arquivos (
  id                 uuid primary key default gen_random_uuid(),
  exame_realizado_id uuid not null references public.exames_realizados(id),
  caminho            text not null unique,
  nome_arquivo       text not null,
  tipo_mime          text,
  tamanho_bytes      bigint,
  enviado_por        uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em          timestamptz not null default now()
);
create index exame_arquivos_exame_idx on public.exame_arquivos (exame_realizado_id);
create index exame_arquivos_enviado_por_idx on public.exame_arquivos (enviado_por);

create or replace function interno.tg_arquivo_exame_trava()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.exames_realizados e
             where e.id = new.exame_realizado_id and e.status in ('laudado', 'cancelado')) then
    raise exception 'Este exame já foi laudado ou cancelado; não é possível anexar arquivos.';
  end if;
  return new;
end $$;
create trigger trava_arquivo before insert on public.exame_arquivos
  for each row execute function interno.tg_arquivo_exame_trava();

-- ---------- Modelos de texto (laudos, condutas, atestados...) ----------
create table public.modelos_texto (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in
                    ('laudo', 'anamnese', 'exame', 'conduta', 'orientacoes', 'atestado', 'documento', 'outro')),
  titulo          text not null,
  texto           text not null,
  profissional_id uuid references public.profissionais(id) default interno.profissional_atual(),  -- dono do modelo
  compartilhado   boolean not null default true,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index modelos_texto_profissional_idx on public.modelos_texto (profissional_id);

-- ---------- Gatilhos: atualizado_em e auditoria ----------
do $$
declare t text;
begin
  foreach t in array array['locais', 'horarios_profissional', 'bloqueios_agenda', 'exames_catalogo',
                           'exames_realizados', 'modelos_texto'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
  end loop;
  foreach t in array array['locais', 'horarios_profissional', 'bloqueios_agenda', 'exames_catalogo',
                           'exames_realizados', 'exame_arquivos', 'modelos_texto'] loop
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================
alter table public.locais                enable row level security;
alter table public.horarios_profissional enable row level security;
alter table public.bloqueios_agenda      enable row level security;
alter table public.exames_catalogo       enable row level security;
alter table public.exames_realizados     enable row level security;
alter table public.exame_arquivos        enable row level security;
alter table public.modelos_texto         enable row level security;

-- Cadastros de apoio: toda a equipe lê; recepção e admin mantêm
do $$
declare t text;
begin
  foreach t in array array['locais', 'horarios_profissional', 'bloqueios_agenda', 'exames_catalogo'] loop
    execute format($p$create policy equipe_le on public.%I for select to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')))$p$, t);
    execute format($p$create policy recepcao_admin_inclui on public.%I for insert to authenticated
      with check ((select interno.tem_funcao('recepcao', 'admin')))$p$, t);
    execute format($p$create policy recepcao_admin_altera on public.%I for update to authenticated
      using ((select interno.tem_funcao('recepcao', 'admin')))
      with check ((select interno.tem_funcao('recepcao', 'admin')))$p$, t);
  end loop;
end $$;

-- Exames realizados: conteúdo clínico (médico e enfermagem)
create policy clinico_le on public.exames_realizados for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy clinico_inclui on public.exames_realizados for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem')));
create policy clinico_altera on public.exames_realizados for update to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')))
  with check ((select interno.tem_funcao('medico', 'enfermagem')));

create policy clinico_le on public.exame_arquivos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy clinico_inclui on public.exame_arquivos for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem')));

-- Modelos de texto: clínicos leem os compartilhados e os próprios; cada um mantém os seus
create policy clinico_le on public.modelos_texto for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem'))
         and (compartilhado or profissional_id = (select interno.profissional_atual())));
create policy clinico_inclui on public.modelos_texto for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem'))
              and profissional_id = (select interno.profissional_atual()));
create policy dono_altera on public.modelos_texto for update to authenticated
  using (profissional_id = (select interno.profissional_atual()))
  with check (profissional_id = (select interno.profissional_atual()));

-- Função de abrir atendimento: só para usuários logados
revoke execute on function public.abrir_atendimento(uuid) from public, anon;
grant execute on function public.abrir_atendimento(uuid) to authenticated;

-- =====================================================================
-- Arquivos dos exames (Storage) — privado, até 50 MB por arquivo
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('exames', 'exames', false, 52428800)
on conflict (id) do nothing;

create policy exames_clinico_le on storage.objects for select to authenticated
  using (bucket_id = 'exames' and (select interno.tem_funcao('medico', 'enfermagem')));
create policy exames_clinico_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'exames' and (select interno.tem_funcao('medico', 'enfermagem')));

-- =====================================================================
-- Login: só e-mails cadastrados (e ativos) na equipe podem criar conta
-- =====================================================================
create or replace function interno.tg_somente_equipe()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profissionais p
                 where p.email = lower(new.email) and p.ativo) then
    raise exception 'Este e-mail não faz parte da equipe cadastrada.';
  end if;
  return new;
end $$;
grant usage on schema interno to supabase_auth_admin;
grant execute on function interno.tg_somente_equipe() to supabase_auth_admin;
create trigger somente_equipe before insert on auth.users
  for each row execute function interno.tg_somente_equipe();

-- =====================================================================
-- Catálogo inicial de exames oftalmológicos (pode ser editado na tela)
-- =====================================================================
insert into public.exames_catalogo (nome, requer_laudo, duracao_min) values
  ('Tomografia de coerência óptica (OCT)', true, 20),
  ('Campimetria computadorizada', true, 30),
  ('Topografia de córnea', true, 15),
  ('Paquimetria ultrassônica', true, 10),
  ('Mapeamento de retina', true, 20),
  ('Retinografia colorida', true, 15),
  ('Angiofluoresceinografia', true, 40),
  ('Biometria ultrassônica', true, 15),
  ('Biometria óptica', true, 15),
  ('Microscopia especular de córnea', true, 15),
  ('Ultrassonografia ocular (ecografia)', true, 20),
  ('Curva tensional diária', true, 60),
  ('Gonioscopia', true, 10),
  ('Teste ortóptico', true, 30),
  ('Potencial de acuidade macular', false, 10)
on conflict (nome) do nothing;
