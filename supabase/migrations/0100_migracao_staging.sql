-- =====================================================================
-- 0100 — Área de staging para a migração do Micrologos
-- =====================================================================
-- Ideia: os dados exportados do Micrologos entram PRIMEIRO aqui, crus
-- (tudo como texto, do jeito que vieram), no schema privado
-- "legacy_micrologos". Depois, com SQL, são conferidos, limpos e
-- copiados para as tabelas oficiais do schema public.
--
-- - Este schema NÃO é exposto pela API (só public é). Mesmo assim:
--   RLS ligado em tudo e nenhum acesso para anon/authenticated.
-- - Só o service_role (servidor) e o dono do banco mexem aqui.
-- - Rastreabilidade: legacy_micrologos.mapa_ids guarda, para cada
--   registro migrado, o ID antigo (Micrologos) e o novo (uuid).
--   Assim não precisamos mexer nas tabelas oficiais do sistema.
-- =====================================================================

create schema if not exists legacy_micrologos;
revoke all on schema legacy_micrologos from public, anon, authenticated;
grant usage on schema legacy_micrologos to service_role;
comment on schema legacy_micrologos is
  'Staging da migração do Micrologos (dados crus). Privado: só service_role. Pode ser apagado depois da virada + período de guarda.';

-- ---------- Controle das cargas ----------
create table legacy_micrologos.cargas (
  id                 bigint generated always as identity primary key,
  arquivo            text not null,           -- nome do arquivo exportado
  tabela             text not null,           -- tabela bruta de destino (bruto_*)
  hash_sha256        text,                    -- integridade do arquivo
  linhas_esperadas   integer,
  linhas_carregadas  integer not null default 0,
  status             text not null default 'em_andamento'
                     check (status in ('em_andamento', 'concluida', 'falhou', 'descartada')),
  iniciado_em        timestamptz not null default now(),
  concluido_em       timestamptz,
  observacoes        text
);

-- ---------- De-para de IDs (antigo -> novo) ----------
create table legacy_micrologos.mapa_ids (
  entidade    text not null,                  -- ex.: 'paciente', 'agenda', 'medico'
  legacy_id   text not null,                  -- ID_* do Micrologos
  novo_id     uuid not null,                  -- id na tabela oficial
  tabela_nova text not null,                  -- ex.: 'public.pacientes'
  carga_id    bigint references legacy_micrologos.cargas(id),
  criado_em   timestamptz not null default now(),
  primary key (entidade, legacy_id)
);
create index mapa_ids_novo_idx on legacy_micrologos.mapa_ids (novo_id);
create index mapa_ids_carga_idx on legacy_micrologos.mapa_ids (carga_id);

-- ---------- Problemas encontrados na conferência ----------
create table legacy_micrologos.ocorrencias (
  id          bigint generated always as identity primary key,
  carga_id    bigint references legacy_micrologos.cargas(id),
  entidade    text not null,
  legacy_id   text,
  severidade  text not null check (severidade in ('info', 'aviso', 'erro')),
  regra       text not null,                  -- ex.: 'cpf_invalido'
  mensagem    text,
  criado_em   timestamptz not null default now()
);
create index ocorrencias_carga_idx on legacy_micrologos.ocorrencias (carga_id);
create index ocorrencias_regra_idx on legacy_micrologos.ocorrencias (entidade, regra);

-- ---------- Pacientes duplicados que foram unificados ----------
create table legacy_micrologos.fusoes_pacientes (
  legacy_id_mantido text not null,
  legacy_id_fundido text not null primary key,
  criterio          text not null,            -- 'cpf', 'cns', 'nome+nascimento', 'manual'
  decidido_por      text,
  criado_em         timestamptz not null default now()
);

alter table legacy_micrologos.cargas           enable row level security;
alter table legacy_micrologos.mapa_ids         enable row level security;
alter table legacy_micrologos.ocorrencias      enable row level security;
alter table legacy_micrologos.fusoes_pacientes enable row level security;

-- =====================================================================
-- Criação e carga das tabelas brutas (bruto_<nome>)
-- =====================================================================

-- Cria (se não existir) uma tabela bruta com todas as colunas texto.
create or replace function legacy_micrologos.criar_tabela_bruta(p_tabela text, p_colunas text[])
returns text language plpgsql set search_path = '' as $$
declare
  v_nome text := 'bruto_' || lower(p_tabela);
  v_col  text;
  v_sql  text;
begin
  if v_nome !~ '^bruto_[a-z0-9_]{1,50}$' then
    raise exception 'Nome de tabela inválido: %', p_tabela;
  end if;
  if coalesce(array_length(p_colunas, 1), 0) = 0 then
    raise exception 'Nenhuma coluna informada para %', p_tabela;
  end if;

  v_sql := format('create table if not exists legacy_micrologos.%I (_carga_id bigint not null references legacy_micrologos.cargas(id), _linha integer not null', v_nome);
  foreach v_col in array p_colunas loop
    if v_col !~ '^[a-z0-9_]{1,60}$' or v_col in ('_carga_id', '_linha') then
      raise exception 'Nome de coluna inválido: %', v_col;
    end if;
    v_sql := v_sql || format(', %I text', v_col);
  end loop;
  v_sql := v_sql || format(', primary key (_carga_id, _linha))');
  execute v_sql;

  -- colunas novas numa reexportação: acrescenta sem apagar nada
  foreach v_col in array p_colunas loop
    execute format('alter table legacy_micrologos.%I add column if not exists %I text', v_nome, v_col);
  end loop;

  execute format('alter table legacy_micrologos.%I enable row level security', v_nome);
  execute format('revoke all on legacy_micrologos.%I from public, anon, authenticated', v_nome);
  execute format('grant all on legacy_micrologos.%I to service_role', v_nome);
  return v_nome;
end $$;

-- Insere um lote de linhas (array JSON de objetos {coluna: valor}).
-- Reexecutar o mesmo lote não duplica (chave _carga_id + _linha).
create or replace function legacy_micrologos.carregar_lote(p_tabela text, p_carga_id bigint, p_linhas jsonb)
returns integer language plpgsql set search_path = '' as $$
declare
  v_nome text := 'bruto_' || lower(p_tabela);
  v_qtd  integer;
begin
  if v_nome !~ '^bruto_[a-z0-9_]{1,50}$' then
    raise exception 'Nome de tabela inválido: %', p_tabela;
  end if;
  execute format(
    'insert into legacy_micrologos.%1$I
       select * from jsonb_populate_recordset(null::legacy_micrologos.%1$I,
         (select jsonb_agg(l || jsonb_build_object(''_carga_id'', $2)) from jsonb_array_elements($1) l))
     on conflict (_carga_id, _linha) do nothing', v_nome)
  using p_linhas, p_carga_id;
  get diagnostics v_qtd = row_count;

  update legacy_micrologos.cargas
     set linhas_carregadas = linhas_carregadas + v_qtd
   where id = p_carga_id;
  return v_qtd;
end $$;

-- =====================================================================
-- Funções de limpeza (usadas nos SQL de transformação)
-- =====================================================================

-- Texto: tira espaços sobrando, corrige acentuação quebrada (Ã§ -> ç), vazio vira null
create or replace function legacy_micrologos.txt(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  v := nullif(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), '');
  if v ~ '(Ã[\u0080-¿]|Â[\u0080-¿])' then
    begin
      v := convert_from(convert_to(v, 'LATIN1'), 'UTF8');
    exception when others then
      null; -- mantém como veio
    end;
  end if;
  return v;
end $$;

create or replace function legacy_micrologos.so_digitos(p text)
returns text language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '')
$$;

-- CPF válido (11 dígitos, dígitos verificadores corretos, não repetido)
create or replace function legacy_micrologos.cpf_valido(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  d text := legacy_micrologos.so_digitos(p);
  s int; r int; i int;
begin
  if d is null then return false; end if;
  d := lpad(d, 11, '0');
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end $$;

-- CPF normalizado (11 dígitos) ou null se inválido
create or replace function legacy_micrologos.cpf(p text)
returns text language sql immutable set search_path = '' as $$
  select case when legacy_micrologos.cpf_valido(p)
              then lpad(legacy_micrologos.so_digitos(p), 11, '0') end
$$;

-- CNS (cartão SUS) válido: 15 dígitos e soma ponderada múltipla de 11
create or replace function legacy_micrologos.cns(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  d text := legacy_micrologos.so_digitos(p);
  s int := 0; i int;
begin
  if d is null or length(d) <> 15 or substr(d, 1, 1) not in ('1','2','7','8','9') then return null; end if;
  for i in 1..15 loop s := s + substr(d, i, 1)::int * (16 - i); end loop;
  return case when s % 11 = 0 then d end;
end $$;

-- Telefone brasileiro: só dígitos com DDD (10 ou 11 dígitos), sem o 55
create or replace function legacy_micrologos.telefone(p text)
returns text language plpgsql immutable set search_path = '' as $$
declare d text := legacy_micrologos.so_digitos(p);
begin
  if d is null then return null; end if;
  d := regexp_replace(d, '^0+', '');
  if length(d) in (12, 13) and d like '55%' then d := substr(d, 3); end if;
  return case when length(d) in (10, 11) then d end;
end $$;

create or replace function legacy_micrologos.cep(p text)
returns text language sql immutable set search_path = '' as $$
  select case when length(legacy_micrologos.so_digitos(p)) = 8 then legacy_micrologos.so_digitos(p) end
$$;

create or replace function legacy_micrologos.uf(p text)
returns char(2) language sql immutable set search_path = '' as $$
  select case when upper(btrim(p)) in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then upper(btrim(p))::char(2) end
$$;

create or replace function legacy_micrologos.email(p text)
returns text language sql immutable set search_path = '' as $$
  select case when lower(btrim(p)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(btrim(p)) end
$$;

-- Data em vários formatos (dd/mm/aaaa, aaaa-mm-dd, dd-mm-aaaa, dd/mm/aa, com ou sem hora)
create or replace function legacy_micrologos.data(p text)
returns date language plpgsql immutable set search_path = '' as $$
declare v text := btrim(coalesce(p, '')); r date;
begin
  if v = '' or v ~ '^0{1,4}[-/]0{1,2}[-/]0{1,4}' then return null; end if;
  v := split_part(split_part(v, ' ', 1), 'T', 1);
  begin
    if v ~ '^\d{4}-\d{1,2}-\d{1,2}$' then r := to_date(v, 'YYYY-MM-DD');
    elsif v ~ '^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$' then r := to_date(regexp_replace(v, '[.-]', '/', 'g'), 'DD/MM/YYYY');
    elsif v ~ '^\d{1,2}/\d{1,2}/\d{2}$' then
      r := to_date(v, 'DD/MM/YY');
      if r > current_date then r := r - interval '100 years'; end if;
    elsif v ~ '^\d{8}$' then r := to_date(v, 'YYYYMMDD');
    else return null;
    end if;
  exception when others then return null;
  end;
  if r < date '1880-01-01' or r > date '2100-12-31' then return null; end if;
  return r;
end $$;

-- Data e hora (horário de Brasília quando não vier fuso)
create or replace function legacy_micrologos.data_hora(p text, p_hora text default null)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare
  d date := legacy_micrologos.data(p);
  h text := coalesce(nullif(btrim(p_hora), ''),
                     substring(btrim(coalesce(p, '')) from '[ T](\d{1,2}:\d{2}(:\d{2})?)'));
begin
  if d is null then return null; end if;
  if h is null or h !~ '^\d{1,2}:\d{2}(:\d{2})?$' then h := '00:00'; end if;
  return (d::text || ' ' || h)::timestamp at time zone 'America/Sao_Paulo';
exception when others then return null;
end $$;

-- Valor monetário: '1.234,56' / '1234.56' / 'R$ 10,00' -> numeric
create or replace function legacy_micrologos.valor(p text)
returns numeric language plpgsql immutable set search_path = '' as $$
declare v text := regexp_replace(coalesce(p, ''), '[^0-9,.\-]', '', 'g');
begin
  if v = '' then return null; end if;
  if v ~ ',\d{1,2}$' then v := replace(replace(v, '.', ''), ',', '.');
  elsif v ~ ',' then v := replace(v, ',', '');
  end if;
  return v::numeric;
exception when others then return null;
end $$;

create or replace function legacy_micrologos.sexo(p text)
returns public.sexo language sql immutable set search_path = '' as $$
  select case upper(left(btrim(coalesce(p, '')), 1))
    when 'F' then 'feminino'::public.sexo
    when 'M' then 'masculino'::public.sexo
    else 'nao_informado'::public.sexo end
$$;

-- Status da agenda do Micrologos -> status do sistema novo.
-- (Lista de status confirmada no levantamento: docs/micrologos/modulos/clinic-agenda-recepcao.md)
create or replace function legacy_micrologos.status_agenda(p text)
returns public.status_agendamento language sql immutable set search_path = '' as $$
  select case
    when s in ('agendado', 'esp. pend.', 'esp pend', 'espera pendente') then 'agendado'
    when s like '%conf%'                                              then 'confirmado'
    when s in ('atendendo')                                           then 'em_atendimento'
    when s in ('atendido')                                            then 'atendido'
    when s in ('faltou')                                              then 'faltou'
    when s like '%canc%' or s in ('desistiu', 'desmembrado', 'site temp') then 'cancelado'
    else null end::public.status_agendamento
  from (select lower(btrim(coalesce(p, ''))) as s) x
$$;

-- Canal de confirmação/cancelamento embutido no status do Micrologos
create or replace function legacy_micrologos.canal_status_agenda(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when s like 'whats%' then 'whatsapp'
    when s like 'sms%'   then 'sms'
    when s like 'email%' then 'email'
    when s like 'site%'  then 'site'
    when s like 'tel%'   then 'telefone' end
  from (select lower(btrim(coalesce(p, ''))) as s) x
$$;

-- Helpers de de-para
create or replace function legacy_micrologos.novo_id(p_entidade text, p_legacy_id text)
returns uuid language sql stable set search_path = '' as $$
  select coalesce(
    (select m.novo_id from legacy_micrologos.mapa_ids m
      where m.entidade = p_entidade
        and m.legacy_id = coalesce((select f.legacy_id_mantido from legacy_micrologos.fusoes_pacientes f
                                    where p_entidade = 'paciente' and f.legacy_id_fundido = btrim(p_legacy_id)),
                                   btrim(p_legacy_id))),
    null)
$$;

-- =====================================================================
-- Porta de entrada pela API (HTTPS), só com a chave service_role.
-- Ficam em public porque só public é exposto pela API; ninguém além do
-- service_role pode executá-las.
-- =====================================================================
create or replace function public.migracao_iniciar_carga(
  p_arquivo text, p_tabela text, p_colunas text[], p_hash text default null, p_linhas_esperadas integer default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  perform legacy_micrologos.criar_tabela_bruta(p_tabela, p_colunas);
  insert into legacy_micrologos.cargas (arquivo, tabela, hash_sha256, linhas_esperadas)
  values (p_arquivo, 'bruto_' || lower(p_tabela), p_hash, p_linhas_esperadas)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.migracao_carregar_lote(p_tabela text, p_carga_id bigint, p_linhas jsonb)
returns integer language sql security definer set search_path = '' as $$
  select legacy_micrologos.carregar_lote(p_tabela, p_carga_id, p_linhas)
$$;

create or replace function public.migracao_concluir_carga(p_carga_id bigint, p_status text default 'concluida', p_observacoes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r legacy_micrologos.cargas;
begin
  update legacy_micrologos.cargas
     set status = p_status, concluido_em = now(),
         observacoes = coalesce(p_observacoes, observacoes)
   where id = p_carga_id
  returning * into r;
  return to_jsonb(r);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.migracao_iniciar_carga(text, text, text[], text, integer)',
    'public.migracao_carregar_lote(text, bigint, jsonb)',
    'public.migracao_concluir_carga(bigint, text, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on all functions in schema legacy_micrologos from public, anon, authenticated;
grant execute on all functions in schema legacy_micrologos to service_role;
revoke all on all tables in schema legacy_micrologos from public, anon, authenticated;
grant all on all tables in schema legacy_micrologos to service_role;

-- =====================================================================
-- Depósito de arquivos da migração (Storage, privado, no Brasil).
-- Sem políticas = só service_role e o painel do Supabase acessam.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('migracao-micrologos', 'migracao-micrologos', false)
on conflict (id) do nothing;
