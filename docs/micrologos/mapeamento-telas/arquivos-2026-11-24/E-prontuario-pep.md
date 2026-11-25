# E) Prontuário Eletrônico (PEP) de oftalmologia — Micrologos

**Status:** mapeado pela **configuração** das fichas e dos modelos de texto. **Nenhum prontuário real foi aberto.** O PEP do paciente de teste também **não** foi aberto, porque o botão "Abrir Atendimento" cria um atendimento novo. Ver Pendências.

---

## 1. Tela de acesso ao PEP
**Caminho:** botão **PEP** na barra principal → "Acesso aos Prontuários Eletrônicos do Paciente (PEP)"
- Abas: **Pacientes** · **Fila de Espera** · **Atendidos** · **Atendendo** · **Não Atendidos**
- Fila de espera: contadores (pacientes em fila; agendados manhã/tarde/total; atraso; tempo de recepção; espera); filtros por Médico, Local, Unidade e Observação; colunas Agendado · Chegada · Médico · Paciente · Idade · Nº-Última Cons · 1ª (primeira vez) · Rev (revisão) · ☎ · Local · Observação · Plano.
- Botões: **Abrir Atendimento** · **Chamar Correio** · **Chamar TV** / **Chamar todas TVs** (painel de chamada) · configurações · Sair.
- Busca de paciente: mínimo de 7 caracteres no nome; "Busca Avançada" (1º e 2º nome, E/OU, fonética).

## 2. Fichas de dados (formulários do atendimento)
**Caminho:** Ferramentas ▸ Configurações ▸ **Fichas de Dados**. Ficha "Atendimento" = preenchida a cada consulta; "Histórico Pregresso" = antecedentes.
O sistema tem um **editor visual** de fichas (rótulos, caixas de texto, listas, caixas de marcar, gráfico, imagem/OLE).

| Cód | Ficha | Tipo |
|---|---|---|
| 0001 | Oftalmologia | Atendimento |
| 0003 | Anamnese | Atendimento |
| 0004 | Oftalmologia II | Atendimento |
| 0011 | C.E.S. – Controle de Exames de Sangue | Atendimento |
| 0012 | Ortóptica | Atendimento |
| 0013 | Lente de Contato | Atendimento |
| 0014 | **Oftalmo III** (a mais completa) | Atendimento |
| 0018 | Óculos | Atendimento |
| 0046 | Anamnese | Histórico Pregresso |
| 0047 | Ficha de Retina | Atendimento |
| 0048 | Consulta | Atendimento |
| 0049 | Ficha de Catarata (pré-operatório) | Atendimento |

> ⚠️ Não sei quais fichas são usadas hoje no dia a dia. Pergunta para os médicos.

### 2.1 Ficha 0001 – Oftalmologia
- **Exames:** AV s/c (D/E) · AV c/ at. corr. (D/E) · AV c/c (D/E) · Ex. Externo · Biomicroscopia · Fundo de Olho · **Tonometria OD/OE (mmHg) + Hora** + botão gráfico de Tonometria · Motilidade · Convergência · Reflexos · PIO OD · Fator de Correção · Paquimetria · PIO Final OD.
- **Mapeamento:** Mapeamento Dir. / Esq. (texto) + 2 desenhos (OD/OE) · Antes / Depois.
- **Óculos:** Para longe OD/OE (Esf, Cil, Eixo) · DP · Adição (AO, OD, OE) · Para perto OD/OE (Esf, Cil, Eixo) · DP.

### 2.2 Ficha 0003 – Anamnese
Antecedentes: Pessoal · Familiares · Cirúrgico · Oftalmológico.

### 2.3 Ficha 0004 – Oftalmologia II
- **1 Consulta:** AR (mm) · Ceratometria OD/OE · AV s/c OD/OE · Refração OD/OE · AV Longe · AD · AV Perto.
- **Fundoscopia:** 2 desenhos + texto · Motilidade Ocular · PIO (hora, OD, OE, mmHg).
- **Biomicroscopia:** 2 desenhos + texto.
- **Diag./Conduta:** Diagnóstico · Conduta.

### 2.4 Ficha 0014 – Oftalmo III (a mais completa)
- **Atendimento:** 1-Evolução · 2-AV s/c (OD/OE/J – listas) · botão **Refração** · refração OD/OE (esf, cil, eixo) · 4-Adição · 5-AV c/c (OD/OE/J) · 6-Óculos em uso (OD/OE esf/cil/eixo) · 7-Adição · 8-Refração sob cicloplegia · 9-AV sob ciclo · 10-Motilidade ocular · 11-BIOM OD/OE (desenho + texto) · **12-PIO OD/OE mmHg + hora + gráfico PIO** · 13-Medicação em uso · 14-Usuário de LC · 15-FO (fundo de olho) OD/OE (desenho + texto) · 17-Conduta(s) · 18-Obs.
- **Exames Compl. 1:** Mapeamento de Retina OD/OE (texto + desenho) + Conclusão · Angiofluoresceinografia OD/OE + Conclusão · Retinografia OD/OE + Conclusão · **OCT** OD/OE + Conclusão.
- **Exames Compl. 2:** Paquimetria OD/OE · Microscopia Especular OD/OE · Topografia Corneana OD/OE · PAM OD/OE · Ecobiometria OD/OE · Sondagem de vias lacrimais · Curva tensional diária (horário, mmHg) · Gonioscopia OD/OE (ângulo superior/inferior/temporal/nasal, classificação, pigmentação) · **Campo visual comp.** OD/OE · Fotocoagulação (OD/OE) · Ultrassonografia OD/OE.

### 2.5 Ficha 0011 – C.E.S. (exames de sangue)
Hemácias, Hemoglobina, Hematócrito, VGM, Leucócitos, Neutrófilos, Promielócitos, Mielócitos, Metamielócitos, Bastões, Segmentados, Eosinófilos, Linfócitos, Monócitos, Blastos, Plaquetas, Glicose, Ureia, Creatinina, TGO, TGP, LDH, Fosf. Alcalina, Cálcio, Sódio, Potássio, CEA, CA-125, Vitamina B12, IgG, IgA, IgM, B2 Microglobulina, Fósforo, Bilirrubinas, Ácido Úrico, GGT, Ferritina, Proteínas totais, Albumina, Globulina, Reticulócitos, Colesterol total/HDL/LDL/VLDL, Triglicerídeos, T4 livre, T4 total.

### 2.6 Ficha 0012 – Ortóptica
1-Anamnese · 2-AV s/c (OD, OE, J) · 3-AV c/c · 4-Refração (OD/OE esf, cil, prisma, base) · 5-Adição · 6-Cover Test (longe/perto) · Hirschberg · Krimsky · 7-PPC · 8-TAM (Tef, Ppcl) · 9-Amplitude de fusão (divergente/convergente longe e perto) · 10-Luzes de Worth (longe/perto) · 11-Estereopsia (Frisby…) · 12-Versões …

### 2.7 Ficha 0013 – Lente de Contato
1-AV s/correção (OD/OE/J) · 2-AV c/correção · 3-Refração (OD/OE esf, cil, eixo) · 4-Tipo de lente · 5-K OD/OE · 6-Usa lente de contato? qual tipo · 7-AV c/ lente de contato · 8-Olho dominante.

### 2.8 Ficha 0018 – Óculos (receita)
Para longe OD/OE (Esf, Cil, Eixo) · DP · Adição AO/OD/OE · Para perto OD/OE (Esf, Cil, Eixo) · DP.

### 2.9 Ficha 0046 – Anamnese (Histórico Pregresso)
Cirurgias oculares (Catarata, Glaucoma, Transplante de córnea, Descolamento de retina, Fotocoagulação a laser – cada uma OD/OE "há quanto tempo") · Outras · Doenças oculares (Glaucoma OD/OE) · Doenças sistêmicas (Diabetes – há quantos anos, controlado, última glicemia de jejum, última hemoglobina glicada; Hipertensão; Hipercolesterolemia; Hipertrigliceridemia) · Medicações sistêmicas (Corticoide, Insulina, Aspirina, AS, Hipoglicemiante oral, Anti-hipertensivo, Anticoagulante, Hidroxicloroquina, Outras) · aba Família/Diagnósticos.

### 2.10 Ficha 0047 – Ficha de Retina
- **Ex. Oftalmológicos:** Acuidade visual corrigida / Refração OD/OE · Biomicroscopia: Córnea (transparente, precipitado cerático, edema) · Observações · Ângulo OD/OE (rubeosis, iridodiálise, sinéquia periférica) · Câmara anterior OD/OE (rubeosis íris, íris em plateau, sinéquia anterior/posterior, iridectomia/iridotomia, hipópio, hifema, ar/gás, perfluorocarbono líquido, óleo de silicone, células, flare) · Observação.
- **+Biomicroscopia:** Cristalino OD/OE · Pseudofácico (LIO no saco capsular, no sulco ciliar, na câmara anterior, descentrada, capsulotomia posterior, rotura/opacidade de cápsula posterior, indicação de capsulotomia Sim/Não) · Fácico (catarata, nuclear, subcapsular posterior/anterior, polar posterior, ectopia, subluxação) · Obs.

### 2.11 Ficha 0048 – Consulta
Inspeção / Motilidade / Pupila (OD/OE/AO: normal/alterada) · AV s/c OD/OE (20/…) · Óculos em uso (multifocal, bifocal, separado) e refração em uso · **Refração Longe** e **Perto** OD/OE (esf, cil, eixo, AV 20/… ou J) · DPL · DPP · Biomicroscopia (normal OD/OE/AO, blefarite, olho seco, outras alterações) + 2 desenhos · Fundoscopia (escavação OD/OE, alterado) …

### 2.12 Ficha 0049 – Ficha de Catarata (avaliação pré-operatória)
Refração OD/OE (esf, cil, eixo, AV, adição, J) · Ceratometria OD/OE (K1 a K2 × eixos) · Midríase OD/OE (mm) · Catarata: núcleo OD/OE, cortical, SCP · Reflexo OD/OE · Endotélio: microscopia OD/OE, guttata · SPH OD/OE · Biometria (IOL Master / Ultrassônica) · lente OD/OE + Grau + Refração planejada · Cirurgia planejada · Incisões relaxantes OD/OE · Observações.

### 2.13 Outras tabelas de "Ficha de dados" (Cadastros ▸ Tabelas ▸ Atendimento ▸ Ficha de dados)
Grupo de Limites · Limites · Campos · Arquétipos · Campos por procedimentos · Config. Central Imagens. **Arquétipos e Campos estão vazios** (não usados). Os procedimentos podem ter "fichas de dados para o PEP" ligadas (aba Atendimento do procedimento).

## 3. Modelos de texto (receitas, laudos, atestados, orientações)
**Caminho:** Cadastros ▸ Tabelas ▸ Atendimento ▸ **Textos** (56 modelos ativos)
**Categorias:** 01 Receitas · 02 Orientações · 03 Atestados · 04 Atestado · 05 Laudos · 06 Prescrição.
Campos de cada modelo: Código · Descrição · Abreviação · Categoria · Inativo · Texto de Laudo · Texto Resumo At. · Indicação Venda · editor de texto formatado (fonte, negrito, cores, alinhamento) · botão **Macros** (variáveis) · aba **Medicamentos** (medicamentos ligados ao texto).

**Variáveis (macros) usadas nos modelos:** `$Paciente$$Nome$` · `$Agenda$$Paciente$$Nome$` · `$Nome$` · `$Genérico$$Data.Atendimento$` · `$Genérico$$Data$` · `$Data.Atendimento$` · `$Hora_Atendimento$` · `$Medico.Nome$` · `$Medico.CRM$` · `$Medico.RQE$` · `$Medico.1o.titulo$`.

**Lista de modelos vistos (≈36 de 56):**
- **Laudos:** Angiografia · Gonioscopia · Laudo CID · Laudo Estrabismo (marcado "Laudo") · Laudo Oftalmológico · Laudo Ortóptica · Mapeamento de Retina (abrev. MAP) · OCT Mácula Normal · OCT Papila · PAM · Paquimetria · Curva de PIO Sobrecarga.
- **Atestados:** Atestado · Declaração de Comparecimento.
- **Orientações:** Facectomia · OCT Glaucoma Plano.
- **Receitas:** Prescrição de Óculos (simples) · Prescrição de Óculos / Access ou Desktop · Receita Blefarite · Conjuntivite · Conjuntivite Bacteriana · Conjuntivite Crianças · Ecofilm · Gel · Hordéolo · Lunah 1mg/ml ou 2mg/ml · Lunera · Olho Seco · Pós Injeção · Pós Laser · Pós Vitrectomia · Pós YAG Capsulotomia · Pós YAG Iridotomia · Suplementação Areds Dois · Suplementação Drusas · Suplementação Olho Seco …

**Exemplos de estrutura (sem dados de paciente):**
- *Prescrição de Óculos:* NOME/DATA (variáveis) · título "PRESCRIÇÃO DE ÓCULOS" · Para Longe · Para Perto · OBS (medir DNP e altura do centro óptico) · sugestão de marcas de lentes · bloco "ATENÇÃO" (responsabilidade, registro CROO-RJ da ótica, resolução SES-RJ 1438/1999, carimbo da ótica, certificado de lente multifocal).
- *Atestado Médico:* texto padrão com nome, data e hora do atendimento, dias de repouso, cidade (Nova Iguaçu), assinatura com nome, CRM, RQE e título do médico.
- *Mapeamento de Retina:* NOME/DATA · Olho Direito / Olho Esquerdo (papila, brilho macular, vasos, periferia, retina aplicada 360°) · Conclusão.
- *Receita Blefarite:* NOME/DATA · Uso ocular · itens com medicamento e posologia · orientações · assinatura do médico.

## 4. Medicamentos (para receitas)
**Caminho:** Cadastros ▸ Tabelas ▸ Atendimento ▸ **Medicamentos Ambulatoriais** (52 cadastrados)
Campos: Código · Nome · Componente ativo · Nome genérico · Abreviado · Laboratório · Comercialização (Livre / Tarja vermelha / Tarja preta) · Receituário normal/especial · Inativo · aba **Apresentação** (apresentação, **posologia padrão**, via de administração) · Observação · Outros.
Exemplos: Adaptis (gel – "01 gota, de 8-8h, em ambos os olhos", ocular), Artelac, Atropina 1%, Azitromicina 500 mg, Azorga, Blephagel, Combigan, Cylocort, Diamox 250 mg, Dorzal MT, Doxiciclina 100 mg, Drusolol, Duo-Travatan, Hyabak, Lacrifilm, Lumigan RC, Maleato de timolol 0,5%, Maxidex, Octifen, Ocupress, Omeprazol 20 mg, Optive, Patanol S … (lista parcial).
Também: Cadastros ▸ Tabelas ▸ Prescrição ▸ Formas de Aplicação · Intervalos de Aplicação.

## 5. Laudos estruturados
Cadastros ▸ Tabelas ▸ Laudo ▸ Títulos de Laudo / Frases de Laudo → **vazios**. Os laudos são feitos pelos **modelos de texto** (categoria Laudos).
Procedimentos podem ter "Possui Laudo" e Central de Imagens (ex.: OCT puxa imagens da pasta de rede do aparelho).

## 6. Solicitação de exames
Botão **Solicitação** na barra principal e Atendimentos ▸ Atendimento ▸ Solicitações Procedimento. Campos de solicitação ficam ligados ao procedimento ("Solicitação obrigatória", "padrão de observações nas solicitações"). **Tela não aberta** (pode criar registro).

## 7. Pendências desta área
1. **Ver o PEP "por dentro"** (abas do atendimento, histórico, impressão de receitas/atestados): precisa abrir um atendimento do **paciente de teste**. O botão "Abrir Atendimento" **cria** um registro de atendimento. Aguardando sua autorização.
2. Confirmar com os médicos **quais fichas** são usadas hoje (0014 Oftalmo III? 0048 Consulta? 0049 Catarata? 0047 Retina?).
3. Lista completa dos 56 modelos de texto e 52 medicamentos (vi parte).
4. CID-10: existe cadastro (Cadastros ▸ Tabelas ▸ Atendimento ▸ CID-10), não aberto.
