-- =====================================================================
-- 0151 — Convênio Bradesco Saúde (cód. 2 no Micrologos)
-- Fonte: "Convenio-BradescoSaude-2026-11-24.md" (cópia só leitura do Micrologos, feita pela dona
-- com o Claude do computador) e "K-hospitais-por-convenio.md". Guardados em
-- docs/micrologos/mapeamento-telas/. Regra de ouro: replicar exatamente o Micrologos.
-- Reexecutável (não duplica).
-- =====================================================================

-- CNES aparece com 6 dígitos em alguns XML aceitos (ex.: Barra Day 102881): aceitar 1 a 7 dígitos, sem completar.
alter table public.hospitais drop constraint if exists hospitais_cnes_check;
alter table public.hospitais add constraint hospitais_cnes_check check (cnes ~ '^[0-9]{1,7}$');
alter table public.hospital_convenio_codigos drop constraint if exists hospital_convenio_codigos_cnes_check;
alter table public.hospital_convenio_codigos add constraint hospital_convenio_codigos_cnes_check check (cnes ~ '^[0-9]{1,7}$');

-- ---------- Convênio ----------
insert into public.convenios (nome, registro_ans, codigo_prestador, versao_tiss, ativo, micrologos_codigo, observacoes_faturamento, tiss, descontos)
values ('Bradesco Saúde', '005711', '0000110502', '4.03.00', true, 2,
  'Copiado do Micrologos em 24/11/2026. XML separado do Bradesco Saúde Operadora (ANS 421715). Lote em .zip no portal.',
  jsonb_build_object(
    'prestador', jsonb_build_object('tipo', 'PJ', 'identificacao', 'codigo_operadora', 'codigo_operadora', '0000110502',
                                    'cnpj', '05894660000187', 'nome', 'Consumed Consultorios Medicos Ltda', 'cnes', '3176479'),
    'versao', '4.03.00', 'encoding', 'ISO-8859-1', 'formato_data', 'aaaa-mm-dd', 'formato_data_hora', 'aaaa-mm-ddT99:99:99',
    'cbo_2011', true, 'crm_completo', true, 'codigo_prod_serv', 'brasindice',
    'digitos_lote', 12, 'digitos_lote_arquivo', null, 'digitos_guia', 0, 'digitos_senha', null, 'digitos_cnes', null, 'digitos_codigo_tiss', 10,
    'max_procedimentos_guia', null, 'max_guias_lote', null,
    'numeracao_guia', 'manual', 'numeracao_unica', false,
    'exige_zip', true,
    'consulta_em_sadt', false,
    'honorarios_se_cirurgia', true,
    'honorarios_obs', 'A caixa "Utiliza Guia de Honorário se Cirurgia" está desmarcada, mas a cirurgia sai em Honorários pela Classificação de Guia "Cirurgia" = Honorário individual (XML reais de 22/11).',
    'honorarios_somente_cirurgicos', true,
    'consulta_categoria_com_tipo_diferente_vai_sadt', true,
    'sessao_em_serie', true,
    'usa_codigos_medicos_cadastro', true,
    'mostra_fator', true,
    'data_autorizacao_vazia_usa_data_conta', true,
    'guia_operadora_igual_prestador', false,
    'guia_principal_mesmo_numero', false,
    'nao_preenche_guia_principal', false,
    'nao_escreve_equipe_guia_medico_principal', true,
    'uma_guia_toda_equipe', false,
    'observacao_descricao_cid', false,
    'hash_minusculo', false,
    'ultimo_lote', 1676,
    'tipo_faturamento', '1 ou + contas por agenda',
    'fonte', 'Micrologos, abas 1ª/2ª/Outras Config. TISS e Complementares, 24/11/2026'),
  jsonb_build_object(
    'cirurgia', jsonb_build_object('sobre_maior_valor', true, '2', 70, '3', 50, '4', 50, '5', 50),
    'exames_mesma_area', jsonb_build_object('2', 50, '3', 50, '4', 50, '5', 50),
    'exames_areas_diferentes', jsonb_build_object('2', 50, '3', 50, '4', 50, '5', 50),
    'exames_sobre_maior_valor', false,
    'exames_desconsidera_qtd_maior_1', false,
    'unidade', 'percentual do valor usado no cálculo do preço (ex.: 2º procedimento = 70% do valor)'))
on conflict (micrologos_codigo) do nothing;

-- ---------- Planos ----------
insert into public.convenio_planos (convenio_id, nome, codigo, ativo, micrologos_codigo, mascara_carteirinha)
select c.id, v.nome, v.cod, true, v.mic, '999999999999999'
from public.convenios c, (values ('Bradesco Empresa', '4', 4), ('Bradesco Individual', '5', 5)) v(nome, cod, mic)
where c.micrologos_codigo = 2
on conflict (micrologos_codigo) do nothing;

-- ---------- Procedimentos (código interno do Micrologos, tabela própria '00') que ainda não existem ----------
insert into public.procedimentos (codigo, tabela, descricao, tipo, observacao)
select v.c, '00', v.d, v.t, 'Código interno do Micrologos. Incluído com o cadastro do Bradesco Saúde (25/11/2026).'
from (values ('1','Consulta','consulta'),('2','Tonometria','exame'),('3','Biometria','exame'),('4','Paquimetria Ultrassonica','exame'),('5','Mapeamento de Retina','exame'),('6','Ceratoscopia Corneana','exame'),('7','Microscopia Especular','exame'),('10','Gonioscopia','exame'),('11','Retinografia','exame'),('12','Angiografia','exame'),('13','Ecobiometria','exame'),('15','Campo Visual Computadorizado','exame'),('17','Fotocoagulação A Laser','procedimento'),('19','Facectomia Com Implante de Lio','cirurgia'),('20','Potencial de Acuidade Visual','exame'),('22','Corpo Estranho da Cornea - Retirada','exame'),('23','Teste do Reflexo Vermelho','exame'),('24','Capsulotomia Yag Ou Cirurgica','procedimento'),('25','Curva Tensional Diaria-binocular','exame'),('27','Consulta Em Consultorio','consulta'),('28','Colirio Fenilefrina','medicamento'),('29','Colirio Anestalcon','medicamento'),('30','Colirio Fluoresceina','medicamento'),('31','Colirio Mydriacyl','medicamento'),('32','Colirio Visonest','medicamento'),('33','Iridotomia (yag Laser)','exame'),('36','Ultrassonografia Bilateral','exame'),('41','Vitrectomia Vias Pars Plana','cirurgia'),('42','Retinopexia Com Introflexão Escleral','cirurgia'),('43','Endolaser/ Endodiatermia','cirurgia'),('44','Implante de Silicone Intravitreo','cirurgia'),('45','Infusão de Perfluocarbono','cirurgia'),('46','Pterigio-exerese','cirurgia'),('48','Fotocoagulação A Laser Ao','procedimento'),('49','Implante Secundario/explante/fixacao Escleral Ou Iriana','cirurgia'),('50','Vitrectomia Anterior','cirurgia'),('54','Epilação de Cílios','cirurgia'),('61','Tomografia de Coerencia Optica Monocular','exame'),('68','Palpebra- Reconstruçao Parcial Com Ou Sem Resseccao de Tumor','cirurgia'),('69','Resseccao de Tumores Palpebrais','cirurgia'),('80','Membranectomia Epi Ou Sub- Retiniana','cirurgia'),('87','Autotransplante Conjuntival','cirurgia'),('100','Exame de Motilidade Ocular (teste Ortoptico)- Binocular','exame'),('107','Estrabismo Ciclo Vertical/transposicao Monocular','cirurgia'),('108','Estrabismo Horizontal Monocular','cirurgia'),('112','Cirurgias Fistulizantes Antiglaucomatosas','cirurgia'),('113','Cirurgias Fistulizantes Com Implantes Valvulares','cirurgia'),('114','Cirurgia Com Sutura Ajustavel','cirurgia'),('115','Avaliação de Vias Lacrimais ( Teste de Schirmer ) Monocular','exame'),('120','Troca Fluido Gasosa','cirurgia'),('121','Infusao de Gas Expansor','cirurgia'),('125','Sondagem das Vias Lacrimais - Com Ou Sem Lavagem','exame'),('127','Goniotomia Ou Trabeculotomia','cirurgia'),('201','Exercicios de Ortoptica Por Sessao','exame'),('204','Cirurgia Antiglaucomatosa Via Angular Com Implante de Stent','cirurgia'),('205','Fotoablacao de Superficie Convencional - Prk','cirurgia'),('206','Delaminacao Corneana Com Fotoablacao Estromal - Lasik','cirurgia'),('223','Avaliacao Orbito-palpebral-exoftalmometria - Binocular','exame')) v(c, d, t)
where not exists (select 1 from public.procedimentos p where p.tabela = '00' and p.codigo = v.c);

-- ---------- Preços: tabelas do Micrologos e ligação plano → tabelas (na ordem da grade do plano) ----------
-- Se o mesmo procedimento estiver em duas tabelas do mesmo plano, vale a 1ª da grade
-- (só acontece com 54 Epilação de Cílios no plano 4: tabela 31 = 55,39 e tabela 4 = 54,57 — a confirmar com a dona).
-- Código na guia: TUSS (tabela 22); colírios 90xxxxxx como medicamento (tabela 20, a confirmar com XML real).
with tab(num, nome, vig) as (values (31,'31 Bradesco Cirurgia (26/02/2015)',date '2015-02-26'),(4,'4 Bradesco Empresa (26/02/2016)',date '2016-02-26'),(3,'3 Bradesco Individual (26/02/2016)',date '2016-02-26'),(20,'20 Medicamentos (23/04/2015)',date '2015-04-23')),
     item(num, c, valor, guia, autoriz) as (values (31,'87',223.180,'30303010',false),(31,'204',827.840,'30310172',false),(31,'114',626.480,'30311020',false),(31,'112',757.490,'30310032',false),(31,'113',865.850,'30310040',false),(31,'206',786.040,'30304105',false),(31,'43',337.940,'30307031',true),(31,'54',55.390,'30301122',false),(31,'107',740.190,'30311039',false),(31,'108',714.480,'30311047',false),(31,'19',1191.270,'30306027',true),(31,'205',555.350,'30304091',false),(31,'127',874.310,'30310075',false),(31,'44',542.200,'30307040',true),(31,'49',699.820,'30306060',false),(31,'121',254.640,'30312051',false),(31,'45',337.940,'30307058',true),(31,'80',699.820,'30307066',false),(31,'68',297.110,'30301165',false),(31,'46',217.660,'30303060',true),(31,'69',200.540,'30301190',false),(31,'42',970.370,'30312086',true),(31,'120',320.370,'30307090',false),(31,'50',998.250,'30307112',false),(31,'41',1150.360,'30307120',true),(4,'12',81.640,'41301013',false),(4,'115',31.720,'41301170',false),(4,'223',23.820,'41301030',false),(4,'3',59.500,'41501012',false),(4,'15',31.720,'40103137',false),(4,'24',343.650,'30306019',false),(4,'6',99.170,'41301080',false),(4,'1',135.440,'10101012',false),(4,'27',135.440,'10101012',false),(4,'22',57.150,'30304032',false),(4,'25',49.580,'41301129',false),(4,'13',59.500,'41501012',false),(4,'54',54.570,'30301122',false),(4,'100',23.970,'41301200',false),(4,'201',11.650,'20103239',false),(4,'17',343.650,'30312043',false),(4,'48',343.650,'30312043',false),(4,'10',49.580,'41301242',false),(4,'33',337.940,'30310083',false),(4,'5',27.500,'41301250',false),(4,'7',138.870,'41301269',false),(4,'4',59.500,'41501128',false),(4,'20',19.820,'41301307',false),(4,'11',23.310,'41301315',false),(4,'125',85.410,'30313066',false),(4,'23',28.880,'41301471',false),(4,'61',77.840,'41501144',false),(4,'2',13.740,'41301323',false),(4,'36',156.390,'40901017',false),(3,'12',81.640,'41301013',false),(3,'223',23.820,'41301030',false),(3,'3',59.500,'41501012',false),(3,'15',31.720,'40103137',false),(3,'24',343.650,'30306019',false),(3,'6',99.170,'41301080',false),(3,'1',135.440,'10101012',false),(3,'27',135.440,'10101012',false),(3,'22',64.040,'30304032',false),(3,'25',49.580,'41301129',false),(3,'13',59.500,'41501012',false),(3,'100',23.970,'41301200',false),(3,'201',11.650,'20103239',false),(3,'17',343.650,'30312043',false),(3,'10',49.580,'41301242',false),(3,'33',337.940,'30310083',false),(3,'5',27.500,'41301250',false),(3,'7',138.870,'41301269',false),(3,'4',59.500,'41501128',false),(3,'20',19.820,'41301307',false),(3,'11',23.310,'41301315',false),(3,'23',28.880,'41301471',false),(3,'61',77.840,'41501144',false),(3,'2',13.740,'41301323',false),(3,'36',156.390,'40901017',false),(20,'29',6.820,'90005767',false),(20,'28',7.640,'90006585',false),(20,'30',6.460,'90548906',false),(20,'31',10.830,'90006020',false),(20,'32',7.050,'90007085',false)),
     plano_tab(mic, num, ordem) as (values (4,31,1),(4,4,2),(4,20,3),(5,31,1),(5,3,2),(5,20,3)),
     escolhido as (
       select distinct on (pt.mic, i.c) pt.mic, i.c, i.valor, i.guia, i.autoriz, t.nome, t.vig
       from plano_tab pt join item i on i.num = pt.num join tab t on t.num = pt.num
       order by pt.mic, i.c, pt.ordem)
insert into public.precos (procedimento_id, convenio_id, plano_id, valor, codigo_guia, tabela_guia, necessita_autorizacao, tabela_preco, vigente_de)
select p.id, cv.id, pl.id, e.valor, e.guia, case when e.guia like '9%' then '20' else '22' end, e.autoriz, e.nome, e.vig
from escolhido e
join public.procedimentos p on p.tabela = '00' and p.codigo = e.c
join public.convenios cv on cv.micrologos_codigo = 2
join public.convenio_planos pl on pl.micrologos_codigo = e.mic
where not exists (select 1 from public.precos x where x.procedimento_id = p.id and x.convenio_id = cv.id and x.plano_id = pl.id);

-- ---------- Hospitais (Unidades do Micrologos) ----------
insert into public.hospitais (nome, cnpj, cnes, propria_clinica, micrologos_codigo, ativo, observacoes) values
  ('Consumed Consultórios Médicos Ltda', '05894660000187', '3176479', true, 1, true, 'A própria clínica (unidade principal).'),
  ('Consumed', '05894660000187', '3176479', true, 12, true, 'A própria clínica (2º cadastro no Micrologos).'),
  ('Barra Day Serviços Médicos Ltda', '04781174000190', '102881', false, 3, true, null),
  ('Clínica e Cirurgia de Olhos Dr. Armando Augusto Guedes Ltda', null, '9260854', false, 11, true, 'Uso atual a confirmar com a dona.'),
  ('Day Clinic Méier', null, '5136989', false, 6, true, null),
  ('Hospital Daniel Lipp Ltda', '73372427000194', '3014673', false, 5, true, null),
  ('Hospital Oftalmológico da Barra', null, '7544227', false, 7, true, null),
  ('Jardim de Alah Centro Cirúrgico Ltda', '01124549000150', '3135659', false, 4, true, 'Uso atual a confirmar com a dona.'),
  ('Largo do Machado', null, '3135268', false, 2, true, null),
  ('Oftalmo Rio Centro de Micro Cirurgia Ocular Ltda EPP', null, '5417643', false, 14, true, null),
  ('Pro Oftalmo Micro Cirurgia Ocular S/C Ltda', '97515480000165', '5325722', false, 10, true, null),
  ('Rio Vision Hospital Ltda', null, '4708490', false, 13, true, null),
  ('Unimed Regional Fluminense Cooperativa de Trabalho Médico', '28714533001711', '8403708', false, 15, true, 'Uso atual a confirmar com a dona.'),
  ('UTI Rio Serviços Médicos Ltda', null, '7536747', false, 9, true, 'Uso atual a confirmar com a dona.')
on conflict (micrologos_codigo) do nothing;

-- ---------- Código de cada hospital no Bradesco Saúde (localContratado da guia de Honorários) ----------
insert into public.hospital_convenio_codigos (hospital_id, convenio_id, codigo_operadora)
select h.id, c.id, v.cod
from (values (10, '193216'), (7, '427810'), (13, '54409'), (2, '684724'), (5, '195510'), (6, '203114')) v(mic, cod)
join public.hospitais h on h.micrologos_codigo = v.mic
join public.convenios c on c.micrologos_codigo = 2
on conflict (hospital_id, convenio_id) do nothing;
