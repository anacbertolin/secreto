-- =====================================================================
-- 0001 — Base: tipos, funções internas, equipe, convênios, pacientes,
--        histórico de saúde e auditoria
-- =====================================================================
-- Identidade: cada pessoa é identificada pelo e-mail do hospital, que
-- chega no token (JWT) da sessão. O conector MCP / artefatos repassam
-- esse e-mail ao banco; as regras de acesso (RLS) usam esse e-mail.
-- =====================================================================

create schema if not exists interno;
revoke all on schema interno from public, anon;
grant usage on schema interno to authenticated, service_role;

-- ---------- Tipos ----------
create type public.funcao_profissional as enum ('medico', 'enfermagem', 'recepcao', 'admin');
create type public.olho as enum ('OD', 'OE', 'AO');
create type public.sexo as enum ('feminino', 'masculino', 'intersexo', 'nao_informado');

-- ---------- Funções utilitárias ----------
create or replace function interno.tg_atualizado_em()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create or replace function interno.email_atual()
returns text language sql stable set search_path = '' as $$
  select lower(nullif(auth.jwt() ->> 'email', ''))
$$;

-- ---------- Equipe ----------
create table public.profissionais (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  email           text not null unique check (email = lower(email)),
  funcao          public.funcao_profissional not null,
  conselho        text,            -- CRM, COREN...
  numero_conselho text,
  uf_conselho     char(2),
  especialidade   text,
  rqe             text,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.profissionais is 'Equipe do hospital. O e-mail é o login (mesmo e-mail da conta Claude).';

create or replace function interno.profissional_atual()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profissionais
  where email = interno.email_atual() and ativo
$$;

create or replace function interno.tem_funcao(variadic funcoes public.funcao_profissional[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.funcao = any(funcoes) from public.profissionais p
     where p.email = interno.email_atual() and p.ativo),
    false)
$$;

-- ---------- Convênios ----------
create table public.convenios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique,
  registro_ans  text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- Pacientes ----------
create table public.pacientes (
  id                      uuid primary key default gen_random_uuid(),
  numero_prontuario       bigint generated always as identity unique,
  nome                    text not null,
  nome_social             text,
  data_nascimento         date,
  sexo                    public.sexo not null default 'nao_informado',
  cpf                     text unique check (cpf ~ '^[0-9]{11}$'),
  cns                     text check (cns ~ '^[0-9]{15}$'),
  rg                      text,
  nome_mae                text,
  profissao               text,
  telefone                text,
  telefone_secundario     text,
  email                   text,
  cep                     text,
  logradouro              text,
  numero                  text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  uf                      char(2),
  responsavel_nome        text,
  responsavel_telefone    text,
  responsavel_parentesco  text,
  convenio_id             uuid references public.convenios(id),
  convenio_carteirinha    text,
  convenio_validade       date,
  observacoes             text,
  ativo                   boolean not null default true,
  criado_por              uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create index pacientes_nome_idx on public.pacientes (lower(nome));
create index pacientes_convenio_idx on public.pacientes (convenio_id);

-- ---------- Histórico de saúde do paciente ----------
create table public.alergias (
  id             uuid primary key default gen_random_uuid(),
  paciente_id    uuid not null references public.pacientes(id),
  substancia     text not null,
  reacao         text,
  gravidade      text check (gravidade in ('leve', 'moderada', 'grave', 'desconhecida')),
  ativa          boolean not null default true,
  registrado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index alergias_paciente_idx on public.alergias (paciente_id);

create table public.medicamentos_em_uso (
  id             uuid primary key default gen_random_uuid(),
  paciente_id    uuid not null references public.pacientes(id),
  medicamento    text not null,
  posologia      text,
  olho           public.olho,
  inicio         date,
  ativo          boolean not null default true,
  registrado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index medicamentos_paciente_idx on public.medicamentos_em_uso (paciente_id);

create table public.antecedentes (
  id               uuid primary key default gen_random_uuid(),
  paciente_id      uuid not null references public.pacientes(id),
  tipo             text not null check (tipo in ('pessoal', 'familiar', 'ocular', 'cirurgico', 'habitos')),
  descricao        text not null,
  olho             public.olho,
  data_aproximada  text,
  registrado_por   uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index antecedentes_paciente_idx on public.antecedentes (paciente_id);

-- ---------- Auditoria ----------
create table public.log_auditoria (
  id              bigint generated always as identity primary key,
  ocorrido_em     timestamptz not null default now(),
  email           text default interno.email_atual(),
  profissional_id uuid default interno.profissional_atual(),
  acao            text not null,   -- INSERT / UPDATE / DELETE / LEITURA
  tabela          text,
  registro_id     uuid,
  paciente_id     uuid,
  dados_antes     jsonb,
  dados_depois    jsonb,
  detalhes        text
);
create index log_paciente_idx on public.log_auditoria (paciente_id, ocorrido_em desc);
create index log_profissional_idx on public.log_auditoria (profissional_id, ocorrido_em desc);
comment on table public.log_auditoria is 'Quem viu/alterou o quê e quando. Só leitura para admin; nunca é apagado.';

-- Registro de leitura de prontuário (chamado pelo conector ao abrir um prontuário)
create or replace function public.registrar_leitura(p_paciente_id uuid, p_detalhes text default null)
returns void language sql security invoker set search_path = '' as $$
  insert into public.log_auditoria (acao, tabela, paciente_id, registro_id, detalhes)
  values ('LEITURA', 'pacientes', p_paciente_id, p_paciente_id, p_detalhes)
$$;

-- Gatilho genérico de auditoria (alterações)
create or replace function interno.tg_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_linha    jsonb;
  v_registro uuid;
  v_paciente uuid;
begin
  v_linha := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_registro := (v_linha ->> 'id')::uuid;

  if tg_table_name = 'pacientes' then
    v_paciente := v_registro;
  elsif v_linha ? 'paciente_id' then
    v_paciente := (v_linha ->> 'paciente_id')::uuid;
  elsif v_linha ? 'atendimento_id' then
    select a.paciente_id into v_paciente
    from public.atendimentos a where a.id = (v_linha ->> 'atendimento_id')::uuid;
  elsif v_linha ? 'prescricao_id' then
    select a.paciente_id into v_paciente
    from public.prescricoes p join public.atendimentos a on a.id = p.atendimento_id
    where p.id = (v_linha ->> 'prescricao_id')::uuid;
  end if;

  insert into public.log_auditoria (acao, tabela, registro_id, paciente_id, dados_antes, dados_depois)
  values (tg_op, tg_table_name, v_registro, v_paciente,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

-- Gatilhos das tabelas desta migração
do $$
declare t text;
begin
  foreach t in array array['profissionais', 'convenios', 'pacientes', 'alergias', 'medicamentos_em_uso', 'antecedentes'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;
