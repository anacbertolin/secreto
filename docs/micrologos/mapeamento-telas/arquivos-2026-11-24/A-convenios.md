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
