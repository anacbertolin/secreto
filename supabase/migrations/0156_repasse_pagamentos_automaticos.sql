-- =====================================================================
-- 0156 — Pagamento ao médico e a terceiros AUTOMÁTICO (decisão do Dr. Gelson, 25/11/2026)
-- =====================================================================
-- Sem botão "pago": cada parcela e cada custo nascem com a data em que serão pagos.
--  * Médico, pagamento em CRÉDITO: fechamento no dia 20 — parcela que cai até o dia 20 (inclusive) é paga ao médico
--    no dia 25 do mesmo mês; depois do dia 20, no dia 25 do mês seguinte. (Fim de semana/feriado não importa.)
--  * Médico, PIX / dinheiro / débito: pago no DIA DA CIRURGIA.
--  * Terceiros (auxiliar, instrumentação, anestesista): sempre à vista, no DIA DA CIRURGIA.
--  * "Cobrança ao médico" (Campo Grande) não muda: o médico é quem paga, com o botão "Médico pagou".
-- Pago = data de pagamento de hoje ou passada. O status do repasse (não cobrança) fica "aberto"; a tela calcula
-- "médico pago" pelas datas. Mudou a data da cirurgia → as datas que dependem dela acompanham.
-- Cancelar só é bloqueado se já houver pagamento com data de hoje ou passada.
-- =====================================================================

create or replace function interno.repasse_dia_pagamento(p_forma text, p_cirurgia date, p_cai date)
returns date language sql immutable set search_path = '' as $$
  select case
    when p_forma = 'credito' then
      (date_trunc('month', p_cai)::date + case when extract(day from p_cai) <= 20 then interval '0 month' else interval '1 month' end)::date + 24
    else p_cirurgia end
$$;

create or replace function interno.tg_repasse_parcela_pagar_medico()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.repasses;
begin
  select * into r from public.repasses where id = new.repasse_id;
  if r.regra <> 'cobranca' and new.pago_medico_em is null then
    new.pago_medico_em := interno.repasse_dia_pagamento(r.forma_pagamento, r.data_cirurgia, coalesce(new.recebido_em, new.data_prevista));
  end if;
  return new;
end $$;
-- nome depois de "entra_sozinha" (os gatilhos rodam em ordem alfabética): já encontra recebido_em preenchido
create trigger pagar_medico before insert on public.repasse_parcelas
  for each row execute function interno.tg_repasse_parcela_pagar_medico();

create or replace function interno.tg_repasse_custo_pagar_terceiro()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.repasses;
begin
  select * into r from public.repasses where id = new.repasse_id;
  if r.regra <> 'cobranca' and new.pago_em is null and new.valor > 0
     and (new.favorecido_profissional_id is not null or new.favorecido_nome is not null) then
    new.pago_em := r.data_cirurgia;
  end if;
  return new;
end $$;
create trigger pagar_terceiro before insert on public.repasse_custos
  for each row execute function interno.tg_repasse_custo_pagar_terceiro();

-- mudou a data da cirurgia: acompanha (crédito do médico depende de quando a parcela cai, não da cirurgia)
create or replace function interno.tg_repasse_data_cirurgia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.data_cirurgia is distinct from old.data_cirurgia and new.status <> 'cancelado' and new.regra <> 'cobranca' then
    if new.forma_pagamento <> 'credito' then
      update public.repasse_parcelas set pago_medico_em = new.data_cirurgia where repasse_id = new.id;
    end if;
    update public.repasse_custos set pago_em = new.data_cirurgia
     where repasse_id = new.id and valor > 0 and (favorecido_profissional_id is not null or favorecido_nome is not null);
  end if;
  return null;
end $$;
create trigger data_cirurgia after update of data_cirurgia on public.repasses
  for each row execute function interno.tg_repasse_data_cirurgia();

-- situação: só a cobrança fecha sozinha (médico pagou); nos demais o "médico pago" é pelas datas
create or replace function interno.tg_repasse_situacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_regra text; v_novo text;
begin
  select regra into v_regra from public.repasses where id = new.repasse_id;
  if v_regra = 'cobranca' then
    v_novo := case when exists (select 1 from public.repasse_parcelas p where p.repasse_id = new.repasse_id and p.recebido_em is null)
                   then 'aberto' else 'concluido' end;
  else
    v_novo := 'aberto';
  end if;
  update public.repasses r set status = v_novo
  where r.id = new.repasse_id and r.status <> 'cancelado' and r.status is distinct from v_novo;
  return null;
end $$;

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
      raise exception 'Escolha o médico.';
    end if;

    select * into v_cfg from public.repasse_config limit 1;
    new.taxa_arredondamento := v_cfg.taxa_arredondamento;
    new.custos_total := coalesce(nullif(current_setting('app.repasse_custos', true), '')::numeric, 0);

    if new.regra = 'cobranca' then
      -- o médico deve os custos à clínica; nada vai para ele
      new.imposto_pct := 0; new.centro_cirurgico_pct := 0; new.taxa_interna_pct := 0;
      new.imposto_total := 0; new.taxa_interna_total := 0;
      new.valor_total := new.custos_total;
      new.centro_cirurgico_total := 0; new.medico_total := 0;
    else
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
      if new.regra = 'direto' then
        new.imposto_pct := 0; new.centro_cirurgico_pct := 0;
      else
        new.imposto_pct := v_cfg.imposto_pct; new.centro_cirurgico_pct := v_cfg.centro_cirurgico_pct;
      end if;
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
    end if;
    new.status := 'aberto';
    new.motivo_cancelamento := null;
    return new;
  end if;

  if (new.valor_total, new.forma_pagamento, new.parcelas, new.imposto_pct, new.centro_cirurgico_pct,
      new.taxa_interna_pct, new.taxa_arredondamento, new.imposto_total, new.centro_cirurgico_total,
      new.taxa_interna_total, new.medico_total, new.custos_total, new.procedimento_id, new.regra,
      new.profissional_id, new.data_pagamento, new.conta_id, new.criado_por, new.criado_em, new.numero)
     is distinct from
     (old.valor_total, old.forma_pagamento, old.parcelas, old.imposto_pct, old.centro_cirurgico_pct,
      old.taxa_interna_pct, old.taxa_arredondamento, old.imposto_total, old.centro_cirurgico_total,
      old.taxa_interna_total, old.medico_total, old.custos_total, old.procedimento_id, old.regra,
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
    -- datas de pagamento agora são automáticas (0156): só bloqueia o que já foi pago (data de hoje ou passada)
    if exists (select 1 from public.repasse_parcelas where repasse_id = new.id and pago_medico_em <= current_date) then
      raise exception 'O médico já recebeu parcela deste repasse (data de pagamento já passou). Combine a devolução com ele antes de cancelar.';
    end if;
    if exists (select 1 from public.repasse_custos where repasse_id = new.id and pago_em <= current_date and valor > 0) then
      raise exception 'Os custos de terceiros (auxiliar/instrumentação/anestesista) já foram pagos no dia da cirurgia. Combine a devolução antes de cancelar.';
    end if;
    if new.regra = 'cobranca' and exists (select 1 from public.repasse_parcelas where repasse_id = new.id and recebido_em is not null) then
      raise exception 'O médico já pagou esta cobrança. Desmarque o pagamento antes de cancelar.';
    end if;
  end if;
  return new;
end $$;

revoke execute on function interno.repasse_dia_pagamento(text, date, date), interno.tg_repasse_parcela_pagar_medico(),
  interno.tg_repasse_custo_pagar_terceiro(), interno.tg_repasse_data_cirurgia() from public, anon, authenticated;

-- repasses já lançados (não cancelados, não cobrança)
update public.repasse_parcelas p
   set pago_medico_em = interno.repasse_dia_pagamento(r.forma_pagamento, r.data_cirurgia, coalesce(p.recebido_em, p.data_prevista))
  from public.repasses r
 where r.id = p.repasse_id and r.status <> 'cancelado' and r.regra <> 'cobranca' and p.pago_medico_em is null;
update public.repasse_custos c set pago_em = r.data_cirurgia
  from public.repasses r
 where r.id = c.repasse_id and r.status <> 'cancelado' and r.regra <> 'cobranca' and c.pago_em is null and c.valor > 0
   and (c.favorecido_profissional_id is not null or c.favorecido_nome is not null);
update public.repasses set status = 'aberto' where status = 'concluido' and regra <> 'cobranca';
