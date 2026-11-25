-- =====================================================================
-- Transformação: MEDICOS (Micrologos) -> public.profissionais  (de-para em legacy_micrologos.mapa_ids, entidade 'medico')
-- Rodar numa transação com: set local app.migracao = 'on';  Idempotente.
--
-- 1) Quem já existe no sistema novo (cadastrado pela equipe, com login) é LIGADO, não duplicado:
--    pelo nº do CRM (só dígitos, sem o "52" do RJ e sem zeros à esquerda) e, se não achar, pelo nome
--    (sem acento, primeiro e último nome). Ex.: Pedro Boni tem 2 cadastros no Micrologos (19 e 21) -> o mesmo profissional.
-- 2) Médicos antigos que não estão no sistema novo entram como profissionais INATIVOS, sem login
--    (e-mail vazio é permitido para inativo, migração 0008), só para o histórico de agenda e prontuário.
-- 3) "Agendas" do Micrologos que não são pessoas (0 Sem Médico, 12 Centro Cirúrgico, 20 Ortóptica,
--    23 Consumed Olhos, 28 Orientação Cirúrgica, 31 Contatólogo, 6 Eveline/Campo Visual, 9 Fernanda,
--    25 Médico Transcrição, 26 Prestador Não Identificado) NÃO entram aqui: ❓ aguardam decisão da dona
--    sobre como ficam as agendas de recurso no sistema novo (ver migracao/PROXIMOS-PASSOS.md).
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

-- conferência
select m.cod, legacy_micrologos.txt(m.nome) as micrologos, p.nome as sistema_novo, p.ativo, p.email is not null as tem_login
from _med m
join legacy_micrologos.mapa_ids x on x.entidade = 'medico' and x.legacy_id = m.cod::text
join public.profissionais p on p.id = x.novo_id
order by m.cod;
