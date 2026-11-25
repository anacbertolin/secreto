-- =====================================================================
-- Transformação: prontuário do Micrologos -> public.prontuario_legado (só leitura, aparece na linha do tempo do paciente)
--   ATENDIMENTOS (texto da consulta, campo QP; RTF convertido por migracao/firebird/converter_rtf.py)
--     + ATENDIMENTOS_DETALHES (fichas: só os campos preenchidos, quase todos vêm vazios/"0")
--     + ATENDIMENTOS_CID + ATENDIMENTOS_MEDICAMENTOS + dados TISS do atendimento   -> 1 registro tipo 'atendimento'
--   DIVERSOS (receitas, prescrição de óculos, pedidos de exame, atestados, laudos; RTF convertido)
--                                                                               -> 1 registro por documento
--   "Imagem do Atendimento" (DIVERSOS sem texto): só a referência; os arquivos de imagem ficam no servidor da
--   clínica e serão trazidos à parte (❓ pasta de imagens com o técnico).
-- Depende de 01_pacientes, 03_profissionais e de legacy_micrologos.textos_convertidos. Idempotente.
-- Rodar numa transação com: set local app.migracao = 'on';
-- =====================================================================

-- ---------- fichas: só campos preenchidos (≠ 0), com o título do campo ----------
create temp table _ficha as
select d.id_atendimento,
  string_agg(coalesce(nullif(legacy_micrologos.txt(i.campo_titulo), ''), 'Campo ' || kv.k) || ' ' || kv.v, E'\n' order by kv.k::int) as texto
from legacy_micrologos.bruto_atendimentos_detalhes d
cross join lateral (
  select split_part(l, '=', 1) as k, btrim(split_part(l, '=', 2)) as v
  from regexp_split_to_table(d.dados, E'\r?\n') l where l like '%=%') kv
left join legacy_micrologos.bruto_atendimentos_tipo_itens i
  on i.id_atendimento_tipo = d.id_atendimento_tipo and btrim(i.sequencia) = kv.k
where kv.k ~ '^\d+$' and kv.v not in ('', '0')
group by d.id_atendimento;
create index on _ficha (id_atendimento);

create temp table _cid as
select btrim(c.id_atendimentos) as id_atendimento,
  string_agg(upper(btrim(c.cid)) || coalesce(' — ' || legacy_micrologos.txt(c.obs), '') || case when c.cid_principal in ('S', '1') then ' (principal)' else '' end, E'\n') as texto,
  jsonb_agg(upper(btrim(c.cid))) as lista
from legacy_micrologos.bruto_atendimentos_cid c where legacy_micrologos.txt(c.cid) is not null group by 1;
create index on _cid (id_atendimento);

create temp table _med as
select btrim(m.id_atendimentos) as id_atendimento,
  string_agg(concat_ws(' — ', legacy_micrologos.txt(md.nome), legacy_micrologos.txt(m.apresentacao),
                       coalesce(legacy_micrologos.txt(m.posologia_memo), legacy_micrologos.txt(m.posologia)),
                       legacy_micrologos.txt(m.observacao)), E'\n') as texto
from legacy_micrologos.bruto_atendimentos_medicamentos m
left join legacy_micrologos.bruto_medicamentos md on btrim(md.id_medicamento) = btrim(m.id_medicamento)
group by 1;
create index on _med (id_atendimento);
analyze _ficha; analyze _cid; analyze _med;

-- ---------- atendimentos ----------
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'atendimento', btrim(a.id_atendimento), gen_random_uuid(), 'public.prontuario_legado'
from legacy_micrologos.bruto_atendimentos a
where legacy_micrologos.novo_id('paciente', a.id_paciente) is not null
on conflict (entidade, legacy_id) do nothing;
analyze legacy_micrologos.mapa_ids;

insert into public.prontuario_legado (id, paciente_id, data, profissional_id, tipo, titulo, conteudo, formato, metadados)
select m.novo_id,
  legacy_micrologos.novo_id('paciente', a.id_paciente),
  coalesce(legacy_micrologos.data_hora(a.data, a.hora_inicio), legacy_micrologos.data_hora(a.data_inclusao)),
  legacy_micrologos.novo_id('medico', a.id_medico),
  'atendimento',
  coalesce('Atendimento — ' || legacy_micrologos.txt(tp.descricao), 'Atendimento'),
  nullif(concat_ws(E'\n\n',
    tc.texto,
    case when f.texto is not null then 'Ficha:' || E'\n' || f.texto end,
    case when c.texto is not null then 'CID:' || E'\n' || c.texto end,
    case when md.texto is not null then 'Medicamentos:' || E'\n' || md.texto end,
    case when legacy_micrologos.txt(a.tiss_indicacao_clinica) is not null then 'Indicação clínica (TISS): ' || legacy_micrologos.txt(a.tiss_indicacao_clinica) end,
    case when legacy_micrologos.txt(a.tiss_observacao) is not null then 'Observação (TISS): ' || legacy_micrologos.txt(a.tiss_observacao) end
  ), ''),
  'texto',
  jsonb_strip_nulls(jsonb_build_object(
    'origem', 'Micrologos', 'id_atendimento', btrim(a.id_atendimento), 'id_agenda', nullif(btrim(a.id_agenda), ''),
    'agendamento_id', legacy_micrologos.novo_id('agenda', a.id_agenda),
    'hora_final', legacy_micrologos.txt(a.hora_final), 'cids', c.lista,
    'texto_original', case when a.qp like '{\rtf%' then 'rtf' when a.qp is not null then 'texto' end,
    'assinado', case when a.hash is not null or a.qp_certificado is not null then true end))
from legacy_micrologos.bruto_atendimentos a
join legacy_micrologos.mapa_ids m on m.entidade = 'atendimento' and m.legacy_id = btrim(a.id_atendimento)
left join legacy_micrologos.textos_convertidos tc on tc.origem = 'atendimento' and tc.legacy_id = btrim(a.id_atendimento)
left join legacy_micrologos.bruto_agenda ag on ag.id_agenda = a.id_agenda
left join legacy_micrologos.bruto_atendimentos_tipos tp on tp.id_atendimento_tipo = ag.id_atendimento_tipo and btrim(tp.id_atendimento_tipo) <> '0'
left join _ficha f on f.id_atendimento = a.id_atendimento
left join _cid c on c.id_atendimento = btrim(a.id_atendimento)
left join _med md on md.id_atendimento = btrim(a.id_atendimento)
where coalesce(legacy_micrologos.data_hora(a.data, a.hora_inicio), legacy_micrologos.data_hora(a.data_inclusao)) is not null
on conflict (id) do nothing;

-- ---------- documentos (receitas, óculos, pedidos de exame, atestados, laudos, imagens) ----------
insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'documento', btrim(d.id_diversos), gen_random_uuid(), 'public.prontuario_legado'
from legacy_micrologos.bruto_diversos d
where legacy_micrologos.novo_id('paciente', d.id_paciente) is not null
on conflict (entidade, legacy_id) do nothing;
analyze legacy_micrologos.mapa_ids;

insert into public.prontuario_legado (id, paciente_id, data, profissional_id, tipo, titulo, conteudo, formato, metadados)
select m.novo_id,
  legacy_micrologos.novo_id('paciente', d.id_paciente),
  coalesce(legacy_micrologos.data_hora(d.data), legacy_micrologos.data_hora(d.data_inclusao), legacy_micrologos.data_hora(at.data, at.hora_inicio)),
  coalesce(legacy_micrologos.novo_id('medico', d.id_medico), legacy_micrologos.novo_id('medico', at.id_medico)),
  case
    when d.titulo ilike 'imagem%' then 'imagem'
    when d.titulo ilike '%óculos%' or d.titulo ilike '%oculos%' then 'prescricao_oculos'
    when d.titulo ilike 'receita%' or d.e_receita in ('S', '1') then 'receita'
    when d.titulo ilike '%atestado%' or d.titulo ilike '%declara%' then 'atestado'
    when d.titulo ilike '%solicita%' then 'solicitacao_exames'
    when d.laudo_status is not null or d.titulo ilike '%laudo%' then 'laudo'
    else 'documento' end,
  legacy_micrologos.txt(d.titulo),
  coalesce(tc.texto, case when d.titulo ilike 'imagem%' then 'Imagem do atendimento no Micrologos (arquivo a importar).' end),
  'texto',
  jsonb_strip_nulls(jsonb_build_object(
    'origem', 'Micrologos', 'id_diversos', btrim(d.id_diversos), 'id_atendimento', nullif(btrim(d.id_atendimento), ''),
    'atendimento_legado_id', legacy_micrologos.novo_id('atendimento', d.id_atendimento),
    'laudo_status', legacy_micrologos.txt(d.laudo_status), 'texto_original', case when d.especial like '{\rtf%' then 'rtf' end))
from legacy_micrologos.bruto_diversos d
join legacy_micrologos.mapa_ids m on m.entidade = 'documento' and m.legacy_id = btrim(d.id_diversos)
left join legacy_micrologos.bruto_atendimentos at on at.id_atendimento = d.id_atendimento
left join legacy_micrologos.textos_convertidos tc on tc.origem = 'documento' and tc.legacy_id = btrim(d.id_diversos)
where coalesce(legacy_micrologos.data_hora(d.data), legacy_micrologos.data_hora(d.data_inclusao), legacy_micrologos.data_hora(at.data, at.hora_inicio)) is not null
on conflict (id) do nothing;

-- ---------- conferência ----------
analyze public.prontuario_legado;
select tipo, count(*) as qtd, count(*) filter (where conteudo is not null) as com_texto, count(*) filter (where profissional_id is not null) as com_medico,
       min(data)::date as primeiro, max(data)::date as ultimo
from public.prontuario_legado group by tipo order by 2 desc;
