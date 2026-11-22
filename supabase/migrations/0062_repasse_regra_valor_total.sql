-- =====================================================================
-- 0062 — Repasse: nova regra (decisão da dona, 16/11/2026) — cirurgia REFRATIVA
-- =====================================================================
-- Tudo sobre o VALOR TOTAL da venda:
--   1. Imposto      = 15% do total (arredondado).
--   2. Taxa cartão  = % da tabela sobre o total, centavos CORTADOS
--                     (débito/crédito 1x: só a taxa do cartão; parcelado: cartão + antecipação;
--                      dinheiro/PIX: zero).
--   3. Sobra        = total − imposto − taxa.
--   4. Clínica      = 20% da sobra (parte da empresa sobre os honorários; arredondado).
--      (a coluna continua se chamando centro_cirurgico_* para não quebrar nada)
--   5. Médico       = sobra − clínica (os 80% de honorários).
-- Cada parte é dividida igualmente entre as parcelas (sobra de centavos na última).
-- O médico recebe a parcela quando ela ENTRA (recebido_em); o valor que a maquininha
-- depositou (valor_recebido) passa a ser só informativo, não muda o cálculo.
-- Exemplos: PIX 4.820 → médico 3.277,60; débito 4.820 → taxa 112,78, médico 3.187,38;
--           crédito 12x 5.220 → imposto 783,00, taxa 507,38, clínica 785,92, médico 3.143,70.
-- Repasses antigos (regra anterior) ficam como estão: o único existente era de teste e
-- foi cancelado.
-- =====================================================================

alter table public.repasses
  add column taxa_interna_total numeric(12,2) not null default 0,
  add column medico_total       numeric(12,2) not null default 0;
alter table public.repasse_parcelas
  add column valor numeric(12,2);   -- valor da parcela (imposto + taxa + clínica + médico)

comment on column public.repasses.centro_cirurgico_pct   is 'Parte da clínica (empresa) sobre os honorários, em %';
comment on column public.repasses.centro_cirurgico_total is 'Parte da clínica (empresa): % sobre (total − imposto − taxa)';
comment on column public.repasse_parcelas.valor_recebido is 'Informativo: quanto a maquininha depositou. Não entra no cálculo.';

-- registro antigo: preenche os totais novos a partir das parcelas
update public.repasses r set
  taxa_interna_total = coalesce((select sum(p.taxa_interna) from public.repasse_parcelas p where p.repasse_id = r.id), 0),
  medico_total       = coalesce((select sum(p.medico)       from public.repasse_parcelas p where p.repasse_id = r.id), 0);

-- ---------- Repasse: calcula tudo no lançamento ----------
create or replace function interno.tg_repasse_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cfg public.repasse_config; v_conta public.contas; v_bruto numeric;
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

    new.imposto_total := round(new.valor_total * new.imposto_pct / 100, 2);
    v_bruto := new.valor_total * new.taxa_interna_pct / 100;
    new.taxa_interna_total := case when new.taxa_arredondamento = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
    new.centro_cirurgico_total := round((new.valor_total - new.imposto_total - new.taxa_interna_total) * new.centro_cirurgico_pct / 100, 2);
    new.medico_total := new.valor_total - new.imposto_total - new.taxa_interna_total - new.centro_cirurgico_total;
    new.status := 'aberto';
    new.motivo_cancelamento := null;
    return new;
  end if;

  if (new.valor_total, new.forma_pagamento, new.parcelas, new.imposto_pct, new.centro_cirurgico_pct,
      new.taxa_interna_pct, new.taxa_arredondamento, new.imposto_total, new.centro_cirurgico_total,
      new.taxa_interna_total, new.medico_total,
      new.profissional_id, new.data_pagamento, new.conta_id, new.criado_por, new.criado_em, new.numero)
     is distinct from
     (old.valor_total, old.forma_pagamento, old.parcelas, old.imposto_pct, old.centro_cirurgico_pct,
      old.taxa_interna_pct, old.taxa_arredondamento, old.imposto_total, old.centro_cirurgico_total,
      old.taxa_interna_total, old.medico_total,
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

-- ---------- Parcelas: cada parte dividida igualmente (sobra na última) ----------
create or replace function interno.tg_repasse_parcelas_criar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  i int;
  n int := new.parcelas;
  v_imp numeric(12,2) := trunc(new.imposto_total / n, 2);
  v_tx  numeric(12,2) := trunc(new.taxa_interna_total / n, 2);
  v_cc  numeric(12,2) := trunc(new.centro_cirurgico_total / n, 2);
  v_med numeric(12,2) := trunc(new.medico_total / n, 2);
  a numeric(12,2); b numeric(12,2); c numeric(12,2); d numeric(12,2);
  v_vista boolean := new.forma_pagamento in ('dinheiro', 'pix');
begin
  for i in 1..n loop
    a := case when i = n then new.imposto_total          - v_imp * (n - 1) else v_imp end;
    b := case when i = n then new.taxa_interna_total     - v_tx  * (n - 1) else v_tx  end;
    c := case when i = n then new.centro_cirurgico_total - v_cc  * (n - 1) else v_cc  end;
    d := case when i = n then new.medico_total           - v_med * (n - 1) else v_med end;
    insert into public.repasse_parcelas (repasse_id, numero, data_prevista, valor, imposto, taxa_interna, centro_cirurgico, medico,
                                         valor_recebido, recebido_em)
    values (new.id, i,
            case when new.forma_pagamento = 'credito' then (new.data_pagamento + make_interval(months => i))::date
                 else new.data_pagamento end,
            a + b + c + d, a, b, c, d,
            case when v_vista then new.valor_total end,
            case when v_vista then new.data_pagamento end);
  end loop;
  return null;
end $$;

-- ---------- Parcela: partes fixas; só muda "entrou", valor depositado e "pago ao médico" ----------
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
  new.imposto := old.imposto; new.taxa_interna := old.taxa_interna;
  new.centro_cirurgico := old.centro_cirurgico; new.medico := old.medico;
  if new.pago_medico_em is not null and new.recebido_em is null then
    raise exception 'Marque que a parcela % entrou antes de marcar o pagamento ao médico.', new.numero;
  end if;
  return new;
end $$;
