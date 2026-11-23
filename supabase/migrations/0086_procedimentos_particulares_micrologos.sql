-- 0086 — Tabela de preços PARTICULAR importada da Micrologos (pedido da dona, 23/11/2026).
-- Origem: ML Clinic Master → Cadastros → Tabelas → Produtos/Serviços → Preços, tabela "Particular" (cód. 1).
-- 93 procedimentos. `codigo` = código interno da Micrologos ("Cód. Proced."), NÃO é TUSS → tabela '00' (tabela própria).
-- Preço particular = linha em `precos` sem convênio. Regras da dona mantidas:
--   * preços diferentes para cartão e dinheiro/Pix ficam como itens separados;
--   * Taxa de Sala = 0,00 (não usada); Revisão = 0,01 e Fotocoagulação continuação = 0,10 (valores simbólicos).
-- Novidades: tipo 'terapia' e coluna `observacao` em procedimentos.

alter table public.procedimentos drop constraint if exists procedimentos_tipo_check;
alter table public.procedimentos add constraint procedimentos_tipo_check
  check (tipo = any (array['consulta','exame','procedimento','cirurgia','terapia','taxa','material','medicamento']));
alter table public.procedimentos add column if not exists observacao text;
comment on column public.procedimentos.observacao is 'Observação livre (ex.: preço para cartão / dinheiro-Pix, valor simbólico, TUSS de referência).';

with dados(codigo, descricao, tipo, valor, observacao) as (values
  ('225', 'Agulhamento/ Bolha Filtrante', 'cirurgia', 4000, null),
  ('185', 'Angiografia Particular', 'exame', 450, null),
  ('208', 'Aspiração de Massa Camara Anterior', 'cirurgia', 600, null),
  ('186', 'Biometria Particular', 'exame', 110, null),
  ('187', 'Biometria Particular/externo', 'exame', 190, null),
  ('168', 'Biopsia Lesão Palpebral', 'cirurgia', 2600, null),
  ('218', 'Blefaroplastia Inferior Cartão', 'cirurgia', 6500, 'Preço para cartão'),
  ('166', 'Blefaroplastia Inferior Pix/dnh', 'cirurgia', 6000, 'Preço para dinheiro/Pix'),
  ('234', 'Blefaroplastia Sup + Ptose', 'cirurgia', 10500, null),
  ('217', 'Blefaroplastia Superior Cartão', 'cirurgia', 6500, 'Preço para cartão'),
  ('141', 'Blefaroplastia Superior Dnh/pix', 'cirurgia', 6000, 'Preço para dinheiro/Pix'),
  ('216', 'Blefaroplastia Superior/inferior Cartão', 'cirurgia', 8500, 'Preço para cartão'),
  ('167', 'Blefaroplastia Superior/inferior Dnh/pix', 'cirurgia', 7900, 'Preço para dinheiro/Pix'),
  ('236', 'Blefaroplastia/castanhares', 'cirurgia', 9900, null),
  ('176', 'But Tempo de Ruptura do Filme Lacrimal', 'exame', 90, null),
  ('140', 'Calazio', 'cirurgia', 1750, null),
  ('189', 'Campo Visual Particular', 'exame', 180, null),
  ('24', 'Capsulotomia Yag Ou Cirurgica', 'procedimento', 450, null),
  ('238', 'Ciclofoto A Laser Micropulsado', 'procedimento', 3000, null),
  ('145', 'Ciclofotocoagulação Transescleral A Laser', 'cirurgia', 5000, null),
  ('197', 'Cirurgia Refrativa Cartao', 'cirurgia', 5220, 'Preço para cartão'),
  ('143', 'Cirurgia Refrativa Dinheiro/pix', 'cirurgia', 4820, 'Preço para dinheiro/Pix'),
  ('200', 'Cisto Palpebral', 'cirurgia', 1600, null),
  ('184', 'Consulta Cartao', 'consulta', 280, 'Preço para cartão'),
  ('158', 'Consulta Córnea', 'consulta', 500, null),
  ('63', 'Consulta Dinheiro/pix', 'consulta', 250, 'Preço para dinheiro/Pix'),
  ('152', 'Consulta Drº Gelson', 'consulta', 350, null),
  ('153', 'Consulta Drº Renato', 'consulta', 500, null),
  ('160', 'Consulta Glaucoma', 'consulta', 600, null),
  ('90', 'Consulta Oftalmológica Pediatria e Estrabismo', 'consulta', 500, null),
  ('155', 'Consulta Retinologo', 'consulta', 600, null),
  ('209', 'Consulta Òtica Júnior', 'consulta', 120, null),
  ('92', 'Crosslinking Corneano-cxl de Colageno', 'procedimento', 1416, null),
  ('18', 'Curva de Pressão', 'exame', 155, null),
  ('25', 'Curva Tensional Diaria-binocular', 'exame', 155, 'TUSS 50010026'),
  ('154', 'Dacriocistorrinostomia- Particular', 'cirurgia', 11000, null),
  ('13', 'Ecobiometria', 'exame', 120, 'TUSS 50010190'),
  ('183', 'Ectropio', 'cirurgia', 8500, null),
  ('182', 'Entropio', 'cirurgia', 8500, null),
  ('180', 'Exame Vias Lacrimais ( Teste de Schirmer )', 'exame', 90, null),
  ('98', 'Exercício Ortóptico', 'terapia', 50, 'No sistema está como "Exames"'),
  ('99', 'Exercício Ortóptico 10 Sessões', 'terapia', 400, 'No sistema está como "Exames"'),
  ('232', 'Exerese Cisto Palpebral', 'cirurgia', 5500, null),
  ('203', 'Exerese Multiplos Cistos Bilateral', 'cirurgia', 5500, null),
  ('202', 'Exerese Multiplos Cistos Unilateral', 'cirurgia', 3200, null),
  ('19', 'Facectomia Com Implante de Lio', 'cirurgia', 5500, null),
  ('164', 'Faco/goniotomia', 'cirurgia', 10500, null),
  ('163', 'Faco/trec', 'cirurgia', 10500, null),
  ('162', 'Faco/vvpp Vias Pars', 'cirurgia', 25000, null),
  ('106', 'Fotocoagulacao A Laser Continuacao', 'procedimento', 0.1, 'No sistema está como "Exames"; Valor simbólico no sistema'),
  ('17', 'Fotocoagulação A Laser', 'procedimento', 450, null),
  ('48', 'Fotocoagulação A Laser Ao', 'procedimento', 2000, 'TUSS 50140019'),
  ('10', 'Gonioscopia', 'exame', 150, null),
  ('175', 'Goniotomia(gatt)', 'cirurgia', 8500, null),
  ('181', 'Implante de Dreno Susanna', 'cirurgia', 10000, null),
  ('51', 'Implante Intravitreo de Polimero - Ozurdex', 'procedimento', 7000, null),
  ('178', 'Iol Master', 'exame', 350, null),
  ('239', 'Iol Master/ Micro Dr Francisco', 'exame', 300, null),
  ('33', 'Iridotomia (yag Laser)', 'procedimento', 450, 'No sistema está como "Exames"'),
  ('16', 'Laser (uma Única Sessão)', 'procedimento', 400, 'No sistema está como "Exames"'),
  ('149', 'Lente Id Longe', 'cirurgia', 7500, null),
  ('148', 'Lente Imp.simples', 'cirurgia', 2900, null),
  ('147', 'Lente Intra Nacional', 'cirurgia', 700, null),
  ('150', 'Lente Trifocal', 'cirurgia', 15000, null),
  ('119', 'Lisamina Verde', 'exame', 90, null),
  ('194', 'Mapeamento de Retina Particular', 'exame', 280, null),
  ('193', 'Microscopia Particular', 'exame', 200, null),
  ('172', 'Oct Disco Particular', 'exame', 450, null),
  ('171', 'Oct Macula Particular', 'exame', 450, null),
  ('179', 'Olho Seco Severo Consulta', 'consulta', 400, null),
  ('170', 'Pam Particular', 'exame', 150, null),
  ('169', 'Paquimetria Particular', 'exame', 155, null),
  ('142', 'Pentacam', 'exame', 600, null),
  ('46', 'Pterigio-exerese', 'cirurgia', 3000, 'TUSS 50030035'),
  ('199', 'Pterigio/ Cola de Fibrina', 'cirurgia', 4200, null),
  ('71', 'Ptose Palpebral- Correcao Cirurgica- Unilateral', 'cirurgia', 7900, null),
  ('188', 'Retinografia Particular', 'exame', 250, null),
  ('105', 'Revisão 0,01', 'consulta', 0.01, 'Valor simbólico no sistema'),
  ('196', 'Rosa Bengala', 'exame', 90, null),
  ('198', 'Sondagem Vias Lacrimais Particular', 'procedimento', 1100, 'No sistema está como "Exames"'),
  ('9', 'Taxa de Sala', 'taxa', 0, 'Categoria "Taxas" no sistema; Valor zerado no sistema'),
  ('195', 'Teste do Olhinho Dr Gelson', 'exame', 380, null),
  ('192', 'Teste do Olhinho Particular', 'exame', 280, null),
  ('97', 'Teste Ortóptico', 'exame', 100, null),
  ('177', 'Titmus', 'exame', 200, null),
  ('2', 'Tonometria', 'exame', 100, null),
  ('190', 'Topografia Particular', 'exame', 200, null),
  ('237', 'Trabeculoplastia Particular', 'procedimento', 1500, null),
  ('47', 'Tratamento Ocular Quimioterápico Com Antiangiogenico', 'procedimento', 2200, null),
  ('174', 'Trebeculectomia', 'cirurgia', 8500, null),
  ('224', 'Trec/vvpp', 'cirurgia', 30000, null),
  ('191', 'Ultrassonografia Particular', 'exame', 280, null),
  ('41', 'Vitrectomia Vias Pars Plana', 'cirurgia', 25000, 'TUSS 50070061')
), novos as (
  insert into public.procedimentos (codigo, tabela, descricao, tipo, observacao)
  select codigo, '00', descricao, tipo, observacao from dados
  on conflict (tabela, codigo) where codigo is not null do update
    set descricao = excluded.descricao, tipo = excluded.tipo, observacao = excluded.observacao
  returning id, codigo
)
insert into public.precos (procedimento_id, convenio_id, plano_id, valor, vigente_de)
select n.id, null, null, d.valor, date '2026-11-23'
from novos n join dados d on d.codigo = n.codigo
on conflict do nothing;
