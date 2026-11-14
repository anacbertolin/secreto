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
  - Serviço **site** (pasta `/site`): publica a partir do branch `claude/youthful-cori-erycnr`
    (trocado em 2026-11-14 para lançar a marca Hospital de Olhos da Baixada).
- **Marca:** nome Hospital de Olhos da Baixada (antes Consumed). Logo em `marca/`.

## Regras para dados de saúde (LGPD)
- Prontuário é dado pessoal sensível. Sempre:
  - Habilitar **RLS** (Row Level Security) em toda tabela do schema `public`, com políticas explícitas.
  - Nunca expor a chave `service_role` no frontend nem em commits; segredos só em variáveis do Railway/Supabase.
  - Rodar `get_advisors` (security e performance) depois de toda mudança de estrutura.
  - Manter dados no Brasil (sa-east-1).
- Mudanças de estrutura do banco: usar migrações (`apply_migration`), nunca SQL solto para DDL.
