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
