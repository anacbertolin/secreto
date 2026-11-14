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

## Regras para dados de saúde (LGPD)
- Prontuário é dado pessoal sensível. Sempre:
  - Habilitar **RLS** (Row Level Security) em toda tabela do schema `public`, com políticas explícitas.
  - Nunca expor a chave `service_role` no frontend nem em commits; segredos só em variáveis do Railway/Supabase.
  - Rodar `get_advisors` (security e performance) depois de toda mudança de estrutura.
  - Manter dados no Brasil (sa-east-1).
- Mudanças de estrutura do banco: usar migrações (`apply_migration`), nunca SQL solto para DDL.

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
