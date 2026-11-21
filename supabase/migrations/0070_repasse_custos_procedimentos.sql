-- =====================================================================
-- 0070 — Repasse: custos da cirurgia (sala, instrumentação, auxiliar, insumos)
--        e tabela de procedimentos com custos padrão
-- =====================================================================
-- REGRA GERAL (decisão da dona, 21/11/2026 — vale para TODOS os médicos e cirurgias):
--   valor bruto − imposto (15% do bruto) − taxa do cartão (% do bruto, centavos cortados)
--   − custos da cirurgia (sala, instrumentação, auxiliar, insumos…) = HONORÁRIOS
--   honorários → 20% clínica (arredondado) e o restante (80%) para o médico.
-- • Taxa de sala: fica para a própria clínica, mas entra como CUSTO (antes da divisão).
-- • Auxiliar (ex.: Dr. Matheus) e instrumentação: o Luciano transfere para eles
--   (custos "a pagar", com data de pagamento).
-- • Refrativa = caso sem custos (a sala é paga fora).
-- Exemplos (PDFs da Dra. Gisele, refeitos pela regra geral):
--   Blefaroplastia 12x 6.500: imp 975,00, cartão 631,80, custos 1.900 → honorários 2.993,20
--     → clínica 598,64, médica 2.394,56.
--   Entrópio 10x 8.500: imp 1.275, cartão 732,70, custos 1.700 → 4.792,30 → 958,46 / 3.833,84.
--   Ectrópio 12x 8.500: imp 1.275, cartão 826,20, custos 1.700 → 4.698,80 → 939,76 / 3.759,04.
--   Sondagem 3x 1.100: imp 165, cartão 49,50, custos 150 → 735,50 → 147,10 / 588,40.
--   Calázio débito 1.750 (2,34%): imp 262,50, cartão 40,95, custos 300 → 1.146,55 → 229,31 / 917,24.
-- O lançamento passa a ser feito pela função repasse_lancar (repasse + custos juntos).
-- =====================================================================

-- ---------- Procedimentos (custos padrão, editáveis) ----------
create table public.repasse_procedimentos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (trim(nome) <> ''),
  profissional_id  uuid references public.profissionais(id),     -- vazio = vale para qualquer médico
  valor_sugerido   numeric(12,2) check (valor_sugerido > 0),
  observacoes      text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create unique index repasse_procedimentos_unico on public.repasse_procedimentos
  (lower(nome), coalesce(profissional_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index repasse_procedimentos_profissional_idx on public.repasse_procedimentos (profissional_id);

create table public.repasse_procedimento_custos (
  id                          uuid primary key default gen_random_uuid(),
  procedimento_id             uuid not null references public.repasse_procedimentos(id) on delete cascade,
  tipo                        text not null check (tipo in ('sala', 'instrumentacao', 'auxiliar', 'insumo', 'outro')),
  descricao                   text not null check (trim(descricao) <> ''),
  valor                       numeric(12,2) not null check (valor >= 0),
  favorecido_profissional_id  uuid references public.profissionais(id),  -- quem recebe (ex.: auxiliar)
  favorecido_nome             text,                                      -- quem recebe, se não for da equipe
  ordem                       int not null default 0,
  atualizado_em               timestamptz not null default now()
);
create index repasse_procedimento_custos_proc_idx on public.repasse_procedimento_custos (procedimento_id);
create index repasse_procedimento_custos_fav_idx on public.repasse_procedimento_custos (favorecido_profissional_id);

-- ---------- Custos de cada repasse (cópia no lançamento) ----------
create table public.repasse_custos (
  id                          uuid primary key default gen_random_uuid(),
  repasse_id                  uuid not null references public.repasses(id),
  tipo                        text not null check (tipo in ('sala', 'instrumentacao', 'auxiliar', 'insumo', 'outro')),
  descricao                   text not null check (trim(descricao) <> ''),
  valor                       numeric(12,2) not null check (valor >= 0),
  favorecido_profissional_id  uuid references public.profissionais(id),
  favorecido_nome             text,
  pago_em                     date,          -- quando o Luciano transferiu (só para quem tem favorecido)
  observacoes                 text,
  ordem                       int not null default 0,
  atualizado_em               timestamptz not null default now()
);
create index repasse_custos_repasse_idx on public.repasse_custos (repasse_id);
create index repasse_custos_fav_idx on public.repasse_custos (favorecido_profissional_id);
create index repasse_custos_pago_idx on public.repasse_custos (pago_em);

alter table public.repasses
  add column procedimento_id uuid references public.repasse_procedimentos(id),
  add column custos_total    numeric(12,2) not null default 0;
create index repasses_procedimento_idx on public.repasses (procedimento_id);
alter table public.repasse_parcelas add column custos numeric(12,2) not null default 0;

-- =====================================================================
-- Lançamento: repasse + custos numa única operação
-- =====================================================================
create or replace function public.repasse_lancar(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_custo jsonb; v_total numeric := 0; v_tipo text; v_valor numeric; v_ordem int := 0;
begin
  if not interno.tem_funcao('faturamento', 'admin') then
    raise exception 'Você não tem permissão para lançar repasses.';
  end if;
  for v_custo in select * from jsonb_array_elements(coalesce(p -> 'custos', '[]'::jsonb)) loop
    v_tipo := v_custo ->> 'tipo';
    v_valor := (v_custo ->> 'valor')::numeric;
    if v_tipo is null or v_tipo not in ('sala', 'instrumentacao', 'auxiliar', 'insumo', 'outro') then
      raise exception 'Tipo de custo inválido.';
    end if;
    if v_valor is null or v_valor < 0 then
      raise exception 'Valor de custo inválido.';
    end if;
    if coalesce(trim(v_custo ->> 'descricao'), '') = '' then
      raise exception 'Descreva cada custo.';
    end if;
    v_total := v_total + round(v_valor, 2);
  end loop;

  perform set_config('app.repasse_custos', v_total::text, true);
  insert into public.repasses (conta_id, paciente_id, profissional_id, procedimento_id, procedimento, data_cirurgia,
                               data_pagamento, valor_total, forma_pagamento, parcelas, observacoes)
  values (nullif(p ->> 'conta_id', '')::uuid, nullif(p ->> 'paciente_id', '')::uuid, (p ->> 'profissional_id')::uuid,
          nullif(p ->> 'procedimento_id', '')::uuid, p ->> 'procedimento', (p ->> 'data_cirurgia')::date,
          coalesce((p ->> 'data_pagamento')::date, current_date), (p ->> 'valor_total')::numeric,
          p ->> 'forma_pagamento', coalesce((p ->> 'parcelas')::int, 1), nullif(trim(p ->> 'observacoes'), ''))
  returning id into v_id;
  perform set_config('app.repasse_custos', '', true);

  for v_custo in select * from jsonb_array_elements(coalesce(p -> 'custos', '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_tipo := v_custo ->> 'tipo';
    insert into public.repasse_custos (repasse_id, tipo, descricao, valor, favorecido_profissional_id, favorecido_nome, ordem)
    values (v_id, v_tipo, trim(v_custo ->> 'descricao'), round((v_custo ->> 'valor')::numeric, 2),
            -- sala e insumo ficam para a clínica: sem favorecido
            case when v_tipo in ('sala', 'insumo') then null else nullif(v_custo ->> 'favorecido_profissional_id', '')::uuid end,
            case when v_tipo in ('sala', 'insumo') then null else nullif(trim(v_custo ->> 'favorecido_nome'), '') end,
            v_ordem);
  end loop;
  return v_id;
end $$;
revoke execute on function public.repasse_lancar(jsonb) from public, anon;
grant execute on function public.repasse_lancar(jsonb) to authenticated;

-- Lançamento direto na tabela deixa de ser permitido (só pela função, que leva os custos junto)
drop policy inclui on public.repasses;

-- ---------- Cálculo do repasse (regra geral) ----------
create or replace function interno.tg_repasse_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cfg public.repasse_config; v_conta public.contas; v_bruto numeric; v_honorarios numeric;
begin
  if tg_op = 'INSERT' then
    if new.forma_pagamento <> 'credito' then
      new.parcelas := 1;
    end if;
    if new.conta_id is not null then
      select * into v_conta from public.contas where id = new.conta_id;
      if v_conta.convenio_id is not null then
        raise exception 'O repasse v1 é só para cirurgia particular. Esta conta é de convênio.';
      end if;
      if v_conta.status = 'cancelada' then
        raise exception 'Esta conta foi cancelada.';
      end if;
      new.paciente_id := coalesce(new.paciente_id, v_conta.paciente_id);
    end if;
    if not exists (select 1 from public.profissionais where id = new.profissional_id and funcao = 'medico') then
      raise exception 'Escolha o médico que recebe o repasse.';
    end if;

    select * into v_cfg from public.repasse_config limit 1;
    new.imposto_pct          := v_cfg.imposto_pct;
    new.centro_cirurgico_pct := v_cfg.centro_cirurgico_pct;
    new.taxa_arredondamento  := v_cfg.taxa_arredondamento;
    if new.forma_pagamento in ('credito', 'debito') then
      new.taxa_interna_pct := null;
      select t.taxa_total into new.taxa_interna_pct from public.repasse_taxas_cartao t
      where t.forma = new.forma_pagamento and t.parcelas = new.parcelas;
      if new.taxa_interna_pct is null then
        raise exception 'Não há taxa cadastrada para % em %x. Cadastre na tabela de taxas do repasse.',
          case new.forma_pagamento when 'debito' then 'débito' else 'crédito' end, new.parcelas;
      end if;
    else
      new.taxa_interna_pct := 0;
    end if;

    -- custos: só a função repasse_lancar informa (lançamento direto não é permitido)
    new.custos_total := coalesce(nullif(current_setting('app.repasse_custos', true), '')::numeric, 0);
    new.imposto_total := round(new.valor_total * new.imposto_pct / 100, 2);
    v_bruto := new.valor_total * new.taxa_interna_pct / 100;
    new.taxa_interna_total := case when new.taxa_arredondamento = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
    v_honorarios := new.valor_total - new.imposto_total - new.taxa_interna_total - new.custos_total;
    if v_honorarios < 0 then
      raise exception 'Imposto, taxa do cartão e custos (R$ %) passam do valor da cirurgia (R$ %). Confira os valores.',
        new.imposto_total + new.taxa_interna_total + new.custos_total, new.valor_total;
    end if;
    new.centro_cirurgico_total := round(v_honorarios * new.centro_cirurgico_pct / 100, 2);
    new.medico_total := v_honorarios - new.centro_cirurgico_total;
    new.status := 'aberto';
    new.motivo_cancelamento := null;
    return new;
  end if;

  if (new.valor_total, new.forma_pagamento, new.parcelas, new.imposto_pct, new.centro_cirurgico_pct,
      new.taxa_interna_pct, new.taxa_arredondamento, new.imposto_total, new.centro_cirurgico_total,
      new.taxa_interna_total, new.medico_total, new.custos_total, new.procedimento_id,
      new.profissional_id, new.data_pagamento, new.conta_id, new.criado_por, new.criado_em, new.numero)
     is distinct from
     (old.valor_total, old.forma_pagamento, old.parcelas, old.imposto_pct, old.centro_cirurgico_pct,
      old.taxa_interna_pct, old.taxa_arredondamento, old.imposto_total, old.centro_cirurgico_total,
      old.taxa_interna_total, old.medico_total, old.custos_total, old.procedimento_id,
      old.profissional_id, old.data_pagamento, old.conta_id, old.criado_por, old.criado_em, old.numero) then
    raise exception 'Valor, forma de pagamento, parcelas, custos e médico não mudam depois de lançados. Cancele este repasse e lance de novo.';
  end if;
  if old.status = 'cancelado' and (new.status <> 'cancelado' or new.motivo_cancelamento is distinct from old.motivo_cancelamento) then
    raise exception 'Repasse cancelado não pode ser reaberto. Lance um novo.';
  end if;
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    if coalesce(trim(new.motivo_cancelamento), '') = '' then
      raise exception 'Informe o motivo do cancelamento.';
    end if;
    if exists (select 1 from public.repasse_parcelas where repasse_id = new.id and pago_medico_em is not null) then
      raise exception 'Já há parcela paga ao médico neste repasse. Desmarque o pagamento antes de cancelar.';
    end if;
    if exists (select 1 from public.repasse_custos where repasse_id = new.id and pago_em is not null) then
      raise exception 'Já há custo pago (auxiliar/instrumentação) neste repasse. Desmarque o pagamento antes de cancelar.';
    end if;
  end if;
  return new;
end $$;

-- ---------- Parcelas: cada parte dividida igualmente (sobra na última), agora com custos ----------
create or replace function interno.tg_repasse_parcelas_criar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  i int;
  n int := new.parcelas;
  v_imp numeric(12,2) := trunc(new.imposto_total / n, 2);
  v_tx  numeric(12,2) := trunc(new.taxa_interna_total / n, 2);
  v_cu  numeric(12,2) := trunc(new.custos_total / n, 2);
  v_cc  numeric(12,2) := trunc(new.centro_cirurgico_total / n, 2);
  v_med numeric(12,2) := trunc(new.medico_total / n, 2);
  a numeric(12,2); b numeric(12,2); k numeric(12,2); c numeric(12,2); d numeric(12,2);
  v_vista boolean := new.forma_pagamento in ('dinheiro', 'pix');
begin
  for i in 1..n loop
    a := case when i = n then new.imposto_total          - v_imp * (n - 1) else v_imp end;
    b := case when i = n then new.taxa_interna_total     - v_tx  * (n - 1) else v_tx  end;
    k := case when i = n then new.custos_total           - v_cu  * (n - 1) else v_cu  end;
    c := case when i = n then new.centro_cirurgico_total - v_cc  * (n - 1) else v_cc  end;
    d := case when i = n then new.medico_total           - v_med * (n - 1) else v_med end;
    insert into public.repasse_parcelas (repasse_id, numero, data_prevista, valor, imposto, taxa_interna, custos,
                                         centro_cirurgico, medico, valor_recebido, recebido_em)
    values (new.id, i,
            case when new.forma_pagamento = 'credito' then (new.data_pagamento + make_interval(months => i))::date
                 else new.data_pagamento end,
            a + b + k + c + d, a, b, k, c, d,
            case when v_vista then new.valor_total end,
            case when v_vista then new.data_pagamento end);
  end loop;
  return null;
end $$;

create or replace function interno.tg_repasse_parcela_calculo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;
  select status into v_status from public.repasses where id = old.repasse_id;
  if v_status = 'cancelado' then
    raise exception 'Este repasse foi cancelado: as parcelas não mudam.';
  end if;
  new.repasse_id := old.repasse_id; new.numero := old.numero; new.valor := old.valor;
  new.imposto := old.imposto; new.taxa_interna := old.taxa_interna; new.custos := old.custos;
  new.centro_cirurgico := old.centro_cirurgico; new.medico := old.medico;
  if new.pago_medico_em is not null and new.recebido_em is null then
    raise exception 'Marque que a parcela % entrou antes de marcar o pagamento ao médico.', new.numero;
  end if;
  return new;
end $$;

-- ---------- Custo do repasse: só muda "pago em" e observação ----------
create or replace function interno.tg_repasse_custo_trava()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  select status into v_status from public.repasses where id = old.repasse_id;
  if v_status = 'cancelado' then
    raise exception 'Este repasse foi cancelado: os custos não mudam.';
  end if;
  new.repasse_id := old.repasse_id; new.tipo := old.tipo; new.descricao := old.descricao; new.valor := old.valor;
  new.favorecido_profissional_id := old.favorecido_profissional_id; new.favorecido_nome := old.favorecido_nome;
  new.ordem := old.ordem;
  if new.pago_em is not null and old.favorecido_profissional_id is null and old.favorecido_nome is null then
    raise exception 'Este custo fica para a clínica: não há pagamento a marcar.';
  end if;
  return new;
end $$;
create trigger trava before update on public.repasse_custos
  for each row execute function interno.tg_repasse_custo_trava();

-- ---------- Gatilhos: atualizado_em e auditoria ----------
do $$
declare t text;
begin
  foreach t in array array['repasse_procedimentos', 'repasse_procedimento_custos', 'repasse_custos'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;

-- ---------- Segurança: só faturamento e admin ----------
alter table public.repasse_procedimentos        enable row level security;
alter table public.repasse_procedimento_custos  enable row level security;
alter table public.repasse_custos               enable row level security;

create policy le on public.repasse_procedimentos for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy inclui on public.repasse_procedimentos for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.repasse_procedimentos for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

create policy le on public.repasse_procedimento_custos for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy inclui on public.repasse_procedimento_custos for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.repasse_procedimento_custos for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy remove on public.repasse_procedimento_custos for delete to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));

create policy le on public.repasse_custos for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.repasse_custos for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

-- ---------- Procedimentos iniciais (PDFs da Dra. Gisele, 21/11/2026) ----------
insert into public.repasse_procedimentos (nome, profissional_id, valor_sugerido, observacoes) values
  ('Refrativa', null, null, 'Feita fora da clínica: sem custos (a sala o paciente paga ao centro cirúrgico).');
insert into public.repasse_procedimentos (nome, profissional_id, valor_sugerido)
select x.nome, (select id from public.profissionais where nome ilike 'Gisele%' and funcao = 'medico' limit 1), x.valor
from (values ('Sondagem', 1100.00), ('Calázio', 1750.00), ('Entrópio (1 olho)', 8500.00),
             ('Ectrópio (1 olho)', 8500.00), ('Blefaroplastia', 6500.00)) x(nome, valor);

insert into public.repasse_procedimento_custos (procedimento_id, tipo, descricao, valor, favorecido_profissional_id, favorecido_nome, ordem)
select p.id, c.tipo, c.descricao, c.valor,
       case when c.tipo = 'auxiliar' then (select id from public.profissionais where nome ilike 'Matheus%' and funcao = 'medico' limit 1) end,
       case when c.tipo = 'instrumentacao' then 'Instrumentação' end,
       c.ordem
from public.repasse_procedimentos p
join (values
  ('Sondagem',          'sala',           'Taxa de sala',          100.00, 1), ('Sondagem',          'instrumentacao', 'Instrumentação',  50.00, 2),
  ('Calázio',           'sala',           'Taxa de sala',          200.00, 1), ('Calázio',           'instrumentacao', 'Instrumentação', 100.00, 2),
  ('Entrópio (1 olho)', 'auxiliar',       'Auxiliar',             1000.00, 1), ('Entrópio (1 olho)', 'sala',           'Taxa de sala',   500.00, 2),
  ('Entrópio (1 olho)', 'instrumentacao', 'Instrumentação',        200.00, 3),
  ('Ectrópio (1 olho)', 'auxiliar',       'Auxiliar',             1000.00, 1), ('Ectrópio (1 olho)', 'sala',           'Taxa de sala',   500.00, 2),
  ('Ectrópio (1 olho)', 'instrumentacao', 'Instrumentação',        200.00, 3),
  ('Blefaroplastia',    'auxiliar',       'Auxiliar',             1000.00, 1), ('Blefaroplastia',    'sala',           'Taxa de sala',   700.00, 2),
  ('Blefaroplastia',    'instrumentacao', 'Instrumentação',        200.00, 3)
) c(proc, tipo, descricao, valor, ordem) on c.proc = p.nome;
