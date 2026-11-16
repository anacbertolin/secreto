-- =====================================================================
-- 0061 — Repasse: taxa interna também no DÉBITO e no CRÉDITO 1x
-- =====================================================================
-- Decisão da dona (16/11/2026): débito e crédito à vista (1x) passam a ter taxa interna
-- de 2,34% (só a taxa do cartão; não há antecipação). Calculada como no parcelado:
-- sobre o valor que ENTROU, com os centavos cortados.
-- A tabela de taxas ganha a coluna "forma" (crédito ou débito) e aceita 1 parcela.
-- Repasses já lançados não mudam (cada um guarda a taxa usada).
-- =====================================================================

alter table public.repasse_taxas_cartao
  add column forma text not null default 'credito' check (forma in ('credito', 'debito'));
alter table public.repasse_taxas_cartao drop constraint repasse_taxas_cartao_parcelas_key;
alter table public.repasse_taxas_cartao drop constraint repasse_taxas_cartao_parcelas_check;
alter table public.repasse_taxas_cartao
  add constraint repasse_taxas_cartao_parcelas_check check (parcelas between 1 and 24),
  add constraint repasse_taxas_cartao_debito_1x check (forma = 'credito' or parcelas = 1),
  add constraint repasse_taxas_cartao_forma_parcelas_key unique (forma, parcelas);

insert into public.repasse_taxas_cartao (forma, parcelas, taxa_cartao, taxa_antecipacao) values
  ('credito', 1, 2.34, 0),
  ('debito',  1, 2.34, 0);

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
    new.imposto_total          := round(new.valor_total * new.imposto_pct / 100, 2);
    new.centro_cirurgico_total := round((new.valor_total - new.imposto_total) * new.centro_cirurgico_pct / 100, 2);
    new.status := 'aberto';
    new.motivo_cancelamento := null;
    return new;
  end if;

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
