-- =====================================================================
-- 0158 — Data da cirurgia pela agenda + "Cirurgias do dia" com check de REALIZADA (decisões do Dr. Gelson, 25/11/2026)
-- =====================================================================
-- * A venda nasce SEM data de cirurgia (o paciente ainda vai fazer exames). A Alessandra marca a data depois, pela agenda
--   da Orientação Cirúrgica (ou pela tela de vendas), com a caixinha "Fora da clínica" quando for operar fora (ex.: Barra).
-- * A data (e "fora da clínica") vale para venda, repasse e mapa: a venda é a fonte; o repasse acompanha sozinho.
-- * Tela "Cirurgias do dia": Alessandra, Luciano/administração ou os sócios (Dr. Gelson, Dr. Max) dão o check
--   "Realizada" — no mesmo dia ou no seguinte. SEM check ninguém recebe (nem terceiros) e não se emite nota.
-- * O repasse pode ficar sem data enquanto a cirurgia não tem dia marcado (data_cirurgia passa a aceitar vazio).
-- =====================================================================

alter table public.orientacao_vendas
  add column fora_clinica boolean not null default false,
  add column realizada_em timestamptz,
  add column realizada_por uuid references public.profissionais(id);
create index orientacao_vendas_cirurgia_idx on public.orientacao_vendas (data_cirurgia);
create index orientacao_vendas_realizada_por_idx on public.orientacao_vendas (realizada_por);

alter table public.repasses
  alter column data_cirurgia drop not null,
  add column fora_clinica boolean not null default false,
  add column realizada_em timestamptz,
  add column realizada_por uuid references public.profissionais(id);
create index repasses_realizada_por_idx on public.repasses (realizada_por);

-- quem pode dar o check / ver o mapa
create or replace function interno.pode_cirurgias_dia()
returns boolean language sql stable security definer set search_path = '' as $$
  select interno.atende_orientacao() or interno.tem_funcao('faturamento', 'admin')
      or exists (select 1 from public.repasse_sociedade s where s.profissional_id = interno.profissional_atual())
$$;
-- quem pode ver os valores (a Orientação vê só o valor da venda, sem divisão)
create or replace function interno.pode_valores_cirurgias()
returns boolean language sql stable security definer set search_path = '' as $$
  select interno.tem_funcao('faturamento', 'admin')
      or exists (select 1 from public.repasse_sociedade s where s.profissional_id = interno.profissional_atual())
$$;
revoke execute on function interno.pode_cirurgias_dia(), interno.pode_valores_cirurgias() from public, anon;
grant execute on function interno.pode_cirurgias_dia(), interno.pode_valores_cirurgias() to authenticated;

create or replace function interno.tg_orientacao_venda_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_fat boolean := interno.tem_funcao('faturamento', 'admin');
begin
  if new.forma_pagamento <> 'credito' then new.parcelas := 1; end if;
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
          new.repasse_id, new.conferido_por, new.conferido_em, new.tipo, new.anestesista_direto)
         is not distinct from
         (old.paciente_id, old.profissional_id, old.procedimento_id, old.procedimento, old.lente_id, old.convenio_id, old.agendamento_id,
          old.data_pagamento, old.valor_total, old.forma_pagamento, old.parcelas, old.observacoes, old.status, old.motivo,
          old.repasse_id, old.conferido_por, old.conferido_em, old.tipo, old.anestesista_direto) then
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
      new.forma_pagamento, new.parcelas, new.data_pagamento, new.tipo)
     is distinct from
     (old.paciente_id, old.profissional_id, old.procedimento_id, old.procedimento, old.lente_id, old.valor_total,
      old.forma_pagamento, old.parcelas, old.data_pagamento, old.tipo) then
    raise exception 'Os dados da venda são corrigidos por quem a registrou. Devolva com o motivo.';
  end if;
  new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  return new;
end $$;

-- venda → repasse: data, "fora da clínica" e realização acompanham (a venda é a fonte)
create or replace function interno.tg_venda_repasse_cirurgia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.repasse_id is not null and (
       new.repasse_id is distinct from old.repasse_id
       or (new.data_cirurgia, new.fora_clinica, new.realizada_em) is distinct from (old.data_cirurgia, old.fora_clinica, old.realizada_em)) then
    update public.repasses set data_cirurgia = new.data_cirurgia, fora_clinica = new.fora_clinica,
           realizada_em = new.realizada_em, realizada_por = new.realizada_por
     where id = new.repasse_id and status <> 'cancelado';
  end if;
  return null;
end $$;
create trigger repasse_cirurgia after update on public.orientacao_vendas
  for each row execute function interno.tg_venda_repasse_cirurgia();
revoke execute on function interno.tg_venda_repasse_cirurgia() from public, anon, authenticated;

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
       r.realizada_em, r.fora_clinica
from public.repasse_parcelas p
join public.repasses r on r.id = p.repasse_id
left join soc on exists (select 1 from public.repasse_sociedade x where x.profissional_id = r.profissional_id)
join public.profissionais pr on pr.id = coalesce(soc.profissional_id, r.profissional_id)
join public.profissionais cir on cir.id = r.profissional_id
left join public.pacientes pa on pa.id = r.paciente_id;

-- check "Realizada" (ou desfazer). p_venda OU p_repasse (repasse lançado sem venda da orientação)
create or replace function public.cirurgia_realizada(p_venda uuid, p_repasse uuid, p_realizada boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_data date;
begin
  if not interno.pode_cirurgias_dia() then raise exception 'Você não pode marcar cirurgias como realizadas.'; end if;
  if p_venda is not null then
    select data_cirurgia into v_data from public.orientacao_vendas where id = p_venda and status <> 'cancelada';
    if not found then raise exception 'Venda não encontrada ou cancelada.'; end if;
  else
    select data_cirurgia into v_data from public.repasses where id = p_repasse and status <> 'cancelado';
    if not found then raise exception 'Repasse não encontrado ou cancelado.'; end if;
  end if;
  if p_realizada and v_data is null then raise exception 'Marque primeiro a data da cirurgia.'; end if;
  if p_realizada and v_data > current_date then raise exception 'A cirurgia está marcada para %: só dá para marcar como realizada a partir desse dia.', to_char(v_data, 'DD/MM/YYYY'); end if;
  perform set_config('app.cirurgia_check', 'on', true);
  if p_venda is not null then
    update public.orientacao_vendas
       set realizada_em = case when p_realizada then now() end,
           realizada_por = case when p_realizada then interno.profissional_atual() end
     where id = p_venda;
  else
    update public.repasses
       set realizada_em = case when p_realizada then now() end,
           realizada_por = case when p_realizada then interno.profissional_atual() end
     where id = p_repasse;
  end if;
  perform set_config('app.cirurgia_check', '', true);
end $$;

-- mapa do dia (e pendências): uma linha por cirurgia — venda da orientação ou repasse lançado sem venda
create or replace function public.cirurgias_lista(p_data date default null, p_pendentes boolean default false)
returns table (venda_id uuid, repasse_id uuid, venda_numero bigint, repasse_numero bigint, data_cirurgia date, fora_clinica boolean,
               paciente text, prontuario bigint, medico text, procedimento text, tipo text, forma_pagamento text, parcelas int,
               valor_total numeric, situacao_venda text, realizada_em timestamptz, realizada_por text)
language sql stable security definer set search_path = '' as $$
  with base as (
    select v.id as venda_id, v.repasse_id, v.numero as venda_numero, r.numero as repasse_numero, v.data_cirurgia, v.fora_clinica,
           coalesce(pa.nome_social, pa.nome) as paciente, pa.numero_prontuario::bigint as prontuario, m.nome as medico, v.procedimento, v.tipo,
           v.forma_pagamento, v.parcelas, v.valor_total, v.status as situacao_venda, v.realizada_em, rp.nome as realizada_por
    from public.orientacao_vendas v
    join public.pacientes pa on pa.id = v.paciente_id
    join public.profissionais m on m.id = v.profissional_id
    left join public.repasses r on r.id = v.repasse_id
    left join public.profissionais rp on rp.id = v.realizada_por
    where v.status <> 'cancelada'
    union all
    select null, r.id, null, r.numero, r.data_cirurgia, r.fora_clinica,
           coalesce(pa.nome_social, pa.nome), pa.numero_prontuario::bigint, m.nome, r.procedimento, 'cirurgia',
           r.forma_pagamento, r.parcelas, r.valor_total, null, r.realizada_em, rp.nome
    from public.repasses r
    join public.profissionais m on m.id = r.profissional_id
    left join public.pacientes pa on pa.id = r.paciente_id
    left join public.profissionais rp on rp.id = r.realizada_por
    where r.status <> 'cancelado' and r.regra <> 'cobranca'
      and not exists (select 1 from public.orientacao_vendas v where v.repasse_id = r.id)
  )
  select * from base
  where interno.pode_cirurgias_dia()
    and case when p_pendentes then (data_cirurgia is null or (data_cirurgia < current_date and realizada_em is null))
             else data_cirurgia = p_data end
  order by data_cirurgia nulls first, medico, paciente
$$;

-- quanto cada pessoa recebe pelas cirurgias REALIZADAS de um dia (só faturamento/administração e sócios)
create or replace function public.cirurgias_valores(p_data date)
returns table (pessoa text, papel text, paga_no_dia numeric, vai_dia_25 numeric)
language sql stable security definer set search_path = '' as $$
  with medicos as (
    select pm.medico_nome as pessoa, 'medico'::text as papel,
           sum(case when pm.forma_pagamento <> 'credito' then pm.medico else 0 end) as paga_no_dia,
           sum(case when pm.forma_pagamento = 'credito' then pm.medico else 0 end) as vai_dia_25
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

revoke execute on function public.cirurgia_realizada(uuid, uuid, boolean), public.cirurgias_lista(date, boolean), public.cirurgias_valores(date) from public, anon;
grant execute on function public.cirurgia_realizada(uuid, uuid, boolean), public.cirurgias_lista(date, boolean), public.cirurgias_valores(date) to authenticated;

-- a venda nº 3 (vitrectomia) já tinha data: o repasse acompanha (sem marcar realizada)
