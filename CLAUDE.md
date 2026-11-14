# CLAUDE.md — instruções permanentes do projeto "secreto"

## Quem é a dona do projeto e como trabalhar com ela
- A dona do projeto **não é técnica**. Explique tudo em português simples, sem jargão.
- **Autorização total (dada em 2026-11-14):** Claude pode criar, configurar, publicar e
  alterar tudo no **Supabase** e no **Railway** sem pedir permissão a cada passo.
  Não precisa perguntar "posso?" para tarefas técnicas normais.
- Ainda assim, **avise antes** de ações que apagam dados ou não têm volta
  (apagar projeto, tabela, banco, volume, serviço com dados) e de qualquer coisa
  que aumente a conta além dos planos já assinados.

## Infraestrutura
- **Supabase** (banco de dados — guarda prontuários e demais dados)
  - Organização: "Hospital de Olhos da Baixada" (`alqrkumhvyexvrmxaugj`) — plano Pro (assinado pela dona)
  - Projeto principal: **secreto** — id `ogflxjolbwrzayjtxvhj`, região **sa-east-1 (São Paulo)**
- **Railway** (hospedagem — onde o sistema e servidores MCP rodam)
  - Workspace: "anacbertolin's Projects" (`4ddac66d-395d-4818-8895-cfd0b50da2c2`) — plano Hobby
  - Projeto: `generous-smile` (`154b859a-9285-4396-8f26-a4dfa59ac13c`), ambiente `production`
  - Conectado ao GitHub (repositório `anacbertolin/secreto`) para deploy automático.
  - Serviços no projeto:
    - `secreto` (`7284d56c-4c07-426b-b479-69ed3a9c45da`) — reservado para o sistema de prontuário
      (ainda só "staged", nunca publicado; deploy do branch `main`).
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
- **Publicado em:** https://site-production-8c641078.up.railway.app (Railway, serviço `site`,
  região us-east4, Root Directory `/site`, healthcheck `/`).
  - Fonte do serviço `site` (conferido em 2026-11-14 15h): branch **`claude/youthful-cori-erycnr`**,
    de OUTRA sessão, que partiu desta cópia e trocou a marca para "Hospital de Olhos da Baixada".
    Não trocar a fonte do serviço sem combinar com a dona (trocar desfaria a marca nova no ar).
  - Há várias sessões trabalhando em paralelo em branches `claude/*`. Antes de mexer no site ou no
    Railway, rode `git ls-remote --heads origin` e veja a fonte atual do serviço (`describe-service`).
- **Marca:** desde 2026-11-14 o site usa o nome **Hospital de Olhos da Baixada** (antes "Consumed").
  Logo e ícones em `site/marca/`. A troca é feita por `site/ferramentas/trocar_marca.py`
  (rodar de novo depois de refazer a cópia). Domínio, Facebook e busca do Google Maps ainda usam o nome antigo.
- **Supabase:** tabela `public.site_mensagens` (migração `site_mensagens`) guarda o que visitantes
  enviam. RLS ligado; `anon`/`authenticated` só podem INSERIR (sem leitura). Chave publicável
  (pública) está no `site-copia.js`. A dona vê as mensagens no painel: Table Editor → site_mensagens.
- **Decisões da dona:**
  - Manter a cópia exata; não "melhorar" nada sem ela pedir.
  - Nome do médico: manter **"Dr. Max Oliveira Guimarães"**. Testamos trocar para o apelido
    "Dr. Golozão" e a equipe NÃO aprovou — revertido. Não usar apelidos de médicos no site.
- **Defeitos que já existem no site original (copiados de propósito, ainda não corrigidos):**
  páginas rascunho públicas (Homez, Página de exemplo, Procedimentos2, Exames2, Video Background, Link);
  texto de código quebrado "[vc_column…]" visível na página Equipe; botões nas páginas Equipe e
  Convênios apontando para `homologacao.consumedolhos.com.br`; imagem `assist.png` inexistente.
  Oferecer correção quando a dona quiser.

## Próximos passos (pendentes)
1. Dona comparar o site provisório com o original e aprovar.
1b. Juntar ao `main` o branch da outra sessão do site (`claude/youthful-cori-erycnr`, marca nova) e
    então apontar o serviço `site` para `main` — só com o aval da dona.
2. Troca de DNS — antes, verificar com a dona:
   - se os e-mails `@consumedolhos.com.br` rodam na Hostinger (manter registros MX/e-mail intactos);
   - login do registro do domínio (provavelmente Registro.br);
   - contrato/aviso com a agência atual.
   Depois: adicionar domínio próprio no Railway (`generate-domain` com `domain`) e passar a ela os registros DNS.
3. Opcional: aviso por e-mail quando chegar mensagem em `site_mensagens` (hoje ninguém é avisado).
4. Se o site original mudar antes da troca, baixar de novo e rodar `preparar_copia.py`.
5. Fora do site: o Supabase avisa que a função `public.abrir_atendimento` (SECURITY DEFINER) pode
   ser chamada por qualquer usuário logado — revisar quando voltar ao prontuário.

## Regras para dados de saúde (LGPD)
- Prontuário é dado pessoal sensível. Sempre:
  - Habilitar **RLS** (Row Level Security) em toda tabela do schema `public`, com políticas explícitas.
  - Nunca expor a chave `service_role` no frontend nem em commits; segredos só em variáveis do Railway/Supabase.
  - Rodar `get_advisors` (security e performance) depois de toda mudança de estrutura.
  - Manter dados no Brasil (sa-east-1).
- Mudanças de estrutura do banco: usar migrações (`apply_migration`), nunca SQL solto para DDL.
