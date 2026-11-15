# Clinic · Agenda e recepção

Recursos de API: `agendamentos` (54 operações), `staffMedicos`, `filasEsperaAgenda`, `agendamentosRetorno`, `teleatendimentos`, `metaAgenda`.
Telas: `/agenda`, `/agendaGoogle`, `/gestaoDeRetorno`, `/totemPaciente`, `/totemFuncionario`, `/chamadaNaTV`, `/display/consultorio`.

## Agenda
- Visões ✅: **Ambulatório**, **Cirurgia**, **Ocupação**, **Calendário** e **mapa de calor**.
- Organizada por médico (staff), **local de atendimento**, **unidade** e especialidade. É possível mudar a unidade ou o local de um agendamento. ✅
- **Horários do médico** ✅: por dia da semana, por intervalo de datas, horários avulsos e bloqueios. Feriados são respeitados.
- **Agenda flexível**, **agenda fora da clínica**, **fila de espera da agenda** e **agenda auxiliar** (inclusão em lote). ✅
- **Sincronização com Google Agenda**. ✅
- Marcação múltipla (`salvarMultiplas`), kits de procedimentos, **pacotes de sessões** (aparelhos, lados, regiões) e orçamentos disponíveis para o paciente. ✅
- Cálculo de preço do item na marcação (`calcularPrecoItem`). ✅
- Mapa e contagem de agendamentos por médico e por plano. ✅

### Regras de convênio validadas na marcação ✅
Os nomes vêm das operações `validaPermissao*`. Os limites exatos são configurados por cliente ❓.
- Limite de atendimentos **por dia** por plano, por plano + médico e por plano + médico + procedimento.
- Limite **por mês** por plano e por paciente.
- Se o **plano é aceito pelo médico** e se o **procedimento é permitido ao médico**.
- Regra de **retorno** do paciente (prazo de retorno sem cobrança).
- **Vagas** por plano e médico.
- **Procedimentos com obrigatoriedades** (`verificaObrigatoriedadesProcedim`).

### Status do agendamento ✅
`Agendado` · `Atendendo` · `Atendido` · `Faltou` · `Desistiu` · `Canc. Pac.` (cancelado pelo paciente) · `Canc. Med.` (cancelado pelo médico) · `Esp. Pend.` (espera pendente) · `Desmembrado`

Estados de confirmação ou cancelamento por canal ✅: `Whats Conf` · `SMS Conf.` · `Email Conf` · `Site Conf.` · `Tel Conf.` · `Whats Canc` · `SMS Canc.` · `Email Canc` · `Site Temp` (reserva temporária feita pelo site).

Motivos ✅: ausência, cancelamento, desistência, emergência e bloqueio (cadastro "Motivos").

### Tipo e origem do atendimento ✅
1ª consulta · Seguimento · Pré-natal · Por encaminhamento · UTI · Receptivo · Ativo de cuidado planejado · Ativo de faltosos · WhatsApp · Chat · Agendamento online · Marketplace

## Recepção
- **Informar chegada**: individual, em lote (`informarChegadaComSelecionados`) ou pelo totem. ✅
- **Senhas**: solicitar, chamar e descartar senha, com lista de senhas. ✅
- **Totem do Paciente** (autoatendimento) e **Totem do Funcionário**, com fila do totem. ✅
- **Chamada na TV** e **display do consultório**. ✅
- **Fila do PEP** (aguardando atendimento médico), **fila de exames** e **fila de laudos**. ✅
- Lançamento do faturamento a partir da agenda (`incluirFaturamento`). ✅

## Gestão de retorno ✅
Controle dos retornos pendentes por paciente (`agendamentosRetorno`), com contato ativo ("Ativo de faltosos" e "Ativo de cuidado planejado"), integrado ao Talklogos.

## Teleatendimento ✅
Atendimento individual e **em grupo** via Jitsi, iniciado e encerrado dentro do PEP, com link copiável para o paciente.

## Relatórios de agenda ✅
Agendamentos por plano de saúde · Agendamentos WEB · Agenda por médico · Agenda por local · Faltas por paciente · Pacotes de sessão · Projetado da agenda semanal (financeiro).
