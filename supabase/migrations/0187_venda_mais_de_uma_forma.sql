-- =====================================================================
-- 0187 — Mais de uma forma de pagamento na mesma venda/repasse (pedido do Dr. Gelson, 26/11/2026)
-- =====================================================================
-- Caso real: injeção antiangiogênica (venda nº 6) paga com R$ 1.300 em DINHEIRO + R$ 900 em PIX.
-- * forma_pagamento = 'misto' + lista em "pagamentos" ([{forma, parcelas, valor}, …]); o total é a soma.
-- * Caixa da Orientação: entra SÓ a parte em dinheiro.
-- * Repasse: taxa do cartão calculada em cada parte de cartão e somada; imposto, custos e 20% sobre o total.
--   Parcelas: 1 parcela "à vista" (dinheiro + PIX + débito; médico recebe no dia da cirurgia) + as parcelas de cada
--   cartão de crédito (fechamento dia 20 / pagamento dia 25). Cada parcela guarda a sua forma (repasse_parcelas.forma).
-- =====================================================================

alter table public.orientacao_vendas add column pagamentos jsonb;
alter table public.orientacao_vendas drop constraint orientacao_vendas_forma_pagamento_check;
alter table public.orientacao_vendas add constraint orientacao_vendas_forma_pagamento_check
  check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'misto'));
alter table public.repasses add column pagamentos jsonb;
alter table public.repasses drop constraint repasses_forma_pagamento_check;
alter table public.repasses add constraint repasses_forma_pagamento_check
  check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'misto'));
alter table public.repasse_parcelas add column forma text;
comment on column public.orientacao_vendas.pagamentos is 'Quando forma_pagamento = misto: lista [{forma, parcelas, valor}] (dinheiro, pix, debito, credito).';
comment on column public.repasses.pagamentos is 'Quando forma_pagamento = misto: lista [{forma, parcelas, valor}].';
comment on column public.repasse_parcelas.forma is 'Forma desta parcela: credito ou avista (dinheiro/PIX/débito).';

create or replace function interno.pagamentos_validar(p jsonb)
returns numeric language plpgsql immutable set search_path = '' as $$
declare e jsonb; v_total numeric := 0; v numeric; n int;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) < 2 then
    raise exception 'Com mais de uma forma de pagamento, informe pelo menos duas formas.';
  end if;
  for e in select * from jsonb_array_elements(p) loop
    if coalesce(e ->> 'forma', '') not in ('dinheiro', 'pix', 'debito', 'credito') then raise exception 'Forma de pagamento inválida.'; end if;
    v := round((e ->> 'valor')::numeric, 2);
    if v is null or v <= 0 then raise exception 'Informe o valor de cada forma de pagamento.'; end if;
    n := coalesce((e ->> 'parcelas')::int, 1);
    if n < 1 or n > 24 or (e ->> 'forma' <> 'credito' and n <> 1) then raise exception 'Número de parcelas inválido.'; end if;
    v_total := v_total + v;
  end loop;
  return v_total;
end $$;
create or replace function interno.pagamentos_parcelas(p jsonb)
returns int language sql immutable set search_path = '' as $$
  select coalesce(max(coalesce((e ->> 'parcelas')::int, 1)) filter (where e ->> 'forma' = 'credito'), 1)
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) e
$$;
create or replace function interno.pagamentos_dinheiro(p_forma text, p jsonb, p_total numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case p_forma
    when 'dinheiro' then p_total
    when 'misto' then coalesce((select sum(round((e ->> 'valor')::numeric, 2)) from jsonb_array_elements(p) e where e ->> 'forma' = 'dinheiro'), 0)
    else 0 end
$$;
create or replace function interno.pagamentos_taxa(p jsonb, p_arred text)
returns numeric language plpgsql stable set search_path = '' as $$
declare e jsonb; v_tx numeric; v_bruto numeric; v_total numeric := 0;
begin
  for e in select * from jsonb_array_elements(p) loop
    if e ->> 'forma' in ('debito', 'credito') then
      select t.taxa_total into v_tx from public.repasse_taxas_cartao t
       where t.forma = e ->> 'forma' and t.parcelas = case when e ->> 'forma' = 'debito' then 1 else coalesce((e ->> 'parcelas')::int, 1) end;
      if v_tx is null then raise exception 'Não há taxa cadastrada para % em %x.', e ->> 'forma', coalesce(e ->> 'parcelas', '1'); end if;
      v_bruto := round((e ->> 'valor')::numeric, 2) * v_tx / 100;
      v_total := v_total + case when p_arred = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
    end if;
  end loop;
  return v_total;
end $$;
revoke execute on function interno.pagamentos_validar(jsonb), interno.pagamentos_parcelas(jsonb),
  interno.pagamentos_dinheiro(text, jsonb, numeric), interno.pagamentos_taxa(jsonb, text) from public, anon;
grant execute on function interno.pagamentos_validar(jsonb), interno.pagamentos_parcelas(jsonb),
  interno.pagamentos_dinheiro(text, jsonb, numeric), interno.pagamentos_taxa(jsonb, text) to authenticated;

create or replace function interno.tg_orientacao_venda_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_fat boolean := interno.tem_funcao('faturamento', 'admin');
begin
  -- mais de uma forma de pagamento (0187): o total e as parcelas vêm da lista
  if new.forma_pagamento = 'misto' then
    new.valor_total := interno.pagamentos_validar(new.pagamentos);
    new.parcelas := interno.pagamentos_parcelas(new.pagamentos);
  else
    new.pagamentos := null;
    if new.forma_pagamento <> 'credito' then new.parcelas := 1; end if;
  end if;
  if not exists (select 1 from public.profissionais where id = new.profissional_id and funcao = 'medico') then
    raise exception 'Escolha o médico.';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'aguardando'; new.motivo := null; new.repasse_id := null; new.conferido_por := null; new.conferido_em := null;
    new.realizada_em := null; new.realizada_por := null;
    return new;
  end if;
  -- "realizada" só muda pela função cirurgia_realizada (0158)
  if (new.realizada_em, new.realizada_por) is distinct from (old.realizada_em, old.realizada_por)
     and coalesce(current_setting('app.cirurgia_check', true), '') <> 'on' then
    raise exception 'A cirurgia é marcada como realizada pela tela "Cirurgias do dia".';
  end if;
  -- venda já lançada: ainda dá para marcar/remarcar a data da cirurgia, "fora da clínica" e a realização (0158)
  if old.status = 'lancada' and coalesce(current_setting('app.venda_lancando', true), '') <> 'on'
     and (new.paciente_id, new.profissional_id, new.procedimento_id, new.procedimento, new.lente_id, new.convenio_id, new.agendamento_id,
          new.data_pagamento, new.valor_total, new.forma_pagamento, new.parcelas, new.observacoes, new.status, new.motivo,
          new.repasse_id, new.conferido_por, new.conferido_em, new.tipo, new.anestesista_direto, new.pagamentos)
         is not distinct from
         (old.paciente_id, old.profissional_id, old.procedimento_id, old.procedimento, old.lente_id, old.convenio_id, old.agendamento_id,
          old.data_pagamento, old.valor_total, old.forma_pagamento, old.parcelas, old.observacoes, old.status, old.motivo,
          old.repasse_id, old.conferido_por, old.conferido_em, old.tipo, old.anestesista_direto, old.pagamentos) then
    new.criado_por := old.criado_por; new.criado_em := old.criado_em;
    return new;
  end if;
  if old.status = 'lancada' and coalesce(current_setting('app.venda_lancando', true), '') = 'on' then
    -- cancelamento do repasse (função repasse_cancelar, migração 0101): a venda volta para conferência ou é cancelada
    new.criado_por := old.criado_por; new.criado_em := old.criado_em;
    return new;
  end if;
  if old.status in ('lancada', 'cancelada') then
    -- lançamento feito pela função repasse_lancar (aguardando → lançada) já passou; depois disso não muda
    raise exception 'Esta venda já foi % e não pode mudar.', case old.status when 'lancada' then 'lançada no repasse' else 'cancelada' end;
  end if;
  if (new.status = 'lancada' or new.repasse_id is not null) and coalesce(current_setting('app.venda_lancando', true), '') <> 'on' then
    raise exception 'A venda só fica "lançada" pelo lançamento do repasse.';
  end if;
  if new.status = 'devolvida' and old.status <> 'devolvida' then
    if not v_fat then raise exception 'Só o faturamento devolve uma venda.'; end if;
    if coalesce(trim(new.motivo), '') = '' then raise exception 'Informe o motivo da devolução.'; end if;
  end if;
  if new.status = 'cancelada' and coalesce(trim(new.motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  -- o faturamento não altera os dados da venda (só devolve ou lança); quem registrou corrige
  if v_fat and not interno.atende_orientacao() and not interno.tem_funcao('admin') and
     (new.paciente_id, new.profissional_id, new.procedimento_id, new.procedimento, new.lente_id, new.valor_total,
      new.forma_pagamento, new.parcelas, new.data_pagamento, new.tipo, new.pagamentos)
     is distinct from
     (old.paciente_id, old.profissional_id, old.procedimento_id, old.procedimento, old.lente_id, old.valor_total,
      old.forma_pagamento, old.parcelas, old.data_pagamento, old.tipo, old.pagamentos) then
    raise exception 'Os dados da venda são corrigidos por quem a registrou. Devolva com o motivo.';
  end if;
  new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  return new;
end $$;

create or replace function interno.tg_orientacao_venda_caixa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_caixa uuid; v_at uuid; v_at_caixa uuid; v_cx_status text; v_cx_data date;
  v_nome text := (select p.nome from public.pacientes p where p.id = new.paciente_id);
  v_desc text := case new.tipo when 'lente' then 'Lente: ' else 'Cirurgia: ' end || new.procedimento || ' (venda nº ' || new.numero || ')';
  v_din numeric := interno.pagamentos_dinheiro(new.forma_pagamento, new.pagamentos, new.valor_total);   -- parte em dinheiro (0187)
  v_din_old numeric := case when tg_op = 'UPDATE' then interno.pagamentos_dinheiro(old.forma_pagamento, old.pagamentos, old.valor_total) else 0 end;
  v_quer boolean := v_din > 0 and new.status <> 'cancelada';   -- deve estar no caixa?
  v_motivo text;
  -- mudou algo de dinheiro? (forma, valor ou cancelamento) — só isso exige mexer num caixa fechado
  v_mudou boolean := tg_op = 'UPDATE' and (v_din <> v_din_old or (new.status = 'cancelada' and old.status <> 'cancelada'));
begin
  perform set_config('app.venda_caixa', 'on', true);
  select a.id, a.caixa_id, c.status, c.data into v_at, v_at_caixa, v_cx_status, v_cx_data
  from public.caixa_atendimentos a join public.caixas c on c.id = a.caixa_id
  where a.venda_id = new.id and not a.cancelado;

  if v_at is null then
    -- ainda não está no caixa: entra se for dinheiro (venda nova, ou corrigida para dinheiro)
    if v_quer and (tg_op = 'INSERT' or v_din_old = 0 or old.status = 'cancelada') then
      select c.id into v_caixa from public.caixas c where c.setor = 'orientacao' and c.status = 'aberto';
      if not found then
        raise exception 'Pagamento em dinheiro: abra o caixa da Orientação Cirúrgica (menu Caixa) antes de registrar a venda.';
      end if;
      insert into public.caixa_atendimentos (caixa_id, paciente_nome, paciente_id, medico_id, descricao, valor, venda_id)
      values (v_caixa, coalesce(v_nome, 'Paciente'), new.paciente_id, new.profissional_id, v_desc, v_din, new.id)
      returning id into v_at;
      insert into public.caixa_pagamentos (caixa_id, atendimento_id, forma, parcelas, valor)
      values (v_caixa, v_at, 'dinheiro', 1, v_din);
    end if;
  elsif not v_quer or v_din <> v_din_old then
    -- está no caixa e precisa sair (não é mais dinheiro / cancelada) ou mudar o valor
    if v_cx_status <> 'aberto' and not v_mudou then
      -- lançamento antigo num caixa já fechado (ex.: venda no cartão de antes da 0153) e nada de dinheiro mudou agora:
      -- deixa como está e não impede devolver/reenviar/lançar a venda
      perform set_config('app.venda_caixa', '', true);
      return null;
    end if;
    if v_cx_status <> 'aberto' then
      raise exception 'O caixa da Orientação Cirúrgica de % já foi fechado. Para mudar o valor, a forma de pagamento ou cancelar esta venda, peça para devolverem esse caixa para correção.',
        to_char(v_cx_data, 'DD/MM/YYYY');
    end if;
    v_motivo := case when new.status = 'cancelada' then 'Venda nº ' || new.numero || ' cancelada: ' || coalesce(new.motivo, '')
                     when not v_quer then 'Venda nº ' || new.numero || ' sem parte em dinheiro (caixa é só dinheiro)'
                     else 'Venda nº ' || new.numero || ' corrigida' end;
    update public.caixa_pagamentos set cancelado = true, motivo_cancelamento = v_motivo where atendimento_id = v_at and not cancelado;
    if not v_quer then
      update public.caixa_atendimentos set cancelado = true, motivo_cancelamento = v_motivo where id = v_at;
    else
      update public.caixa_atendimentos set paciente_nome = coalesce(v_nome, paciente_nome), paciente_id = new.paciente_id,
             medico_id = new.profissional_id, descricao = v_desc, valor = v_din where id = v_at;
      insert into public.caixa_pagamentos (caixa_id, atendimento_id, forma, parcelas, valor)
      values (v_at_caixa, v_at, 'dinheiro', 1, v_din);
    end if;
  elsif v_cx_status = 'aberto' then
    -- só dados descritivos (paciente, médico, procedimento)
    update public.caixa_atendimentos set paciente_nome = coalesce(v_nome, paciente_nome), paciente_id = new.paciente_id,
           medico_id = new.profissional_id, descricao = v_desc
     where id = v_at and (paciente_id, medico_id, descricao) is distinct from (new.paciente_id, new.profissional_id, v_desc);
  end if;
  perform set_config('app.venda_caixa', '', true);
  return null;
end $$;

create or replace function interno.tg_repasse_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cfg public.repasse_config; v_conta public.contas; v_bruto numeric; v_honorarios numeric;
begin
  if tg_op = 'INSERT' then
    if new.forma_pagamento not in ('credito', 'misto') then
      new.parcelas := 1;
    end if;
    if new.forma_pagamento <> 'misto' then new.pagamentos := null; end if;
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
      if new.forma_pagamento = 'misto' then
        -- mais de uma forma (0187): taxa de cada parte de cartão, somadas
        new.valor_total := interno.pagamentos_validar(new.pagamentos);
        new.parcelas := interno.pagamentos_parcelas(new.pagamentos);
        new.taxa_interna_total := interno.pagamentos_taxa(new.pagamentos, v_cfg.taxa_arredondamento);
        new.taxa_interna_pct := round(new.taxa_interna_total * 100 / new.valor_total, 2);
      elsif new.forma_pagamento in ('credito', 'debito') then
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
      if new.forma_pagamento <> 'misto' then
        v_bruto := new.valor_total * new.taxa_interna_pct / 100;
        new.taxa_interna_total := case when new.taxa_arredondamento = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
      end if;
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
      new.profissional_id, new.data_pagamento, new.conta_id, new.criado_por, new.criado_em, new.numero, new.pagamentos)
     is distinct from
     (old.valor_total, old.forma_pagamento, old.parcelas, old.imposto_pct, old.centro_cirurgico_pct,
      old.taxa_interna_pct, old.taxa_arredondamento, old.imposto_total, old.centro_cirurgico_total,
      old.taxa_interna_total, old.medico_total, old.custos_total, old.procedimento_id, old.regra,
      old.profissional_id, old.data_pagamento, old.conta_id, old.criado_por, old.criado_em, old.numero, old.pagamentos) then
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
    if new.realizada_em is not null and exists (select 1 from public.repasse_parcelas where repasse_id = new.id and pago_medico_em <= current_date) then
      raise exception 'O médico já recebeu parcela deste repasse (data de pagamento já passou). Combine a devolução com ele antes de cancelar.';
    end if;
    if new.realizada_em is not null and exists (select 1 from public.repasse_custos where repasse_id = new.id and pago_em <= current_date and valor > 0) then
      raise exception 'Os custos de terceiros (auxiliar/instrumentação/anestesista) já foram pagos no dia da cirurgia. Combine a devolução antes de cancelar.';
    end if;
    if new.regra = 'cobranca' and exists (select 1 from public.repasse_parcelas where repasse_id = new.id and recebido_em is not null) then
      raise exception 'O médico já pagou esta cobrança. Desmarque o pagamento antes de cancelar.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.repasse_lancar(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_custo jsonb; v_total numeric := 0; v_tipo text; v_valor numeric; v_ordem int := 0;
  v_regra text := coalesce(nullif(p ->> 'regra', ''), 'geral');
begin
  if not interno.tem_funcao('faturamento', 'admin') then
    raise exception 'Você não tem permissão para lançar repasses.';
  end if;
  if v_regra not in ('geral', 'direto', 'cobranca') then
    raise exception 'Tipo de lançamento inválido.';
  end if;
  for v_custo in select * from jsonb_array_elements(coalesce(p -> 'custos', '[]'::jsonb)) loop
    v_tipo := v_custo ->> 'tipo';
    v_valor := (v_custo ->> 'valor')::numeric;
    if v_tipo is null or v_tipo not in ('sala', 'instrumentacao', 'auxiliar', 'anestesista', 'insumo', 'outro') then
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
  if v_regra = 'cobranca' and v_total <= 0 then
    raise exception 'Na cobrança ao médico, informe o que ele deve (taxa de sala, lente…).';
  end if;

  perform set_config('app.repasse_custos', v_total::text, true);
  insert into public.repasses (conta_id, paciente_id, profissional_id, procedimento_id, procedimento, data_cirurgia,
                               data_pagamento, valor_total, forma_pagamento, parcelas, observacoes, regra, pagamentos)
  values (nullif(p ->> 'conta_id', '')::uuid, nullif(p ->> 'paciente_id', '')::uuid, (p ->> 'profissional_id')::uuid,
          nullif(p ->> 'procedimento_id', '')::uuid, p ->> 'procedimento', nullif(p ->> 'data_cirurgia', '')::date,
          coalesce((p ->> 'data_pagamento')::date, current_date),
          case when v_regra = 'cobranca' then v_total else (p ->> 'valor_total')::numeric end,
          case when v_regra = 'cobranca' then 'pix' else p ->> 'forma_pagamento' end,
          case when v_regra = 'cobranca' then 1 else coalesce((p ->> 'parcelas')::int, 1) end,
          nullif(trim(p ->> 'observacoes'), ''), v_regra,
          case when v_regra <> 'cobranca' and p ->> 'forma_pagamento' = 'misto' then p -> 'pagamentos' end)
  returning id into v_id;
  perform set_config('app.repasse_custos', '', true);

  for v_custo in select * from jsonb_array_elements(coalesce(p -> 'custos', '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_tipo := v_custo ->> 'tipo';
    insert into public.repasse_custos (repasse_id, tipo, descricao, valor, favorecido_profissional_id, favorecido_nome, ordem)
    values (v_id, v_tipo, trim(v_custo ->> 'descricao'), round((v_custo ->> 'valor')::numeric, 2),
            -- sala e insumo ficam para a clínica; na cobrança tudo é devido à clínica
            case when v_tipo in ('sala', 'insumo') or v_regra = 'cobranca' then null else nullif(v_custo ->> 'favorecido_profissional_id', '')::uuid end,
            case when v_tipo in ('sala', 'insumo') or v_regra = 'cobranca' then null else nullif(trim(v_custo ->> 'favorecido_nome'), '') end,
            v_ordem);
  end loop;
  -- veio de uma venda registrada pela Orientação Cirúrgica: marca como lançada (migração 0097)
  if nullif(p ->> 'venda_id', '') is not null then
    perform set_config('app.venda_lancando', 'on', true);
    update public.orientacao_vendas set status = 'lancada', repasse_id = v_id, conferido_por = interno.profissional_atual(), conferido_em = now()
    where id = (p ->> 'venda_id')::uuid and status = 'aguardando';
    if not found then
      raise exception 'Esta venda da Orientação Cirúrgica não está aguardando conferência (já lançada, devolvida ou cancelada).';
    end if;
    perform set_config('app.venda_lancando', '', true);
  end if;
  return v_id;
end $$;

-- parcelas: forma única = como antes; misto = 1 parcela à vista + as parcelas de cada cartão de crédito.
-- Imposto, custos e clínica proporcionais ao valor de cada parcela; taxa = a do cartão daquela parte; médico = o resto.
create or replace function interno.tg_repasse_parcelas_criar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  i int; n int; k_num int := 0; v_total_parc int;
  v_vista boolean := new.forma_pagamento in ('dinheiro', 'pix') and new.regra <> 'cobranca';
  e jsonb; v_tx numeric; v_bruto numeric;
  v_avista numeric := 0; v_tx_avista numeric := 0;
  v_g numeric[] := '{}'; v_b numeric[] := '{}'; v_d date[] := '{}'; v_f text[] := '{}';
  v_tr_g numeric; v_tr_b numeric;
  a numeric(12,2); b numeric(12,2); k numeric(12,2); c numeric(12,2); d numeric(12,2);
  s_a numeric := 0; s_k numeric := 0; s_c numeric := 0;
begin
  if new.forma_pagamento <> 'misto' then
    n := new.parcelas;
    for i in 1..n loop
      a := case when i = n then new.imposto_total          - trunc(new.imposto_total / n, 2)          * (n - 1) else trunc(new.imposto_total / n, 2) end;
      b := case when i = n then new.taxa_interna_total     - trunc(new.taxa_interna_total / n, 2)     * (n - 1) else trunc(new.taxa_interna_total / n, 2) end;
      k := case when i = n then new.custos_total           - trunc(new.custos_total / n, 2)           * (n - 1) else trunc(new.custos_total / n, 2) end;
      c := case when i = n then new.centro_cirurgico_total - trunc(new.centro_cirurgico_total / n, 2) * (n - 1) else trunc(new.centro_cirurgico_total / n, 2) end;
      d := case when i = n then new.medico_total           - trunc(new.medico_total / n, 2)           * (n - 1) else trunc(new.medico_total / n, 2) end;
      insert into public.repasse_parcelas (repasse_id, numero, data_prevista, valor, imposto, taxa_interna, custos,
                                           centro_cirurgico, medico, valor_recebido, recebido_em, forma)
      values (new.id, i,
              case when new.forma_pagamento = 'credito' then (new.data_pagamento + make_interval(months => i))::date else new.data_pagamento end,
              a + b + k + c + d, a, b, k, c, d,
              case when v_vista then new.valor_total end, case when v_vista then new.data_pagamento end,
              case when new.forma_pagamento = 'credito' then 'credito' else 'avista' end);
    end loop;
    return null;
  end if;

  -- MISTO: monta a lista de parcelas (valor bruto, taxa, data, forma)
  for e in select * from jsonb_array_elements(new.pagamentos) loop
    if e ->> 'forma' <> 'credito' then
      v_avista := v_avista + round((e ->> 'valor')::numeric, 2);
      if e ->> 'forma' = 'debito' then
        select taxa_total into v_tx from public.repasse_taxas_cartao where forma = 'debito' and parcelas = 1;
        v_bruto := round((e ->> 'valor')::numeric, 2) * v_tx / 100;
        v_tx_avista := v_tx_avista + case when new.taxa_arredondamento = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
      end if;
    end if;
  end loop;
  if v_avista > 0 then
    v_g := v_g || v_avista; v_b := v_b || v_tx_avista; v_d := v_d || new.data_pagamento; v_f := v_f || 'avista'::text;
  end if;
  for e in select * from jsonb_array_elements(new.pagamentos) loop
    continue when e ->> 'forma' <> 'credito';
    n := coalesce((e ->> 'parcelas')::int, 1);
    v_tr_g := round((e ->> 'valor')::numeric, 2);
    select taxa_total into v_tx from public.repasse_taxas_cartao where forma = 'credito' and parcelas = n;
    v_bruto := v_tr_g * v_tx / 100;
    v_tr_b := case when new.taxa_arredondamento = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
    for i in 1..n loop
      v_g := v_g || (case when i = n then v_tr_g - trunc(v_tr_g / n, 2) * (n - 1) else trunc(v_tr_g / n, 2) end);
      v_b := v_b || (case when i = n then v_tr_b - trunc(v_tr_b / n, 2) * (n - 1) else trunc(v_tr_b / n, 2) end);
      v_d := v_d || (new.data_pagamento + make_interval(months => i))::date;
      v_f := v_f || 'credito'::text;
    end loop;
  end loop;

  v_total_parc := coalesce(array_length(v_g, 1), 0);
  for i in 1..v_total_parc loop
    if i = v_total_parc then
      a := new.imposto_total - s_a; k := new.custos_total - s_k; c := new.centro_cirurgico_total - s_c;
    else
      a := trunc(new.imposto_total * v_g[i] / new.valor_total, 2);
      k := trunc(new.custos_total * v_g[i] / new.valor_total, 2);
      c := trunc(new.centro_cirurgico_total * v_g[i] / new.valor_total, 2);
    end if;
    s_a := s_a + a; s_k := s_k + k; s_c := s_c + c;
    b := v_b[i];
    d := v_g[i] - a - b - k - c;
    insert into public.repasse_parcelas (repasse_id, numero, data_prevista, valor, imposto, taxa_interna, custos,
                                         centro_cirurgico, medico, valor_recebido, recebido_em, forma)
    values (new.id, i, v_d[i], v_g[i], a, b, k, c, d, null, null, v_f[i]);
  end loop;
  return null;
end $$;

-- data de pagamento ao médico pela forma da PARCELA
create or replace function interno.tg_repasse_parcela_pagar_medico()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.repasses;
begin
  select * into r from public.repasses where id = new.repasse_id;
  if r.regra <> 'cobranca' and new.pago_medico_em is null then
    new.pago_medico_em := interno.repasse_dia_pagamento(case when coalesce(new.forma, r.forma_pagamento) = 'credito' then 'credito' else 'avista' end,
                                                         r.data_cirurgia, coalesce(new.recebido_em, new.data_prevista));
  end if;
  return new;
end $$;
create or replace function interno.tg_repasse_data_cirurgia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.data_cirurgia is distinct from old.data_cirurgia and new.status <> 'cancelado' and new.regra <> 'cobranca' then
    update public.repasse_parcelas set pago_medico_em = new.data_cirurgia
     where repasse_id = new.id and coalesce(forma, new.forma_pagamento) <> 'credito';
    update public.repasse_custos set pago_em = new.data_cirurgia
     where repasse_id = new.id and valor > 0 and (favorecido_profissional_id is not null or favorecido_nome is not null);
  end if;
  return null;
end $$;
update public.repasse_parcelas p set forma = case when r.forma_pagamento = 'credito' then 'credito' else 'avista' end
  from public.repasses r where r.id = p.repasse_id and p.forma is null and r.status <> 'cancelado';


create or replace view public.repasse_parcelas_medicos with (security_invoker = on) as
with soc as (select s.profissional_id, s.fica_centavo, count(*) over () as n from public.repasse_sociedade s)
select p.id as parcela_id, p.repasse_id, p.numero, p.data_prevista, p.recebido_em, p.pago_medico_em,
       coalesce(soc.profissional_id, r.profissional_id) as profissional_id,
       pr.nome as medico_nome,
       (soc.profissional_id is not null) as dividido,
       r.profissional_id as cirurgiao_id, cir.nome as cirurgiao_nome,
       r.numero as repasse_numero, r.procedimento, r.data_cirurgia, r.forma_pagamento, r.parcelas, r.status, r.regra,
       pa.nome as paciente_nome, pa.nome_social as paciente_nome_social,
       interno.repasse_cota(p.valor, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as valor,
       interno.repasse_cota(p.imposto, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as imposto,
       interno.repasse_cota(p.taxa_interna, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as taxa_interna,
       interno.repasse_cota(p.custos, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as custos,
       interno.repasse_cota(p.centro_cirurgico, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as centro_cirurgico,
       interno.repasse_cota(p.medico, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as medico,
       r.realizada_em, r.fora_clinica,
       coalesce(p.forma, r.forma_pagamento) as forma_parcela
from public.repasse_parcelas p
join public.repasses r on r.id = p.repasse_id
left join soc on exists (select 1 from public.repasse_sociedade x where x.profissional_id = r.profissional_id)
join public.profissionais pr on pr.id = coalesce(soc.profissional_id, r.profissional_id)
join public.profissionais cir on cir.id = r.profissional_id
left join public.pacientes pa on pa.id = r.paciente_id;

create or replace function public.cirurgias_valores(p_data date)
returns table (pessoa text, papel text, paga_no_dia numeric, vai_dia_25 numeric)
language sql stable security definer set search_path = '' as $$
  with medicos as (
    select pm.medico_nome as pessoa, 'medico'::text as papel,
           sum(case when pm.forma_parcela <> 'credito' then pm.medico else 0 end) as paga_no_dia,
           sum(case when pm.forma_parcela = 'credito' then pm.medico else 0 end) as vai_dia_25
    from public.repasse_parcelas_medicos pm
    where pm.data_cirurgia = p_data and pm.realizada_em is not null and pm.status <> 'cancelado' and pm.regra <> 'cobranca'
    group by pm.medico_nome
  ), terceiros as (
    select coalesce(f.nome, c.favorecido_nome, 'Não informado') as pessoa, 'terceiro'::text as papel, sum(c.valor) as paga_no_dia, 0::numeric as vai_dia_25
    from public.repasse_custos c
    join public.repasses r on r.id = c.repasse_id
    left join public.profissionais f on f.id = c.favorecido_profissional_id
    where r.data_cirurgia = p_data and r.realizada_em is not null and r.status <> 'cancelado' and r.regra <> 'cobranca'
      and c.valor > 0 and (c.favorecido_profissional_id is not null or c.favorecido_nome is not null)
    group by 1
  )
  select * from (select * from medicos union all select * from terceiros) x
  where interno.pode_valores_cirurgias()
  order by papel, pessoa
$$;

-- caso real: venda nº 6 (injeção, R$ 1.300 dinheiro + R$ 900 PIX). O caixa (já fechado) continua com R$ 1.300.
update public.orientacao_vendas
   set forma_pagamento = 'misto',
       pagamentos = '[{"forma":"dinheiro","parcelas":1,"valor":1300},{"forma":"pix","parcelas":1,"valor":900}]'::jsonb
 where numero = 6 and status = 'aguardando' and valor_total = 1300 and forma_pagamento = 'dinheiro';
