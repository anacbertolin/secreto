-- =====================================================================
-- 0010 — Faturamento de convênios e particular (v1)
-- =====================================================================
-- Fluxo:  chegada/atendimento → CONTA do paciente (itens com preço da tabela)
--         → conferência (senha, carteirinha) → LOTE por convênio → envio (protocolo)
--         → pagamento → GLOSAS por item → recurso.
-- Particular: a conta é recebida na hora (forma de pagamento).
-- Contas são criadas sozinhas: na chegada do paciente (consulta) e quando um
-- exame é realizado (item de SP/SADT).
-- =====================================================================

-- ---------- Configurações de faturamento ----------
alter table public.convenios
  add column codigo_prestador   text,          -- código da clínica na operadora
  add column exige_senha        boolean not null default false,
  add column dias_retorno       int not null default 30 check (dias_retorno between 0 and 365),
  add column versao_tiss        text,
  add column observacoes_faturamento text;

alter table public.profissionais
  add column cbo text;                         -- ex.: 225265 (médico oftalmologista)

-- ---------- Procedimentos faturáveis e preços ----------
create table public.procedimentos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text,                          -- código TUSS (ou próprio)
  tabela        text not null default '22' check (tabela in ('22', '19', '20', '18', '00', '98')),
                                               -- 22 procedimentos, 19 materiais, 20 medicamentos, 18 taxas, 00 própria, 98 pacotes
  descricao     text not null,
  tipo          text not null default 'procedimento'
                check (tipo in ('consulta', 'exame', 'procedimento', 'cirurgia', 'taxa', 'material', 'medicamento')),
  padrao_consulta boolean not null default false, -- item lançado sozinho na chegada de uma consulta
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index procedimentos_codigo_unico on public.procedimentos (tabela, codigo) where codigo is not null;
create unique index procedimentos_um_padrao on public.procedimentos (padrao_consulta) where padrao_consulta;

alter table public.exames_catalogo add column procedimento_id uuid references public.procedimentos(id);
create index exames_catalogo_procedimento_idx on public.exames_catalogo (procedimento_id);

create table public.precos (
  id              uuid primary key default gen_random_uuid(),
  procedimento_id uuid not null references public.procedimentos(id),
  convenio_id     uuid references public.convenios(id),       -- vazio = particular
  plano_id        uuid references public.convenio_planos(id), -- vazio = todos os planos do convênio
  valor           numeric(12,2) not null check (valor >= 0),
  vigente_de      date not null default current_date,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create unique index precos_unico on public.precos
  (procedimento_id, coalesce(convenio_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(plano_id, '00000000-0000-0000-0000-000000000000'::uuid), vigente_de);
create index precos_convenio_idx on public.precos (convenio_id);
create index precos_plano_idx on public.precos (plano_id);

-- Preço vigente: plano > convênio > (só para particular) tabela particular
create or replace function interno.preco(p_proc uuid, p_convenio uuid, p_plano uuid, p_data date default current_date)
returns numeric language sql stable security definer set search_path = '' as $$
  select p.valor from public.precos p
  where p.procedimento_id = p_proc and p.ativo and p.vigente_de <= p_data
    and p.convenio_id is not distinct from p_convenio
    and (p.plano_id is null or p.plano_id = p_plano)
  order by (p.plano_id is not null) desc, p.vigente_de desc
  limit 1
$$;

-- ---------- Lotes ----------
create sequence public.lotes_numero_seq;
create type public.status_lote as enum ('aberto', 'enviado', 'pago', 'pago_parcial', 'cancelado');

create table public.lotes (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint not null unique default nextval('public.lotes_numero_seq'),
  convenio_id     uuid not null references public.convenios(id),
  competencia     date not null,               -- 1º dia do mês de referência
  status          public.status_lote not null default 'aberto',
  enviado_em      date,
  protocolo       text,
  previsao_pagamento date,
  pago_em         date,
  valor_pago      numeric(12,2),
  observacoes     text,
  criado_por      uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
alter sequence public.lotes_numero_seq owned by public.lotes.numero;
create index lotes_convenio_idx on public.lotes (convenio_id);
create index lotes_criado_por_idx on public.lotes (criado_por);

-- ---------- Contas do paciente (cada conta = uma guia) ----------
create sequence public.guia_prestador_seq;
create type public.status_conta as enum ('aberta', 'pronta', 'faturada', 'paga', 'glosada', 'cancelada');

create table public.contas (
  id                    uuid primary key default gen_random_uuid(),
  paciente_id           uuid not null references public.pacientes(id),
  agendamento_id        uuid references public.agendamentos(id),
  atendimento_id        uuid references public.atendimentos(id),
  data_atendimento      date not null default current_date,
  convenio_id           uuid references public.convenios(id),          -- vazio = particular
  plano_id              uuid references public.convenio_planos(id),
  tipo_guia             text not null default 'consulta' check (tipo_guia in ('consulta', 'sadt', 'particular')),
  numero_guia_prestador text not null unique default lpad(nextval('public.guia_prestador_seq')::text, 8, '0'),
  numero_guia_operadora text,
  senha_autorizacao     text,
  data_autorizacao      date,
  validade_senha        date,
  carteirinha           text,
  validade_carteirinha  date,
  profissional_id       uuid references public.profissionais(id),     -- executante
  solicitante_id        uuid references public.profissionais(id),     -- quem pediu (SADT)
  indicacao_clinica     text,
  cid10                 text,
  status                public.status_conta not null default 'aberta',
  lote_id               uuid references public.lotes(id),
  valor_total           numeric(12,2) not null default 0,
  valor_glosado         numeric(12,2) not null default 0,
  valor_pago            numeric(12,2),
  forma_pagamento       text check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cortesia')),
  parcelas              int check (parcelas between 1 and 24),
  recebido_em           timestamptz,
  motivo_cancelamento   text,
  observacoes           text,
  criado_por            uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
alter sequence public.guia_prestador_seq owned by public.contas.numero_guia_prestador;
create index contas_paciente_idx on public.contas (paciente_id, data_atendimento desc);
create index contas_agendamento_idx on public.contas (agendamento_id);
create index contas_atendimento_idx on public.contas (atendimento_id);
create index contas_convenio_status_idx on public.contas (convenio_id, status);
create index contas_plano_idx on public.contas (plano_id);
create index contas_lote_idx on public.contas (lote_id);
create index contas_profissional_idx on public.contas (profissional_id);
create index contas_solicitante_idx on public.contas (solicitante_id);
create index contas_criado_por_idx on public.contas (criado_por);
create index contas_data_idx on public.contas (data_atendimento);

create table public.conta_itens (
  id                 uuid primary key default gen_random_uuid(),
  conta_id           uuid not null references public.contas(id),
  procedimento_id    uuid references public.procedimentos(id),
  exame_realizado_id uuid unique references public.exames_realizados(id),
  tabela             text not null default '22',
  codigo             text,
  descricao          text not null,
  data_execucao      date not null default current_date,
  quantidade         numeric(10,2) not null default 1 check (quantidade > 0),
  valor_unitario     numeric(12,2) check (valor_unitario >= 0),
  valor_total        numeric(12,2) generated always as (round(quantidade * coalesce(valor_unitario, 0), 2)) stored,
  olho               public.olho,
  profissional_id    uuid references public.profissionais(id),
  glosa_valor        numeric(12,2) not null default 0 check (glosa_valor >= 0),
  glosa_codigo       text,
  glosa_motivo       text,
  recurso_texto      text,
  recurso_enviado_em date,
  recurso_valor_recuperado numeric(12,2) check (recurso_valor_recuperado >= 0),
  criado_por         uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index conta_itens_conta_idx on public.conta_itens (conta_id);
create index conta_itens_procedimento_idx on public.conta_itens (procedimento_id);
create index conta_itens_profissional_idx on public.conta_itens (profissional_id);
create index conta_itens_criado_por_idx on public.conta_itens (criado_por);

-- ---------- Regras automáticas ----------
-- Item: completa código, descrição e preço a partir do procedimento e da tabela de preços
create or replace function interno.tg_item_preco()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_c public.contas; v_p public.procedimentos;
begin
  select * into v_c from public.contas where id = new.conta_id;
  if new.procedimento_id is not null then
    select * into v_p from public.procedimentos where id = new.procedimento_id;
    new.codigo    := coalesce(new.codigo, v_p.codigo);
    new.descricao := coalesce(new.descricao, v_p.descricao);
    new.tabela    := coalesce(v_p.tabela, new.tabela);
    if new.valor_unitario is null then
      new.valor_unitario := interno.preco(new.procedimento_id, v_c.convenio_id, v_c.plano_id, new.data_execucao);
    end if;
  end if;
  new.profissional_id := coalesce(new.profissional_id, v_c.profissional_id);
  return new;
end $$;
create trigger preco before insert on public.conta_itens
  for each row execute function interno.tg_item_preco();

-- Trava: conta faturada/paga/cancelada só aceita mudança de glosa e recurso
create or replace function interno.tg_item_trava()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status public.status_conta;
  v_glosa  text[] := array['glosa_valor', 'glosa_codigo', 'glosa_motivo', 'recurso_texto',
                           'recurso_enviado_em', 'recurso_valor_recuperado', 'atualizado_em',
                           'valor_total'];  -- calculado pelo banco (ainda vazio neste momento)
begin
  select status into v_status from public.contas
  where id = case when tg_op = 'DELETE' then old.conta_id else new.conta_id end;
  if v_status in ('faturada', 'paga', 'glosada', 'cancelada') then
    if tg_op = 'UPDATE' and v_status <> 'cancelada'
       and (to_jsonb(new) - v_glosa) = (to_jsonb(old) - v_glosa) then
      return new;
    end if;
    raise exception 'Esta conta já foi faturada, paga ou cancelada: os itens não podem mudar (só glosa e recurso).';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger trava before insert or update or delete on public.conta_itens
  for each row execute function interno.tg_item_trava();

-- Totais da conta
create or replace function interno.tg_conta_totais()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_conta uuid := case when tg_op = 'DELETE' then old.conta_id else new.conta_id end;
begin
  update public.contas c set
    valor_total   = coalesce((select sum(i.valor_total) from public.conta_itens i where i.conta_id = v_conta), 0),
    valor_glosado = coalesce((select sum(i.glosa_valor - coalesce(i.recurso_valor_recuperado, 0))
                              from public.conta_itens i where i.conta_id = v_conta), 0)
  where c.id = v_conta;
  return null;
end $$;
create trigger totais after insert or update or delete on public.conta_itens
  for each row execute function interno.tg_conta_totais();

-- Conta: regras de situação
create or replace function interno.tg_conta_regras()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.convenio_id is null then
    new.tipo_guia := 'particular';
  elsif new.tipo_guia = 'particular' then
    new.tipo_guia := 'consulta';
  end if;
  if tg_op = 'UPDATE' and old.status = 'cancelada' and new.status <> 'cancelada' then
    raise exception 'Conta cancelada não pode ser reaberta. Crie uma conta nova.';
  end if;
  if new.status = 'cancelada' and coalesce(trim(new.motivo_cancelamento), '') = '' then
    raise exception 'Informe o motivo do cancelamento da conta.';
  end if;
  if new.status = 'paga' and new.convenio_id is null and new.recebido_em is null then
    new.recebido_em := now();
  end if;
  return new;
end $$;
create trigger regras before insert or update on public.contas
  for each row execute function interno.tg_conta_regras();

-- Na chegada (ou atendimento) do paciente: abre a conta; consulta ganha o item padrão
create or replace function interno.tg_agendamento_conta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pac   public.pacientes;
  v_conta uuid;
  v_proc  uuid;
begin
  if coalesce(current_setting('app.migracao', true), '') = 'on' then
    return null;
  end if;

  -- Falta ou cancelamento: cancela conta ainda aberta e vazia desse agendamento
  if new.status in ('faltou', 'cancelado') and old.status is distinct from new.status then
    update public.contas set status = 'cancelada', motivo_cancelamento = 'Agendamento ' || new.status::text
    where agendamento_id = new.id and status = 'aberta';
    return null;
  end if;

  if new.status not in ('chegou', 'em_atendimento', 'atendido') or new.tipo = 'retorno' then
    return null;
  end if;
  if exists (select 1 from public.contas where agendamento_id = new.id and status <> 'cancelada') then
    return null;
  end if;

  select * into v_pac from public.pacientes where id = new.paciente_id;
  insert into public.contas (paciente_id, agendamento_id, data_atendimento, convenio_id, plano_id, tipo_guia,
                             carteirinha, validade_carteirinha, profissional_id, criado_por)
  values (new.paciente_id, new.id, (new.inicio at time zone 'America/Sao_Paulo')::date, new.convenio_id,
          coalesce(new.plano_id, case when new.convenio_id = v_pac.convenio_id then v_pac.plano_id end),
          case when new.tipo = 'consulta' then 'consulta' else 'sadt' end,
          case when new.convenio_id = v_pac.convenio_id then v_pac.convenio_carteirinha end,
          case when new.convenio_id = v_pac.convenio_id then v_pac.convenio_validade end,
          new.profissional_id, interno.profissional_atual())
  returning id into v_conta;

  if new.tipo = 'consulta' then
    select id into v_proc from public.procedimentos where padrao_consulta and ativo;
    if v_proc is not null then
      insert into public.conta_itens (conta_id, procedimento_id, data_execucao)
      values (v_conta, v_proc, (new.inicio at time zone 'America/Sao_Paulo')::date);
    end if;
  end if;
  return null;
end $$;
create trigger conta_automatica after update on public.agendamentos
  for each row execute function interno.tg_agendamento_conta();

-- Exame realizado: entra como item numa conta de SP/SADT (ou particular) aberta
create or replace function interno.tg_exame_conta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pac   public.pacientes;
  v_ag    public.agendamentos;
  v_cat   public.exames_catalogo;
  v_sol   public.solicitacoes_exames;
  v_solic uuid;
  v_conv  uuid;
  v_plano uuid;
  v_tipo  text;
  v_conta uuid;
begin
  if coalesce(current_setting('app.migracao', true), '') = 'on' then
    return null;
  end if;
  if new.status not in ('aguardando_laudo', 'laudado')
     or (tg_op = 'UPDATE' and old.status in ('aguardando_laudo', 'laudado'))
     or exists (select 1 from public.conta_itens where exame_realizado_id = new.id) then
    return null;
  end if;

  select * into v_pac from public.pacientes where id = new.paciente_id;
  select * into v_ag  from public.agendamentos where id = new.agendamento_id;
  select * into v_cat from public.exames_catalogo where id = new.exame_catalogo_id;
  if new.solicitacao_id is not null then
    select * into v_sol from public.solicitacoes_exames where id = new.solicitacao_id;
    select a.profissional_id into v_solic from public.atendimentos a where a.id = v_sol.atendimento_id;
  end if;

  v_conv  := coalesce(v_ag.convenio_id, v_pac.convenio_id);
  v_plano := case when v_conv = v_pac.convenio_id then coalesce(v_ag.plano_id, v_pac.plano_id) else v_ag.plano_id end;
  v_tipo  := case when v_conv is null then 'particular' else 'sadt' end;

  -- conta aberta do mesmo paciente, mesmo dia, mesmo convênio e tipo SP/SADT/particular
  select c.id into v_conta from public.contas c
  where c.paciente_id = new.paciente_id and c.status = 'aberta' and c.tipo_guia = v_tipo
    and c.convenio_id is not distinct from v_conv
    and c.data_atendimento = (now() at time zone 'America/Sao_Paulo')::date
  order by (c.agendamento_id is not distinct from new.agendamento_id) desc, c.criado_em desc
  limit 1;

  if v_conta is null then
    insert into public.contas (paciente_id, agendamento_id, convenio_id, plano_id, tipo_guia, carteirinha,
                               validade_carteirinha, profissional_id, solicitante_id, indicacao_clinica, criado_por)
    values (new.paciente_id,
            case when not exists (select 1 from public.contas x where x.agendamento_id = new.agendamento_id
                                  and x.status <> 'cancelada') then new.agendamento_id end,
            v_conv, v_plano, v_tipo,
            case when v_conv = v_pac.convenio_id then v_pac.convenio_carteirinha end,
            case when v_conv = v_pac.convenio_id then v_pac.convenio_validade end,
            coalesce(v_ag.profissional_id, v_solic), v_solic, v_sol.justificativa, interno.profissional_atual())
    returning id into v_conta;
  else
    update public.contas set
      solicitante_id = coalesce(solicitante_id, v_solic),
      indicacao_clinica = coalesce(indicacao_clinica, v_sol.justificativa)
    where id = v_conta;
  end if;

  insert into public.conta_itens (conta_id, procedimento_id, exame_realizado_id, codigo, descricao, olho, profissional_id)
  values (v_conta, v_cat.procedimento_id, new.id, v_cat.codigo_tuss, new.exame, new.olho, new.executado_por);
  return null;
end $$;
create trigger conta_exame after insert or update on public.exames_realizados
  for each row execute function interno.tg_exame_conta();

-- ---------- Gatilhos: atualizado_em e auditoria ----------
do $$
declare t text;
begin
  foreach t in array array['procedimentos', 'precos', 'lotes', 'contas', 'conta_itens'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================
alter table public.procedimentos enable row level security;
alter table public.precos        enable row level security;
alter table public.lotes         enable row level security;
alter table public.contas        enable row level security;
alter table public.conta_itens   enable row level security;

-- Procedimentos: toda a equipe lê; faturamento e admin mantêm
create policy equipe_le on public.procedimentos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
create policy faturamento_inclui on public.procedimentos for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy faturamento_altera on public.procedimentos for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

-- Preços e lotes: faturamento e admin; recepção lê preços (orçamento particular)
create policy le on public.precos for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));
create policy faturamento_inclui on public.precos for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy faturamento_altera on public.precos for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

create policy le on public.lotes for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy faturamento_inclui on public.lotes for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy faturamento_altera on public.lotes for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

-- Contas e itens: faturamento, admin e recepção (a recepção preenche senha/carteirinha e recebe particular)
create policy le on public.contas for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));
create policy inclui on public.contas for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));
create policy altera on public.contas for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')))
  with check ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));

create policy le on public.conta_itens for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));
create policy inclui on public.conta_itens for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));
create policy altera on public.conta_itens for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')))
  with check ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));
create policy remove on public.conta_itens for delete to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin', 'recepcao')));

-- Faturamento enxerga cadastro, agenda e tabelas (NÃO o prontuário)
create policy faturamento_le on public.pacientes for select to authenticated
  using ((select interno.tem_funcao('faturamento')));
create policy faturamento_altera on public.pacientes for update to authenticated
  using ((select interno.tem_funcao('faturamento'))) with check ((select interno.tem_funcao('faturamento')));
do $$
declare t text;
begin
  foreach t in array array['agendamentos', 'convenios', 'convenio_planos', 'profissionais', 'exames_catalogo', 'locais'] loop
    execute format($p$create policy faturamento_le on public.%I for select to authenticated
      using ((select interno.tem_funcao('faturamento')))$p$, t);
  end loop;
end $$;
create policy faturamento_altera on public.convenios for update to authenticated
  using ((select interno.tem_funcao('faturamento'))) with check ((select interno.tem_funcao('faturamento')));
create policy faturamento_inclui on public.convenio_planos for insert to authenticated
  with check ((select interno.tem_funcao('faturamento')));
create policy faturamento_altera on public.convenio_planos for update to authenticated
  using ((select interno.tem_funcao('faturamento'))) with check ((select interno.tem_funcao('faturamento')));
create policy faturamento_altera on public.exames_catalogo for update to authenticated
  using ((select interno.tem_funcao('faturamento'))) with check ((select interno.tem_funcao('faturamento')));
create policy faturamento_registra_leitura on public.log_auditoria for insert to authenticated
  with check (acao = 'LEITURA' and email = (select interno.email_atual()) and (select interno.tem_funcao('faturamento')));

-- =====================================================================
-- Dados iniciais
-- =====================================================================
insert into public.procedimentos (codigo, tabela, descricao, tipo, padrao_consulta)
values ('10101012', '22', 'Consulta em consultório (no horário normal ou preestabelecido)', 'consulta', true)
on conflict do nothing;
