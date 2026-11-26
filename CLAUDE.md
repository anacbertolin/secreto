# CLAUDE.md — instruções permanentes do projeto "secreto"

## Quem é a dona do projeto e como trabalhar com ela
- **Sempre fale em português (pedido da dona, 15/11/2026):** todas as respostas, mensagens, resumos, descrições de
  PR e textos para a dona em português do Brasil — mesmo que a conversa, o código ou as ferramentas estejam em inglês.
- A dona do projeto **não é técnica**. Explique tudo em português simples, sem jargão.
- **Autorização total (dada em 2026-11-14):** Claude pode criar, configurar, publicar e
  alterar tudo no **Supabase** e no **Railway** sem pedir permissão a cada passo.
  Não precisa perguntar "posso?" para tarefas técnicas normais.
- Ainda assim, **avise antes** de ações que apagam dados ou não têm volta
  (apagar projeto, tabela, banco, volume, serviço com dados) e de qualquer coisa
  que aumente a conta além dos planos já assinados.

## Regra da dona sobre IA (15/11/2026)
- **Nunca chamar o Claude pela API (chave `ANTHROPIC_API_KEY` / console.anthropic.com).** Todo uso do Claude deve sair do
  **plano da conta** (sessões e tarefas agendadas do Claude, como o assistente do WhatsApp). Não criar funções que dependam
  de `ANTHROPIC_API_KEY` e não pedir essa chave à dona.
  - Pendente: o "Resumo do prontuário por IA" (função `prontuario-resumo`, migração 0027, outra sessão) foi feito para a
    API e está desligado; precisa ser refeito no mesmo modelo do assistente (tarefa/sessão do Claude) ou removido.
- Outros serviços de IA pagos à parte só com pedido explícito da dona (ex.: Whisper da OpenAI para transcrever áudios).

## Infraestrutura
- **Supabase** (banco de dados — guarda prontuários e demais dados)
  - Organização: "Hospital de Olhos da Baixada" (`alqrkumhvyexvrmxaugj`) — plano Pro (assinado pela dona)
  - Projeto principal: **secreto** — id `ogflxjolbwrzayjtxvhj`, região **sa-east-1 (São Paulo)**
- **Railway** (hospedagem — onde o sistema e servidores MCP rodam)
  - Workspace: "anacbertolin's Projects" (`4ddac66d-395d-4818-8895-cfd0b50da2c2`) — plano Hobby
  - Projeto: `generous-smile` (`154b859a-9285-4396-8f26-a4dfa59ac13c`), ambiente `production`
  - Conectado ao GitHub (repositório `anacbertolin/secreto`) para deploy automático.
  - Serviços no projeto:
    - `sistema` (`d327757c-981f-4f82-ae0e-7179625a7ea9`) — **o sistema da clínica** (agenda, recepção, prontuário,
      exames). Pasta raiz `/app`. Publica a partir do `main` (desde 14/11/2026, depois do PR #2).
    - `secreto` (`7284d56c-4c07-426b-b479-69ed3a9c45da`) — rascunho antigo ("staged", nunca publicado, sem pasta raiz).
      NÃO usar: o sistema roda no serviço `sistema`. Não aceitar o rascunho (o build falharia).
    - `site` (`825f64cf-f877-4a67-8e0d-c90a487cc6d3`) — site público da clínica (ver seção abaixo).
- **Rede do ambiente de nuvem "secreto"** (sessões Claude): hosts liberados incluem
  `consumedolhos.com.br`, `www.consumedolhos.com.br` e `site-production-8c641078.up.railway.app`.
  O host do Supabase (`*.supabase.co`) NÃO está liberado — testar o banco pelas ferramentas MCP.

## Site público da clínica (consumedolhos.com.br) — estado em 2026-11-14
- **O que é:** cópia fiel (estática) do site atual, que é WordPress + Elementor hospedado na
  Hostinger e feito por uma agência. A dona pediu cópia **exata**, para depois apontar o DNS.
- **Onde está:** pasta `site/` do repositório (leia `site/LEIAME.md`).
  - `site/public/` = site pronto; `site/Caddyfile` + `site/Dockerfile` = servidor (Caddy).
  - `site/extra/site-copia.js` = substitui o WordPress: busca local em `/busca/`
    (índice `/busca/indice.json`) e envio de comentários do blog + formulário de contato para o Supabase.
  - `site/ferramentas/preparar_copia.py` = refaz `site/public/` a partir de um novo download
    (entradas em `site/ferramentas/entrada/`). Use se o site original mudar antes da troca de DNS.
    Depois dele rode `trocar_marca.py`, `corrigir_defeitos.py` e `otimizar_imagens.py` (ordem em `site/LEIAME.md`).
  - Imagens otimizadas em 2026-11-14 (pedido da dona: site demorava a carregar): cada imagem tem
    um `.webp` ao lado, entregue pelo Caddy a quem aceita. Página inicial: imagens de 1,8 MB → ~0,66 MB.
    CDN do Railway LIGADO em 2026-11-15 (pedido da dona). Ele não separa versões pelo cabeçalho Accept,
    então imagens com `.webp` ao lado vão com `Cache-Control: private` (fora do CDN); CSS/JS/fontes e
    páginas HTML ficam no CDN (HTML por até 1 h, limpo a cada publicação). Regras no `site/Caddyfile`.
- **Publicado em:** https://site-production-8c641078.up.railway.app (Railway, serviço `site`,
  região us-east4, Root Directory `/site`, healthcheck `/`).
  - Fonte do serviço `site`: branch **`main`** (desde 2026-11-15, a pedido da dona). Todo push no `main`
    que mexa em `site/` publica o site. Ele contém a marca nova, imagens WebP e os defeitos corrigidos.
  - Há várias sessões trabalhando em paralelo em branches `claude/*`. Antes de mexer no site ou no
    Railway, rode `git ls-remote --heads origin` e veja a fonte atual do serviço (`describe-service`).
- **Marca:** desde 2026-11-14 o site usa o nome **Hospital de Olhos da Baixada** (antes "Consumed").
  Logo e ícones em `site/public/marca/`. A troca é feita por `site/ferramentas/trocar_marca.py`
  (rodar de novo depois de refazer a cópia). Domínio, Facebook e busca do Google Maps ainda usam o nome antigo.
- **Supabase:** tabela `public.site_mensagens` (migração `site_mensagens`) guarda o que visitantes
  enviam. RLS ligado; `anon`/`authenticated` só podem INSERIR (sem leitura). Chave publicável
  (pública) está no `site-copia.js`. A dona vê as mensagens no painel: Table Editor → site_mensagens.
- **Decisões da dona:**
  - Manter a cópia exata; não "melhorar" nada sem ela pedir.
  - Nome do médico: manter **"Dr. Max Oliveira Guimarães"**. Testamos trocar para o apelido
    "Dr. Golozão" e a equipe NÃO aprovou — revertido. Não usar apelidos de médicos no site.
- **Defeitos do site original — CORRIGIDOS em 2026-11-15** (pedido da dona; `site/ferramentas/corrigir_defeitos.py`):
  rascunhos removidos (Homez, Página de exemplo, Procedimentos2, Exames2, Video Background, Link — o Caddyfile
  redireciona); código "[vc_…]" removido (Equipe, A clínica, Contato, Convênios — Contato deixou de ficar
  largo demais no celular); botões da A clínica viraram links reais para /equipe/ e /convenios/; títulos
  Missão/Visão/Valores arrumados; quadro vazio (assist.png) tirado do carrossel de convênios;
  "A Hospital…" → "O Hospital…"; criados `sitemap.xml` e `robots.txt`.
- **Perguntas em aberto para a dona:** qual convênio era o logo "assist" (para recolocar no carrossel);
  o carrossel da página inicial tem Select e GEAP, que não aparecem na página Convênios — qual lista vale?

## Próximos passos (pendentes)
1. Dona comparar o site provisório com o original e aprovar.
2. Troca de DNS — antes, verificar com a dona:
   - se os e-mails `@consumedolhos.com.br` rodam na Hostinger (manter registros MX/e-mail intactos);
   - login do registro do domínio (provavelmente Registro.br);
   - contrato/aviso com a agência atual.
   Depois: adicionar domínio próprio no Railway (`generate-domain` com `domain`) e passar a ela os registros DNS.
3. Opcional: aviso por e-mail quando chegar mensagem em `site_mensagens` (hoje ninguém é avisado).
4. Se o site original mudar antes da troca, baixar de novo e rodar `preparar_copia.py`.
5. (Resolvido) O aviso do Supabase sobre `public.abrir_atendimento` (SECURITY DEFINER) é intencional:
   a função confere se quem chama é médico ou enfermagem (ver `docs/sistema/HISTORICO.md`).

## Como as mudanças entram (decisão da dona, 14/11/2026)
- O **`main` é a versão oficial**. Cada sessão trabalha no seu ramo `claude/*` e manda o trabalho por **PR para o `main`**.
- **Autorização permanente da dona (14/11/2026): Claude abre o PR, faz o merge e o deploy sozinho, sem pedir.**
  Fluxo de toda mudança: commit no ramo `claude/*` da sessão → PR para o `main` → merge (método "merge")
  → Railway publica sozinho a partir do `main` → conferir que o deploy terminou e o sistema/site responde.
  - Antes do merge, confira: sem conflito com o `main` (se houver, junte o `main` no ramo e resolva),
    verificações automáticas (CI) verdes e o build passando (`npm run build` em `app/` quando mexer no sistema).
  - Mudança de banco: aplique a migração (`apply_migration`) e rode `get_advisors` antes do merge.
  - Depois do merge, avise a dona em linguagem simples o que entrou no ar.
  - A autorização não muda as regras de "avise antes": apagar dados, ações sem volta e aumento de custo continuam
    exigindo aviso à dona antes.
- Nunca empurrar direto no `main` nem reescrever o histórico dele (sempre via PR).
- **Avisos de novidade (autorização do Dr. Gelson, 27/11/2026):** quando uma mudança pedida por ele (ou pela dona) mudar o jeito
  de alguém da equipe trabalhar — principalmente quando nasceu de um erro/dúvida dessa pessoa —, Claude pode, sem pedir,
  colocar um aviso curto para quem precisa saber: nova entrada na lista `NOVIDADES` de `app/src/components/Novidades.tsx`
  (aparece uma vez, some no "Entendi"). Texto simples, com o nome da pessoa e o que fazer; e avisar a dona/Dr. Gelson no resumo.

## Regras para dados de saúde (LGPD)
- Prontuário é dado pessoal sensível. Sempre:
  - Habilitar **RLS** (Row Level Security) em toda tabela do schema `public`, com políticas explícitas.
  - Nunca expor a chave `service_role` no frontend nem em commits; segredos só em variáveis do Railway/Supabase.
  - Rodar `get_advisors` (security e performance) depois de toda mudança de estrutura.
  - Manter dados no Brasil (sa-east-1).
- Mudanças de estrutura do banco: usar migrações (`apply_migration`), nunca SQL solto para DDL.

## Sistema (app web) — `app/`
- **Memória do projeto:** leia `docs/sistema/HISTORICO.md` antes de mexer no sistema (o que foi feito, decisões,
  combinados com a sessão de migração, pendências). Acrescente uma seção ao fim a cada dia de trabalho.
- React + Vite + TypeScript, servido como site estático (`npm run build` → `npm start`) no Railway (serviço `sistema`, pasta raiz `/app`).
- Fala direto com o Supabase usando só a chave **publicável**; quem protege os dados são as regras RLS.
- Login: **usuário + senha** para médicos e funcionários; **e-mail + senha** só para a administração (decisão da dona, 16/11;
  migração 0063: o usuário vira por trás o e-mail interno `<usuario>@equipe.consumedolhos.com.br`, que nunca recebe nada).
  Só e-mails cadastrados e ativos em `profissionais` conseguem criar conta
  (gatilho `somente_equipe` em `auth.users`). Senhas temporárias são criadas pelo admin na tela Equipe
  (função Edge `equipe-acesso`); a pessoa troca no primeiro acesso.
- Identidade visual: Consumed · Clínica de Olhos (logos em `app/public`, dados da clínica em `app/src/lib/marca.ts`).
- Módulos v1: Agenda, Recepção, Pacientes, Consultório/Prontuário (PEP oftalmológico), Exames e laudos, Cadastros,
  **Faturamento** (contas/guias, lotes, glosas, produção; migrações 0009–0010; função de equipe `faturamento`),
  **Relatórios** (funções `rel_*`, migração 0011).
  **Caixa da recepção** (migração 0066; menu 💵; separado do repasse; aberto → fechado → conferido → aprovado; marcações
  "Confere o caixa"/"Aprova o caixa" na tela Equipe; detalhes em `docs/sistema/HISTORICO.md`, 19–23/11).
  **Repasse médico** (cirurgia particular; migração 0060; menu 💰, só faturamento/admin; regras em `docs/sistema/HISTORICO.md`, 16/11). Listas oficiais CID-10/ANVISA em `app/public/dados/` (script `app/scripts/gerar_listas.py`).
- Testes de tela com login: NÃO publicar a função `equipe-acesso` com chave mestra/bootstrap (o sistema de segurança
  bloqueia e está certo). Peça à dona um acesso de teste criado por ela na tela Equipe.
- Arquivos de exames: bucket privado `exames` no Storage (até 50 MB por arquivo).
- Importação do Micrologos (migração 0008): `prontuario_legado` (PEP antigo, só leitura, aparece na linha do tempo),
  `paciente_documentos` + bucket privado `documentos` (SHA-256), `convenio_planos` + `plano_id`,
  e-mail opcional para profissional inativo, auditoria pulada com `set app.migracao = 'on'`.
  Decisão da dona: o paciente mantém o MESMO nº de prontuário do Micrologos (carga com OVERRIDING SYSTEM VALUE + setval).
  A coluna `prontuario_anterior` fica disponível para outros números antigos, se necessário.
- **WhatsApp (API oficial da Meta, 15/11/2026):** migração 0012, funções Edge `whatsapp-webhook` (sem login, protegida
  pela assinatura da Meta) e `whatsapp-enviar`, tela `/whatsapp`. Segredos `WHATSAPP_*` ficam só no Supabase (nunca no
  código nem no chat). Toda a equipe (inclusive faturamento) VÊ as conversas; só recepção e admin respondem (decisão da dona, 15/11). Estado e passos para ligar: `docs/sistema/HISTORICO.md` (15/11).
- **Assistente do WhatsApp (15/11/2026):** migrações 0016–0019. Roda pelo **plano do Claude** (tarefa agendada de hora em hora,
  texto em `docs/sistema/assistente-tarefa-agendada.md`) chamando funções do banco; a função Edge `whatsapp-extrator` ficou parada;
  tela `/whatsapp/assistente`. Lê as conversas com IA (Claude), marca na agenda o que foi combinado, avalia o atendimento
  e monta a base do futuro robô (`bot_conhecimento`). Modelo Sonnet 5.5; horário padrão da clínica é parâmetro na tela.
  Nasce **desligado** (liga na tela). Não usa chave de API (decisão da dona); ela já deu o aval para o envio do texto mascarado. Detalhes: `docs/sistema/HISTORICO.md` (15/11, Assistente).
- **E-mail da clínica (25–26/11/2026):** Google Workspace Business Starter no domínio **`cmdolhos.com.br`** (só e-mail; DNS no
  Registro.br, sem Hostinger). Contas pagas `diretoria@` (dona) e `clinica@`; o resto são apelidos grátis (setores e `dr.<nome>@`
  dos 5 sócios). Cada setor/médico vê só a sua caixa; admin vê todas. NÃO usar `consumedolhos.com.br` para e-mail.
  Decisões e estado: `docs/sistema/HISTORICO.md` (25–26/11, E-mail).
- **Transcrição de áudios (15/11/2026):** Whisper da OpenAI (decisão da dona; áudio processado nos EUA). Migração 0040,
  função Edge `whatsapp-transcrever`, segredo `OPENAI_API_KEY`. Detalhes: `docs/sistema/HISTORICO.md`.
- **Telefone no sistema (15/11/2026):** migrações 0050–0051, ramal SIP no navegador (JsSIP/WebRTC) para qualquer central que
  aceite ramal pelo navegador; teste escolhido pela dona: **Api4Com**, sem portabilidade (Telecall continua). Senha do ramal
  em `interno.telefonia_senhas` (nunca no código nem no chat; a admin digita na tela Cadastros → Telefone). Histórico em
  `ligacoes`. Detalhes e passos para ligar: `docs/sistema/HISTORICO.md` (15/11, Telefone).
- Dados de teste do v1 apagados em 14/11/2026 (com autorização). A função Edge `limpeza-teste` está desativada (responde 410).

## Sistema legado: Micrologos (referência obrigatória)
O sistema atual da clínica, que vamos substituir e de onde vamos importar todos os dados, é o **Micrologos**
(Clinic by Micrologos na web + Clinic Master SP no Windows). Tudo o que se sabe sobre ele está em **`docs/micrologos/`**.
Consulte essa pasta antes de projetar telas, tabelas ou importações:
- `docs/micrologos/README.md`: índice e resumo em 30 segundos
- `docs/micrologos/modulos/`: o que o legado faz (agenda, PEP, laudos, faturamento TISS/SUS, repasse, estoque, financeiro, comunicação, cadastros)
- `docs/micrologos/03-modelo-de-dados.md`: entidades legadas (`ID_*`)
- `docs/micrologos/04-migracao-de-dados.md`: ordem de carga e regras de importação
- `docs/micrologos/05-riscos-e-pendencias.md`: riscos, perguntas em aberto e decisões
- `docs/micrologos/anexos/`: inventários brutos (menus, rotas, endpoints, campos, textos da interface), bons para `grep`
- Marcadores nos documentos: ✅ confirmado · 🔶 inferido · ❓ a confirmar. Ao confirmar algo, atualize o documento.
- O ambiente de nuvem **"secreto"** libera acesso aos sites `*.micrologos.com.br` (o ambiente Default não tem esse acesso).

## Migração dos dados do Micrologos (sessão "Dados para migração")
- **Comece por `migracao/PROXIMOS-PASSOS.md`** (estado atual e o que fazer). Roteiro técnico: `migracao/README.md` · Guia para a dona: `migracao/GUIA-PASSO-A-PASSO.md`.
- Dados crus entram no schema privado `legacy_micrologos` (migração `0100_migracao_staging`); de-para em `legacy_micrologos.mapa_ids`.
- **Nunca** commitar arquivos exportados (dados de pacientes). Ficam fora do repositório e no Storage `migracao-micrologos`.
