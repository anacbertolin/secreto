-- =====================================================================
-- 0170 — CPF do médico num lugar só (sessão "Dados para migração", 26/11/2026)
-- O CPF do médico já existe em profissionais_dados_pessoais (Memed; só admin e o próprio leem, auditoria sem o CPF).
-- A 0169 tinha criado outra coluna de CPF em profissional_dados_tiss (vazia; a auditoria comum gravaria o CPF no log).
-- Agora: profissional_dados_tiss guarda só o nome como sai na guia; o XML lê o CPF pela função tiss_dados_medicos(),
-- liberada só para faturamento/admin (quem gera o XML), sem abrir a tabela de dados pessoais.
-- =====================================================================
alter table public.profissional_dados_tiss drop column if exists cpf;
comment on table public.profissional_dados_tiss is 'Nome do médico como sai na guia TISS (ex.: "Gisele Moura Brasil"). O CPF fica em profissionais_dados_pessoais.';

create or replace function public.tiss_dados_medicos()
returns table (profissional_id uuid, nome_guia text, cpf text)
language sql stable security definer set search_path = '' as $$
  select p.id, t.nome_guia, d.cpf
  from public.profissionais p
  left join public.profissional_dados_tiss t on t.profissional_id = p.id
  left join public.profissionais_dados_pessoais d on d.profissional_id = p.id
  where (select interno.tem_funcao('faturamento', 'admin'))
    and (t.nome_guia is not null or d.cpf is not null)
$$;
revoke execute on function public.tiss_dados_medicos() from public, anon;
grant execute on function public.tiss_dados_medicos() to authenticated;
