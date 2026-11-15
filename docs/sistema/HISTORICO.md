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
