-- =====================================================================
-- Transformação: FATURAMENTO do Micrologos -> public.contas / conta_itens / lotes
--   PACIENTES_CONTA      -> contas            (de-para: mapa_ids 'conta')
--   FATURAMENTOS         -> conta_itens       (de-para: mapa_ids 'item'; honorários de equipe viram item à parte)
--   COBRANCAS            -> lotes             (número do lote = número da cobrança no Micrologos)
--   FATURAMENTOS_PAGAMENTOS: só fica guardado no "legado" do item (o Micrologos não registra quando o convênio pagou)
-- Decisão da dona (25/11/2026): trazer tudo desde 2016; antes de 2021 = ARQUIVADA (só consulta e relatórios).
-- Depende de 01..04 e da migração 0163. Rodar numa transação com: set local app.migracao = 'on'. Idempotente.
--
-- Situação da conta (o Micrologos não guarda se o convênio pagou; ❓ confirmar com a dona):
--   particular                                     -> paga
--   convênio, em cobrança fechada há mais de 6 meses -> paga (presumido; legado.pagamento = 'presumido')
--   convênio, em cobrança dos últimos 6 meses       -> faturada (enviada, aguardando pagamento)
--   convênio, sem cobrança, últimos 6 meses        -> aberta (falta faturar)
--   convênio, sem cobrança, mais antiga            -> paga (presumido; legado.sem_cobranca = true)
--      (Unimed Gisele/Gelson têm muitas contas fora de cobrança: ❓ como eram cobradas)
-- =====================================================================

-- ---------- parâmetros ----------
create temp table _par as select (now() - interval '6 months')::date as corte_pago, date '2021-01-01' as corte_arquivo;

-- ---------- procedimentos que só aparecem nas contas (fora das tabelas de preço) ----------
insert into public.procedimentos (codigo, tabela, descricao, tipo, observacao)
select btrim(pr.id_produto), '00', legacy_micrologos.txt(pr.descricao),
  case
    when pr.codigo_produto_categoria = '0101' then 'consulta'
    when pr.codigo_produto_categoria in ('0102', '010201') then 'exame'
    when pr.codigo_produto_categoria = '0103' or pr.e_cirurgia = '1' then 'cirurgia'
    when pr.codigo_produto_categoria = '0202' or pr.e_medicamento = '1' then 'medicamento'
    when pr.codigo_produto_categoria like '02%' then 'material'
    when pr.codigo_produto_categoria like '03%' then 'taxa'
    else 'procedimento' end,
  'Código interno do Micrologos (usado em contas antigas).'
from legacy_micrologos.bruto_produtos pr
where btrim(pr.id_produto) in (select distinct btrim(id_produto) from legacy_micrologos.bruto_faturamentos)
  and legacy_micrologos.txt(pr.descricao) is not null
  and not exists (select 1 from public.procedimentos x where x.tabela = '00' and x.codigo = btrim(pr.id_produto));

create temp table _proc as
select p.id, p.codigo as id_produto, nullif(btrim(pr.codigo_tuss), '') as tuss
from public.procedimentos p
left join legacy_micrologos.bruto_produtos pr on btrim(pr.id_produto) = p.codigo
where p.tabela = '00';
create unique index on _proc (id_produto);

-- ---------- itens (com totais) ----------
create temp table _it as
select f.id_faturamento, f.id_paciente_conta, f.id_produto,
  legacy_micrologos.valor(f.valor) as valor, greatest(coalesce(legacy_micrologos.valor(f.quantidade), 1), 1) as qtd,
  coalesce(legacy_micrologos.valor(f.valor_total_staff), 0) as staff,
  legacy_micrologos.novo_id('medico', f.id_medico) as prof,
  coalesce(legacy_micrologos.data(f.data), legacy_micrologos.data(f.data_inclusao)) as data,
  f.procedimento_principal in ('1', 'S') as principal,
  legacy_micrologos.txt(f.matricula_convenio) as matricula, legacy_micrologos.data(f.data_validade_convenio) as validade,
  f.status, legacy_micrologos.txt(f.plano_autorizado) as autorizado, legacy_micrologos.txt(f.observacao) as obs,
  legacy_micrologos.valor(f.valor_original) as valor_original
from legacy_micrologos.bruto_faturamentos f;
create index on _it (id_paciente_conta);
analyze _it;

create temp table _pg as
select btrim(id_faturamento) as id_faturamento,
  sum(legacy_micrologos.valor(valor_recebido)) as recebido,
  sum(coalesce(legacy_micrologos.valor(valor_glosa_revers), 0) + coalesce(legacy_micrologos.valor(valor_glosa_irrevers), 0)) as glosa,
  max(legacy_micrologos.data(data_pagamento)) as pago_em,
  string_agg(distinct legacy_micrologos.txt(justificativa_recurso), ' | ') as recurso
from legacy_micrologos.bruto_faturamentos_pagamentos
where fat_ou_staf = 'F' and nullif(btrim(id_faturamento), '') is not null
group by 1;
create index on _pg (id_faturamento);

create temp table _soma as
select id_paciente_conta, round(sum(round(valor * qtd, 2) + staff), 2) as total, count(*) as n,
  (array_agg(prof order by principal desc, id_faturamento::numeric) filter (where prof is not null))[1] as prof,
  (array_agg(matricula order by principal desc, id_faturamento::numeric) filter (where matricula is not null))[1] as matricula,
  (array_agg(validade order by principal desc, id_faturamento::numeric) filter (where validade is not null))[1] as validade
from _it group by 1;
create index on _soma (id_paciente_conta);
analyze _soma;

-- ---------- contas ----------
create temp table _ct as
select c.*,
  legacy_micrologos.novo_id('paciente', c.id_paciente) as pac,
  coalesce(legacy_micrologos.data(c.data_entrada), legacy_micrologos.data(c.data_inclusao)) as dt,
  pl.id as plano, pl.convenio_id as conv,
  nullif(btrim(c.id_cobranca), '') is not null and btrim(c.id_cobranca) <> '0' and b.id_cobranca is not null as em_cob,
  coalesce(legacy_micrologos.data(b.data_fim), legacy_micrologos.data(b.data_inicio)) as cob_data,
  s.total, s.n, s.prof, s.matricula, s.validade,
  upper(btrim(cid.cid)) as cid_cod,
  count(*) over (partition by nullif(btrim(c.plano_guia), '')) as guia_rep
from legacy_micrologos.bruto_pacientes_conta c
left join public.convenio_planos pl on pl.micrologos_codigo::text = btrim(c.id_convenio)
left join legacy_micrologos.bruto_cobrancas b on btrim(b.id_cobranca) = btrim(c.id_cobranca) and btrim(b.id_cobranca) <> '0'
left join _soma s on s.id_paciente_conta = c.id_paciente_conta
left join legacy_micrologos.bruto_cid cid on btrim(cid.id_cid) = btrim(c.tiss_id_cid_diagnostico) and btrim(c.tiss_id_cid_diagnostico) <> '0';

insert into legacy_micrologos.ocorrencias (entidade, legacy_id, severidade, regra, mensagem)
select 'conta', btrim(id_paciente_conta), 'info', case when pac is null then 'sem_paciente' else 'data_invalida' end,
  'Conta do Micrologos não migrada'
from _ct where (pac is null or dt is null or dt < date '2000-01-01')
  and not exists (select 1 from legacy_micrologos.ocorrencias o where o.entidade = 'conta' and o.legacy_id = btrim(_ct.id_paciente_conta));
delete from _ct where pac is null or dt is null or dt < date '2000-01-01';

create temp table _ct2 as
select c.*,
  case
    when c.conv is null then 'paga'
    when c.em_cob and c.cob_data < (select corte_pago from _par) then 'paga'
    when c.em_cob then 'faturada'
    when c.dt >= (select corte_pago from _par) then 'aberta'
    else 'paga' end as st,
  c.conv is not null and not (c.em_cob and c.cob_data >= (select corte_pago from _par))
    and not (not c.em_cob and c.dt >= (select corte_pago from _par)) as presumido,
  c.dt < (select corte_arquivo from _par) as arq,
  case when c.guia_rep = 1 and nullif(btrim(c.plano_guia), '') is not null then btrim(c.plano_guia)
       else 'ML' || btrim(c.id_paciente_conta) end as guia,
  case when c.em_cob then btrim(c.id_cobranca) end as cob_id
from _ct c;
create index on _ct2 (cob_id);

create temp table _cobagg as
select cob_id, (array_agg(conv order by conv) filter (where conv is not null))[1] as conv,
       count(*) filter (where st = 'faturada') as abertas
from _ct2 where cob_id is not null group by 1;
create index on _cobagg (cob_id);

insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'conta', btrim(id_paciente_conta), gen_random_uuid(), 'public.contas' from _ct2
on conflict (entidade, legacy_id) do nothing;
analyze legacy_micrologos.mapa_ids;

-- ---------- lotes (cobranças) ----------
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'cobranca', btrim(b.id_cobranca), gen_random_uuid(), 'public.lotes'
from legacy_micrologos.bruto_cobrancas b
join _cobagg g on g.cob_id = btrim(b.id_cobranca) and g.conv is not null
on conflict (entidade, legacy_id) do nothing;

insert into public.lotes (id, numero, convenio_id, competencia, status, enviado_em, protocolo, observacoes, arquivado, legado, criado_em)
select m.novo_id, btrim(b.id_cobranca)::bigint, cv.conv,
  date_trunc('month', coalesce(legacy_micrologos.data(b.data_inicio), legacy_micrologos.data(b.data_inclusao)))::date,
  (case when cv.abertas = 0 then 'pago' else 'enviado' end)::public.status_lote,
  coalesce(legacy_micrologos.data(b.data_entrega), legacy_micrologos.data(b.data_fim)),
  legacy_micrologos.txt(b.protocolo),
  nullif(concat_ws(E'\n', 'Cobrança do Micrologos nº ' || btrim(b.id_cobranca),
    'Lote no Micrologos: ' || legacy_micrologos.txt(b.lote), 'Nota: ' || legacy_micrologos.txt(b.nota)), ''),
  coalesce(legacy_micrologos.data(b.data_inicio), legacy_micrologos.data(b.data_inclusao)) < (select corte_arquivo from _par),
  jsonb_strip_nulls(jsonb_build_object('origem', 'Micrologos', 'id_cobranca', btrim(b.id_cobranca),
    'id_cobranca_pai', nullif(nullif(btrim(b.id_cobranca_pai), ''), '0'), 'id_cobranca_original', nullif(nullif(btrim(b.id_cobranca_original), ''), '0'),
    'valor_total_micrologos', legacy_micrologos.valor(b.valor_total), 'quantidade_itens', legacy_micrologos.valor(b.quantidade_itens),
    'periodo', concat_ws(' a ', to_char(legacy_micrologos.data(b.data_inicio), 'DD/MM/YYYY'), to_char(legacy_micrologos.data(b.data_fim), 'DD/MM/YYYY')))),
  coalesce(legacy_micrologos.data_hora(b.data_inclusao), now())
from legacy_micrologos.bruto_cobrancas b
join legacy_micrologos.mapa_ids m on m.entidade = 'cobranca' and m.legacy_id = btrim(b.id_cobranca)
join _cobagg cv on cv.cob_id = btrim(b.id_cobranca) and cv.conv is not null
on conflict (id) do nothing;

select setval('public.lotes_numero_seq', greatest((select coalesce(max(numero), 0) from public.lotes), 1));

insert into public.contas (id, paciente_id, agendamento_id, data_atendimento, convenio_id, plano_id, tipo_guia,
  numero_guia_prestador, numero_guia_operadora, senha_autorizacao, data_autorizacao, validade_senha,
  carteirinha, validade_carteirinha, profissional_id, indicacao_clinica, cid10, status, lote_id,
  valor_total, valor_glosado, valor_pago, recebido_em, observacoes, arquivada, legado, criado_em)
select m.novo_id, c.pac, legacy_micrologos.novo_id('agenda', c.id_agenda), c.dt, c.conv, c.plano,
  case when c.conv is null then 'particular' when c.tiss_tipo_guia = '01' then 'consulta' else 'sadt' end,
  c.guia, legacy_micrologos.txt(c.plano_guia_operadora), legacy_micrologos.txt(c.tiss_senha_autorizacao),
  legacy_micrologos.data(c.tiss_senha_data_autorizacao), legacy_micrologos.data(c.tiss_senha_data_validade),
  c.matricula, c.validade, c.prof, legacy_micrologos.txt(c.tiss_indicacao_clinica), c.cid_cod,
  c.st::public.status_conta, lt.id,
  coalesce(c.total, 0), 0,
  case when c.st = 'paga' then coalesce(c.total, 0) end,
  case when c.st = 'paga' then coalesce(c.cob_data, c.dt)::timestamptz end,
  nullif(concat_ws(E'\n', legacy_micrologos.txt(c.observacao), legacy_micrologos.txt(c.tiss_observacao)), ''),
  c.arq,
  jsonb_strip_nulls(jsonb_build_object('origem', 'Micrologos', 'id_conta', btrim(c.id_paciente_conta),
    'id_cobranca', case when c.em_cob then btrim(c.id_cobranca) end,
    'guia_micrologos', case when c.guia <> btrim(coalesce(c.plano_guia, '')) then legacy_micrologos.txt(c.plano_guia) end,
    'tipo_guia_tiss', nullif(btrim(c.tiss_tipo_guia), ''), 'status_micrologos', nullif(btrim(c.status), ''),
    'pagamento', case when c.presumido then 'presumido' end,
    'sem_cobranca', case when c.conv is not null and not c.em_cob then true end,
    'solicitante', legacy_micrologos.txt(c.tiss_solic_prof_nome))),
  coalesce(legacy_micrologos.data_hora(c.data_inclusao), c.dt::timestamptz)
from _ct2 c
join legacy_micrologos.mapa_ids m on m.entidade = 'conta' and m.legacy_id = btrim(c.id_paciente_conta)
left join legacy_micrologos.mapa_ids lm on lm.entidade = 'cobranca' and lm.legacy_id = c.cob_id
left join public.lotes lt on lt.id = lm.novo_id
on conflict (id) do nothing;

-- ---------- itens ----------
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'item', btrim(i.id_faturamento), gen_random_uuid(), 'public.conta_itens'
from _it i join legacy_micrologos.mapa_ids mc on mc.entidade = 'conta' and mc.legacy_id = btrim(i.id_paciente_conta)
on conflict (entidade, legacy_id) do nothing;
analyze legacy_micrologos.mapa_ids;

-- Os itens antigos entram exatamente como no Micrologos: desliga, só nesta transação, o preço automático,
-- a trava de conta faturada e o recálculo linha a linha (os totais já foram gravados na conta acima).
alter table public.conta_itens disable trigger preco;
alter table public.conta_itens disable trigger trava;
alter table public.conta_itens disable trigger totais;

insert into public.conta_itens (id, conta_id, procedimento_id, tabela, codigo, descricao, data_execucao, quantidade,
  valor_unitario, profissional_id, glosa_valor, legado, criado_em)
select mi.novo_id, mc.novo_id, p.id,
  coalesce(pc.tabela_guia, case when p.tuss is not null then '22' else '00' end),
  coalesce(pc.codigo_guia, p.tuss, btrim(i.id_produto)),
  coalesce(pr.descricao, 'Produto ' || btrim(i.id_produto) || ' do Micrologos'),
  coalesce(i.data, ct.data_atendimento), i.qtd, coalesce(i.valor, 0),
  coalesce(i.prof, ct.profissional_id), 0,
  jsonb_strip_nulls(jsonb_build_object('origem', 'Micrologos', 'id_faturamento', btrim(i.id_faturamento),
    'status_micrologos', nullif(btrim(i.status), ''), 'principal', case when i.principal then true end,
    'valor_original', case when i.valor_original is distinct from i.valor then i.valor_original end,
    'recebido_micrologos', pg.recebido, 'glosa_micrologos', nullif(pg.glosa, 0), 'pago_em', pg.pago_em,
    'recurso', pg.recurso, 'autorizado', i.autorizado, 'observacao', i.obs)),
  coalesce(i.data, ct.data_atendimento)::timestamptz
from _it i
join legacy_micrologos.mapa_ids mi on mi.entidade = 'item' and mi.legacy_id = btrim(i.id_faturamento)
join legacy_micrologos.mapa_ids mc on mc.entidade = 'conta' and mc.legacy_id = btrim(i.id_paciente_conta)
join public.contas ct on ct.id = mc.novo_id
left join _proc p on p.id_produto = btrim(i.id_produto)
left join public.procedimentos pr on pr.id = p.id
left join lateral (select x.codigo_guia, x.tabela_guia from public.precos x
                   where x.procedimento_id = p.id and x.plano_id = ct.plano_id limit 1) pc on true
left join _pg pg on pg.id_faturamento = btrim(i.id_faturamento)
on conflict (id) do nothing;

-- Honorários da equipe (staff: primeiro auxiliar, instrumentador…) do Micrologos: um item por pessoa,
-- no nome dela, ligado ao item de origem (FATURAMENTOS_STAFF_MEDICO; a soma bate com VALOR_TOTAL_STAFF)
create temp table _staff as
select s.id_faturamento_staff_medico as id_staff, s.id_faturamento, legacy_micrologos.valor(s.valor) as valor,
  legacy_micrologos.novo_id('medico', s.id_medico) as prof, legacy_micrologos.txt(cat.descricao) as categoria
from legacy_micrologos.bruto_faturamentos_staff_medico s
left join legacy_micrologos.bruto_medicos_categorias cat on cat.id_medico_categoria = s.id_medico_categoria
where legacy_micrologos.valor(s.valor) > 0;

insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'item_staff', btrim(st.id_staff), gen_random_uuid(), 'public.conta_itens'
from _staff st join _it i on i.id_faturamento = st.id_faturamento and i.staff > 0
join legacy_micrologos.mapa_ids mc on mc.entidade = 'conta' and mc.legacy_id = btrim(i.id_paciente_conta)
on conflict (entidade, legacy_id) do nothing;

insert into public.conta_itens (id, conta_id, procedimento_id, tabela, codigo, descricao, data_execucao, quantidade,
  valor_unitario, profissional_id, glosa_valor, legado, criado_em)
select ms.novo_id, mc.novo_id, null, '00', 'HONOR',
  coalesce(st.categoria, 'Honorários da equipe') || ' — ' || coalesce(pr.descricao, 'produto ' || btrim(i.id_produto)),
  coalesce(i.data, ct.data_atendimento), 1, st.valor, coalesce(st.prof, i.prof, ct.profissional_id), 0,
  jsonb_strip_nulls(jsonb_build_object('origem', 'Micrologos', 'id_faturamento', btrim(i.id_faturamento),
    'id_staff', btrim(st.id_staff), 'staff', true, 'categoria', st.categoria)),
  coalesce(i.data, ct.data_atendimento)::timestamptz
from _staff st
join _it i on i.id_faturamento = st.id_faturamento and i.staff > 0  -- só o que o Micrologos soma na conta
join legacy_micrologos.mapa_ids ms on ms.entidade = 'item_staff' and ms.legacy_id = btrim(st.id_staff)
join legacy_micrologos.mapa_ids mc on mc.entidade = 'conta' and mc.legacy_id = btrim(i.id_paciente_conta)
join public.contas ct on ct.id = mc.novo_id
left join _proc p on p.id_produto = btrim(i.id_produto)
left join public.procedimentos pr on pr.id = p.id
on conflict (id) do nothing;

-- total da conta = soma dos itens gravados (diferença de centavos de arredondamento do Micrologos)
update public.contas c set valor_total = s.total,
  valor_pago = case when c.status = 'paga' then s.total else c.valor_pago end
from (select i.conta_id, sum(i.valor_total) as total from public.conta_itens i
      join legacy_micrologos.mapa_ids m on m.entidade = 'conta' and m.novo_id = i.conta_id group by 1) s
where s.conta_id = c.id and c.valor_total is distinct from s.total;

alter table public.conta_itens enable trigger preco;
alter table public.conta_itens enable trigger trava;
alter table public.conta_itens enable trigger totais;

-- ---------- conferência ----------
analyze public.contas; analyze public.conta_itens; analyze public.lotes;
select extract(year from c.data_atendimento)::int as ano, count(*) as contas, count(*) filter (where c.arquivada) as arquivadas,
  count(*) filter (where c.status = 'aberta') as abertas, count(*) filter (where c.status = 'faturada') as aguardando,
  count(*) filter (where c.status = 'paga') as pagas, round(sum(c.valor_total)) as total
from public.contas c where c.legado ? 'id_conta' group by 1 order by 1;
