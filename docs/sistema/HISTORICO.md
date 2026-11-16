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
