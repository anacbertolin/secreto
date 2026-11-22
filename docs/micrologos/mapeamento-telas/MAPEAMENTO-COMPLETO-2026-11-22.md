# MAPEAMENTO COMPLETO DO MICROLOGOS – arquivo único para o Code

Este arquivo junta os 15 arquivos do mapeamento. Comece pela Parte 1 (RESUMÃO). As partes seguintes são o detalhe.


---

**PARTE 1 – arquivo original: 99-RESUMAO-para-o-Code.md**

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


---

**PARTE 2 – arquivo original: 00-resumo.md**

# 00 – Resumo do mapeamento do Micrologos (ML Clinic Master ASP)

**Data:** 22/11/2026 · **Versão do sistema:** 13.13.30.00 · **Computador:** DESKTOP-MCDT7V5 · **Usuário:** AnaCarolina (MASTER)
**Modo:** somente leitura. Usei apenas os pacientes de teste ("Teste" código 69489 e "Teste Micrologos" 108477). Nenhum nome, CPF ou telefone de paciente foi anotado.

## Arquivos desta pasta
| Arquivo | Conteúdo |
|---|---|
| A-convenios.md | 32 convênios ativos + 4 inativos: planos, ANS, código do prestador, versão TISS, regras |
| B-tabelas-e-procedimentos.md | 193 procedimentos (TUSS/AMB/CBHPM), 66 tabelas de preço, qual plano usa cada tabela, kits/pacotes |
| B2-precos-por-tabela.md | Valores de todas as tabelas de preço |
| C-faturamento.md | Conta do paciente, guias, lotes (cobranças), glosas, pendências, repasse |
| D-xml-tiss.md | Onde ficam os XML, padrão do nome, versões |
| E-prontuario-pep.md | 12 fichas oftalmológicas com todos os campos, 56 modelos de texto, medicamentos |
| F-agenda-recepcao.md | Agenda, status, regras de marcação, horários |
| G-cadastros-de-apoio.md | Menus completos, unidades, médicos (CRM/CBO/TISS), especialidades, locais, motivos, cadastro de paciente |
| H-exportacao.md | Exportações e relatórios disponíveis |

## Principais descobertas
1. **Empresa no sistema = "Consumed Consultórios Médicos Ltda"** (CNPJ 05.894.660/0001-87, CNES 3176479). Não existe unidade "Hospital de Olhos da Baixada". Há outras 13 unidades (hospitais/centros cirúrgicos parceiros).
2. **TISS:** versão 4.01.00 na maioria; 4.03.00 (Bradesco); 4.02.00 (Cedae, Klini); 3.02.01 (particulares Appai/Assist). A configuração muda de convênio para convênio (formato de data, UTF-8 × ISO-8859-1, dígitos do lote, máx. 10 procedimentos por guia, consulta dentro da SP/SADT na Amil etc.).
3. **Tipos de guia usados:** Consulta (classif. "Consulta"), SP/SADT (exames e medicamentos), Honorário individual (cirurgia). Sem guias de internação em uso.
4. **Unimed faturada por médico:** cada médico cooperado é um "convênio" separado, com o próprio código; além da "Unimed Consumed Cirurgia" (PJ).
5. **Lotes ("Cobranças"):** um processo por convênio/período; o sistema desconta **15% de impostos** automaticamente; ao gerar o XML exige "Termo de concordância" e registra uma ocorrência.
6. **XML ficam em `C:\<nome do convênio>\`** neste computador (ex.: C:\Amil, C:\Bradesco, C:\Geap, C:\Klini, C:\Porto Seguro, C:\Unimed Gelson…). Nome: `<ANS><AAAAMM><lote>_<hash>.XML`.
7. **Envio às operadoras é manual** (portais). Nenhum web service/Orizon configurado.
8. **Protocolo, recebimento e glosa quase não são registrados no Micrologos** (só 1 lote de 2017). O controle deve estar fora do sistema.
9. **Prazos de envio/pagamento, prazo de retorno e limites por convênio estão vazios** no cadastro. A exigência de autorização fica marcada **por procedimento em cada tabela de preço** ("Necessita Autoriz.").
10. **Repasse:** regras percentuais — médico 70% (geral), consulta 60%, campo visual 40%, e exceções por médico/plano.
11. **PEP oftalmológico rico:** fichas com AV, refração (esf/cil/eixo, adição, DP), PIO com gráfico, biomicroscopia/fundo de olho com desenho, mapeamento, OCT, campo visual, gonioscopia, paquimetria, ficha pré-operatória de catarata, retina, lente de contato, ortóptica. Receitas/atestados/laudos por modelos de texto com variáveis (nome, data, CRM, RQE).
12. **Agenda:** intervalos de 10 min (médicos) / 15 min (centro cirúrgico); status Espera, Atendido, Desistiu, Faltou, Cancelado (paciente/médico), confirmações por e-mail/WhatsApp; regras de encaixe, 1ª vez, revisão e retorno no cadastro de cada médico.
13. **Exportação:** não há "exportar para Excel" nas telas; existem Relatórios ▸ Planilhas, XML TISS e relatórios diversos. Para migração completa, pedir **exportação do banco de dados** à Micrologos.

## O que NÃO deu para ver (por segurança)
- **Tela da guia TISS** (botão "TISS" da conta): pode gerar/registrar nº de guia.
- **PEP por dentro** (atendimento aberto, histórico, impressão de receita): "Abrir Atendimento" cria um atendimento.
- Tela de **Solicitação de exames**, **Cirurgia** e **Totem**: podem criar registros.
- Telas de geração de XML, entrega, fechamento, recebimento de protocolo, recurso de glosa: alteram dados.
- Relatórios e "Listar": não executados.
- Detalhe de cada plano (só o da Amil) e lista completa de alguns cadastros (planos da Assim/Hapvida/Mediservice/Porto, 56 textos, 52 medicamentos, especialidades).

## Ocorrência durante o mapeamento
Na Agenda, um clique abriu sem querer o formulário de **inclusão de agendamento**; fechei a busca de paciente sem selecionar ninguém e cliquei em **Cancela** — nada foi gravado. Também mudei por engano o **filtro de exibição "Status"** da tela da agenda (não altera dados; volta ao normal ao reabrir).

## Respostas recebidas (22/11/2026)
- **XML:** confirmado. São gerados no Micrologos e gravados direto nas pastas `C:\<convênio>\` deste computador.
- **Convênios que não são mais atendidos:** Appai, Assist, Assim e Golden Cross. Os demais foram confirmados como ativos.
- **Conferência no Micrologos (lotes de 01/06 a 22/11/2026, 614 processos):** tiveram cobrança Amil · Assist (último lote em 01/09/2026) · Bradesco Saúde / Bradesco Operadora · Fundação Saúde Itaú · Geap · Hapvida NotreDame/Intermédica · Klini · Mediservice · Porto Seguro · Portomed · Saúde Caixa · Select · Unimed Consumed (cirurgia) · Unimed Gelson · Unimed Gisele · Unimed Luciano · Unimed Max.
  **Respostas da Ana Carolina:**
  - **Blue:** atendido e faturado por XML, mas sem pacientes recentemente.
  - **Cedae, Cisbaf e Siass-Geap:** atendidos, mas **sem faturamento no Micrologos**. O paciente só é registrado no prontuário e a funcionária digita direto no sistema do plano.
  - **Notre Dame:** não é mais atendido (virou Hapvida).
  - **Unimed Dr. Antonio:** é médico de fora que **opera na clínica**. O cadastro existe para faturar as cirurgias dele.
  - **Unimed Dr. Pedro:** não atende pela Unimed.
  - **Bradesco Saúde** e **Bradesco Saúde Operadora de Planos:** é o mesmo Bradesco, mas com **XML separados** (registros ANS 5711 e 421715).
  - **Prioridade máxima:** o **TISS de cirurgias e de injeções intravítreas** precisa ficar perfeito no sistema novo, sem nenhuma alteração, para não gerar glosas.
  - **Fator 2,00** (ambos os olhos; facectomia Bradesco) está correto: a regra é **por contrato de cada convênio**.
  - **Injeções** são cobradas só na Unimed. Amil, Bradesco, Geap e Hapvida estão em credenciamento.
  - **Bradesco, Mediservice e Klini** exigem o lote em **.zip** no portal.
  **Sem nenhum lote no período:** Blue · Cedae Periódico · Cisbaf · Notre Dame (separado) · Siass-Geap · Unimed Antonio · Unimed Pedro (Particular e Livre Escolha não geram lote). A confirmar se ainda são atendidos ou se são cobrados por fora.
- **Depois do envio do XML**, o controle de protocolo, pagamento, glosa e fechamento **não é feito no Micrologos**, porque essa parte é confusa e nunca foi usada. ➜ **Requisito para o sistema novo:** um módulo simples de acompanhamento pós-envio (lote enviado → protocolo → demonstrativo → pago / glosado → recurso), que hoje não existe na prática.

## Perguntas em aberto
1. O CNPJ/empresa "Consumed Consultórios Médicos" é o do Hospital de Olhos da Baixada? As outras 13 unidades ainda são usadas?
2. Onde vocês controlam **protocolos, pagamentos, demonstrativos e glosas** hoje (planilha? portal?)
3. Por qual **portal/canal** cada operadora recebe os XML (portal próprio, Orizon, outro)?
4. **Prazos** de envio e de pagamento e **prazo de retorno** de cada convênio: existe uma lista fora do sistema?
5. A **Assim** ainda é atendida? As 3 tabelas de preço dela não estão ligadas a nenhum plano.
6. Quais **fichas do PEP** os médicos usam hoje (Oftalmo III, Consulta, Catarata, Retina…)?
7. Os 15% descontados nos lotes são todos impostos? Variam por convênio?
8. Confirmar os percentuais de repasse que aparecem cortados (provavelmente 100%) e se há outras regras fora do sistema.
9. Posso (ou você prefere) clicar em **"TISS"** na conta do paciente de teste e em **"Abrir Atendimento"** do paciente de teste, para completar o mapeamento da guia e do PEP? Isso cria registros de teste.
10. Valores da tabela Particular que aparecem cortados (≥ R$ 10 mil?): Blefaroplastia Sup+Ptose, Ciclofotocoagulação Transescleral, Faco/goniotomia, Faco/TREC, Implante de Dreno Susanna, TREC/VVPP.
11. Quem pode pedir à Micrologos a **exportação do banco de dados** para a migração?


---

**PARTE 3 – arquivo original: A-convenios.md**

# A) Convênios — Micrologos (ML Clinic Master ASP 13.13.30.00)

**Caminho:** Cadastros ▸ Convênios/Planos Saúde
**Status do mapeamento:** concluído (somente leitura, modo "Visualizando"; nada foi alterado).

> Observação de privacidade: três convênios usam o nome de uma pessoa física (ex.: o convênio de código 19 e os "Unimed + nome do médico"). Nos Unimed o nome é do **médico credenciado** (não de paciente). O código 19 parece ser um particular com nome de pessoa — está anotado como "[nome de pessoa]". CPFs de médicos não foram copiados.

---

## 1. Estrutura da tela

Janela com 3 abas no topo: **Visão Geral · Detalhamento · Faturamento**.
Barra lateral esquerda: Buscar · Alterar · Incluir · Listar · Excluir · Opções · Ajudar · Sair. Setas de navegação (primeiro/anterior/próximo/último registro) no canto superior esquerdo.
Rodapé: data/hora · modo (Visualizando / Alterando) · filtro. Cada registro mostra "Incluído por / data" e "Atualizado por / data".

### 1.1 Aba "Visão Geral"
- **Busca:** campo Descrição; caixas "em toda a descrição" e "Busca plano de saúde"; opção Ativos / Inativos / Ambos; botão **Aplicar Busca**; contador "Qnt. Linhas".
- Grade de convênios: Código · Descrição.
- Quadro **Planos de Saúde** (do convênio selecionado): botões Inclui Plano · Altera Plano · Exclui Plano · Opções; sub-abas Visão Geral / Detalhamento.
  - Grade de planos: Código · Descrição · Descrição TISS · Partic · Web · Teleatend · Pessoa Fis · Part.PJ
  - **Detalhamento do plano** – sub-abas:
    - **Dados:** Descrição; Descr. TISS; Máscara (da carteirinha – ex.: 999999…); Telefone; Contato; Acomodação (Apartamento / Enfermaria / Ambos); caixas Plano Padrão, Particular, Inativo, Vê na Web, Pessoa Física, Associados, Particular PJ, Teleatendimento; Dígitos iniciais da matrícula.
    - **Tabelas:** tabelas de preço ligadas ao plano – colunas Código · Descrição · Valor CH · Prioridade · Categoria de Local (botões Inclui/Altera/Exclui Tabela). Ex.: plano Amil → tabelas 81 "Amil" e 83 "Amil Cirurgia" (Valor CH 0,0000; prioridade 20; "Sem Categoria de Local").
    - **Cash Adv** (integração financeira): Plano Financeiro (ex.: "Zrecebimentos de Convenios"); Portador (ex.: Itaú); Empresa (ex.: Consumed).
    - **Financeiro:** Prazo Recebimento; Fechamento; Usar esse CH + valor; Valor do Filme; Cód. Filme (TISS); Custo Operacional; "Ñ Multiplica"; Tabela de Preço acordada para pacotes.
    - **Detalhes:** Observação; Classificação do paciente (Ouro, Prata, Bronze, Prioridade, Vermelho, Preto, Azul, Sem Classificação).
    - **Permissões:** Qtd dias p/ permitir o **retorno** do paciente; Qtd atendimentos no mês p/ o mesmo paciente; Qtd atendimentos permitidos no mês; Qtd atendimentos permitidos no dia; "No agendamento obrigatório senha do supervisor".
    - **Impostos:** Outras deduções %; ISS %; Valor mínimo de guia (p/ IRRF); IRRF %; Vl. mínimo p/ impostos; CSLL %; PIS/PASEP %; COFINS %; botão "Copia p/ todos".
    - **Descontos:** % por 2º–5º procedimento (Centro Cirúrgico) e Agenda de Exames (mesma área / áreas diferentes).

### 1.2 Aba "Detalhamento" (do convênio)
Cabeçalho: Código · Descrição · Inativo · **Emitente** (cadastro financeiro ligado, com código) · Unidade · Portador Boleto.

Sub-abas:
1. **Adicionais**
   - Observação (pode aparecer no PEP).
   - Qtd. atendimentos permitidos no dia; **Validade da matrícula obrigatória**; **Utiliza token de paciente**.
   - Financeiro (Cobrança): **Dia limite Fech. das Contas**; **Dia limite de Entrega** (+ "Dia útil"); **Prazo Recebimento (dias)**.
   - Obrigatoriedades: CPF do Titular do Plano.
   - Outros: Abre + Info. Proced. Ag.; SUS; **Fatura uma Conta para cada Sessão** (+ "Fatura todas as sessões já incluídas"); Desmembra itens da conta para cada sessão realizada (+ "só na chegada"); Permite cobrança de Fat. mesmo sem Conferir, Liberar e Conf. TISS; **Guia de solicitação no agendamento não obrigatória**.
   - **Tipo de Faturamento:** 1 mesma Conta p/ várias Agendas · 1 ou + Contas p/ cada agenda · Ambas.
2. **Descontos** – % do valor para 2º–5º procedimento (Centro Cirúrgico; Agenda de Exames mesma área / áreas diferentes); regras "% sempre em cima de um único valor (o maior)"; sub-abas Gerais / Por Categoria de Procedimento. Ex. Amil: cirurgia 2º=70%, 3º–5º=50%; exames 50%.
3. **1ª Config. TISS**
   - Código utilizado pelo Convênio: CPF/CNPJ **ou** Cód. Operadora.
   - Código para definir Prod/Serv nas guias: Micrologos · Brasíndice · SIMPRO · Cód. na Tab. Preço.
   - Nº sequencial da guia automático; Numeração única p/ todos os tipos de guia.
   - **Últimos nºs de guia** por tipo: Solic. Internação · Resumo Intern. · Consulta · OPME · SP/SADT · Honorários · Odontologia · Recurso Glosa (ou um nº único). Comprovante Presencial.
   - **Versão TISSNet:** Data Formato; Data/Hora Formato; xml version/encoding (UTF-8 ou ISO-8859-1); Usa CBO-S Ago/2011; Hora formato; Diagnóstico (diagnosticoAtendimento); **versaoPadrao**.
4. **2ª Config. TISS**
   - Procedimentos que **não** irão no XML (autorizados on-line).
   - Usa config. própria de nº de guias por XML; **Nº de guias que podem ir no XML**; Qtd dígitos nº do Lote (ex.: 12); Qtd dígitos no Lote do Nome do Arq.; Qtd dígitos senha autorização; Qtd dígitos nº CNES; Não utiliza TISS.
   - Guias: Info Doença Obrigatório; **Qtd. Máx. de Procedimentos na guia** (ex.: 10); Qtd dígitos nº guia; Não mostra CID; Grava CID na Indicação; Grava Obs Itens na Indic.; Grava c/Cód.; Não usa padrão ANS Reapresentação; Usa campo "C.R.M." do médico (completo).
   - Para sair na Observação: Descrição CID / Só Consulta; Mensagem livre.
   - **Imagem p/ impressão de guias** (logo da operadora): Associar / Desassociar imagem.
5. **Outras Config. TISS** – dezenas de regras de montagem de guia/XML em sub-abas:
   - **SP/SADT:** guia "Solicitação de Outras Despesas" p/ cirúrgicos; grau de participação; agrupar por produto+preço; totais; valor de pacote; não escrever `<membroEquipe>`/`<equipeSadt>`; Qt.Autoriz = Qt.Solic; Data emissão = data solicitação; sessão em série; **Consultas na guia SP/SADT**; Proced. categoria "Consulta" com tipo ≠ consulta → SP/SADT; Não escreve tipo de consulta; Utiliza Guia de Honorário Médico se for Cirurgia; Tipo Atendimento padrão.
   - **Hon/Outras Desp:** honorários só p/ cirúrgicos; contratado = próprio médico; somar guias iguais; pacote fora de honorários; XML com senha e validade; honorários com valor 0; código na operadora p/ contratado e executante; CNPJ/CPF em codigoPrestadorNaOperadora; Guia de Outras Despesas (não agrupar, filme como material, por classificação, por acomodação, unidade de conversão).
   - **Res. Intern.:** equipe na guia de resumo, somas no total, equipe com código na operadora, membro de equipe desmembrado etc.
   - **1º Geral:** médicos solicitantes/executantes/contratados (cadastro de códigos nas operadoras); totais por página; quantidade/valor unitário/% Red./Acresc.; pacotes; procedimentos zerados.
   - **2º Geral:** senha/nº guia principal; data de autorização em branco = data da conta; tag `<ans:cpf>`; zeros no código TISS; dígitos do Cód. TISS (ex.: 10); HASH minúsculo; ficha/CPF/nasc. na observação; CIDs; hora início/fim; hora agendada nos cirúrgicos.
   - **3º Geral:** guia única p/ toda a equipe; staff; via de acesso (Única/Mesma/Diversas); não incluir material e medicamentos no XML.
   - **4º Geral:** layout 1 procedimento por cabeçalho; código de barras do nº da guia; assinatura do médico; observação SP/SADT; **Não envia nº da carteira do paciente**.
6. **Complementares**
   - Operadora: Razão social (TISS/ABRANGE); Código na empresa de conectividade; **Código do registro na ANS**; **Último lote de XML**.
   - Prestadora (clínica): Pessoa Física/Jurídica; CNPJ ou CPF; Nº CRO; Nome/razão social do prestador; **Código junto à operadora**; **Código CNES**; Emitente associado.
   - Sub-abas: Configurações Gerais · **Configurações Abrange** (plano × código Abrange; prefixo de numeração) · **Configurações SUS** (órgão origem/destino, versões APAC/BPA/AIH, CNS do médico, certificado) · **Web Service** (Ambiente: Homologação / Produção / Sem ambiente – Amil está "Sem ambiente").

### 1.3 Aba "Faturamento" (do convênio)
Gráfico de faturamento do convênio: Período (Diário…); base (Por Dt. Faturamento…); Início/Fim; Tipo (Linha…); Texto acima (Valor); 3D; Degradê; Legenda; Geral da Clínica; botões **Faz Gráfico** e **Lista Gráfico**.

### 1.4 Menu "Opções" (barra lateral)
Refaz · Navega c/setas · Faz gráfico dos convênios selecionados · Seleciona todos os convênios · Copia Convênio · Importações ▸ Genérica de planos de saúde · Alterar classificação do plano nos pacientes · Informa campo em cinza na guia (até Vs. 2.02.03) ▸ · Gestor Eletrônico de Documentos ▸ (Visualiza GED Ctrl+Alt+V / Captura GED Ctrl+Alt+G).
**Exportação:** não há opção de exportar para Excel/CSV nesta tela. Existe o botão **Listar** (relatório) – não acionado para evitar impressão acidental.

---

## 2. Dados gerais do prestador (iguais em quase todos os convênios)
- Prestador PJ: **Consumed Consultórios Médicos Ltda** (variações: "Consumed", "Consumed Olhos", "Consumed Clínica de Olhos", "…Ltda Me")
- CNPJ: 05.894.660/0001-87 · **CNES: 3176479** · Emitente associado: Consumed (23)
- Nos convênios Unimed "por médico", o prestador é **Pessoa Física (o próprio médico)**, com o código do cooperado como "código junto à operadora".
- Integração financeira (plano Amil): Plano financeiro "Zrecebimentos de Convenios", portador Itaú, empresa Consumed.

> ⚠️ Pergunta: o sistema está cadastrado como "Consumed". É o mesmo CNPJ do Hospital de Olhos da Baixada?

---

## 3. Convênios ativos (32)

Legenda: **Cód.Op.** = código usado é o código na operadora; **CNPJ** = usa CPF/CNPJ. "—" = campo vazio no cadastro.
Prazos (dia limite de fechamento, dia limite de entrega, prazo de recebimento) e "qtd. atendimentos/dia" estão **vazios em todos os convênios** na aba Adicionais.

| Cód | Convênio | Planos (cód – nome) | ANS | Código do prestador na operadora | TISS | Código | Último lote XML | Regras marcadas |
|---|---|---|---|---|---|---|---|---|
| 28 | Amil | 384 Amil | 326305 | 10453164 | 4.01.00 (UTF-8) | Cód.Op. | 198 | Nº guia sequencial e único (último 7000000164); Consultas na guia SP/SADT; Guia de Honorário se cirurgia; até 10 proced./guia; lote 12 dígitos; usa CRM completo; tabelas 81 Amil e 83 Amil Cirurgia |
| 9 | Assim | ~25+ planos: 11 Comum, 18 Prefeitura, 24 Comlurb, 62 Absoluto, 63 Ambulatorial, 64 Azul, 65 Azul Std, 66 Básico, 67 Exclusivo II, 68 Exclusivo III, 69 Fik, 70 Ideal, 71 Ideal Adesão, 72 Mass I, 73 Mass II, 74 Primer, 75 Prime Evan, 76 Rio Clássico, 77 Rio Clássico Ambulatorial, 78 Rio Clássico I, 79 Rio Clássico I Ind… (lista continua) | — | — | 4.01.00 (ISO-8859-1) | Cód.Op. | — | Validade matrícula obrigatória; token; fatura 1 conta por sessão (todas incluídas); desmembra só na chegada; guia solicitação não obrigatória; últimos nºs: Solic.Int 100, Res.Int 110, Consulta 112, SP/SADT 124, Honor. 19, Recurso glosa 1. **Complementares vazio** |
| 6 | Assist | 9 Assist | 309028 | 534 (conectividade 534) | 4.01.00 | Cód.Op. | 562 | Matrícula obrig.; token; todas sessões; só na chegada |
| 31 | Blue | 389 Blue | 423173 | 005858 | 4.01.00 | Cód.Op. | 4 | 1 conta por sessão; guia solicitação não obrig. Razão social "Blue Company" |
| 2 | Bradesco Saúde | 4 Bradesco Empresa; 5 Bradesco Individual | 5711 | 0000110502 | **4.03.00** | Cód.Op. | 1676 | Matrícula; token; todas sessões; só na chegada |
| 23 | Bradesco Saúde Operadora de Planos | 344 Ope. Empresa; 345 Ope. Individual (ambos Teleatend. e Part.PJ) | 421715 | 0000110502 | **4.03.00** | Cód.Op. | 1674 | Token; todas sessões; só na chegada |
| 35 | Cedae Periódico | 458 Cedae Periódico | — | — | 4.02.00 (dd/mm/aaaa) | CNPJ | — | — |
| 36 | Cisbaf | 459 Cisbaf | — | — | **sem versão configurada** | CNPJ | — | — |
| 21 | Fundação Saúde Itaú | 49 Fun Básico/Básico V; 50 Fun Especial…; 51 Fun Executivo…; 52 Fun Executivo VI… | 312126 | 00119315 | 4.01.00 | Cód.Op. | 521 | Matrícula; token; seq. auto (Res.Int 642383, Honor. 642381) |
| 16 | Geap | 27 Geap.; 254 Saúde; 255 Família; 256 Essencial; 257 Essencial Agregados; 258 Preferência; 259 Pref. Agregados; 260 Clássico; 261 Clássico Agregados; 262 Saúde II; 263 Saúde Vida; 264 Saúde Vida Grupo Familiar; 265 Referência Vida; 266 Pref. Vida Grupo Fam; 267 Para Você RJ; 268 Para Você RJ Grupo Familiar | 323080 | 17101182 | 4.01.00 (dd/mm/aaaa) | Cód.Op. | 376 | Matrícula; token; seq. auto (SP/SADT 82367340, Consulta 23660879, Res.Int 51234637, Honor. 61234567) |
| 19 | [nome de pessoa] | 30 (marcado Particular) | — | — | não usa | — | — | Matrícula; token |
| 7 | Golden Cross | 14 Inativo; 15 Golden Cross; 331 Superior; 332 Especial; 333 Especial Adesão; 334 Plena; 335 Essencial; 336 Essencial Adesão; 337 Básica; 338 Supermed 1 2 3; 339 Golden Care; 340 Fit | 403911 | 05894660000187 (CNPJ) | 4.01.00 (UTF-8) | CNPJ | 560 | Matrícula; token; seq. auto (SP/SADT 1187053, Consulta 423664811, Res.Int 475, Honor. 458) |
| 17 | Hapvida NotreDame/Intermédica | 28 Hapvida…; 105–108 Inativo 1–4; 109 Intermedical 400 Max 400; 110 401 Max 400 Plus; 111 500 Max 500; 112 501 Max 500 Plus; 113 1000 Max 800 Plus; 114 Inativo 5; 115 402 Rede Max400 H; 116 Inativo 6; 117 403 Max400 Plus H; 118 503 Max500 Plus H; 119 304 Max300 Bronze; 120 305 Max300 Bronze Plus; 121 404 Max400 Prata; 122 405 Max400 Prata Plus; 123 Inativo 17; 124 Intermedical Agr Extra RJ… (lista continua) | 359017 | 05894660000187 (CNPJ) | 4.01.00 (dd/mm/aaaa) | CNPJ | 1923 | Matrícula; token; todas sessões; só na chegada |
| 25 | Klini Saúde | 368 Klini Saúde | 422029 | 05894660000187 | 4.02.00 | CNPJ | 390 | 1 conta por sessão; guia solicitação não obrig. |
| 24 | Livre Escolha | 352 Livre Escolha (Particular) | — | — | não usa | — | — | Token |
| 12 | Mediservice | 19 Mediservice; 269 Aracruz Branco; 270 Aracruz Branco Apto; 271 …Apto 1; 272 Aracruz Ouro; 273 Aracruz Prata; 274 Branco A Enfermaria; 275 Branco Ambulatorial; 276 Branco Apto c/ Odonto; 277 Branco Enfermaria; 278 Branco Enf. c/ Odonto; 279 Bronze A; 280 Bronze Apto; 281 Bronze Apto c/ Odonto; 282 Bronze B; 283 Bronze C; 284 Bronze 12; 285 Caterpillar Branco; 286 Caterpillar Branco Apto; 287 Caterpillar Bronze; 288 Caterpillar Prata… (lista continua) | 333689 | 05894660000187 | 4.01.00 (UTF-8) | CNPJ | 222 | Matrícula; token; todas sessões; só na chegada |
| 18 | Notre Dame | 29 Notre Dame; 203–214 Notre Nds 110 a 190; 215 Master I/II; 216 Basic; 217 Standard; 218 Special; 219 Class; 220 Executive; 221 Select; 222 Exclusive… | 359017 | 17687 | 4.01.00 (dd/mm/aaaa) | Cód.Op. | 458 | Matrícula; token; sem emitente financeiro |
| 1 | Particular | 1 Particular; 2 [nome] Particular; 16 Cortesia; 17 Ótica; 343 Clínica de Olhos (Teleatend., Pessoa Fís., Part.PJ); 353 Dual Saúde Integrada; 361 Total Life (Part.PJ); 365 Sistema Interclínicas | — | — | não usa | — | — | Matrícula; token; Tipo de faturamento não marcado |
| 13 | Particular Appai | 20 Particular Appai | 999999 | 05894660000187 | 3.02.01 | Cód.Op. | — | Emitente "Particular" |
| 14 | Particular Assist | 21 Particular Assist | 999999 | 05894660000187 | 3.02.01 | Cód.Op. | — | Emitente "Assist" |
| 20 | Porto Seguro Saúde | ~25 planos: 31 Bronze I–X; 32 Empresarial Básico/Superior/Especial; 33 Prata…; 34 Empresarial Pleno; 35 Portomed Prata; 36 Ouro I a X; 37 Ouro Porto…; 38 Empresarial Sênior; 39 Portomed Ouro; 40 Diamante…; 41 Empresarial Master; 42 Portomed Diamante; 55–61 Copar (Bronze/Prata/Ouro/Diamante); 341 Cristal I a X; 342 Cristal Copar (341/342 Teleatend. e Part.PJ) | 582 | 00119315 | 4.01.00 (dd/mm/aaaa) | Cód.Op. | 527 | Matrícula; token; nº guia sequencial e único (último 12345685) |
| 34 | Portomed | 456 Porto Serviços 1 Copar; 457 Porto Serviços 2 Copar | 417491 | 00119315 | 4.01.00 | Cód.Op. | 487 | Seq. auto |
| 27 | Saúde Caixa | 383 Saúde Caixa | 312924 | 05894660000187 | 4.01.00 | CNPJ | 74 | 1 conta por sessão; guia solicitação não obrig.; nº único (último 1281) |
| 32 | Select | 426 Select | 358053 | 46994084 | 4.01.00 | Cód.Op. | 5 | 1 conta por sessão; guia solicitação não obrig.; sem emitente |
| 30 | Siass-Geap | 388 Siass-Geap | — | — | 4.01.00 | CNPJ | — | Seq. auto (SP/SADT 1, Consulta 49) |
| 29 | Unimed "Antonio" (médico) | 385 Unimed NI; 386 Unimed 0037; 387 Unimed Outras | 344397 | código do médico (PF) | 4.01.00 | Cód.Op. | — | Seq. auto (SP/SADT 1187057); CNES 9999999 |
| 26 | Unimed Consumed Cirurgia | 380 NI Cirurgia; 381 0037 Cirurgia; 382 Outras Cirurgia | 344397 | 1474 (PJ "Consumed Olhos") | 4.01.00 | Cód.Op. | 260 | Seq. auto (SP/SADT 0001187224) |
| 8 | Unimed "Gelson" (médico) | 12 NI; 22 Outras; 363 Rio 0037 | 344397 | código do médico (PF) | 4.01.00 | Cód.Op. | 1531 | Matrícula; token; seq. auto (SP/SADT 9379060007, Consulta 2) |
| 10 | Unimed "Gisele" (médica) | 13 NI; 23 Outras; 364 Rio 0037 | 344397 | código da médica (PF) | 4.01.00 | Cód.Op. | 986 | Matrícula; token; observação com telefone de contato |
| 15 | Unimed "Luciano" (médico) | 25 NI; 26 Outras; 366 Rio 0037 | 344397 | código do médico (PF) | 4.01.00 (dd/mm/aaaa) | Cód.Op. | 690 | Matrícula; token |
| 22 | Unimed "Max" (médico) | 53 NI; 54 Outros; 367 Rio 0037 | 344397 | código do médico (PF) | 4.01.00 | Cód.Op. | 211 | Matrícula; token |
| 33 | Unimed "Pedro" (médico) | 441 Unimed Outras | 344397 | 1474 (PF) | 4.01.00 | CNPJ | — | — |

Todos usam **Brasíndice** como código de produtos/serviços nas guias.

### Convênios inativos (4)
5 Appai (plano 8 Appai Plano) · 3 Dort Prev · 11 Golden · 4 Medprev.

---

## 4. Observações para o sistema novo
- Versões TISS em uso: **4.01.00** (maioria), **4.03.00** (Bradesco), **4.02.00** (Cedae, Klini), **3.02.01** (particulares Appai/Assist), e convênios sem TISS (particulares).
- A Unimed é faturada **por médico** (cada médico é um "convênio" com prestador PF), além de uma Unimed PJ para cirurgia.
- Formatos de data e codificação do XML variam por convênio (aaaa-mm-dd × dd/mm/aaaa; UTF-8 × ISO-8859-1).
- **Prazo de retorno, limites de atendimento, prazos de envio e pagamento NÃO estão preenchidos** no Micrologos (nem no convênio, nem no plano Amil conferido). Provavelmente são controlados fora do sistema.
- Exigência de senha/autorização: não há um campo "exige senha" no convênio; o que existe é "Guia de solicitação no agendamento não obrigatória", "Utiliza token de paciente" e "Validade da matrícula obrigatória". Ver Área C para o campo senha nas guias.
- Tipos de guia: todos os convênios com TISS têm numeração para Consulta, SP/SADT, Honorários, Solic./Resumo de Internação, OPME, Odontologia e Recurso de Glosa; Amil marca "Consultas na guia SP/SADT".

## 5. O que não deu para ver / pendências
- Detalhes de cada plano (Tabelas, Permissões, Impostos) foram conferidos **só no plano Amil**. Os demais planos não foram abertos um a um.
- Listas de planos longas (Assim, Hapvida, Mediservice, Porto Seguro) foram anotadas parcialmente.
- Relatório "Listar" não foi acionado.


---

**PARTE 4 – arquivo original: B-tabelas-e-procedimentos.md**

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


---

**PARTE 5 – arquivo original: B2-precos-por-tabela.md**

# B2) Valores por tabela de preço — Micrologos

Fonte: Cadastros ▸ Tabelas ▸ Produtos/Serviços ▸ Preços (consulta em 22/11/2026). Valores em R$. (*) = "Necessita Autorização" marcado no item. "Dt.Ref." = data de referência da tabela.

## Tabela 81 – Amil (Dt.Ref. 26/02/2015)
| TUSS | Procedimento | Valor (R$) | CH |
|---|---|---|---|
| 41301013 | Angiografia | 33,05 | 90 |
| 41301170 | Avaliação de Vias Lacrimais | 34,15 | 93 |
| 41501012 | Biometria | 55,08 | 150 |
| 40103137 | Campo Visual Computadorizado | 29,38 | 80 |
| 30306019 | Capsulotomia YAG ou Cirúrgica | 404,43 | 650 |
| 41301080 | Ceratoscopia Corneana | 45,90 | 125 |
| 10101012 | Consulta | 68,00 | 0 |
| 10101012 | Consulta em Consultório | 68,00 | 0 |
| 30304032 | Corpo Estranho da Córnea – Retirada | 37,33 | 60 |
| 41301129 | Curva Tensional Diária binocular | 45,90 | 125 |
| 41301200 | Exame de Motilidade Ocular | 11,02 | 30 |
| 30306027 | Facectomia (material, cód. 77) | 0,00 | 0 |
| 30306027 | Facectomia com Implante de LIO | 684,42 | 1100 |
| 30312043 | Fotocoagulação a Laser | 248,88 | 400 |
| 41301242 | Gonioscopia | 29,38 | 80 |
| 30312132 | Implante Intravítreo de Polímero (Ozurdex) | 4.200,00 | 0 |
| 30310083 | Iridotomia (YAG Laser) | 186,66 | 300 |
| 41301250 | Mapeamento de Retina | 23,87 | 65 |
| 41301269 | Microscopia Especular | 128,52 | 350 |
| 41501128 | Paquimetria Ultrassônica | 55,08 | 150 |
| 41301307 | Potencial de Acuidade Visual | 18,36 | 50 |
| 41301315 | Retinografia | 18,36 | 50 |
| 41301471 | Teste do Reflexo Vermelho | 11,02 | 30 |
| 41501144 | Tomografia de Coerência Óptica Monocular | 178,56 | 486,28 |
| 41301323 | Tonometria | 9,18 | 25 |
| 40901530 | Ultrassonografia Ocular | 55,08 | 150 |

## Tabela 83 – Amil Cirurgia (01/09/2016)
| TUSS | Procedimento | Valor (R$) | CH |
|---|---|---|---|
| 30303010 | Autotransplante Conjuntival | 311,10 | 0 |
| 30310024 | Cicloterapia – Qualquer Técnica | 73,44 | 0 |
| 30311020 | Cirurgia com Sutura Ajustável | 470,11 | 755,56 |
| 30310032 | Cirurgias Fistulizantes Antiglaucomatosas | 404,43 | 650 |
| 30313031 | Dacriocistorrinostomia | 435,54 | 700 |
| 30301106 | Dermatocalaze ou Blefarocalaze | 276,54 | 444,44 |
| 30307031 | Endolaser/Endodiatermia | 368,71 | 592,59 |
| 30311039 | Estrabismo Ciclo Vertical/Transposição | 423,10 | 680 |
| 30311047 | Estrabismo Horizontal Monocular | 512,84 | 824,24 |
| 30306027 | Facectomia com Implante de LIO | 684,42 | 1100 |
| 30312043 | Fotocoagulação a Laser | 0,00 | 0 |
| 30307040 | Implante de Silicone Intravítreo | 1.244,40 | 2000 |
| 30307058 | Infusão de Perfluorcarbono | 368,72 | 592,592 |
| 30307066 | Membranectomia Epi ou Sub-Retiniana | 368,71 | 592,59 |
| 30312132 | Ozurdex Implante Intravítreo | 3.188,57 | 0 |
| 30301165 | Pálpebra – Reconstrução Parcial | 248,88 | 400 |
| 30303060 | Pterígio – exérese | 174,22 | 280 |
| 30301181 | Ptose Palpebral – Correção Cirúrgica | 217,77 | 350 |
| 30304156 | Radiação para Crosslinking Corneano | 1.480,00 | 0 |
| 30301190 | Ressecção de Tumores Palpebrais | 186,66 | 300 |
| 30312086 | Retinopexia com Introflexão Escleral | 684,42 | 1100 |
| 30307112 | Vitrectomia Anterior | 404,43 | 650 |
| 30307120 | Vitrectomia Vias Pars Plana | 902,19 | 1450 |
| 30301270 | Xantelasma Palpebral – exérese | 186,66 | 300 |

## Tabela 25 – Appai Particular (03/05/2015)
| TUSS | Procedimento | Valor (R$) |
|---|---|---|
| 41301013 | Angiografia | 360,00 |
| 41501012 | Biometria | 100,00 |
| 40103137 | Campo Visual Computadorizado | 144,00 |
| 30306019 | Capsulotomia YAG | 360,00 |
| 41301080 | Ceratoscopia Corneana | 171,00 |
| 41301129 | Curva Tensional Diária | 126,00 |
| 30312043 | Fotocoagulação a Laser | 270,00 |
| 50140019 | Fotocoagulação a Laser Ao | 900,00 |
| 41301242 | Gonioscopia | 90,00 |
| 30310083 | Iridotomia | 360,00 |
| 20101198 | Lente de Contato | 0,00 |
| – | Lente Gelatinosa | 300,00 |
| – | Lente Multifocal | 800,00 |
| – | Lente Rígida | 1.000,00 |
| – | Lente Tórica | 600,00 |
| 41301250 | Mapeamento de Retina | 153,00 |
| 41301269 | Microscopia Especular | 171,00 |
| 41501128 | Paquimetria | 126,00 |
| 41301307 | Potencial de Acuidade Visual | 117,00 |
| 41301315 | Retinografia | 135,00 |
| 41501144 | Tomografia de Coerência Óptica | 360,00 |
| 40901530 | Ultrassonografia Ocular | 252,00 |

## Tabela 22 – Appai Plano (03/05/2015)
| 10101012 | Consulta em Consultório | 26,22 |
| 41301323 | Tonometria | 8,39 |

## Tabela 23 – Assim (26/02/2015)  — (*) = "Necessita Autoriz." marcado
| TUSS | Procedimento | Valor (R$) | CH |
|---|---|---|---|
| 41301013 | Angiografia | 59,60 | 175 |
| 41501012 | Biometria | 82,50 | 150 |
| 40103137 | Campo Visual Computadorizado | 27,24 | 80 |
| 30306019 | Capsulotomia YAG | 221,00 | 650 |
| 41301080 | Ceratoscopia Corneana | 85,14 | 250 |
| 98050389 | Consulta | 51,60 | 0 |
| 30304032 | Corpo Estranho da Córnea | 19,80 | 60 |
| 41301129 | Curva Tensional Diária | 68,75 | 125 |
| 30313031 | Dacriocistorrinostomia | 399,00 | 700 |
| 30301106 | Dermatocalaze/Blefarocalaze | 171,00 | 300 |
| 30301122 | Epilação de Cílios (*) | 49,50 | 150 |
| 30306027 | Facectomia com Implante de LIO | 627,00 | 1100 |
| 30312043 | Fotocoagulação a Laser | 136,00 | 400 |
| 30312043 | Fotocoagulação a Laser Ao (*) | 136,00 | 400 |
| 41301242 | Gonioscopia | 44,00 | 80 |
| 30312132 | Implante Intravítreo de Polímero (Ozurdex) | 613,62 | 0 |
| 30311055 | Injeção de Toxina Botulínica | 49,40 | 0 |
| 30310083 | Iridotomia | 102,00 | 300 |
| 41301250 | Mapeamento de Retina | 35,75 | 65 |
| 41301269 | Microscopia Especular | 119,20 | 350 |
| – | Pacote VVPP+Endo+Óleo+Faco | 0,00 | 0 |
| 30301165 | Pálpebra – Reconstrução Parcial | 228,00 | 400 |
| 41501128 | Paquimetria | 82,50 | 150 |
| 41301307 | Potencial de Acuidade Visual | 17,03 | 50 |
| 30301181 | Ptose Palpebral | 199,50 | 350 |
| 30301190 | Ressecção de Tumores Palpebrais | 171,00 | 300 |
| 41301315 | Retinografia | 17,03 | 50 |
| 30313066 | Sondagem das Vias Lacrimais | 45,60 | 80 |
| 41301471 | Teste do Reflexo Vermelho | 37,49 | 100 |
| 41401301 | Teste Provocativo para Glaucoma | 24,00 | 0 |
(lista pode continuar além da tela)

## Tabela 30 – Assim Cirurgia (26/02/2015)
| TUSS | Procedimento | Valor (R$) | CH |
|---|---|---|---|
| 30303010 | Autotransplante Conjuntival | 285,00 | 500 |
| 30301033 | Blefarorrafia | 142,50 | 250 |
| 30301050 | Cantoplastia Lateral | 57,00 | 100 |
| 30301068 | Cantoplastia Medial | 68,40 | 120 |
| 30311020 | Cirurgia com Sutura Ajustável | 334,60 | 0 |
| 30310032 | Cirurgias Fistulizantes Antiglaucomatosas | 370,50 | 650 |
| 30301084 | Correção Cirúrgica de Ectrópio/Entrópio | 171,00 | 300 |
| 30307031 | Endolaser/Endodiatermia (*) | 114,00 | 200 |
| 30309018 | Enucleação ou Evisceração | 228,00 | 400 |
| 30311039 | Estrabismo Ciclo Vertical | 228,00 | 400 |
| 30311047 | Estrabismo Horizontal Monocular | 228,00 | 400 |
| 30306027 | Facectomia com Implante de LIO (*) | 627,00 | 1100 |
| 30310075 | Goniotomia ou Trabeculotomia | 400,00 | – |
| 30307040 | Implante de Silicone Intravítreo (*) | 114,00 | 200 |
| 30306060 | Implante Secundário/Explante (*) | 484,50 | 850 |
| 30307058 | Infusão de Perfluorcarbono (*) | 114,00 | 200 |
| 30307066 | Membranectomia Epi/Sub-Retiniana | 200,00 | 0 |
| 30301173 | Pálpebra Reconstrução Total (*) | 513,00 | 900 |
| 30303060 | Pterígio – exérese (*) | 159,60 | 280 |
| 30303079 | Reconstituição de Fundo de Saco | 313,50 | 550 |
| 30313058 | Reconstituição de Vias Lacrimais | 513,00 | 900 |
| 30312086 | Retinopexia com Introflexão Escleral (*) | 627,00 | 1100 |
| 30307082 | Retirada de Óleo de Silicone | 542,64 | 952 |
| 30301246 | Tarsorrafia (*) | 68,40 | 120 |
| 30302137 | Tumor de Órbita – Exérese | 513,00 | 900 |
| 30307112 | Vitrectomia Anterior (*) | 370,50 | 650 |
| 30307120 | Vitrectomia Vias Pars Plana (*) | 826,50 | 1450 |

## Tabela 36 – Assim Pacote (01/08/2016)
| Cód. | Pacote | Valor (R$) |
|---|---|---|
| 98050222 | Pacote Capsulotomia YAG Laser | 450,00 |
| 98051849 | Pacote Fotocoagulação | 150,00 |
| 98050621 | Pacote Iridotomia YAG Laser | 270,00 |
| 98050362 | Pacote OCT | 237,36 |
| 98050354 | Pacote OCT Monocular | 134,16 |
| 98051164 | Pacote Ozurdex | 3.096,00 |
| 98050370 | Pacote Tratamento Ocular Lucentis | 2.889,60 |
| 98050354 | Tomografia de Coerência Óptica Monocular | 134,16 |
| 98050370 | Tratamento Ocular Quimioterápico (*) (CH 5600) | 2.889,60 |

## Tabela 11 – Assist (01/01/2015)
| 10101012 | Consulta | 41,33 |
| 10101012 | Consulta em Consultório | 41,33 |
| 41301323 | Tonometria | 9,64 |

## Tabela 26 – Assist Particular (03/05/2015)
Igual à Appai Particular, exceto: Biometria 99,00; Mapeamento de Retina 135,00. Itens: Angiografia 360,00 · Biometria 99,00 · Campo Visual 144,00 · Capsulotomia YAG 360,00 · Ceratoscopia 171,00 · Curva Tensional 126,00 · Fotocoagulação 270,00 · Gonioscopia 90,00 · Iridotomia 360,00 · Lente de Contato 0,00 · Lente Gelatinosa 300,00 · Multifocal 800,00 · Rígida 1.000,00 · Tórica 600,00 · Mapeamento de Retina 135,00 · Microscopia Especular 171,00 · Paquimetria 126,00 · Potencial de Acuidade Visual 117,00 · Retinografia 135,00 · OCT 360,00 · Ultrassonografia Ocular 252,00.

## Tabela 85 – Blue (17/03/2025)
| 41301013 | Angiografia | 76,00 |
| 41501012 | Biometria | 76,00 |
| 30306019 | Capsulotomia YAG | 266,00 |
| 41301080 | Ceratoscopia Corneana | 95,00 |
| 30304032 | Corpo Estranho da Córnea | 30,40 |
| 30312043 | Fotocoagulação a Laser | 190,00 |
| 41301242 | Gonioscopia | 30,40 |
| 30310083 | Iridotomia | 190,00 |
| 41301269 | Microscopia Especular | 133,00 |
| 41501128 | Paquimetria | 57,00 |
| 41301315 | Retinografia | 22,80 |
| 40901530 | Ultrassonografia Ocular | 57,00 |

## Tabela 84 – Blue Pacote (17/03/2025)
| 98901120 | Consulta em Consultório | 100,00 |

## Tabela 31 – Bradesco Cirurgia (26/02/2015)  (*) = necessita autorização
| 30303010 | Autotransplante Conjuntival | 223,18 |
| 30310172 | Cirurgia Antiglaucomatosa Via Angular | 827,84 |
| 30311020 | Cirurgia com Sutura Ajustável | 626,48 |
| 30310032 | Cirurgias Fistulizantes Antiglaucomatosas | 757,49 |
| 30310040 | Cirurgias Fistulizantes com Implantes | 865,85 |
| 30304105 | Delaminação Corneana com Fotoablação | 786,04 |
| 30307031 | Endolaser/Endodiatermia (*) | 337,94 |
| 30301122 | Epilação de Cílios | 55,39 |
| 30311039 | Estrabismo Ciclo Vertical | 740,19 |
| 30311047 | Estrabismo Horizontal Monocular | 714,48 |
| 30306027 | Facectomia com Implante de LIO (*) | 1.191,27 |
| 30304091 | Fotoablação de Superfície Convencional | 555,35 |
| 30310075 | Goniotomia ou Trabeculotomia | 874,31 |
| 30307040 | Implante de Silicone Intravítreo (*) | 542,20 |
| 30306060 | Implante Secundário/Explante | 699,82 |
| 30312051 | Infusão de Gás Expansor | 254,64 |
| 30307058 | Infusão de Perfluorcarbono (*) | 337,94 |
| 30307066 | Membranectomia Epi/Sub-Retiniana | 699,82 |
| 30301165 | Pálpebra – Reconstrução Parcial | 297,11 |
| 30303060 | Pterígio – exérese (*) (CH 280) | 217,66 |
| 30301190 | Ressecção de Tumores Palpebrais | 200,54 |
| 30312086 | Retinopexia com Introflexão Escleral (*) | 970,37 |
| 30307090 | Troca Fluido Gasosa | 320,37 |
| 30307112 | Vitrectomia Anterior | 998,25 |
| 30307120 | Vitrectomia Vias Pars Plana (*) | 1.150,36 |

## Tabela 4 – Bradesco Empresa (26/02/2016)
| 41301013 | Angiografia | 81,64 |
| 41301170 | Avaliação de Vias Lacrimais | 31,72 |
| 41301030 | Avaliação Órbito-palpebral-exoftalmométrica | 23,82 |
| 41501012 | Biometria | 59,50 |
| 40103137 | Campo Visual Computadorizado | 31,72 |
| 30306019 | Capsulotomia YAG | 343,65 |
| 41301080 | Ceratoscopia Corneana | 99,17 |
| 10101012 | Consulta | 135,44 |
| 10101012 | Consulta em Consultório | 135,44 |
| 30304032 | Corpo Estranho da Córnea | 57,15 |
| 41301129 | Curva Tensional Diária | 49,58 |
| 41501012 | Ecobiometria | 59,50 |
| 30301122 | Epilação de Cílios | 54,57 |
| 41301200 | Exame de Motilidade Ocular | 23,97 |
| 20103239 | Exercícios de Ortóptica por Sessão | 11,65 |
| 30312043 | Fotocoagulação a Laser | 343,65 |
| 30312043 | Fotocoagulação a Laser Ao | 343,65 |
| 41301242 | Gonioscopia | 49,58 |
| 30310083 | Iridotomia | 337,94 |
| 41301250 | Mapeamento de Retina | 27,50 |
| 41301269 | Microscopia Especular | 138,87 |
| 41501128 | Paquimetria | 59,50 |
| 41301307 | Potencial de Acuidade Visual | 19,82 |
| 41301315 | Retinografia | 23,31 |
| 30313066 | Sondagem das Vias Lacrimais | 85,41 |
| 41301471 | Teste do Reflexo Vermelho | 28,88 |
| 41501144 | Tomografia de Coerência Óptica | 77,84 |
| 41301323 | Tonometria | 13,74 |
| 40901017 | Ultrassonografia Bilateral | 156,39 |

## Tabela 3 – Bradesco Individual (26/02/2016)
Mesmos valores da Bradesco Empresa, com estas diferenças: sem Avaliação de Vias Lacrimais, sem Epilação de Cílios, sem Fotocoagulação Ao, sem Sondagem; Corpo Estranho 64,04.

## Tabela 79 – Caixa Ambulatório (26/02/2015)
| 41301013 | Angiografia | 178,18 |
| 41301170 | Avaliação de Vias Lacrimais | 82,54 |
| 41501012 | Biometria | 95,07 |
| 40103137 | Campo Visual | 94,36 |
| 30306019 | Capsulotomia YAG | 278,68 |
| 41301080 | Ceratoscopia Corneana | 116,33 |
| 10101012 | Consulta / Consulta em Consultório | 132,64 |
| 30304032 | Corpo Estranho da Córnea | 56,37 |
| 41301129 | Curva Tensional Diária | 86,24 |
| 41301200 | Exame de Motilidade Ocular | 30,10 |
| 20103239 | Exercícios de Ortóptica por Sessão | 14,09 |
| 30312043 | Fotocoagulação a Laser | 278,68 |
| 41301242 | Gonioscopia | 33,12 |
| 30310083 | Iridotomia | 278,68 |
| 41301250 | Mapeamento de Retina | 60,90 |
| 41301269 | Microscopia Especular | 136,76 |
| 41501128 | Paquimetria | 63,50 |
| 41301307 | Potencial de Acuidade Visual | 33,39 |
| 41301315 | Retinografia | 28,18 |
| 30313066 | Sondagem das Vias Lacrimais | 74,31 |
| 41301471 | Teste do Reflexo Vermelho | 42,27 |
| 41501144 | Tomografia de Coerência Óptica | 240,85 |
| 41301323 | Tonometria | 35,04 |
| 40901530 | Ultrassonografia Ocular | 154,45 |

## Tabela 80 – Caixa Cirurgia (23/05/2024)
| 98500937 | Pacote Facectomia com Implante de LIO | 3.497,46 |
| 98501240 | Pacote Facectomia com Implante de LIO | 3.169,58 |

## Tabela 93 – Cedae Periódico (03/08/2025)
| 68000210 | Consulta/tonometria | 130,00 |

## Tabela 94 – Cisbaf (04/09/2025) — usa códigos SUS (SIGTAP)
| 0301010072 | Consulta oftalmológica com Tono/Fundo | 120,00 |
| 0301010072 | Consulta oftalmologista | 100,00 |
| 0211060186 | Retinografia Fluorescente Binocular | 100,00 |

## Tabela 15 – Cortesia (01/01/2015)
Todos os itens com valor 0,00: Angiografia, Biometria, Campo Visual, Ceratoscopia, Consulta, Curva de Pressão, Ecobiometria, Ecobiometria (fora), Facectomia c/ LIO, Fotocoagulação, Gonioscopia, Laser (uma única sessão), Lente de Contato, Mapeamento de Retina, Microscopia Especular, Paquimetria, Potencial de Acuidade Visual, Retinografia, Taxa de Sala, Tonometria, Ultrassonografia Ocular.

## Tabela 8 – Dortprev (01/01/2015) — sem código TUSS
Angiografia 300,00 · Biometria 0,00 · Campo Visual 100,00 · Ceratoscopia 170,00 · Consulta 100,00 · Curva de Pressão 80,00 · Ecobiometria 100,00 · Ecobiometria (fora) 170,00 · Facectomia c/ LIO 2.500,00 · Fotocoagulação 500,00 · Gonioscopia 60,00 · Laser (uma única sessão) 300,00 · Lente de Contato 0,00 · Mapeamento de Retina 100,00 · Microscopia Especular 170,00 · Paquimetria 100,00 · Potencial de Acuidade Visual 70,00 · Retinografia 120,00 · Taxa de Sala 0,00 · Tonometria 50,00 · Ultrassonografia Ocular 170,00.

## Tabela 74 – Dual Saúde Integrada (27/10/2022) — usa códigos AMB antigos (5001xxxx)
Todos 0,00, exceto Campo Visual Computadorizado (50010042) 140,00 e Consulta (00010014) 0,01.

## Tabela 60 – Fundação Saúde (CH 0,224?) (01/05/2017) — valor = CH × fator
| TUSS | Procedimento | Valor | CH |
|---|---|---|---|
| 41301013 | Angiografia | 22,40 | 100 |
| 41501012 | Biometria | 44,80 | 200 |
| 40103137 | Campo Visual | 33,60 | 150 |
| 41301080 | Ceratoscopia | 28,00 | 125 |
| 10101012 | Consulta / Consulta em Consultório | 146,00 | 0 |
| 41301129 | Curva de Pressão | 33,60 | 150 |
| 41301242 | Gonioscopia | 17,92 | 80 |
| 41301250 | Mapeamento de Retina | 17,92 | 80 |
| 41301269 | Microscopia Especular | 78,40 | 350 |
| 41501128 | Paquimetria | 33,60 | 150 |
| 41301307 | Potencial de Acuidade Visual | 11,20 | 50 |
| 41301315 | Retinografia | 13,44 | 60 |
| 30313066 | Sondagem das Vias Lacrimais | 176,79 | 0 |
| 41301471 | Teste do Reflexo Vermelho | 5,60 | 25 |
| 41501144 | Tomografia de Coerência Óptica | 88,93 | 397 |
| 41301323 | Tonometria | 5,60 | 25 |
| 40901530 | Ultrassonografia Ocular | 33,60 | 150 |

## Tabela 61 – Fundação Saúde (CH 0,28) (01/05/2017)
Mesmos itens e CH da tabela 60, com fator 0,28: Angiografia 28,00 · Biometria 56,00 · Campo Visual 42,00 · Ceratoscopia 35,00 · Consulta 146,00 · Curva Tensional 42,00 · Gonioscopia 22,40 · Mapeamento 22,40 · Microscopia 98,00 · Paquimetria 42,00 · Potencial AV 14,00 · Retinografia 16,80 · Sondagem 176,79 · Reflexo Vermelho 7,00 · OCT 111,16 · Tonometria 7,00 · Ultrassonografia 42,00.

## Tabelas 62, 63 e 64 – Fundação Saúde Cirurgia (01/05/2017) — valores iguais nas três
| TUSS | Procedimento | Valor | CH |
|---|---|---|---|
| 30306019 | Capsulotomia YAG | 739,90 | 700 |
| 30304032 | Corpo Estranho da Córnea (só 63 e 64) | 84,56 | 80 |
| 30307031 | Endolaser/Endodiatermia (*) | 705,02 | 667 |
| 30306027 | Facectomia com Implante de LIO (*) | 1.585,50 | 1500 |
| 30312043 | Fotocoagulação a Laser | 528,50 | 500 |
| 30312043 | Fotocoagulação a Laser Ao | 528,50 | 500 |
| 30307040 | Implante de Silicone Intravítreo (*) | 1.691,20 | 1600 |
| 3.03.06.06 | Implante Secundário/Explante | 898,45 | 850 |
| 30307038 | Infusão de Perfluorcarbono (*) | 705,02 | 667 |
| 30310083 | Iridotomia | 528,50 | 500 |
| 30303060 | Pterígio – exérese (*) | 422,80 | 400 |
| 30312086 | Retinopexia com Introflexão Escleral (*) | 1.585,50 | 1500 |
| 50040049 | Retirada de Corpo Estranho da Córnea (só 62) | 84,56 | 80 |
| 30307112 | Vitrectomia Anterior | 739,90 | 700 |
| 30307120 | Vitrectomia Vias Pars Plana (*) | 1.532,65 | 1450 |

## Tabela 39 – Geap (12/12/2016)
| 41301013 | Angiografia | 60,00 |
| 41501012 | Biometria | 38,88 |
| 40103137 | Campo Visual | 23,32 |
| 30306019 | Capsulotomia YAG | 160,00 |
| 41301080 | Ceratoscopia | 48,60 |
| 30310032 | Cirurgias Fistulizantes Antiglaucomatosas | 368,00 |
| 10101012 | Consulta | 90,00 |
| 30304032 | Corpo Estranho da Córnea | 32,00 |
| 41301129 | Curva de Pressão / Curva Tensional | 29,16 |
| 41301200 | Exame de Motilidade Ocular | 12,80 |
| 30306027 | Facectomia com Implante de LIO | 560,00 |
| 30312043 | Fotocoagulação a Laser / Laser Ao | 160,00 |
| 41301242 | Gonioscopia | 24,00 |
| 30310083 | Iridotomia | 160,00 |
| 41301250 | Mapeamento de Retina | 14,40 |
| 41301269 | Microscopia Especular | 68,04 |
| 41501128 | Paquimetria | 36,45 |
| 41301307 | Potencial de Acuidade Visual | 9,72 |
| 41301315 | Retinografia | 47,95 |
| 30313066 | Sondagem das Vias Lacrimais | 42,00 |
| 41301471 | Teste do Reflexo Vermelho | 14,40 |
| 41501144 | Tomografia de Coerência Óptica | 78,93 |
| 41301323 | Tonometria | 12,80 |
| 40901017 | Ultrassonografia Bilateral | 44,16 |

## Tabela 45 – Geap Cirurgias (12/12/2016)
| 30310032 | Cirurgias Fistulizantes Antiglaucomatosas | 368,00 |
| 30307031 | Endolaser/Endodiatermia | 160,00 |
| 30306027 | Facectomia com Implante de LIO | 560,00 |
| 30307040 | Implante de Silicone Intravítreo | 160,00 |
| 30306060 | Implante Secundário/Explante | 340,00 |
| 30307058 | Infusão de Perfluorcarbono | 160,00 |
| 30312132 | Ozurdex Implante Intravítreo (*) | 588,10 |
| 30312086 | Retinopexia com Introflexão Escleral | 476,00 |
| 30307120 | Vitrectomia Vias Pars Plana | 524,00 |

## Tabela 40 – Geap Medicamento (12/12/2016)
| – | Ozurdex Geap (*) | 3.912,99 |

## Tabela 32 – Golden Cirurgia (01/09/2016)
Itens e valores **idênticos à tabela 83 – Amil Cirurgia** (mesmas 24 linhas, mesmos CH). Necessita autorização: Endolaser, Facectomia c/ LIO, Implante de Silicone, Pterígio, Retinopexia, Vitrectomia Pars Plana.

## Tabela 27 – Golden Cross (26/02/2015)
Igual à tabela 81 – Amil, com estas diferenças: Angiografia 64,26 (CH 175) · Avaliação de Vias Lacrimais 27,20 (CH 74,072) · Campo Visual 39,17 (CH 106,66) · Gonioscopia 23,87 (CH 65) · Teste do Reflexo Vermelho 13,22 (CH 36) · OCT 91,80 (CH 250) · Ultrassonografia Ocular 44,06 (CH 120).

## Tabela 65 – Golden Material (01/09/2017)
| 92111726 | Lente Intraocular | 380,00 |

## Tabela 41 – Hapvida NotreDame/Intermédica (01/01/2017)
| TUSS | Procedimento | Valor | CH |
|---|---|---|---|
| 41301013 | Angiografia | 24,00 | 175 |
| 30303010 | Autotransplante Conjuntival | 180,00 | 0 |
| 41301170 | Avaliação de Vias Lacrimais | 19,92 | 0 |
| 41501012 | Biometria | 48,00 | 150 |
| 40103137 | Campo Visual | 28,80 | 100 |
| 30306019 | Capsulotomia YAG | 252,00 | 700 |
| 41301080 | Ceratoscopia | 28,80 | 250 |
| 30311020 | Cirurgia com Sutura Ajustável | 476,00 | 0 |
| 30310032 | Cirurgias Fistulizantes Antiglaucomatosas | 396,00 | 0 |
| 30310040 | Cirurgias Fistulizantes com Implantes | 479,88 | 0 |
| 00010014 | Consulta | 47,82 | 0 |
| 30304032 | Corpo Estranho da Córnea | 28,80 | 60 |
| 30301084 | Correção de Ectrópio/Entrópio | 144,00 | 0 |
| 41301129 | Curva Tensional Diária | 36,00 | 125 |
| 30313031 | Dacriocistorrinostomia | 360,00 | 0 |
| 30307031 | Endolaser/Endodiatermia | 240,12 | 0 |
| 30309018 | Enucleação ou Evisceração (*) | 392,00 | 800 |
| 30301122 | Epilação de Cílios (*) | 28,80 | 150 |
| 30311039 | Estrabismo Ciclo Vertical | 514,80 | 0 |
| 30311047 | Estrabismo Horizontal Monocular | 360,00 | 0 |
| 41301200 | Exame de Motilidade Ocular | 9,60 | 0 |
| 20103239 | Exercícios de Ortóptica por Sessão | 4,80 | 0 |
| 30306027 | Facectomia com Implante de LIO | 540,00 | 1100 |
| 30306043 | Facectomia sem Implante de LIO | 324,00 | 0 |
| 30312043 | Fotocoagulação a Laser / Laser Ao | 120,00 | 0 |
| 41301242 | Gonioscopia | 19,20 | 80 |
| 30310075 | Goniotomia ou Trabeculotomia | 479,88 | 0 |
| 30307040 | Implante de Silicone Intravítreo | 360,00 | 0 |
| 30306060 | Implante Secundário/Explante | 306,00 | 0 |
| 30307058 | Infusão de Perfluorcarbono | 240,12 | 0 |
| 30310083 | Iridotomia | 180,00 | 500 |
| 41301250 | Mapeamento de Retina | 19,20 | 65 |
| 30307066 | Membranectomia | 240,12 | 0 |
| 41301269 | Microscopia Especular | 84,00 | 350 |
| 30301165 | Pálpebra – Reconstrução Parcial | 198,00 | 0 |
| 30301173 | Pálpebra – Reconstrução Total | 396,00 | 0 |
| 41501128 | Paquimetria | 36,00 | 150 |
| 41301307 | Potencial de Acuidade Visual | 12,00 | 50 |
| 30303060 | Pterígio – exérese | 144,00 | 0 |
| 30301181 | Ptose Palpebral | 198,00 | 0 |
| 30303079 | Reconstituição de Fundo de Saco | 342,00 | 0 |
| 30313058 | Reconstituição de Vias Lacrimais | 396,00 | 0 |
| 30302110 | Reconstrução Parcial de Cavidade Orbitária | 399,84 | 0 |
| 30301190 | Ressecção de Tumores Palpebrais | 108,00 | 0 |
| 41301315 | Retinografia | 14,40 | 500 |
| 30312086 | Retinopexia com Introflexão Escleral | 540,00 | 0 |
| 30313066 | Sondagem das Vias Lacrimais | 198,00 | 0 |
| 30303087 | Sutura de Conjuntiva | 54,00 | 0 |
| 30304067 | Sutura de Córnea | 252,00 | 0 |
| 50010352 | Teste do Reflexo Vermelho em RN | 19,20 | 0 |
| 41501144 | Tomografia de Coerência Óptica | 95,00 | 0 |
| 41301323 | Tonometria | 6,00 | 0 |
| 30303109 | Tumor de Conjuntiva – Exérese | 126,00 | 0 |
| 30302137 | Tumor de Órbita – Exérese | 342,00 | 0 |
| 40901017 | Ultrassonografia Bilateral | 44,40 | 197,3 |
| 30307120 | Vitrectomia Vias Pars Plana | 522,00 | 0 |

## Tabela 28 – "Inativo" (26/02/2015) — tabela antiga ligada a planos inativos
Angiografia 66,61 · Biometria 57,09 · Campo Visual 40,60 · Ceratoscopia 57,09 · Consulta 88,40 · Corpo Estranho 22,84 · Curva Tensional 47,58 · Facectomia c/ LIO 770,00 · Fotocoagulação 152,24 · Gonioscopia 24,74 · Mapeamento 24,74 · Microscopia 133,21 · Paquimetria 57,09 · Potencial AV 19,03 · Reconstrução Parcial de Cavidade Orbitária 399,84 · Retinografia 19,03 · Reflexo Vermelho 13,70 · Tonometria 9,52 · Ultrassonografia 45,67.

## Tabela 77 – Klini Saúde (24/11/2023)
| 41301013 | Angiografia | 78,80 |
| 30312043 | Fotocoagulação a Laser / Laser Ao | 163,20 |
| 41501144 | Tomografia de Coerência Óptica | 151,36 |

## Tabela 78 – Klini Saúde Pacote (20/11/2023)
| 98901012 | Consulta em Consultório | 100,00 |

## Tabela 73 – Livre Escolha (27/10/2022)
Mesmos itens/códigos AMB da Dual Saúde (5001xxxx), **todos com valor 0,00**.

## Tabela 20 – Medicamentos (23/04/2015)
| 90005767 | Colírio Anestalcon | 6,82 |
| 90006585 | Colírio Fenilefrina | 7,64 |
| 90548906 | Colírio Fluoresceína | 6,46 |
| 90006020 | Colírio Mydriacyl | 10,83 |
| 90007085 | Colírio Visonest | 7,05 |

## Tabela 19 – Mediservice (26/02/2015)
Valores iguais aos da Bradesco Empresa: Angiografia 81,64 · Avaliação Vias Lacrimais 31,72 · Biometria 59,50 · Campo Visual 31,72 · Capsulotomia 343,65 · Ceratoscopia 99,17 · Consulta 135,44 · Corpo Estranho 64,04 · Curva de Pressão 49,58 · Motilidade Ocular 23,97 · Ortóptica 11,65 · Fotocoagulação 343,65 · Gonioscopia 49,58 · Iridotomia 337,94 · Mapeamento 27,50 · Microscopia 138,87 · Paquimetria 59,50 · Potencial AV 19,82 · Retinografia 23,31 · Reflexo Vermelho 28,88 · OCT 77,85 · Tonometria 13,74 · Ultrassonografia Bilateral 156,39.

## Tabela 33 – Mediservice Cirurgia (26/02/2015)
| 30307031 | Endolaser/Endodiatermia (*) | 267,17 |
| 30306027 | Facectomia com Implante de LIO (*) | 935,06 |
| 30312043 | Fotocoagulação a Laser | 267,17 |
| 30307040 | Implante de Silicone Intravítreo (*) | 485,99 |
| 30307038 | Infusão de Perfluorcarbono (*) | 267,17 |
| 30303060 | Pterígio – exérese (*) | 180,03 |
| 30312086 | Retinopexia com Introflexão Escleral (*) | 794,74 |
| 30307147 | Tratamento Ocular Quimioterápico | 476,76 |
| 30307120 | Vitrectomia Vias Pars Plana (*) | 894,32 |

## Tabela 16 – Ótica [nome] (01/01/2015)
| – | Consulta | 120,00 |

## Tabela 1 – Particular (01/01/2015) — tabela de preços particulares (sem TUSS, salvo indicado)
Valores marcados com "≥10 mil?" aparecem cortados na tela (coluna estreita) — conferir.
Agulhamento/Bolha Filtrante 4.000,00 · Angiografia Particular 450,00 · Aspiração de Massa Câmara Anterior 600,00 · Biometria Particular 110,00 · Biometria Particular/externo 190,00 · Biópsia Lesão Palpebral 2.600,00 · Blefaroplastia Inferior Cartão 6.500,00 · Blefaroplastia Inferior Pix/dinheiro 6.000,00 · Blefaroplastia Sup + Ptose x0.500,00 (≥10 mil?) · Blefaroplastia Superior Cartão 6.500,00 · Blefaroplastia Superior Dinheiro/pix 6.000,00 · Blefaroplastia Sup/Inf Cartão 8.500,00 · Blefaroplastia Sup/Inf Dinheiro/pix 7.900,00 · Blefaroplastia/castanhares 9.900,00 · BUT Tempo de Ruptura do Filme Lacrimal 90,00 · Calázio 1.750,00 · Campo Visual Particular 180,00 · Capsulotomia YAG 450,00 · Ciclofoto a Laser Micropulsado 3.000,00 · Ciclofotocoagulação Transescleral x5.000,00 (≥10 mil?) · Cirurgia Refrativa Cartão 5.220,00 · Cirurgia Refrativa Dinheiro/pix 4.820,00 · Cisto Palpebral 1.600,00 · Consulta Cartão 280,00 · Consulta Córnea 500,00 · Consulta Dinheiro/pix 250,00 · Consulta Dr. [médico 1] 350,00 · Consulta Dr. [médico 2] 500,00 · Consulta Glaucoma 600,00 · Consulta Oftalmológica Pediatria e Estrabismo 500,00 · Consulta Ótica Júnior 120,00 · Consulta Retinólogo 600,00 · Crosslinking Corneano 1.416,00 · Curva de Pressão 155,00 · Curva Tensional Diária binocular (50010026) 155,00 · Dacriocistorrinostomia Particular 1.000,00 · Ecobiometria (50010190) 120,00 · Ectrópio 8.500,00 · Entrópio 8.500,00 · Exame Vias Lacrimais (Teste de Schirmer) 90,00 · Exercício Ortóptico 50,00 · Exercício Ortóptico 10 Sessões 400,00 · Exérese Cisto Palpebral 5.500,00 · Exérese Múltiplos Cistos Bilateral 5.500,00 · Exérese Múltiplos Cistos Unilateral 3.200,00 · Facectomia com Implante de LIO 5.500,00 · Faco/goniotomia x0.500,00 (≥10 mil?) · Faco/TREC x0.500,00 (≥10 mil?) · Faco/VVPP Vias Pars 5.000,00 · Fotocoagulação a Laser 450,00 · Fotocoagulação a Laser Ao (50140019) 2.000,00 · Fotocoagulação a Laser Continuação 0,10 · Gonioscopia 150,00 · Goniotomia (GATT) 8.500,00 · Implante de Dreno Susanna x0.000,00 (≥10 mil?) · Implante Intravítreo de Polímero (Ozurdex) 7.000,00 · IOL Master 350,00 · IOL Master/Micro Dr. [médico] 300,00 · Iridotomia 450,00 · Laser (uma única sessão) 400,00 · Lente ID Longe 7.500,00 · Lente Imp. simples 2.900,00 · Lente Intra Nacional 700,00 · Lente Trifocal 5.000,00 · Lisamina Verde 90,00 · Mapeamento de Retina Particular 280,00 · Microscopia Particular 200,00 · OCT Disco Particular 450,00 · OCT Mácula Particular 450,00 · Olho Seco Severo Consulta 400,00 · PAM Particular 150,00 · Paquimetria Particular 155,00 · Pentacam 600,00 · Pterígio – exérese (50030035) 3.000,00 · Pterígio/Cola de Fibrina 4.200,00 · Ptose Palpebral 7.900,00 · Retinografia Particular 250,00 · Revisão 0,01 · Rosa Bengala 90,00 · Sondagem Vias Lacrimais Particular 1.100,00 · Taxa de Sala 0,00 · Teste do Olhinho Dr. [médico] 380,00 · Teste do Olhinho Particular 280,00 · Teste Ortóptico 100,00 · Titmus 200,00 · Tonometria 100,00 · Topografia Particular 200,00 · Trabeculoplastia Particular 1.500,00 · Tratamento Ocular Quimioterápico 2.200,00 · Trabeculectomia 8.500,00 · TREC/VVPP x0.000,00 (≥10 mil?) · Ultrassonografia Particular 280,00 · Vitrectomia Vias Pars Plana (50070061) 5.000,00.
> Observação: os preços particulares variam por **forma de pagamento** (Cartão × Dinheiro/Pix) — cadastrados como procedimentos diferentes.

## Tabela 70 – Porto Pacote Cross (10/08/2019)
| 50041037 | Crosslinking Corneano | 1.700,00 |

## Tabela 53 – Porto Seguro CH 0,224 (01/05/2017)
| TUSS | Procedimento | Valor | CH |
|---|---|---|---|
| 41301013 | Angiografia | 22,40 | 100 |
| 41501012 | Biometria | 44,80 | 200 |
| 40103137 | Campo Visual | 33,60 | 150 |
| 30306019 | Capsulotomia YAG | 646,10 | 700 |
| 41301080 | Ceratoscopia | 28,00 | 125 |
| 10101012 | Consulta / Consulta em Consultório | 146,00 | 0 |
| 41301129 | Curva Tensional Diária | 33,60 | 150 |
| 41301200 | Exame de Motilidade Ocular | 8,96 | 40 |
| 30312043 | Fotocoagulação a Laser / Laser Ao | 461,50 | 500 |
| 41301242 | Gonioscopia | 17,92 | 80 |
| 41301250 | Mapeamento de Retina | 17,92 | 80 |
| 41301269 | Microscopia Especular | 78,40 | 350 |
| 41501128 | Paquimetria | 33,60 | 150 |
| 41301307 | Potencial de Acuidade Visual | 11,20 | 50 |
| 41301315 | Retinografia | 13,44 | 60 |
| 30313066 | Sondagem das Vias Lacrimais | 176,79 | 0 |
| 41301471 | Teste do Reflexo Vermelho | 5,60 | 25 |
| 41501144 | Tomografia de Coerência Óptica | 88,93 | 397 |
| 41301323 | Tonometria | 5,60 | 25 |
| 40901530 | Ultrassonografia Ocular | 33,60 | 150 |

## Tabela 49 – Porto Seguro CH 0,28 (01/05/2017)
Mesmos itens da 53 com fator 0,28: Angiografia 28,00 · Biometria 56,00 · Campo Visual 42,00 · Capsulotomia 646,10 · Ceratoscopia 35,00 · Consulta 146,00 · Curva Tensional 42,00 · Motilidade 11,20 · Fotocoagulação 461,50 · Gonioscopia 22,40 · Mapeamento 22,40 · Microscopia 98,00 · Paquimetria 42,00 · Potencial AV 14,00 · Retinografia 16,80 · Sondagem 176,79 · Reflexo Vermelho 7,00 · OCT 111,16 · Tonometria 7,00 · Ultrassonografia 42,00.

## Tabelas 52, 51 e 50 – Porto Seguro Cirurgia (01/05/2017)
| TUSS | Procedimento | Valor | CH |
|---|---|---|---|
| 30303010 | Autotransplante Conjuntival | 749,25 | 708,85 |
| 30306019 | Capsulotomia YAG | 739,90 | 700 |
| 30310024 | Cicloterapia – Qualquer Técnica | 199,00 | 0 |
| 30311020 | Cirurgia com Sutura Ajustável | 707,14 | 0 (669,01 na 51) |
| 30304032 | Corpo Estranho da Córnea (52 e 50) | 84,56 | 80 |
| 30307031 | Endolaser/Endodiatermia (*) | 705,02 | 667 |
| 30311039 | Estrabismo Ciclo Vertical | 404,08 | 0 |
| 30311047 | Estrabismo Horizontal Monocular | 1.010,20 | 0 |
| 30306027 | Facectomia com Implante de LIO (*) | 1.585,50 | 1500 |
| 30312043 | Fotocoagulação a Laser / Laser Ao | 528,50 | 500 |
| 30307040 | Implante de Silicone Intravítreo (*) | 1.691,20 | 1600 |
| 3.03.06.06 | Implante Secundário/Explante | 898,45 | 850 |
| 30307038 | Infusão de Perfluorcarbono (*) | 705,02 | 667 |
| 30310083 | Iridotomia | 528,50 | 500 |
| 30303060 | Pterígio – exérese (*) | 422,80 (279,72 na tabela 50) | 400 |
| 30312086 | Retinopexia com Introflexão Escleral (*) | 1.585,50 | 1500 |
| 50040049 | Retirada de Corpo Estranho da Córnea (só 51) | 84,56 | 80 |
| 30307112 | Vitrectomia Anterior | 739,90 | 700 |
| 30307120 | Vitrectomia Vias Pars Plana (*) | 1.532,65 | 1450 |

## Tabela 86 – Select Operadora (04/09/2025)
| 41301013 | Angiografia | 69,50 |
| 41501012 | Biometria | 40,98 |
| 40103137 | Campo Visual | 54,26 |
| 41301080 | Ceratoscopia | 58,81 |
| 10101012 | Consulta | 90,00 |
| 41301129 | Curva Tensional Diária | 39,41 |
| 41301242 | Gonioscopia | 15,34 |
| 41301250 | Mapeamento de Retina | 26,20 |
| 41301269 | Microscopia Especular | 75,94 |
| 41501128 | Paquimetria | 28,38 |
| 41301307 | Potencial de Acuidade Visual | 15,57 |
| 41301315 | Retinografia | 39,15 |
| 41301471 | Teste do Reflexo Vermelho | 16,80 |
| 41301323 | Tonometria | 16,95 |
| 40901530 | Ultrassonografia Ocular | 77,05 |

## Tabela 87 – Select Pacotes (04/09/2025) — códigos próprios 9xxxxxxx
| 90306019 | Capsulotomia YAG | 840,00 |
| 93030607 | Facectomia com Implante de LIO | 3.000,00 |
| 99312043 | Fotocoagulação a Laser | 350,00 |
| 90310083 | Iridotomia | 450,00 |
| 90304032 | Retirada de Corpo Estranho da Córnea | 250,00 |

## Tabela 82 – Siass-Geap (09/08/2020)
| 10101012 | Consulta / Consulta em Consultório | 66,90 |

## Tabela 13 – Sindicato dos Rodoviários (01/01/2015) — sem TUSS (só Consulta 10101012)
Angiografia 300,00 · Campo Visual 120,00 · Capsulotomia 300,00 · Ceratoscopia 170,00 · Consulta 140,00 · Curva de Pressão 108,00 · Ecobiometria 170,00 · Fotocoagulação 750,00 · Gonioscopia 60,00 · Iridotomia 400,00 · Laser (uma única sessão) 300,00 · Mapeamento 120,00 · Microscopia 170,00 · Paquimetria 120,00 · Potencial AV 80,00 · Retinografia 130,00 · OCT 300,00 · Tonometria 60,00 · Ultrassonografia 170,00.

## Tabela 76 – Sistema Interclínicas (01/01/2015)
Angiografia 350,00 · Biometria 55,00 · Campo Visual 130,00 · Capsulotomia 350,00 · Ceratoscopia 150,00 · Consulta 110,00 · Consulta Dinheiro/pix 160,00 · Consulta Oftalmológica Pediatria e Estrabismo 300,00 · Curva de Pressão 110,00 · Curva Tensional Diária (50010026) 70,00 · Ecobiometria 200,00 · Ecobiometria (fora) 200,00 · Exercício Ortóptico 80,00 · Exercício Ortóptico 10 sessões 350,00 · Facectomia c/ LIO 4.500,00 · Fotocoagulação 250,00 · Fotocoagulação Ao (50140019) 1.500,00 · Fotocoagulação Continuação 0,10 · Gonioscopia 80,00 · Iridotomia 350,00 · Laser (uma única sessão) 250,00 · Lente de Contato 0,00 · Lente Gelatinosa 150,00 · Multifocal 800,00 · Rígida 1.000,00 · Tórica 600,00 · Lisamina Verde 50,00 · Mapeamento 110,00 · Microscopia 160,00 · Paquimetria 120,00 · Potencial AV 130,00 · Retinografia 120,00 · Revisão 0,01 · Taxa de Sala 0,00 · Teste Ortóptico 80,00 · OCT 300,00 · Tonometria 50,00 · Ultrassonografia 200,00.

## Tabela 29 – Tabela Cirurgia (26/02/2015) — modelo com valores simbólicos (1,00 / 0,00)
Endolaser (*) 1,00 · Facectomia c/ LIO (*) 1,00 (CH 1500) · Fotocoagulação 1,00 · Implante de Silicone (*) 1,00 · Implante Secundário 0,00 · Infusão de Perfluorcarbono (*) 1,00 · Pterígio (*) 1,00 (CH 280) · Retinopexia (*) 1,00 (CH 1450) · Tratamento Ocular Quimioterápico 0,00 · Vitrectomia Anterior 0,00 · Vitrectomia Pars Plana (*) 1,00 (CH 1450).

## Tabela 12 – Tabela [nome de médico] (01/01/2015) — preços particulares de um médico
Angiografia 400,00 · Campo Visual 160,00 · Capsulotomia 400,00 · Ceratoscopia 190,00 · Consulta (10101012) 180,00 · Consulta Dinheiro/pix 0,00 · Curva de Pressão 140,00 · Ecobiometria 190,00 · Fotocoagulação 1.000,00 · Gonioscopia 70,00 · Iridotomia 450,00 · Laser (uma única sessão) 300,00 · Mapeamento 140,00 · Microscopia 190,00 · Paquimetria 140,00 · Potencial AV 90,00 · Retinografia 150,00 · OCT 350,00 · Tonometria 70,00 · Ultrassonografia 280,00.

## Tabela 2 – Tabela Padrão (26/02/2016) — modelo com valores 0,00 / 1,00 (base para novas tabelas)
Itens com TUSS (Angiografia, Biometria, Campo Visual, Ceratoscopia, Consulta, Curva de Pressão, Ecobiometria, Endolaser (*) 1,00, Facectomia c/ LIO (*) 1,00, Fotocoagulação, Gonioscopia, Implante de Silicone (*) 1,00, Infusão de Perfluorcarbono (*) 1,00, Mapeamento, Microscopia, Paquimetria, Potencial AV, Pterígio (*) 1,00, Retinografia, Retinopexia (*) 1,00, Tonometria, Ultrassonografia, Vitrectomia Pars Plana (*) 1,00). Demais 0,00.

## Tabela 34 – Unimed Cirurgia (26/02/2015)
| TUSS | Procedimento | Valor | CH |
|---|---|---|---|
| 30303010 | Autotransplante Conjuntival | 271,87 | 0 |
| 30301041 | Calázio | 88,17 | 0 |
| 30310032 | Cirurgias Fistulizantes Antiglaucomatosas | 758,27 | 0 |
| 30301084 | Correção de Ectrópio/Entrópio | 536,37 | 0 |
| 30307031 | Endolaser/Endodiatermia (*) | 330,63 | 660 |
| 30301122 | Epilação de Cílios | 50,16 | 0 |
| 30306027 | Facectomia com Implante de LIO (*) | 1.159,44 | 1500 |
| 30304091 | Fotoablação de Superfície Convencional | 3.500,00 | 0 |
| 30312043 | Fotocoagulação a Laser / Laser Ao | 330,63 | 0 |
| 30307040 | Implante de Silicone Intravítreo (*) | 330,63 | 1000 |
| 30312132 | Implante Intravítreo de Polímero (Ozurdex) (*) | 980,18 | 0 |
| 30306060 | Implante Secundário/Explante | 702,42 | 667 |
| 30312051 | Infusão de Gás Expansor | 271,87 | 833 |
| 30307058 | Infusão de Perfluorcarbono (*) | 330,63 | 667 |
| 30307066 | Membranectomia | 702,42 | 667 |
| 30305047 | Pacote Retirada de Corpo Estranho | 702,42 | 650 |
| 30301165 | Pálpebra – Reconstrução Parcial | 454,09 | 550 |
| 30301173 | Pálpebra – Reconstrução Total | 536,37 | 1100 |
| 30303060 | Pterígio – exérese (*) | 208,67 | 280 |
| 30301190 | Ressecção de Tumores Palpebrais | 271,87 | 0 |
| 30312086 | Retinopexia com Introflexão Escleral (*) | 980,18 | 1500 |
| 30313066 | Sondagem das Vias Lacrimais | 88,17 | 0 |
| 30307147 | Tratamento Ocular Quimioterápico (*) | 702,42 | 0 |
| 30307090 | Troca Fluido Gasosa | 330,63 | 667 |
| 30307112 | Vitrectomia Anterior | 702,42 | 700 |
| 30307120 | Vitrectomia Vias Pars Plana (*) | 1.080,07 | 1450 |

## Tabela 14 – Unimed NI (26/02/2016)
| TUSS | Procedimento | Valor | CH |
|---|---|---|---|
| 41301013 | Angiografia | 48,00 | 200 |
| 41301170 | Avaliação de Vias Lacrimais | 19,20 | 80 |
| 41501012 | Biometria | 48,00 | 200 |
| 40103137 | Campo Visual | 19,20 | 80 |
| 30306019 | Capsulotomia YAG | 330,63 | 0 |
| 41301080 | Ceratoscopia | 60,00 | 250 |
| 10101012 | Consulta / Consulta em Consultório | 100,00 | 0 |
| 41301129 | Curva Tensional Diária | 36,00 | 150 |
| 30312043 | Fotocoagulação a Laser | 330,63 | 0 |
| 41301242 | Gonioscopia | 19,20 | 80 |
| 30312132 | Ozurdex (*) | 980,18 | 0 |
| 30310083 | Iridotomia | 330,63 | 0 |
| 41301250 | Mapeamento de Retina | 19,20 | 80 |
| 41301269 | Microscopia Especular | 84,00 | 350 |
| 30312124 | Panfotocoagulação a Laser na Retinopatia | 1.328,15 | 0 |
| 41501128 | Paquimetria | 36,00 | 150 |
| 41301307 | Potencial de Acuidade Visual | 12,00 | 50 |
| 41301315 | Retinografia | 14,40 | 60 |
| 30304032 | Retirada de Corpo Estranho da Córnea | 58,60 | 60 |
| 41301471 | Teste do Reflexo Vermelho | 19,20 | 80 |
| 41301323 | Tonometria | 6,00 | 25 |
| 40901530 | Ultrassonografia Ocular | 36,00 | 150 |
| 10102019 | Visita Hospitalar (paciente internado) | 84,00 | 0 |

## Tabela 18 – Unimed Nova Iguaçu (26/02/2016)
Igual à Unimed NI (sem Ozurdex e sem Visita Hospitalar), mais Facectomia com Implante de LIO (30306027) 1.159,44 (CH 1500).

## Tabela 42 – Unimed Pacote (26/02/2016) — códigos de pacote Unimed 699xxxxx
| 40103030 | Análise Computadorizada do Segmento Anterior | 300,00 |
| 30304091 | Fotoablação de Superfície Convencional | 3.500,00 |
| 69910987 | Pacote Autotransplante Conjuntival | 275,00 |
| 69910995 | Pacote Calázio | 400,00 |
| 69911002 | Pacote Cirurgias Fistulizantes Antiglaucomatosas | 1.050,00 |
| 69911029 | Pacote Endolaser/Endodiatermia | 600,00 |
| 69911070 | Pacote Facectomia com Lente Intraocular | 1.200,00 |
| 69911096 | Pacote Fotocoagulação Unimed | 250,00 |
| 69911118 | Pacote Implante de Silicone Intravítreo | 1.500,00 |
| 69911100 | Pacote Implante Secundário | 855,00 |
| 69911126 | Pacote Infusão de Perfluorcarbono | 1.400,00 |
| 69911134 | Pacote Iridotomia YAG Laser Unimed | 300,00 |
| 69911142 | Pacote Membranectomia | 850,00 |
| 69911320 | Pacote Ozurdex Unimed | 2.827,75 |
| 69911185 | Pacote Pálpebra – Reconstrução Total | 700,00 |
| 69911150 | Pacote Pterígio | 400,00 |
| 69911274 | Pacote Ressecção de Tumores Palpebrais | 400,00 |
| 69911207 | Pacote Retinopexia com Introflexão | 1.500,00 |
| 69911223 | Pacote Retirada de Corpo Estranho | 1.500,00 (conferir) |
| 69911231 | Pacote Sondagem das Vias Lacrimais | 200,00 |
| 69911312 | Pacote Tratamento Ocular Eylia | 2.297,58 |
| 69911266 | Pacote Troca Fluido Gasosa | 850,00 |
| 69911282 | Pacote Vitrectomia Anterior | 1.000,00 |
| 69919804 | Pacote Vitrectomia Vias Pars Plana | 6.000,00 |

## Tabela 7 – Medprev (01/01/2015) — sem TUSS (só Capsulotomia 50060015)
Angiografia 175,00 · Biometria 100,00 · Campo Visual 65,00 · Capsulotomia 175,00 · Ceratoscopia 100,00 · Consulta 70,00 · Curva de Pressão 55,00 · Ecobiometria 100,00 · Ecobiometria (fora) 170,00 · Facectomia c/ LIO 2.500,00 · Fotocoagulação 400,00 · Gonioscopia 35,00 · Laser (uma única sessão) 175,00 · Lente de Contato 0,00 · Mapeamento 65,00 · Microscopia 100,00 · Paquimetria 65,00 · Potencial AV 46,00 · Retinografia 72,00 · OCT 175,00 · Tonometria 35,00 · Ultrassonografia 100,00. Itens: Angiografia 50010131, Biometria 50010190, Capsulotomia, Ceratoscopia 50010263, Consulta 00010014, Corpo Estranho 50060032, Ecobiometria 50010190, Facectomia c/ LIO 50060040, Fotocoagulação 50140019, Gonioscopia 50010042, Lente de Contato, Mapeamento 50010093, Microscopia 50010212, Paquimetria 50010204, Potencial AV 50010118, Retinografia 50010123, Teste do Reflexo Vermelho, Tonometria 50010158, Ultrassonografia 50010131.


---

**PARTE 6 – arquivo original: C-faturamento.md**

# C) Faturamento — Micrologos (ML Clinic Master ASP 13.13.30.00)

**Status:** mapeado em modo somente leitura. Usei a conta de um **paciente de teste** ("Teste", Klini Saúde). Nenhuma conta, guia, lote ou status foi alterado.
**Não foi aberto:** o botão **TISS** da conta (tela da guia), porque ele pode gerar número de guia. Aguardando sua autorização — ver Pendências.

---

## 0. Fluxo geral (como o faturamento funciona hoje)

```
Agenda/Atendimento → CONTA do paciente (itens: procedimentos, exames, materiais)
   → status da conta: Sem status → Conferindo → Auditado → Liberado → Lib.&TISS (guia TISS conferida)
   → COBRANÇA (= "processo"/lote por convênio e período) → "Consolidação"
   → geração do XML TISS (com "Termo de concordância") → gravado em C:\<convênio>\
   → envio ao portal da operadora (fora do Micrologos) → "Entrega" → Protocolo
   → Recebimento / Glosa (quase não é usado no sistema) → Repasse aos médicos
```

**Unidades (empresas) cadastradas** – as contas e cobranças aparecem em abas por unidade:
Barra Day Serviços Médicos Ltda · Clínica e Cirurgia de Olhos Dr. [nome] Ltda · Consumed · Consumed Consultórios Médicos Ltda · Day Clinic Méier · Hospital Daniel Lipp Ltda · Hospital Oftalmológico da Barra · Jardim de Alah Centro Cirúrgico Ltda · Largo do Machado · Oftalmo Rio Centro de Micro Cirurgia Ocular Ltda EPP · Pro Oftalmo Micro Cirurgia Ocular S/C Ltda · Rio Vision Hospital Ltda · Unimed Regional Fluminense Cooperativa de Trabalho Médico · UTI Rio Serviços Médicos Ltda.
Na prática, as cobranças de out/2026 são quase todas da unidade **"Consumed Consultórios Médicos"** (algumas da "Unimed Regional").
> ⚠️ Não há unidade chamada "Hospital de Olhos da Baixada". Confirmar qual unidade/CNPJ corresponde ao hospital.

---

## 1. Menus do faturamento

**Atendimentos ▸ Faturamento:**
- Contas de Pacientes ← **tela principal**
- Faturamento ← tela antiga; o próprio sistema avisa "Este módulo NÃO deve ser utilizado por empresas que utilizem o TISS" (não usado)
- Pendências
- Lançamentos Extras para Repasse
- Cobranças ▸ **Cobranças de Convênios** (lotes/XML) · Justificativas de Glosas Técnicas · Acompanhamento
- Dmed (relação p/ declaração de serviços médicos) · CIHA (SUS) · rIAR (imunobiológicos)

**Cadastros ▸ Tabelas ▸ Faturamento:** Tipo de Pendências · Tipos de Glosas · Centro de Responsabilidade · Turnos · Classificação de Guias · Classificação de Atendimentos · Configuração para Faturamento Automático (vazio) · Configuração de Taxas · Layouts de Convênios (vazio – sem layouts TXT).

**Cadastros ▸ Tabelas ▸ Comissionamento:** Categorias do Staff Médico · Donos de Equipamentos · Tipos de Comissão (regras de repasse).

---

## 2. Conta do paciente
**Caminho:** Atendimentos ▸ Faturamento ▸ Contas de Pacientes (botão "Conta" na barra principal)

### 2.1 Visão Geral (lista de contas)
- **Busca:** Em Aberto / Início · período De/Até (Hoje, Ontem, Mês Atual, Mês Anterior, Semana Atual, Semana Anterior) · Conta · Atendimento · Paciente · Plano de Saúde · Guia (Prestador / Operadora) · botões Aplicar Busca / Anular Busca · botão "Calcula Repasse".
- **Filtro (após a busca):** Plano, Paciente, Prod./Serv., Médico, Classif. Guia, Convênio; datas de Início e Entrega; status: Sem Status · Pendências · Em Cobr. · TISS Conf. · Conferindo · Auditado · TISS ñ Conf. · Total · Final · Liberado · Entregue · Sem Partic. · Parcial · Complementar. Botão "Totais".
- **Colunas:** ícone status · ícone TISS · Unidade · Classif. Guia · Conta · Início · Paciente · Plano de Saúde · Médico · Fim · Entrega · Status (Total/Parcial/Final) · Guia Solic. às · **Nº Guia Plano** · Nº Guia Odonto.
- Grade inferior (itens da conta selecionada): Tp · status · Data · Hora · Código · Item · Observação · Qtde · Filme · Vl.Total.
- **Legenda de status da conta:** Pendências · Conferindo · Auditado · Liberado · Lib.&TISS · Em Cobrança · Entregue.
- Volume: 1.543 contas com início em out/2026.

### 2.2 Detalhamento da conta
Cabeçalho: Paciente (código + nome) · Conta · tipo (Ambulatório/Internação) · Início/Total (data) a (data) · Agenda nº · Internação nº · Parcela · status TISS (ex.: "TISS Conferido") · Médico · Procedimentos Áreas diferentes · Urgência/Emergência · Desconto (% informativo) · Observação · Total/Parcial(/Final) · **TOTAL R$**.

Botões dos itens: Incluir Item · Alterar Item · Excluir Item · Opções.

**Aba lateral "Visão Geral Itens"** – colunas: Data · Hora · Tp · Categoria · Tipo Local · Item · T · Qtd · Vl.Total · Turno · Centro Resp. · Local · Médico · Planos de Saúde · CID · Conferido por · Conferido em · Incluído por · Incluído em · Solicitado por … Legenda: R-Requisição · D-Devolução · G-Glosa · Produto · Medicamento · Serviço · Procedimento. Grade de Kit (Data · Hora · Kit).

**Aba lateral "Detalhes Itens"** (= tela "Faturamento de Procedimento/Serviço") – campos de cada item:
- Código AMB · Procedimento · Código interno · botão Staff Médico
- Data · Hora início/fim · Unidade · Turno (ex.: "Taxa Assim") · Código do Movimento
- Plano de Saúde (+ código) · Local (consultório/sala) · **Tb.Prç** (tabela de preço usada) + código
- Quantidade · Originais · Filme Qtde · CO Unit. Original/Incluso · Vl. Staff · Vl.Filme Original · Valor 1ª qtde / 2ª qtde · % Red./Acresc. · Taxa Turno
- Valor Unitário (%) · Vl.Un · Valor Total
- Observação · Terceirizado · Ñ Calcula Comissão
- Centro Resp. · **CID-10** · Médico · Especialidade (ex.: Oftalmo Geral)
- Valor Franquia · Médico que Indicou · Médico vinculado · Contato Externo · Tipo (Membros: AO/OD/OE)
- **Nº Guia** · **Autorização (senha)** · Honorário · **Validade** (da senha) · Guia Op. (nº guia operadora) · Conferido por · Autorizado em · Áreas diferentes
- Bloco TISS: Procedimento Principal · **Técnica Utilizada** (Convencional/…) · **Tipo Cirurgia / Via** (Única/…)
- Cirurgia nº · Agenda nº · Previsão Fechamento

### 2.3 Menu Opções da conta (somente olhado)
Refaz · Filtra/Busca Contas · Filtra Contas do dia do Paciente · Gastos de Material/Medicamento · **Altera Status ▸** (Sem Status, Auditado, Conferindo, Confere todos os itens, Pendente, Retira Pendência, Tira Status de Guia Impressa, Liberar todas as contas) · **Altera dados da Conta ▸** (Transfere Itens da Conta, Transfere de Unidade, Transfere Classificação de Guia, Inclui Item, Recalcula Descontos Proc.) · **Pagamento de Particular ▸** (Informa, Cancela, Visualiza, Nota Fiscal ▸) · Recibo DMed · Parcial (conta de internação) · Inclusão de Glosa Interna · Gestor Eletrônico de Documentos ▸ · Visualizações ▸ (Dados do Paciente, Total da Conta por Unidade, Dados Gerais da Conta, Vê Itens da Conta…) · Captura Nome do Paciente.
Botões laterais: Buscar · Alterar · Listar · Excluir · **TISS** (guia) · **Liberar** · Opções · Ajudar · Sair.

---

## 3. Guias TISS
**O que já se sabe (pela configuração dos convênios e pela conta):**
- **Classificação de Guias** (Cadastros ▸ Tabelas ▸ Faturamento): define o tipo de guia TISS usado por cada grupo de procedimentos:

| Classificação | Tipo de guia TISS | Observação |
|---|---|---|
| 1 Consulta | **Consulta** | usa na agenda ambulatorial |
| 2 Exames | **SP/SADT** | permite escolher exames no agendamento |
| 3 Cirurgia | **Honorário individual** | lista de procedimentos cirúrgicos permitidos |
| 4 Medicamentos | **SP/SADT** | |
| 5 Lentes Cirúrgicas | (vazio) | |
  Cada classificação tem: usa na agenda do ambulatório / da internação · permite faturar antecipadamente · permite escolher exames · faturar no centro de responsabilidade · lista de produtos/serviços permitidos · aba Planos de Saúde.
- Tipos de guia numerados por convênio: Consulta · SP/SADT · Honorários · Solicitação de Internação · Resumo de Internação · OPME · Odontologia · **Recurso de Glosa**.
- Pela configuração, Amil (e outros) enviam **consultas dentro da guia SP/SADT**; guias de Honorário só para cirurgia.
- Campos da guia que vêm da conta: nº guia prestador, nº guia operadora, senha/autorização, validade da senha, data de autorização, CID, médico executante/solicitante (CRM, CBO), técnica, via de acesso, grau de participação, quantidade, valores, % redução/acréscimo, membros (olho), hora início/fim.
- **Volume de guias:** só **internação/honorários** usa "Honorário"; não há guias de internação em uso (contas são "Ambulatório").

**Ainda falta ver:** a própria tela da guia (botão TISS) com todos os campos impressos.

---

## 4. Lotes / Cobranças de Convênios
**Caminho:** Atendimentos ▸ Faturamento ▸ Cobranças ▸ Cobranças de Convênios (botão "Cobrança" na barra principal)

### 4.1 Visão Geral (lista de "processos" = lotes)
- **Busca por:** Consolidação · Entrega · Recebimento · Previsão Rec. · Período Fatur. · Prazo Entrega; datas De/Até; Nº Processo; Nota/Lote/Protocolo; Convênio/Plano.
- **Filtro:** Entrega/Consol.; Recebimento; Prev. Receb. (atrasadas); Período Faturamento; Prazo Entrega (atrasados); Processos: Todos/Principal/Sub-processo; Sem Recebimento; Status: Todos · Consolidação · A Entregar · Entregue · Recebendo · Recebido. Totais: Qtd linhas, $ Enviado, $ Rec. Prot., $ Glosa Rev., $ Glosa Irr.
- **Colunas:** Processo · Convênio · Plano · Consolid. · Entrega · Previsão Rec. · Recebim. · Status · GED · Vl. Enviado · Vl. a Receber · Vl. Procedim. · Rec. Protoc. · Glosa Revers. · Glosa Irrev. · Deriva Proc. · Intern/Ambul. · Unidade Mãe · Período do Faturamento · Prazo Entrega.
- Out/2026: **113 processos** consolidados, todos com status "Pr./Consolidação".
- **Regra observada:** Vl. a Receber = Vl. Enviado − **15% de impostos** (ex.: 171,36 → 145,66; impostos 25,70).
- Botões laterais: Buscar · Incluir · Listar · Excluir · **TISS** (gera XML) · **Entrega** · **Fecha** · Opções · Ajudar · Sair. *(Nenhum foi acionado.)*

### 4.2 Detalhamento do processo — sub-abas
1. **Detalhes:** Convênio · Unidade Mãe · Data de Entrega · Qt. Contas · Previsão de Entrega · Nº Processo · Processo Principal · Derivado do Processo · Previsão Recebimento · Dias Atraso · Recebimento · Consolidação (data) · Referente ao Período · Rateio nas glosas não identificadas (Rev/Irrev) · Tipo (Ambulatório) · Status.
   - Grade **Recebimento (protocolos):** Protocolo · Lote · Nota · Valor · Vl. P. Jurídica · Vl. P. Física · Valor Pago · Impostos · Unidade · Outras Deduções · Data Inclusão · Incluído por · Data Alteração · Alterado por · Cód. Proto · Cód. Fluxo. Botões: Incluir/Alterar/Excluir/Receber Protocolo.
   - Rodapé: Valor Enviado (+) · Outras Deduções (−) · Impostos (−) · Glosa Total (−) · Valor a Receber · Valor Recebido Procedimentos · Valor Recebido Protocolos · Glosa Reversível/Irreversível (identificada / não identificada).
2. **Faturamento:** itens do lote – Paciente · Lote · Conta · GED · Código · Item · Vl. Original · Tot. Glosa · Vl. Receb. · Qtd. Original · Qtd. Receb. · Recebido em · Guia_lst (nº guia prestador) · Guia Honorários · Guia Operadora · Data · Médico · Unidade. Filtro Todos / Sem Lote / Com Lote.
3. **Glosa:** Paciente · Conta · Código · Item · Glosado · Qnt.Rev · Revs.Tot · Qnt.Irrev · Irrev.Tot · Filme Rev · Filme Irrev · Data · Médico · Unidade · Convênio · Tipo.
4. **Ocorrências:** registro automático da geração do XML (ver Área D) + Incluir/Alterar/Excluir ocorrência; sub-aba **Verificação de Arquivos XMLs** (Arquivos; mostra Guias / Procedimentos / Despesas / OPMs / Estrutura XML / XML / Contas × XMLs / Total).

### 4.3 Menu Opções das cobranças (somente olhado)
Refaz · Consolida (Altera Cobrança) · Cancela Entrega · Cancela Fechamento · Receber Protocolo · **Recebe Arquivo Magnético ▸ Pgto de Cobranças** (importação de demonstrativo) · **Guia de Recurso de Glosa** · Integração com o SUS (desativado) · Gestor Eletrônico de Documentos ▸ · Outras Opções ▸ (Zera Protocolos, Atualiza Valores ▸, Verifica inconsistência, Arquivo Magnético ▸, Suporte Autorizado) · Integração Cash ASP ▸ (Nota Fiscal ▸, Visualiza Mov. Portadores ñ utilizados).

---

## 5. Envio às operadoras e protocolo
- O Micrologos **gera o XML** e grava numa pasta local. **Não há envio automático** configurado: em todos os convênios o "Web Service" está em "Sem ambiente" e o campo "Código na empresa de conectividade" está vazio (exceto Assist = 534).
- O logotipo **Orizon** aparece na tela de abertura, mas não encontrei configuração ativa de envio pela Orizon.
- Conclusão provável: o XML é **enviado manualmente no portal de cada operadora**; o **protocolo** pode ser registrado no processo (aba Detalhes › Incluir Protoc.), mas **não está sendo registrado** (só 1 processo, de 2017, tem protocolo/recebimento).

## 6. Demonstrativo de pagamento, glosas e recurso
- Importação de demonstrativo: Opções ▸ Recebe Arquivo Magnético ▸ **Pgto de Cobranças**.
- Glosa: por item (reversível × irreversível), com **Tipos de Glosa = tabela ANS (527 motivos com código ANS)**; justificativas técnicas em Atendimentos ▸ Faturamento ▸ Cobranças ▸ Justificativas de Glosas Técnicas; **Guia de Recurso de Glosa** no menu Opções; numeração própria de guia de recurso por convênio.
- Também existe "Inclusão de Glosa Interna" na conta.
- **Uso real:** praticamente nenhum recebimento/glosa registrado no sistema (1 processo de 2017). ⚠️ Perguntar onde a equipe controla pagamentos e glosas hoje.

## 7. Pendências
- Tela: Atendimentos ▸ Faturamento ▸ Pendências — colunas Movimento · Contatar · Paciente · Médico · Procedimento · Conta · Motivo · Valor · Convênio · Tipo; busca por Data da Conta ou Próx. Contato; "Vê Log".
- **Tipos de pendência cadastrados:** 1 Autorização Errada · 2 Erro de Matrícula · 3 Paciente Esqueceu de Assinar a Guia · 4 Aguardando Autorização.

## 8. Repasse aos médicos
- **Regras (Cadastros ▸ Tabelas ▸ Comissionamento ▸ Tipos de Comissão)** – colunas: Código · Unidade · Categ. Médico · Categ. Prod/Serv · Convênio · Plano · **% Comissão** · Validade até · Tp. Comissão (Percentual) · C.Resp · Valor Fixo · % Desconto · % Indicação · % Vinc/Atend · % Vinculado · % Atendido · % Perc. Dono · Operação (Soma) · Internação · Ambulatório · Turno.

| Cód | Unidade | Categoria do profissional | Categoria do procedimento | Plano | % repasse | % desconto |
|---|---|---|---|---|---|---|
| 1 | Consumed | Médico | Sem categoria (geral) | todos | **70%** | – |
| 2 | Consumed | Médico | Sem categoria | Unimed NI [médico] | 100% (valor cortado) | 0% |
| 3 | Consumed | Médico | Sem categoria | Unimed NI [médica] | 100% (valor cortado) | 0% |
| 8 | Sem unidade | [profissional específico] | Sem categoria | todos | **50%** | 15% |
| 9 | Consumed | Campo Visual | Procedimentos | todos | 100% (valor cortado) | 18% |
| 6 | Consumed | Campo Visual | Exames | todos | **40%** | – |
| 7 | Sem unidade | Médico | Campo Visual | todos | **40%** | – |
| 10 | Consumed | Médico | Consulta | todos | **60%** | – |
  Todas: tipo Percentual, operação "Soma", valem para internação e ambulatório, sem turno.
- **Categorias do Staff:** Campo Visual · Instrumentador · Instrumentador Unimed · Médico · Médico Endocrinologista · Primeiro Auxiliar · (2 categorias com nome de pessoa).
- Lançamentos Extras para Repasse: Médico · Data · Unidade · Descrição · Valor · Cód. Fluxo · Portador.
- Relatório: Relatórios ▸ Administrativos ▸ **Repasse Staff Médico**; botão "Calcula Repasse" na tela de contas.
- Na conta: "Fatura para médico que indicou", "Ñ calcula comissão", "Médico vinculado", "Vl. Staff".

## 9. Outros pontos
- Integração financeira "Cash ASP / Cash Master SP" (plano financeiro, portador, empresa por plano; nota fiscal).
- Dmed e recibos para particulares.
- Particular: pagamento informado na conta (Opções ▸ Pagamento de Particular) e preços distintos por Cartão × Dinheiro/Pix.

## 10. Pendências desta área
1. **Ver a tela da guia TISS** (botão TISS da conta de teste) — precisa da sua autorização.
2. Confirmar onde vocês controlam **protocolos, pagamentos e glosas** (no Micrologos estão vazios).
3. Confirmar o **portal/canal de envio** de cada operadora (Orizon? portal próprio?).
4. Confirmar os 3 percentuais de repasse que aparecem cortados (provavelmente 100%).


---

**PARTE 7 – arquivo original: C2-tela-da-guia-tiss.md**

# C2) Tela da guia TISS no Micrologos (vista com a Ana Carolina em 22/11/2026)

**Como abrir:** Conta ▸ buscar o paciente ▸ selecionar a conta ▸ botão **TISS** (lado esquerdo).
**Exemplo usado:** paciente de teste "Teste" (cód. 69489), conta 270743, Klini Saúde, Consulta em Consultório.
A guia estava **"TISS Conferido"**, por isso aparece o aviso *"Alteração possível somente após des-conferir as informações sobre a TISS"*: a guia conferida fica **travada**. Nada foi alterado.

## Janela "Informações TISS da Conta NNNN – Ambulatório"
Topo: **Tipo da Guia** (ex.: SP/SADT – travado depois de conferido) · Nome do beneficiário · botão **2º Plano**.
Rodapé: **Ok** · Refaz · **PDF** · **Imprime Guia** · **Des-Confere TISS** (mostra quem conferiu e quando) · status "Atualizado" · **Cancela**.

### Aba 1 – Bloco Padrão
- **Nº Guia** (prestador) · **Nº Guia Operadora** · **Nº Guia Principal** · **Dt. Autoriz.** · **Senha** · **Validade** (da senha).
- Dados do Beneficiário: **Emissão** · **Nº carteira** (com máscara do plano) · **Plano** · **Valid. carteira**.
- Dados do Atendimento: **Indicação do Acidente** (lista) · **Nº Guia OPME** · **Tipo de doença** (Aguda / Crônica / Nenhuma) · **Tempo da doença** (nº + Dias / Meses / Anos / Nenhum).
- **Observação** (até 1000 caracteres, com contador).

### Aba 2 – Solicitação
- Contratado Solicitante: Código por **C.Oper. / CNPJ / CPF** (ex.: CNPJ 05.894.660/0001-87) · Nome do contratado (Consumed Consultórios Médicos Ltda) · **Código CNES** (3176479) · **Nº Guia Solicitação (SADT ou Res.)**.
- Profissional Solicitante: nome (busca em Médico ou Contato externo) · **Conselho Profissional** (Conselho Regional de Medicina) · **Nº Conselho** (CRM) · **UF** · **Código CBO** (225265) · **Data/Hora da Solicitação**.
- **CID-10** (código + descrição).
- **Caráter da Solicitação:** Eletiva / (Urgência).

### Aba 3 – Executante
- Contratado Executante: Código por **C.Oper. / CNPJ / CPF** · **Reg. ANS** do plano (ex.: 422029 Klini) · **C. Oper.** (código na operadora) · Nome do contratado · endereço completo (tipo de logradouro, logradouro, nº, complemento, município, UF, **Cód. IBGE**, CEP) · **Código CNES**.
- Profissional Executante: código por C.Oper./CNPJ/**CPF** · "Somente esse médico sairá na guia como executante" · nome · CPF · **Conselho** · **Nº no conselho** · **UF** · **Código CBO** (2252.65) · **Grau de Participação** (ex.: 12 – Clínico).

### Aba 4 – Atendimento (Dados do Atendimento SP/SADT)
- **Tipo Atendimento** (ex.: 23 – Exames) · **Motivo Saída** (ex.: 12 – Alta melhorado) · **Regime de Atendimento** · **Saúde Ocupacional** · **Cobertura Especial** · **Ausência Cód. Validação** · **Tipo Consulta** (ex.: 1 – Primeira consulta) · **Tipo Saída** (ex.: 5 – Alta).
  Todas são listas com os códigos das tabelas de domínio da ANS.

### Aba 5 – Procedimentos
- Grade: ✓ (sai na guia) · **Médico** · **AMB/Cd.Espec** (código enviado, ex.: 98901012) · **Procedimento** · **Valor Total** · **Qtd**.
- Para cada item: **Procedimento Principal** · **Técnica Utilizada** (Convencional…) · **Tipo Cirurgia / Via de Acesso** (Única…) · **Cód. TISS (só se for diferente)** · **Procedim. Emergência** · **Grau de Participação** · **Sem guia** / **Guia de Honorário** (nº).

## Observações para o sistema novo
1. **Guia conferida = travada:** só altera depois de "Des-Conferir", que registra quem conferiu e quando. Vale manter esse controle (trilha de auditoria).
2. Os dados vêm **pré-preenchidos** da conta, do cadastro do convênio, do médico e da unidade. A pessoa só completa senha, autorização, carteira e CID.
3. Na guia de teste, o código enviado é **98901012** (código próprio da tabela de pacote da Klini), e não o TUSS 10101012. Os códigos podem mudar por tabela/convênio.
4. Botões **PDF** e **Imprime Guia** geram a guia em papel no modelo ANS.


---

**PARTE 8 – arquivo original: D-xml-tiss.md**

# D) XML TISS — onde ficam os arquivos

**Status:** localizado. **Nenhum XML foi aberto nem copiado.** Só olhei o registro de "Ocorrências" de cada lote e a lista de nomes de pastas do disco C:.

## 1. Onde o XML é gerado no sistema
- Atendimentos ▸ Faturamento ▸ Cobranças ▸ **Cobranças de Convênios** → selecionar o processo (lote) → botão lateral **TISS**.
- Ao gerar, o sistema pede um **"Termo de concordância"** e grava uma **ocorrência automática** no processo (aba Detalhamento ▸ Ocorrências) com: usuário e data/hora, nº do(s) lote(s), computador, pasta, nome do(s) arquivo(s) gerado(s) por tipo de guia (SP/SADT, Consultas…), valor da cobrança e total lido nos XMLs.
- Conferência: aba Ocorrências ▸ **Verificação de Arquivos XMLs** (compara contas × XML, guias, procedimentos, despesas, OPME).
- Configuração por convênio: Cadastros ▸ Convênios ▸ Detalhamento ▸ 1ª/2ª/Outras Config. TISS (versão TISS, formato de data, codificação, nº de dígitos do lote, nº máximo de guias por XML…).

## 2. Onde os XML ficam guardados
- **Computador:** DESKTOP-MCDT7V5 (este computador).
- **Pasta:** uma pasta por convênio **direto no disco C:** — `C:\<Nome do convênio>\`.
- Pastas existentes no C: (só os nomes, conferidos agora):
  `C:\Amil` · `C:\Assim` · `C:\Assist` · `C:\Blue Saúde` · `C:\Bradesco` · `C:\Bradesco Saude Operadora` · `C:\CEDAE` · `C:\CEDAE - Periodico` · `C:\Fechamento Unimed` · `C:\Fundação Saúde` · `C:\Geap` · `C:\Golden` · `C:\Hapvida - Intermédica` · `C:\Intermédica` · `C:\Klini` · `C:\Med Service` · `C:\Notredame` · `C:\Porto Seguro` · `C:\Saude Caixa` · `C:\Select` · `C:\Unimed - Consumed Prestador` · `C:\Unimed Gelson` · `C:\Unimed Gisele` · `C:\Unimed Luciano` · `C:\Unimed Max`
- Exemplos confirmados pelas ocorrências de out/2026: Unimed (médicos) → `C:\Unimed Gelson`, `C:\Unimed Gisele`; Amil → `C:\Amil`; Geap → `C:\Geap`; Klini → `C:\Klini`; Porto Seguro → `C:\Porto Seguro`; Bradesco Operadora → `C:\Bradesco`.
- **Não há opção de "baixar XML" dentro do sistema**: os arquivos ficam nessas pastas do computador.
- Atenção: a geração foi feita **neste** computador; se outras pessoas geram XML em outras máquinas, pode haver pastas iguais nelas.

## 3. Padrão do nome do arquivo
`<Registro ANS com 6 dígitos><AAAA><MM><nº do lote com 4 dígitos>_<código hash de 32 caracteres>.XML`

Exemplo (Amil, lote 197, competência 08/2026): `3263052026080197_<hash>.XML`
- 326305 = registro ANS da Amil
- 2026 08 = ano/mês de competência
- 0197 = número do lote
- `_<hash>` = código de 32 caracteres (hash MD5 exigido pelo padrão TISS)

Outros exemplos do padrão: Porto Seguro `000582…` (ANS 582 com zeros à esquerda), Bradesco Operadora `421715…`, Klini `422029…`, Geap `323080…`, Unimed `344397…`.

## 4. Versões TISS usadas nos XML
4.01.00 (maioria) · 4.03.00 (Bradesco) · 4.02.00 (Cedae, Klini) · 3.02.01 (particulares Appai/Assist). Codificação UTF-8 ou ISO-8859-1 conforme o convênio.

## 5. Sugestão para enviar exemplos à equipe com segurança
Escolher 1 XML recente de cada versão/tipo (ex.: `C:\Amil`, `C:\Bradesco`, `C:\Klini`, `C:\Geap` – este último é de **Consulta**) e:
1. **Não enviar por WhatsApp/e-mail comum**: os XML têm nome, carteirinha e procedimentos dos pacientes (dados de saúde – LGPD).
2. Preferir enviar **XML de lotes do paciente de teste** ou pedir para a equipe técnica receber por canal seguro (pasta compartilhada com acesso restrito) e com termo de confidencialidade.
3. Se possível, a equipe pode **anonimizar** (trocar nomes/carteirinhas) antes de usar — mas atenção: alterar o XML muda o hash, então ele serve só como modelo.


---

**PARTE 9 – arquivo original: D2-xml-tiss-cirurgias-e-injecoes.md**

# D2) Análise dos XML TISS reais — cirurgias, injeções, exames e consultas

**Data:** 22/11/2026 · **Autorização:** Ana Carolina liberou a leitura dos XML nas pastas `C:\<convênio>`.
**Privacidade:** li 41 XML recentes (Unimed Consumed, Amil, Bradesco Saúde e Bradesco Operadora) **com um programa que extrai só a estrutura e os códigos de configuração**. Nenhum nome, carteirinha, CPF, senha ou nº de guia de paciente foi anotado. CPFs de médicos também foram omitidos. As cópias temporárias foram **apagadas** ao final.

---

## 1. O que existe em cada pasta de convênio
Além dos XML, as pastas guardam o **controle manual pós-envio**:
- **Unimed – Consumed Prestador:** PDFs "Remessa de Documentos Recebido" e "RemessaXXXXXXXX.pdf" (comprovantes do portal) + pasta **"Recurso de glosa"**.
- **Amil:** "Capa de Lote NNN.pdf", "Comprovante _Lote NNN.pdf", "Protocolo – Lote NN.pdf", "Recibo de entrega … Previsão de pagto …pdf", contrato e anexos da rede.
- **Bradesco:** XML de **Bradesco Saúde (ANS 005711)** e **Bradesco Operadora (ANS 421715)** **na mesma pasta**, mais arquivos **.ZIP** com o mesmo padrão de nome (o portal do Bradesco recebe o lote compactado).
➜ **Requisito para o sistema novo:** anexar ao lote o protocolo/comprovante/capa e registrar a previsão de pagamento (hoje isso fica em PDFs soltos na pasta).

## 2. Regras gerais (valem para todos os XML analisados)
| Item | Valor encontrado |
|---|---|
| Codificação | `ISO-8859-1` em **todos** (inclusive Amil, cujo cadastro diz UTF-8 — conferir) |
| Transação | `ENVIO_LOTE_GUIAS` · `sequencialTransacao` = nº do lote com 12 dígitos (ex.: 000000000258) |
| Versão (`Padrao`) | Unimed e Amil **4.01.00** · Bradesco Saúde e Operadora **4.03.00** |
| Origem | `codigoPrestadorNaOperadora`: Unimed **1474** · Amil **10453164** · Bradesco **0000110502** |
| CNES do executante | **3176479** (Consumed) |
| Conselho / UF / CBO | `06` (CRM) · `33` (RJ) · **225265** (médico oftalmologista) |
| Fim do arquivo | `epilogo/hash` (MD5 do conteúdo) |
| Nome do arquivo | `<ANS 6 dígitos><AAAAMM><lote 4 dígitos>_<hash>.xml` |
| 1 lote = 1 tipo de guia | cada XML contém só Consulta, **ou** só SP/SADT, **ou** só Honorários |

## 3. CIRURGIAS — Guia de Honorários (`guiaHonorarios`)
Usada pelo **Bradesco** e pela **Amil** (Facectomia com LIO 30306027, Cirurgias Fistulizantes Antiglaucomatosas 30310032…). Estrutura exata:

```
guiaHonorarios
 ├ cabecalhoGuia: registroANS, numeroGuiaPrestador
 ├ guiaSolicInternacao        (nº da guia de solicitação/internação)
 ├ senha                       (senha de autorização)
 ├ numeroGuiaOperadora
 ├ beneficiario: numeroCarteira, atendimentoRN (N)
 ├ localContratado             ← HOSPITAL/CENTRO CIRÚRGICO onde a cirurgia foi feita
 │   ├ codigoContratado/codigoNaOperadora   (código do hospital na operadora)
 │   ├ nomeContratado
 │   └ cnes                                  (CNES do hospital)
 ├ dadosContratadoExecutante   ← A CLÍNICA (quem cobra o honorário)
 │   ├ codigonaOperadora  (Bradesco 0000110502 / Amil 10453164)
 │   └ cnesContratadoExecutante (3176479)
 ├ dadosInternacao: dataInicioFaturamento, dataFimFaturamento, caraterAtendimento (1 = eletivo)
 ├ procedimentosRealizados/procedimentoRealizado  (1 por profissional/procedimento)
 │   ├ sequencialItem, dataExecucao
 │   ├ procedimento: codigoTabela (22 = TUSS), codigoProcedimento, descricaoProcedimento
 │   ├ quantidadeExecutada, viaAcesso (1), tecnicaUtilizada (1)
 │   ├ reducaoAcrescimo, valorUnitario, valorTotal
 │   └ profissionais: grauParticipacao, codProfissional, nomeProfissional,
 │                    conselhoProfissional (06), numeroConselhoProfissional, UF (33), CBO (225265)
 ├ observacao
 ├ valorTotalHonorarios
 └ dataEmissaoGuia
```
**Locais (hospitais) encontrados nas guias:**
| Convênio | localContratado | Código na operadora | CNES |
|---|---|---|---|
| Bradesco Saúde | PRO OFTALMO MICRO CIRURGIA OCULAR S/C LTDA | 193216 | 5325722 |
| Amil | BARRA DAY SERVIÇOS MÉDICOS LTDA | 73122076 | 102881 |
➜ Isso explica as **"Unidades"** do Micrologos: são os hospitais onde os médicos operam; o cadastro precisa guardar **código na operadora e CNES de cada hospital por convênio**.

**Equipe:** cada cirurgia gera itens com **grauParticipacao 00 (cirurgião) e 01 (1º auxiliar)** — o mesmo procedimento aparece uma vez para cada profissional.
**Atenção – fator `reducaoAcrescimo`:** Bradesco usa **2.00** na facectomia; Amil usa **1.00**. ⚠️ Confirmar a regra (bilateral? acordo do Bradesco?). Esse fator multiplica o valor e é ponto clássico de glosa.
**Diferença Amil × Bradesco:** na Amil o campo `caraterAtendimento` e `atendimentoRN` **não aparecem em todos os itens/guias** (opcional na 4.01.00); no Bradesco (4.03.00) sempre aparecem.

## 4. INJEÇÕES INTRAVÍTREAS e CIRURGIAS na UNIMED — SP/SADT com PACOTE
A Unimed (Consumed Prestador, ANS 344397) **não usa guia de honorários**: tudo vai em **SP/SADT com códigos de pacote da tabela 98**.
| Código | Descrição | Ocorrências (lote 258) |
|---|---|---|
| 69911312 | Pacote Tratamento Ocular **Eylia** | 27 |
| 69911096 | Pacote Fotocoagulação Unimed | 5 |
| 69911070 | Pacote **Facectomia** com Lente Intraocular | 3 |
| 69911320 | Pacote **Ozurdex** Unimed | 2 |
| 69911185 | Pacote Pálpebra Reconstrução Total | 1 |
Campos usados: `codigoTabela` **98** (pacotes) · `grauPart` **00** dentro de `equipeSadt` · `reducaoAcrescimo` 1.00 · `tipoAtendimento` **03** (maioria) ou **02** · `regimeAtendimento` 01 · `tipoConsulta` 2 · `indicacaoAcidente` 9 · `caraterAtendimento` 1 · `indicacaoClinica` preenchida · `dadosAutorizacao` com **numeroGuiaOperadora, dataAutorizacao, senha e dataValidadeSenha** (obrigatórios em todas as 38 guias).
Solicitante: `nomeContratadoSolicitante` = CONSUMED CONSULTÓRIOS MÉDICOS LTDA ou o **próprio médico** (ex.: Dr. Antonio, médico de fora). `codigoPrestadorNaOperadora` do executante 1474 e do profissional na equipe = código de cooperado do médico.
➜ **Para o sistema novo:** a injeção (Eylia, Ozurdex, Lucentis) precisa ser cadastrada **como pacote por convênio** (Unimed = código 699…/tabela 98; outras operadoras podem usar TUSS 30312132 + medicamento). Não encontrei nenhum lote com `outrasDespesas` (medicamento/material separado) nas amostras — o medicamento vai embutido no pacote.

## 5. EXAMES — SP/SADT (`guiaSP-SADT`) com TUSS (tabela 22)
Exemplos: Tonometria 41301323, Microscopia Especular 41301269, Ceratoscopia 41301080, Paquimetria 41501128, Mapeamento de Retina 41301250, Retinografia 41301315, Gonioscopia 41301242, OCT 41501144, Biometria 41501012, Angiografia 41301013, Ultrassonografia 40901017, Exercícios de Ortóptica 20103239, Capsulotomia YAG 30306019, Fotocoagulação 30312043, Iridotomia 30310083.
Estrutura: cabecalhoGuia · dadosAutorizacao · dadosBeneficiario · dadosSolicitante (contratado + profissional) · dadosSolicitacao (dataSolicitacao, caraterAtendimento, indicacaoClinica) · dadosExecutante (código + CNES) · dadosAtendimento (tipoAtendimento, indicacaoAcidente 9, tipoConsulta, regimeAtendimento 01) · procedimentosExecutados (sequencialItem, dataExecucao, procedimento, quantidade, viaAcesso 1, tecnicaUtilizada 1, reducaoAcrescimo, valores, **equipeSadt** com grauPart **12** (executante) e CBO 225265) · observacao · valorTotal.
- `tipoAtendimento`: Bradesco e Amil usam **23** (exames); alguns itens **03**.
- **`reducaoAcrescimo` 2.00** aparece em exames binoculares (microscopia, paquimetria, ceratoscopia) na Amil e no Bradesco → o sistema marca **"ambos os olhos" = fator 2**. ⚠️ Confirmar se é essa a regra.
- **Amil manda a CONSULTA dentro da SP/SADT** (10101012, tabela 22, tipoAtendimento **04**, grauPart 12, tipoConsulta 1 ou 2).

## 6. CONSULTAS — Guia de Consulta (`guiaConsulta`) — Bradesco
Estrutura: cabecalhoConsulta (registroANS, numeroGuiaPrestador) · numeroGuiaOperadora · dadosBeneficiario (numeroCarteira, atendimentoRN) · contratadoExecutante (codigoPrestadorNaOperadora, CNES) · profissionalExecutante (nome, conselho, nº, UF, CBOS) · indicacaoAcidente · dadosAtendimento (regimeAtendimento, dataAtendimento, tipoConsulta, procedimento: codigoTabela 22 + 10101012 + valorProcedimento) · observacao.

## 7. Resumo por convênio (amostra out–nov/2026)
| Convênio | Versão | Consulta | Exames | Cirurgia | Injeção |
|---|---|---|---|---|---|
| Unimed Consumed (cirurgia) | 4.01.00 | – | – | SP/SADT pacote (tab. 98) | SP/SADT pacote Eylia/Ozurdex (tab. 98) |
| Amil | 4.01.00 | **dentro da SP/SADT** | SP/SADT | Honorários (local = Barra Day) | (não visto na amostra) |
| Bradesco Saúde | 4.03.00 | Guia de Consulta | SP/SADT | Honorários (local = Pro Oftalmo), fator 2.00 | (não visto) |
| Bradesco Operadora | 4.03.00 | Guia de Consulta | SP/SADT | (não visto) | (não visto) |

## 8. Respostas da Ana Carolina (22/11/2026)
- **Fator 2,00** em exames de ambos os olhos e na facectomia do Bradesco está **correto**. Cada convênio cobra conforme o contrato, e o sistema novo precisa permitir **regra de fator por convênio × procedimento**, sem padronizar.
- **Injeções:** hoje só são cobradas na **Unimed**. Amil, Bradesco, Geap e Hapvida **não** têm injeção (o credenciamento está em andamento). ➜ O sistema novo deve permitir cadastrar o pacote de injeção por convênio quando o credenciamento sair.
- **Envio compactado (.zip):** **Bradesco, Mediservice e Klini** só aceitam o lote **zipado** no portal. ➜ Requisito: gerar o XML e também o **.zip** com o mesmo nome.
- Mediservice e Porto Seguro são atendidos (já estão no `A-convenios.md`).

## 9. Pontos ainda a confirmar com o faturamento
1. O cadastro da Amil diz UTF-8, mas o XML sai em ISO-8859-1 — a Amil aceita normalmente?
2. Quais glosas mais aparecem hoje (pasta "Recurso de glosa" da Unimed)? Ajuda a desenhar validações no sistema novo.


---

**PARTE 10 – arquivo original: E-prontuario-pep.md**

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


---

**PARTE 11 – arquivo original: E2-pep-por-dentro.md**

# E2 – Tela do PEP por dentro (paciente de teste)

Visto em 22/11/2026 com o paciente de teste "Teste Micrologos". Nenhum prontuário real foi aberto. Nada foi incluído, salvo ou finalizado.

## Como a tela é organizada

Janela: "<Paciente>, - Atendimento(s): N (PEP)". O paciente de teste tem 0 atendimentos.

### Menu lateral ("Menu Atendimento")
O menu é dividido em grupos que abrem e fecham.

| Grupo | Itens |
|---|---|
| Paciente | Foto, Saudação |
| Prontuário | Histórico, Atendimentos, CID 10, Medicamento (ver medicamentos do paciente), Tipos de Atendimento, Aval. Fisioterápica |
| Imagens e Textos | Textos, Imagens, Multimídia (Ctrl+A, arquivos do paciente), Laudo com Frase, Prescrição Internação, Sistemas Integrados |
| Resumos | Queixas, Atendimentos, Configurado |
| Atalhos Operacionais | Repetir Atendimentos, Incluir CID 10, Incluir Medicamentos, Incluir Texto, Incluir Texto F6 a F12, Legendas dos Atalhos |

Os "Atalhos Operacionais" gravam informação. Por isso não cliquei neles.

### Cabeçalho do atendimento
- Data
- Staff (médico)
- Local
- Plano
- Idade e data de nascimento, calculadas a partir do cadastro

### Área central
- Abas da ficha clínica. Sem atendimento aberto, aparece só a aba "Queixa", com um campo de texto livre.
- As abas da ficha oftalmológica (as 12 fichas descritas em E-prontuario-pep.md) só aparecem depois de clicar em **Incluir**. Isso cria um atendimento, então não foi feito.

### Painel "Informações TISS" (dentro do PEP)
Neste paciente o painel aparece como <<CONFERIDO>> e todos os campos estão bloqueados.

| Campo | Observação |
|---|---|
| Tipo Saída | lista |
| Tipo de Atendimento | lista |
| Indicação Clínica | até 500 caracteres |
| Observação | até 500 caracteres |
| Indicador de Acidente | lista |
| Tempo Doença | número + Dias/Meses/Anos/Nenhum |
| Tipo de doença | Aguda/Crônica/Nenhuma |
| Laudos Méd. Especiais | caixa de marcar |
| Laudo Prorrogação | caixa de marcar |

**Importante para o novo sistema:** o médico já preenche dados da guia TISS (indicação clínica, tipo de atendimento, tempo de doença) dentro do prontuário. O novo sistema deve levar esses dados do PEP direto para a guia, sem redigitar. Hoje a indicação clínica é uma das causas comuns de glosa em cirurgias e injeções.

### Botões de baixo
| Botão | Efeito |
|---|---|
| Incluir, Excluir, Ok, Finalizar | Alteram dados (não usados) |
| Canc. | Cancela a edição |
| Listar | Imprimir/listar |
| Chamada, Nova Espera | Chamar paciente no painel ou devolver para a espera |

Barra de status: data/hora e "Visualizando 2012" (ano de referência da visualização).

## Fichas oftalmológicas por dentro

Com autorização da Ana Carolina (22/11/2026), criei UM atendimento no paciente "Teste Micrologos" (cód. atend. 251234) e depois o excluí. Os campos ficaram vazios. Ao final, o paciente voltou a ter 0 atendimentos.

### Como as fichas funcionam
- Dentro do atendimento existe a aba **Tipos de Atendimento**. Ela tem duas listas: "Possíveis" e "Utilizados".
- O médico escolhe quais fichas usar naquela consulta, usando as setas.
- Cada ficha escolhida acrescenta abas ao atendimento.
- Fichas possíveis:
  - 0001 Oftalmologia
  - 0004 Oftalmologia II
  - 0014 Oftalmo III
  - 0003 Anamnese
  - 0011 C.E.S. (Controle de Exames)
  - 0048 Consulta
  - 0049 Ficha de Catarata
  - 0047 Ficha de Retina
  - 0013 Lente de Contato
  - 0018 Óculos
  - 0012 Ortóptica
- Ao incluir, o sistema sugeriu sozinho Local = "Apartamento Cirúrgico" e Tipo Saída = "Alta".
- O rodapé mostra "Incluído por / em", "Atualizado", "Cód.Atend.", "Cód.Ag." (código do agendamento), "Agendado em", "Chegada" e "Atendido em".

### 0001 Oftalmologia → abas Queixa, Exames, Mapeamento, Óculos

**Queixa**
- Texto livre.

**Exames**
- Acuidade visual:
  - AV s/c (sem correção): OD/OE
  - c/at.corr.: OD/OE
  - c/c (com correção): OD/OE
- Ex. Externo, Biomicroscopia, Fundo de Olho: texto livre.
- Tonometria:
  - OD e OE em mmHg, mais a hora.
  - Botão "Tonometria" abre um gráfico com a evolução da pressão.
- Motilidade, Convergência, Reflexos: texto.
- PIO OD, Paquimetria, Fator Correção e PIO Final OD. O fator e a PIO final são calculados automaticamente, pela correção da PIO conforme a paquimetria.

**Mapeamento**
- Mapeamento Dir. e Esq.: texto.
- Dois quadros de desenho (OD/OE).
- Campos "Antes" e "Depois".

**Óculos (receita)**
- Para longe: OD/OE com Esférico, Cilíndrico, Eixo, e D.P. (lista).
- Adição: AO, OD, OE.
- Para perto: OD/OE com Esférico, Cilíndrico, Eixo, D.P. Esses campos são cinza e calculados automaticamente (longe + adição).

### 0049 Ficha de Catarata → aba "Avaliação pré-operatória de catarata"
- Refração: OD/OE com esf, cil, eixo, = (AV), Ad., J.
- Midríase: OD/OE em mm.
- Catarata:
  - Núcleo OD/OE
  - Cortical
  - SCP (subcapsular posterior)
- Reflexo: OD/OE (lista).
- Endotélio: Microscopia OD/OE, Guttata OD/OE (lista).
- SPH: OD/OE.
- Ceratometria: OD/OE, valor a eixo × valor a eixo.
- Biometria:
  - Método: IOL Master / Ultrassônica.
  - OD/OE: lente (lista), Grau, Refração planejada.
- Cirurgia Planejada: texto.
- Incisões relaxantes: OD/OE.
- Observações.

→ Esta ficha alimenta a cirurgia de catarata (escolha da LIO e grau). **O novo sistema deve levar a lente e o grau para a guia/OPME da cirurgia.**

### 0047 Ficha de Retina → abas "Ex. Oftalmológicos" e "+Biomicroscopia"

**Ex. Oftalmológicos**
- Acuidade visual corrigida e refração OD/OE.
- Córnea OD/OE: transparente, precipitado cerático, edema; observações.
- Ângulo OD/OE: rubeosis, iridodiálise, sinéquia periférica; observações.
- Câmara anterior OD/OE, com caixas de marcar:
  - rubeosis íris
  - íris em plateau
  - sinéquia anterior/posterior
  - iridectomia/iridotomia
  - hipópio
  - hifema
  - ar/gás
  - perfluorocarbono líquido
  - óleo de silicone
- Células, Flare, Observação.
- Caixa "Marcador".

**+Biomicroscopia**
- Cristalino OD/OE (lista).
- Pseudo-fácico OD/OE:
  - LIO no saco capsular / sulco ciliar / câmara anterior / descentrada
  - capsulotomia posterior
  - rotura de cápsula posterior
  - opacidade de cápsula posterior
  - "Indicação de capsulotomia posterior? Sim/Não"
- Fácico OD/OE:
  - Catarata (lista)
  - Nuclear
  - Subcapsular posterior/anterior
  - Polar posterior
  - Ectopia
  - Subluxação
  - Obs.

→ É a ficha de retina que acompanha as **injeções intravítreas** (Eylia, Ozurdex). Não há campos próprios de injeção (droga, lote, olho, nº da aplicação). Isso fica em texto ou só no faturamento. **Recomendação para o novo sistema:** criar um registro de aplicação intravítrea com olho, medicamento, lote, nº da dose e senha de autorização. Ele ligaria direto ao pacote Unimed (69911312 / 69911320).

### 0018 Óculos
- Acrescenta uma aba "ÓCULOS" igual à aba Óculos da ficha Oftalmologia.

### Grupos do menu que só aparecem com a janela grande
| Grupo | Itens |
|---|---|
| Ficha Pessoal | Dados Cadastrais, Comentários, Alerta Agenda, Alerta PEP |
| Marcações | Agendar Paciente, Programar Retorno, Indicação de Venda |
| Faturamento | Histórico Procedimentos, Seleciona Procedimentos. O médico pode lançar os procedimentos direto no atendimento, e isso gera a conta. |

## O que ainda não foi visto
- Fichas 0004 Oftalmologia II, 0014 Oftalmo III, 0003 Anamnese, 0011 C.E.S., 0048 Consulta, 0013 Lente de Contato, 0012 Ortóptica.
- Como a receita de óculos e a prescrição são impressas.
- O que "Seleciona Procedimentos" faz exatamente: provavelmente cria a conta. Não cliquei para não gerar faturamento.


---

**PARTE 12 – arquivo original: F-agenda-recepcao.md**

# F) Agenda e recepção — Micrologos

**Status:** mapeado em modo de leitura.
⚠️ **Ocorrência:** ao fechar o "Mapa de Horário", um clique meu caiu no lugar errado e abriu o **formulário de inclusão de agendamento** com a busca de paciente. Fechei a busca sem escolher ninguém e cliquei em **Cancela**. **Nada foi gravado**: a grade continuou vazia no horário. Também mudei por engano o **filtro de visualização "Status"** da tela (só filtro de exibição); ele volta ao normal ao reabrir a agenda.

## 1. Telas
- Botão **Agenda** na barra principal (abre a agenda do último local usado — no caso, "Centro Cirúrgico").
- Menu Atendimentos ▸ Agendas ▸ **Ambulatório** · **Cirurgia** · Retorno · Fila do Totem · Ocupação.
- Botão **Totem** (autoatendimento/chegada) e **Chamar na TV** (painel de chamada).

## 2. Tela da agenda
- **Calendário de 3 meses** com cores de ocupação: 100% · 51 a 99% · 1 a 50% · 0% · "ñ atend" (sem atendimento).
- **Mapa de Horário – Ocupação/Possibilidade** (janela que abre junto): por médico/local, mostra "ocupados / possíveis" por dia da semana, com cores (até 25%, até 50%, até 75%, 100%, Extra, Ñ Atende), filtros por Unidade e Atendimento, botões −Dia / +Dia, 2º Plano.
- **Visualização:** Locais de Atendimento · Todos os Médicos · Médicos do Dia · Médicos do Dia (Manhã) · (Tarde) · (Noite) · Fila do Totem. Turnos: Manhã / Tarde / Noite.
- **Filtros:** Ñ mostrar Canc./Desist. · Bloq. · Mostrar só Vagos · Teleatendimento · Interconsulta · horário De/Até · **Status** · Nome (a partir de 3 letras).
- **Grade (colunas):** HORA · Paciente · 1ª (1ª vez) · Rev (revisão) · ☎ (confirmação) · ícones · ⏳ · NºAt · Plano de Saúde · $ · Status/Chegada · Local/Obs.Loc. · Ações (botão Incluir) · Status Autorização · Notas · Unidade · Tipo Anestesia · Motivo (Ausência, Canc., …).
- Intervalo da grade do Centro Cirúrgico: **15 minutos** (08:00, 08:15…). Na agenda do médico os horários são de **10 em 10 minutos** (ver Horários dos médicos).
- **Painel direito:** Telefones/Nasc. Paciente · Notas · Obs. do Dia do Médico · Sessão · Tp.Atend · Guia · Unidade · Local · histórico (Inclusão, Alteração, Última alteração de status, Status de chegada, Status atendido).
- **Barra de botões:** Incluir · Alterar · Listar · Excluir · Opções · Marcado · Ag.Intelig. · Ordem · Sair · Encaixar · Chegada · Atendido · Procedim. · Fatura · Status · Retorno · Conta · Mapa.

## 3. Formulário de agendamento (campos vistos ao abrir "Incluir" – cancelado)
Hora · Duração (min) · Encaixe · Urgência/Emerg. · Ordem Chegada · Preferência · Prioridade · Teleatendimento · Interconsulta · Paciente (busca, F12) · 1ª vez · Revisão · Unidade · Plano de Saúde · Local · Atendimento (tipo) · Especialidade · Notas · Últ. Cons. · aba **Convênio** (Matrícula, Validade, Via, Últ. Pgto, Titular, CPF) · aba **Outros** · aba **Cirúrgico** · botões Ok / Cancela.
Busca de paciente: Nome · CPF · Data de nascimento · Telefone · Código · Ficha · Matrícula do convênio · Sexo · sem inativos · busca dentro do nome, 2 nomes (E/OU), fonética, apelido, nome social.

## 4. Status do agendamento (lista do filtro "Status")
Esp.Pend (espera pendente) · Espera · ReEspera · Atendido · Atendendo · Desistiu · Faltou · Canc.Pac (cancelado pelo paciente) · Canc.Med (cancelado pelo médico) · Email Conf · Email Canc · Whats Conf · Whats Canc (confirmação/cancelamento por e-mail e WhatsApp) … (podem existir mais itens no fim da lista).

## 5. Menu Opções da agenda (olhado, nada executado)
- **Agendamentos Especiais:** Agendamentos Simultâneos (Ctrl+S) · Agendamento Inteligente (Ctrl+Alt+D) · Agendamento por Procedimento (Ctrl+Alt+Z) · Importa Agenda SUS · Coloca na Fila de Espera do Médico.
- Fila de Espera da Agenda.
- **Alterações:** Bloquear/Desbloquear Horário · Excluir horário avulso · Informa Motivo (Ausência, Canc, Desist, Emerg) · Transferir Unidade · Transfere Local · Transferir de Médico · Muda de agenda pacientes não atendidos · Muda Médico que indicou (pré-faturamento).
- **Etapas Preparação do Atendimento:** Manipula Etapas · Colore Agenda por Etapas.
- Marcar Sessão (F8) · Chamar na TV.
- **Outras Opções:** Preencher Arquétipos · Orçamentos dos Pacientes (F6) · Carteira de Vacinação · Envio rIAR · Legenda · Teclas de Atalho (F7) · Mostra Menu de Opções.
- **Estatísticas:** Exames Agendados · Estatística de Ocupação do dia · Estatística de Confirmações.
- **Visualizações:** Vê exames do paciente do dia · Log do paciente · Atendimentos do paciente · Busca agendamento por código · Agendamentos do paciente · Avisos do paciente · PEP do paciente · Exames solicitados ao paciente · Dúvida sobre o crédito do paciente · Procedimentos realizados no paciente · Motivo · Procedimentos da revisão.
- **Horários:** Próximo Vago · Próximo Vago por descrição.
- **Configurações:** Refazer tela · QRCode – Atualização de dados do paciente.
- **Capturar:** Nome do Paciente · Imagem Automático.

## 6. Regras de marcação (onde ficam)
- **Por médico** (Cadastros ▸ Staff Médico ▸ Detalhamento):
  - Aba *Permissões:* Qtde máxima de encaixes/dia (−1 = sem permissão) · Qtde máx. de revisões/dia · Qtde máx. de agendas/dia (ou por dia da semana) · Qtde máx. menor de idade/dia · Qtde máx. 1ª vez/dia · Idade mínima para atendimento.
  - Aba *Inf. PEP:* **Nº de dias para agendar o próximo atendimento (ex.: 30)** · Qtde de dias antes para confirmar retorno (ex.: 7) · Confirmação de retorno via (Telefone…) · Tipos de atendimento (fichas) permitidos · PEP sigiloso.
  - Aba *Agenda/Fat.:* Prioridade na Agenda Inteligente · Recibo em nome de (médico PF / emitente da unidade PJ / razão social do médico PJ) · Controle de permissão de plano (sem controle / pela regra / pela exceção) · Tipo atendimento 1ª vez · Executante padrão · Valor da hora por dia (relatórios).
  - Usa Agendamento · Usa Agendamento na Web (qtd. dias à frente) · Agenda fechada a partir de (data) · Quantidade máxima de procedimentos por dia.
- **Por convênio/plano:** dias para retorno, atendimentos por mês/dia, senha do supervisor no agendamento (ver Área A — vazios na prática).
- **Por local:** quantidade máxima de agendamentos por horário · usa na agenda do ambulatório / emergência / internação / cirurgia · agenda por ordem de chegada (totem) · procedimentos permitidos por faixa de horário.
- **Por procedimento:** dias para agendar próximo atendimento, observação da agenda/preparo, tempo de duração.
- **Classificação de guias:** permite escolher exames no agendamento.

## 7. Horários dos médicos
Cadastros ▸ Staff Médico ▸ aba **Horários**: grade por hora (intervalos de **10 min**, ex.: 08:00, 08:10, 08:20…) × dia da semana (Dom a Sáb), marcando em qual **unidade** o médico atende. Sub-abas: **Atendimento · Bloqueados · Avulsos · Ausências**. Botões: Novo Horário · Retirar Horário · Inclusão por intervalo · Alteração personalizada · Excluir todos os horários (nenhum foi usado).
Os locais também têm aba Horários (grade igual) e Procedim. (procedimentos permitidos por hora).


---

**PARTE 13 – arquivo original: G-cadastros-de-apoio.md**

# G) Cadastros de apoio — Micrologos (ML Clinic Master ASP 13.13.30.00)

**Status:** concluído (somente leitura).

> Sistema: **ML Clinic Master ASP – versão 13.13.30.00** (programa Windows `C:\MLMaster\mlclmadv.exe`). Nome exibido: "Consumed". Usuário: AnaCarolina (perfil *MASTER*). Logotipo **Orizon** na tela de abertura.

## 1. Menus do sistema
**Barra superior:** Sistema · Cadastros · Atendimentos · Relatórios · Ferramentas · Linha Master.
**Botões grandes:** Agenda · PEP · Cirurgia · Conta · Solicitação · Cobrança · Totem · Paciente · Sair.
**Barra secundária:** Chrome · Papel Parede · Vídeos · Versões · BI · Seu Micrologos · Tarefa · To Do.
**Painel lateral:** Perfil · Bloquear · Entrar no Talk · Enviar Mensagem · Favoritos · Bloco de Notas · Configurações · Requisição do Setor · Fonte de Conhecimento · Suporte Micrologos.

- **Sistema:** Login · Logout · Utilitários ▸ · Sair.
- **Cadastros:** Unidades · Pacientes · Staff Médico · Convênios/Planos Saúde · Contatos Externos · Procedimentos · Produtos · Serviços · Tabelas ▸
  - Atendimento ▸ Categorias de Locais de Atendimento · Locais de Atendimento · Status dos Locais · Protocolos de Tratamento · Sessões ▸ (Aparelhos, Lados, Regiões) · Ficha de dados ▸ (Grupo de Limites, Limites, Campos, Arquétipos, Campos por procedimentos, Config. Central Imagens) · Representantes · Equipes Médicas · Especialidades · Motivos · CID-10 · Medicamentos Ambulatoriais · Categorias de Texto · Textos
  - Faturamento ▸ Tipo de Pendências · Tipos de Glosas · Centro de Responsabilidade · Turnos · Classificação de Guias · Classificação de Atendimentos · Configuração para Faturamento Automático · Configuração de Taxas · Layouts de Convênios
  - Comissionamento ▸ Categorias do Staff Médico · Donos de Equipamentos · Tipos de Comissão
  - Produtos/Serviços ▸ Categorias · Unidades de Produtos · Marcas · Tempo de Duração Atendimento · Brasíndice · Preços
  - Prescrição ▸ Formas de Aplicação · Intervalos de Aplicação
  - Laudo ▸ Títulos de Laudo · Frases de Laudo
  - Pacientes ▸ Empresas · Profissões · CEP · Acompanhantes · Tipos de Ocorrências
  - Diversos ▸ Facilitadores · Feriados · IBGE Localidade
- **Atendimentos:** Agendas ▸ (Ambulatório, Cirurgia, Retorno, Fila do Totem, Ocupação) · Atendimento ▸ (Atendimento, Centro Cirúrgico, Inform. Médicas Pendentes, Solicitações Procedimento, Orçamentos de Pacientes) · Faturamento ▸ (ver Área C) · Solicitações ▸ (Requisição/Devolução Ambulatório, Prescrição Médica Ambulatório, Requisições Encerradas, Requisição/Devolução Consumo de Setor).
- **Ferramentas:** Configurações ▸ (Sistema, Volta config. inicial da tela, Fichas de Dados) · Manutenção do Sistema ▸ (Manutenção Completa, Exclui Arq. Aux. Inclusão Ag., Cancela Avisos de Entrada, Calcula Ponto Equilíbrio diário, Unifica Bairros dos Pacientes, Interfaces Web ▸ Exporta Comissão dos Médicos, Interfaces Diversas ▸ Importa Excel Padrão Faturamento) · Assistente de Implantação · Tutoriais · Módulos WEB · Cascata (F2) · Calculadora (F3) · Calendário (F4) · Enviar Mensagem (F5) · Troca de Senha · Link Suporte ML · Link Chat · Arquivo de Configuração Assinatura Eletrônica · Suporte Autorizado · Backup · Atualiza Árvore de Opções dos Perfis · Associa Imagem/Multimídia aos Pacientes.
- **Linha Master:** Security Master (controle de usuários/perfis).

## 2. Unidades (Cadastros ▸ Unidades) – 14
| Cód | Unidade | Emitente | Empresa |
|---|---|---|---|
| 3 | Barra Day Serviços Médicos Ltda | idem | Sem empresa |
| 11 | Clínica e Cirurgia de Olhos Dr. [nome] Ltda | idem | Sem empresa |
| 12 | Consumed | Consumed | Consumed |
| 1 | **Consumed Consultórios Médicos Ltda** (principal) | Consumed | Consumed |
| 6 | Day Clinic Méier | idem | Sem empresa |
| 5 | Hospital Daniel Lipp Ltda | idem | Sem empresa |
| 7 | Hospital Oftalmológico da Barra | idem | Sem empresa |
| 4 | Jardim de Alah Centro Cirúrgico Ltda | idem | Sem empresa |
| 2 | Largo do Machado | idem | Sem empresa |
| 14 | Oftalmo Rio Centro de Micro Cirurgia Ocular Ltda EPP | idem | Sem empresa |
| 10 | Pro Oftalmo Micro Cirurgia Ocular S/C Ltda | idem | Sem empresa |
| 13 | Rio Vision Hospital Ltda | idem | Sem empresa |
| 15 | Unimed Regional Fluminense Cooperativa de Trabalho Médico | idem | Sem empresa |
| 9 | UTI Rio Serviços Médicos Ltda | idem | Sem empresa |
Campos da unidade: Descrição · Emitente · Empresa · CPF responsável (DMED) · Código ANVISA · Shop Master · Portador do "caixinha" (particular) · abas **Informações TISS** (CNES 3176479 + código na operadora por convênio: Assim 30717, Unimed médicos, Geap 17101182, Hapvida 17687, Fundação Saúde Itaú 00119315, Klini CNPJ) · Imagens para Laudo · Outras Informações · Ficha Anestesista · aba Faturamento.
> As outras unidades parecem ser **hospitais/centros cirúrgicos parceiros** (onde os médicos operam).

## 3. Staff Médico (Cadastros ▸ Staff Médico) – 22 ativos
Inclui médicos e também "agendas" de recursos (Centro Cirúrgico, Contatólogo, Campo Visual, Ortóptica, Orientação Cirúrgica, Consumed Olhos, Prestador Não Identificado Migração, Médico Transcrição).
Médicos (categoria Médico, com CRM): Antonio Carlos de Souza Ferreira · Gelson Moura Brasil · Gisele Moura Brasil · Luiza Morone Pereira · Marcos Aurelio Costa Leal Arnaut · Max Oliveira Guimarães · Pedro Boni Gonçalves · e outros (Annamaria, Matheus, Renato – categoria "Fernanda Passarelli"; Luciano – Instrumentador; Eveline – Campo Visual).

**Abas do cadastro:**
- **Detalhamento:** Código · Nome · Nome abreviado · Apelido · Inativo · Endereço completo · Transferência · Admissão · **CRM** · CPF · CNPJ · Usuário do médico · **Categoria** · Tipo de atendimento · **RQE / 2º RQE** · RG · **CNS** · **Cód. Unimed (Abrange)** · Usa agendamento · Usa agendamento na Web · Agenda fechada a partir de · 4 telefones · Qtde máx. de procedimentos/dia.
  - Sub-abas: End./Tel./Docs · **Inf. PEP** · **Agenda/Fat.** · **Permissões** · **Inf. TISS** · Plano Saúde PF · Inf. MLPay.
  - **Inf. TISS:** Código CNES · **Nº no conselho** (CRM sem prefixo) · **Conselho profissional** (ex.: CRM) · **UF do conselho** · Cód. na operadora · Cód. UF (IBGE) · "Ñ faz parte da guia de honorários" · tabela por convênio: Plano · Unidade · Cód. operadora prof. executante · Nome prof. executante · Cód. operadora prof. solicitante · Nome prof. solicitante.
- **Horários:** ver Área F.
- **Relações:** Especialidades (especialidade × unidade × plano) · Planos de Saúde (planos que o médico atende, uso na Web, qtd. atendimentos dia/mês, tempo de execução, % s/ consulta, teleatendimento) · Mens. Agenda · Textos Laudos · Descr. Favoritas.
- **Faturamento:** gráfico.

## 4. Especialidades (com CBO)
| Cód | Especialidade | CBO (3ª ed.) | CBO (2ª ed.) |
|---|---|---|---|
| 1 | Oftalmo Geral | 2252.65 | 2231.44 |
| 12 | Oftalmo Catarata | 2252.65 | |
| 15 | Oftalmo Plástica | 2252.65 | |
| 13 | Oftalmo Refrativa | 2252.65 | |
| 14 | Oftalmo Retina e Vítreo | 2252.65 | |
| 11 | Oftalmologia Geriátrica | 2252.65 | |
| 9 | Cardiologista | 2251.20 | |
| 17 | Cirurgião Plástico | 2252.35 | |
| 18 | Dermatologista | 2251.35 | |
| 2 | Endocrinologia | 2251.55 | |
| 3 | Instrumentador | 3222.25 | 3222.25 |
| 20 | Médico Cirurgião Geral | 225225 | |
| 8 | Médico Clínico | 2251.25 | |
| 21 | Médico do Trabalho | 225140 | |
| 19 | Médico Homeopata | 225195 | |
| 7 | Neurologista | 2251.12 | |
(lista pode ter mais itens abaixo)

## 5. Locais de atendimento (salas) – 36
Tipos: Apartamento Cirúrgico (um por hospital parceiro) · Centro Cirúrgico (um por unidade) · **Consultório 1 e 2** · Consultórios por médico (Dr. Gelson, Dr. Pedro Boni, Dr. Renato, Dra. Gisele, Dra. Luiza, Dr. Max) · Contatólogo · Orientação Cirúrgica · **Sala de Campo Visual** · **Sala de Exame** · **Sala de Procedimentos Cirúrgicos**.
Campos: Descrição · Abreviação · Tp. ficha de dados · Unidade · Categoria do local · Centro de responsabilidade · Estação p/ chamar na TV (computadores) · Mensagem p/ TV · Local de estoque · Serviço · Médico p/ sessão · Status · Qtde máx. de agendamentos por horário · Usa na agenda (ambulatório / emergência / internação / cirurgia) · Ocupado · Teleatendimento · Agenda por ordem de chegada (totem) · Tipo de acomodação · Classif. atendimento · Classif. guia · **Tipo de Atendimento (TISS)** (ex.: Pequena Cirurgia) · **Tipo de Acomodação (TISS)** (ex.: Apartamento simples) · AETITLE (PACS). Abas Horários e Procedimentos.

## 6. Motivos (Ausência, Cancelamento, Desistência, Emergência, Bloqueio) – 12 ativos
Todos do tipo "Cancelamento": Antecipou a consulta · Não pode comparecer · Paciente ficou doente · Imprevisto · Remarcado · Motivo de saúde · Já tem prontuário · Não atende telefone/desliga ao tentar contato · Não atendemos estrabismo · Não vai vir · Paciente desistiu pois não realizamos PAM a laser · Prontuário errado. (Alguns motivos têm nome de pessoa e data no texto – removidos daqui.)

## 7. Cadastro de pacientes (estrutura – visto no paciente de teste "Teste Micrologos")
- **Dados Pessoais:** CPF · Nascimento (idade calculada) · Ficha · Estrangeiro · Nome · Apelido · Plano de saúde · Matrícula · Validade · Via · Últ. pagamento · Acomodação (Apto/Enferm.) · Titular · CPF do titular · Validade · Parentesco · **Cartão Nacional de Saúde** · Cód. interno · Situação LGPD · 4 telefones (tipo) · CEP · UF · Cidade · Bairro · Endereço · Nº · Complemento · RG · Órgão · Emissão · Localidade · IBGE · Médico · País · Sexo · Empresa · Profissão · Cor/Raça · Indicação · Estado civil · E-mails · Aposentado · Contato externo.
- **Dados Adicionais:** Pai · Mãe · Naturalidade · Nacionalidade · Nome social · Responsável (CPF, parentesco, telefones) · Classificação (Ouro, Prata, Bronze, Prioridade, Vermelho, Preto, Azul, Sem classificação) · Tipo sanguíneo (ABO, RH) · Tipo de localização (TISS) · 4 campos configuráveis · Deficiências/condições (auditiva, visual, motora, mental, paralisia cerebral, TEA, soropositivo, TDAH) · Foto / Convênio / Identidade (captura de imagem).
- **Outros dados:** Facebook · Instagram.
- **Alertas:** Comentários do paciente · Motivo · Alertas para Agenda e Cobrança de Convênio.
- Outras abas: Proc. Realizados · Resumo Queixas · Ocorrências · Agendas.
- Opções: Leitor de cartão (F9) · Cancelar obrigatoriedades (F7) · Observação reservada · Log do paciente · **Termo de Consentimento LGPD** · MLPhone · Integração Cash ASP · Outras opções (Manutenções, Quantidade de pacientes, Imagens carteira e identidade, Consistência imagens, Importa dados Web).

## 8. Outros cadastros (não abertos em detalhe)
Contatos Externos · Produtos · Serviços · Categorias de Locais · Status dos Locais · Protocolos de Tratamento · Representantes · Equipes Médicas · CID-10 · Centro de Responsabilidade · Turnos · Classificação de Atendimentos · Configuração de Taxas · Donos de Equipamentos · Categorias de Produtos · Unidades · Marcas · Tempo de Duração · Empresas · Profissões · CEP · Acompanhantes · Tipos de Ocorrências · Facilitadores · Feriados · IBGE.


---

**PARTE 14 – arquivo original: H-exportacao.md**

# H) Exportação — o que o Micrologos permite tirar

**Status:** verificado nas telas visitadas. **Nenhuma exportação foi executada** (para não gerar arquivos nem relatórios).

## 1. Botões de exportação encontrados
| Área | O que existe | Formato | Onde |
|---|---|---|---|
| Faturamento (lotes) | **Geração do XML TISS** | XML (TISS 3.02.01 a 4.03.00) | Cobranças de Convênios ▸ botão TISS → grava em `C:\<convênio>\` |
| Relatórios | **Relatórios ▸ Planilhas** ▸ Por Planos de Saúde e Prod./Serv. · Por Convênio e Categ. Prod./Serv. → (Faturamento / Movimentação Financeira do Estoque / Faturamento + Mov. Financ. Estoque) | Planilha (provavelmente Excel) | Menu Relatórios |
| Repasse | **Exporta Comissão dos Médicos** | (Interface Web) | Ferramentas ▸ Manutenção do Sistema ▸ Interfaces Web |
| Faturamento | **Importa Excel Padrão Faturamento** (importação, não exportação) | Excel | Ferramentas ▸ Manutenção ▸ Interfaces Diversas |
| Cobrança | Recebe Arquivo Magnético ▸ Pgto de Cobranças (importa demonstrativo) · Outras Opções ▸ Arquivo Magnético ▸ | arquivo | Cobranças ▸ Opções |
| Todas as telas de cadastro | Botão **Listar** (relatório/impressão) | Relatório — não testado se a pré-visualização permite salvar em PDF/Excel | Barra lateral |
| Gestor Eletrônico de Documentos (GED) | Visualiza / Captura | imagens/documentos | Opções de Convênios, Contas e Cobranças |
| Backup | Ferramentas ▸ Backup | banco de dados | Menu Ferramentas |
| BI | botão "BI" na barra secundária | (não aberto) | Barra superior |

**Não encontrei botão "Exportar para Excel/CSV"** dentro das telas de Convênios, Procedimentos, Tabelas de Preço, Contas, Cobranças, Staff, Locais, Textos, Fichas ou Agenda.

## 2. Relatórios disponíveis (menu Relatórios) – úteis para extrair dados
- **Agenda:** Agendamentos por Planos de Saúde · Agendamentos WEB · Agenda por Médico · Agenda por Local · Pacotes de Consulta · Faltas por Paciente · Pacientes por Etapas de Preparação · Estatística de Pacientes · Estatística Motivos · Desistências por Médico · Agendamentos × Confirmação · Configurado da Agenda · Sessões ▸.
- **Atendimentos:** Cruzamento de Dados do Atendimento (com/sem palavra-chave) · Estatística de CIDs · Atendimentos por Médico · Solicitações de Exame por Médico · Medicamentos Prescritos por Médico · Total de Horas por Médico · Laudo por Status · Laudos não Realizados · Configurado de Atendimento Genérico/Específico · Queixas de Paciente por Médico · Atendimentos por campo de Ficha de dados.
- **Solicitações:** Requisições por Paciente · Requisições de Setor · Produtos por Prescrição.
- **Faturamento:** Atendimentos por Médico (Ambulatorial/Internação) · Faturamento/Mov. Estoque por Médico (Realizado, +Indicação, +Vinculação…) · Paciente por Convênios/Planos · De Procedimento/Serviço (Totais por procedimento, por categoria, detalhado, por quantidade, por unidade/médico/convênio, por contato externo, por médico que indicou, por especialidade, franquias, por grupo de CID) · De Produto · Contas de Pacientes (por procedimento/produto, por plano, por procedimento principal, em cobrança, guias emitidas por usuário, pendências) · Movimento do Caixa (Ambulatório/Internação) · Pagamentos de Particular · Produção Mensal SUS · Configurados.
- **Cobrança:** Valores Resumidos por Plano · Cobranças Entregues · Totais por Categoria · Recebimentos de Protocolos · Relação de Glosas Internas · Relação de Glosas Externas.
- **Administrativos:** **Repasse Staff Médico** · Pacientes (1ª vez, revisões, assiduidade, créditos, acompanhantes) · Atendimento (produtividade, remuneração por atendimento, laudos por médico, médicos por unidade de tempo, estatísticas, mapas de ocupação e horários) · Faturamento (comissão por laboratório, % exames × consultas, faturado × recebido por médico, custos × gastos por pacote, quantidade de pacientes faturados) · Preços (por produto/serviço, por plano, margem de lucro por tabela) · Configurados · Ponto eletrônico · Estatísticas da pesquisa Web · Confirmações WhatsApp · Imagens Nuvem Micrologos.
- **Auditoria:** Consistências · Conferências · Cadastros · Inativados.
- **Planilhas:** ver acima.

## 3. Recomendação para a migração
Para levar os dados ao sistema novo, o caminho mais completo **não** é pelas telas: é pedir à Micrologos (ou ao TI) uma **exportação do banco de dados** (ou backup) com dicionário de dados — cadastros, tabelas de preço, contas, guias, agendas e prontuários. Os relatórios/planilhas servem para conferência.


---

**PARTE 15 – arquivo original: I-config-tiss-por-convenio.md**

# I) Configurações TISS de cada convênio no Micrologos (vistas em 22/11/2026)

**Onde fica no Micrologos:** Cadastros ▸ Convênios/Planos Saúde ▸ Detalhamento. As configurações estão nas abas **1ª Config. TISS**, **2ª Config. TISS**, **Outras Config. TISS** (com as sub-abas SP/SADT, Hon/Outras Desp, Res.Intern., 1º, 2º, 3º e 4º Geral) e **Complementares**.
**Modo:** somente leitura. Nada foi alterado.
**Privacidade:** nos convênios "Unimed por médico", o código de cooperado aparece no campo CPF/código. Não copiei CPF de ninguém.

**Legenda:**
- **SIM:** a caixa está marcada.
- **NÃO:** a caixa está desmarcada.
- **(—):** a caixa está em estado "indeterminado" (azul com traço). No Delphi isso significa um valor nulo, que nunca foi gravado. Na prática o Micrologos trata como **NÃO**. Fica anotado para o caso de a Micrologos usar outro padrão.

> ✅ **Validado na prática (Ana Carolina, 22/11/2026):** com estas configurações a clínica **não tem tido glosa**. A regra para o sistema novo é **replicar exatamente** o que está aqui para cada convênio, sem "corrigir" nada. Onde houver dúvida sobre como um campo sai no XML (ex.: formato de data), copiar o que aparece nos **XML reais já aceitos** em `C:\<convênio>\`, e não a tela de cadastro.

Estas configurações são o "manual" de como a Micrologos ajustou cada XML às exigências de cada operadora. O sistema novo deve ter **as mesmas opções por convênio**, em uma tabela de regras.

---

## 1. Tabela comparativa (convênios com XML ativos)

| Convênio (cód) | ANS | Prestador (código usado) | Cód. na operadora | TISS | Encoding no cadastro | Formato de data | Nº guia automático | Máx. proc./guia | Honorário se cirurgia | Consulta na SP/SADT | Sessão em série | Obs. com CID | Dígitos Cód.TISS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Amil (28) | 326305 | PJ · Cód.Operadora | 10453164 | 4.01.00 | **UTF-8** | aaaa-mm-dd | SIM, numeração única (últ. 7000000164) | **10** | **SIM** | **SIM** | NÃO | NÃO | 10 |
| Blue (31) | 423173 | PJ · Cód.Operadora | 005858 | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | SIM | SIM | 10 |
| Bradesco Saúde (2) | 005711 | PJ · Cód.Operadora | 0000110502 | **4.03.00** | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO* | NÃO | SIM | NÃO | 10 |
| Bradesco Operadora (23) | 421715 | PJ · Cód.Operadora | 0000110502 | **4.03.00** | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO* | NÃO | SIM | NÃO | 10 |
| Fundação Saúde Itaú (21) | 312126 | PJ · Cód.Operadora | 00119315 | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM | – | **SIM** | NÃO | (—) | SIM | 10 |
| Geap (16) | 323080 | PJ · Cód.Operadora | 17101182 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | SIM | – | NÃO | NÃO | (—) | NÃO | 10 |
| Hapvida (17) | 359017 | PJ · **CPF/CNPJ** | CNPJ 05894660000187 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |
| Klini (25) | 422029 | PJ · **CPF/CNPJ** | CNPJ | **4.02.00** | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | **SIM** | SIM | SIM | 10 |
| Mediservice (12) | 333689 | PJ · **CPF/CNPJ** | CNPJ | 4.01.00 | **UTF-8** | aaaa-mm-dd | NÃO | **5** | **SIM** | NÃO | (—) | NÃO | 10 |
| Porto Seguro (20) | 000582 | PJ · Cód.Operadora | 00119315 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | SIM, numeração única (últ. 12345685) | – | **SIM** | NÃO | (—) | SIM | 10 |
| Portomed (34) | 417491 | PJ · Cód.Operadora | 00119315 | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | SIM | – | **SIM** | NÃO | NÃO | SIM | 10 |
| Saúde Caixa (27) | 312924 | PJ · **CPF/CNPJ** | CNPJ | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM, numeração única (últ. 1281) | – | NÃO | NÃO | SIM | SIM | 10 |
| Select (32) | 358053 | PJ · Cód.Operadora | 46994084 | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | SIM | SIM | 10 |
| **Unimed Consumed Cirurgia (26)** | 344397 | **PJ** · Cód.Operadora | **1474** | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM (últ. SP/SADT 0001187224) | – | NÃO (pacote em SP/SADT) | NÃO | NÃO | NÃO | 10 |
| Unimed Antonio (29) – cirurgião externo | 344397 | **PF** · Cód.Operadora | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM | – | NÃO | NÃO | NÃO | NÃO | 10 |
| Unimed Gelson (8) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | SIM | – | NÃO | NÃO | (—) | NÃO | **8** |
| Unimed Gisele (10) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |
| Unimed Luciano (15) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | **dd/mm/aaaa** | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |
| Unimed Max (22) | 344397 | **PF** | cód. cooperado | 4.01.00 | ISO-8859-1 | aaaa-mm-dd | NÃO | – | NÃO | NÃO | (—) | NÃO | 10 |

\* No Bradesco, a caixa "Utiliza Guia de Honorário se Cirurgia" está desmarcada. Mesmo assim, os XML de cirurgia saem como Guia de Honorários, porque a **Classificação de Guia "Cirurgia" = Honorário individual** (C-faturamento.md) decide isso. A aba Hon. tem "Somente p/ procedimentos cirúrgicos" = SIM.

### Itens iguais em TODOS os convênios acima
- Código de produtos/serviços nas guias: **Brasíndice**.
- **Usa CBO-S Ago/2011** = SIM. Hora no formato 99:99:99. Diagnóstico na tag `diagnosticoAtendimento`.
- **Nº do lote com 12 dígitos**. Dígitos da guia = 0 (sem preenchimento com zeros).
- **Usa o campo "C.R.M." do médico completo** = SIM.
- **"Mostra % Red./Acresc. nas guias e XML"** = SIM em todos, exceto Unimed Antonio. É isso que leva o fator 2,00 ao XML.
- **"Se data de autorização em branco, usa a data da conta"** = SIM em todos, exceto Unimed Antonio.
- **"Não escreve a equipe na guia do médico principal"** = SIM na maioria. A Amil usa o contrário: **"Utiliza uma única guia para toda a equipe"**.
- Nenhum convênio tem procedimento na lista "não enviar via XML (autorizado on-line)".
- Nenhum convênio usa "XML com senha, data da senha e validade" na aba Hon. Na Unimed, a senha vai no bloco de autorização da SP/SADT.

### Formato de data/hora
- **aaaa-mm-dd** e **aaaa-mm-ddT99:99:99**: o padrão ANS (xs:date / xs:dateTime).
- **dd/mm/aaaa** e **dd/mm/aaaaH99:99:99**: usado por Geap, Hapvida, Porto Seguro, Portomed e Unimed Luciano.
- Esse segundo formato não é o tipo de data do XSD. Provavelmente é só a máscara de tela/impressão. Como as guias são aceitas sem glosa, o sistema novo deve gerar o XML **igual aos XML reais aceitos** desses convênios.

---

## 2. Regras especiais que o sistema novo PRECISA ter por convênio

| Regra | Convênios | Por que importa |
|---|---|---|
| Consulta enviada dentro da **SP/SADT** | Amil, Klini | Guia de consulta separada será glosada/rejeitada |
| Cirurgia em **Guia de Honorários** ("Utiliza Guia de Honorário Médico se for Cirurgia") | Amil, Fundação Itaú, Mediservice, Porto Seguro, Portomed (Bradesco pela classificação) | Tipo de guia errado = rejeição do lote |
| Cirurgia/injeção em **SP/SADT com pacote** (não usa Honorários) | Unimed Consumed Cirurgia | Ver D2 – pacotes tabela 98 |
| Máx. procedimentos por guia | Amil = 10 · **Mediservice = 5** | Acima do limite o portal rejeita |
| Numeração **única** de guia p/ todos os tipos (sequencial) | Amil, Porto Seguro, Saúde Caixa | Guarda o último nº usado |
| Nº de guia **sequencial automático** por tipo | Fundação Itaú, Geap, Portomed, Unimed Consumed, Unimed Antonio, Unimed Gelson | Guarda o último nº por tipo de guia |
| "Guia operadora = Guia prestador" | Fundação Itaú, Hapvida, Porto Seguro, Portomed, Unimed Gelson/Gisele/Luciano/Max | Repete o nº do prestador no campo da operadora quando não há nº da operadora |
| "Usa o mesmo nº da guia p/ a guia principal" | Fundação Itaú, Hapvida, Porto Seguro, Portomed | Preenche `guiaPrincipal` |
| "Não preenche a Guia Princ." | Unimed Consumed, Unimed Antonio | Deixa `guiaPrincipal` vazio |
| Identificação por **CNPJ** em vez de código | Hapvida, Klini, Mediservice, Saúde Caixa | `codigoPrestadorNaOperadora` × `cnpjContratado` |
| Prestador **Pessoa Física (médico)** | Unimed Gelson, Gisele, Luciano, Max, Antonio | Um "prestador" por médico, cada um com lote próprio |
| "Contratado solicitante é o próprio profissional solicitante" | Unimed Consumed, Luciano, Max | Muda o bloco do solicitante |
| "Cód. Operadora do Médico Executante = Cód. Contratado" | Unimed Luciano, Max | Executante = contratado |
| "C/ o nome do Contratado como sendo o próprio médico" (Honorários) | Unimed Max | |
| "Valor unitário = original (sem desconto quando qtd > 1)" | Unimed Consumed | Importante nos pacotes |
| "Ñ coloca zero no código TISS p/ produtos" | Unimed Consumed, Gelson, Gisele | Formatação do código |
| Dígitos do Cód. TISS = **8** | Unimed Gelson (os outros = 10) | Conferir se é intencional |
| Via de acesso: 1ª linha "Única", próximas "Diversas" / principal "Única" e demais "Mesma" | Unimed Consumed (SIM); Fundação Itaú (1ª Única/Diversas) | **Cirurgia bilateral/múltipla**: via de acesso errada é glosa clássica |
| "% Red./Acresc. será sempre 1" quando qtd > 1 | Fundação Itaú, Geap, Unimed Luciano, Max | Interage com o fator 2,00 |
| Observação da guia com a **descrição do CID** | Blue, Fundação Itaú, Klini, Porto Seguro, Portomed, Saúde Caixa, Select | |
| "Sessão" – procedimento com quantidade total + linhas de datas em série | Bradesco (2), Blue, Klini, Saúde Caixa, Select | Para tratamentos seriados |
| Usa executante/solicitante pelo cadastro de códigos do médico na operadora | quase todos (não em Unimed Gelson, Gisele, Antonio) | Exige tabela médico × operadora × código |

---

## 3. Detalhe completo por convênio

```
Cód 2 Bradesco Saúde
1ª: Código utilizado = Cód.Operadora; Prod/Serv = Brasíndice; Nº seq. automático NÃO; Numeração única NÃO; últimos nºs vazios.
TISSNet: Data aaaa-mm-dd; Data/Hora aaaa-mm-ddT99:99:99; Usa CBO-S Ago/2011 SIM; Hora 99:99:99; Diagnóstico=diagnosticoAtendimento; encoding ISO-8859-1; versaoPadrao 4.03.00.
2ª: proc. não enviados = nenhum; usa config própria nº guias/XML NÃO; nº guias/XML vazio; dígitos lote 12; dígitos lote nome arq vazio; dígitos senha vazio; dígitos CNES vazio; Não utiliza TISS = indeterminado(—).
   Guias: Info doença obrig NÃO; máx proc/guia vazio; dígitos nº guia 0; Não mostra CID NÃO; Grava CID na Indicação NÃO; Grava Obs Itens na Indic = —; Grava c/Cód = —; Não usa padrão ANS Reapresentação NÃO; Usa CRM completo SIM. Observação: Descrição CID NÃO; mensagem vazia. Logo Bradesco associado.
Outras/SP-SADT: marcados: Não escreve tipo de consulta(—); No médico executante usar sempre o CPF(—); Sessão (qtd total + linhas data realização em série) SIM; Procedim. categ Consulta com TpAtend<>Consulta => SP/SADT SIM. Consultas na guia SP/SADT NÃO; Utiliza Guia Honorário se Cirurgia NÃO; Tipo Atendimento padrão vazio. Demais NÃO.
Outras/Hon: Somente p/ proced. cirúrgicos SIM; Sempre Cód. na Operadora p/ Contratado e Executante (—); codigoPrestadorNaOperadora sempre CNPJ/CPF (—); demais NÃO (XML com senha/data/validade NÃO).
Outras/Res.Intern: todos NÃO.
Outras/1º Geral: Usa Executante e Solicitante pelo cadastro de códigos nas operadoras dos médicos SIM; Mostra % Red./Acresc. nas guias e XML SIM; Total geral igual em todas as páginas (—); demais NÃO; acrescenta 0 min hora final.
Outras/2º Geral: Se data autorização em branco usa data da conta SIM; Qtd dígitos Cód.TISS 10; "Mesmo se % Red.Acrésc igual a 0" (—); demais NÃO.
Outras/3º Geral: Não escreve a equipe na guia do médico principal SIM; (—): %Red/Acresc sempre 1; 1ª via Única/próximas Diversas; se não mostrar valor original %Red=1; Não mostra via de acesso; Não inclui material/medicamentos no XML; Proc principal Única Via e demais Mesma Via; qtd>1 Mesma Via. Demais NÃO.
Outras/4º Geral: todos (—) indeterminados: staff valor original; layout 1 proc por cabeçalho; código de barras; desmembra 2ª qtd %zerado; C.Resp na descrição; solicitante contato externo; não imprime assinatura; observação SP/SADT; não envia nº carteira.
Complementares: Razão social "Bradesco Saude"; conectividade vazio; ANS 5711; último lote 1676; Prestador PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 0000110502; CNES 3176479; emitente Consumed (23).
```

```
Cód 8 Unimed Gelson (médico cooperado, PF)
Complementares: razão "Unimed"; ANS 344397; último lote 1531; Pessoa FÍSICA; CPF/código = código de cooperado (6 dígitos); nome = o médico; cód junto operadora = código de cooperado; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; últimos: SP/SADT 9379060007; Consulta 2. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—); Não preenche Guia Princ. (—).
Hon: Sempre Cód. Operadora p/ Contratado e Executante (—); codigoPrestadorNaOperadora CNPJ/CPF (—).
1º Geral: "Usa Exec/Solic pelo cadastro" NÃO; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. em branco = data conta SIM; Ñ coloca zero no cód TISS p/ produtos SIM; **Qtd dígitos Cód.TISS = 8**; Guia operadora = Guia prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—).
3º Geral: Não escreve equipe SIM; Não mostra via de acesso SIM(?); (—): %Red 1; não mostra valor orig %=1; não inclui material; principal Única/Mesma; qtd>1 Mesma.
4º Geral: todos (—).
```

```
Cód 10 Unimed Gisele (médica cooperada, PF)
Complementares: Unimed; ANS 344397; último lote 986; PF; código de cooperado como CPF/código; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto NÃO; últimos vazios. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—); Não preenche Guia Princ. (—).
Hon: Sempre Cód. Operadora (—); codigoPrestador CNPJ/CPF (—).
1º Geral: cadastro códigos NÃO; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. = data conta SIM; Ñ coloca zero p/ produtos SIM; Guia operadora = prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—); **Cód.TISS 10** (Gelson usa 8).
3º Geral: Não escreve equipe SIM; Não mostra via SIM(?); demais (—).
4º Geral: todos (—).
```

```
Cód 12 Mediservice
Complementares: razão "Mediservice"; ANS 333689; último lote 222; PJ CNPJ 05894660000187; "Consumed Consultorios Medicos Ltda Me"; cód junto operadora 05894660000187; CNES 3176479.
1ª: CPF/CNPJ; Brasíndice; sem seq. auto. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; encoding UTF-8 (cadastro); 4.01.00.
2ª: lote 12; **Máx. 5 procedimentos por guia**; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Utiliza Guia Honorário se Cirurgia SIM; Sessão (—); médico exec. CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—).
Hon: Somente cirúrgicos SIM.
1º Geral: cadastro códigos SIM; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. em branco = data conta SIM; qtde>1 linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; (—): %Red sempre 1; 1ª via Única/Diversas; se não mostrar valor original %=1; não mostra via; não inclui material; principal Única/demais Mesma; qtd>1 Mesma.
4º Geral: todos (—).
```

```
Cód 15 Unimed Luciano (médico cooperado, PF)
Complementares: Unimed; ANS 344397; último lote 690; PF; código de cooperado; CNES 3176479; emitente "Unimed Luciano" (203).
1ª: Cód.Operadora; Brasíndice; seq. auto NÃO. **Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99**; CBO-S 2011 SIM; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—); Não preenche Guia Princ. (—).
Hon: Sempre Cód. Operadora (—); codigoPrestador CNPJ/CPF (—).
1º Geral: Usa Exec/Solic pelo cadastro SIM; Contratado Solicitante = próprio profissional SIM; Cód.Operadora do Médico Executante = Cód.Contratado SIM; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. = data conta SIM; Guia operadora = prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—); Cód.TISS 10; Ñ coloca zero p/ produtos NÃO.
3º Geral: Não escreve equipe SIM; Não escreve nome de médico repetido SIM; qtd>1 %Red sempre 1 SIM; %Red sempre 1 SIM; (—): não mostra valor orig %=1; não inclui material; principal Única/Mesma; qtd>1 Mesma.
4º Geral: todos (—).
```

```
Cód 16 Geap
Complementares: razão "Geap Autogestão Em Saude"; ANS 323080; último lote 376; PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 17101182; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única NÃO; últimos nºs: Resumo Intern. 51234637; Consulta 23660879; SP/SADT 82367340; Honorários 61234567. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99 (sic); CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens Indic (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico executante sempre CPF (—); categ Consulta c/ TpAtend<>Consulta => SP/SADT (—); Não escreve tipo consulta (—); Utiliza Guia Honorário se Cirurgia NÃO.
Hon: codigoPrestadorNaOperadora sempre CNPJ/CPF (—); Somente cirúrgicos NÃO.
1º Geral: cadastro de códigos SIM; Mostra % SIM; Total geral igual em todas as páginas (—).
2º Geral: data aut. em branco = data conta SIM; qtde>1 uma linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; %Red sempre 1 SIM; 1ª via Única/demais Diversas SIM; (—): se não mostrar valor original %=1; não mostra via de acesso; não inclui material; principal Única/demais Mesma; qtd>1 Mesma Via.
4º Geral: todos (—).
```

```
Cód 17 Hapvida Notredame/Intermedica
Complementares: razão "Hapvida Notredame/ Intermedica"; ANS 359017; último lote 1923; PJ CNPJ 05894660000187; cód junto operadora 05894660000187 (o próprio CNPJ); CNES 3176479.
1ª: código utilizado = CPF/CNPJ; Brasíndice; sem seq. auto; últimos nºs vazios. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Sessão (—); médico exec. sempre CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—). Honorário se cirurgia NÃO.
Hon: Somente cirúrgicos SIM; codigoPrestadorNaOperadora sempre CNPJ/CPF (—).
1º Geral: cadastro de códigos SIM; Mostra % SIM; Total geral igual (—).
2º Geral: mesmo nº guia p/ guia principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 uma linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: (—): %Red sempre 1; se não mostrar valor original %=1; não mostra via; não inclui material; principal Única/demais Mesma; qtd>1 Mesma Via. Demais NÃO.
4º Geral: todos (—).
```

```
Cód 20 Porto Seguro Saúde
Complementares: razão "Porto Seguro Saude"; ANS 582 (000582); último lote 527; PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 00119315; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única SIM; último nº guia 12345685. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Observação: Descrição CID SIM; Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: Utiliza Guia Honorário se Cirurgia SIM; Sessão (—); médico exec CPF (—); categ Consulta=>SP/SADT (—); Não escreve tipo consulta (—).
Hon: Somente cirúrgicos NÃO; codigoPrestadorNaOperadora sempre CNPJ/CPF (—).
1º Geral: cadastro códigos SIM; Mostra % SIM; Total geral igual (—).
2º Geral: mesmo nº guia p/ guia principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; demais (—) (%Red 1; não mostra valor orig %=1; não mostra via; não inclui material; Única/Mesma; qtd>1 Mesma).
4º Geral: todos (—).
```

```
Cód 21 Fundação Saúde Itaú
Complementares: razão "Fundacao Saude Itau"; ANS 312126; último lote 521; PJ CNPJ 05894660000187; Consumed Consultorios Medicos Ltda; cód junto operadora 00119315; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; Nº seq. guia automático SIM; numeração única NÃO; últimos nºs: Resumo Intern. 642383, Honorários 642381. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens na Indic (—); Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão (—); No médico executante sempre CPF (—); Utiliza Guia Honorário se Cirurgia SIM; Procedim. categ Consulta c/ TpAtend<>Consulta => SP/SADT SIM; Não escreve tipo consulta (—).
Hon: Somente cirúrgicos SIM; codigoPrestadorNaOperadora sempre CNPJ/CPF (—).
1º Geral: cadastro de códigos SIM; Mostra % SIM; Total geral igual em todas as páginas (—).
2º Geral: mesmo nº da guia p/ guia principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 uma linha p/ cada (—); mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe na guia do médico principal SIM; % Red sempre 1 SIM; 1ª via Única/demais Diversas SIM; se não mostrar valor original %=1 SIM; (—): não mostra via de acesso; não inclui material/med; principal Única Via/demais Mesma Via; qtd>1 Mesma Via.
4º Geral: todos (—).
```

```
Cód 22 Unimed Max (médico cooperado, PF)
Complementares: Unimed; ANS 344397; último lote 211; PF; código de cooperado; CNES 3176479; emitente "Unimed Max".
1ª: Cód.Operadora; Brasíndice; seq. auto NÃO. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; ISO-8859-1; 4.01.00.
2ª: lote 12; Não utiliza TISS (—); Grava Obs Itens (—); Grava c/Cód (—); CRM completo SIM.
SP/SADT: (—) em Sessão, médico exec CPF, categ Consulta=>SP/SADT, Não escreve tipo consulta, Não preenche Guia Princ.
Hon: **C/ o nome do Contratado como sendo o próprio médico SIM**; codigoPrestador CNPJ/CPF (—).
1º Geral: Usa Exec/Solic cadastro SIM; Contratado Solicitante = próprio profissional SIM; Cód.Operadora Médico Executante = Cód.Contratado SIM; Mostra % SIM; Total geral igual (—).
2º Geral: data aut. = data conta SIM; Guia operadora = prestador SIM; qtde>1 linha p/ cada SIM; mesmo se %=0 (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; não escreve nome repetido SIM; qtd>1 %Red sempre 1 SIM; %Red sempre 1 SIM; demais (—).
4º Geral: todos (—).
```

```
Cód 23 Bradesco Saúde Operadora de Planos
Complementares: razão "Bradesco Saude Operadora de Planos"; ANS 421715; último lote 1674; PJ CNPJ 05894660000187; cód junto operadora 0000110502; CNES 3176479; emitente Consumed 23.
1ª: igual Bradesco Saúde (Cód.Operadora; Brasíndice; sem seq. auto; data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.03.00).
2ª: lote 12 dígitos; dígitos senha 0; Não utiliza TISS (—); máx proc vazio; dígitos guia 0; Grava Obs Itens Indic (—); Grava c/Cód SIM; Usa CRM completo SIM; demais NÃO.
SP/SADT: Sessão SIM; Não escreve tipo consulta (—); demais NÃO (diferença: "médico executante sempre CPF" NÃO e "categ Consulta c/ TpAtend<>Consulta => SP/SADT" NÃO).
Hon: Somente cirúrgicos SIM; demais NÃO.
1º Geral: Usa Executante/Solicitante pelo cadastro de códigos SIM; Mostra % Red./Acresc. SIM; demais NÃO.
2º Geral: data autorização em branco = data da conta SIM; "Mesmo se %Red=0" SIM; Cód.TISS 10 dígitos; demais NÃO.
3º Geral: Não escreve equipe na guia do médico principal SIM; Não inclui material/medicamentos no XML (—); demais NÃO.
4º Geral: (—) em: solicitante contato externo; não imprime assinatura; observação SP/SADT; não envia nº carteira. Demais NÃO.
```

```
Cód 25 Klini Saúde
Complementares: razão "Klini Saude"; ANS 422029; último lote 390; PJ CNPJ 05894660000187; nome prestador "Consumed Clinica de Olhos"; cód junto operadora 05894660000187; CNES 3176479.
1ª: CPF/CNPJ; Brasíndice; sem seq. auto. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; **4.02.00**.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão SIM; Consultas na guia SP/SADT SIM; Não escreve tipo consulta (—); Honorário se cirurgia NÃO.
Hon: Somente cirúrgicos SIM.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: data aut. em branco = data conta SIM; qtde>1 uma linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 26 Unimed Consumed Cirurgia  (CIRURGIAS + INJEÇÕES — prioridade)
Complementares: razão "Unimed"; ANS 344397; último lote 260; PJ CNPJ 05894660000187; nome prestador "Consumed Olhos"; cód junto operadora 1474; CNES 3176479; sem emitente.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única NÃO; último SP/SADT 0001187224. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Grava c/Cód SIM; CRM completo SIM; Descrição CID NÃO; máx proc/guia vazio.
SP/SADT: Não preenche a Guia Princ. SIM; Não escreve tipo consulta (—); Sessão NÃO; Honorário se cirurgia NÃO (cirurgia vai em SP/SADT com pacote); Consultas na SP/SADT NÃO.
Hon: todos NÃO.
1º Geral: Usa Exec/Solic pelo cadastro de códigos SIM; **Contratado Solicitante é o próprio Profissional Solicitante SIM**; Mostra % Red./Acresc. SIM; **Valor Unitário da Guia = Original (sem desconto sobre qtd>1) SIM**.
2º Geral: data aut. em branco = data conta SIM; **Ñ coloca zero no código TISS p/ Produtos SIM**; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: **1 linha p/ cada qtd; 1ª via "Única", próximas "Diversas" SIM**; **Procedimento principal "Única Via" e demais "Mesma Via" SIM**; Não inclui material/medicamentos (—); demais NÃO.
4º Geral: Não envia nº carteira (—); demais NÃO.
```

```
Cód 27 Saúde Caixa
Complementares: razão "Saude Caixa"; ANS 312924; último lote 74; PJ CNPJ 05894660000187; cód junto operadora 05894660000187; CNES 3176479.
1ª: CPF/CNPJ; Brasíndice; seq. auto SIM; numeração única SIM; último nº guia 1281. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão SIM; Não escreve tipo consulta (—); Honorário se cirurgia NÃO; Consultas na SP/SADT NÃO.
Hon: todos NÃO.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: data aut. em branco = data conta SIM; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 28 Amil
Complementares: razão "Amil Assistencia Medica Internacional S/a"; ANS 326305; último lote 198; PJ CNPJ 05894660000187; cód junto operadora 10453164; CNES 3176479; emitente Consumed 23.
1ª: Cód.Operadora; Brasíndice; Nº seq. guia automático SIM; Numeração única p/ todos os tipos SIM; último nº guia 7000000164. TISSNet: data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; encoding UTF-8 (cadastro); 4.01.00.
2ª: lote 12 dígitos; senha 0; CNES 0; Não utiliza TISS NÃO; máx proc/guia 10; dígitos guia 0; Usa CRM completo SIM; demais NÃO.
SP/SADT: Utiliza Guia Honorário Médico se Cirurgia SIM; Consultas na guia SP/SADT SIM; Não escreve tipo consulta (—); demais NÃO (Sessão NÃO).
Hon: todos NÃO (inclusive "Somente cirúrgicos").
1º Geral: Usa Executante/Solicitante pelo cadastro de códigos SIM; Mostra % Red./Acresc. SIM; demais NÃO.
2º Geral: data autorização em branco = data da conta SIM; Cód.TISS 10; demais NÃO.
3º Geral: Utiliza uma única guia para toda a equipe SIM; Não inclui material/medicamentos (—); demais NÃO.
4º Geral: Não envia nº carteira (—); demais NÃO.
```

```
Cód 29 Unimed Antonio (cirurgião externo)
Complementares: razão "Unimed"; ANS 344397; último lote vazio; Pessoa FÍSICA; CNPJ/CPF e cód junto operadora = código de cooperado do médico (6 dígitos); nome = o próprio médico; CNES 9999999 (genérico); sem emitente.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; último SP/SADT 1187057. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; CRM completo SIM; Descrição CID NÃO.
SP/SADT: Não preenche a Guia Princ. SIM; Não escreve tipo consulta (—); Sessão NÃO; Honorário se cirurgia NÃO.
Hon: todos NÃO.
1º Geral: TODOS NÃO (inclusive "Usa Exec/Solic pelo cadastro" e "Mostra % Red./Acresc." = NÃO).
2º Geral: data aut. em branco = data conta NÃO; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não inclui material (—); demais NÃO.
4º Geral: Não envia nº carteira (—).
```

```
Cód 31 Blue
Complementares: razão "Blue Company"; ANS 423173; último lote 4; PJ CNPJ 05894660000187; nome prestador "Consumed Olhos"; cód junto operadora 005858; CNES 3176479; emitente Consumed 23.
1ª: Cód.Operadora; Brasíndice; sem seq. auto; data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; dígitos guia 0; Observação: Descrição CID SIM; CRM completo SIM; demais NÃO.
SP/SADT: Sessão SIM; demais NÃO.
Hon: Somente cirúrgicos SIM; demais NÃO.
1º Geral: cadastro de códigos SIM; Mostra % Red./Acresc. SIM.
2º Geral: data autorização em branco = data conta SIM; "qtde>1 uma linha p/ cada quantidade" (—); Cód.TISS 10.
3º Geral: Não escreve equipe na guia do médico principal SIM; Não inclui material/medicamentos (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 32 Select
Complementares: razão "Select Operadora de Planos de Saude Ltda"; ANS 358053; último lote 5; PJ CNPJ 05894660000187; cód junto operadora 46994084; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; sem seq. auto. Data aaaa-mm-dd; datahora aaaa-mm-ddT99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Descrição CID SIM; CRM completo SIM.
SP/SADT: Sessão SIM; demais NÃO.
Hon: Somente cirúrgicos SIM.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: data aut. em branco = data conta SIM; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

```
Cód 34 Portomed
Complementares: razão "Portomed-porto Seguro Serviços de Saude S/a"; ANS 417491; último lote 487; PJ CNPJ 05894660000187; cód junto operadora 00119315; CNES 3176479.
1ª: Cód.Operadora; Brasíndice; seq. auto SIM; numeração única NÃO; últimos nºs vazios. Data dd/mm/aaaa; datahora dd/mm/aaaaH99:99:99; CBO-S 2011 SIM; hora 99:99:99; diagnosticoAtendimento; ISO-8859-1; 4.01.00.
2ª: lote 12; senha 0; CNES 0; Não utiliza TISS NÃO; Observação: Descrição CID SIM; CRM completo SIM.
SP/SADT: Utiliza Guia Honorário se Cirurgia SIM; demais NÃO (Sessão NÃO).
Hon: todos NÃO.
1º Geral: cadastro códigos SIM; Mostra % SIM.
2º Geral: mesmo nº guia p/ principal SIM; data aut. em branco = data conta SIM; Guia operadora = Guia prestador SIM; qtde>1 linha p/ cada (—); Cód.TISS 10.
3º Geral: Não escreve equipe SIM; Não inclui material (—).
4º Geral: Não envia nº carteira (—).
```

---

## 4. Não conferidos (sem XML ou não atendidos)
Assim, Assist, Golden Cross, Notre Dame, Particular, Particular Appai, Particular Assist, Livre Escolha, Cedae Periódico, Cisbaf e Siass-Geap: sem XML ou não atendidos mais. Unimed Pedro: não atende pela Unimed. O convênio com nome de pessoa (cód. 19) é um particular.
Também não abri a **configuração geral do sistema** ("nº de guias por XML"), que vale quando o convênio não tem configuração própria. Nenhum convênio marca "Usa essa configuração de nº guias por XML".


---

## 5. Referência oficial da ANS (consultada em 22/11/2026)
- A versão vigente publicada é o **Padrão TISS – Setembro/2026**, com **Componente de Comunicação 04.03.00** (e 01.06.00).
- Hoje a clínica ainda envia **4.01.00** para Unimed, Amil e a maioria, 4.02.00 para Klini e 4.03.00 para Bradesco. As operadoras ainda aceitam essas versões, mas cada uma pode passar a exigir só a 4.03.00. Exemplo: um informativo da Unimed Planalto Médio (outra Unimed, do RS) avisou que, a partir de 01/07/2026, o sistema deles aceita só XML 4.03.00.
- ➜ O sistema novo deve **gerar 4.01.00, 4.02.00 e 4.03.00**, escolhida por convênio, e estar pronto para mudar cada convênio para 4.03.00 quando a operadora pedir.
- **Downloads oficiais para o Code** (schemas .xsd, tabelas de domínio e TUSS):
  - Página da versão vigente: https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-setembro-2026
  - Componente de Comunicação (XSD): https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISSComunicao_202511.zip
  - Componente de Conteúdo e Estrutura: https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISS_ComponentedeContedoeEstrutura_202511.zip
  - TUSS / tabelas de domínio: https://www.ans.gov.br/arquivos/extras/tiss/Padrao_TISS_Representacao_de_Conceitos_em_Saude_202609.zip
  - Componente Organizacional (regras): https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/PadroTISS_ComponenteOrganizacional_202609.pdf
  - Histórico das versões (para baixar os XSD 4.01.00 e 4.02.00): https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss/padrao-tiss-historico-das-versoes-dos-componentes-do-padrao-tiss

