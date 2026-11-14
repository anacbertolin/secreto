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

## Sistema (app web) — `app/`
- React + Vite + TypeScript, servido como site estático (`npm run build` → `npm start`) no Railway (serviço `sistema`, pasta raiz `/app`, ramo `claude/trusting-tesla-e5u50x`).
- Fala direto com o Supabase usando só a chave **publicável**; quem protege os dados são as regras RLS.
- Login: e-mail + senha (Supabase Auth). Só e-mails cadastrados e ativos em `profissionais` conseguem criar conta
  (gatilho `somente_equipe` em `auth.users`). Senhas temporárias são criadas pelo admin na tela Equipe
  (função Edge `equipe-acesso`); a pessoa troca no primeiro acesso.
- Identidade visual: Consumed · Clínica de Olhos (logos em `app/public`, dados da clínica em `app/src/lib/marca.ts`).
- Módulos v1: Agenda, Recepção, Pacientes, Consultório/Prontuário (PEP oftalmológico), Exames e laudos, Cadastros.
- Arquivos de exames: bucket privado `exames` no Storage (até 50 MB por arquivo).
- Importação do Micrologos (migração 0008): `prontuario_legado` (PEP antigo, só leitura, aparece na linha do tempo),
  `paciente_documentos` + bucket privado `documentos` (SHA-256), `convenio_planos` + `plano_id`,
  e-mail opcional para profissional inativo, auditoria pulada com `set app.migracao = 'on'`.
  Decisão da dona: o paciente mantém o MESMO nº de prontuário do Micrologos (carga com OVERRIDING SYSTEM VALUE + setval).
  A coluna `prontuario_anterior` fica disponível para outros números antigos, se necessário.
- Dados de teste do v1 apagados em 14/11/2026 (com autorização). A função Edge `limpeza-teste` está desativada (responde 410).
