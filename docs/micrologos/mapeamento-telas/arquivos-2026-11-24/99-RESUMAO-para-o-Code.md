# RESUMÃO – Requisitos do sistema novo a partir do Micrologos

**Para:** equipe/agente de desenvolvimento (Claude Code) do sistema novo do **Hospital de Olhos da Baixada**.
**De:** mapeamento do Micrologos (ML Clinic Master ASP 13.13.30.00), feito em 22/11/2026 em modo leitura.
**Privacidade (LGPD):** nenhum dado de paciente foi copiado. Todos os exemplos usam pacientes de teste. Os XML reais foram analisados só na estrutura e nos códigos de configuração.

> **Como usar este pacote**
> - Este arquivo é a porta de entrada.
> - O detalhe completo está nos arquivos A, B, B2, C, C2, D, D2, E, E2, F, G e H da mesma pasta.
> - Onde este resumo e um arquivo detalhado divergirem, vale o **resumo**, porque inclui as respostas finais da Ana Carolina.

---

> **Regra de ouro (dona do sistema):** as configurações atuais do Micrologos **não geram glosa**. Replicar exatamente, convênio por convênio (arquivo I), e conferir contra os XML reais já aceitos.
> **Versão TISS:** a ANS publicou como vigente o Componente de Comunicação **04.03.00** (Padrão TISS Setembro/2026). O sistema deve gerar 4.01/4.02/4.03 por convênio e estar pronto para migrar todos para 4.03.00. Os links oficiais dos XSD estão no fim do arquivo I.

> **Novos arquivos (22/11/2026, tarde):**
> - **J-codigos-medicos-por-convenio.md:** códigos de cada médico por convênio, plano e hospital (executante e solicitante).
> - **K-hospitais-por-convenio.md:** os 14 hospitais e unidades, com CNES e código de cada um em cada operadora, e quais ainda são usados.
> - Pasta **"XML exemplos"** (Área de Trabalho): 9 XML reais, um de cada tipo de guia. **Contêm dados de pacientes**, então mandar só por canal seguro.

## 0. Prioridades (na ordem)

1. **TISS de cirurgias e de injeções intravítreas: perfeito, sem glosa.** É a prioridade nº 1 da dona do sistema. O XML gerado deve ser **idêntico em estrutura** ao que o Micrologos gera hoje e as operadoras aceitam (ver §4).
2. **Faturamento por convênio com regras próprias**: versão TISS, encoding, tipo de guia, fator de redução/acréscimo, pacotes, .zip.
3. **Acompanhamento pós-envio** (enviado → protocolo → demonstrativo → pago/glosado → recurso). Hoje isso não existe na prática. É a **principal melhoria** pedida.
4. Cadastros (convênios, tabelas, procedimentos, médicos, hospitais), agenda e PEP oftalmológico.

---

## 1. Empresa e prestador

| Item | Valor |
|---|---|
| Razão social cadastrada | Consumed Consultórios Médicos Ltda (nome fantasia no sistema: "Consumed") |
| CNPJ | 05.894.660/0001-87 |
| CNES do executante | **3176479** |
| Conselho / UF / CBO dos médicos | 06 (CRM) / 33 (RJ) / **225265** (oftalmologista) |

⚠️ **A confirmar:** se "Consumed" é o mesmo CNPJ do Hospital de Olhos da Baixada.

**Unidades = hospitais e centros cirúrgicos parceiros onde os médicos operam.** Existem 14 no Micrologos.
- Cada unidade precisa guardar, **por convênio**, o *código na operadora* e o *CNES*. Esses dados vão em `localContratado` da guia de honorários.
- Exemplos:
  - Bradesco → Pro Oftalmo, cód. 193216, CNES 5325722
  - Amil → Barra Day, cód. 73122076, CNES 102881

---

## 2. Convênios (detalhe em A-convenios.md)

### Ativos e faturados por XML

| Convênio | ANS | Cód. prestador na operadora | TISS | Observações |
|---|---|---|---|---|
| Amil | 326305 | 10453164 | 4.01.00 | Consulta vai **dentro da SP/SADT** (tipoAtendimento 04); cirurgia em Honorários; até 10 procedimentos por guia; lote com 12 dígitos; nº de guia sequencial único |
| Bradesco Saúde | 005711 | 0000110502 | **4.03.00** | XML **separado** do Bradesco Operadora; **.zip** obrigatório |
| Bradesco Saúde Operadora de Planos | 421715 | 0000110502 | **4.03.00** | idem |
| Fundação Saúde Itaú | 312126 | 00119315 | 4.01.00 | |
| Geap | 323080 | 17101182 | 4.01.00 | data dd/mm/aaaa |
| Hapvida (ex-NotreDame/Intermédica) | 359017 | CNPJ | 4.01.00 | |
| Klini Saúde | 422029 | CNPJ | **4.02.00** | **.zip** obrigatório; usa código próprio 98901012 na consulta |
| Mediservice | 333689 | CNPJ | 4.01.00 | **.zip** obrigatório |
| Porto Seguro Saúde | 000582 | 00119315 | 4.01.00 | |
| Portomed | 417491 | 00119315 | 4.01.00 | |
| Saúde Caixa | 312924 | CNPJ | 4.01.00 | |
| Select | 358053 | 46994084 | 4.01.00 | |
| Blue | 423173 | 005858 | 4.01.00 | ativo, sem pacientes recentes |
| **Unimed** (ANS 344397) | 344397 | ver abaixo | 4.01.00 | ver regra especial abaixo |

**Unimed é faturada por médico.** Cada médico cooperado é um "convênio" próprio:
- o prestador é Pessoa Física;
- o código usado é o código de cooperado do médico.

Além disso, existe a **Unimed Consumed Cirurgia** (PJ, código 1474), usada para cirurgias e injeções. Há também cadastro para um **cirurgião externo** que opera na clínica e fatura pela Unimed.
➜ No sistema novo: **um convênio pode ter vários "prestadores"** (PJ da clínica ou PF do médico), e cada um tem a própria numeração de lote e de guia.

**Atendidos, mas sem XML** (a funcionária digita direto no sistema do plano): Cedae Periódico, Cisbaf, Siass-Geap.
➜ No sistema novo, permitir convênio "sem TISS / faturamento externo", mas registrando o atendimento e o valor.

**Particulares:** Particular (planos Cortesia, Ótica, Clínica de Olhos, Dual Saúde, Total Life, Interclínicas) e Livre Escolha.
- Têm preço diferente para **cartão × dinheiro/Pix**.
- Emitem recibo e Dmed.

**Não atendidos mais (não migrar como ativos):** Appai, Assist, Assim, Golden Cross, Notre Dame (virou Hapvida), Dort Prev, Medprev.

> **Arquivo I-config-tiss-por-convenio.md:** traz, para cada um dos 19 convênios com XML, todas as caixas das abas 1ª/2ª/Outras Config. TISS do Micrologos. São as regras que a Micrologos já ajustou para cada operadora aceitar o XML. Use-o como **tabela de regras por convênio** do gerador de XML. Destaques:
> - Mediservice tem **máximo de 5 procedimentos por guia**; a Amil, 10.
> - Geap, Hapvida, Porto, Portomed e Unimed Luciano mostram data **dd/mm/aaaa** no cadastro. Gerar o XML igual aos XML reais já aceitos desses convênios.
> - Unimed Gelson usa **8 dígitos** no código TISS; os demais, 10.
> - Na Unimed Consumed, a via de acesso é "Única" no procedimento principal e "Mesma/Diversas" nos demais, e o valor unitário é o original.

### Configurações por convênio que o sistema novo precisa ter
Derivadas do cadastro TISS do Micrologos:
- Versão TISS (3.02.01 / 4.01.00 / 4.02.00 / 4.03.00).
- Encoding do XML. Na prática **todos os XML saem em ISO-8859-1**, mesmo onde o cadastro diz UTF-8 (Amil).
- Formato de data.
- Identificação do prestador: código na operadora **ou** CNPJ/CPF.
- Nº máximo de guias por lote e de procedimentos por guia (ex.: 10).
- Dígitos do nº do lote (12 no `sequencialTransacao`; 4 no nome do arquivo), da guia, da senha e do CNES.
- Numeração de guia: sequencial automática por tipo, ou numeração única para todos os tipos. Último número usado por tipo: Consulta, SP/SADT, Honorários, Solic./Resumo de Internação, OPME, Odonto, Recurso de Glosa.
- "Consultas na guia SP/SADT" (Amil).
- "Guia de Honorários se cirurgia" (Amil, Bradesco). Na Unimed é SP/SADT com pacote.
- Procedimentos que **não** vão no XML (autorizados on-line).
- Exige .zip no envio (Bradesco, Mediservice, Klini).
- Impostos por plano: ISS, IRRF, CSLL, PIS, COFINS, outras deduções. Hoje o lote desconta **15%** no total.
- Descontos de 2º a 5º procedimento (cirurgia/exames). Ex.: Amil, cirurgia 2º = 70% e 3º–5º = 50%; exames 50%.
- **Prazos (vazios no Micrologos; criar e preencher):** dia limite de fechamento, dia limite de entrega, prazo de recebimento (dias), prazo de retorno (dias), limites de atendimento por dia/mês.
- Máscara da carteirinha por plano.
- Validade da matrícula obrigatória.
- Token do paciente.

---

## 3. Procedimentos e tabelas de preço (detalhe em B e B2)

**Procedimentos:** 193 ativos, com código interno, AMB, CBHPM, **TUSS**, categoria e CH.
- Categorias: Consulta, Exames, Campo Visual, Cirurgia, Procedimentos, Material, Taxas.
- Campos úteis:
  - membros/olho (AO/OD/OE);
  - cirúrgico;
  - CID obrigatório;
  - solicitação obrigatória;
  - executante obrigatório;
  - permite sessões;
  - dias para retorno;
  - ficha do PEP ligada ao procedimento;
  - caminho de imagens (OCT etc.).

**Tabelas de preço:** 66 tabelas. Cada **plano** aponta para uma ou mais tabelas, com prioridade (ex.: Amil → tabelas "Amil" e "Amil Cirurgia").
- O preço e o **código enviado na guia** podem variar por tabela. Ex.: Klini usa 98901012 em vez do TUSS 10101012.
- A exigência de **autorização/senha** é marcada **por procedimento dentro de cada tabela** ("Necessita Autoriz.").

**Kits/pacotes por plano:** um procedimento pode virar um pacote (ex.: OCT → "Pacote OCT" em planos da Assim).

**Fator `reducaoAcrescimo` (CONFIRMADO pela dona):** a regra é **por contrato, convênio × procedimento**. Não pode ser padronizado.
- 2,00 em exames de ambos os olhos (Amil e Bradesco).
- 2,00 na facectomia do Bradesco.
- 1,00 na Amil.
➜ Criar uma tabela de regra **convênio × procedimento × lateralidade → fator**.

---

## 4. TISS – estrutura exata dos XML que funcionam hoje (detalhe em D2)

### Regras gerais
- `<?xml ... encoding="ISO-8859-1"?>` · transação `ENVIO_LOTE_GUIAS`.
- `sequencialTransacao` = nº do lote com 12 dígitos.
- `epilogo/hash` = **MD5** do conteúdo, calculado como no padrão TISS.
- **Nome do arquivo:** `<ANS 6 dígitos><AAAAMM><lote 4 dígitos>_<hash>.xml`. Para Bradesco, Mediservice e Klini, gerar também o `.zip` com o mesmo nome.
- **1 lote = 1 tipo de guia** (só Consulta, ou só SP/SADT, ou só Honorários).
- **1 lote = 1 prestador.** Bradesco Saúde e Bradesco Operadora geram lotes separados.

### 4.1 CIRURGIA – Guia de Honorários (Bradesco, Amil)
```
guiaHonorarios
 ├ cabecalhoGuia: registroANS, numeroGuiaPrestador
 ├ guiaSolicInternacao, senha, numeroGuiaOperadora
 ├ beneficiario: numeroCarteira, atendimentoRN
 ├ localContratado  → HOSPITAL onde operou (código na operadora + nome + CNES)
 ├ dadosContratadoExecutante → CLÍNICA (codigonaOperadora + cnesContratadoExecutante 3176479)
 ├ dadosInternacao: dataInicioFaturamento, dataFimFaturamento, caraterAtendimento (1)
 ├ procedimentosRealizados/procedimentoRealizado (1 por profissional)
 │   ├ sequencialItem, dataExecucao, procedimento (codigoTabela 22, código TUSS, descrição)
 │   ├ quantidadeExecutada, viaAcesso (1), tecnicaUtilizada (1)
 │   ├ reducaoAcrescimo, valorUnitario, valorTotal
 │   └ profissionais: grauParticipacao (00 cirurgião / 01 1º auxiliar), codProfissional,
 │                    nome, conselho 06, nº CRM, UF 33, CBO 225265
 ├ observacao, valorTotalHonorarios, dataEmissaoGuia
```
- Na 4.03.00 (Bradesco), `caraterAtendimento` e `atendimentoRN` aparecem sempre. Na 4.01.00 (Amil), nem sempre.
- Exemplos de códigos: Facectomia com LIO 30306027; Fistulizante antiglaucomatosa 30310032.

### 4.2 CIRURGIA e INJEÇÃO na UNIMED – SP/SADT com PACOTE (tabela 98)

| Código | Pacote |
|---|---|
| 69911312 | Tratamento ocular **Eylia** |
| 69911320 | **Ozurdex** |
| 69911070 | Facectomia com LIO |
| 69911096 | Fotocoagulação |
| 69911185 | Pálpebra – reconstrução total |

- `codigoTabela` 98 · `equipeSadt` com `grauPart` 00 · `reducaoAcrescimo` 1.00.
- `tipoAtendimento` 03 (ou 02) · `regimeAtendimento` 01 · `tipoConsulta` 2 · `indicacaoAcidente` 9 · `caraterAtendimento` 1.
- `indicacaoClinica` **preenchida**.
- `dadosAutorizacao` **obrigatório em 100% das guias:** numeroGuiaOperadora, **dataAutorizacao, senha, dataValidadeSenha**.
- O executante é a clínica, código 1474. O profissional na equipe usa o código de cooperado do médico. O solicitante pode ser a clínica ou o próprio médico (cirurgião externo).
- O medicamento vai **embutido no pacote**. Não há `outrasDespesas` nas amostras.
- Hoje **injeção só é cobrada na Unimed**. Amil, Bradesco, Geap e Hapvida estão em credenciamento. ➜ Permitir cadastrar um pacote de injeção por convênio no futuro (ex.: TUSS 30312132 + medicamento, conforme contrato).

### 4.3 EXAMES – SP/SADT (tabela 22, TUSS)
- Estrutura:
  - cabecalhoGuia
  - dadosAutorizacao
  - dadosBeneficiario
  - dadosSolicitante (contratado + profissional)
  - dadosSolicitacao (data, caráter, indicacaoClinica)
  - dadosExecutante (código + CNES)
  - dadosAtendimento (tipoAtendimento, indicacaoAcidente 9, tipoConsulta, regimeAtendimento 01)
  - procedimentosExecutados (… `equipeSadt` grauPart **12**, CBO 225265)
  - observacao
  - valorTotal
- `tipoAtendimento` **23** (exames) na Amil e no Bradesco.
- Exames frequentes: Tonometria 41301323, Microscopia especular 41301269, Ceratoscopia 41301080, Paquimetria 41501128, Mapeamento de retina 41301250, Retinografia 41301315, Gonioscopia 41301242, OCT 41501144, Biometria 41501012, Angiografia 41301013, US 40901017, Ortóptica 20103239, YAG 30306019, Fotocoagulação 30312043, Iridotomia 30310083, Campo visual 40103137.

### 4.4 CONSULTA – Guia de Consulta (Bradesco e outros)
- Estrutura:
  - cabecalhoConsulta
  - numeroGuiaOperadora
  - dadosBeneficiario
  - contratadoExecutante (código + CNES)
  - profissionalExecutante (conselho, nº, UF, CBO)
  - indicacaoAcidente
  - dadosAtendimento (regime, data, tipoConsulta, procedimento 22/10101012 + valor)
  - observacao
- **Amil:** a consulta vai como SP/SADT (ver §4.3, tipoAtendimento 04).

### 4.5 Validações obrigatórias antes de gerar o lote (anti-glosa)
Hoje essas validações **não existem**.
1. Senha, data de autorização e validade preenchidas e **validade ≥ data de execução** (sempre na Unimed; sempre em cirurgia e injeção).
2. Indicação clínica e CID preenchidos em cirurgia e injeção.
3. Fator de redução/acréscimo conforme a regra convênio × procedimento × olho.
4. Na Guia de Honorários: local (hospital) com código na operadora e CNES do convênio; equipe com grau de participação; CRM, UF e CBO do médico.
5. Carteirinha conforme a máscara do plano; validade da carteirinha.
6. Limite de procedimentos por guia e de guias por lote.
7. Lote só com um tipo de guia e um prestador; nº de lote sequencial por prestador.
8. Hash MD5 correto; validar o XML contra o **XSD oficial da versão** antes de liberar.

### 4.6 Guia "conferida = travada"
- No Micrologos, depois de conferida a guia só muda com **"Des-Conferir"**, que registra quem conferiu e quando. Manter esse controle e a auditoria (C2).
- A guia deve sair **pré-preenchida** a partir da conta, do convênio, do médico, da unidade e do **PEP**. Indicação clínica, tipo de atendimento e tempo de doença já são preenchidos no prontuário.
- Deve permitir imprimir a guia em PDF no modelo ANS.

---

## 5. Fluxo de faturamento (detalhe em C)

```
Agenda → Atendimento (PEP) → CONTA do paciente (itens) →
status: Pendente → Conferindo → Auditado → Liberado → TISS conferido →
LOTE por convênio/prestador/período → gerar XML (+ .zip) → envio manual no portal →
[NOVO] protocolo → previsão de pagamento → demonstrativo → pago / glosa → recurso → repasse
```

- **Conta:** itens com data, hora, código, quantidade, valor, tabela de preço usada, médico, CID, olho, nº da guia, senha, validade, técnica, via de acesso e procedimento principal.
- **Pendências** (tipos): Autorização errada · Erro de matrícula · Paciente esqueceu de assinar a guia · Aguardando autorização.
- **Lote ("Cobrança"):** valor enviado, impostos (15%), valor a receber. Em out/2026 foram 113 lotes.
- **Repasse aos médicos (percentual):**
  - médico 70% (geral);
  - consulta 60%;
  - campo visual 40%;
  - exceções por médico/plano: 100%, ou 50% com 15% de desconto.
  - ⚠️ Três percentuais apareceram cortados na tela; confirmar.
- **Volume:** cerca de 1.500 contas/mês; em 01/06–22/11/2026 foram 614 lotes.

---

## 6. ⭐ Módulo NOVO: acompanhamento pós-envio (principal melhoria pedida)

**Hoje:**
- Depois de gerar o XML, tudo é manual e fora do sistema.
- Os PDFs de protocolo, capa de lote, comprovante e recibo com previsão de pagamento ficam soltos nas pastas `C:\<convênio>`.
- O recurso de glosa da Unimed fica numa pasta própria.
- O Micrologos tem essa parte, mas é confusa e **nunca foi usada**.

**Requisitos:**
1. Status do lote: Gerado → Enviado (data, portal) → Protocolado (nº do protocolo + anexo PDF) → Em análise → Pago total / Pago parcial / Glosado → Em recurso → Encerrado.
2. Anexos no lote: XML, .zip, capa, comprovante, protocolo, demonstrativo.
3. **Previsão de pagamento** calculada pelo prazo do convênio e **alerta de atraso**.
4. Importar o demonstrativo de pagamento (XML de retorno TISS `demonstrativoAnaliseConta` / `demonstrativoPagamento`, quando a operadora fornecer) **ou** lançamento manual simples por guia/item.
5. **Glosa por item:** código do motivo (tabela ANS de glosas, 527 motivos), valor, reversível × irreversível.
6. **Recurso de glosa:** gerar a guia de recurso (XML TISS `recursoGlosa`), com prazo e status.
7. Painel por convênio: enviado × recebido × glosado × a receber, por mês, e o **% de glosa por motivo** (para alimentar as validações do §4.5).
8. Interface **simples**. A equipe não usava o do Micrologos por ser confuso.

---

## 7. Agenda e recepção (detalhe em F)
- Agenda por médico e por local (ambulatório e centro cirúrgico).
- Grade de **10 min** para médicos e **15 min** para o centro cirúrgico. Turnos manhã/tarde/noite.
- **Status:** Espera pendente, Espera, Re-espera, Atendendo, Atendido, Desistiu, Faltou, Cancelado pelo paciente, Cancelado pelo médico.
- Agendamento:
  - encaixe, urgência, 1ª vez, revisão/retorno, teleatendimento;
  - plano, matrícula e validade;
  - tipo de atendimento, especialidade, notas;
  - aba cirúrgica (tipo de anestesia);
  - status da autorização.
- Confirmação por e-mail/WhatsApp. Totem de chegada e chamada em TV.
- As regras de encaixe, 1ª vez e retorno ficam no cadastro de cada médico.

---

## 8. PEP oftalmológico (detalhe em E e E2)
O médico escolhe, em cada atendimento, quais **fichas** usar. Cada ficha acrescenta abas ao atendimento.

**Fichas:** Oftalmologia (I, II, III), Anamnese, Controle de Exames, Consulta, **Catarata**, **Retina**, Lente de Contato, Óculos, Ortóptica.

| Ficha | Conteúdo |
|---|---|
| Oftalmologia | Queixa; AV s/c, c/c e com correção (OD/OE); ex. externo; biomicroscopia; fundo de olho; tonometria OD/OE + hora + **gráfico da PIO**; motilidade; convergência; reflexos; PIO + paquimetria → **PIO corrigida automaticamente**; mapeamento com desenho OD/OE; **receita de óculos** (longe: esf/cil/eixo/DP; adição; perto calculado = longe + adição) |
| Catarata (pré-operatório) | refração; midríase; classificação da catarata (núcleo/cortical/SCP); reflexo; endotélio (microscopia, guttata); ceratometria; **biometria (IOL Master/US), LIO e grau, refração planejada**; cirurgia planejada; incisões relaxantes |
| Retina | córnea; ângulo; câmara anterior (rubeosis, sinéquias, hifema, óleo de silicone etc.); cristalino; pseudofácico/fácico; indicação de capsulotomia |

- **Painel TISS dentro do PEP:** tipo de saída, tipo de atendimento, indicação clínica (500 caracteres), observação, indicador de acidente, tempo e tipo de doença.
- Textos-modelo (56) para receitas, atestados e laudos, com variáveis (nome, data, CRM, RQE). Cadastro de 52 medicamentos.
- O menu do atendimento também tem: CID-10, medicamentos, imagens/multimídia, laudo com frase, prescrição, agendar paciente, programar retorno, **faturamento (selecionar procedimentos → gera a conta)**.

**Melhorias pedidas para o PEP novo:**
1. Dados do PEP **alimentam a guia TISS** automaticamente: indicação clínica, CID, olho, tipo de atendimento.
2. **Registro estruturado de injeção intravítrea:** olho, medicamento (Eylia/Ozurdex/Lucentis…), lote do medicamento, nº da dose, data, senha/autorização e validade. Deve gerar direto o item de pacote do convênio (Unimed 69911312 / 69911320). Hoje isso não existe.
3. **Cirurgia de catarata:** a LIO e o grau da ficha pré-operatória vão para a conta/guia (e OPME quando houver).

---

## 9. Migração de dados
- O Micrologos **não tem "exportar para Excel/CSV"** nas telas. Existem Relatórios ▸ Planilhas, os XML TISS e o Backup.
- ➜ **Pedir à Micrologos a exportação completa do banco de dados**: pacientes, agenda, prontuários, contas, tabelas e convênios.
- Os **XML TISS históricos** estão em `C:\<convênio>\` no computador do faturamento. Servem para conferir que o XML do sistema novo sai igual.
- Também servem para testes: escolher 1 lote de cada tipo (Honorários Bradesco, Honorários Amil, SP/SADT pacote Unimed, SP/SADT exames, Consulta Bradesco, Consulta Amil na SP/SADT). Usar **anonimizados**, por canal seguro.

---

## 10. Pendências em aberto (não bloqueiam o início do desenvolvimento)
1. CNPJ "Consumed" = Hospital de Olhos da Baixada? Quais das 14 unidades/hospitais ainda são usadas?
2. **Prazos por convênio** (envio, pagamento, retorno): levantar com o faturamento. No Micrologos estão vazios.
3. Planilha ou controle atual de pagamentos e glosas (colunas usadas), para desenhar o módulo do §6 parecido com o que a equipe já faz.
4. **Glosas mais frequentes** hoje (pasta "Recurso de glosa" da Unimed), para priorizar as validações.
5. A Amil aceita ISO-8859-1? (O cadastro diz UTF-8, mas o XML sai em ISO e é aceito.)
6. Os 15% de impostos variam por convênio?
7. Percentuais de repasse cortados na tela. Valores ≥ R$ 10 mil da tabela Particular que apareceram cortados.
8. Fichas do PEP ainda não vistas por dentro: Oftalmo II e III, Anamnese, Consulta, Lente de Contato, Ortóptica, Controle de Exames. Também falta ver a impressão da receita.
9. Portal de envio de cada operadora (para o checklist de envio).
