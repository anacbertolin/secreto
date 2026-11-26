-- =====================================================================
-- Transformação: convênios, planos, procedimentos, preços e códigos de hospital, direto do banco do Micrologos.
--   CONVENIOS_MESTRE (convênio) + CONVENIOS_INFO (dados TISS do prestador) -> public.convenios
--   CONVENIOS (plano)                                    -> public.convenio_planos
--   PRODUTOS (usados nas tabelas de preço)               -> public.procedimentos (tabela '00', código interno)
--   CONVENIOS_PRECOS × PRECOS_PRODUTOS(_PRODUTOS)        -> public.precos (por plano)
--   UNIDADES_PLANOS_INFO                                 -> public.hospital_convenio_codigos
-- Idempotente (não duplica). Rodar numa transação com: set local app.migracao = 'on';
--
-- Regras:
-- - Ficam de fora os "convênios" particulares do Micrologos (0 Sem Convênio, 1 Particular, 13 Particular Appai,
--   14 Particular Assist, 19 convênio com nome de pessoa, 24 Livre Escolha): no sistema novo, particular = sem convênio,
--   com a tabela de preços particular (migração 0086).
-- - Inativos pela dona (não atendidos mais): Dort Prev, Medprev, Appai, Assist, Golden Cross, Golden, Assim, Notre Dame
--   e Unimed Pedro, além do que já estiver inativo no Micrologos. Entram como inativos (histórico de contas).
-- - Unimed (cód. 8, 10, 15, 22, 26, 29) foi criada PROVISÓRIA só com o nome (migração 0176, para a agenda): aqui ela é
--   completada (TISS, planos, preços) pelo código, sem duplicar. Atenção: agendamentos já feitos com ela não têm plano.
-- - Bradesco Saúde (cód. 2) já foi cadastrado à mão (migração 0151, a partir da tela). Aqui nada dele é sobrescrito;
--   só entram as linhas que faltarem. Serve de conferência entre a tela e o banco.
-- - convenios.tiss guarda os campos principais e, em "micrologos", a configuração TISS completa do Micrologos
--   (sem senhas: AUTORIZADOR_SENHA, AUTORIZADOR_HTML, LOGIN, SENHA e WS_* ficam de fora).
-- - Ordem das tabelas de um plano: prioridade e depois a data em que a tabela foi ligada ao plano. Se o mesmo
--   procedimento estiver em duas tabelas do plano, vale a primeira (❓ conferir na prática).
-- - Tabela TISS da guia: a "sigla TISS" da tabela de preço (22, 98, 20, 19, 00); código da guia: o "TUSS/C.Esp" do
--   item da tabela (ou o TUSS do procedimento).
-- =====================================================================

create temp table _mestre as
select m.*, i.registro_ans as i_ans, i.cod_beneficiario as i_codigo, i.cnpj_prestador as i_cnpj, i.tipo_prestador as i_tipo,
       i.nome_prestador as i_nome, i.codigo_cnes as i_cnes, i.lote as i_lote, i.nome_operadora as i_operadora,
       (to_jsonb(m) - '{autorizador_senha,autorizador_html,_carga_id,_linha}'::text[])
         || coalesce(jsonb_build_object('info', to_jsonb(i) - '{login,senha,ws_cod_operadora,ws_end_elegebilidade,ws_end_solicitacao,ws_end_status,ws_end_cancelamento,_carga_id,_linha}'::text[]), '{}') as bruto
from legacy_micrologos.bruto_convenios_mestre m
left join legacy_micrologos.bruto_convenios_info i on i.id_convenio_mestre = m.id_convenio_mestre
where m.id_convenio_mestre::int not in (0, 1, 13, 14, 19, 24);

-- ---------- convênios ----------
insert into public.convenios (nome, registro_ans, codigo_prestador, versao_tiss, ativo, micrologos_codigo, observacoes_faturamento, tiss, descontos)
select
  legacy_micrologos.txt(m.descricao),
  case when legacy_micrologos.so_digitos(m.i_ans) is not null then lpad(legacy_micrologos.so_digitos(m.i_ans), 6, '0') end,
  coalesce(legacy_micrologos.txt(m.i_codigo), legacy_micrologos.txt(m.cod_credenciado)),
  case when m.tiss_versaopadrao in ('4.01.00','4.02.00','4.03.00','3.02.01') then m.tiss_versaopadrao end,
  coalesce(m.inativo, '0') not in ('1', 'S') and m.id_convenio_mestre::int not in (3, 4, 5, 6, 7, 9, 11, 18, 33),
  m.id_convenio_mestre::int,
  'Importado do banco do Micrologos (cópia de 24/11/2026).',
  jsonb_build_object(
    'prestador', jsonb_build_object(
       'tipo', case when m.i_tipo = 'F' then 'PF' else 'PJ' end,
       'identificacao', case m.tiss_cpfcnpj_codoper when 'C' then 'cnpj_cpf' else 'codigo_operadora' end,
       'codigo_operadora', legacy_micrologos.txt(m.i_codigo),
       'cnpj', case when legacy_micrologos.so_digitos(m.i_cnpj) is not null then lpad(legacy_micrologos.so_digitos(m.i_cnpj), case when m.i_tipo = 'F' then 11 else 14 end, '0') end,
       'nome', legacy_micrologos.txt(m.i_nome),
       'cnes', legacy_micrologos.txt(m.i_cnes)),
    'versao', m.tiss_versaopadrao,
    'formato_data', m.tiss_tissnet_data,
    'formato_data_hora', m.tiss_tissnet_datahora,
    'xml_version', m.tiss_xml_version,
    'digitos_lote', m.tiss_qnt_digitos_transacao::numeric::int,
    'digitos_lote_arquivo', m.tiss_qnt_digitos_nomearq::numeric::int,
    'digitos_guia', m.tiss_tam_num_guia::numeric::int,
    'digitos_codigo_tiss', m.tiss_codigo_produto_tam::numeric::int,
    'max_procedimentos_guia', nullif(m.tiss_qnt_proc_na_guia::numeric::int, 0),
    'numeracao_guia', case when m.guia_automatica = '1' then 'automatica' else 'manual' end,
    'numeracao_unica', m.tiss_sequencia_unica = '1',
    'consulta_em_sadt', m.tiss_consulta_na_guia_sadt = '1',
    'honorarios_se_cirurgia', m.tiss_sadt_guia_honorario = '1',
    'mostra_fator', m.tiss_mostra_red_acres = '1',
    'guia_operadora_igual_prestador', m.tiss_guiaoperad_igual_guiaprest = '1',
    'observacao_descricao_cid', m.tiss_cid_na_obs = '1',
    'hash_minusculo', m.tiss_hash_minusculo = '1',
    'ultimo_lote', m.i_lote::numeric::int,
    'fonte', 'banco do Micrologos (CONVENIOS_MESTRE + CONVENIOS_INFO), cópia de 24/11/2026; ❓ conferir com a tela e com XML real',
    'micrologos', m.bruto),
  jsonb_build_object(
    'cirurgia', jsonb_build_object('sobre_maior_valor', m.ccirurg_percent_sobremaior = '1',
        '2', m.ccirurg_perc_proc2::numeric, '3', m.ccirurg_perc_proc3::numeric, '4', m.ccirurg_perc_proc4::numeric, '5', m.ccirurg_perc_proc5::numeric),
    'exames_mesma_area', jsonb_build_object('2', m.exames_perc_proc2::numeric, '3', m.exames_perc_proc3::numeric, '4', m.exames_perc_proc4::numeric, '5', m.exames_perc_proc5::numeric),
    'exames_areas_diferentes', jsonb_build_object('2', m.exames_perc_proc2_areasdif::numeric, '3', m.exames_perc_proc3_areasdif::numeric, '4', m.exames_perc_proc4_areasdif::numeric, '5', m.exames_perc_proc5_areasdif::numeric),
    'exames_sobre_maior_valor', m.exames_percent_sobremaior = '1',
    'unidade', 'percentual do valor usado no cálculo do preço')
from _mestre m
where legacy_micrologos.txt(m.descricao) is not null
-- Convênios PROVISÓRIOS (migração 0176: Unimed criada só com o nome, para a agenda, em 26/11/2026) são COMPLETADOS
-- aqui pelo código do Micrologos (o nome fica o que a equipe já usa). Os demais já existentes ficam como estão.
on conflict (micrologos_codigo) do update set
  registro_ans = excluded.registro_ans, codigo_prestador = excluded.codigo_prestador, versao_tiss = excluded.versao_tiss,
  ativo = excluded.ativo, observacoes_faturamento = excluded.observacoes_faturamento, tiss = excluded.tiss,
  descontos = excluded.descontos
where public.convenios.tiss ? 'provisorio';

-- No convênio cadastrado à mão (Bradesco), guarda a configuração bruta do Micrologos para conferência
update public.convenios c set tiss = c.tiss || jsonb_build_object('micrologos', m.bruto)
from _mestre m where c.micrologos_codigo = m.id_convenio_mestre::int and not (c.tiss ? 'micrologos');

-- ---------- planos ----------
insert into public.convenio_planos (convenio_id, nome, codigo, ativo, micrologos_codigo, mascara_carteirinha)
select distinct on (c.id, legacy_micrologos.txt(p.descricao))
  c.id, legacy_micrologos.txt(p.descricao), btrim(p.id_convenio),
  c.ativo and coalesce(p.inativo, '0') not in ('1', 'S'),
  p.id_convenio::numeric::int, legacy_micrologos.txt(p.mascara)
from legacy_micrologos.bruto_convenios p
join public.convenios c on c.micrologos_codigo = p.id_convenio_mestre::numeric::int
where legacy_micrologos.txt(p.descricao) is not null
order by c.id, legacy_micrologos.txt(p.descricao), p.id_convenio::numeric::int
on conflict do nothing;

-- ---------- procedimentos usados nas tabelas de preço ----------
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
  'Código interno do Micrologos (banco, cópia de 24/11/2026).'
from legacy_micrologos.bruto_produtos pr
where btrim(pr.id_produto) in (select btrim(id_produto) from legacy_micrologos.bruto_precos_produtos_produtos)
  and legacy_micrologos.txt(pr.descricao) is not null
  and not exists (select 1 from public.procedimentos x where x.tabela = '00' and x.codigo = btrim(pr.id_produto));

-- ---------- preços por plano ----------
with ligacao as (
  select cp.id_convenio::numeric::int as plano_mic, cp.id_preco_produto::numeric::int as tab,
         row_number() over (partition by cp.id_convenio order by coalesce(cp.prioridade::numeric, 0), cp.data_inclusao, cp.id_preco_produto::numeric) as ordem
  from legacy_micrologos.bruto_convenios_precos cp
), item as (
  select l.plano_mic, l.ordem, btrim(pp.id_produto) as prod, pp.valor, pp.autorizacao_obrigatoria,
         coalesce(nullif(btrim(pp.codigo_amb), ''), nullif(btrim(pr.codigo_tuss), '')) as cod_guia,
         nullif(btrim(t.tiss_sigla_tabela), '') as sigla,
         btrim(t.id_preco_produto) || ' ' || legacy_micrologos.txt(t.descricao) || coalesce(' (' || to_char(legacy_micrologos.data(t.data_referencia), 'DD/MM/YYYY') || ')', '') as nome_tab,
         coalesce(legacy_micrologos.data(t.data_referencia), date '2000-01-01') as vig
  from ligacao l
  join legacy_micrologos.bruto_precos_produtos t on t.id_preco_produto::numeric::int = l.tab
  join legacy_micrologos.bruto_precos_produtos_produtos pp on pp.id_preco_produto = t.id_preco_produto
  join legacy_micrologos.bruto_produtos pr on btrim(pr.id_produto) = btrim(pp.id_produto)
  where legacy_micrologos.valor(pp.valor) is not null
), escolhido as (
  select distinct on (plano_mic, prod) * from item order by plano_mic, prod, ordem
)
insert into public.precos (procedimento_id, convenio_id, plano_id, valor, codigo_guia, tabela_guia, necessita_autorizacao, tabela_preco, vigente_de)
select p.id, pl.convenio_id, pl.id, legacy_micrologos.valor(e.valor), e.cod_guia,
       case when e.sigla in ('22','19','20','18','00','98') then e.sigla
            when e.cod_guia like '9%' then '20' else '22' end,
       e.autorizacao_obrigatoria = '1', e.nome_tab, e.vig
from escolhido e
join public.convenio_planos pl on pl.micrologos_codigo = e.plano_mic
join public.procedimentos p on p.tabela = '00' and p.codigo = e.prod
where not exists (select 1 from public.precos x where x.procedimento_id = p.id and x.convenio_id = pl.convenio_id and x.plano_id = pl.id);

-- ---------- código de cada hospital em cada convênio ----------
insert into public.hospital_convenio_codigos (hospital_id, convenio_id, codigo_operadora, cnes)
select distinct on (h.id, c.id) h.id, c.id, legacy_micrologos.txt(u.cod_prestador_operadora),
       nullif(legacy_micrologos.so_digitos(u.codigo_cnes), '')
from legacy_micrologos.bruto_unidades_planos_info u
join public.hospitais h on h.micrologos_codigo = u.id_unidade::numeric::int
join public.convenios c on c.micrologos_codigo = u.id_convenio_mestre::numeric::int
where legacy_micrologos.txt(u.cod_prestador_operadora) is not null
on conflict (hospital_id, convenio_id) do nothing;

-- ---------- conferência ----------
select
  (select count(*) from public.convenios)                         as convenios,
  (select count(*) from public.convenios where ativo)             as convenios_ativos,
  (select count(*) from public.convenio_planos)                   as planos,
  (select count(*) from public.procedimentos where tabela = '00') as procedimentos,
  (select count(*) from public.precos where convenio_id is not null) as precos_convenio,
  (select count(*) from public.precos where necessita_autorizacao) as com_autorizacao,
  (select count(*) from public.hospital_convenio_codigos)         as codigos_hospital;
