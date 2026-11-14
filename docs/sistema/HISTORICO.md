# Histórico do sistema (memória do projeto)

Registro do que foi construído, decidido e combinado. **Leia antes de mexer no sistema.**
Mantenha atualizado: acrescente uma seção por dia de trabalho, no fim do arquivo.

---

## 14/11/2026 — Sistema v1 (substituto do Micrologos)

### Pedido da dona
Refazer internamente o Micrologos, com todas as telas e bases, de forma mais amigável e simples.
Primeira fase: **agenda, recepção, prontuário e exames**. A dona não tinha prints das telas; usamos o
levantamento público do Micrologos (branch `claude/stoic-johnson-8ky6di`, pasta `docs/micrologos/`).

### Onde está tudo
| O quê | Onde |
|---|---|
| Sistema no ar | https://sistema-production-addc59db.up.railway.app |
| Código das telas | `app/` (React + Vite + TypeScript) |
| Ramo do GitHub que vai ao ar | **`main`** (a partir do PR que junta o sistema; antes era `claude/trusting-tesla-e5u50x`) |
| Hospedagem | Railway, projeto `generous-smile`, serviço **`sistema`** (id `d327757c-981f-4f82-ae0e-7179625a7ea9`), pasta raiz `/app` |
| Banco | Supabase `secreto` (`ogflxjolbwrzayjtxvhj`, São Paulo) |
| Migrações | `supabase/migrations/0001`–`0008` (todas aplicadas) |
| Função de senhas | Edge Function `equipe-acesso` (código em `supabase/functions/equipe-acesso/`) |
| Página explicativa para a dona | https://claude.ai/artifact/HU3UqfDoG8kTyctA2vD137 |

Outros serviços do mesmo projeto Railway, que **não são do sistema** e em que não se deve mexer:
- `site`: site público, feito por outra sessão (ramo `claude/loving-clarke-acyn66`).
- `secreto`: só um rascunho ("staged"), nunca publicado. Não usar.

### Identidade visual
Consumed · Clínica de Olhos (site consumedolhos.com.br). Logo preto e branco com o "O" em forma de olho.
Cores do sistema: grafite `#1f2124` e azul `#0277bd`; fonte Roboto.
Logos em `app/public/` (`logo-branco.png`, `logo-escuro.png`, `icone.png`, `favicon.png`).
Dados da clínica em `app/src/lib/marca.ts`: Rua Coronel Bernardino de Melo, 1679, Centro, Nova Iguaçu/RJ,
CEP 26255-140, tel. (21) 2667-0532. **O CNPJ ainda falta**: a dona precisa informar.

### Módulos prontos (v1)
- **Agenda:** grade do dia por médico, montada por `horarios_profissional`; bloqueios; encaixe; confirmação
  com canal; remarcar; falta; cancelamento com motivo.
- **Recepção:** quadro do dia (a chegar / sala de espera com tempo / em atendimento / finalizados). Na chegada,
  confere convênio, plano, carteirinha e cadastro incompleto. Atualiza a cada 30 s.
- **Pacientes:** busca por nome, nome social, nome da mãe, CPF, telefone, nº do prontuário (e `prontuario_anterior`);
  cadastro completo com endereço pelo CEP (ViaCEP); ficha com abas Prontuário, Exames, Documentos,
  Agendamentos e Dados.
- **Consultório / PEP oftalmológico:** fila do médico; enfermagem faz a pré-consulta (AV, PIO, sinais vitais)
  e a refração; o médico faz anamnese, refração, exame (botão "exame normal"), CID-10 (≈100 códigos de
  oftalmologia em `app/src/lib/cid10.ts`), conduta, receita de óculos (copia da refração), receita de
  medicamentos, pedidos de exame, atestados e documentos. Finalizar trava; depois só adendo.
- **Exames e laudos:** fila de exames (pedidos + agenda tipo "exame") → execução com anexos (bucket `exames`,
  até 50 MB) → fila de laudos → laudo assinado (imutável) → impressão.
- **Impressão** (`/imprimir/:tipo/:id`): óculos, receita, pedidos, documento, laudo, com logo, dados da
  clínica e CRM do médico.
- **Cadastros:** Equipe (admin; botão 🔑 cria senha temporária), Horários e bloqueios, Convênios (com planos),
  Salas, Tipos de exame (15 já cadastrados), Modelos de texto.

### Perfis (funcao em `profissionais`)
| | Recepção | Enfermagem/técnico | Médico | Admin |
|---|---|---|---|---|
| Cadastro e agenda | sim | sim | sim | sim |
| Ler prontuário | não | sim | sim | não |
| Pré-consulta e refração | não | sim | sim | não |
| Consulta, CID, receitas, atestados | não | não | só o médico responsável | não |
| Executar exames | não | sim | sim | não |
| Laudar e assinar | não | não | sim | não |
| Horários, convênios, salas | sim | não | não | sim |
| Equipe e senhas | não | não | não | sim |

### Login
- E-mail + senha (Supabase Auth). O gatilho `somente_equipe` em `auth.users` só deixa criar conta para quem
  está ativo em `profissionais`. Sem cadastro público.
- O admin cria a senha temporária na tela Equipe, pela função `equipe-acesso`. No primeiro acesso a pessoa é
  obrigada a trocar a senha (`user_metadata.trocar_senha`).
- Conta da dona: `anacbertolin@yahoo.com.br`, função **admin** (por regra, admin não vê prontuário).
  A senha temporária foi entregue no chat; ela troca no primeiro acesso.
- O e-mail padrão do Supabase só envia para membros da organização. Para recuperar senha por e-mail para a
  equipe, seria preciso configurar SMTP próprio. Hoje a recuperação é feita pelo admin (🔑).

### Banco: o que cada migração fez
- **0001–0004** (sessão anterior): cadastros, agenda, prontuário estruturado, RLS por função, auditoria, índices.
- **0005:** `locais`, `horarios_profissional`, `bloqueios_agenda`; colunas da recepção em `agendamentos`
  (`chegada_em`, `chamado_em`…, preenchidas pelo gatilho `horarios_status`); um atendimento por agendamento;
  RPC `abrir_atendimento` (SECURITY DEFINER **de propósito**: a enfermagem abre em nome do médico);
  `exames_catalogo`, `exames_realizados` (laudo só por médico, imutável depois de assinado), `exame_arquivos`,
  bucket `exames`; `modelos_texto`; gatilho `somente_equipe`.
- **0006:** médico pode remover itens de um atendimento **ainda em andamento** (rascunho). Depois de
  finalizado, a trava impede.
- **0007:** o pedido de exame muda de situação (para "realizado") mesmo com o atendimento finalizado; o
  conteúdo do pedido continua travado.
- **0008 (importação do Micrologos):** `pacientes.prontuario_anterior`; `tg_auditoria` não grava durante
  `app.migracao = 'on'`; e-mail opcional para profissional inativo (check `profissionais_email_se_ativo`);
  `prontuario_legado` (só leitura, na linha do tempo, HTML mostrado como texto); `paciente_documentos` +
  bucket `documentos` (SHA-256; não se apaga); `convenio_planos` + `plano_id` em pacientes e agendamentos.

### Testes feitos
- Regras do banco testadas numa cópia local (Postgres 16 com o Supabase simulado) antes de cada migração.
- Teste completo no navegador (Playwright) com usuários de teste: recepção → enfermagem → médico →
  exame → laudo → impressão. Também foram testados celular, acesso anônimo bloqueado, cadastro externo
  bloqueado e usuário desativado sem acesso.
- Bugs achados e corrigidos: pedido de exame não virava "realizado" (0007); números de exemplo em cinza na
  refração, que confundiam (removidos); a agenda mostrava "fora do horário" enquanto carregava (agora mostra
  "Carregando…").

### Limpeza
- Dados de teste **apagados de vez** com autorização da dona: 3 usuários `teste.*@example.com`, o paciente
  fictício, a sala e a imagem de teste. Ficou uma linha "LIMPEZA" na auditoria.
- A função Edge `limpeza-teste` foi usada uma vez e está **desativada** (responde 410).
- O paciente **nº 3** ("Ana Carolina Bertolin…") foi criado pela conta da dona e **não é dado de teste nosso**.
  Pode colidir com a numeração do Micrologos; a sessão de migração trata com a dona antes da carga final.

### Combinado com a sessão de migração (session_01RxZddnh22LgcbmfJHGEQFc)
- Ela cuida da carga (ramo `claude/beautiful-meitner-8eu6jk`, pasta `migracao/`, schema privado
  `legacy_micrologos`, migração `0100_migracao_staging.sql`, bucket `migracao-micrologos`).
- **Decisão da dona:** o paciente mantém o **mesmo nº de prontuário** do Micrologos (carga com
  `OVERRIDING SYSTEM VALUE` + `setval`). `numero_prontuario` continua `generated always`.
- Cuidados na carga: `set local app.migracao = 'on'`; `atendimentos.agendamento_id` é único;
  `tg_bloquear_se_finalizado` impede itens em atendimento finalizado (inserir antes de finalizar ou usar
  `prontuario_legado`); `horarios_status` (inserir já com os horários); arquivos no bucket `documentos`
  com `origem = 'micrologos'`.
- **Avisar essa sessão** sempre que mudar a estrutura de pacientes, agenda ou atendimentos.

### Pendências
- [ ] Dona: informar o CNPJ (rodapé dos documentos).
- [ ] Dona: ligar "Leaked password protection" no painel do Supabase (Authentication → Policies).
- [ ] Opcional: domínio próprio (ex.: sistema.consumedolhos.com.br).
- [ ] Importação do histórico (sessão de migração).
- [ ] Próximos módulos sugeridos, nesta ordem: faturamento de convênios (TISS), assinatura digital
      ICP-Brasil, confirmação por WhatsApp, financeiro, centro cirúrgico/estoque, relatórios, portal do
      paciente, lista completa de CID-10 e de medicamentos.
- [x] Juntar o sistema ao `main` por PR e apontar o serviço `sistema` do Railway para o `main` (14/11).

### Avisos do Supabase que são esperados
- `abrir_atendimento` SECURITY DEFINER executável por usuários logados: é intencional.
- Tabelas de `legacy_micrologos` com RLS e sem políticas: são da sessão de migração, fechadas de propósito.
- "Índice não usado": normal enquanto o banco está vazio.

---

## 14/11/2026 (fim do dia): `main` como versão oficial
- A sessão do site criou o `main` (PR #1, aprovado pela dona) com o site e as migrações 0001–0004.
- A dona decidiu: o `main` é a versão oficial e toda mudança entra por PR.
- O sistema (telas + migrações 0005–0008 + histórico) foi mandado ao `main` por PR, sem conflitos.
  Depois da aprovação, o serviço `sistema` do Railway passa a publicar a partir do `main`.
- Atenção à **marca**: o sistema usa "Consumed · Clínica de Olhos" (como o site atual). Outra sessão
  (ramo `claude/youthful-cori-erycnr`) trocou a marca do site para "Hospital de Olhos da Baixada". Se a dona
  confirmar a troca de nome, ajustar também `app/src/lib/marca.ts` e os logos de `app/public/`.
