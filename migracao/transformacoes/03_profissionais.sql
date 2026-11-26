-- =====================================================================
-- Transformação: MEDICOS (Micrologos) -> public.profissionais  (de-para em legacy_micrologos.mapa_ids, entidade 'medico')
-- Rodar numa transação com: set local app.migracao = 'on';  Idempotente.
--
-- 1) Quem já existe no sistema novo (cadastrado pela equipe, com login) é LIGADO, não duplicado:
--    pelo nº do CRM (só dígitos, sem o "52" do RJ e sem zeros à esquerda) e, se não achar, pelo nome
--    (sem acento, primeiro e último nome). Ex.: Pedro Boni tem 2 cadastros no Micrologos (19 e 21) -> o mesmo profissional.
-- 2) Médicos antigos que não estão no sistema novo entram como profissionais INATIVOS, sem login
--    (e-mail vazio é permitido para inativo, migração 0008), só para o histórico de agenda e prontuário.
-- 3) Colunas de setor (decisão da dona, 25/11/2026; migração 0152): 12 Centro Cirúrgico, 20 Ortóptica,
--    31 Contatólogo e 6 Eveline (Campo Visual) -> as colunas de setor criadas na 0152; 28 Orientação Cirúrgica
--    -> a coluna da Orientação (Alessandra, profissionais.orientacao_cirurgica). Sem agenda e sem uso:
--    0 Sem Médico, 9 Fernanda, 23 Consumed Olhos, 25 Médico Transcrição, 26 Prestador Não Identificado (não entram).
-- 5) Antonio Carlos de Souza Ferreira (24, cirurgião de fora) fica ATIVO sem login (0152). Marcos Arnaut e
--    Annamaria não trabalham mais na clínica -> inativos.
-- 4) Luciano Campino Pinto (8, instrumentador, COREN) já existe no sistema novo (faturamento) -> ligado pelo nome.
-- =====================================================================

create or replace function pg_temp.crm_chave(p text) returns text language sql immutable as $$
  select nullif(ltrim(regexp_replace(coalesce(legacy_micrologos.so_digitos(p), ''), '^52', ''), '0'), '')
$$;
create or replace function pg_temp.nome_chave(p text) returns text language sql immutable as $$
  select split_part(n, ' ', 1) || ' ' || reverse(split_part(reverse(n), ' ', 1))
  from (select upper(regexp_replace(translate(legacy_micrologos.txt(p),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '\s+', ' ', 'g')) n) x
$$;

insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'medico', v.cod, p.id, 'public.profissionais'
from (values ('12', 'Centro Cirúrgico'), ('20', 'Ortóptica'), ('31', 'Contatólogo'), ('6', 'Eveline (Campo Visual)')) v(cod, nome)
join public.profissionais p on p.nome = v.nome and p.agenda_recurso
on conflict (entidade, legacy_id) do nothing;
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'medico', '28', p.id, 'public.profissionais'
from public.profissionais p where p.orientacao_cirurgica and p.funcao <> 'medico' and p.ativo
order by p.nome limit 1
on conflict (entidade, legacy_id) do nothing;

create temp table _med as
select m.*, btrim(m.id_medico)::int as cod, pg_temp.crm_chave(m.crm) as crm_k, pg_temp.nome_chave(m.nome) as nome_k
from legacy_micrologos.bruto_medicos m
where btrim(m.id_medico)::int not in (0, 6, 9, 12, 20, 23, 25, 26, 28, 31);

-- 1) ligar a quem já existe (CRM; depois nome)
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'medico', m.cod::text, coalesce(
         (select p.id from public.profissionais p where m.crm_k is not null and pg_temp.crm_chave(p.numero_conselho) = m.crm_k limit 1),
         (select p.id from public.profissionais p where pg_temp.nome_chave(p.nome) = m.nome_k limit 1)),
       'public.profissionais'
from _med m
where coalesce(
         (select p.id from public.profissionais p where m.crm_k is not null and pg_temp.crm_chave(p.numero_conselho) = m.crm_k limit 1),
         (select p.id from public.profissionais p where pg_temp.nome_chave(p.nome) = m.nome_k limit 1)) is not null
on conflict (entidade, legacy_id) do nothing;

-- 2) médicos antigos (inativos, sem login)
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'medico', m.cod::text, gen_random_uuid(), 'public.profissionais'
from _med m
where not exists (select 1 from legacy_micrologos.mapa_ids x where x.entidade = 'medico' and x.legacy_id = m.cod::text);

insert into public.profissionais (id, nome, email, funcao, conselho, numero_conselho, uf_conselho, cbo, ativo)
select x.novo_id, legacy_micrologos.txt(m.nome), null,
       (case when upper(coalesce(m.conselho_profissional, 'CRM')) like 'CRM%' then 'medico' else 'enfermagem' end)::public.funcao_profissional,
       coalesce(nullif(upper(btrim(m.conselho_profissional)), ''), 'CRM'),
       legacy_micrologos.txt(m.crm),
       coalesce(legacy_micrologos.uf(m.conselho_profissional_estado), 'RJ'),
       case when upper(coalesce(m.conselho_profissional, 'CRM')) like 'CRM%' then '225265' end,
       false
from _med m
join legacy_micrologos.mapa_ids x on x.entidade = 'medico' and x.legacy_id = m.cod::text
where not exists (select 1 from public.profissionais p where p.id = x.novo_id);

-- dados para o XML TISS (migrações 0169/0170): nome do médico como sai na guia (profissional_dados_tiss) e CPF
-- (profissionais_dados_pessoais, a mesma tabela da Memed: só admin e o próprio leem; o XML lê por tiss_dados_medicos()).
-- O CPF é necessário: sem código próprio no convênio, o Micrologos identifica o médico na guia pelo CPF (XML reais, 26/11).
create temp table _md_tiss as
select distinct on (x.novo_id) x.novo_id as prof, legacy_micrologos.txt(md.nome) as nome_guia,
  case when length(regexp_replace(coalesce(md.cpf, ''), '\D', '', 'g')) = 11 then regexp_replace(md.cpf, '\D', '', 'g') end as cpf
from legacy_micrologos.bruto_medicos md
join legacy_micrologos.mapa_ids x on x.entidade = 'medico' and x.legacy_id = btrim(md.id_medico)
where exists (select 1 from public.profissionais p where p.id = x.novo_id)
order by x.novo_id, (length(regexp_replace(coalesce(md.cpf, ''), '\D', '', 'g')) = 11) desc, btrim(md.id_medico)::int;

insert into public.profissional_dados_tiss (profissional_id, nome_guia)
select prof, nome_guia from _md_tiss where nome_guia is not null
on conflict (profissional_id) do update set nome_guia = excluded.nome_guia;

insert into public.profissionais_dados_pessoais (profissional_id, cpf)
select prof, cpf from _md_tiss where cpf is not null
on conflict (profissional_id) do update set cpf = coalesce(public.profissionais_dados_pessoais.cpf, excluded.cpf);

-- conferência
select m.cod, legacy_micrologos.txt(m.nome) as micrologos, p.nome as sistema_novo, p.ativo, p.email is not null as tem_login
from _med m
join legacy_micrologos.mapa_ids x on x.entidade = 'medico' and x.legacy_id = m.cod::text
join public.profissionais p on p.id = x.novo_id
order by m.cod;
