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
-- - CPF repetido (mesmo CPF válido em mais de um cadastro): NÃO funde sozinho. O CPF fica só no cadastro
--   mais recente; os outros ficam sem CPF, com observação apontando para o outro nº (a dona decide depois).
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

-- 2) CPF repetido: fica no cadastro de maior nº (mais recente)
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
  union all select btrim(t.id_paciente)::bigint, 10,
                   pg_temp.tel(coalesce(t.ddd, '') || coalesce(t.telefone, ''))
  from legacy_micrologos.bruto_pacientes_telefones t where btrim(t.id_paciente) ~ '^[0-9]+$'
), unicos as (
  select distinct on (num, t) num, t, ordem from todos where t is not null order by num, t, ordem
)
select num,
       (array_agg(t order by ordem))[1] as tel1,
       (array_agg(t order by ordem))[2] as tel2
from unicos group by num;

-- 4) De-para (um uuid novo por paciente)
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'paciente', p.num::text, gen_random_uuid(), 'public.pacientes' from _pac p
on conflict (entidade, legacy_id) do nothing;

-- 5) Inserção (mesmo nº do Micrologos: OVERRIDING SYSTEM VALUE)
insert into public.pacientes (
  id, numero_prontuario, prontuario_anterior, nome, nome_social, data_nascimento, sexo, cpf, cns, rg, nome_mae,
  telefone, telefone_secundario, email, cep, logradouro, numero, complemento, bairro, cidade, uf,
  responsavel_nome, responsavel_telefone, responsavel_parentesco,
  convenio_id, plano_id, convenio_carteirinha, convenio_validade, observacoes, ativo, criado_em)
overriding system value
select m.novo_id,
  p.num,
  case when legacy_micrologos.txt(p.ficha) is not null and btrim(p.ficha) <> p.num::text then legacy_micrologos.txt(p.ficha) end,
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
    case when d2.num is not null then 'Atenção: CPF igual ao do prontuário ' || d2.num || ' (possível cadastro duplicado).' end
  ), ''),
  coalesce(p.inativo, 'N') <> 'S',
  coalesce(legacy_micrologos.data_hora(p.data_inclusao), now())
from _pac p
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
select
  (select count(*) from _pac)                                              as candidatos,
  (select count(*) from public.pacientes p join legacy_micrologos.mapa_ids m
     on m.novo_id = p.id and m.entidade = 'paciente')                      as migrados,
  (select count(*) from public.pacientes where cpf is not null)            as com_cpf,
  (select count(*) from public.pacientes where telefone is not null)       as com_telefone,
  (select count(*) from public.pacientes where data_nascimento is not null) as com_nascimento,
  (select count(*) from public.pacientes where plano_id is not null)       as com_plano,
  (select count(*) from public.pacientes where prontuario_anterior is not null) as com_ficha_diferente;
