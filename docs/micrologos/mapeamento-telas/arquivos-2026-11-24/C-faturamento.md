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
