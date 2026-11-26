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
- PR #2 juntou o sistema ao `main` (merge em 14/11). O serviço `sistema` do Railway passou a publicar a partir do `main`.
- **Autorização permanente da dona:** Claude aprova e faz o merge dos PRs e o deploy sozinho, sem pedir
  (detalhes do fluxo no CLAUDE.md, seção "Como as mudanças entram").

---

## 14/11/2026 (noite) — Faturamento de convênios v1
### O que entrou
- **Migrações 0009 e 0010** (aplicadas): nova função de equipe `faturamento` (vê contas, guias, lotes e o cadastro
  dos pacientes, **não** vê prontuário); `procedimentos` (código TUSS, tabela 22/19/20/18/00/98), `precos` (por
  convênio e plano, com data de vigência; convênio vazio = particular), `contas` (cada conta = uma guia: consulta,
  SP/SADT ou particular), `conta_itens` (com glosa e recurso por item) e `lotes`.
  Convênios ganharam código do prestador, "exige senha", prazo de retorno e regras de faturamento.
  Profissionais ganharam `cbo` (padrão 225265 para médico).
- **Contas automáticas:** na chegada do paciente (consulta → item padrão "Consulta em consultório" TUSS 10101012 com
  o preço da tabela); exame realizado → item numa guia SP/SADT separada (mesmo dia/paciente/convênio).
  Retorno não gera conta. Falta/cancelamento cancela a conta ainda aberta.
- **Travas:** conta faturada/paga/cancelada não muda itens (só glosa e recurso); cancelar exige motivo; conta
  cancelada não reabre.
- **Telas:** Faturamento (Contas com pendências, Lotes, Glosas e recursos, Produção por convênio e por médico),
  detalhe da conta (dados da guia, itens, receber particular), detalhe do lote (enviar com protocolo, registrar
  pagamento, planilha CSV), Procedimentos e preços (com vínculo tipo de exame → procedimento), impressão de guia
  de consulta / SP-SADT (espelho para conferência e assinatura), recibo particular e relação de guias do lote.
  Recepção pede a senha de autorização na chegada quando o convênio exige.
### Testes
- Regras do banco testadas na cópia local (Postgres 16): conta automática com preço, SP/SADT separada para exame,
  enfermagem e médico sem acesso às contas, faturamento sem acesso ao prontuário, trava após faturar, glosa
  permitida depois de faturar, cancelamento exige motivo, falta cancela conta aberta. Corrigido um erro na trava
  (a glosa era bloqueada por causa do campo calculado `valor_total`).
- **Telas não testadas no navegador com login real.** Criar usuários de teste exigia publicar a função de senhas
  com uma "chave mestra" temporária; o sistema de segurança bloqueou (com razão). Os 3 usuários TESTE criados para
  isso ficaram **desativados**, sem senha (não foram apagados para não mexer na auditoria).
  Próximo teste de tela: a dona cria um acesso de teste pela tela Equipe (🔑) ou testa ela mesma.
### Ainda não feito no faturamento (precisa de informação da clínica ou dos convênios)
- Arquivo XML TISS para envio eletrônico (cada operadora tem versão e regras próprias; validar com o convênio).
- Repasse médico (faltam as regras por médico).
- Integração com portal/Orizon, SUS (BPA/APAC), DMED, NFS-e.
- Tabela TUSS completa e preços: virão da importação do Micrologos (avisar a sessão de migração).

---

## 14/11/2026 (noite) — Relatórios e listas oficiais
### Listas
- **CID-10 completo** (DATASUS, 12.451 códigos) e **medicamentos com registro ativo na ANVISA** (8.805, dos quais
  200 de uso oftalmológico), gerados por `app/scripts/gerar_listas.py` a partir dos arquivos oficiais e servidos como
  `app/public/dados/cid10.json` e `medicamentos.json` (dados públicos, sem dados de paciente; carregados só quando
  alguém busca). Para atualizar: baixar os arquivos (links no topo do script) e rodar o script.
- Diagnóstico agora busca no CID-10 completo (os CIDs de oftalmologia mais usados aparecem primeiro).
- Receita de medicamentos busca na lista da ANVISA (oftálmicos primeiro, ⭐ favoritos da clínica) e faz a
  **conferência alergia × medicamento** (avisa se o nome ou o princípio ativo bate com uma alergia registrada).
- Detalhe: a ANVISA classifica latanoprosta/bimatoprosta como "PROSTAGLANDINAS"; o script trata como oftálmico.
### Relatórios (migração 0011 + tela Relatórios)
- Funções `rel_*` (SECURITY INVOKER: cada função de equipe só vê o que o RLS permite): agenda por médico/convênio/tipo
  (com % de falta), tempo de espera (média, 90% e atraso), pacientes que mais faltaram, pacientes novos por
  convênio/cidade, exames (realizados, laudados, horas até o laudo), produção por médico e diagnósticos mais
  frequentes. Anônimos não executam. Cada tabela exporta planilha e a página imprime.
- Testado na cópia local (cálculos de espera/atraso conferidos; recepção não vê diagnósticos; anônimo bloqueado).

---

## 15/11/2026 — WhatsApp oficial (API da Meta) v1
### Pedido da dona
Enviar e receber WhatsApp pelo sistema. Recomendação aceita: **API oficial da Meta (WhatsApp Cloud API), direto,
sem intermediário**, com um número brasileiro da clínica (chip novo ou fixo). Nada de Z-API/Evolution (não oficiais,
risco de banimento e de LGPD). A parte da conta na Meta (Business Manager com o CNPJ, verificação da empresa, número,
cartão) é feita pela dona.
### O que entrou
- **Migração 0012 `whatsapp`** (aplicada): `pacientes.whatsapp_autorizado` (null = não perguntado / true / false) +
  `whatsapp_autorizado_em` (gatilho); `whatsapp_conversas` (uma por número; liga sozinha ao paciente quando o número
  bate com UM paciente só — família com o mesmo celular fica para a recepção ligar); `whatsapp_mensagens`
  (`wa_id` único: a Meta reenvia avisos e não duplica); `whatsapp_modelos` (lembrete_consulta, retomar_conversa;
  nascem **desligados**); funções `whatsapp_receber`, `whatsapp_situacao`, `whatsapp_conversa`,
  `whatsapp_paciente_do_numero` (só a chave de serviço executa) e `telefone_whatsapp` (celular → 55DDD9XXXXXXXX).
- **RLS:** médico, enfermagem, recepção e admin LEEM conversas e mensagens; a equipe só pode mudar `nao_lidas`,
  `paciente_id` e `arquivada` (permissão por coluna). Ninguém da equipe cria/apaga mensagens: só as funções Edge.
  **Faturamento não vê** (pode haver conteúdo de saúde). Modelos: só admin altera (auditado).
- **Funções Edge:** `whatsapp-webhook` (verify_jwt **false**, quem chama é a Meta; confere a assinatura
  `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET` e recusa tudo se o segredo não existir) e `whatsapp-enviar`
  (verify_jwt true; ações `estado`, `texto` (só dentro das 24 h), `retomar` (modelo), `lembretes` (só recepção/admin;
  `simular` conta antes), `midia` (baixa foto/áudio da Meta, ~30 dias)). Código em `supabase/functions/whatsapp-*`.
- **Lembrete com botões:** payload `CONFIRMAR:<agendamento>` / `REMARCAR:<agendamento>`. "Confirmar" muda o
  agendamento de `agendado` para `confirmado` (canal whatsapp) — só se o lembrete daquele agendamento foi mandado
  para aquele mesmo número. Lembrete só vai para quem tem `whatsapp_autorizado = true` e celular válido; não repete.
  Paciente que escreve SAIR/PARAR/STOP fica com `whatsapp_autorizado = false`.
- **Telas:** menu **WhatsApp** (lista de conversas, conversa estilo WhatsApp, atualiza a cada 10 s, ver fotos/áudios,
  ligar a paciente, arquivar, aviso da janela de 24 h + "Chamar o paciente de novo", botão **Lembretes de consulta**
  com prévia dos números, **Modelos** com os textos para cadastrar na Meta). Cadastro do paciente ganhou
  "Aceita receber mensagens pelo WhatsApp?". Ficha do paciente ganhou o botão 💬 WhatsApp.
### Testes
- Banco testado na cópia local (Postgres 16 + Supabase simulado): ligação do número com e sem o 9, família com o
  mesmo número sem ligação automática, botão Confirmar, reenvio duplicado da Meta, botão de agendamento que não foi
  mandado àquele número (ignorado), SAIR, situação não regride (lida → entregue), recepção não grava mensagem nem
  muda telefone nem chama as funções internas, faturamento não vê, anônimo bloqueado, só admin liga modelos.
- Webhook testado com avisos simulados da Meta (Deno): validação do endereço, assinatura falsa/ausente recusada,
  texto, botão, foto com legenda, situações lida/falhou, recusa tudo sem a chave secreta.
- Tela conferida no navegador com dados simulados (computador e celular). **Ainda sem teste com a Meta de verdade**
  (falta a conta da dona).
### Para ligar (falta a dona terminar a conta na Meta)
1. Segredos no Supabase (Edge Functions → Secrets): `WHATSAPP_TOKEN` (token permanente de usuário do sistema),
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (frase combinada, 16+ letras).
   Use a ferramenta `create_edge_function_secret` (a dona digita o valor no painel; o valor nunca passa pelo chat).
2. Na Meta (app → WhatsApp → Configuração): URL de retorno
   `https://ogflxjolbwrzayjtxvhj.supabase.co/functions/v1/whatsapp-webhook`, token de verificação = o mesmo
   `WHATSAPP_VERIFY_TOKEN`; assinar o campo **messages**.
3. Cadastrar os 2 modelos (texto em WhatsApp → Modelos, categoria Utilidade, pt_BR, nomes `lembrete_consulta` e
   `retomar_conversa`; o lembrete tem 2 botões de resposta rápida: "Confirmar presença" e "Preciso remarcar").
   Depois da aprovação, a admin liga cada modelo na tela.
4. Testar: mandar "oi" do celular para o número da clínica → aparece na tela; responder; lembrete para um
   agendamento de teste e tocar "Confirmar".
### Pendências / ideias
- Os textos dos modelos citam "Consumed Clínica de Olhos": ajustar se a marca mudar para "Hospital de Olhos da Baixada".
- Envio automático diário dos lembretes (hoje é um botão, de propósito: cada lembrete custa e a recepção confere antes).
- Guardar fotos/documentos recebidos no Storage (hoje ficam na Meta por ~30 dias) e anexar à ficha do paciente.
- Avisar a sessão de migração: `pacientes` ganhou `whatsapp_autorizado` e `whatsapp_autorizado_em` (opcionais).

---

## 15/11/2026 — WhatsApp: acréscimos na tela (sessão "Interface de comunicação WhatsApp")
Feito por cima da tela da sessão do WhatsApp (PR anacbertolin/secreto#6), combinado entre as duas sessões.
- **Migração 0013 `whatsapp_tela`** (aplicada): `whatsapp_conversas.responsavel_id` (quem da equipe está cuidando,
  a equipe pode alterar só essa coluna a mais) e as tabelas `whatsapp_conversas` / `whatsapp_mensagens` na publicação
  `supabase_realtime` (o Realtime respeita o RLS). Advisors: nada novo.
- **Quem cuida da conversa:** botão Assumir / Soltar no topo da conversa. Quem responde uma conversa sem dono a assume
  sozinho. Filtros Todas / Minhas / Sem responsável na lista.
- **Ao vivo:** lista e conversa atualizam pelo Realtime na hora (a checagem a cada 10 s continua como reserva).
- **Aviso de mensagem nova:** contador de não lidas no menu e no título da aba, com som e aviso do computador
  (botão "🔔 Avisar quando chegar mensagem"). Fica em `useNaoLidas` (`app/src/lib/whatsapp.ts`).
- **Ficha ao lado da conversa** (telas largas): dados do paciente, se aceita WhatsApp e os próximos agendamentos.
- **Quem usa:** decisão da dona (15/11): **todos da equipe veem as conversas; só a recepção e a administração
  respondem.** Médico e enfermagem abrem a tela só para ler: não escrevem, não assumem, não arquivam, não ligam a
  paciente e, ao abrir, a conversa NÃO é marcada como lida (para não sumir o aviso da recepção). O contador e o som
  de mensagem nova aparecem só para recepção e administração. Fechar o envio também na função/banco: sessão do WhatsApp.
- Testado com dados simulados no navegador (sem login real): lista, filtros, assumir, janela de 24 h, ficha.

### 15/11/2026 (mais tarde) — quem vê e quem atende (migração 0014)
- **Decisão da dona:** "Quem usa para atender o cliente é a recepção, mas todos devem poder ver as conversas, até
  para ajudar a gerir o negócio."
- **Migração 0014 `whatsapp_todos_veem`** (aplicada): conversas, mensagens e modelos são lidos por médico,
  enfermagem, recepção, admin **e faturamento**. Mexer na conversa (marcar lida, ligar paciente, arquivar,
  responsável) só recepção e admin, para quem só olha não zerar as não lidas da recepção. Testado no banco real dentro
  de uma transação desfeita: faturamento e médico veem e não alteram; recepção altera.
- **whatsapp-enviar (versão 2):** `estado` e `midia` para toda a equipe ativa; `texto`, `retomar` e `lembretes` só
  recepção e admin.
- Botão 💬 WhatsApp da ficha aparece para todos. A tela `/whatsapp` está com a sessão "Interface de comunicação
  WhatsApp" (session_01RxZddpBY3PXj2AGWj8jLji): ela acrescenta responsável, Realtime (migração 0013_whatsapp_tela),
  contador de não lidas e ficha ao lado; combinado que o menu fica para todos e os botões de enviar só para recepção/admin.
- **Migração 0015 `whatsapp_arquivada_sem_responsavel`** (aplicada, combinada com a sessão da tela): quando uma
  conversa ARQUIVADA recebe mensagem nova, ela volta sem responsável (`responsavel_id = null`). Fora isso, a conversa
  continua com quem assumiu. Testado no banco real numa transação desfeita.
- **Decisão confirmada pela dona (15/11, pela sessão da tela):** o **faturamento continua vendo** as conversas do
  WhatsApp, mesmo sabendo que podem ter conteúdo de saúde. Não restringir sem falar com ela.
- Ligar a conta da Meta (segredos, webhook, modelos) fica com a sessão do WhatsApp/Meta
  (session_01RxZddmtjCEn8oxqqbwNeAm). Passo a passo para a dona: https://claude.ai/artifact/6JGfvWQ9aQ2jtNmr1T7zew

---

## 15/11/2026 — Melhorias para o médico e o fluxo da clínica (sessão "melhorias", ramo `claude/eloquent-newton-c7128m`)
### Pedido da dona
Implantar, por ordem de prioridade e sem pedir licença a cada passo, as melhorias levantadas no brainstorm (fluxo do dia,
evolução do paciente, busca ativa, cirurgias/injeções, protocolos). **Cuidado pedido por ela: nada pode impedir a
migração do Micrologos.** Regra seguida em todas as fases: só tabelas novas e colunas opcionais; nenhuma coluna
existente muda; todo gatilho novo em tabela existente ignora `app.migracao = 'on'`.
Numeração: as migrações desta sessão começam em **0020** (a 0016 em diante fica livre para a sessão do WhatsApp, que
aplicou `whatsapp_extrator` no banco e ainda não mandou o arquivo para o `main`).

### Fase 1 — Etapas do paciente, cronômetro de dilatação e TV de chamada (migração 0020, aplicada)
- `agendamentos` ganhou colunas opcionais: `etapa` (pre_consulta / dilatando / pronto_medico / exames), `etapa_em`,
  `dilatacao_inicio_em`, `dilatacao_minutos` (padrão 30), `dilatacao_colirio`, `dilatacao_olho`, `chamada_em`,
  `chamada_local`. Gatilho `etapa_fluxo` grava as horas com o relógio do servidor. Sem regra nova de acesso (a equipe
  já podia alterar agendamentos).
- **Telas:** Recepção (sala de espera mostra a etapa, o cronômetro e botões 💧 Dilatar / ✅ Pronto / 📢 Chamar; botão
  "📺 TV de chamada"), Consultório (fila põe primeiro quem está pronto ou já dilatou), barra de etapas dentro do
  atendimento, e **`/painel-tv`** (tela cheia para a TV: nome grande, sala, últimas chamadas, aviso sonoro e voz em
  português; mostra só primeiro + último nome). Código: `app/src/lib/fluxo.ts`, `app/src/components/Fluxo.tsx`,
  `app/src/pages/PainelTV.tsx`.
- **Para a sessão de migração:** nada a fazer. As colunas novas ficam vazias nos agendamentos antigos.
- Testes: banco de teste local (Postgres 16) com as 16 migrações; gatilho conferido (hora do servidor, padrão 30 min,
  modo migração intacto). Telas conferidas no navegador com dados simulados (recepção, consultório, TV).
- Para usar a TV: num computador ligado à TV, entrar com um login da recepção e abrir `/painel-tv`; tocar uma vez na
  tela para liberar o som.

---

## 15/11/2026 — Assistente (extrator) do WhatsApp
### Pedido da dona
"Um extrator das conversas de WhatsApp para quando elas estiverem conectadas: ler as conversas e agendar os pacientes
automaticamente, depois analisar a qualidade do atendimento e, por fim, preparar para automatizarmos com um robô
(entender que conteúdo precisamos ter para um robô fazer o trabalho)."
### Como funciona
- A cada 10 min o banco (pg_cron + pg_net) chama a função Edge **`whatsapp-extrator`** — só se o assistente estiver
  ligado e houver conversa com mensagem nova parada há N minutos (padrão 20). A função lê o trecho novo (+12 mensagens
  de contexto) e manda para a IA (Claude, `claude-opus-5-5`, esforço médio, resposta em JSON validado) uma única vez,
  que devolve: pedidos de agendamento, notas de qualidade, perguntas para a base do robô, resumo e intenções.
- **Agendamento automático** (regras no código, não na IA): só marca quando a conversa tem dia + hora + médico
  combinados (`acordo_fechado`), certeza ≥ 85%, horário futuro, dentro de `horarios_profissional`, sem bloqueio e livre
  (a trava `agenda_sem_conflito` confere). Paciente: acha pelo número/nome; homônimo com outro telefone → pendência;
  paciente novo com nome completo → cadastro simples (nome, telefone, observação "conferir na chegada").
  Se a recepção já marcou o mesmo paciente/médico/dia → "resolvido". Remarcar e cancelar sempre ficam para a recepção.
- **Qualidade:** tempo de resposta medido pelo sistema (mensagens automáticas não contam) + notas da IA
  (cordialidade, clareza, resolução, informação correta), pontos positivos/a melhorar e sugestão.
- **Robô:** `bot_conhecimento` junta perguntas iguais (a IA recebe a lista e reaproveita o id), conta vezes e
  "lacunas" (a equipe não soube responder). A admin escreve e **aprova** a resposta que o robô dará; marca o que
  precisa de pessoa. Exemplos guardados sem nomes/números.
- **Privacidade:** antes de ir para a IA, CPF/telefones/e-mails/números longos viram marcadores, atendentes viram
  "Atendente 1", do paciente vai só o primeiro nome. O texto das conversas é processado pela Anthropic (EUA); os
  resultados ficam só no Supabase (São Paulo). A dona precisa estar de acordo antes de ligar (ver pendências).
### O que entrou
- **Migração 0016 `whatsapp_extrator`** (aplicada): `whatsapp_extrator_config` (1 linha; nasce **desligado**),
  `whatsapp_extrator_estado` (até onde cada conversa foi lida; erros e tentativas), `whatsapp_analises`,
  `whatsapp_pedidos_agendamento`, `whatsapp_avaliacoes`, `bot_conhecimento`, visão `bot_prontidao`; funções
  `whatsapp_extrator_pegar` (fila com `skip locked`), `whatsapp_extrator_pacientes_do_numero`,
  `bot_conhecimento_registrar`, `whatsapp_extrator_chave_ok` (só chave de serviço); `interno.extrator_chave`
  (chave aleatória gerada no banco, usada pelo pg_cron — nunca passou pelo chat); tarefa pg_cron `whatsapp-extrator`.
  **0017**: índice + quem mudou a configuração.
- **RLS:** pedidos e análises → recepção e admin (recepção resolve/descarta); avaliações → **só admin**;
  base do robô → recepção e admin leem, só admin edita/aprova; configuração → admin altera.
- **Função Edge `whatsapp-extrator`** (verify_jwt false, autenticação própria: chave do agendador ou login de
  recepção/admin). Ações: `estado`, `rodar` (admin), `analisar` {conversa_id}. Código em
  `supabase/functions/whatsapp-extrator/` (`logica.ts` tem as regras puras; testes em `logica_test.ts`).
- **Tela `/whatsapp/assistente`** (menu "🤖 Assistente do WhatsApp", recepção e admin): abas Pedidos de agendamento
  (botão Agendar abre o formulário já preenchido), Qualidade (admin), Preparação do robô, Configuração (admin).
### Testes
- Banco real em transação desfeita: fila (pega uma vez, não pega de novo enquanto em processo), "tem trabalho" só
  ligado, soma de perguntas repetidas, chave certa/errada, admin vê/aprova, pessoa de fora não vê nada.
- Regras puras (Deno): máscara de CPF/telefone/e-mail sem estragar datas, tempos de resposta, fuso de Brasília,
  encaixe no horário do médico (vigência, fim da faixa), nomes, telefone.
- Função publicada: chave falsa → 401; sem login → 401; chave certa sem a chave da IA → 503 "falta a chave".
- Tela conferida no navegador com dados simulados (computador). **Ainda sem teste com a IA de verdade** (falta a
  chave) nem com conversas reais (falta a Meta).
### Pendências
- [ ] Dona: decidir se aceita que o texto das conversas seja processado pela Anthropic (EUA). Se sim, criar a chave
      em console.anthropic.com e cadastrar no Supabase como segredo `ANTHROPIC_API_KEY` (pelo painel; nunca no chat).
- [ ] Depois da chave: rodar "analisar" numa conversa de teste e conferir o resultado; então ligar na tela.
- [ ] Cadastrar médicos ativos e **horários** (Cadastros → Horários): sem isso o agendamento automático vira pendência.
- [ ] Ideia: importar conversas antigas exportadas do WhatsApp do celular (.txt) para já montar a base do robô.
- [ ] Ideia (próxima fase): o robô em si — responder sozinho com as respostas aprovadas e marcar horários livres.

### Fase 2 — Evolução do paciente em gráficos (sem mudança no banco)
- Aba **📈 Evolução** na ficha do paciente e dentro do atendimento: gráficos de **PIO** (aplanação quando houver, senão a
  da pré-consulta; linha de referência 21 mmHg), **acuidade visual** melhor corrigida (Snellen "20/40" e decimal
  "0,5" viram decimal; conta dedos/vultos aparecem só na tabela) e **grau** (equivalente esférico; prioridade
  dinâmica → estática → autorrefração → lensometria). Resumo da PIO (última, primeira, maior) e botão "Ver em tabela".
- Cores OD azul `#2a78d6` / OE laranja `#eb6834` (validadas para daltonismo) + formas diferentes (círculo/quadrado).
- Código: `app/src/components/Grafico.tsx` (gráfico SVG reutilizável) e `app/src/components/Evolucao.tsx`.
- O prontuário antigo do Micrologos (texto livre) não entra nos gráficos; se a carga trouxer PIO/AV em campos
  estruturados, dá para incluir depois.

### Fase 3 — Acompanhamento de doenças crônicas e busca ativa (migração 0021, aplicada)
- **`seguimentos`**: o médico marca que o paciente deve voltar a cada X dias (glaucoma 4 meses, DMRI 3, retinopatia
  diabética 4, diabetes sem retinopatia 1 ano…) e a **PIO alvo** (aparece como linha tracejada no gráfico de PIO).
  Médico e enfermagem leem; só médico cria/edita; ninguém apaga (encerra com motivo). Um ativo por condição.
- **`busca_ativa_contatos`**: cada tentativa de contato (ligação/WhatsApp; resultado: agendou, não atendeu, número
  errado, mudou de cidade, faleceu…). Equipe (menos faturamento) lê e registra em nome próprio.
- **`busca_ativa(tolerância)`**: lista quem passou do prazo e **não tem consulta marcada**. A "última consulta" é
  calculada na hora com atendimentos, agendamentos atendidos **e o prontuário antigo do Micrologos**. SECURITY DEFINER
  **de propósito** (aviso do Supabase esperado): a recepção precisa saber quem ligar sem ler o prontuário; a doença
  só vem para médico/enfermagem (para os outros vem "acompanhamento"). Resultados "recusou / acompanha em outro
  lugar / mudou de cidade / faleceu" tiram o paciente da lista.
- **`busca_ativa_sugestoes()`** (INVOKER): pacientes com CID crônico (H40/H42, H36.0/E1x.3, E10–E14, H35.3, H18.6,
  H20/H30) que ainda não estão em acompanhamento.
- **Telas:** menu **📞 Busca ativa** (atrasados com ligar/WhatsApp/registrar contato/📅 agendar — agendar já registra o
  contato "agendou"; aba Sugestões para médico/enfermagem) e caixa **🔔 Acompanhamento** no topo da aba Evolução.
- **Para a sessão de migração:** nada a fazer. Se a carga trouxer diagnósticos estruturados (CID), eles alimentam as
  sugestões; se trouxer "retorno em X meses", dá para criar `seguimentos` em lote depois (combinar com a dona).
- Testes no banco local: atrasado aparece; em dia e com consulta marcada não; paciente só com prontuário antigo
  aparece com a data antiga; recepção vê sem a doença e não lê `seguimentos`; faturamento e anônimo bloqueados;
  contato em nome de outra pessoa bloqueado. Telas conferidas com dados simulados (médico e recepção).

---

## 15/11/2026 — Regra de idioma
- A dona pediu: **sempre falar em português** (respostas, resumos, PRs e textos para ela). Registrado no topo do CLAUDE.md.

### Fase 4 — Centro cirúrgico, LIO e injeções intravítreas (migração 0022, aplicada)
- **`cirurgias`**: indicação → aguardando autorização → autorizada → agendada → realizada (ou cancelada com motivo).
  Data/sala/equipe/anestesia, convênio e senha, **biometria** (comprimento axial, K1/K2, ACD, fórmula, refração alvo) e
  **LIO com fabricante/modelo/dioptria/lote/série/validade/registro ANVISA** (rastreabilidade), **checklist de cirurgia
  segura (OMS)** em 3 momentos (guardado em `checklist` jsonb com a hora de cada item), ato cirúrgico (início/fim,
  descrição, intercorrências). Gatilho `regras`: só médico finaliza, exige descrição, hora do servidor; **finalizada
  não muda** (como o laudo). Ignora `app.migracao = 'on'` (permite carregar cirurgias antigas já finalizadas).
- **`injecoes_intravitreas`**: olho, medicamento (aflibercepte, ranibizumabe, bevacizumabe, faricimabe…), lote
  (obrigatório na tela), validade (tela bloqueia vencido), protocolo, próxima em X semanas, CID/indicação, senha.
  View `injecoes_resumo` (nº na série por olho e próxima prevista) e função `injecoes_pendentes()` (atrasadas/próximas,
  com consulta marcada ou não). Ambas SECURITY INVOKER.
- Acesso: médico e enfermagem leem e registram; só médico finaliza; ninguém apaga. Recepção e faturamento não veem.
- **Telas:** menu **🏥 Centro cirúrgico** (Mapa do dia, Fila de indicações, 💉 Injeções atrasadas/próximas, Realizadas),
  ficha da cirurgia `/cirurgias/:id` (com impressão e, ao finalizar, sugestão de retornos de 1, 7 e 30 dias que abrem
  o agendamento já preenchido) e aba **Cirurgias e injeções** na ficha do paciente.
- **Para a sessão de migração:** nada obrigatório. Se o Micrologos tiver cirurgias/LIO estruturadas, dá para carregar
  em `cirurgias` com `status = 'realizada'` e `finalizada_em` dentro de `app.migracao = 'on'`.
- Testes no banco local: enfermagem não finaliza; finalizar sem descrição bloqueado; alterar depois de finalizada
  bloqueado; série e próxima injeção calculadas; recepção não vê; carga antiga finalizada aceita.
- Ainda não feito: faturamento automático da cirurgia (guia SP/SADT) e estoque de lentes/medicamentos — combinar com
  a dona e com a sessão do faturamento.

---

## 15/11/2026 — Assistente do WhatsApp: parâmetros pedidos pela dona (migração 0018)
- Dona **de acordo** com o envio do texto das conversas (mascarado) à Anthropic para análise.
- **Modelo da IA** virou opção na tela (Configuração): padrão **Claude Sonnet 5.5**; também Opus 5.5 e Haiku 5.5.
- **Horário padrão da clínica** (Configuração): dias, abre/fecha e duração da consulta (padrão seg–sex, 8h–18h, 20 min).
  Vale para o médico sem horário próprio em `horarios_profissional`; quem tem horário próprio segue o dele.
- Migração **0018 `whatsapp_extrator_parametros`** (aplicada): colunas novas na configuração + trava dos modelos aceitos.
  Função `whatsapp-extrator` versão 2 publicada.
- Créditos: a assinatura do Claude (chat) não paga uso pela API; a extração usa créditos pré-pagos do Console da
  Anthropic (console.anthropic.com), com o segredo `ANTHROPIC_API_KEY` no Supabase.

### Fase 5 — Protocolos de consulta e folha de colírios em letra grande (migração 0023, aplicada)
- Botão **📋 Protocolo** no atendimento (só o médico responsável, com o atendimento aberto). Oito protocolos prontos no
  código (`app/src/components/Protocolos.tsx`): rotina/refração, retorno de glaucoma, pré-operatório de catarata,
  pós-operatório de 1º dia, rastreio de retinopatia diabética, DMRI/injeção, olho seco, primeira consulta infantil.
  Preenche **só campos vazios** (anamnese, conduta, orientações, retorno, exame), cria os pedidos de exame que faltam e,
  se marcado, o acompanhamento (busca ativa). "💾 Salvar esta consulta como protocolo" grava em **`protocolos_consulta`**
  (nova; médico e enfermagem veem os compartilhados e os próprios; só o dono altera; aviso para não salvar dado pessoal).
- **Folha "Meus colírios"** (`/imprimir/colirios/:atendimento`, botão "👁️ Horários (letra grande)" na receita): só os
  itens de uso ocular, nome e olho em letra grande, horários calculados da posologia (8/8h, 12/12h, "4x ao dia",
  "ao deitar"…; intervalos curtos só das 6h às 22h; o que não entender fica com horário em branco) e quadradinhos
  para marcar 7 dias, mais as dicas de como pingar e o telefone da clínica.
- Testes: regras da tabela no banco local (outro médico não vê o privado nem altera; enfermagem não cria);
  leitor de posologia conferido com 9 exemplos; telas conferidas com dados simulados.

### Resumo do dia (15/11, sessão "melhorias") e próximos passos sugeridos
- Entraram no ar: PR anacbertolin/secreto#12 (fluxo/dilatação/TV), #14 (evolução), #15 (busca ativa), #17 (centro
  cirúrgico/injeções) e o PR desta fase. Migrações 0020–0023, todas aditivas (sem risco para a carga do Micrologos).
- Nenhuma tela nova foi testada com login real (regra do projeto: precisa de acesso de teste criado pela dona).
- Ideias da lista que ficam para depois (dependem de decisão/contrato da dona ou de terceiros):
  receita digital com certificado ICP-Brasil (Memed ou prescrição do CFM), ligação dos aparelhos (autorrefrator,
  tonômetro, OCT, biômetro — depende das marcas/modelos), IA de ditado/resumo do prontuário (LGPD + aval), portal do
  paciente, faturamento automático da cirurgia (falar com a sessão do faturamento), estoque de lentes/medicamentos,
  desenho do fundo de olho, comparação lado a lado de imagens de exames, RNDS.

---

## 15/11/2026 (tarde) — Rodada 2 da sessão "melhorias" (dona pediu: "segue com todas as frentes")

### Estoque e faturamento automático de cirurgias e injeções (migração 0024, aplicada)
- **`estoque_itens`** (lente por modelo+dioptria, medicamento, material; código para faturar; estoque mínimo),
  **`estoque_lotes`** (lote, nº de série da lente — único por item —, validade, NF, custo, consignado) e
  **`estoque_movimentos`** (entrada/saída/ajuste/perda/devolução; não se altera nem apaga; ajuste e perda exigem
  motivo). View **`estoque_saldos`** (INVOKER). Leem: médico, enfermagem, admin, faturamento. Cadastram: enfermagem,
  admin (faturamento só liga o código de faturamento). Movimentos em nome próprio.
- **Saída automática:** cirurgia finalizada baixa a lente pelo lote/série; injeção registrada baixa o medicamento pelo
  lote. Lote que não está no estoque não bloqueia nada (só não baixa).
- **Faturamento automático:** `cirurgias.procedimento_id` e `injecoes_intravitreas.procedimento_id`/`convenio_id`
  (novas, opcionais). Ao finalizar/registrar, `interno.conta_do_dia` abre (ou reaproveita, mesmo dia + convênio +
  **mesma senha**) uma conta SP/SADT ou particular e lança o procedimento e a lente/medicamento (se o item do estoque
  tiver código). Preço pela tabela de preços (gatilho da 0010). Mesmo modelo de `tg_exame_conta`.
  **Avisar a sessão do faturamento** (contas criadas por cirurgia/injeção não têm `agendamento_id`).
- Gatilhos ignoram `app.migracao = 'on'`: cirurgias antigas carregadas não geram conta nem baixa.
- **Telas:** menu **📦 Estoque** (saldos por lote com alertas de vencimento e de mínimo, itens, movimentos, entrada de
  lote com série por lente, ajuste/perda); na cirurgia, **"📦 Escolher lente do estoque"** (as mais próximas da dioptria
  primeiro) e "Código para faturar"; na injeção, lote sugerido do estoque e código para faturar.
- Testes no banco local: baixa de lente e medicamento; conta com preços certos; injeção e cirurgia em guias
  separadas (senhas diferentes); movimento não se apaga; ajuste sem motivo bloqueado; recepção não vê; carga antiga
  não gera conta.

### Código de autenticidade (QR) nos documentos (migração 0025, aplicada)
- **`documentos_verificacao`** (código de 12 caracteres aleatórios, tipo, documento, resumo). Toda impressão de receita de
  óculos, receita, documento/atestado, laudo e pedido de exames chama **`documento_codigo(tipo, id)`** (SECURITY DEFINER,
  só médico/enfermagem; o mesmo documento devolve sempre o mesmo código) e mostra um **QR** no rodapé
  (`app/src/components/Autenticidade.tsx`, biblioteca `qrcode` 1.5.4). Se der erro, imprime sem o selo.
- Página pública **`/verificar/<código>`** (sem login; `app/src/pages/Verificar.tsx`) chama
  **`verificar_documento(código)`** (SECURITY DEFINER **executável por anônimo, de propósito**: é para ótica, farmácia e
  empresas). Mostra só: tipo, data, médico e CRM, **nome do paciente abreviado**, graus (óculos), medicamentos (receita),
  dias de afastamento (atestado, **sem CID nem texto**), nome do exame (laudo), lista de exames (pedidos). Médico pode
  marcar um código como cancelado (`cancelado`, `motivo_cancelamento`). Avisos do Supabase esperados:
  `verificar_documento` (anon) e `documento_codigo` (authenticated).
- Isto **não substitui a assinatura digital ICP-Brasil** (que dá validade jurídica à receita eletrônica); é uma conferência
  de autenticidade do papel. A assinatura ICP depende do certificado dos médicos e de escolher o serviço (pendente da dona).

### Desenho do olho e comparação de exames (migração 0026, aplicada)
- **`desenhos_oculares`** (atendimento, olho, tipo fundo/segmento anterior, traços em JSON 0–100, legenda). Usa a mesma trava
  `tg_bloquear_se_finalizado` (finalizado não muda). Médico desenha/edita/remove rascunho; enfermagem vê.
- Aba **Desenho** no atendimento (`app/src/components/pep/Desenho.tsx`): diagrama do fundo de olho com o disco óptico do lado
  certo (OD à direita, OE à esquerda), equador e ora serrata pontilhados, horas do relógio; cores padrão (vermelho, azul,
  verde, preto, amarelo, roxo), espessuras, desfazer, limpar; mouse, dedo e caneta.
- **Comparar exames** (sem mudança no banco): na ficha do paciente → aba Exames, marcar 2 e "🔀 Comparar" mostra imagens/PDF e
  laudo lado a lado (`app/src/components/CompararExames.tsx`).

## 15/11/2026 — Assistente do WhatsApp pelo plano do Claude (migração 0019)
- **Decisão da dona:** não usar chave de API; usar o **plano do Claude** da conta, por **tarefa agendada** (como ela já
  faz em outro sistema). Modelo: **Sonnet 5.5**. A dona está de acordo com o envio do texto mascarado.
- **Migração 0019 `whatsapp_extrator_plano_claude`** (aplicada): a lógica saiu da função Edge e foi para o banco.
  `whatsapp_extrator_preparar(n)` separa até n conversas paradas e devolve instruções + referências + texto já mascarado
  (`interno.mascarar`); `whatsapp_extrator_gravar(conversa, ate, json, modelo)` confere o formato e aplica as mesmas
  regras (`interno.extrator_decidir`: paciente, horário próprio ou padrão, bloqueio, já marcado, cria cadastro e marca
  juntos — se a marcação falhar, o cadastro é desfeito); `whatsapp_extrator_falhou`, `whatsapp_extrator_concluir_rodada`
  (resumo na tela). Só a chave de serviço / dono do banco executa. O agendador pg_cron antigo foi **desligado**.
  A função Edge `whatsapp-extrator` ficou parada (serve se um dia usarem chave de API).
- **Tela:** Configuração mostra "última passagem" e o resumo da rodada; não pede mais chave.
  Privacidade: orientar a deixar desligado "Ajudar a melhorar o Claude" na conta usada.
- **Testes** (banco local com todas as migrações + Supabase simulado): preparar/gravar ponta a ponta e 12 casos de
  agenda (novo paciente, horário ocupado sem deixar cadastro, sábado fora do padrão, família no mesmo número, nome da
  filha, homônimo com/sem nascimento, já marcado, bloqueio, remarcar, horário próprio fora/dentro). Banco real: funções
  criadas, agendador antigo removido, equipe sem permissão de chamar as funções, advisors sem aviso novo desta parte.
- **Tarefa agendada:** texto em `docs/sistema/assistente-tarefa-agendada.md`. Criada com o "pode criar" da dona
  (id `trig_01LZifj2S2htrZMt1RXH5Hkc`, Sonnet 5.5, 7h–20h de hora em hora). A organização não deixa a sessão anexar
  conectores: a dona ligou o Supabase na tarefa pelo claude.ai (também ficou marcado o Railway, que a tarefa não usa).
  Teste em 15/11 12:04 UTC: entrou no banco, viu "desligado" e gravou o resumo.
- **Teste completo no banco real (15/11, autorizado pela dona):** médico, conversa e mensagens "TESTE". A tarefa (Sonnet)
  analisou: marcou qua 18/11 10:00–10:20 (horário padrão, 20 min), criou o cadastro com o telefone da conversa (CPF não
  foi para a IA), nota 6 com pontos a melhorar coerentes, e registrou 2 perguntas sem resposta da equipe (Unimed e preço
  particular). Tudo apagado depois (linha "LIMPEZA" na auditoria) e o assistente ficou **desligado**.
- **Tarefa PAUSADA** a pedido da dona até o WhatsApp da Meta estar conectado. Para usar: reativar a tarefa
  (`update_trigger enabled=true`) e apertar "Ligar o assistente" na tela. Pendência da dona: desmarcar o conector
  Railway da tarefa (só dá pelo claude.ai).

### Resumo do prontuário por IA — NASCE DESLIGADO (migração 0027 + função Edge `prontuario-resumo`, aplicadas)
- **`ia_prontuario_config`** (linha única, `ligado = false`). Só admin liga, na tela **Cadastros → ✨ Inteligência artificial**
  (`app/src/pages/ConfigIA.tsx`, com confirmação explicando o envio à Anthropic/EUA). **Pendente: aval da dona.**
- Função **`prontuario-resumo`** (verify_jwt true; código em `supabase/functions/prontuario-resumo/`): só médico/enfermagem;
  lê o histórico **com o token de quem pediu** (chave publicável → o RLS vale; não usa a chave de serviço); manda à IA
  idade, sexo e dados clínicos das 30 consultas mais recentes + 15 registros do Micrologos + alergias, medicamentos,
  antecedentes, acompanhamentos, cirurgias, injeções e exames. **Não manda** nome, CPF, telefone, endereço, nome da mãe;
  e-mails, números ≥ 7 dígitos (cartão SUS antes do CPF), CPF, telefone e nomes do paciente/mãe nos textos viram
  marcadores. Modelo `claude-opus-5-5`, effort medium, saída estruturada (JSON schema), fallback de recusa
  (`server-side-fallback-2026-07-01`, `fallbacks: "default"`). Nada é guardado; `registrar_leitura` grava o pedido.
- Botão **✨ Resumo (IA)** na ficha e no atendimento (`app/src/components/ResumoIA.tsx`) só aparece com a IA ligada.
- Usa o mesmo segredo `ANTHROPIC_API_KEY` do assistente do WhatsApp.
- **Não testado com a IA de verdade** (desligada; sem acesso ao Supabase/Anthropic a partir da sessão). Testado: mascaramento
  com exemplos, build das telas, sintaxe da função; a publicação no Supabase compilou (versão 1, ACTIVE).

### Portal do paciente por link seguro (migração 0028, aplicada)
- **`portal_links`** (token aleatório de 32 caracteres, vale 7 dias, revogável, conta acessos e tentativas). Botão
  **🔗 Portal do paciente** na ficha (`app/src/components/PortalLink.tsx`; médico, enfermagem, recepção, admin): gera o link
  (`portal_criar_link`, SECURITY DEFINER; exige data de nascimento cadastrada), copia a mensagem pronta para colar no
  WhatsApp, lista e cancela links.
- Página pública **`/portal/<token>`** (`app/src/pages/Portal.tsx`, letra grande, celular): o paciente digita a **data de
  nascimento**; `portal_abrir` (SECURITY DEFINER **executável por anônimo, de propósito**; 5 erros bloqueiam o link) devolve
  primeiro nome, próximas consultas e, dos últimos 180 dias e **só de atendimentos finalizados**: receitas de óculos, receitas
  **simples** (controle especial/antimicrobiano só em papel), atestados/declarações (sem termo de consentimento), pedidos
  ainda não feitos e laudos assinados — cada um com o código de autenticidade, se já foi impresso. Cada abertura vai para
  `log_auditoria` ("Paciente abriu o portal").
- Avisos do Supabase esperados: `portal_abrir` (anon) e `portal_criar_link` (authenticated).
- Envio automático do link por modelo do WhatsApp: não feito (depende de modelo aprovado na Meta; sessão do WhatsApp).
- Testes no banco local: sem data de nascimento não gera; faturamento não gera; atendimento aberto não aparece; só receita
  simples; data errada conta tentativa; 5 erros bloqueiam; anônimo não lê a tabela; aberturas auditadas. Tela conferida no
  celular (simulado).

### Pendências desta sessão (precisam da dona)
- **Aval para ligar o resumo por IA** (Cadastros → Inteligência artificial) e a chave `ANTHROPIC_API_KEY` no Supabase.
- **Receita digital com assinatura ICP-Brasil:** escolher o serviço (Memed, prescrição eletrônica do CFM ou outro) e os
  médicos terem certificado digital (e-CPF/e-CRM, A1 ou em nuvem).
- **Integração com os aparelhos:** lista de marca/modelo (autorrefrator, tonômetro, lensômetro, OCT, retinógrafo, campo visual,
  biômetro) e como cada um exporta (rede, pasta, DICOM, XML).
- **RNDS:** só se a clínica atender SUS; exige credenciamento no DATASUS e certificado digital da clínica.
- Acesso de teste (tela Equipe) para conferir tudo com login real.

---

## 15/11/2026 — Transcrição dos áudios do WhatsApp (Whisper / OpenAI) — migração 0040
- **Pedido da dona:** transcrever os áudios dos pacientes; escolheu o **Whisper da OpenAI** (ela já tem conta paga).
  Ciente de que o áudio é processado nos EUA (alternativa com dados no Brasil seria Amazon Transcribe).
- **Numeração 0040** (para não chocar com a sequência 0020+ de outra sessão).
- **Migração 0040 `whatsapp_transcricao_audio`** (aplicada): colunas `transcricao`, `transcricao_situacao`
  (pendente/feita/falhou), `transcricao_tentativas`, `transcricao_erro` em `whatsapp_mensagens`; liga/desliga
  `whatsapp_extrator_config.transcrever_audios` (tela do assistente). Gatilho `transcrever_audio`: áudio recebido →
  "pendente" + chamada (pg_net) à função Edge. Tarefa pg_cron `whatsapp-transcricao-reprocessar` (10 min) tenta de novo
  os pendentes (até 3 vezes). O extrator lê "[áudio transcrito] …" (mascarado) e espera até 45 min por áudio pendente.
- **Função Edge `whatsapp-transcrever`** (verify_jwt false; aceita a chave interna do banco ou login de recepção/admin):
  baixa da Meta e manda para `whisper-1` (pt, com vocabulário da clínica). Segredo: **`OPENAI_API_KEY`**.
- **Tela WhatsApp:** texto do áudio embaixo do balão (📝) e botão "Transcrever" para áudios antigos (recepção/admin).
- Testes: banco local (gatilho marca pendente, extrator espera e depois lê o texto mascarado); função publicada
  (chave errada → 401, sem chave da OpenAI → 503). **Falta o teste com áudio de verdade** (depende da Meta).

---

## 15/11/2026 — Regra da dona: nada de Claude pela API
- A dona decidiu: **todo uso do Claude sai do plano da conta** (sessões/tarefas agendadas), nunca pela API com chave.
  Registrado no topo do CLAUDE.md.
- A função Edge `whatsapp-extrator` (que usava `ANTHROPIC_API_KEY`) virou um aviso "desativada" (410); o código antigo
  está no histórico do git. O assistente continua pela tarefa agendada.
- Pendente para a sessão do prontuário: `prontuario-resumo` (migração 0027) também usa a API — está desligado; refazer
  pelo plano ou remover. Nenhuma chave da Anthropic foi cadastrada, então nada foi cobrado.
- A transcrição de áudios continua com o **Whisper da OpenAI** (pedido explícito da dona; não é Claude).

---

## 15/11/2026 (tarde) — Respostas da dona e rodada 3 (sessão "melhorias")
Respostas: (1) IA do prontuário **aprovada**; (2) receita digital pela **Memed** (alguns médicos têm certificado, outros não);
(3) integração com aparelhos fica para a **fase 2** — por ora, **tela de envio dos arquivos dos aparelhos**; (4) clínica
**não atende SUS** (RNDS fora); (5) autorizou a sessão a fazer o teste com login.

### IA do prontuário pelo plano do Claude (migração 0029, aplicada) — LIGADA em 15/11
- Por decisão anterior da dona (sem chave de API), o resumo deixou de ser "na hora" (função Edge) e passou a ser preparado
  por **tarefa agendada** (mesmo modelo do assistente do WhatsApp): `ia_resumo_preparar(n)` devolve instruções + histórico
  **mascarado no banco** (`interno.ia_historico`, `interno.ia_mascarar` = `interno.mascarar` da 0019 + nome do paciente/mãe)
  dos pacientes com consulta nas próximas ~36 h ou pedido do médico, cujo resumo falta/envelheceu (`interno.ia_ultima_mudanca`)
  ou tem mais de 30 dias; `ia_resumo_gravar` confere o formato e grava em **`ia_resumos`** (só médico/enfermagem leem) e audita;
  `ia_resumo_falhou`; `ia_resumo_concluir_rodada`. Só o dono do banco/chave de serviço executa (a tarefa usa o conector).
- **`ia_resumos_pedidos`**: médico/enfermagem pedem pelo botão (pedido próprio). A tela mostra o resumo guardado, a data e o
  botão "Pedir resumo atualizado". **Mudança em relação à 0027: o resumo agora fica guardado** (para estar pronto na consulta).
- **Correção da 0027:** a auditoria genérica quebrava o UPDATE de `ia_prontuario_config` (id = 1, não uuid) — o botão "Ligar"
  dava erro. Trocada por `auditoria_ligado` (registra liga/desliga). Ligada pela sessão com o aval da dona; auditoria conferida.
- A função Edge `prontuario-resumo` ficou publicada mas **não é usada** (serve se um dia houver chave de API).
- **Tarefa agendada:** texto em `docs/sistema/ia-resumo-tarefa-agendada.md`. **NÃO criada**: o sistema de segurança da sessão
  bloqueou `create_trigger`. Pendente da dona: criar a tarefa no claude.ai (ou autorizar a sessão) e ligar o conector Supabase.
- Testes no banco local: desligado não devolve nada; texto sem nome/CPF/telefone/cartão SUS; formato errado recusado; gravado
  sai da fila; pedido do médico volta para a fila; recepção não vê; equipe não chama as funções da tarefa; "Ligar" audita.

### Arquivos dos aparelhos — fase 1 (sem mudança no banco)
- Tela **📥 Arquivos dos aparelhos** (`/exames/importar`, médico e enfermagem; `app/src/pages/ImportarExames.tsx`): arrastar
  vários arquivos (PDF, imagem, DICOM, XML, até 50 MB); o sistema tenta adivinhar **paciente** pelo nº do prontuário no nome do
  arquivo (ex.: `1001_OCT_OD.pdf`) ou "mesmo paciente para todos", **exame** por palavras (OCT, campo, retino, topo, biometria,
  paqui, especular, angio…) e **olho** (OD/OE/RE/LE). A pessoa confere e envia.
- Arquivos do mesmo paciente + exame + olho viram **um** exame; se já houver exame aberto (aguardando/em execução) igual,
  completa esse. Ao final o exame vai para **aguardando laudo** (e para a conta, pela regra 0010).
- Integração direta com os aparelhos (pasta de rede/DICOM/XML automático) fica para a **fase 2** (decisão da dona).
- Teste no navegador (dados simulados): 4 arquivos → bloqueia o que falta paciente/exame; 3 enviados viram 2 exames de OCT
  (OD e OE) + 1 de campo visual, todos "aguardando laudo", com os 3 anexos.

### Receita digital Memed (migração 0030 + função Edge `memed-token`, aplicadas) — DESLIGADA até o teste real
- Seguindo a documentação pública da Memed (doc.memed.com.br; `docs.memed.com.br` é bloqueado pela rede da sessão):
  - **`profissionais_dados_pessoais`** (CPF, nascimento, sexo — exigidos pela Memed/RDC 1000/25). Fora de `profissionais` porque a
    equipe toda lê aquela tabela; aqui só admin e o próprio. Auditoria sem o CPF no texto. Campos na tela Equipe (só médicos).
  - **`memed_config`** (ligado, ambiente homologação/produção, CNES, nome do local) — tela **Cadastros → 💊 Receita digital
    (Memed)** (`app/src/pages/ConfigMemed.tsx`), com a lista de médicos e o que falta no cadastro de cada um.
  - **`memed_prescricoes`**: cópia de cada receita emitida (evento `prescricaoImpressa`) e marcação de excluída
    (`prescricaoExcluida`) — exigência da Memed para liberar a produção. Médico registra em nome próprio; só muda `excluida`.
  - Função **`memed-token`** (verify_jwt; código em `supabase/functions/memed-token/`): com o login do médico, consulta/cadastra o
    prescritor na Memed (`external_id = consumed-<id do profissional>`) e devolve o token + endereço do script. Chaves: segredos
    `MEMED_API_KEY`/`MEMED_SECRET_KEY`; em homologação usa o par **público** de testes que a Memed publica.
  - Tela: aba **Receitas** do atendimento → **"Prescrever na Memed"** (`app/src/components/pep/Memed.tsx`): script carregado uma vez
    (id fixo), eventos registrados uma vez em `core:moduleInit`, `setWorkplace` (nome/CNES/endereço), `setPaciente` (dados do
    paciente; `idExterno` = id do paciente) e `module.show`. A receita interna do sistema continua (médicos sem certificado).
- **Não testado com a Memed de verdade:** o ambiente de homologação da Memed fica fora do ar à noite e nos fins de semana (15/11 foi
  domingo — respondeu 503). Testado com uma Memed simulada no navegador (comandos enviados e receita guardada).
- **Para usar:** (1) admin preenche CPF/nascimento dos médicos na Equipe; (2) liga em Receita digital (ambiente de teste) e testa
  num dia útil; (3) dona pede as chaves de produção à Memed (formulário "Autorização para Credenciais de Produção"), cadastra
  `MEMED_API_KEY`/`MEMED_SECRET_KEY` no Supabase, informa o CNES e troca para Produção.

### Teste com login real no sistema publicado (15/11/2026, autorizado pela dona: "pode fazer")
- Contas de teste: os perfis TESTE (médico, recepção) já existentes foram reativados e foi criado "TESTE Enfermagem (apagar)";
  logins criados direto em `auth.users`/`auth.identities` com senha aleatória guardada só na sessão (o banco recebeu só o hash).
  Roteiro Playwright contra https://sistema-production-addc59db.up.railway.app com o Supabase real:
  recepção (paciente, agenda, chegada, 💧 dilatação pela tela, 📢 chamada + TV, link do portal) → enfermagem (abriu pela fila,
  pré-consulta) → médico (protocolo de glaucoma, desenho, evolução + acompanhamento, diagnóstico, receita, óculos, impressão com
  QR, folha de colírios, pedido de resumo IA, finalizar, páginas novas) → anônimo (conferência do QR "autêntico", portal com
  data de nascimento). **Nenhum erro de página nem de permissão (4xx) nas telas.** As 2 falhas do roteiro eram do próprio
  roteiro (nome esperado na TV e leitura antecipada da janela do protocolo).
- Achado e corrigido: nomes longos passavam da borda do cartão na Recepção.
- **Limpeza pendente:** a limpeza (apagar os 3 pacientes "TESTE Paciente Silva (apagar)" e o que eles geraram, apagar os logins
  de teste e desativar os perfis TESTE) ficou esperando uma confirmação do Supabase que não foi respondida — **não foi feita**.
  Enquanto isso, os 3 logins de teste (`teste.*@example.com`) continuam ativos. Fazer a limpeza assim que a dona confirmar.

---

## 15/11/2026 — Telefone dentro do sistema (ramais pelo navegador) — migrações 0050 e 0051
### Pedido da dona
Hoje as atendentes usam o Talk Logos (Micrologos) com linhas da Telecall: na mesma tela falam pelo WhatsApp e atendem o
telefone, e transferem para outro ramal. São **5 atendentes**. Ela quer isso no sistema novo. Depois de comparar
Api4Com, Nvoip e Twilio, escolheu **testar com a Api4Com** (PABX em nuvem brasileiro, com ramal pelo navegador — WebRTC).
**Sem portabilidade por enquanto**: teste com número novo; a Telecall continua funcionando.
### Como funciona
- O navegador da atendente vira um **ramal SIP** (biblioteca **JsSIP 3.10.1**, conexão WSS com a central). Serve para
  qualquer central que aceite ramal pelo navegador (Api4Com, Nvoip, Telecall se oferecer) — nada é preso à Api4Com.
- **Migração 0050 `telefonia`** (aplicada): `telefonia_config` (liga/desliga, empresa, endereço WSS, domínio SIP; só admin
  altera; auditado), `telefonia_ramais` (ramal, nome, quem usa — 1 ramal por pessoa; equipe lê para transferir; só admin
  cria/altera; auditado), **`interno.telefonia_senhas`** (senha SIP fora da API; a admin grava por
  `telefonia_definir_senha` e nunca vê de volta; **só a própria pessoa recebe a sua** por `telefonia_minhas_credenciais`),
  `ligacoes` (histórico; toda a equipe lê — mesma decisão do WhatsApp; ninguém grava direto, só pelas funções).
  Funções: `telefonia_inicio` (a mesma chamada tocando em vários ramais vira UMA linha), `telefonia_atendida` (só a
  primeira que atende fica com a ligação), `telefonia_fim` (entrada que ninguém atendeu → **perdida**), `telefonia_anotar`,
  `telefonia_marcar_retornada`, `telefonia_quem_ligou` (pacientes do número + próxima consulta; inclui telefone do
  responsável). Ligar para um número que tinha perdida nos últimos 30 dias marca a perdida como **retornada**.
  pg_cron `telefonia-limpar-presas` (10 min) fecha ligações que ficaram "tocando" porque o navegador fechou.
- **Migração 0051 `telefonia_mesmo_numero`** (aplicada): compara pela chave do telefone (com/sem 55) para não duplicar.
- Advisors: só os avisos esperados de SECURITY DEFINER nas funções `telefonia_*` (cada uma confere ramal/admin).
### Telas
- **Telefone flutuante** no canto de todas as telas (só para quem tem ramal): Disponível / Pausa (não recebe ligações) /
  discador. Chamada chegando: cartão com **nome do paciente, prontuário, idade e próxima consulta**, botões Atender /
  Recusar, Abrir ficha, 💬 WhatsApp; toque e aviso do computador. Em ligação: cronômetro, Mudo, Espera, **Transferir**
  (lista de ramais dos colegas ou número digitado; transferência "cega" — sai da ligação quando a central aceita),
  Teclado (para URA). Depois: anotação rápida. Se já está em ligação, nova chamada recebe "ocupado" (a fila passa adiante).
- **☎️ Ligações** (menu): hoje / perdidas sem retorno / 7 / 30 dias, ao vivo; "Ligar de volta" e "Resolvida".
- **Cadastros → ☎️ Telefone** (admin): liga/desliga, endereço WSS, domínio SIP, ramais e senhas, passo a passo.
- Botão **📞 Ligar** na conversa do WhatsApp, na ficha do paciente e na Busca ativa (só aparece com o telefone conectado).
- Código: `app/src/lib/telefone.tsx` (conexão e chamadas), `app/src/components/Telefone.tsx`, `app/src/pages/Ligacoes.tsx`,
  `app/src/pages/ConfigTelefone.tsx`.
### Testes
- Banco real, dentro de transação desfeita: admin configura e grava senha; recepção recebe a própria senha mas não lê a
  tabela de senhas nem grava senha de outro; ninguém insere em `ligacoes` direto; mesma chamada em 2 ramais = 1 linha;
  segunda atendente não "rouba" a ligação; transferência e anotação gravadas; perdida → retornada; médico sem ramal não
  liga e não altera a configuração; anônimo bloqueado.
- Navegador (Playwright) com **central SIP simulada** + Supabase simulado: registro, chamada chegando com o nome da
  paciente, atender com **áudio conectado de verdade (WebRTC)**, espera, mudo, transferir (REFER para 1002), anotação,
  paciente desiste (perdida), ligação feita pelo discador, desligar, pausa; telas de configuração e histórico; celular.
  16/16 ok, sem erros de página.
- **Ainda sem teste com a Api4Com de verdade** (falta a conta). Pontos a conferir no teste real: endereço WSS/domínio,
  formato do número para discar (hoje: só dígitos, sem 55 — ex.: 21999998888), transferência pela central da Api4Com,
  fila tocando para as 5 atendentes.
### Para ligar (falta a dona)
1. Criar a conta de teste na Api4Com e os ramais (um por atendente).
2. Pedir à Api4Com o endereço **WSS** e o **domínio SIP** para ramal pelo navegador.
3. Admin: Cadastros → Telefone → preencher, cadastrar ramais (quem usa + senha) → **Ligar**.
4. Cada atendente usa fone com microfone; na primeira ligação o navegador pede o microfone → Permitir.

## 15/11/2026 (noite) — Telefone: primeiro teste real com a Api4Com
- **Conta Api4Com:** domínio SIP `consumed0303.api4com.com`, WSS `wss://consumed0303.api4com.com:6443` (porta 6443,
  conforme developers.api4com.com). 1 ramal (**1000**), ligado à admin (Ana Bertolin). Configuração e senha gravadas no
  banco (`telefonia_config`, `telefonia_ramais`, `interno.telefonia_senhas`). Saldo de teste: R$ 5.
- **Número que aparece para quem recebe (BINA da conta): (21) 96476-0292.**
- **Correção (PR #37):** a central (plataforma Kazoo) recusava toda ligação discada como `21999998888`. Agora o sistema
  disca `+55 + DDD + número` (`destinoNaCentral` em `app/src/lib/telefone.tsx`); ramais e 0800 vão como estão. Quando a
  central recusa, a tela mostra o motivo.
- **Resultado:** ligação pelo sistema para um celular completou, com áudio nos dois sentidos. ✅ Para um número
  específico (celular do Gelson) a central responde "Unavailable" — provável bloqueio da operadora/aparelho de destino,
  não do sistema. Ainda a testar: ligação **chegando** no sistema (ligar para 21 96476-0292) e transferência.
- **Acesso da sessão à Api4Com:** o token fica salvo no ambiente de nuvem "secreto" (enviado no cabeçalho
  `X-Access-Token`, que a API aceita). A listagem de chamadas (`GET /calls`) não aceitou esse acesso.
- Pendente: um ramal por atendente (5) — aumenta a mensalidade da Api4Com, decidir com a dona; linhas "não atendeu"
  dos testes em `ligacoes` (apagar só com ok da dona).

## 16/11/2026 — Telefone: trava contra rajadas de ligações
- **Por quê:** no teste de 15/11 vários cliques seguidos em "Ligar" (12 tentativas em 6 s para o mesmo número) e a BINA
  variável da Api4Com fizeram as operadoras barrarem as ligações ("número indisponível").
- **O que mudou** (`app/src/lib/telefone.tsx`): no mínimo **3 s** entre uma tentativa e outra (era 10 s; a dona pediu 3 s em 16/11), e no máximo **3 tentativas
  para o mesmo número em 10 minutos**. A tela explica o motivo e quanto falta; o aviso aparece mesmo com o telefone
  fechado (quando se liga pelo botão do WhatsApp/ficha). Vale por aba do navegador (não é trava no banco).
- Testado no navegador com a central simulada: o segundo clique logo em seguida é barrado e só 1 ligação sai.
- Continua pendente (depende da Api4Com/dona): **número fixo próprio (DDD 21)** para sair sempre com o mesmo número e
  receber ligações no ramal (hoje o 21 96476-0292 não está apontado para o ramal 1000, por isso a entrada não chega);
  trocar a senha do ramal 1000 (apareceu no registro de outra sessão) e atualizar em Cadastros → Telefone.

---

## 16/11/2026 — Repasse médico v1 (área do Luciano) — migração 0060
### Pedido da dona
O Luciano (administrador da clínica) calcula à mão quanto cada médico recebe por cirurgia. A dona levantou as regras
na aba "financeiro do Luciano" e pediu a 1ª versão no sistema ("versão mais simples", cirurgia particular — ex.: Dra. Gisele).
Convênios, lente/material e regras por médico ficam para depois.
### Regras (confirmadas pela dona em 16/11)
1. **Imposto** = 15% do **valor total** da cirurgia.
2. **Centro cirúrgico** = 20% do que sobra (total − imposto).
3. **Taxa interna** = só no **crédito parcelado (2x a 12x)**: taxa do cartão + antecipação (tabela abaixo) sobre o valor
   que **entrou** em cada parcela, **cortando os centavos**. É regra interna escolhida (a clínica não antecipa; a taxa forma
   caixa) — **não questionar de novo**. Dinheiro, PIX, débito e crédito 1x: sem taxa interna.
4. **Médico** = o que realmente entrou − imposto − centro cirúrgico − taxa interna. No débito/crédito a taxa da maquininha
   fica com o médico (dona: "opção B").
- Imposto e centro cirúrgico divididos igualmente entre as parcelas (sobra de centavos na **última** — sugestão, a confirmar).
  O médico recebe **conforme cada parcela entra**. "2 dias úteis" da tabela da maquininha: desconsiderar.
- Tabela (cartão + antecipação = total): 2x 2,34+1,61=3,95 · 3x 4,50 · 4x 5,05 · 5x 5,60 · 6x 2,34+3,81=6,15 ·
  7x 2,61+4,36=6,97 · 8x 7,52 · 9x 8,07 · 10x 8,62 · 11x 9,17 · 12x 2,61+7,11=9,72.
### O que entrou
- **Migração 0060 `repasse_medico`** (aplicada; numerada 0060 porque a 0052 é de outra sessão): `repasse_config` (15%, 20%,
  cortar/arredondar centavos), `repasse_taxas_cartao` (2x–12x, editável), `repasses` (um por cirurgia; guarda **cópia** das
  porcentagens usadas — mudar a tabela não altera repasse já lançado; ligação opcional a uma conta **particular**) e
  `repasse_parcelas` (criadas pelo banco; o Luciano só digita o valor que entrou e marca "pago ao médico").
  Todo o cálculo é feito no banco (gatilhos); a tela só mostra prévia. Travas: valor/forma/parcelas/médico não mudam depois de
  lançados (cancelar com motivo e lançar de novo); parcela paga ao médico não muda o valor; repasse com parcela paga não
  cancela; cancelado não reabre; médico negativo é recusado; ninguém apaga. Acesso: só **faturamento e admin** (médico,
  recepção, enfermagem e anônimo não veem). Auditoria em tudo.
- **Telas:** menu **💰 Repasse médico** (`app/src/pages/Repasse.tsx`, cálculo da prévia em `app/src/lib/repasse.ts`):
  Lançamentos (lista + "Novo repasse" com prévia do cálculo), detalhe com parcelas (digitar o que entrou, previsão das
  próximas, "Marcar pago hoje"), **Relatório por médico** (período por data de entrada; já pago / a pagar; planilha e
  impressão) e **Regras e taxas** (porcentagens e tabela editáveis). Na conta particular paga do Faturamento, botão
  **"💰 Calcular repasse ao médico"** (puxa médico, paciente, valor, forma e parcelas).
### Testes
- Banco local (Postgres 16 + Supabase simulado): PIX R$ 4.820 → 723,00 / 819,40 / **3.277,60** ✔; débito entrou 4.770 →
  **3.227,60** ✔; 12x R$ 5.220 → 65,25 / 73,95 por parcela, parcelas 2–12 (entrou 423,74) → taxa 41,18 → **243,36** ✔
  (igual ao Luciano); 7x divide com sobra na última; todas as travas e acessos acima.
- Banco real: mesmo exemplo de 12x dentro de transação desfeita (nada gravado) — mesmo resultado. Advisors: nada novo
  (só "índice não usado" das tabelas novas, vazias).
- Telas no navegador com dados simulados (sem login real): lançamento, prévia, parcelas, relatório, regras, celular; sem erros.
### Pendências (perguntar à dona/Luciano)
- **1ª parcela do exemplo:** entrou 423,66 → 9,72% = 41,1797 → cortando dá **41,17** → médica **243,29**. A aba DÚVIDAS
  esperava 243,28 (taxa 41,18). Nenhuma regra única dá 41,18 nas duas parcelas (arredondando, a 1ª dá 41,18 mas as outras
  dariam 41,19 → 243,35). Confirmar com o Luciano quanto ele pagou na 1ª parcela.
- Sobra de centavos na última parcela? Cortar sempre os centavos da taxa? (a tela já permite trocar para arredondar)
- 15%/20% mudam por médico ou procedimento? Lente/material na catarata? Refrativa AO = 1 ou 2 cirurgias? Convênios.
- O Luciano precisa de login com a função **Faturamento** (tela Equipe). Rodar em **paralelo** com o cálculo à mão por
  2–3 meses; mostrar as regras de imposto ao contador.

### 16/11 (noite) — Repasse: taxa interna no débito e no crédito 1x (migração 0061)
- **Decisão da dona:** débito e crédito à vista (1x) passam a descontar **2,34%** (só a taxa do cartão, sem antecipação).
  Mesma forma do parcelado: sobre o valor que **entrou**, centavos cortados. Dinheiro e PIX continuam sem taxa interna.
- `repasse_taxas_cartao` ganhou a coluna `forma` (crédito/débito), aceita 1 parcela (débito só 1x); linhas novas
  crédito 1x e débito 1x = 2,34 + 0. `interno.tg_repasse_regras` busca a taxa por forma + parcelas.
- Exemplo: débito R$ 4.820,00, entrou R$ 4.770,00 → imposto 723,00, centro 819,40, taxa 2,34% de 4.770 = 111,618 → 111,61
  → médico **3.115,99** (antes da mudança: 3.227,60). Testado no banco local e no real (transação desfeita).
- O repasse nº 2 já lançado (12x, 9,72%) não muda. Tela "Regras e taxas" mostra Débito e Crédito 1x na tabela.

### 16/11 (noite) — Repasse: decisões e próximos passos combinados com a dona
- **A regra atual vale só para cirurgia REFRATIVA**, que não é feita na clínica (o paciente paga a taxa de sala direto ao
  centro cirúrgico de fora). Os "20%" não são de centro cirúrgico: são a parte da **clínica (empresa) sobre os honorários**;
  os 80% restantes são os **honorários do médico**.
- **Demais cirurgias (feitas na clínica):** vão precisar de **taxa de sala por procedimento** e de **insumos** (ex.: lente
  intraocular). A dona vai juntar esses dados. Ainda não implementar.
- **Regra alternativa avaliada e aprovada na lógica, mas NÃO aplicar por enquanto (decisão da dona):** imposto (15%) e taxa do
  cartão (cartão + antecipação; 1x/débito só cartão) ambos sobre o **valor total**; o que sobra: 20% clínica, 80% médico.
  Evita cobrar a taxa da maquininha duas vezes do médico. Exemplo 12x R$ 5.220: imposto 783,00, taxa 507,38, sobra 3.929,62,
  clínica 785,92, médico 3.143,70 (≈ R$ 261,97/mês) — hoje 2.920,24. Débito/1x R$ 4.820: médico 3.187,38 (hoje 3.115,99).
- Confirmado: no parcelado o médico recebe **conforme cada parcela cai**; continuar **cortando os centavos**. O que importa no
  fim é **quanto se transfere ao médico a cada mês**.
- O repasse nº 2 (12x de R$ 5.220) no banco é **de teste**.

### 16/11 (noite) — Repasse: REGRA NOVA aplicada (migração 0062) + nome "Clínica"
- **Dona autorizou a regra alternativa.** Vale para a **refrativa**: imposto (15%) e taxa do cartão (tabela; débito/1x 2,34%;
  parcelado cartão + antecipação) **sobre o valor total da venda**, centavos da taxa cortados. Sobra = **honorários**:
  **clínica 20%** (arredondado), **médico o restante**. Cada parte é dividida igualmente pelas parcelas (sobra de centavos
  na última); o médico recebe quando a parcela **entra** ("Entrou hoje"); o valor depositado pela maquininha não entra mais
  no cálculo (coluna `valor_recebido` só informativa).
- Banco: `repasses.taxa_interna_total`, `repasses.medico_total`, `repasse_parcelas.valor`; gatilhos refeitos; todas as partes
  da parcela são fixas desde o lançamento; "pago ao médico" exige "entrou". As colunas `centro_cirurgico_*` continuam com esse
  nome, mas significam **parte da clínica sobre os honorários**; na tela aparecem como **"Clínica (20% dos honorários)"**.
- Conferido (local e real, transação desfeita): PIX 4.820 → médico 3.277,60; débito 4.820 → taxa 112,78, clínica 796,84,
  médico 3.187,38; 12x 5.220 → imposto 783,00, taxa 507,38, clínica 785,92, médico 3.143,70 (261,97/mês; última 262,03).
- Repasse de teste nº 2 **cancelado** a pedido da dona (motivo registrado).

### 16/11 (noite) — Repasse: correção e próximos assuntos
- **Correção (PR #45):** a lista do Repasse dava erro "more than one relationship… 'repasses' and 'profissionais'"
  (`profissional_id` e `criado_por` apontam para `profissionais`). As consultas usam
  `profissionais!repasses_profissional_id_fkey(nome)`. Confirmado pela dona: a tela abriu sem erro.
  Lição: o teste com dados simulados não pega esse tipo de erro; ao embutir `profissionais`, sempre indicar a ligação.
- **Lentes intraoculares (futuro):** vendidas como particular (PIX ou cartão até 12x), com repasse ao médico que operou.
  A dona vai mandar o cadastro de tipos e valores. A clínica já emite NF-e de mercadoria; hoje o Luciano emite a nota e
  lança no **Invistto** (sistema de gestão de ótica) para o estoque. Ideia: botão "Emitir nota" integrado, pela API do
  Invistto (se existir; perguntar ao suporte) ou por um serviço de NF-e próprio. A dona vai levantar como o Luciano faz hoje.
- Melhoria oferecida e ainda sem resposta: no relatório por médico, mostrar o **previsto para o mês** (parcelas que vão cair).

### 16/11 (noite) — Médicos da clínica cadastrados na Equipe (pedido da dona)
- Os 7 médicos da página **Equipe** do site (conferida também no site original no ar) foram cadastrados em `profissionais`
  (função médico, CRM-RJ, especialidade resumida, CBO 225265): Gelson Moura Brasil (52.86360-2), Gisele Moura Brasil
  (52.87379-9), Max Oliveira Guimarães (52.86386-6), Luiza Morone Pereira (52.91775-3), Matheus de Souza Cerveira Pereira
  (52.0127737-5), Renato Sztern Queiroz (52.92743-0), Pedro Boni Gonçalves (52.86698-9). Nome sem "Dr./Dra." (padrão da tabela).
- Ficaram **inativos** porque o site não tem e-mail e a regra do banco exige e-mail para quem está ativo (é o login).
  Para ligar cada um: tela Equipe → editar → pôr o e-mail → marcar "Ativo". Só então aparece na Agenda.
- Faltam (não estão no site): e-mails, RQE e demais documentos. Funcionários não médicos não aparecem no site.

### 16/11 (noite) — Login por nome de usuário (migração 0063, decisão da dona)
- **Médicos e funcionários entram com USUÁRIO e senha; a administração (dona) continua com e-mail.**
- Como funciona: coluna `profissionais.usuario` (minúsculas, sem acento, 3–40 caracteres; letras, números, `.`, `-`, `_`).
  O gatilho `profissional_usuario` grava em `email` o e-mail interno `<usuario>@equipe.consumedolhos.com.br`
  (subdomínio sem caixa de correio; nada é enviado — a função `equipe-acesso` cria a conta já confirmada).
  Por isso RLS, `somente_equipe`, `equipe-acesso` e `auth.tsx` continuam sem mudança.
- Tela de entrada: campo "Usuário (ou e-mail da administração)"; sem "@" o sistema completa o e-mail interno.
- Tela Equipe: "Entra no sistema com: Usuário e senha / E-mail e senha"; sugere o usuário (primeiro nome + último
  sobrenome); coluna "Login" mostra 👤 usuário. Trocar o usuário de quem já tem acesso exige criar a senha de novo (🔑).
- Sem e-mail não há "esqueci minha senha" sozinho: a admin gera nova senha temporária (já era o fluxo).
- Os 7 médicos foram **ativados** com usuário: gelson.brasil, gisele.brasil, max.guimaraes, luiza.pereira,
  matheus.pereira, renato.queiroz, pedro.goncalves. As senhas ainda não foram criadas (a dona cria pelo botão 🔑).

### 16/11 (noite) — Cadastros de teste apagados (pedido da dona)
- Apagados os 4 perfis "TESTE … (apagar)" da Equipe (médico, enfermagem, recepção, faturamento) e seus 3 logins,
  os 3 pacientes "TESTE Paciente Silva (apagar)" e tudo ligado a eles: 2 agendamentos, 1 atendimento (com triagem,
  receitas, exame, diagnóstico, óculos, desenho, 3 pedidos de exame), 2 contas, seguimento, link do portal, documento
  verificável e os repasses de teste nº 2 e nº 7 (22 parcelas). Feito numa só transação, com conferência de que não
  sobrou ligação quebrada. Mantidos: o exame "Teste ortóptico" (exame real) e o "Ramal 1000 (Ana – teste)" (ramal real da Api4Com).

### 17/11 — Dados oficiais dos médicos e CNPJ (planilha "Corpo clínico atualizado" enviada pela dona)
- Os 7 médicos receberam **RQE**, **CPF** e **data de nascimento** (CPF e nascimento em `profissionais_dados_pessoais`,
  que só a administração e o próprio médico veem). Nomes completos corrigidos: **Gelson Ribeiro Moura Brasil** e
  **Gisele Ribeiro Moura Brasil**. Um CPF veio na planilha sem o zero inicial (10 dígitos); gravado com o zero
  (dígitos verificadores conferem). Todos os CPFs validados. Sexo (usado pela Memed) não veio na planilha: ficou em branco.
- Clínica: **CNPJ 05.894.660/0001-87**, razão social **CONSUMED CONSULTÓRIOS MÉDICOS LTDA** em `app/src/lib/marca.ts`
  (o CNPJ passa a sair nos documentos impressos e nas guias de faturamento).

---

## 16/11/2026 — WhatsApp da Orientação Cirúrgica (segundo número oficial)
### Pedido da dona
A orientação cirúrgica (Alessandra) usa há anos um número próprio de WhatsApp, fora da API oficial, para pacientes
com complicação ou dúvida depois da cirurgia. Pedido: atender esse número pelo sistema, numa aba própria, no login dela.
### Decisões da dona (16/11)
- **Só pelo sistema:** o número entra na mesma conta oficial da Meta da clínica, direto (sem intermediário). Ele sai do
  aplicativo do celular. (Usar celular + sistema ao mesmo tempo — "coexistência" — só existe via parceiro pago da Meta.)
- **Quem vê:** quem atende a orientação, médicos e administração. Recepção, enfermagem (sem a marcação) e faturamento
  NÃO veem. **Quem responde:** só quem atende a orientação.
### O que entrou
- **Migração 0052 `whatsapp_orientacao_cirurgica`** (aplicada): `profissionais.orientacao_cirurgica` (marcação no
  cadastro da equipe; só admin altera) e `interno.atende_orientacao()`; `whatsapp_conversas.setor`
  ('clinica' | 'orientacao'), único agora por (setor, telefone) — o mesmo paciente pode ter conversa nos dois números;
  RLS de conversas/mensagens por setor; modelo novo `retomar_orientacao` (nasce desligado); `whatsapp_conversa` e
  `whatsapp_receber` ganharam `p_setor` (padrão 'clinica'); botões do lembrete e "SAIR" só valem no número da clínica;
  assistente de IA (extrator) só analisa conversas da clínica.
- **Funções Edge:** `whatsapp-webhook` v3 (separa pelo `phone_number_id`: `WHATSAPP_PHONE_NUMBER_ID` → clínica,
  `WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID` → orientação; número desconhecido é ignorado), `whatsapp-enviar` v4 (envia pelo
  número do setor da conversa; confere quem vê/responde; `estado` devolve `orientacao_configurado`; na orientação o
  "SAIR" da clínica não bloqueia o "chamar de novo"), `whatsapp-transcrever` v3 (quem atende a orientação pede
  transcrição dos áudios dela).
- **Telas:** menu **🩹 Orientação cirúrgica** (`/orientacao-cirurgica`, mesma tela do WhatsApp com `setor="orientacao"`:
  sem lembretes; Modelos mostra só o da orientação); contador/som de não lidas só para quem atende a orientação;
  Equipe ganhou a caixa "Atende a Orientação cirúrgica"; ficha do paciente ganhou o botão 🩹 para quem atende.
### Testes
- Banco real, numa transação desfeita: mesmo telefone vira 2 conversas (uma por número); admin e médico veem e não
  alteram a orientação; quem tem a marcação vê e altera; recepção e faturamento não veem (nem as mensagens);
  "SAIR" no número da orientação não muda a autorização. Advisors: nada novo.
- `deno check` nas 3 funções; `npm run build`; tela conferida no navegador com dados simulados (computador e celular).
- **Ainda sem teste com a Meta de verdade** (falta a conta e o número).
### Para ligar (dona)
1. Fazer backup das conversas do celular da Alessandra (Exportar conversa, se quiser guardar alguma).
2. Na Meta (WhatsApp Manager da mesma conta da clínica) → **Adicionar número de telefone** → número da Alessandra
   (nome de exibição, ex.: "Orientação Cirúrgica Consumed"). A Meta pede para **apagar a conta do WhatsApp desse número
   no celular** antes; depois confirma por SMS/ligação.
3. Copiar a "Identificação do número de telefone" e cadastrar no Supabase como segredo
   `WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID` (o token, o webhook e a chave secreta são os mesmos da clínica).
4. Cadastrar na Meta o modelo `retomar_orientacao` (Utilidade, pt_BR, texto na tela Modelos da aba) e, aprovado, ligar.
5. Cadastrar a Alessandra em Cadastros → Equipe (com e-mail), marcar "Atende a Orientação cirúrgica" e gerar a senha.
### Pendências / ideias
- Mostrar na ficha ao lado da conversa a última cirurgia do paciente (data, olho, procedimento).
- Respostas prontas para as dúvidas mais comuns do pós-operatório.

---

## 17/11/2026 — WhatsApp: arquivos guardados, pesquisa nas mensagens e resposta fora do horário
### Pedido da dona
Decisão: número da Alessandra pela **opção 1 (direto com a Meta, sem parceira, só pelo sistema)**. Foram descartadas a
ligação não oficial (QR Code / Evolution API) e a parceira paga (ex.: 360dialog, ~€ 49/mês). Exigências: tudo guardado,
áudios para ouvir, e **pesquisar o que foi dito** ("o paciente fala uma coisa com a Alessandra e outra na sala do
médico"). Horário da Alessandra: seg–sex 8h–17h, sáb 8h–12h.
### O que entrou
- **Migração 0053 `whatsapp_arquivo_busca_ausencia`** (aplicada) + **0054** (correção: resposta automática uma vez só):
  - `whatsapp_mensagens.midia_caminho` + bucket privado **`whatsapp-midia`** (100 MB/arquivo, sem acesso direto da equipe).
  - `whatsapp_buscar(setor, termo, de, ate, limite)`: procura no texto e na transcrição dos áudios, sem acento/maiúscula
    (extensão `unaccent`), respeitando o RLS das conversas (security invoker).
  - `whatsapp_ausencia` (uma linha por número; **desligada**; texto e horários editáveis; auditada) +
    `whatsapp_conversas.ausencia_enviada_em` + `whatsapp_ausencia_texto(conversa)` (só chave de serviço; no máximo 1 a cada 8 h).
- **whatsapp-webhook v4:** depois de gravar, em segundo plano (`EdgeRuntime.waitUntil`), copia foto/áudio/vídeo/documento
  para o Storage e manda a resposta automática fora do horário (gravada como enviada, `enviado_por` nulo).
- **whatsapp-enviar v5:** ação `midia` entrega a cópia guardada; se não houver, busca na Meta e guarda.
- **Tela (clínica e orientação):** botões **🔎 Pesquisar mensagens** (resultado com trecho marcado; clicar abre a conversa
  e destaca a mensagem) e **🌙 Fora do horário** (quem atende o número ou admin). Balão "Resposta automática".
### Testes
- Banco real, transação desfeita: pesquisa acha texto e transcrição sem acento ("tampao" → "tampão"); médicos e admin
  acham, faturamento não; resposta fora do horário sai 1 vez e não repete; número da clínica (desligado) não responde.
- `deno check`, `npm run build`, telas no navegador com dados simulados. Ainda sem Meta de verdade.
### Observações
- Mensagens e arquivos **não são apagados** pelo sistema (prontuário/LGPD: guarda longa).
- A transcrição automática dos áudios depende da chave da OpenAI (`OPENAI_API_KEY`) já prevista em 15/11.
- "Ouvir a ligação" (telefone): pergunta em aberto para a dona — ligação pelo ramal do sistema (Api4Com) pode ser gravada
  pela central; ligação de voz pelo WhatsApp oficial não é gravada pela Meta.
- Texto da resposta automática nasce como sugestão; a dona/Alessandra aprovam e ligam na tela.

---

## 18/11/2026 — Importar conversas antigas do WhatsApp do celular
### Por quê
Para levar o número atual da clínica para a API oficial da Meta, a conta do WhatsApp do celular precisa ser
apagada, e as conversas somem do aparelho. A dona pediu para salvar esse histórico no sistema.
### O que entrou
- **Migração 0064 `whatsapp_importar_conversas`** (aplicada): `whatsapp_mensagens.importada`; função
  `whatsapp_importar(setor, telefone, nome, paciente, mensagens jsonb)` (SECURITY DEFINER, confere a permissão logo
  no início: admin; recepção no número da clínica; quem atende a Orientação Cirúrgica no dela); até 2.000 mensagens
  por chamada; não duplica (`wa_id = 'importado:' + código`); não mexe em não lidas nem na janela de 24 h; avança o
  "lido até" do **Assistente** (ele não marca consultas de conversas antigas, só usa como contexto); anexos marcados
  `midia_id = 'importado'` depois da gravação (a transcrição automática não dispara); uma linha `IMPORTACAO` na
  auditoria. Política de Storage: envio só para `whatsapp-midia/<setor>/importado/` de quem pode importar.
- **Tela `/whatsapp/importar`** (botão "📥 Importar conversas antigas" no WhatsApp): lê o .zip (iPhone, ou Android
  com mídia) ou o .txt + anexos soltos (Android), em português ou inglês (`app/src/lib/whatsappExport.ts`); descobre
  sozinha qual nome é a clínica (aparece em todas as conversas); pede o número do paciente (ou pega da ficha ao
  ligar a conversa a um paciente); envia os anexos e grava em lotes de 1.000.
- **Conversa:** passa a carregar as **500 mensagens mais recentes** (antes eram as 500 mais antigas; com histórico
  importado, as novas ficariam escondidas). Mensagem importada aparece com "📥 Do celular" e data completa.
- Passo a passo da Meta (doc da dona) ganhou a seção "Antes de apagar o WhatsApp do celular: salve as conversas".
### Testes
- Banco real numa transação desfeita: 3 de 4 mensagens entram (a 4ª, com anexo apontando para o outro número, é
  recusada), reimportar não duplica, áudio sem transcrição, não lidas 0, Assistente com "lido até" atualizado, auditoria.
- Leitor de arquivos com exemplos Android e iPhone (várias linhas, anexos, mídia oculta, avisos de criptografia).
- Tela no navegador com o banco simulado: 2 conversas (zip do iPhone + txt e áudio do Android), escolha da clínica,
  ligação a paciente, envio dos anexos e gravação conferidos. Sem teste com login real.

---

## 18/11/2026 — WhatsApp da Orientação Cirúrgica: conta nova na Meta e Política de Privacidade
- **Meta (feito pela dona com o Claude no Chrome):** Facebook novo da dona; portfólio NOVO "Consumed Clínica de Olhos"
  (separado do da Micrologos/Talklogos); app "Orientação Cirúrgica Consumed" (ID 1112162168353372, ainda NÃO publicado);
  usuário do sistema "sistema-consumed" com token permanente; webhook verificado e campo `messages` assinado.
  A Meta criou uma "Test WhatsApp Account" com número de teste (ignorado pelo sistema — webhook v5).
- **Segredos no Supabase (dona):** `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (conferido: a função
  recusa aviso sem assinatura e a Meta validou o endereço). Falta `WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID` (depois do número).
  Obs.: a ferramenta `create_edge_function_secret` está pausada pelo Supabase; segredos só pelo painel.
- **Login da Alessandra:** `profissionais` Alessandra Galter, usuário `alessandra.galter`, função recepção, marcada
  "atende a orientação". A senha temporária é gerada pela dona em Cadastros → Equipe.
- **Política de Privacidade** pública em `/privacidade` (sem login; `app/src/pages/Privacidade.tsx`), exigida pela Meta
  para publicar o app. Texto preparado pelo Claude, **aguardando revisão da dona**. Falta definir o e-mail do canal de dados
  (constante `CANAL.email`).
- Pendente: número da Claro (apagar WhatsApp Business do celular da Alessandra → adicionar na Meta → ID no Supabase),
  publicar o app (política + ícone + categoria), modelo `retomar_orientacao` na Meta.

### 19/11/2026 — Política de Privacidade aprovada; chip novo da Orientação Cirúrgica
- Dona **aprovou** o texto de `/privacidade` sem mudanças (sem e-mail de contato e sem encarregado nomeado por ora;
  canal = telefone e recepção).
- Número da Orientação Cirúrgica: **chip novo da Vivo** (plano Easy Lite mensal, ~R$ 30/mês a partir do 2º mês — manter
  ativo enquanto o número for usado) num iPhone antigo da dona, apagado, sem ID Apple, sem WhatsApp instalado, com senha
  de tela; serve só para receber o SMS/ligação de verificação da Meta. (O número antigo da Alessandra fica de fora.)
- Pendente: adicionar o número na Meta → `WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID` no Supabase → publicar o app
  (URL da política: https://sistema-production-addc59db.up.railway.app/privacidade) → teste real.
- **19/11 (tarde) — LIGADO:** conta do WhatsApp nova "Consumed Orientação Cirúrgica" (WABA 1459910998987910, separada da
  "Test Messaging Account", que não deixa trocar o número de teste), número **+55 21 96724-7984** (phone number ID
  1545263548660010, nome de exibição "Consumed Clínica de Olhos", status Conectado), `sistema-consumed` com controle total,
  app inscrito nos webhooks da conta, app **Publicado** (categoria "Negócio e Páginas", ícone transparente, política em
  /privacidade). Segredo `WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID` salvo pela dona. Detalhes da empresa preenchidos no
  portfólio (exigência da Meta, erro #2655102).
- **Teste real OK:** chegou a mensagem automática da Meta e o "Oi" da dona, na aba Orientação cirúrgica (ligada sozinha
  ao paciente pelo telefone).
- Pendentes da dona: PIN de verificação em duas etapas do número; forma de pagamento (só para modelos fora das 24 h);
  confirmar o e-mail do portfólio; testar a resposta pelo login da Alessandra; cadastrar o modelo `retomar_orientacao`.
- **20/11:** resposta pela Alessandra testada e OK. PIN de verificação em duas etapas definido pela dona (via Graph API
  Explorer, `POST /1545263548660010 {pin}` → success; a opção sumiu do Gerenciador). E-mail do portfólio confirmado.
  Forma de pagamento cadastrada (cartão, BRL, CNPJ). Modelo `retomar_orientacao` (Utilidade, pt_BR) enviado à Meta,
  **em análise** — ao aprovar, ligar `whatsapp_modelos.ativo` (finalidade retomar_orientacao).

## 20/11/2026 — WhatsApp: enviar áudio, fotos e documentos (qualidade original)
Pedido da dona: a Alessandra manda muitos áudios, fotos e documentos, e tudo precisa chegar e sair legível.
- **Tela (os dois números):** botões 📎 (foto/PDF/Word/Excel/áudio/vídeo; também colar imagem com Ctrl+V) e 🎤 (gravar
  áudio no navegador → convertido para **MP3** com `@breezystack/lamejs`, `app/src/lib/gravador.ts`; a Meta aceita
  audio/mpeg). Foto pode ir **"como documento"** (qualidade original); foto > 5 MB ou HEIC/WEBP vai sempre como documento.
  Legenda = texto da caixa. Arquivos recebidos/enviados: **"🔍 Abrir em tamanho real"** e **"⬇ Baixar"** (nome original).
- **whatsapp-enviar v12:** ação `arquivo` (multipart): guarda o original no Storage (`<setor>/<mês>/enviado-<id>`), sobe
  para a Meta (`/{phone_id}/media`, sem compressão) e envia `image|audio|video|document` (limites da Meta: foto 5 MB,
  áudio/vídeo 16 MB, documento 100 MB). Só dentro das 24 h.
- **whatsapp-transcrever v10:** usa a cópia do Storage quando existe. **Migração 0065:** áudios ENVIADOS pela equipe
  também são transcritos (entram na pesquisa: "o que a Alessandra orientou").
- Testado no navegador com microfone simulado (MP3 gerado e enviado em multipart) e `deno check`. Falta teste real com a Meta.
- Obs.: os números de versão das funções sobem sozinhos quando se salvam segredos (não é publicação de outra sessão).

---

## 21/11/2026 — Repasse: REGRA GERAL com custos da cirurgia (migração 0070)
### Decisão da dona (vale para TODOS os médicos e cirurgias)
- **Valor bruto − imposto (15% do bruto) − taxa do cartão (% do bruto) − custos (sala, instrumentação, auxiliar,
  insumos…) = honorários → 20% clínica, 80% médico.** A divisão vem SEMPRE depois de tudo descontado; se algum
  documento mostrar outra ordem, corrigir para esta.
- **Taxa de sala:** fica para a própria clínica, mas entra como **custo** (não nos 20%).
- **Auxiliar (Dr. Matheus) e instrumentação:** o Luciano transfere para eles (custos "a pagar").
- **Débito:** 2,34% (a taxa de 0,72% do PDF do Calázio não vale).
### Fonte: 5 PDFs da Dra. Gisele (Sondagem, Calázio, Entrópio, Ectrópio, Blefaroplastia)
- Entrópio e Blefaroplastia já seguiam a regra geral; Ectrópio, Sondagem e Calázio descontavam o cartão depois dos 20%
  (só da médica) e foram refeitos. Resultados (médica): Blefaroplastia 12x 6.500 → 2.394,56; Entrópio 10x 8.500 →
  3.833,84; Ectrópio 12x 8.500 → 3.759,04 (PDF dizia 3.593,80); Sondagem 3x 1.100 → 588,40 (PDF 578,50);
  Calázio débito 1.750 → 917,24 (PDF 937,40, com 0,72%).
### O que entrou
- **Migração 0070 `repasse_custos_procedimentos`** (aplicada; o número 0063 já era de outra sessão): `repasse_procedimentos`
  (tabela de procedimentos com valor sugerido e médico) + `repasse_procedimento_custos` (custos padrão: sala, instrumentação,
  auxiliar, insumo, outro; quem recebe), `repasse_custos` (cópia dos custos de cada repasse, com `pago_em` para auxiliar e
  instrumentação), `repasses.custos_total`, `repasses.procedimento_id`, `repasse_parcelas.custos`.
  Lançamento agora só pela função **`repasse_lancar(p jsonb)`** (SECURITY DEFINER, confere faturamento/admin; aviso do
  Supabase esperado); a inclusão direta em `repasses` foi fechada. Sala e insumo não têm favorecido.
- Procedimentos iniciais: Refrativa (qualquer médico, sem custos); da Dra. Gisele: Sondagem (sala 100, instr. 50),
  Calázio (200/100), Entrópio 1 olho e Ectrópio 1 olho (auxiliar Dr. Matheus 1.000, sala 500, instr. 200),
  Blefaroplastia (auxiliar 1.000, sala 700, instr. 200). Instrumentação está com o nome genérico "Instrumentação"
  (perguntar o nome de quem recebe).
- **Telas:** no lançamento, escolher o procedimento preenche valor e custos (editáveis); prévia mostra cada custo.
  Detalhe do repasse: custos e "A pagar: auxiliar e instrumentação" (Marcar pago hoje). Relatório por médico ganhou
  "Auxiliares e instrumentação (cirurgias do período)". Regras e taxas ganhou "Procedimentos e custos padrão".
### Testes
- Banco local: os 5 PDFs + refrativa; lançamento direto bloqueado; custos maiores que o valor recusados; custo não muda
  depois de lançado; sala não tem pagamento; repasse com custo pago não cancela; recepção não lança nem vê.
- Banco real (transação desfeita): Blefaroplastia → médica 2.394,56. Tela com dados simulados: prévia igual ao PDF.
### Em aberto
- Quando o Luciano paga o auxiliar/instrumentação (de uma vez, no mês da cirurgia?); nome de quem faz a instrumentação.
- Próximos médicos: Gelson, Max, Pedro e Luísa.

## 22/11/2026: Gerador de XML TISS (sessão "Dados para migração")
- A dona escolheu que a sessão de migração construa o gerador de XML TISS, começando por cirurgias e injeções.
- Entrou `app/src/lib/tiss/` (biblioteca, ainda sem tela e sem banco) e `app/scripts/tiss/` (testes com XSD oficial 4.03.00).
- Detalhes, pendências e próximos passos em `docs/sistema/tiss-gerador.md`.
- Mapeamento das telas do Micrologos: `docs/micrologos/mapeamento-telas/` (comece pelo RESUMÃO). Lacunas do sistema em
  `docs/micrologos/mapeamento-telas/LACUNAS-sistema-novo.md`.

## 19–23/11/2026 — Caixa da Recepção (menu 💵 Caixa) — migração 0066
### Pedido da dona (aba "Caixa da Recepção", aberta da aba DÚVIDAS em 18/11)
Acabar com a folha de papel do caixa. **Separado do Repasse médico** (pedido explícito: não misturar).
Análise das fotos de 17/11: no Micrologos o PIX entra como "Dinheiro"; lançamentos de R$ 0,01 = **cortesia** (confirmado pela dona em 18/11).
### Decisões da dona (18–19/11)
- Começar com o caixa **funcionando sozinho** (nome do paciente digitado), sem depender de agenda/prontuário; o Micrologos segue oficial.
- **Um caixa só** para a clínica. Caminho: recepção do 1º andar abre/lança/fecha → leva ao administrativo → as meninas do
  **telefone/WhatsApp** conferem → **Luciano ou Soraline (Sol)** aprovam.
- Equipe (19/11): recepção 1º andar Luana, Tiago, Viviane, Maiara, Cláudia; telefone/WhatsApp Isabelle, Ingrid, Patrícia, Gleice (+1 nova);
  administrativo Sol, Luciano, André, Vitória; pré-exame Juliane, Gabriela, Priscila; técnico de enfermagem Guilherme;
  marcação presencial (1º andar) Alice. Nenhuma delas está cadastrada no sistema ainda (só Alessandra, Ana, Luciano e médicos).
### O que entrou
- Tabelas `caixas`, `caixa_atendimentos`, `caixa_pagamentos` (vários por atendimento, podem cair em outro dia = saldo pendente),
  `caixa_saidas`. Formas: dinheiro, PIX, débito, crédito à vista, crédito parcelado (nº de parcelas). Cortesia com motivo e quem autorizou.
- Nada é apagado: cancelar exige motivo. Só mexe em caixa **aberto**; fechado/conferido/aprovado só muda pelas funções
  `caixa_abrir/fechar/conferir/devolver/aprovar` (a tabela `caixas` não aceita alteração direta). No máximo 1 caixa aberto.
- Fechamento guarda esperado em dinheiro (fundo + dinheiro − saídas), contado e diferença. Quem fechou não confere o próprio caixa.
  Conferente/aprovador pode **devolver para correção** (volta a aberto, com motivo).
- Permissões: lançar/fechar = recepção e admin; conferir = marcação **"Confere o caixa"** (tela Equipe) ou admin;
  aprovar = marcação **"Aprova o caixa"** ou admin; ver = todos esses. Colunas `profissionais.caixa_conferir/caixa_aprovar`.
- Tela `/caixa` (aberto, pendências de conferência/aprovação, histórico) e `/caixa/:id` (totais por forma, atendimentos, saldos de
  outros dias, saídas, caminho do caixa, impressão).
### Testes
- Banco (transação desfeita no fim): abrir; 2º caixa bloqueado; pagamento acima do valor bloqueado; pagamento em cortesia bloqueado;
  esperado 200 + 100 − 50 = 250; fechar com 245 → diferença −5; lançar em caixa fechado bloqueado; alteração direta bloqueada;
  aprovador não confere; admin confere; aprovador aprova. Build OK. Tela não testada com login (sem acesso de teste).
### Pendências
- Cadastrar a equipe na tela Equipe e marcar "Confere o caixa" (telefone/WhatsApp) e "Aprova o caixa" (Luciano, Sol).
- Etapa 2 (opcional): comparar com o relatório do dia do Micrologos (precisa de um exemplo do arquivo); depois, botão "Receber" na agenda
  quando a agenda do nosso sistema for usada; integração maquininha/PIX; conferência de notas fiscais.

## 23/11/2026 — Central de atendimento, passo 2: status da atendente e fila do WhatsApp (migração 0080)
- **Pedido da dona** (via aba DÚVIDAS + levantamento do Talklogos em `docs/micrologos/modulos/talklogos-central-atendimento.md`):
  central parecida com o Talklogos; **5 atendentes** na Central (telefone + WhatsApp) e **1 na Orientação Cirúrgica**
  (fila separada). Tudo muito fácil: a dona escolheu **só 3 status** — 🟢 Disponível / ⏸️ Pausa / 🍽️ Almoço.
- **Migração 0080 `central_fila_status`** (aplicada): `whatsapp_conversas.fila_desde` (desde quando espera; entra ao chegar
  mensagem do paciente sem responsável, sai ao assumir/arquivar, volta ao ser devolvida se a última mensagem é do paciente);
  `central_status` (status por pessoa; equipe lê; só a função grava); `central_mudar_status` (fora de Disponível devolve as
  conversas da pessoa); `central_pegar_proximo` (o que espera há mais tempo no setor da pessoa, `for update skip locked`;
  só Disponível). Setor: quem tem "Atende a Orientação cirúrgica" fica na fila da orientação; recepção/admin na Central.
  Conversas que já esperavam foram colocadas na fila. Advisors: só os avisos esperados de SECURITY DEFINER.
- **Telas:** WhatsApp/Orientação ganharam a barra **Meu status** (3 botões grandes) + quem da equipe está disponível/pausa/
  almoço; aba **Na fila** (primeira, em ordem de chegada, "⏳ Esperando há X min"); botão grande **👉 Pegar o próximo**.
  O **telefone acompanha o status** (fora de Disponível não toca); o "Pausa" do telefone usa o mesmo status.
  Código: `app/src/lib/central.tsx`, `app/src/pages/WhatsApp.tsx`, `app/src/components/Telefone.tsx`.
- **Testes:** banco real em transação desfeita (ordem da fila, pegar o próximo, almoço devolve e volta à fila na mesma ordem,
  em almoço não pega, respondida e solta fica fora da fila, orientação separada, médico sem status, sem gravação direta);
  navegador com dados simulados.
- **Próximos passos combinados:** 3) etiqueta de origem/campanha (Google Ads) e vários números na mesma fila; 4) resultado ao
  encerrar + protocolo + relatório de conversões; 5) painel de supervisão; 6) respostas rápidas.

---

## 23/11/2026 — Ícone do sistema (atalho na área de trabalho)
- Pedido da dona: o atalho do Chrome na área de trabalho aparecia só com um "C" (o sistema não tinha ícone de verdade;
  o `index.html` ainda usava a bolinha verde antiga).
- Novo ícone: o "olho" do logo da Consumed (anel + listras) em branco sobre quadrado azul (#0277bd → #00468a),
  redesenhado em alta resolução. Arquivos em `app/public/`: `icone-192.png`, `icone-512.png`,
  `icone-maskable-512.png`, `icone.png` (180, apple-touch-icon), `favicon.png`, `favicon.ico` e
  `consumed-sistema.ico` (Windows, vários tamanhos, para trocar o ícone de um atalho à mão).
- `app/public/manifest.webmanifest` (nome "Consumed Sistema", abre em janela própria) + links no `index.html`.
  Conferido no Chrome: manifesto sem erros. Com isso o Chrome oferece "Instalar" o sistema como aplicativo.

## 23/11/2026 — WhatsApp da Orientação Cirúrgica: Meta parou de entregar (corrigido)
- Sintoma: mensagens para +55 21 96724-7984 não apareciam no sistema. Logs: última entrega da Meta em 20/11 ~00:43 UTC;
  às 07:01 UTC de 20/11 houve um `GET` de verificação do webhook com token diferente do `WHATSAPP_VERIFY_TOKEN` (403) e,
  depois disso, nenhum `POST`. Ou seja, a configuração do webhook na Meta foi mexida/ficou inválida.
- Correção: a dona reconfigurou o webhook no app da Meta (com o Claude no Chrome). Confirmado no banco: mensagem recebida,
  texto enviado e **áudio MP3 enviado, entregue, guardado e transcrito** (primeiro teste real do envio de áudio).
- Para diagnosticar de novo: `function_edge_logs` com `event_message like '%whatsapp-webhook%'` (POST 200 = entregas da
  Meta; GET 403 = tentativa de verificação com token errado).
## 23/11/2026 — Link de primeiro acesso para a equipe
- Pedido da dona: sem e-mail cadastrado, não havia como mandar o acesso ao funcionário.
- Tela Equipe → 🔑: depois de "Criar / redefinir acesso", aparece uma mensagem pronta (link + usuário + senha temporária)
  com os botões "Enviar pelo WhatsApp" (wa.me; celular opcional, não é gravado) e "Copiar mensagem".
- O link é `<endereço do sistema>/?u=<usuário>`: a tela de login já vem com o usuário preenchido (a senha NÃO vai no link).
- Aviso de versão nova (`app/src/components/AvisoVersao.tsx`): a dona não viu a novidade porque a página estava aberta
  desde antes da publicação. Agora, a cada 3 min e ao voltar para a janela, o sistema compara o script publicado com o
  carregado e mostra "Saiu uma versão nova — Atualizar agora" (não recarrega sozinho para não perder o que se digita).
- Atualização automática (pedido da dona): ao detectar versão nova (confere a cada 1 min), o sistema recarrega sozinho
  quando a pessoa troca de tela ou depois de 10 min sem ninguém mexer no computador; até lá mostra o aviso com
  "Atualizar agora". A TV da sala de espera ficou de fora de propósito (recarregar desliga o som das chamadas,
  que o navegador só libera com um clique).

## 23/11/2026 — Toda a equipe marca e encaixa na agenda
- Pedido da dona: todos que acessam o sistema podem incluir e encaixar paciente na agenda.
- Só o faturamento não podia. Migração `0081_agenda_toda_equipe`: faturamento ganha INSERT em `agendamentos`
  (marcar/encaixar) e em `pacientes` (cadastrar paciente novo na hora de marcar). Remarcar, cancelar e check-in
  (UPDATE) continuam com médico, enfermagem, recepção e admin. Advisors sem novidade.
- Migração `0082_agenda_faturamento_corrige`: faturamento também ALTERA agendamentos (remarcar, cancelar, corrigir),
  porque é quem corrige erros da agenda na hora de faturar/importar o XML (decisão da dona). Com isso todas as
  funções têm o mesmo acesso à agenda. Advisors sem novidade.

## 23/11/2026 — Faturamento abre e fecha o caixa
- Pedido da dona: o faturamento fiscaliza, abre e fecha o caixa da recepção.
- Migração `0083_caixa_faturamento`: `interno.caixa_papel` passa a dar 'lancar' (abrir, lançar, fechar) e 'ver' também à
  função faturamento; `papelCaixa` em `Caixa.tsx` igual. Conferir/aprovar continuam pelas marcações da tela Equipe.
  Regra mantida: quem fechou o caixa não confere o próprio caixa.
- Caixa → Novo recebimento (pedido da dona): o campo "O que foi feito" vinha escrito "Consulta" e a lista de sugestões só
  mostrava o que combinava com o texto (parecia que só existia consulta). Agora são 3 botões — **Consulta · Exame ·
  Procedimento** — mais "Qual?" opcional com sugestões por tipo (terapias entram em Procedimento). Grava em
  `descricao` como "Exame — OCT" (ou só "Exame"). Sem mudança no banco.
- Caixa → Novo recebimento (pedido da dona): um paciente pode fazer vários exames na mesma visita. Agora os tipos
  (Consulta/Exame/Procedimento) e os itens de cada tipo são botões que se marcam juntos, + campo "Outro".
  `descricao` fica, por ex., "Consulta + Exame (Mapeamento de retina, Tonometria, Microscopia especular)". Valor é um só.

## 23/11/2026 — Excluir agendamento lançado por engano
- Pedido da dona: o faturamento não conseguia "excluir" paciente da agenda (só havia "Cancelar", que deixa riscado).
- Migração `0084_agendamento_excluir`: função `public.agendamento_excluir(id, motivo)` para toda a equipe (inclusive
  faturamento). Travas: não exclui depois da chegada, nem com atendimento/exame/cirurgia ligado, nem com conta em lote,
  recebida ou com repasse. Conta aberta/cancelada automática sai junto; vínculos do WhatsApp viram nulos. O motivo vai
  para a auditoria ("EXCLUÍDO: …"). Testado no banco como usuário do faturamento (com rollback).
- Tela: botão "🗑️ Excluir" no agendamento (também para cancelados/faltas), com motivo obrigatório.
- Faturamento já podia incluir/excluir contas (políticas de `contas`) e, desde 0081–0083, marca/altera agenda e caixa.
- Cancelar conta (pedido da dona): o botão só aparecia para conta aberta/conferida; ela tentou cancelar uma particular
  já **paga**. Agora particular paga (fora de lote) também pode ser cancelada, com aviso de que o dinheiro não volta
  sozinho (lançar saída no Caixa). Migração `0085_conta_cancelar_paga`: `tg_conta_regras` (agora security definer)
  barra cancelar conta com repasse ativo. Conta em lote: aviso para "Desfazer lote" antes (convênio enviado = glosa).

## 23/11/2026 — Tabela de preços particular (Micrologos)
- A dona extraiu da Micrologos (ML Clinic Master → Cadastros → Tabelas → Produtos/Serviços → Preços, tabela
  "Particular", cód. 1) a planilha `procedimentos-particulares.xlsx`: 93 procedimentos (consulta 11, exame 29,
  procedimento 12 + taxa 1, cirurgia 38, terapia 2). "Appai Particular" e "Assist Particular" ficaram de fora (não usadas).
- Migração `0086_procedimentos_particulares_micrologos`: tipo novo `terapia`, coluna `procedimentos.observacao`;
  procedimentos na tabela '00' (tabela própria) com `codigo` = código interno da Micrologos (NÃO é TUSS); preço em
  `precos` sem convênio, vigente desde 23/11/2026. Taxa de Sala ficou com tipo `taxa`.
- Regras da dona: preços de cartão e de dinheiro/Pix são itens separados (Blefaroplastias, Consulta, Cirurgia Refrativa);
  Taxa de Sala = 0,00 (não usada); Revisão = 0,01 e Fotocoagulação continuação = 0,10 são valores simbólicos.
- Conta particular no Faturamento já pega esses preços sozinha (`interno.preco` com convênio nulo).
- Caixa → Novo recebimento: os botões de itens agora vêm dessa tabela, com o preço; marcar soma o valor sozinho
  (pode digitar outro valor; aparece "usar este valor" para voltar à soma). Busca por nome. Cirurgia e terapia
  aparecem em "Procedimento". Tela Procedimentos mostra Terapia e a observação.
- Migração `0087_consulta_particular_e_sem_cobranca` (decisões da dona):
  - Revisão (renomeada de "Revisão 0,01") e Fotocoagulação continuação agora valem R$ 0,00: os 0,01/0,10 só existiam
    porque a Micrologos não aceitava zero. Revisão = cortesia; sessão seguinte de pacote já foi paga. No Caixa, se só
    houver itens de R$ 0,00, o sistema orienta usar "🎁 Cortesia".
  - Chegada de paciente PARTICULAR para consulta: a recepção escolhe "💳 Cartão" (cód. ML 184) ou "💵 Dinheiro/Pix"
    (cód. 63), ou outra consulta da tabela (`components/ConsultaParticular.tsx`, na Recepção e no "Paciente chegou" da
    Agenda). Fica em `agendamentos.consulta_procedimento_id`; `tg_agendamento_conta` lança essa consulta na conta
    (sem escolha = consulta padrão). Testado no banco com rollback: conta saiu com "Consulta Dinheiro/pix = 250,00".

## 23/11/2026 (noite) — Central de atendimento: tela única no jeito do Talklogos (migração 0081)
- **Pedido da dona:** "fazendo tudo parecido, a dificuldade do funcionário diminui muito". Referência: fotos e levantamento
  em `docs/micrologos/modulos/talklogos-central-atendimento.md`. Telefone entra depois (aguardando a Telecall); a aba
  **Telefone** já fica criada.
- **Tela `/central`** (menu 🎧 Central de atendimento; recepção/admin e quem atende a Orientação, cada um na sua fila;
  tela cheia sem o menu do sistema, como o Talklogos; `app/src/pages/Central.tsx`):
  menu da esquerda (Conversas · Atendimentos encerrados · voltar ao Sistema); coluna do meio com **status ▾** (Disponível /
  Pausa / Almoço, com o aviso de quantas conversas voltaram para a fila), Buscar, **equipe com iniciais e status**
  (Todos / Livres / Em pausa), abas **Canais** e **Telefone**, botão **Pegar o próximo**, **Fila de espera** (⏳ há X min) e
  **Meus atendimentos** (Todos / Não respondidos); cartões com iniciais, origem ("WhatsApp oficial · Central"), começo da
  última mensagem e etiqueta **Atendendo / Não respondido**; conversa no centro; ficha do paciente à direita.
- **Cabeçalho da conversa no jeito do Talklogos** (`Chat` com `central`, em `app/src/pages/WhatsApp.tsx`): "Em conversa
  desde dd/mm hh:mm com <atendente>", linha do paciente com prontuário, botões **Encerrar conversa** (arquiva; se o paciente
  escrever de novo volta para a fila — regra 0015) / **Iniciar atendimento** (assume e reabre) e **Opções ▾**: Associar
  paciente, Agendar (abre o agendamento já com o paciente), Agendamentos e ficha, **Transferir para colega** (lista com o
  status de cada uma), Devolver para a fila. A tela antiga `/whatsapp` continua igual para quem só consulta.
- **Migração 0081 `central_atendido_desde`** (aplicada): `whatsapp_conversas.atendido_desde`, preenchido pelo gatilho da
  fila quando alguém assume/recebe transferência. Testado no banco real (transação desfeita): iniciar, transferir, encerrar
  mantendo quem atendeu e saindo da fila. Advisors sem novidade.
- Testes de tela com dados simulados (computador e celular). Falta o teste com o número da Central ligado na Meta.

### 21/11 — Confirmações da dona sobre o repasse
- Auxiliar (Dr. Matheus) e instrumentação recebem **de uma vez** (pagamento único); só o médico que operou recebe parcelado.
- Instrumentação fica com o nome genérico "Instrumentação" (sem nome de pessoa).

---

## 23/11/2026 — Repasse: parceiro, cobrança ao médico, anestesista e 10 procedimentos (migração 0071)
### Fonte: 10 PDFs (Dra. Gisele e Dr. Pedro) + explicações da dona
- PDFs mostravam só custos (sem imposto nem 20/80); aplicada a **regra geral** (dinheiro/PIX nos exemplos).
- **Anestesista:** o Luciano transfere (como o auxiliar) → novo tipo de custo `anestesista`.
- **Lente Hoya** (PDF dizia "Roya"): comprada pela clínica → custo `insumo` antes da divisão.
- **Cisto com biópsia:** da Dra. Gisele; biópsia sem custo de laboratório.
- **Campo Grande:** o Dr. Pedro (sócio) atende no consultório dele em Campo Grande; o paciente paga a ele e ele **deve à
  clínica** a taxa de sala, a lente etc. → lançamento do tipo **cobrança** (médico deve; nada vai para ele).
- **Clínica Vital:** traz pacientes de catarata e paga **R$ 1.500 por cirurgia: R$ 1.000 centro cirúrgico + R$ 500
  cirurgião, sem imposto e sem os 20%** ("se não me engano" — a dona pode ajustar; o PDF dizia sala 1.100) → tipo **direto**.
### O que entrou
- **Migração 0071 `repasse_regras_parceiro_cobranca`** (aplicada): `repasses.regra` e `repasse_procedimentos.regra`
  ('geral' | 'direto' | 'cobranca'); tipo de custo `anestesista`; `repasse_lancar` recebe `regra` (na cobrança o valor =
  soma dos custos, 1 parcela, sem favorecidos); cálculo por tipo; na cobrança a "parcela" é o pagamento do médico à clínica
  (status "concluído" quando ele paga; não se marca "pago ao médico"); gatilho `situacao` olha `recebido_em` também.
- Procedimentos novos: Gisele — Blefaroplastia com castanhares (9.900; Matheus 2.000, sala 900, instr. 250), Ptose
  palpebral (8.000; 1.500/500/200), Tumor de carúncula (3.000; 750/200/100), Cisto (1.600; sala 200, instr. 100), Cisto com
  biópsia (2.600; 200/100); Pedro — Fascectomia (5.500; sala 1.100, lente 320, anestesista 350, instr. 100), Fascectomia +
  TREC (10.500; 1.800/320/800/200); cobranças Campo Grande (sala 1.100 + lente 320) e Ciclofoto Campo Grande (1.500);
  Catarata — Clínica Vital (direto; 1.500, centro cirúrgico 1.000).
- **Telas:** "Novo lançamento" com **Tipo de lançamento** (escolher o procedimento ajusta); cobrança sem valor/forma (o valor
  é o que o médico deve) e botão **"Médico pagou hoje"**; prévia do parceiro sem imposto/20%; etiquetas "parceiro" e
  "médico deve" na lista; relatório ganhou **"A receber dos médicos (cobranças em aberto)"** e o relatório por médico deixou
  de contar cobranças; editor de procedimentos com o tipo.
### Resultados (médico)
Blefaro c/ castanhares 4.212,00 · Ptose 3.680,00 · Tumor de carúncula 1.200,00 · Cisto 848,00 · Cisto c/ biópsia 1.528,00 ·
Fascectomia 2.244,00 · Fascectomia + TREC 4.644,00 · Vital 500,00 · Campo Grande: Pedro deve 1.420,00 · Ciclofoto CG: deve 1.500,00.
Conferido no banco local e no real (transação desfeita); tela com dados simulados.
### Ideias oferecidas à dona (sem resposta)
- Ligar a lente ao Estoque (custo real e baixa automática); relatório "o que fica para a clínica no mês".
- **Correção da dona (23/11, mesmo dia):** Clínica Vital = **taxa de sala R$ 1.100** (fica para a clínica) + **R$ 500 para o
  médico que operou** → valor sugerido **R$ 1.600**. Ajustado direto na tabela de procedimentos (dado, não estrutura);
  nenhum lançamento da Vital existia ainda. Pergunta em aberto: na cobrança de Campo Grande incide imposto? (hoje: não).

### 23/11 (noite) — Repasse: confirmações e catálogo de lentes (migração 0072)
- Cobrança de Campo Grande **sem imposto** (confirmado pela dona).
- "Lente Hoya" é a **lente simples (monofocal)**: nos custos dos procedimentos virou "Lente intraocular monofocal (Hoya)"
  (ajuste de dado). Monofocal = um foco (em geral longe; óculos para perto).
- **Migração 0072 `lentes_catalogo`** (aplicada): catálogo por MODELO (código do fornecedor, descrição, fabricante, linha,
  tipo óptico monofocal/foco estendido/multifocal, tórica, pré-carregada "AutonoMe", **custo de compra com IPI**, preço de
  venda a definir). `estoque_itens.lente_id` liga a unidade do estoque ao modelo. Leem: faturamento, admin, médico,
  enfermagem; alteram: faturamento e admin. Carregadas as 10 lentes premium da Alcon (tabela do e-mail de 01/04/2026: Clareon
  684,60; AutonoMe 861,00; Toric 1.584,45; Vivity e PanOptix 4.198,95; Vivity/PanOptix Toric 5.553,45 — valores lidos da foto,
  alinhados na ordem das linhas; pedir confirmação) + "Monofocal Hoya" 320,00.
- Tela: **Repasse médico → aba "Lentes"** (custo e preço de venda editáveis, nova lente).
- Próximo: escolher a lente do catálogo/estoque no lançamento (custo real + baixa sem duplicar a da cirurgia) e a regra da
  venda de lente premium ao paciente (falta a dona definir preço de venda e divisão).

### 23/11 (noite) — Venda de lente ao paciente
- **Preços de venda (dona):** lente simples (Hoya, monofocal) **R$ 2.900**; **Clareon** (tórica ou não; "independência
  de visão para longe") **R$ 7.500**; multifocais **Vivity e PanOptix R$ 15.000** (valor total). Gravados em
  `lentes_catalogo.preco_venda` (dado). Usado 15.000 também nas versões tóricas de Vivity/PanOptix e 7.500 nas Clareon
  monofocais (SY60WF, AutonoMe) — confirmar com a dona.
- **Regra (dona):** igual à das cirurgias — valor − imposto − taxa do cartão − **custo da lente** = sobra → 20% clínica /
  80% médico, conforme as parcelas. Usada principalmente em convênios (Unimed e outros): o convênio paga a cirurgia e o
  paciente paga a lente à parte. Entra no faturamento de convênios quando ele estiver completo.
- Tela: no "Novo lançamento", campo **"Ou: venda de lente ao paciente (catálogo)"** preenche descrição, valor (preço de venda)
  e o custo da lente. Ex.: PanOptix R$ 15.000 PIX → médico 6.840,84; em 12x → 5.674,44 (472,87/mês).

## 23/11/2026 (noite) — Central: um item só no menu + conversa interna da equipe (migração 0092)
- **Pedido da dona:** "Central de atendimento e WhatsApp não ficou a mesma coisa? Deveria ser um só" e "a gente fala com o
  paciente e fala entre a gente (funcionários e médicos) no sistema, tudo no mesmo local" (Interno/Grupos do Talklogos).
- **Menu:** fica **🎧 Central de atendimento** para toda a equipe, com o contador de mensagens novas (WhatsApp da clínica, da
  orientação e conversa interna). Quem atende (recepção/admin/orientação) trabalha só nela; as ferramentas do WhatsApp
  (lembretes, modelos, fora do horário, pesquisar, importar) abrem pelo botão **🧰 Ferramentas** do menu da Central.
  "WhatsApp (consulta)" continua para médico, enfermagem e faturamento; "Orientação cirúrgica (consulta)" para médicos/admin.
  Médicos, enfermagem e faturamento entram na Central só com a aba **Interno**.
- **Migração 0092 `chat_interno`** (aplicada; numerada 0092 porque outras sessões usaram 0081–0087): `interno_conversas`
  (direta com `chave_direta` única, ou grupo com nome), `interno_participantes` (com `lida_em`), `interno_mensagens`
  (texto até 4000; ninguém edita nem apaga). RLS: só participantes leem; cada um escreve em nome próprio e marca só a
  própria leitura. Funções `interno_abrir_direta`, `interno_criar_grupo`, `interno_adicionar`. Realtime nas mensagens.
  Obs.: há dois arquivos 0081 (`0081_agenda_toda_equipe` de outra sessão e `0081_central_atendido_desde`); ambos aplicados.
- **Tela:** aba **Interno** na Central (entre Canais e Telefone) com "✉️ Nova conversa" (escolhe o colega), "👥 Novo grupo",
  lista com não lidas; conversa no centro com o nome de quem escreveu e "+ Pessoas" nos grupos. Som e aviso do computador
  quando chega mensagem da equipe. Código: `app/src/components/Interno.tsx`, `app/src/lib/interno.ts`.
- **Testes:** banco real em transação desfeita (direta não duplica; não escreve como outro; não edita; enfermagem não vê a
  conversa recepção↔médico mas vê o grupo dela; marca só a própria leitura; anônimo bloqueado); tela com dados simulados.

### 23/11/2026 (noite) — Central: ordem das abas e ligações dentro da Central
- Abas na ordem **Interno · Canais · Telefone** (pedido da dona; nome "Canais" mantido por ser o que a equipe já conhece).
- **Ligações dentro da Central** (pedido da dona: ver perdidas e atendidas, retornar, achar a conversa e ouvir a gravação no
  mesmo lugar): aba **Telefone** com **Perdidas sem retorno** / Hoje / 7 dias; cada ligação mostra recebida/feita, situação,
  duração, quem atendeu e a anotação; ao clicar: **📞 Ligar de volta** (com o telefone conectado), **✓ Resolvida**,
  **💬 Conversa** (abre a conversa do WhatsApp do mesmo paciente/número na Central), **🎧 Ouvir** (desligado até a central
  da Telecall gravar — falta guardar o endereço da gravação em `ligacoes`) e Ficha. O item "Ligações" saiu do menu de quem
  atende; fica "Ligações (consulta)" para médico, enfermagem e faturamento.

## 23/11/2026 — Agenda da Orientação Cirúrgica (etapa 1) — migrações 0093–0094
Pedido da dona: a Alessandra registra na agenda cada paciente que a procura e, nas Notas, o que ele veio fazer (pagar
cirurgia, trazer risco, se informar…), como na aba "Orientação Cirúrgica" do Micrologos. É só registro.
- **Decisão:** a coluna "Orientação Cirúrgica" fica DENTRO da Agenda (escolha da dona), e é a própria pessoa que atende a
  orientação (`profissionais.orientacao_cirurgica` e não médico). Não criamos "pessoa falsa" (apareceria no chat, caixa…).
- **0093:** novo valor `orientacao` em `tipo_agendamento`. **0094:** gatilho `orientacao_tipo` força o tipo nessa coluna (e
  recusa esse tipo em médico); `tg_agendamento_conta` ignora `orientacao` (**não abre conta**). Testado no banco real:
  orientação chegou → 0 contas; consulta médica chegou → 1 conta.
- Horários da Alessandra cadastrados: seg–sex 8–17h, sáb 8–12h, 10 min.
- **Tela:** Agenda lista médicos + "Orientação Cirúrgica" (quem atende a orientação abre direto nela); no novo
  agendamento dessa coluna não há tipo/sala/1ª consulta e as **Notas** têm botões rápidos (Pagar cirurgia, Orçamento,
  Trazer risco cirúrgico…); no detalhe: editar notas, "Paciente chegou" (sem pergunta de consulta particular) e
  "✅ Atendido". Recepção, fila do médico e Início ignoram `tipo = 'orientacao'`. Horários e bloqueios inclui a agenda.
- Pendente: lembretes do WhatsApp (função whatsapp-enviar) ignorarem `orientacao` — hoje os lembretes nem rodam
  (número da clínica não está ligado ao sistema); etapa 2: calendário de 3 meses com ocupação + quadro de resumo.

### 23/11/2026 — Agenda no estilo do Micrologos (etapa 2) — migração 0095
- **Calendário de 3 meses** em cima da Agenda (`app/src/components/AgendaTopo.tsx`): cada dia colorido pela ocupação das
  agendas mostradas (vagas = horários cadastrados ÷ duração; ocupados = agendamentos não cancelados/faltas): 100%,
  51–99%, 1–50%, 0%, "não atende". Clicar no dia abre o dia.
- **Quadro de resumo**: um clique no paciente mostra telefones (principal e secundário), nascimento/idade, convênio,
  **Notas**, chegada, **Inclusão** (quem/quando) e **Alteração** (quem/quando); dois cliques (ou o botão) abrem o
  agendamento. **0095:** `agendamentos.atualizado_por` (gatilho `quem_alterou`).
- **Observação do dia** por coluna (tabela `agenda_obs_dia`, RLS para quem vê a agenda, auditada): "＋ obs. do dia" no topo.
- Só a coluna da Orientação na tela → grade de 10 em 10 min; com médicos, 15 min.
- **Correção (23/11, noite):** havia duas pessoas marcadas como "Atende a Orientação cirúrgica" (Alessandra e Andrea
  Camilo) e a Agenda mostrava duas colunas "Orientação Cirúrgica". Agora é **uma coluna só** (`listaAgendas` devolve uma
  coluna com `membros`; `colunaDoAgendamento` junta os agendamentos). A "dona" da coluna é quem tem horários
  cadastrados (hoje a Alessandra). Quem atende a orientação lança no próprio nome (fica registrado quem lançou).
- **Notas editáveis no quadro de resumo da Agenda (23/11, noite):** a dona não conseguia preencher as Notas. Agora o
  campo do resumo é editável para qualquer agendamento (grava `agendamentos.observacoes`, botão "Salvar notas").
- **Central dentro do sistema** (pedido da dona: "manter o padrão" — antes abria em tela cheia, sem o menu do sistema):
  `/central` agora é uma rota normal dentro do layout (menu do sistema à esquerda, como Agenda e as demais); a faixa de
  ícones da Central (Conversas · Atendimentos · Ferramentas) ficou clara e perdeu o botão "Sistema". Em telas até 1500 px a
  ficha do paciente à direita se esconde para sobrar espaço para a conversa (continua em Opções → Agendamentos e ficha).

## 23/11/2026 (noite) — Agenda: botões rápidos, busca, lista, nota rápida e confirmações pelo WhatsApp
- Pedido da dona: "tudo é importante"; prioridade para achar o paciente rápido, disparar as confirmações do dia
  seguinte direto da agenda, botões rápidos (encaixe, chegada, atendido, retorno, status) e preencher a nota rápido
  (ex.: entregar laudo, jejum, paciente indicação).
- **Barra de botões rápidos** (`app/src/pages/Agenda.tsx`), age no paciente selecionado (um clique): Incluir, Encaixar
  (mesmo médico e horário), Chegada (consulta particular abre a escolha cartão/Pix), Atendido (só depois da chegada),
  Retorno (abre agendamento tipo retorno já com o paciente), Status… (agendado, confirmado por canal, na espera,
  atendido, faltou, cancelar), Nota, Pedir confirmação (WhatsApp), Remarcar, Abrir.
  `DetalheAgendamento` ganhou `modoInicial` para abrir direto em cancelar/remarcar/chegada.
- **Busca de paciente** acima da agenda (nome, prontuário, CPF, telefone): mostra os agendamentos dos últimos 90 dias e
  os futuros; um clique leva ao dia e seleciona; botão para agendar o paciente.
- **Nota rápida** no quadro de resumo: botões prontos (Entregar laudo, Jejum, Indicação, Trazer exames anteriores,
  Dilatar, Acompanhante, Prioridade, Pendência no cadastro; na Orientação, os motivos da orientação), salva sozinha ao
  sair do campo ou com Ctrl+Enter. A nota aparece em amarelo dentro do quadradinho do paciente na grade.
- **Visão em lista** (Hora | Paciente | Agenda | Convênio | Status/chegada | Notas), com "mostrar horários vagos"
  (clique no vago agenda). A escolha Grade/Lista fica lembrada no computador. **Filtro de período**: dia todo, manhã
  (até 12h), tarde (12–18h), noite (depois das 18h).
- **Confirmações pelo WhatsApp:** botão "📲 Confirmações do dia" (recepção/admin) abre a janela de lembretes já no dia
  seguinte (ou no dia mostrado, se for futuro). "📲 Pedir confirmação" manda para um paciente só (pode repetir).
  Função `whatsapp-enviar` versão 13: ação `lembretes` aceita `agendamento_id` e **ignora `tipo = 'orientacao'`**
  (item pendente resolvido). Continua dependendo do número da clínica ligado à Meta e do modelo `lembrete_consulta`
  aprovado; até lá, os botões mostram o aviso "ainda não foi ligado".
- Sem mudança de banco.
### 23/11/2026 — Orientação cirúrgica com o mesmo layout da Central de atendimento
- Pedido da dona: a parte de WhatsApp da aba Orientação cirúrgica deve ficar igual à Central de atendimento.
- `/orientacao-cirurgica` agora abre a tela da Central (`Central.tsx`, prop `setor="orientacao"`), dentro do sistema com o menu ao lado, como `/central`.
  - Quem atende a orientação: igual à Central (status, equipe, fila, Pegar o próximo, Meus atendimentos, Interno, Telefone).
  - Médicos e admin (que só veem): modo consulta — fila e "Em atendimento (com quem)", conversa sem responder, histórico em Atendimentos.
  - `?paciente=` (botão 🩹 da ficha) abre a conversa do paciente; se não houver, vai às Ferramentas para começar uma.
- A tela antiga (pesquisar mensagens, modelos, fora do horário, importar, começar conversa) ficou em
  `/orientacao-cirurgica/ferramentas` (botão 🧰 Ferramentas), com "↩ Voltar ao atendimento".

### 24/11/2026 — Administração responde a Orientação + modelos ligados (migração 0096)
- Meta (conferido pelo Claude do Chrome): cartão MasterCard padrão da conta "Consumed Orientação Cirúrgica", sem aviso;
  foto de perfil "SETOR CIRÚRGICO" trocada; `retomar_orientacao` APROVADO (ligado no sistema);
  `aviso_novo_numero_orientacao` enviado como Utilidade, EM ANÁLISE (já cadastrado no sistema, desligado — ligar em
  WhatsApp → Ferramentas → 📝 Modelos quando a Meta aprovar).
- Desde 01/10/2026 a Meta cobra também as respostas dentro da janela de 24 h (antes grátis).
- Pedido da dona: a admin pode responder no número da orientação para avaliar o funcionamento.
  Banco (0096): `whatsapp_conversas.quem_atende_altera` aceita admin na orientação. Funções `whatsapp-enviar` (v14) e
  `whatsapp-transcrever` (v11): admin envia/transcreve na orientação. `podeResponderSetor` idem.
  A admin NÃO entra na fila da orientação (`interno.atende_orientacao()` não mudou); na aba Orientação ela fica no modo
  consulta com resposta liberada.
- `retomar` aceita `finalidade` (na orientação: `retomar_orientacao` ou `aviso_novo_numero_orientacao`); botões
  "📣 Avisar do número novo" na conversa (fora das 24 h) e ao começar conversa com paciente.
- (24/11, mais tarde) **✏️ Nova conversa** na Central/Orientação (menu da esquerda, para quem pode responder): escolhe
  paciente (ou só um celular + nome) e o modelo aprovado; a conversa abre já com quem começou como responsável.
  `whatsapp-enviar` v15: `retomar` aceita `telefone` e `nome` para conversa nova sem cadastro.
- (24/11) **🧰 Ferramentas dentro da tela**: na Central/Orientação o botão não sai mais da tela; abre uma lista na coluna do
  meio (Pesquisar mensagens, Modelos, Fora do horário, Lembretes na clínica) em janelas por cima. Importar e a tela antiga
  continuam como links (abrem outra tela). Pesquisa abre a conversa achada com a mensagem destacada, mesmo arquivada.

## 24/11/2026 — Prontuário: toda a equipe vê, só o médico escreve + impressão do prontuário
- Pedido da dona: recepção, telefone, administração e faturamento precisam CONSULTAR o prontuário (para marcar sabendo
  se é retina, glaucoma, rotina…); só o médico altera, com o próprio login.
- Migração `0088_prontuario_leitura_equipe`: política `equipe_ve_prontuario` (SELECT para recepcao/admin/faturamento) em
  23 tabelas clínicas (atendimentos, triagens, exames oftalmológicos, refrações, diagnósticos, receitas, óculos, pedidos,
  documentos, adendos, desenhos, exames realizados/arquivos, cirurgias, injeções, alergias, medicamentos, antecedentes,
  seguimentos, Memed, documentos do paciente, prontuário legado) + leitura nos buckets `exames` e `documentos`.
  Escrita NÃO mudou (médico; enfermagem só no que já fazia).
- Telas: abas do prontuário na ficha para todos; botões de alterar escondidos para quem só consulta (HistoricoSaude
  `somenteLeitura`, DocumentosPaciente `podeAnexar`, injeção/cirurgia); `/atendimento/:id` e `/cirurgias/:id` abertos
  para consulta (a tela já é somente leitura para quem não é médico). Abrir ficha/atendimento continua indo para a auditoria.
- Impressão do prontuário (`/imprimir/prontuario/:pacienteId`, botão "🖨️ Imprimir prontuário" na ficha): identificação,
  alergias/medicamentos/antecedentes e linha do tempo (atendimentos completos, prontuário da Micrologos, laudos,
  cirurgias, injeções), com período opcional, aviso LGPD e campo de recibo assinado pelo paciente. Cada impressão vai
  para a auditoria ("Imprimiu o prontuário…").
- Tela "🔍 Acessos ao prontuário" (`/acessos`, só admin; `pages/Acessos.tsx`) + aba "🔍 Acessos" na ficha do paciente
  (só admin): lista do `log_auditoria` com quem abriu, imprimiu ou registrou algo no prontuário (aberturas = LEITURA;
  alterações = INSERT/UPDATE/DELETE nas tabelas clínicas). Filtros por período, pessoa e tipo. Sem mudança no banco.
- Pendentes oferecidos à dona (aguardando decisão): sair sozinho após inatividade (ela teme atrapalhar a recepção) e
  verificação em duas etapas para a administração.

## 24/11/2026 — Verificação em duas etapas para a administração
- Pedido da dona (única admin): código do aplicativo autenticador (TOTP, Supabase Auth MFA) além da senha.
- Migração `0089_admin_duas_etapas`: `interno.mfa_ok()` (sessão aal2, ou nenhum fator verificado ainda);
  `interno.tem_funcao` e `interno.caixa_papel` só dão poderes de ADMIN com `mfa_ok()`. Outras funções não mudam.
  Testado: faturamento e admin sem código ativado continuam iguais.
- Função Edge `equipe-acesso` (v11): admin com fator verificado precisa de token aal2 para criar/redefinir senhas.
- Telas (`pages/DuasEtapas.tsx`): "Minha conta e senha" → "🔐 Verificação em duas etapas" (só admin) com QR code +
  chave manual + confirmação do código; depois do login, se tiver fator e sessão aal1, aparece a tela do código
  (`useAuth().precisaCodigo`). Celular perdido: remover o fator em `auth.mfa_factors` (suporte técnico) e reativar.

## 24/11/2026 — LGPD: encarregada de dados e política de privacidade
- A dona (advogada) é a **encarregada de dados**: "Ana Bertolin" na seção 9 da Política de Privacidade (`/privacidade`).
- Política atualizada (24/11): fornecedores com país (OpenAI — transcrição nos EUA; Anthropic/Claude — assistente, texto
  mascarado, EUA; Railway — só telas/site; Supabase — São Paulo; Meta; Memed; telefonia), transferência internacional
  pelo art. 33, proteções (duas etapas na administração, registro de acessos, criptografia, termo de confidencialidade).
- Proteção contra senhas vazadas (Supabase Auth → HaveIBeenPwned): não há ferramenta para ligar daqui; passo a passo
  dado à dona (painel Supabase → Authentication → Sign In / Providers → Email → "Prevent use of leaked passwords").
- Kit LGPD (documento do Claude, para a dona revisar): https://claude.ai/artifact/1PXFD46B3bBo61eEfMQJyT — resumo do que
  está feito, passo a passo das senhas vazadas, termos de confidencialidade (funcionários e médicos), assinatura digital
  ICP-Brasil (levantamento por médico; integração no sistema depende de escolher a certificadora e ver custo com a dona),
  fornecedores/DPAs e transferência para os EUA (Res. CD/ANPD 19/2024), plano de resposta a vazamento (3 dias úteis,
  Res. CD/ANPD 15/2024) e entrega de cópia do prontuário.

### 23/11 — Confirmações (lentes)
- Confirmado pela dona: R$ 15.000 para todas as Vivity e PanOptix (tóricas ou não); R$ 7.500 para todas as Clareon (inclusive AutonoMe).

---

## 24/11/2026 — Repasse: cirurgias de retina, facectomia e injeções (dados, sem mudança de estrutura)
- **Lente simples agora é Rayner (custo R$ 190)**, no lugar da Hoya: catálogo ganhou `RAYNER-MONO` (venda 2.900); Hoya
  inativada; os custos de lente dos procedimentos (Fascectomia, Fascectomia + TREC, Campo Grande) passaram a Rayner 190.
- **Procedimentos novos** (médico em branco = qualquer médico, até a dona dizer de quem são; anestesista "Fábio (anestesista)"):
  - Vitrectomia (sem faco) — 25.000; anestesista 2.000; sala 5.000 → médico 11.400,00 (PIX).
  - Vitrectomia + faco — 25.000; anestesista 2.000; sala 5.000; lente Rayner 190 → médico 11.248,00.
  - Facectomia (qualquer cirurgião) — 5.500; anestesista 350; sala 1.100; lente Rayner 190 → médico 2.428,00.
    Com lente premium da Alcon "cobra-se a diferença do valor da lente" (regra a detalhar).
  - Injeção antiangiogênica (Lucentis, Eylia ou Avastin; sem droga específica) — 2.200; anestesista 100; sala 600 → 936,00.
  - Injeção de Ozurdex — 7.500 (a dona não lembrava; disse para usar); anestesista 350; sala com o medicamento 3.000
    ("vai sair por 2.000, pode botar 3.000") → 2.420,00.
- Em aberto: de qual médico são as de retina; "Fascectomia" do Dr. Pedro parece ser a mesma Facectomia (com instrumentação 100);
  regra da diferença da lente premium; se o anestesista dos procedimentos do Dr. Pedro também é o Fábio.

### 24/11 — Quem fala é o Dr. Gelson (cirurgião de retina) e ajustes
- A conta do Claude é da Ana Carolina; nesta conversa quem passa as regras é o **Dr. Gelson** (marido, cirurgião de retina;
  só ele faz retina). Vitrectomia (com/sem faco), injeção antiangiogênica e Ozurdex ligadas ao Dr. Gelson.
- "Fascectomia" do Dr. Pedro = **facectomia**; ele paga R$ 100 de instrumentação a alguém de fora → procedimento renomeado
  "Facectomia (Dr. Pedro, com instrumentação de fora)" (e "Facectomia + TREC (Dr. Pedro)"). A Facectomia geral não tem
  instrumentação.
- **Anestesista é sempre o Fábio** (menos a Dra. Gisele, que não tem anestesista): custos de anestesista com favorecido
  "Fábio (anestesista)".
- **Facectomia com lente premium (jeito A, confirmado):** valor = valor da cirurgia + (preço de venda da premium − custo da
  lente simples, 190); o custo da lente passa a ser o da premium. Ex.: Facectomia 5.500 + PanOptix → 20.310; custos 350 +
  1.100 + 4.198,95; médico 9.291,64 (PIX). Tela: no lançamento, "Trocar a lente por premium (Alcon)" (aparece quando o
  procedimento tem lente; desfaz ao voltar para "lente simples").

### 24/11 (noite) — Vendas da Orientação Cirúrgica → Repasse médico (migração 0097)
- **Pedido do Dr. Gelson:** a **Alessandra** (Orientação Cirúrgica) recebe o pagamento de toda cirurgia (maquininha/PIX) e
  atende também os pacientes de convênio que pagam só a lente. Ela registra a venda no "cantinho" dela; o **Luciano**
  confere e faz a divisão. A Alessandra vê **só o valor** (custos e divisão só o Luciano).
- **Migração 0097 `orientacao_vendas`** (aplicada): tabela `orientacao_vendas` (tipo cirurgia | lente, paciente, médico,
  procedimento, lente, valor, forma, parcelas, datas, status aguardando → devolvida/lançada/cancelada, repasse_id);
  gatilho de regras (só faturamento devolve, com motivo; só o lançamento do repasse marca "lançada" — flag
  `app.venda_lancando`; lançada/cancelada não muda; faturamento não altera os dados, devolve); RLS: quem atende a orientação
  + faturamento + admin. Funções `orientacao_procedimentos()`, `orientacao_lentes()` e `orientacao_valor(proc, lente)`
  (SECURITY DEFINER, conferem o papel; mostram só nome e valor de venda — avisos do Supabase esperados).
  `repasse_lancar` aceita `venda_id` e marca a venda como lançada na mesma transação.
- **Telas:** menu **💳 Vendas da orientação** (`/orientacao-cirurgica/vendas`, quem atende a orientação e admin) e botão
  **💳 Vendas** na coluna da esquerda da tela da Orientação; formulário com valor sugerido (procedimento + diferença da lente
  premium, ou preço da lente), devolvidas em destaque, corrigir e reenviar, cancelar com motivo. **Repasse médico → aba
  "Para conferir"** (contador): "Conferir e lançar" abre o lançamento já preenchido (custos do procedimento + lente premium
  trocada) e "Devolver" com motivo.
- Testes: banco local (Alessandra não vê custos/repasses; recepção comum não vê; devolução/correção/lançamento; lançada não
  muda; lançar duas vezes desfaz tudo) e banco real (transação desfeita: valor sugerido 20.310, médico 7.712,34 em 12x);
  telas no navegador com dados simulados (Alessandra → Luciano).
- Próximo: entrada do pagamento da Alessandra no Caixa? (perguntar); lentes no estoque + nota fiscal (substituir o Invistto;
  ver com o Luciano como ele faz hoje).

## 24/11/2026 — Caixa da Orientação Cirúrgica, separado do caixa da recepção (migração 0098)
Pedido do Dr. Gelson: o dinheiro que a Alessandra recebe (cirurgias, lentes) entra no caixa, mas num caixa SEPARADO da recepção.
- `caixas.setor` = `recepcao` (tudo o que já existia) ou `orientacao`. Um caixa aberto **por setor** (índice `caixas_um_aberto_por_setor`).
  `caixa_abrir(p_fundo, p_setor default 'recepcao')`; `caixa_devolver` confere outro aberto só no mesmo setor.
- Permissões por setor: `interno.caixa_pode(p, setor)` / `interno.caixa_pode_caixa(p, caixa_id)` (RLS das 4 tabelas do caixa).
  Orientação: lança/vê quem tem a marcação Orientação Cirúrgica + faturamento + admin; quem confere/aprova vê os dois.
  A recepção não vê o caixa da orientação. (Obs.: a Alessandra está com função "recepção", então ela vê os dois.)
- Pagamento não pode cair no caixa do outro setor (gatilho `setor_venda`).
- Cada venda de `orientacao_vendas` entra sozinha no caixa da orientação aberto (gatilho `caixa` em orientacao_vendas;
  `caixa_atendimentos.venda_id`). Sem caixa aberto a venda não é registrada. Crédito 1x → crédito à vista; 2x+ → parcelado.
  Correção (depois de devolvida) cancela o pagamento antigo e lança o novo; cancelar a venda cancela no caixa.
  Se o caixa daquele dia já foi fechado, mudar valor/forma ou cancelar exige devolver o caixa antes.
  Lançamentos vindos de venda não são alterados pela tela do caixa (só pela tela de vendas).
- Tela Caixa: botões Recepção / Orientação Cirúrgica (quem vê os dois); tela de Vendas mostra se o caixa da orientação está aberto.
- Testado no banco local (abertura por setor, isolamento, venda → caixa, correção, cancelamento, caixa fechado, repasse).
- (0099) Pedido do Dr. Gelson: a Alessandra fica SÓ com o caixa da orientação. Regra: quem tem função "recepção" E a marcação
  Orientação Cirúrgica não abre/lança/vê o caixa da recepção (`interno.caixa_papel`). Conferir/aprovar não mudaram.
- Vendas da orientação: a lista de procedimentos agora mostra TODOS, agrupados por médico (o escolhido primeiro); antes, ao
  escolher o médico, sumiam os dos outros (para Dr. Max/Dra. Luísa só apareciam Facectomia e Refrativa). Escolher o
  procedimento antes do médico já preenche o médico. Faltam cadastrar os procedimentos do Dr. Max e da Dra. Luísa.
- Procedimentos novos (dados, 24/11, pedido do Dr. Gelson): "Facectomia (Dra. Luiza)" e "Facectomia (Dr. Max)" — regra geral,
  R$ 5.500, anestesista 350, sala 1.100, lente Rayner 190; "Facectomia + TREC (Dr. Max)" — igual à do Dr. Pedro (R$ 10.500,
  sala 1.800, lente 190, anestesista 800) SEM instrumentação de fora. PIX: catarata → médico 2.428; glaucoma Max → médico 4.908.
- (24/11, decisão do Dr. Gelson) Procedimento + médico: cada procedimento aparece UMA vez nas listas (Vendas da orientação e
  Novo repasse). A versão "padrão" não tem médico; a EXCEÇÃO de um médico é um registro com o MESMO nome e o médico
  (`varianteProcedimento` em `app/src/lib/repasse.ts`: exceção do médico → padrão → a única existente). Trocar o médico no
  repasse aplica a versão dele. Tabela de regras mostra padrão e "↳ exceção". Dados: "Facectomia" e "Facectomia + TREC"
  padrão (sem instrumentação) + exceção Dr. Pedro (instrumentação 100 / 200); "Facectomia (Dra. Luiza)" e "(Dr. Max)" desativadas
  (iguais ao padrão). Procedimentos de um médico só (pálpebra, retina) continuam com o médico e valem para quem for escolhido.
- (0101) Cancelar repasse que veio de venda da Orientação: função `repasse_cancelar(p_repasse, p_motivo, p_cancelar_venda)`
  (faturamento/admin) + gatilho `cancela_venda` em repasses. Na tela, o Luciano escolhe: "só corrigir" → a venda volta para
  "Para conferir" (dinheiro continua no caixa); "paciente desistiu" → venda cancelada e valor sai do caixa da Orientação.
  Bloqueia se já há parcela paga ao médico ou custo pago, e (para desistência) se o caixa do dia já foi fechado.
  Cancelar um repasse com venda por outro caminho devolve a venda para conferência (padrão seguro).

## 25/11/2026: Cadastro dos convênios do Micrologos começa pelo Bradesco Saúde (sessão "Dados para migração")
- A dona vai copiar **um convênio por dia** do Micrologos, com um texto padrão no Claude do computador (só leitura).
  Os arquivos ficam em `docs/micrologos/mapeamento-telas/convenios/`. O acompanhamento está no `LEIAME.md` dessa pasta.
- **Migração 0150 `tiss_cadastro_convenios`** (numeração 0150+ da sessão de migração, para não colidir com 0101…):
  - `convenios`: `tiss` (regras), `descontos`, `micrologos_codigo`;
  - `convenio_planos`: `mascara_carteirinha`, `micrologos_codigo`;
  - `precos`: `codigo_guia`, `tabela_guia`, `necessita_autorizacao`, `tabela_preco`;
  - tabelas novas `hospitais`, `hospital_convenio_codigos` e `profissional_convenio_codigos` (RLS: equipe lê, faturamento/admin alteram);
  - `interno.preco_linha` e `interno.tg_item_preco`: o item da conta pega o código e a tabela da guia do preço do convênio
    (ex.: Facectomia, código interno 19, sai como TUSS 30306027 tabela 22 no Bradesco).
    Conta particular continua igual (preços particulares não têm `codigo_guia`).
- **Migração 0151 `convenio_bradesco_saude`:**
  - convênio Bradesco Saúde (ANS 005711, código 0000110502, TISS 4.03.00, .zip) e planos Empresa (4) e Individual (5);
  - 47 procedimentos novos (código interno do Micrologos, tabela '00');
  - preços: 58 no plano Empresa e 55 no Individual, tirados das tabelas 31, 4, 3 e 20 do Micrologos;
  - os 14 hospitais (Unidades) e os 6 códigos de hospital no Bradesco.
  - Teste (desfeito): conta Bradesco Individual com OCT, Corpo estranho e Fluoresceína → 22/41501144 = 77,84; 22/30304032 = 64,04; 20/90548906 = 6,46.
- Pendências do Bradesco: no `LEIAME.md` da pasta de convênios (Epilação em duas tabelas, colírios como tabela 20…).
- Encarregada de dados: nome completo **Ana Carolina Bertolin Moura Brasil** (25/11) — Política de Privacidade e documentos
  do kit LGPD (termos, plano de vazamento). OAB não é exigida para encarregado; e-mail próprio ainda a definir.

### 25/11/2026 — Respostas rápidas do WhatsApp (migração 0102)
- Pedido da dona: a Alessandra usa no WhatsApp Business mensagens prontas com "/" — agora também no sistema.
- Tabela `whatsapp_respostas_rapidas` (setor, atalho, texto; única por setor+atalho; RLS: vê quem vê o número;
  inclui/altera/apaga quem responde o número e a admin; auditoria). Não é modelo da Meta: vai como texto comum (24 h).
- Na conversa: digitar "/" (ou botão ⚡) abre a lista; ↑↓ escolhe, Enter/Tab usa, Esc fecha. `{nome}` vira o primeiro
  nome do paciente. O texto entra na caixa para ajustar antes de enviar.
- Cadastro: 🧰 Ferramentas → ⚡ Respostas rápidas, ou "⚙ Cadastrar / editar" dentro da lista.
- (25/11) **Envio mais rápido na tela**: a mensagem de texto aparece na hora na conversa (🕓) e a caixa limpa; a ida à
  Meta (1–3 s, medido nos logs da função) acontece em segundo plano. Quando confirma vira ✓; se falhar, a bolha fica
  "Não enviada" com o motivo (o texto não se perde). Anexos e áudios continuam esperando o envio.

### 25/11/2026 — Vigia do recebimento do WhatsApp (migração 0103)
- Pedido da dona: o número da orientação está só na API (sem celular para conferir); se o webhook parar, ninguém veria.
- `whatsapp_vigia(setor)` (security invoker): última mensagem recebida, última confirmação ✓✓ da Meta, enviadas sem ✓✓.
- Faixa no alto da coluna do meio da Orientação (`components/VigiaWhatsApp.tsx`): 🟢 recebendo; 🟡 1 h sem sinal; 🔴 2 h
  sem sinal — contando só minutos DENTRO do horário de atendimento (tabela `whatsapp_ausencia`), ou 3+ enviadas sem ✓✓
  sem nenhuma confirmada em 3 h. Atualiza a cada minuto e ao chegar mensagem.
- Clicar abre detalhes e "Testar recebimento": espera até 3 min uma mensagem mandada de qualquer celular e diz se chegou.
- Só aparece no número da orientação (o da clínica ainda não está ligado à API).
- (25/11) **18 respostas rápidas da Orientação cadastradas** (aprovadas pela dona): textos do WhatsApp Business da
  Alessandra revisados (português, negrito, {nome}, campos ___ para completar, sem dados de paciente). Atalhos sem acento
  (endereco, marcacao, saudacao, revisaodeinjecao); a busca na conversa ignora acentos e mostra até 40, começando pelos
  atalhos que começam com o que foi digitado.

### 25/11 — Caixa: incluir exames no mesmo paciente, cancelar e reabrir caixa (migração 0110, pedido da dona)
- Caixa de teste da recepção aberto pela Soraline em 23/11 (vazio) **apagado direto no banco** a pedido da dona.
- **➕ Incluir** (linha do paciente, caixa aberto): o paciente que volta do médico e vai fazer exames fica no MESMO atendimento —
  soma o valor, completa a descrição ("Consulta + Exame (OCT)") e já recebe o pagamento. Não vale para cortesia nem venda da orientação.
  Se o caixa do dia já fechou, lança como novo recebimento.
- **🚫 Cancelar caixa** (só caixa aberto e sem lançamento válido — cancele as linhas antes): fica no histórico como "cancelado".
- **🔁 Reabrir para correção** (fechado, conferido ou aprovado): volta a aberto e passa de novo por fechar/conferir/aprovar.
- Os dois só para quem tem `profissionais.caixa_corrigir` (decisão da dona: **só ela**; não aparece na tela Equipe) + duas etapas da administração.
- Teste no banco (transação desfeita): incluir 100→250 com novo pagamento; Soraline não cancela; caixa com lançamento não cancela;
  fechar → reabrir; cancelar linhas → cancelar caixa → abrir outro. Build OK.

### 25/11 — Caixa: conferência em duas etapas (migração 0111, pedido da dona)
- Caminho novo: aberto → fechado → **dinheiro conferido** (1º check) → **conferido** (conferência completa, 2º check) → aprovado (Luciano).
- 1º check (recepção do 4º andar, no dia): digita o dinheiro que recebeu; a tela compara com o esperado e com o que o térreo contou.
- 2º check (durante a semana): lista com 💳 cartões, 📲 PIX e 🧾 notas fiscais (check geral, com observação), marcada aos poucos;
  com os três marcados, "Conferência completa: entregar ao Luciano".
- Decisão da dona: **a mesma pessoa** do 1º check termina a conferência (a administração com `caixa_corrigir` também pode, para não travar).
  Notas fiscais: check geral por enquanto (sugestão aceita; dá para virar paciente a paciente depois).
- Quem está conferindo pode devolver para correção; reabrir (só a dona) vale também para caixa em conferência.
- Teste no banco (desfeito): pular o 1º check bloqueado; concluir sem notas bloqueado; outra conferente bloqueada; fluxo completo OK. Build OK.
- (25/11) **Corretor, emojis e corrigir mensagem** na conversa do WhatsApp:
  - Caixa de texto com corretor do navegador em português (`spellCheck`, `lang="pt-BR"`): sublinha em vermelho; botão
    direito mostra as sugestões.
  - Botão 😊 com os emojis mais usados (a lista completa do Windows: tecla Windows + ponto).
  - "✏️ Corrigir" nas mensagens de texto enviadas (dentro das 24 h): a API da Meta NÃO permite editar nem apagar
    mensagem enviada; o sistema manda "✏️ *Correção:*" + texto certo como resposta citando a mensagem errada
    (`whatsapp-enviar` v17, parâmetro `corrige`; grava `em_resposta_a`). A mensagem errada fica marcada "corrigida abaixo".
- (25/11) Na Central (telefonia): corretor em português também na conversa interna (aba Interno) e na anotação depois
  da ligação; botão 😊 de emojis na conversa interna. O WhatsApp da Central usa o mesmo `Chat` da Orientação (já tem
  respostas rápidas por número, emojis, corretor e Corrigir). Vigia do recebimento passa a aparecer também no número da
  clínica assim que ele estiver ligado à API (`estado.configurado`).

## 25/11/2026 — Repasse abre em "Para conferir" quando há venda esperando
Primeira venda real (vitrectomia, venda nº 3): entrou certo no caixa da Orientação e ficou "aguardando", mas o Luciano
abriu o Repasse na aba "Lançamentos" e não achou. Agora, sem aba escolhida, a tela abre direto em "Para conferir" se houver
venda aguardando, e as outras abas mostram um aviso com botão para ir até elas.
- (25/11) **Editar mensagem na conversa interna** (migração 0104): o autor edita a própria mensagem por até 24 h
  ("✏️ Editar" no rodapé); fica marcada "editada" e o texto original é guardado em `texto_original` (gatilho
  `editada`; só o texto pode mudar). No WhatsApp, o "✏️ Corrigir" virou um botão azul mais visível (aparece só nas
  mensagens de texto que nós enviamos, enquanto a janela de 24 h estiver aberta).
- (0152) Anestesista pago DIRETO pelo paciente: `orientacao_vendas.anestesista_direto`. A Alessandra informa o valor (o que
  foi pago à clínica vai em "valor"); no repasse a linha do anestesista entra com valor 0 e a anotação "pago direto pelo
  paciente (R$ X)" — não é descontado de novo. No Novo repasse manual há a marcação "pago direto pelo paciente" na linha do
  anestesista. Custos de valor 0 não aparecem em "a pagar". Venda nº 3 (vitrectomia, R$ 23.000 + R$ 2.000 ao Fábio) ajustada.
- (0153, decisão do Dr. Gelson) Caixa é só DINHEIRO em espécie: a venda da Orientação só entra no caixa da Orientação se a
  forma for dinheiro; cartão e PIX não entram. Correção da venda acompanha (mudou para dinheiro → entra; deixou de ser → sai).
  Só precisa de caixa aberto para venda em dinheiro. A venda nº 3 (cartão) ficou no caixa de 25/11, que já estava fechado
  (não altera a conta da gaveta); para tirar, é preciso devolver o caixa e rodar a limpeza da 0153 de novo.
  Pendente perguntar: o caixa da RECEPÇÃO também deve deixar de registrar cartão/PIX?
- (0154) Correção: o Luciano não conseguia DEVOLVER a venda nº 3 (cartão) porque o gatilho da 0153 tentava tirá-la do caixa
  já fechado. Agora caixa fechado só bloqueia quando muda forma, valor ou a venda é cancelada.
- (25/11, migração 0112) A dona esclareceu: a conferência em duas etapas é **só do caixa da recepção**. O caixa da Orientação
  Cirúrgica voltou ao caminho simples (fechado → "Conferir" com um clique → aprovado).
- (0155, decisão do Dr. Gelson) Parcela do cartão "entra" sozinha: toda parcela (menos cobrança ao médico) nasce com
  recebido_em = data_prevista (gatilho `entra_sozinha`); repasses abertos foram preenchidos. Saiu o botão "Entrou hoje";
  a tela mostra "Cai na conta" (✅ já caiu / ⏳ futura). O relatório por médico filtra pelo mês em que a parcela cai
  (serve também de previsão). "Marcar pago hoje" (pagamento ao médico) continua manual.
- (25/11) **Atendimentos encerrados: busca em todos os dias.** Encerrar só arquiva (`arquivada = true`); nada é apagado.
  Na visão 📋 Atendimentos, escrevendo nome ou telefone na busca, a lista procura em todos os encerrados (não só no dia).
  Para o conteúdo, continua 🧰 Ferramentas → 🔎 Pesquisar mensagens (texto e transcrição dos áudios).
- Lançamentos do repasse: o filtro "até" era HOJE e escondia repasses de cirurgia futura (venda paga antes da cirurgia —
  repasse nº 29, vitrectomia de 26/11, "sumiu"). Agora o padrão vai até daqui a 1 ano.
- (25/11) Menu "📋 Atendimentos" da Central/Orientação virou **"📋 Encerradas"**; cartões com "✅ Encerrada · quem
  atendeu"; cabeçalho da conversa encerrada diz quem encerrou e que ela fica guardada em "Encerradas".
- (0156, decisões do Dr. Gelson) Pagamentos AUTOMÁTICOS, sem botão: médico no CRÉDITO → fechamento no dia 20 (parcela que cai
  até o dia 20 é paga no dia 25 do mês; depois, no dia 25 do mês seguinte); PIX/dinheiro/débito → no dia da cirurgia;
  terceiros (auxiliar/instrumentação/anestesista) → à vista no dia da cirurgia. Fim de semana/feriado não importa.
  `interno.repasse_dia_pagamento`, gatilhos `pagar_medico` (parcelas) e `pagar_terceiro` (custos); mudar a data da cirurgia
  recalcula. "Pago" = data de hoje ou passada (a tela calcula "Médico pago"; status no banco fica "aberto", só cobrança fecha).
  Cancelar só é bloqueado se já houver pagamento com data passada. Relatório por médico filtra pela data em que o médico recebe.
  Vitrectomia (repasse 29): parcela 1 cai 25/12 → médico recebe 25/01.
- Repasse: nova aba "Previsão de pagamentos" — tabela médico × mês (3/6/12/24 meses) com quanto cada médico recebe, pelas
  datas automáticas da 0156; clicar no valor mostra de quais repasses/parcelas vem.
- (0157, decisão do Dr. Gelson) Sociedade Dr. Gelson + Dr. Max: em todo repasse de um dos dois (qualquer procedimento,
  qualquer forma de pagamento, venda de lente, Clínica Vital) a parte do médico é dividida 50/50; o centavo que sobra fica com
  o Dr. Gelson. Tabela `repasse_sociedade` (fica_centavo) + visão `repasse_parcelas_medicos` (security_invoker; uma linha por
  parcela e por médico que recebe; demais partes divididas na mesma proporção). Relatório por médico e Previsão usam a visão;
  o repasse mostra a metade de cada um por parcela. Vale para os já lançados (vitrectomia nº 29: R$ 410,48 + R$ 410,48 por
  parcela). Clínica Vital: continua sem imposto e sem os 20%; cirurgião padrão = Dr. Max (R$ 250 para cada).

## 25/11/2026 — Cirurgias do dia: data pela agenda + check "Realizada" (migrações 0158–0159, decisões do Dr. Gelson)
- A venda nasce SEM data de cirurgia; a Alessandra marca depois (quando o paciente volta para exames) — num quadro que
  aparece ao selecionar o paciente na agenda da Orientação (`CirurgiaVendidaAgenda`), na lista de vendas ("marcar data")
  ou em "Cirurgias do dia". Caixinha "Fora da clínica" (sem dizer onde). A venda é a fonte: data, fora e realização vão
  sozinhas para o repasse (`tg_venda_repasse_cirurgia`); venda lançada aceita mudar só esses campos.
- `repasses.data_cirurgia` aceita vazio; repasses/vendas ganharam `fora_clinica`, `realizada_em`, `realizada_por`.
- Tela `/cirurgias-do-dia` (menu "Cirurgias do dia"): lista do dia (vendas + repasses sem venda), check "✔ Realizada"
  (função `cirurgia_realizada`; Alessandra, faturamento/admin e sócios Gelson/Max; a partir do dia da cirurgia),
  quanto cada um recebe (`cirurgias_valores`, só faturamento/admin/sócios; PIX/dinheiro/débito/terceiros no dia;
  crédito → dia 25), WhatsApp/Copiar/Imprimir, e "Faltam data ou check" (`cirurgias_lista(p_pendentes)`).
- SEM check ninguém recebe: relatório e custos a pagar só contam realizadas; o repasse mostra "aguarda realização";
  cancelamento só é barrado se já realizada e com data de pagamento passada. Previsão inclui as futuras.
- (0160) Guia "❓ Como funciona" (fluxo venda → conferência → data → cirurgia → check → pagamentos, + "E se…?") nas telas
  Vendas da orientação, Cirurgias do dia e Repasse médico (`app/src/components/GuiaVendas.tsx`). LEITURA OBRIGATÓRIA nas 5
  primeiras vezes de cada pessoa (tela cheia, faixa vermelha, "Li e entendi" só depois de rolar até o fim + 8 s; no máximo
  1 vez por abertura do sistema). Contagem em `guia_leituras` (funções `guia_vezes`/`guia_li`); admin vê quem leu em
  Cirurgias do dia. Mudou o fluxo? Atualize o texto e suba `GUIA_VERSAO` — a contagem recomeça.

## 25/11/2026: Colunas de setor na agenda, como no Micrologos (sessão "Dados para migração")
- Pedido da dona: a agenda fica com as mesmas colunas e a mesma ordem do Micrologos, **em ordem alfabética**, misturando
  médicos e setores (Antonio, Centro Cirúrgico, Contatólogo, Eveline (Campo Visual), Gelson, Gisele, Luiza, Matheus, Max,
  Orientação Cirúrgica, Ortóptica, Pedro, Renato).
- **Migração 0152 `agenda_colunas_setor`:**
  - `profissionais.agenda_recurso` (coluna de setor, não é pessoa) e `profissionais.sem_acesso` (ativo sem login);
  - o check `profissionais_email_se_ativo` passou a aceitar ativo sem e-mail quando `sem_acesso`;
  - criadas as colunas Centro Cirúrgico, Contatólogo, Eveline (Campo Visual) e Ortóptica (`funcao` enfermagem, sem login);
  - criado o cirurgião de fora **Antonio Carlos de Souza Ferreira** (CRM 52788066-RJ), ativo, sem login. Ele fatura pela
    Unimed como prestador PF.
- `app/src/lib/dados.ts` (`listaAgendas`): inclui `agenda_recurso` e ordena todas as colunas pelo nome. Horários e
  bloqueios dessas colunas são cadastrados na mesma tela dos médicos.
- Pendente (tarefa sugerida à dona): esconder as colunas de setor das listas de PESSOAS (chat interno, ramais, WhatsApp, Equipe).
- Médicos que saíram: Marcos Arnaut e Annamaria Ciminelli (inativos na migração).

## 25/11/2026: Encaixe no mesmo horário (sessão "Dados para migração")
- **Migração 0153 `agenda_encaixe_sobreposicao`:** a regra `agenda_sem_conflito` não vale mais para `encaixe = true` nem para
  agendamentos `atendido`, além de cancelado/faltou como antes. Antes, o botão "Encaixar" (mesmo horário, 15 min) era
  barrado pelo banco. No Micrologos, 26% dos agendamentos ficam no mesmo horário de outro.
- Agenda do Micrologos (ensaio local): 387.732 agendamentos migráveis, 12.950 encaixes.

## 26/11/2026 — Faturamento antigo do Micrologos e relatório de produção (sessão "Dados para migração")
- Migração 0163: `contas.arquivada`, `lotes.arquivado` e coluna `legado` (dados originais do Micrologos) em contas, itens e lotes.
  Conta/lote arquivado não muda (trava no banco); faturamento/admin podem desarquivar. Nº de guia novo pula números já usados.
- Migração 0164: `rel_faturamento(de, até)` — soma itens das contas por médico, convênio, tipo e procedimento.
- Tela Faturamento → Produção refeita: agrupa em 2 níveis, filtra por médico/convênio/tipo, compara com o mesmo período do
  ano anterior ou com o mês anterior, exporta planilha e imprime. Conta e lote mostram de onde vieram no Micrologos.
- Carga das contas: `migracao/transformacoes/06_faturamento.sql` (ensaio local ok; detalhes em `migracao/PROXIMOS-PASSOS.md`).
- Pedido da dona registrado em LACUNAS §4: tirar/recolocar paciente de cobrança já enviada (recurso) e gerar XML de novo.

## 25–26/11/2026 — E-mail da clínica: decisões da dona (sessão "E-mail da clínica")
- **Provedor:** Google Workspace **Business Starter**, pagamento flexível (mensal) no começo; passar para anual quando
  estiver tudo funcionando. Escolhido pelo antispam/antigolpe e pela facilidade de ligar ao sistema (API do Gmail).
- **Domínio só para e-mail: `cmdolhos.com.br`** (registrado pela dona no Registro.br em 25–26/11, titular a clínica,
  contatos na conta dela). DNS na **edição de zona do próprio Registro.br** — nada de Hostinger nem agência.
  "CMD" porque a clínica pensa em virar Hospital de Olhos da Baixada; no futuro o domínio novo entra como domínio extra
  no Google e os dois endereços chegam na mesma caixa.
- `consumedolhos.com.br` (site) **não é usado para e-mail** e não deve ser mexido por esta frente. O DNS dele fica na
  Hostinger (ns1/ns2.dns-parking.com); há uma caixa de e-mail na Hostinger que ninguém usa. O contato técnico no
  Registro.br é de terceiro (agência): trocar para a dona junto com a troca do site.
- **Contas pagas (2):** `diretoria@` (só a dona, administradora do Google) e `clinica@` (conta da equipe). Todos os outros
  endereços são **apelidos grátis** da `clinica@` (até 30): `faturamento@`, `financeiro@`, `contato@`, `cirurgia@`,
  `recepcao@` e um por médico sócio. Nenhum médico vai usar e-mail no celular/fora do sistema.
- **Médicos sócios (5):** Gelson, Luiza, Gisele, Max e Pedro → `dr.gelson@`, `dr.luiza@`, `dr.gisele@`, `dr.max@`,
  `dr.pedro@` (a dona pediu "dr." para todos).
- **Quem vê o quê (aba E-mail do sistema):** cada setor vê só a caixa do seu setor; cada médico vê só a sua caixa;
  a **admin vê todas**. Equipe usa tudo pelo sistema (sem abrir Gmail).
- Próximos passos: dona conclui a contratação e a configuração do DNS (MX `smtp.google.com`, SPF, DMARC `p=none`,
  DKIM) pelo Claude do computador dela; depois criar `clinica@` e os apelidos; depois a aba E-mail (v1: ler, responder,
  encaminhar, enviar com anexos, guardado no banco no Brasil, registro de quem leu/respondeu), no padrão do WhatsApp.

### 26/11 — Caixa: Eveline (tecnóloga) na lista de profissionais (migração 0167, pedido da dona)
- A lista "Médico" do caixa só mostrava médicos. Novo campo `profissionais.atende_pacientes` ("Atende pacientes", tela Equipe):
  quem não é médico mas atende (ex.: tecnóloga) aparece no caixa em "Médico / profissional". Colunas de setor da agenda ficam de fora.
- Marcado para **Eveline Isabel Alves dos Santos** (tecnóloga: campo visual e ortóptica), especialidade preenchida.
- A agenda continua com as colunas "Eveline (Campo Visual)" e "Ortóptica" (migração 0152, sessão de migração) — não mexido.
- Função da Eveline trocada de "Recepção" para **"Enfermagem / Técnico(a)"** (dona, 26/11: ela acessa laudos e prontuário e escreve,
  principalmente na ortóptica). Com isso ela deixa de lançar no caixa; continua aparecendo no caixa como profissional.
- O caixa já tem os exames com preço particular: Campo Visual Particular (R$ 180), Teste Ortóptico (R$ 100),
  Exercício Ortóptico (R$ 50) e 10 sessões (R$ 400) — dá para lançar pelo exame e escolher a Eveline como profissional.
- Para a migração: descobrir no Micrologos onde ficam os registros da Eveline (ortóptica/campo visual — prontuário ou aba própria).

### 26/11 — Caixa: itens que faltavam (migração 0168, pedido da dona/recepção)
- Incluídos na tabela particular: **Consulta Glaucoma — Dr. Max** (R$ 500), **Consulta Córnea — Dr. Pedro** (R$ 600) e
  **Campo Visual — Dual (parceria)** (R$ 140). A Dual é clínica parceira que manda pacientes para campo visual.
- Em aberto: os itens antigos da Micrologos "Consulta Glaucoma" (R$ 600) e "Consulta Córnea" (R$ 500) têm valores trocados em relação
  ao que a recepção informou — perguntar à dona se desativa. Regras da Dual (exames, valores, descontos, quem paga) a levantar no Micrologos.
- (0169) Dona confirmou: consultas diferenciadas têm **preço por médico**. Incluídas também **Consulta Glaucoma — Dr. Pedro** (R$ 600)
  e **Consulta Córnea — Dr. Max** (R$ 500, valor a confirmar). Genéricos da Micrologos mantidos. Retina = só Dr. Gelson (R$ 600, item único).
  Dual: paciente paga na hora no caixa (provisório; muda se a Dual pagar depois).
