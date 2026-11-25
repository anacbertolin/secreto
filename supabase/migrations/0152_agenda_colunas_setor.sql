-- =====================================================================
-- 0152 — Colunas de setor na agenda, como no Micrologos (pedido da dona, 25/11/2026)
-- Sessão "Dados para migração".
-- No Micrologos a agenda tem colunas de médicos E de setores, todas em ordem alfabética:
-- Antonio, Centro Cirúrgico, Contatólogo, Eveline (Campo Visual), Gelson, Gisele, Luiza, Matheus, Max,
-- Orientação Cirúrgica, Ortóptica, Pedro, Renato. A dona pediu a mesma organização no sistema novo.
--
-- - profissionais.agenda_recurso: a "pessoa" é na verdade uma coluna de setor da agenda (não é médico, não tem prontuário).
-- - profissionais.sem_acesso: cadastro ATIVO, mas sem login (colunas de setor e o cirurgião de fora, que só
--   aparece no faturamento da Unimed). Ativo sem e-mail passa a ser permitido nesse caso.
-- - Colunas criadas: Centro Cirúrgico, Contatólogo, Eveline (Campo Visual) e Ortóptica.
--   A Orientação Cirúrgica já existe (coluna da Alessandra, migração 0094).
-- - Cirurgião de fora: Dr. Antonio Carlos de Souza Ferreira (CRM 52788066-RJ), ativo, sem login. Fatura pela
--   Unimed como prestador pessoa física (códigos na migração dos convênios).
-- =====================================================================

alter table public.profissionais
  add column if not exists agenda_recurso boolean not null default false,
  add column if not exists sem_acesso boolean not null default false;
comment on column public.profissionais.agenda_recurso is 'Coluna de setor da agenda (ex.: Centro Cirúrgico, Ortóptica). Não é uma pessoa da equipe.';
comment on column public.profissionais.sem_acesso is 'Cadastro ativo sem login no sistema (colunas de setor e médicos de fora).';

alter table public.profissionais drop constraint if exists profissionais_email_se_ativo;
alter table public.profissionais add constraint profissionais_email_se_ativo
  check (email is not null or not ativo or sem_acesso);

insert into public.profissionais (nome, email, funcao, ativo, agenda_recurso, sem_acesso)
select v.nome, null, 'enfermagem', true, true, true
from (values ('Centro Cirúrgico'), ('Contatólogo'), ('Eveline (Campo Visual)'), ('Ortóptica')) v(nome)
where not exists (select 1 from public.profissionais p where p.nome = v.nome);

insert into public.profissionais (nome, email, funcao, conselho, numero_conselho, uf_conselho, cbo, ativo, sem_acesso)
select 'Antonio Carlos de Souza Ferreira', null, 'medico', 'CRM', '52788066', 'RJ', '225265', true, true
where not exists (select 1 from public.profissionais p where p.nome = 'Antonio Carlos de Souza Ferreira');
