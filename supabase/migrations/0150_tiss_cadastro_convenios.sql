-- =====================================================================
-- 0150 — Cadastro TISS dos convênios (base para copiar os convênios do Micrologos)
-- Sessão "Dados para migração". Numeração 0150+ para não colidir com a
-- sessão de desenvolvimento (que segue 0101, 0102…).
-- =====================================================================
-- 1) convenios: regras TISS (o "manual" de cada operadora no Micrologos),
--    descontos do 2º ao 5º procedimento e código do convênio no Micrologos.
-- 2) convenio_planos: máscara da carteirinha e código no Micrologos.
-- 3) precos: código e tabela que vão na guia (podem diferir do procedimento),
--    "necessita autorização" e de qual tabela de preço do Micrologos veio.
-- 4) hospitais (as "Unidades" do Micrologos) + código de cada hospital em cada convênio
--    (vai no localContratado da guia de Honorários).
-- 5) profissional_convenio_codigos: código do médico em cada convênio/plano/hospital.
-- 6) interno.tg_item_preco passa a usar o código/tabela da guia do preço do convênio.
-- =====================================================================

-- ---------- 1) convenios ----------
alter table public.convenios
  add column if not exists micrologos_codigo integer unique,
  add column if not exists tiss jsonb not null default '{}'::jsonb,
  add column if not exists descontos jsonb not null default '{}'::jsonb;
comment on column public.convenios.tiss is
  'Regras TISS do convênio (copiadas do Micrologos). Chaves documentadas em docs/sistema/tiss-gerador.md.';
comment on column public.convenios.descontos is
  'Descontos do 2º ao 5º procedimento (cirurgia e exames), em %, como no Micrologos.';

-- ---------- 2) convenio_planos ----------
alter table public.convenio_planos
  add column if not exists micrologos_codigo integer unique,
  add column if not exists mascara_carteirinha text;

-- ---------- 3) precos ----------
alter table public.precos
  add column if not exists codigo_guia text,
  add column if not exists tabela_guia text check (tabela_guia in ('22','19','20','18','00','98')),
  add column if not exists necessita_autorizacao boolean not null default false,
  add column if not exists tabela_preco text;
comment on column public.precos.codigo_guia is 'Código que vai na guia TISS para este convênio (ex.: TUSS, pacote 699…, código próprio). Vazio = código do procedimento.';
comment on column public.precos.tabela_preco is 'Tabela de preço de origem no Micrologos (ex.: "31 Bradesco Cirurgia (26/02/2015)").';
create index if not exists precos_busca_idx on public.precos (procedimento_id, convenio_id, plano_id);

-- ---------- 4) hospitais ----------
create table if not exists public.hospitais (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null unique,
  cnpj              text check (cnpj ~ '^[0-9]{14}$'),
  cnes              text check (cnes ~ '^[0-9]{7}$'),
  propria_clinica   boolean not null default false,
  micrologos_codigo integer unique,
  ativo             boolean not null default true,
  observacoes       text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
comment on table public.hospitais is
  'Hospitais e centros cirúrgicos parceiros onde os médicos operam ("Unidades" do Micrologos). Vão no localContratado da guia de Honorários.';

create table if not exists public.hospital_convenio_codigos (
  id            uuid primary key default gen_random_uuid(),
  hospital_id   uuid not null references public.hospitais(id) on delete cascade,
  convenio_id   uuid not null references public.convenios(id) on delete cascade,
  codigo_operadora text not null,
  cnes          text check (cnes ~ '^[0-9]{7}$'),   -- só quando diferente do CNES do hospital
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (hospital_id, convenio_id)
);
create index if not exists hospital_convenio_codigos_convenio_idx on public.hospital_convenio_codigos (convenio_id);

-- ---------- 5) códigos dos profissionais nos convênios ----------
create table if not exists public.profissional_convenio_codigos (
  id                  uuid primary key default gen_random_uuid(),
  profissional_id     uuid not null references public.profissionais(id) on delete cascade,
  convenio_id         uuid not null references public.convenios(id) on delete cascade,
  plano_id            uuid references public.convenio_planos(id) on delete cascade,
  hospital_id         uuid references public.hospitais(id) on delete cascade,
  codigo_executante   text,
  codigo_solicitante  text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create unique index if not exists profissional_convenio_codigos_uk
  on public.profissional_convenio_codigos (profissional_id, convenio_id,
     coalesce(plano_id, '00000000-0000-0000-0000-000000000000'::uuid),
     coalesce(hospital_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists profissional_convenio_codigos_convenio_idx on public.profissional_convenio_codigos (convenio_id);
create index if not exists profissional_convenio_codigos_plano_idx on public.profissional_convenio_codigos (plano_id);
create index if not exists profissional_convenio_codigos_hospital_idx on public.profissional_convenio_codigos (hospital_id);

-- ---------- gatilhos (atualizado_em + auditoria) ----------
do $$
declare t text;
begin
  foreach t in array array['hospitais','hospital_convenio_codigos','profissional_convenio_codigos'] loop
    execute format('drop trigger if exists atualizado_em on public.%I', t);
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;

-- ---------- RLS: equipe lê; faturamento e admin alteram ----------
do $$
declare t text;
begin
  foreach t in array array['hospitais','hospital_convenio_codigos','profissional_convenio_codigos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy equipe_le on public.%I for select to authenticated
      using ((select interno.tem_funcao('medico','enfermagem','recepcao','admin','faturamento')))$p$, t);
    execute format($p$create policy faturamento_inclui on public.%I for insert to authenticated
      with check ((select interno.tem_funcao('faturamento','admin')))$p$, t);
    execute format($p$create policy faturamento_altera on public.%I for update to authenticated
      using ((select interno.tem_funcao('faturamento','admin')))
      with check ((select interno.tem_funcao('faturamento','admin')))$p$, t);
    execute format($p$create policy faturamento_apaga on public.%I for delete to authenticated
      using ((select interno.tem_funcao('faturamento','admin')))$p$, t);
  end loop;
end $$;

-- ---------- 6) preço e código da guia no item da conta ----------
-- Linha de preço que vale para o procedimento no convênio/plano/data.
create or replace function interno.preco_linha(p_proc uuid, p_convenio uuid, p_plano uuid, p_data date default current_date)
returns public.precos language sql stable security definer set search_path = '' as $$
  select p.* from public.precos p
  where p.procedimento_id = p_proc and p.ativo and p.vigente_de <= p_data
    and p.convenio_id is not distinct from p_convenio
    and (p.plano_id is null or p.plano_id = p_plano)
  order by (p.plano_id is not null) desc, p.vigente_de desc
  limit 1
$$;
revoke all on function interno.preco_linha(uuid, uuid, uuid, date) from public, anon;

create or replace function interno.tg_item_preco()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_c public.contas; v_p public.procedimentos; v_l public.precos;
begin
  select * into v_c from public.contas where id = new.conta_id;
  if new.procedimento_id is not null then
    select * into v_p from public.procedimentos where id = new.procedimento_id;
    v_l := interno.preco_linha(new.procedimento_id, v_c.convenio_id, v_c.plano_id, coalesce(new.data_execucao, current_date));
    -- Código e tabela da guia: o do preço do convênio (ex.: TUSS) vale sobre o do procedimento.
    new.codigo    := coalesce(new.codigo, v_l.codigo_guia, v_p.codigo);
    new.descricao := coalesce(new.descricao, v_p.descricao);
    new.tabela    := coalesce(v_l.tabela_guia, v_p.tabela, new.tabela);
    if new.valor_unitario is null then
      new.valor_unitario := v_l.valor;
    end if;
  end if;
  new.profissional_id := coalesce(new.profissional_id, v_c.profissional_id);
  return new;
end $$;
