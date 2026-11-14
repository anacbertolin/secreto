-- =====================================================================
-- MODELO de transformação: bruto_pacientes -> public.pacientes
-- ---------------------------------------------------------------------
-- ⚠️ Os nomes das colunas do Micrologos (b.id_paciente, b.nome, ...) são
--    PALPITES do mapeamento. Ajustar depois do "inspecionar" com os
--    arquivos reais. Procure por  -- AJUSTAR
-- Idempotente: pode rodar de novo sem duplicar.
-- Rodar em ordem: 1) ocorrências  2) duplicados  3) de-para  4) inserção
-- =====================================================================

-- 1) Problemas de qualidade (não impedem a carga; viram relatório)
insert into legacy_micrologos.ocorrencias (entidade, legacy_id, severidade, regra, mensagem)
select 'paciente', b.id_paciente, 'aviso', r.regra, r.msg
from legacy_micrologos.bruto_pacientes b                                         -- AJUSTAR nome da tabela
cross join lateral (values
  ('cpf_invalido',      case when b.cpf is not null and legacy_micrologos.cpf(b.cpf) is null then 'CPF inválido, será gravado em branco' end),
  ('nascimento_invalido', case when b.dt_nascimento is not null and legacy_micrologos.data(b.dt_nascimento) is null then 'Data de nascimento ilegível' end),
  ('sem_nome',          case when legacy_micrologos.txt(b.nome) is null then 'Paciente sem nome' end)
) r(regra, msg)
where r.msg is not null
  and not exists (select 1 from legacy_micrologos.ocorrencias o
                  where o.entidade = 'paciente' and o.legacy_id = b.id_paciente and o.regra = r.regra);

-- 2) Duplicados pelo mesmo CPF válido: fica o cadastro mais recente (maior ID)
--    Os casos "nome + nascimento" são só SUGERIDOS para a dona decidir (não fundir sozinho).
insert into legacy_micrologos.fusoes_pacientes (legacy_id_mantido, legacy_id_fundido, criterio)
select mantido, b.id_paciente, 'cpf'
from (
  select b.id_paciente,
         first_value(b.id_paciente) over (partition by legacy_micrologos.cpf(b.cpf)
                                          order by nullif(regexp_replace(b.id_paciente, '\D', '', 'g'), '')::bigint desc nulls last) mantido
  from legacy_micrologos.bruto_pacientes b
  where legacy_micrologos.cpf(b.cpf) is not null
) b
where b.id_paciente <> mantido
on conflict (legacy_id_fundido) do nothing;

-- 3) De-para: um uuid novo para cada paciente que fica
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova, carga_id)
select distinct on (btrim(b.id_paciente)) 'paciente', btrim(b.id_paciente), gen_random_uuid(), 'public.pacientes', b._carga_id
from legacy_micrologos.bruto_pacientes b
where legacy_micrologos.txt(b.nome) is not null
  and not exists (select 1 from legacy_micrologos.fusoes_pacientes f where f.legacy_id_fundido = btrim(b.id_paciente))
order by btrim(b.id_paciente), b._carga_id desc
on conflict (entidade, legacy_id) do nothing;

-- 4) Inserção nas tabelas oficiais
-- Decisão da dona (14/11/2026): manter o MESMO número de prontuário do Micrologos.
-- numero_prontuario é identity "generated always": por isso o OVERRIDING SYSTEM VALUE.
-- Depois da carga: ajustar a sequência (passo 4b) para os novos pacientes seguirem a numeração.
insert into public.pacientes (
  id, numero_prontuario, nome, data_nascimento, sexo, cpf, cns, rg, nome_mae,
  telefone, telefone_secundario, email, cep, logradouro, numero, complemento, bairro, cidade, uf,
  convenio_carteirinha, observacoes, ativo, criado_em)
overriding system value
select distinct on (m.novo_id)
  m.novo_id,
  nullif(regexp_replace(coalesce(b.prontuario, b.id_paciente), '\D', '', 'g'), '')::bigint,   -- AJUSTAR coluna do nº de prontuário
  legacy_micrologos.txt(b.nome),
  legacy_micrologos.data(b.dt_nascimento),                                        -- AJUSTAR
  legacy_micrologos.sexo(b.sexo),
  legacy_micrologos.cpf(b.cpf),
  legacy_micrologos.cns(b.cns),
  legacy_micrologos.txt(b.rg),                                                    -- AJUSTAR
  legacy_micrologos.txt(b.nome_mae),                                              -- AJUSTAR
  legacy_micrologos.telefone(b.telefone),
  legacy_micrologos.telefone(b.celular),                                          -- AJUSTAR
  legacy_micrologos.email(b.e_mail),
  legacy_micrologos.cep(b.cep),
  legacy_micrologos.txt(b.endereco),                                              -- AJUSTAR
  legacy_micrologos.txt(b.numero),
  legacy_micrologos.txt(b.complemento),
  legacy_micrologos.txt(b.bairro),
  legacy_micrologos.txt(b.cidade),
  legacy_micrologos.uf(b.uf),
  legacy_micrologos.txt(b.carteira),                                              -- AJUSTAR
  concat_ws(E'\n', legacy_micrologos.txt(b.observacao),
            'Migrado do Micrologos (ID ' || btrim(b.id_paciente) || ')'),
  true,
  coalesce(legacy_micrologos.data_hora(b.dt_cadastro), now())                     -- AJUSTAR
from legacy_micrologos.bruto_pacientes b
join legacy_micrologos.mapa_ids m on m.entidade = 'paciente' and m.legacy_id = btrim(b.id_paciente)
order by m.novo_id, b._carga_id desc
on conflict (id) do nothing;

-- 4b) Novos pacientes continuam a numeração depois do maior número do Micrologos
select setval(pg_get_serial_sequence('public.pacientes', 'numero_prontuario'),
              greatest((select max(numero_prontuario) from public.pacientes), 1));

-- 5) Conferência
select
  (select count(distinct btrim(id_paciente)) from legacy_micrologos.bruto_pacientes) as no_micrologos,
  (select count(*) from legacy_micrologos.fusoes_pacientes)                          as unificados,
  (select count(*) from legacy_micrologos.mapa_ids where entidade = 'paciente')       as no_de_para,
  (select count(*) from public.pacientes p
     join legacy_micrologos.mapa_ids m on m.novo_id = p.id and m.entidade = 'paciente') as no_sistema_novo,
  (select count(*) from public.pacientes p
     join legacy_micrologos.mapa_ids m on m.novo_id = p.id and m.entidade = 'paciente'
   where p.cpf is not null)                                                          as com_cpf;
