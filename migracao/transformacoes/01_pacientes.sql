-- =====================================================================
-- Transformação: legacy_micrologos.bruto_pacientes (+ bruto_pacientes_telefones) -> public.pacientes
-- Colunas REAIS do Micrologos (MLMASTER.FDB, tabela PACIENTES), conferidas em 25/11/2026.
-- Idempotente: pode rodar de novo sem duplicar (de-para em legacy_micrologos.mapa_ids).
-- Rodar numa transação com:  set local app.migracao = 'on';
--
-- Decisões:
-- - Nº do prontuário = ID_PACIENTE do Micrologos (decisão da dona: o mesmo número). A FICHA, quando é
--   diferente do ID (cerca de 3 mil casos, quase todos com letras), vai para prontuario_anterior.
-- - Pacientes de teste do Micrologos (69489 "Teste" e 108477 "Teste Micrologos") e o registro 0 NÃO entram.
-- - CPF repetido (decisão da dona, 25/11/2026):
--   * MESMO CPF + MESMO NOME (sem acento/maiúsculas): é a mesma pessoa -> JUNTA num só prontuário. Fica o
--     nº MAIS ANTIGO (o primeiro cadastro); os dados de contato vêm do cadastro mais recente; os outros nºs
--     vão para prontuario_anterior e para legacy_micrologos.fusoes_pacientes. Agenda, atendimentos e contas
--     dos nºs juntados apontam para o prontuário que ficou (legacy_micrologos.novo_id), em ordem cronológica.
--   * MESMO CPF + NOMES DIFERENTES (ex.: dependente com o CPF do responsável): NÃO junta. O CPF fica só no
--     cadastro mais recente; os outros ficam sem CPF, com observação.
-- - Telefones: os do cadastro (TELEFONE1..4) e os da tabela PACIENTES_TELEFONES, só dígitos com DDD.
--   Número sem DDD (8 ou 9 dígitos, cerca de 26 mil) recebe o DDD 21 da clínica (❓ confirmar com a dona).
-- - Convênio/plano: pelo ID_CONVENIO (= plano no Micrologos) -> convenio_planos.micrologos_codigo, quando
--   o plano já estiver cadastrado; senão fica vazio (preenchido quando o convênio for carregado).
-- =====================================================================

-- 1) Quem entra
create temp table _pac as
select b.*,
       btrim(b.id_paciente)::bigint as num,
       legacy_micrologos.cpf(b.cpf) as cpf_ok
from legacy_micrologos.bruto_pacientes b
where btrim(b.id_paciente) ~ '^[0-9]+$'
  and btrim(b.id_paciente)::bigint not in (0, 69489, 108477)
  and legacy_micrologos.txt(b.nome) is not null;

-- 2) CPF repetido
create or replace function pg_temp.nome_norm(p text) returns text language sql immutable as $$
  select upper(regexp_replace(translate(legacy_micrologos.txt(p),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '\s+', ' ', 'g'))
$$;
-- 2a) mesmo CPF + mesmo nome: juntar (fica o nº mais antigo)
create temp table _grupo as
select cpf_ok, min(num) as fica, max(num) as mais_recente, array_agg(num order by num) as nums
from _pac where cpf_ok is not null
group by cpf_ok having count(*) > 1 and count(distinct pg_temp.nome_norm(nome)) = 1;

insert into legacy_micrologos.fusoes_pacientes (legacy_id_mantido, legacy_id_fundido, criterio, decidido_por)
select g.fica::text, n::text, 'cpf+nome', 'dona (regra geral, 25/11/2026)'
from _grupo g, unnest(g.nums) n where n <> g.fica
on conflict (legacy_id_fundido) do nothing;

-- quem foi juntado sai da lista; o que fica usa os dados do cadastro mais recente
create temp table _junta as
select g.fica, r.* from _grupo g join _pac r on r.num = g.mais_recente;
delete from _pac p using legacy_micrologos.fusoes_pacientes f where f.legacy_id_fundido = p.num::text;
update _pac p set
  nome = j.nome, nome_social = j.nome_social, cpf = j.cpf, cartao_nacional_saude = coalesce(j.cartao_nacional_saude, p.cartao_nacional_saude),
  rg = coalesce(j.rg, p.rg), mae = coalesce(j.mae, p.mae), e_mail = coalesce(j.e_mail, p.e_mail),
  cep = j.cep, logradouro_tipo = j.logradouro_tipo, logradouro_nome = j.logradouro_nome, logradouro_numero = j.logradouro_numero,
  logradouro_complemento = j.logradouro_complemento, bairro = j.bairro, cidade = j.cidade, estado = j.estado,
  telefone1 = j.telefone1, telefone2 = j.telefone2, telefone3 = j.telefone3, telefone4 = j.telefone4,
  id_convenio = j.id_convenio, matricula_convenio = j.matricula_convenio, data_validade_convenio = j.data_validade_convenio,
  responsavel = j.responsavel, responsavel_telefone1 = j.responsavel_telefone1, responsavel_parentesco = j.responsavel_parentesco,
  data_nascimento = coalesce(p.data_nascimento, j.data_nascimento)
from _junta j where j.fica = p.num;

-- 2b) mesmo CPF + nomes diferentes: o CPF fica no cadastro mais recente
create temp table _cpf_dono as
select distinct on (cpf_ok) cpf_ok, num from _pac where cpf_ok is not null order by cpf_ok, num desc;

insert into legacy_micrologos.ocorrencias (entidade, legacy_id, severidade, regra, mensagem)
select 'paciente', p.num::text, 'aviso', 'cpf_repetido', 'CPF igual ao do prontuário ' || d.num || ' (possível cadastro duplicado)'
from _pac p join _cpf_dono d on d.cpf_ok = p.cpf_ok and d.num <> p.num
where not exists (select 1 from legacy_micrologos.ocorrencias o where o.entidade='paciente' and o.legacy_id=p.num::text and o.regra='cpf_repetido');

insert into legacy_micrologos.ocorrencias (entidade, legacy_id, severidade, regra, mensagem)
select 'paciente', p.num::text, 'info', 'cpf_invalido', 'CPF do Micrologos inválido; não migrado'
from _pac p where p.cpf is not null and btrim(p.cpf) <> '' and p.cpf_ok is null
  and not exists (select 1 from legacy_micrologos.ocorrencias o where o.entidade='paciente' and o.legacy_id=p.num::text and o.regra='cpf_invalido');

-- 3) Telefones (até 2 distintos por paciente)
create or replace function pg_temp.tel(p text) returns text language sql immutable as $$
  select coalesce(legacy_micrologos.telefone(p),
                  case when length(legacy_micrologos.so_digitos(p)) in (8, 9) then '21' || legacy_micrologos.so_digitos(p) end)
$$;

create temp table _tel as
with todos as (
  select num, 1 as ordem, pg_temp.tel(telefone1) t from _pac
  union all select num, 2, pg_temp.tel(telefone2) from _pac
  union all select num, 3, pg_temp.tel(telefone3) from _pac
  union all select num, 4, pg_temp.tel(telefone4) from _pac
  union all select coalesce(f.legacy_id_mantido::bigint, btrim(t.id_paciente)::bigint), 10,
                   pg_temp.tel(coalesce(t.ddd, '') || coalesce(t.telefone, ''))
  from legacy_micrologos.bruto_pacientes_telefones t
  left join legacy_micrologos.fusoes_pacientes f on f.legacy_id_fundido = btrim(t.id_paciente)
  where btrim(t.id_paciente) ~ '^[0-9]+$'
), unicos as (
  select distinct on (num, t) num, t, ordem from todos where t is not null order by num, t, ordem
)
select num,
       (array_agg(t order by ordem))[1] as tel1,
       (array_agg(t order by ordem))[2] as tel2
from unicos group by num;

-- 3b) Resumo dos juntados (para o prontuário que ficou)
create temp table _junt_info as
select f.legacy_id_mantido::bigint as fica, string_agg(f.legacy_id_fundido, ', ' order by f.legacy_id_fundido::bigint) as lista
from legacy_micrologos.fusoes_pacientes f group by 1;
create temp table _inclusao as
select coalesce(f.legacy_id_mantido::bigint, btrim(b.id_paciente)::bigint) as num, min(legacy_micrologos.data_hora(b.data_inclusao)) as quando
from legacy_micrologos.bruto_pacientes b
left join legacy_micrologos.fusoes_pacientes f on f.legacy_id_fundido = btrim(b.id_paciente)
where btrim(b.id_paciente) ~ '^[0-9]+$' group by 1;
create index on _inclusao (num);
create index on _junt_info (fica);
create index on _tel (num);
analyze _pac; analyze _tel; analyze _inclusao; analyze _junt_info;

analyze legacy_micrologos.fusoes_pacientes;

-- 4) De-para (um uuid novo por paciente)
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'paciente', p.num::text, gen_random_uuid(), 'public.pacientes' from _pac p
on conflict (entidade, legacy_id) do nothing;

analyze legacy_micrologos.mapa_ids;

-- 5) Inserção (mesmo nº do Micrologos: OVERRIDING SYSTEM VALUE)
insert into public.pacientes (
  id, numero_prontuario, prontuario_anterior, nome, nome_social, data_nascimento, sexo, cpf, cns, rg, nome_mae,
  telefone, telefone_secundario, email, cep, logradouro, numero, complemento, bairro, cidade, uf,
  responsavel_nome, responsavel_telefone, responsavel_parentesco,
  convenio_id, plano_id, convenio_carteirinha, convenio_validade, observacoes, ativo, criado_em)
overriding system value
select m.novo_id,
  p.num,
  nullif(concat_ws(' · ',
    case when legacy_micrologos.txt(p.ficha) is not null and btrim(p.ficha) <> p.num::text then 'Ficha ' || legacy_micrologos.txt(p.ficha) end,
    case when ji.lista is not null then 'Juntado com nº ' || ji.lista end), ''),
  legacy_micrologos.txt(p.nome),
  legacy_micrologos.txt(p.nome_social),
  legacy_micrologos.data(p.data_nascimento),
  legacy_micrologos.sexo(p.sexo),
  case when d.num = p.num then p.cpf_ok end,
  legacy_micrologos.cns(p.cartao_nacional_saude),
  legacy_micrologos.txt(p.rg),
  legacy_micrologos.txt(p.mae),
  t.tel1, t.tel2,
  legacy_micrologos.email(p.e_mail),
  legacy_micrologos.cep(p.cep),
  legacy_micrologos.txt(concat_ws(' ', p.logradouro_tipo, p.logradouro_nome)),
  legacy_micrologos.txt(p.logradouro_numero),
  legacy_micrologos.txt(p.logradouro_complemento),
  legacy_micrologos.txt(p.bairro),
  legacy_micrologos.txt(p.cidade),
  legacy_micrologos.uf(p.estado),
  legacy_micrologos.txt(p.responsavel),
  pg_temp.tel(p.responsavel_telefone1),
  legacy_micrologos.txt(p.responsavel_parentesco),
  pl.convenio_id, pl.id,
  legacy_micrologos.txt(p.matricula_convenio),
  legacy_micrologos.data(p.data_validade_convenio),
  nullif(concat_ws(E'\n\n',
    case when legacy_micrologos.txt(p.historico) is not null then 'Histórico (Micrologos): ' || legacy_micrologos.txt(p.historico) end,
    case when legacy_micrologos.txt(p.observacao_atendimento) is not null then 'Obs. de atendimento (Micrologos): ' || legacy_micrologos.txt(p.observacao_atendimento) end,
    case when legacy_micrologos.txt(p.observacao_convenio) is not null then 'Obs. do convênio (Micrologos): ' || legacy_micrologos.txt(p.observacao_convenio) end,
    case when d2.num is not null then 'Atenção: CPF igual ao do prontuário ' || d2.num || ' (nome diferente; pode ser dependente).' end,
    case when ji.lista is not null then 'Prontuários juntados (mesmo CPF e nome): ' || ji.lista || '. O histórico deles está neste prontuário.' end
  ), ''),
  coalesce(p.inativo, 'N') <> 'S',
  coalesce(inc.quando, now())
from _pac p
left join _junt_info ji on ji.fica = p.num
left join _inclusao inc on inc.num = p.num
join legacy_micrologos.mapa_ids m on m.entidade = 'paciente' and m.legacy_id = p.num::text
left join _cpf_dono d on d.cpf_ok = p.cpf_ok
left join _cpf_dono d2 on d2.cpf_ok = p.cpf_ok and d2.num <> p.num
left join _tel t on t.num = p.num
left join public.convenio_planos pl on pl.micrologos_codigo::text = btrim(p.id_convenio)
on conflict (id) do nothing;

-- 6) Próximo paciente novo continua depois do maior nº do Micrologos
select setval(pg_get_serial_sequence('public.pacientes', 'numero_prontuario'),
              greatest((select max(numero_prontuario) from public.pacientes), 1));

-- 7) Conferência
analyze public.pacientes;
analyze legacy_micrologos.mapa_ids;
select
  (select count(*) from _pac)                                              as candidatos,
  (select count(*) from public.pacientes p join legacy_micrologos.mapa_ids m
     on m.novo_id = p.id and m.entidade = 'paciente')                      as migrados,
  (select count(*) from public.pacientes where cpf is not null)            as com_cpf,
  (select count(*) from public.pacientes where telefone is not null)       as com_telefone,
  (select count(*) from public.pacientes where data_nascimento is not null) as com_nascimento,
  (select count(*) from public.pacientes where plano_id is not null)       as com_plano,
  (select count(*) from public.pacientes where prontuario_anterior is not null) as com_nr_anterior,
  (select count(*) from legacy_micrologos.fusoes_pacientes)                 as juntados;
