# B) Tabelas de preço e procedimentos — Micrologos

**Status:** concluído (somente leitura). Nada foi alterado.

---

## 1. Cadastro de Procedimentos
**Caminho:** Cadastros ▸ Procedimentos
**Total de procedimentos ativos:** 193

### 1.1 Aba "Visão Geral" (lista)
- Busca: Descrição; "em toda a descrição"; Ativos / Inativos / Ambos; filtros: Proc. Cirúrgico · Com Laudo · Faz Comissão Staff · Central Imagem · Do SUS · Vacina.
- Colunas: Código · Descrição · **Cód.AMB** · **Cd.Categ** · Categoria · **Cód.CBHPM** · **Cód.TUSS** · Descr. Resumida · CH.

**Categorias usadas:** 01 Procedimentos · 0101 Consulta · 0102 Exames · 010201 Campo Visual · 0103 Cirurgia · 0201 Material · 0301 Taxas.

### 1.2 Aba "Detalhamento" (exemplo conferido: 73 – Tomografia de Coerência Óptica Binocular)
- Código · Descrição · Ativo/Inativo · Categoria · Taxa do Procedimento (+ valor)
- Cód.AMB · Cód.CBHPM · **Cód.TUSS** (ex.: 98050362) · Cód.SIH-SUS · Qtde Filme · Qtde de CH
- Sexo permitido · Idade mínima / máxima · Descr. Resumida
- **Membros** (tipo e quantidade): AO / OD / OE (olho)
- Caixas: Inclui só o Kit · CID Obrigatório · Comissão Médicos · Permite Sessões · Terceirizado · Cirúrgico · Obstétrico · Odontológico · Com Vídeo · **Solicitação Obrigatória** · **Executante Obrigatório** · Vacina
- Sub-abas:
  - **TISS/SUS:** Tipo Atendimento (ex.: "Exames ambulatoriais"); Classificação de Item (ex.: Honorários); Posição Profissional; Pacote SP/SADT ou Resumo Internação; Prioridade p/ Proced. Principal; **Fatura para Médico que Indicou**; SUS: Tipo Procedimento, Tipo APAC (Inicial/Única/Continuidade/Encerramento), Serviço, Classificação.
  - **Central Imagens:** usa central de imagens; tipo de imagem (JPG/PDF/CSV/XML/Multi); equipamento; **Caminho local das imagens** (ex.: pasta de rede do OCT `\\192.168.10.163\Dropbox\OCT`); subpasta destino no servidor (`\\192.168.10.114\Imagens` › "Tomo"); Tipos de exame da imagem (AO/OD/OE).
  - **Outros/PACS:** Observação na agenda/preparação; PACS (worklist: código do processo e do exame; sigla da modalidade); Tempo de duração do atendimento; Porte AMB; Ponto de equilíbrio (qtde/valor); cor; tipo (Ambulatorial…); não considerar na estatística; Franquia.
  - **NF eletrônica/Web:** CST; CNAE; descrição p/ NF; "Realizado fora da sala da consulta" (agendamento web).
  - **Laudo/Preços:** Possui Laudo; lista de preços por tabela (ex.: Assim 237,36 – cód. 98050362).
  - **Atendimento:** Fichas de dados para o PEP (no atendimento / na solicitação); padrão de observações nas solicitações; etapas para realização do procedimento.
  - **Retorno/Vacina:** Nº de dias para agendar próximo atendimento; dias antes para confirmar retorno; descrição resumida p/ retorno; observação p/ agenda de retorno; próximo procedimento; local de aplicação; dose nº.

### 1.3 Aba "Composição de Kit"
Itens que compõem o procedimento por plano: Código · Produto/Serviço · Plano de Saúde · Ordem · Unidade Est. · Qt.Est · Unidade Fin. · Qt.Fin · Vincula. Ex.: OCT binocular → "Pacote OCT" (74) para os planos Assim Comlurb, Assim Comum e Assim Prefeitura.

### 1.4 Aba "Faturamento" — gráfico de faturamento do procedimento (por período/convênio).

### 1.5 Menu Opções
Refaz · Ordena ▸ · Navega c/setas · Faz gráfico · Seleciona todos · Visualiza Classificações de Guia c/ o Procedim. · Copia Procedimento · Altera na Tabela de Preço ▸ · Outras Alterações ▸. **Sem exportação para Excel/CSV.**

---

## 2. Lista completa de procedimentos ativos (193)
Formato: código interno – descrição – categoria – TUSS (AMB / CBHPM quando houver)

**A–C**
225 Agulhamento/Bolha Filtrante – Cirurgia · 220 Análise Computadorizada do Segmento Anterior – Cirurgia – TUSS 40103030 · 12 Angiografia – Exames – TUSS 41301013 (AMB 50.01.013-1; CBHPM 4.13.91.91-3) · 185 Angiografia Particular – Exames · 208 Aspiração de Massa Câmara Anterior – Cirurgia · 87 Autotransplante Conjuntival – Cirurgia – 30303010 · 115 Avaliação de Vias Lacrimais (Teste de Schirmer) – Exames – 41301170 · 223 Avaliação Órbito-palpebral-exoftalmométrica – Exames – 41301030 · 3 Biometria – Exames – 41501012 (AMB 50.01.019-0; CBHPM 4.15.01.01-2) · 231 Biometria Cisbaf – 0211060011 · 186 Biometria Particular · 187 Biometria Particular/externo · 168 Biópsia Lesão Palpebral – Cirurgia · 218 Blefaroplastia Inferior Cartão · 166 Blefaroplastia Inferior Pix/dinheiro · 234 Blefaroplastia Sup + Ptose · 217 Blefaroplastia Superior Cartão · 141 Blefaroplastia Superior Dinheiro/pix · 216 Blefaroplastia Sup/Inf Cartão · 167 Blefaroplastia Sup/Inf Dinheiro/pix · 236 Blefaroplastia/castanhares · 104 Blefarorrafia – 30301033 · 176 BUT Tempo de Ruptura do Filme Lacrimal – Exames · 140 Calázio – 30301041 · 230 Calázio/lesões Pálpebra Cisbaf – 0405010079 · 15 Campo Visual Computadorizado – Campo Visual – 40103137 (AMB 50.01.004-2; CBHPM 4.01.03.13-7) · 189 Campo Visual Particular · 102 Cantoplastia Lateral – 30301050 · 103 Cantoplastia Medial – 30301068 · 34 Capsulotomia (YAG Laser) – Procedimentos – 30306019 (AMB 50.06.001-5; CBHPM 3.03.06.01-9) · 228 Capsulotomia Cisbaf – 0405050020 · 24 Capsulotomia YAG ou Cirúrgica – 30306019 · 6 Ceratoscopia Corneana – Exames – 41301080 (AMB 50.01.026-3; CBHPM 4.13.01.08-0) · 238 Ciclofoto a Laser Micropulsado · 145 Ciclofotocoagulação Transescleral a Laser · 215 Cicloterapia – Qualquer Técnica – 30310024 · 222 Cicloterapia – Qualquer Técnica – 30310024 · 204 Cirurgia Antiglaucomatosa Via Angular – 30310172 · 114 Cirurgia com Sutura Ajustável – 30311020 · 197 Cirurgia Refrativa Cartão · 143 Cirurgia Refrativa Dinheiro/pix · 112 Cirurgias Fistulizantes Antiglaucomatosas – 30310032 · 113 Cirurgias Fistulizantes com Implantes – 30310040 · 200 Cisto Palpebral · 146 Consulta – 00010014 (CBHPM 0.0.01.00-1) · 1 Consulta – 10101012 (AMB 00.01.001-4; CBHPM 1.01.01.01-2) · 227 Consulta oftalmológica com Tono/fundo – 0301010072 · 226 Consulta oftalmologista – 0301010072 · 184 Consulta Cartão · 158 Consulta Córnea · 63 Consulta Dinheiro/pix · 152 Consulta Dr. [médico] · 153 Consulta Dr. [médico] · 159 Consulta em Consultório (AMB 98.90.112-0) · 27 Consulta em Consultório – Exames – 10101012 · 160 Consulta Glaucoma · 90 Consulta Oftalmológica Pediatria e Estrabismo · 209 Consulta Ótica Júnior · 155 Consulta Retinólogo · 221 Consulta/tonometria – 68000210 · 22 Corpo Estranho da Córnea – Retirada – 30304032 · 94 Correção Cirúrgica de Ectrópio ou Entrópio – 30301084 · 92 Crosslinking Corneano – 50041037 · 25 Curva Tensional Diária binocular – 41301129 (AMB 50.01.002-6)

**D–I**
154 Dacriocistorrinostomia Particular · 88 Dacriocistorrinostomia – 30313031 · 206 Delaminação Corneana com Fotoablação – 30304105 · 70 Dermatocalaze ou Blefarocalaze – Exames · 13 Ecobiometria – 41501012 · 183 Ectrópio · 43 Endolaser/Endodiatermia – 30307031 · 182 Entrópio · 72 Enucleação e Evisceração – 30309018 · 101 Enucleação ou Evisceração com Ou Sem Implante – 30309018 · 54 Epilação de Cílios – 30301122 · 107 Estrabismo Ciclo Vertical/Transposição – 30311039 · 108 Estrabismo Horizontal Monocular – 30311047 · 100 Exame de Motilidade Ocular (teste ortóptico) – 41301200 · 180 Exame Vias Lacrimais (Teste de Schirmer) · 98 Exercício Ortóptico · 99 Exercício Ortóptico 10 Sessões · 201 Exercícios de Ortóptica por Sessão – 20103239 · 232 Exérese Cisto Palpebral · 203 Exérese Múltiplos Cistos Bilateral · 202 Exérese Múltiplos Cistos Unilateral · 77 Facectomia – **Material** – 30306027 · 19 Facectomia com Implante de LIO – 30306027 · 79 Facectomia sem Implante de LIO – 30306043 · 164 Faco/goniotomia · 163 Faco/TREC · 162 Faco/VVPP Vias Pars · 205 Fotoablação de Superfície Convencional – 30304091 · 17 Fotocoagulação a Laser – 30312043 · 48 Fotocoagulação a Laser Ao – 30312043 · 106 Fotocoagulação a Laser Continuação · 10 Gonioscopia – 41301242 · 127 Goniotomia ou Trabeculotomia – 30310075 · 175 Goniotomia (GATT) · 207 Implante de Drenagem Susanna · 181 Implante de Dreno Susanna · 44 Implante de Silicone Intravítreo – 30307040 · 51 Implante Intravítreo de Polímero (Ozurdex) – 30312132 · 49 Implante Secundário/Explante/Fixação – 30306060 · 121 Infusão de Gás Expansor – 30312051 · 45 Infusão de Perfluorcarbono – 30307058 · 122 Injeção de Toxina Botulínica – 30311055 · 178 IOL Master · 239 IOL Master/Micro Dr. [médico] · 33 Iridotomia (YAG Laser) – Exames – 30310083

**L–P**
37 Lente Gelatinosa · 149 Lente ID Longe · 148 Lente Imp. simples · 147 Lente Intra Nacional · 39 Lente Multifocal · 35 Lente Particular · 40 Lente Rígida · 38 Lente Tórica · 150 Lente Trifocal · 119 Lisamina Verde · 5 Mapeamento de Retina – 41301250 (AMB 50.01.009-3) · 194 Mapeamento de Retina Particular · 80 Membranectomia Epi ou Sub-Retiniana – 30307066 · 7 Microscopia Especular – 41301269 (AMB 50.01.021-2) · 193 Microscopia Particular · 172 OCT Disco Particular · 171 OCT Mácula Particular · 179 Olho Seco Severo Consulta · 66 Ozurdex Implante Intravítreo de Polímero – 30312132 · 210 Pacote Facectomia com Implante de LIO – 98500937 · 219 Pacote Facectomia com Implante de LIO – 98501240 · 109 Pacote Retirada de Corpo Estranho da Córnea – 30305047 · 213 / 214 Pacote Retirada de Corpo Estranho Intra… – 69911223 · 211 Pacote Sondagem das Vias Lacrimais – 69911231 · 68 Pálpebra – Reconstrução Parcial – 30301165 · 56 Pálpebra Reconstrução Total – 30301173 · 170 PAM Particular · 60 Panfotocoagulação a Laser na Retinopatia – 30312124 · 169 Paquimetria Particular · 4 Paquimetria Ultrassônica – 41501128 · 142 Pentacam · 20 Potencial de Acuidade Visual – 41301307 · 46 Pterígio – exérese – 30303060 · 229 Pterígio Cisbaf – 0405050364 · 199 Pterígio/Cola de Fibrina · 71 Ptose Palpebral – Correção Cirúrgica – 30301181

**R–X**
85 Radiação para Crosslinking Corneano – 30304156 · 111 / 93 Reconstituição de Fundo de Saco – 30303079 · 89 Reconstituição de Vias Lacrimais com Silicone – 30313058 · 117 Reconstrução Parcial de Cavidade Orbitária – 30302110 · 69 Ressecção de Tumores Palpebrais – 30301190 · 11 Retinografia – 41301315 · 233 Retinografia Fluorescente Binocular – 0211060186 · 188 Retinografia Particular · 42 Retinopexia com Introflexão Escleral – 30312086 · 52 Retirada de Corpo Estranho da Córnea – 30304032 · 212 Retirada de Corpo Estranho do Corpo Vítreo – 30307074 · 126 Retirada de Óleo de Silicone Via Pars Plana – 30307082 · 105 Revisão 0,01 – Consulta · 196 Rosa Bengala · 125 Sondagem das Vias Lacrimais – 30313066 · 198 Sondagem Vias Lacrimais Particular · 124 Sutura de Conjuntiva – 30303087 · 123 Sutura de Córnea – 30304067 · 55 Tarsorrafia – 30301246 · 173 Teste do Olhinho · 195 Teste do Olhinho Dr. [médico] · 192 Teste do Olhinho Particular · 23 Teste do Reflexo Vermelho – 41301471 · 151 Teste do Reflexo Vermelho em RN – 50010352 · 97 Teste Ortóptico · 165 Teste Provocativo para Glaucoma binocular – 41401301 · 177 Titmus · 73 Tomografia de Coerência Óptica Binocular – 98050362 · 61 Tomografia de Coerência Óptica Monocular – 98050354 · 2 Tonometria – 41301323 · 190 Topografia Particular · 237 Trabeculoplastia Particular · 47 Tratamento Ocular Quimioterápico – 30307147 · 174 Trabeculectomia · 224 TREC/VVPP · 120 Troca Fluido Gasosa – 30307090 · 110 Tumor de Conjuntiva – Exérese – 30303109 · 95 / 116 Tumor de Órbita – Exérese – 30302137 · 21 Ultrassonografia Ocular – 40901530 · 36 Ultrassonografia Bilateral – 40901017 · 191 Ultrassonografia Particular · 235 Visita Hospitalar (paciente internado) – 10102019 · 50 Vitrectomia Anterior – 30307112 · 41 Vitrectomia Vias Pars Plana – 30307120 · 96 Xantelasma Palpebral – exérese Unilateral – 30301270

> Observações: OCT (binocular/monocular) usa **códigos próprios 98050362 / 98050354**, não TUSS 41501144 (que aparece nas tabelas de preço como "Tomografia de Coerência Óptica Monocular"). Há procedimentos duplicados por forma de pagamento (Cartão × Dinheiro/Pix) e por médico.

---

## 3. Tabelas de preço
**Caminho:** Cadastros ▸ Tabelas ▸ Produtos/Serviços ▸ **Preços**

- Aba **Tabelas:** lista (Cód. · Descrição · **Dt.Ref.** = data de referência/vigência · CH) e, ao lado, os itens: Ordem · **TUSS/C.Esp** · Produto/Serviço · **Valor** · Marca · **CH** · Franquia · CO · Filme · Anestes. · **Necessita Autoriz.** · Moeda · Cód. Proced. · Cód. Categ · Categoria · Cód. Brasíndice.
- Aba **Itens:** associa produtos/serviços à tabela (filtro por descrição, código AMB, categoria; índice A–Z).
- Opções: Refaz · Ordena · Visualização da Tela · **Visualiza Planos de Saúde com a Tabela** · Reajusta Tabela de Preço ▸ · Copia Cód. Especial do Cadastro de Proc. ▸ · Duplica Tabela de Preço · Exclui Itens com a Classificação ▸ · Importa tabela ▸ · Copia "Descrição p/ Guias" do Brasíndice. **Sem exportar para Excel.**
- **Vigência:** só existe a "Dt.Ref." por tabela (não há histórico de vigências por item visível).
- **Valor por CH:** várias tabelas guardam CH e valor (ex.: Fundação/Porto "CH 0,224" e "CH 0,28").
- **Necessita Autorização** é marcado **por item da tabela** (ex.: facectomia, vitrectomia, retinopexia, pterígio, Ozurdex). É assim que o sistema sabe que precisa de senha/autorização.
- **Kits/pacotes:** existem tabelas só de pacotes (Assim Pacote, Unimed Pacote, Select Pacotes, Blue Pacote, Klini Pacote, Porto Pacote Cross, Caixa Cirurgia) + aba "Composição de Kit" no procedimento.
- **Brasíndice:** existe o cadastro (Cadastros ▸ Tabelas ▸ Produtos/Serviços ▸ Brasíndice: Código, Tipo, Cód.Lab, Laboratório, Cód.Prod, Produto, Cód.Apres., Apresentação, Unit.(PMC)), mas **nenhum item Brasíndice está ligado a produtos**. SIMPRO e CBHPM: não há tabela própria; o CBHPM aparece só como código no procedimento.

### 3.1 Quais planos usam cada tabela
| Tabela | Planos que a utilizam |
|---|---|
| 81 Amil · 83 Amil Cirurgia | Amil |
| 25 Appai Particular | Particular Appai |
| 22 Appai Plano | Appai Plano (convênio inativo) |
| 23 Assim · 30 Assim Cirurgia · 36 Assim Pacote | **nenhum plano** (⚠️ conferir como a Assim é faturada) |
| 11 Assist | Assist |
| 26 Assist Particular | Particular Assist |
| 85 Blue · 84 Blue Pacote | Blue |
| 31 Bradesco Cirurgia | Bradesco Ope. Empresa e Individual; Bradesco Empresa e Individual |
| 4 Bradesco Empresa | Bradesco Ope. Empresa; Bradesco Empresa |
| 3 Bradesco Individual | Bradesco Ope. Individual; Bradesco Individual |
| 20 Medicamentos | Bradesco Empresa; Bradesco Individual |
| 79 Caixa Ambulatório · 80 Caixa Cirurgia | Saúde Caixa |
| 93 Cedae Periódico | Cedae Periódico |
| 94 Cisbaf | Cisbaf |
| 15 Cortesia | Particular › Cortesia |
| 8 Dortprev | Dort Prev (inativo) |
| 74 Dual Saúde Integrada | Particular › Dual Saúde Integrada |
| 60 e 61 Fundação Saúde (CH) | nenhum plano |
| 62 Fundação Saúde Cirurgia | Fundação Saúde Itaú (todos os planos Fun) |
| 63, 64 Fundação Saúde Cirurgia | nenhum plano |
| 39 Geap · 45 Geap Cirurgias · 40 Geap Medicamento | todos os planos Geap |
| 32 Golden Cirurgia · 27 Golden Cross · 65 Golden Material | todos os planos Golden Cross |
| 41 Hapvida NotreDame/Intermédica | todos os planos Hapvida/Intermédica **e** os planos Notre Dame (Advance, Infinity…) |
| 28 Inativo | nenhum |
| 77 Klini Saúde · 78 Klini Pacote | Klini Saúde |
| 73 Livre Escolha | Livre Escolha |
| 19 Mediservice · 33 Mediservice Cirurgia | todos os planos Mediservice (~70) |
| 7 Medprev | Medprev (inativo) |
| 16 Ótica | Particular › Ótica |
| 1 Particular | Particular; Total Life |
| 70 Porto Pacote Cross | Porto Bronze I–X; Prata I–X |
| 53 Porto Seguro CH 0,224 | Fundação Saúde Itaú Fun Básico; Porto Bronze…, Empresarial Básico/Superior/Especial, P300–P320, Porto Essencial |
| 49 Porto Seguro CH 0,28 | Porto Cristal, Diamante, Ouro, Porto I–IX, P200–P470… |
| 50, 51, 52 Porto Seguro Cirurgia | planos Porto (Diamante, Empresarial Master/Sênior, Ouro, P220…, Portomed) / (Bronze, Empresarial Básico, Ouro Mais) / (lista longa de Bronze/Cristal/Diamante/Ouro/P…) |
| 86 Select Operadora · 87 Select Pacotes | Select |
| 82 Siass-Geap | Siass-Geap |
| 13 Sindicato dos Rodoviários | Particular › Sindicato dos Rodoviários |
| 76 Sistema Interclínicas | Particular › Sistema Interclínicas |
| 29 Tabela Cirurgia · 2 Tabela Padrão | nenhum (modelos) |
| 12 Tabela [médico] | convênio 19 [nome]; Particular › Clínica de Olhos; Particular › [médico] Particular |
| 34 Unimed Cirurgia | Unimed NI / Outras / Rio 0037 dos médicos (Gelson, Gisele, Luciano, Max) |
| 14 Unimed NI | Unimed NI (Gelson, Gisele, Luciano, Max) |
| 18 Unimed Nova Iguaçu | Unimed Outras e Rio 0037 (Gelson, Gisele, Luciano, Max) |
| 42 Unimed Pacote | Unimed Antonio (0037, NI, Outras); Unimed Consumed Cirurgia (NI, 0037, Outras); Unimed Gelson (NI, Outras, Rio 0037) |

> A ordem de uso entre várias tabelas no mesmo plano é definida pela **Prioridade** na aba Tabelas do plano (ex.: Amil = prioridade 20).

### 3.2 Valores por tabela
Os valores de todas as 66 tabelas estão em **B2-precos-por-tabela.md** (mesma pasta). (*) = item com "Necessita Autorização".

---

## 4. Procedimentos oftalmológicos mais usados (TUSS)
| Procedimento | TUSS | Faixa de valores nas tabelas de convênio |
|---|---|---|
| Consulta em consultório | 10101012 | R$ 26,22 (Appai) a R$ 146,00 (Fundação/Porto) |
| Tonometria | 41301323 | R$ 5,60 a R$ 35,04 |
| Mapeamento de retina | 41301250 | R$ 14,40 a R$ 60,90 |
| Campo visual computadorizado | 40103137 | R$ 19,20 a R$ 94,36 |
| OCT (tomografia de coerência óptica) | 41501144 (tabelas) / 98050362-98050354 (cadastro) | R$ 77,84 a R$ 240,85 |
| Biometria | 41501012 | R$ 38,88 a R$ 95,07 |
| Paquimetria | 41501128 | R$ 28,38 a R$ 63,50 |
| Retinografia | 41301315 | R$ 13,44 a R$ 47,95 |
| Microscopia especular | 41301269 | R$ 68,04 a R$ 138,87 |
| Capsulotomia YAG | 30306019 | R$ 160,00 a R$ 739,90 |
| Facectomia com LIO | 30306027 | R$ 540,00 a R$ 1.585,50 (pacotes até R$ 3.497,46) |
| Vitrectomia via pars plana | 30307120 | R$ 522,00 a R$ 1.532,65 |

---

## 5. Pendências
- Valores com a coluna cortada na tabela Particular (marcados "≥10 mil?") — conferir na tela.
- As tabelas Assim não estão ligadas a nenhum plano — confirmar se a Assim ainda é atendida e como é cobrada.
- Não foi aberto o detalhamento de cada procedimento (só o do OCT binocular).
