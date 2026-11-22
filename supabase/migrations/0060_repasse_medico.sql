-- =====================================================================
-- 0060 — Repasse médico v1 (cirurgia particular)
-- =====================================================================
-- Regras levantadas com a dona em 16/11/2026 (área do Luciano, administrador):
--   1. Imposto          = imposto_pct (15%) do VALOR TOTAL da cirurgia.
--   2. Centro cirúrgico = centro_cirurgico_pct (20%) do que sobra (total − imposto).
--   3. Taxa interna     = só no crédito parcelado (2x ou mais): % da tabela de taxas
--                         (cartão + antecipação) sobre o valor que ENTROU na parcela,
--                         com os centavos CORTADOS (não arredondados).
--                         Dinheiro, PIX, débito e crédito 1x: zero.
--   4. Médico           = o que realmente entrou − imposto − centro cirúrgico − taxa interna.
--      (no débito e no crédito a taxa da maquininha fica com o médico — decisão da dona)
--   Imposto e centro cirúrgico são divididos igualmente entre as parcelas; a sobra de
--   centavos fica na última parcela. O médico recebe conforme cada parcela entra.
--   Exemplo oficial (teste): R$ 5.220,00 em 12x; parcelas 2–12 entraram 423,74 → taxa 41,18
--   (41,1875 cortado) → médica 243,36 (igual ao cálculo à mão do Luciano). Parcela 1 entrou
--   423,66 → taxa 41,17 (41,1797 cortado) → médica 243,29 (a confirmar com o Luciano: a aba
--   DÚVIDAS esperava 243,28, que só sai com a taxa arredondada, e aí as outras dariam 243,35).
-- As porcentagens ficam em tabelas que o faturamento/admin altera na tela. Cada repasse
-- guarda uma cópia das porcentagens usadas, para que uma mudança futura não altere
-- cálculos já feitos.
-- =====================================================================

-- ---------- Configuração (linha única) ----------
create table public.repasse_config (
  id                    uuid primary key default gen_random_uuid(),
  unica                 boolean not null default true unique check (unica),
  imposto_pct           numeric(5,2) not null default 15 check (imposto_pct between 0 and 100),
  centro_cirurgico_pct  numeric(5,2) not null default 20 check (centro_cirurgico_pct between 0 and 100),
  taxa_arredondamento   text not null default 'truncar' check (taxa_arredondamento in ('truncar', 'arredondar')),
  atualizado_em         timestamptz not null default now()
);
insert into public.repasse_config default values;

-- ---------- Tabela de taxas do cartão parcelado ----------
create table public.repasse_taxas_cartao (
  id                uuid primary key default gen_random_uuid(),
  parcelas          int not null unique check (parcelas between 2 and 24),
  taxa_cartao       numeric(5,2) not null check (taxa_cartao between 0 and 100),
  taxa_antecipacao  numeric(5,2) not null check (taxa_antecipacao between 0 and 100),
  taxa_total        numeric(5,2) generated always as (taxa_cartao + taxa_antecipacao) stored,
  atualizado_em     timestamptz not null default now()
);
insert into public.repasse_taxas_cartao (parcelas, taxa_cartao, taxa_antecipacao) values
  (2, 2.34, 1.61), (3, 2.34, 2.16), (4, 2.34, 2.71), (5, 2.34, 3.26), (6, 2.34, 3.81),
  (7, 2.61, 4.36), (8, 2.61, 4.91), (9, 2.61, 5.46), (10, 2.61, 6.01), (11, 2.61, 6.56), (12, 2.61, 7.11);

-- ---------- Repasses (um por cirurgia/pagamento) ----------
create table public.repasses (
  id                      uuid primary key default gen_random_uuid(),
  numero                  bigint generated always as identity unique,
  conta_id                uuid references public.contas(id),          -- conta particular de origem (opcional)
  paciente_id             uuid references public.pacientes(id),
  profissional_id         uuid not null references public.profissionais(id),  -- médico que recebe
  procedimento            text not null check (trim(procedimento) <> ''),     -- ex.: "Refrativa AO"
  data_cirurgia           date not null,
  data_pagamento          date not null default current_date,         -- quando o paciente pagou
  valor_total             numeric(12,2) not null check (valor_total > 0),
  forma_pagamento         text not null check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito')),
  parcelas                int not null default 1 check (parcelas between 1 and 24),
  -- cópia das regras no momento do cálculo (preenchida pelo banco)
  imposto_pct             numeric(5,2) not null default 0,
  centro_cirurgico_pct    numeric(5,2) not null default 0,
  taxa_interna_pct        numeric(5,2) not null default 0,
  taxa_arredondamento     text not null default 'truncar',
  imposto_total           numeric(12,2) not null default 0,
  centro_cirurgico_total  numeric(12,2) not null default 0,
  status                  text not null default 'aberto' check (status in ('aberto', 'concluido', 'cancelado')),
  motivo_cancelamento     text,
  observacoes             text,
  criado_por              uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create unique index repasses_conta_unica on public.repasses (conta_id) where conta_id is not null and status <> 'cancelado';
create index repasses_conta_idx on public.repasses (conta_id);
create index repasses_paciente_idx on public.repasses (paciente_id);
create index repasses_profissional_idx on public.repasses (profissional_id, data_cirurgia desc);
create index repasses_criado_por_idx on public.repasses (criado_por);
create index repasses_data_idx on public.repasses (data_cirurgia);

-- ---------- Parcelas do repasse ----------
create table public.repasse_parcelas (
  id                uuid primary key default gen_random_uuid(),
  repasse_id        uuid not null references public.repasses(id),
  numero            int not null check (numero >= 1),
  data_prevista     date not null,
  valor_recebido    numeric(12,2) check (valor_recebido >= 0),   -- o que realmente entrou
  recebido_em       date,
  imposto           numeric(12,2) not null,                       -- parte desta parcela (fixa)
  centro_cirurgico  numeric(12,2) not null,                       -- parte desta parcela (fixa)
  taxa_interna      numeric(12,2),                                -- calculada quando o valor entra
  medico            numeric(12,2),                                -- calculado quando o valor entra
  pago_medico_em    date,                                         -- quando o Luciano pagou o médico
  observacoes       text,
  atualizado_em     timestamptz not null default now(),
  unique (repasse_id, numero)
);
create index repasse_parcelas_recebido_idx on public.repasse_parcelas (recebido_em);
create index repasse_parcelas_pago_idx on public.repasse_parcelas (pago_medico_em);

-- =====================================================================
-- Cálculo
-- =====================================================================
-- Repasse: copia as regras vigentes e calcula imposto e centro cirúrgico
create or replace function interno.tg_repasse_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cfg public.repasse_config; v_conta public.contas;
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
    if new.forma_pagamento = 'credito' and new.parcelas >= 2 then
      select t.taxa_total into new.taxa_interna_pct from public.repasse_taxas_cartao t where t.parcelas = new.parcelas;
      if new.taxa_interna_pct is null then
        raise exception 'Não há taxa cadastrada para crédito em %x. Cadastre na tabela de taxas do repasse.', new.parcelas;
      end if;
    else
      new.taxa_interna_pct := 0;
    end if;
    new.imposto_total          := round(new.valor_total * new.imposto_pct / 100, 2);
    new.centro_cirurgico_total := round((new.valor_total - new.imposto_total) * new.centro_cirurgico_pct / 100, 2);
    new.status := 'aberto';
    new.motivo_cancelamento := null;
    return new;
  end if;

  -- UPDATE: valores e regras não mudam depois de criado (para corrigir: cancelar e lançar de novo)
  if (new.valor_total, new.forma_pagamento, new.parcelas, new.imposto_pct, new.centro_cirurgico_pct,
      new.taxa_interna_pct, new.taxa_arredondamento, new.imposto_total, new.centro_cirurgico_total,
      new.profissional_id, new.data_pagamento, new.conta_id, new.criado_por, new.criado_em, new.numero)
     is distinct from
     (old.valor_total, old.forma_pagamento, old.parcelas, old.imposto_pct, old.centro_cirurgico_pct,
      old.taxa_interna_pct, old.taxa_arredondamento, old.imposto_total, old.centro_cirurgico_total,
      old.profissional_id, old.data_pagamento, old.conta_id, old.criado_por, old.criado_em, old.numero) then
    raise exception 'Valor, forma de pagamento, parcelas e médico não mudam depois de lançados. Cancele este repasse e lance de novo.';
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
  end if;
  return new;
end $$;
create trigger regras before insert or update on public.repasses
  for each row execute function interno.tg_repasse_regras();

-- Cria as parcelas: imposto e centro cirúrgico divididos igualmente (sobra na última)
create or replace function interno.tg_repasse_parcelas_criar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  i int;
  v_imp numeric(12,2) := trunc(new.imposto_total / new.parcelas, 2);
  v_cc  numeric(12,2) := trunc(new.centro_cirurgico_total / new.parcelas, 2);
  v_ultima boolean;
begin
  for i in 1..new.parcelas loop
    v_ultima := i = new.parcelas;
    insert into public.repasse_parcelas (repasse_id, numero, data_prevista, imposto, centro_cirurgico, valor_recebido, recebido_em)
    values (
      new.id, i,
      case when new.forma_pagamento = 'credito' then (new.data_pagamento + make_interval(months => i))::date
           else new.data_pagamento end,
      case when v_ultima then new.imposto_total - v_imp * (new.parcelas - 1) else v_imp end,
      case when v_ultima then new.centro_cirurgico_total - v_cc * (new.parcelas - 1) else v_cc end,
      -- dinheiro e PIX: entra o valor total na hora
      case when new.forma_pagamento in ('dinheiro', 'pix') then new.valor_total end,
      case when new.forma_pagamento in ('dinheiro', 'pix') then new.data_pagamento end
    );
  end loop;
  return null;
end $$;
create trigger parcelas after insert on public.repasses
  for each row execute function interno.tg_repasse_parcelas_criar();

-- Parcela: calcula taxa interna e parte do médico; trava o que já foi pago
create or replace function interno.tg_repasse_parcela_calculo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_r public.repasses; v_bruto numeric;
begin
  select * into v_r from public.repasses where id = new.repasse_id;
  if tg_op = 'UPDATE' then
    if v_r.status = 'cancelado' then
      raise exception 'Este repasse foi cancelado: as parcelas não mudam.';
    end if;
    -- partes fixas não mudam
    new.repasse_id := old.repasse_id; new.numero := old.numero;
    new.imposto := old.imposto; new.centro_cirurgico := old.centro_cirurgico;
    if old.pago_medico_em is not null and new.pago_medico_em is not null
       and (new.valor_recebido is distinct from old.valor_recebido) then
      raise exception 'Esta parcela já foi paga ao médico. Desmarque o pagamento antes de mudar o valor recebido.';
    end if;
  end if;

  if new.valor_recebido is null then
    new.taxa_interna := null; new.medico := null; new.recebido_em := null;
    if new.pago_medico_em is not null then
      raise exception 'Informe o valor que entrou antes de marcar o pagamento ao médico.';
    end if;
    return new;
  end if;

  new.recebido_em := coalesce(new.recebido_em, current_date);
  v_bruto := new.valor_recebido * v_r.taxa_interna_pct / 100;
  new.taxa_interna := case when v_r.taxa_arredondamento = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
  new.medico := new.valor_recebido - new.imposto - new.centro_cirurgico - new.taxa_interna;
  if new.medico < 0 then
    raise exception 'A parte do médico na parcela % ficou negativa (R$ %). Confira o valor que entrou.', new.numero, new.medico;
  end if;
  return new;
end $$;
create trigger calculo before insert or update on public.repasse_parcelas
  for each row execute function interno.tg_repasse_parcela_calculo();

-- Situação do repasse: concluído quando todas as parcelas foram pagas ao médico
create or replace function interno.tg_repasse_situacao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.repasses r set status = case
      when not exists (select 1 from public.repasse_parcelas p where p.repasse_id = r.id and p.pago_medico_em is null)
      then 'concluido' else 'aberto' end
  where r.id = new.repasse_id and r.status <> 'cancelado'
    and r.status is distinct from case
      when not exists (select 1 from public.repasse_parcelas p where p.repasse_id = r.id and p.pago_medico_em is null)
      then 'concluido' else 'aberto' end;
  return null;
end $$;
create trigger situacao after update of pago_medico_em on public.repasse_parcelas
  for each row execute function interno.tg_repasse_situacao();

-- ---------- Gatilhos: atualizado_em e auditoria ----------
do $$
declare t text;
begin
  foreach t in array array['repasse_config', 'repasse_taxas_cartao', 'repasses', 'repasse_parcelas'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;

-- =====================================================================
-- Segurança (RLS): só faturamento e admin. Ninguém apaga (cancelar com motivo).
-- Parcelas são criadas só pelo banco.
-- =====================================================================
alter table public.repasse_config        enable row level security;
alter table public.repasse_taxas_cartao  enable row level security;
alter table public.repasses              enable row level security;
alter table public.repasse_parcelas      enable row level security;

create policy le on public.repasse_config for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.repasse_config for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

create policy le on public.repasse_taxas_cartao for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy inclui on public.repasse_taxas_cartao for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.repasse_taxas_cartao for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

create policy le on public.repasses for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy inclui on public.repasses for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.repasses for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

create policy le on public.repasse_parcelas for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.repasse_parcelas for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));
