-- =====================================================================
-- Transformação: códigos dos médicos por convênio (MEDICOS_OPERADORAS) -> public.profissional_convenio_codigos
-- Depende de 02_convenios, 03_profissionais e da migração 0167. Idempotente (atualiza o que já existe).
-- Rodar numa transação com: set local app.migracao = 'on';
--   - plano 0 = vale para todos os planos; unidade vazia = vale para qualquer hospital;
--   - códigos com 11 dígitos são CPF do profissional: NÃO são copiados (a dona cadastra na tela, se precisar);
--   - "executa como"/"solicita como" só quando aponta para OUTRO médico (o próprio é o padrão).
-- =====================================================================
create temp table _mo as
select legacy_micrologos.novo_id('medico', o.id_medico) as prof,
  cv.id as conv,
  pl.id as plano,
  h.id as hosp,
  case when length(regexp_replace(coalesce(o.cod_prestador_operadora, ''), '\D', '', 'g')) = 11 then null
       else legacy_micrologos.txt(o.cod_prestador_operadora) end as cod_exe,
  case when length(regexp_replace(coalesce(o.cod_prestador_operadora_solic, ''), '\D', '', 'g')) = 11 then null
       else legacy_micrologos.txt(o.cod_prestador_operadora_solic) end as cod_sol,
  case when nullif(btrim(o.id_medico_executa), '') <> btrim(o.id_medico) then legacy_micrologos.novo_id('medico', o.id_medico_executa) end as exec_como,
  case when nullif(btrim(o.id_medico_solicita), '') <> btrim(o.id_medico) then legacy_micrologos.novo_id('medico', o.id_medico_solicita) end as sol_como,
  coalesce(o.contr_exec_mesmo_prof_exec, '') in ('1', 'S') as proprio_exe,
  coalesce(o.contr_solic_mesmo_prof_sol, '') in ('1', 'S') as proprio_sol,
  legacy_micrologos.txt(o.cod_operadora_contratado) as cod_contr,
  legacy_micrologos.txt(o.tiss_posicao_profissional) as grau
from legacy_micrologos.bruto_medicos_operadoras o
join public.convenios cv on cv.micrologos_codigo::text = btrim(o.id_convenio_mestre)
left join public.convenio_planos pl on btrim(o.id_convenio) not in ('', '0') and pl.micrologos_codigo::text = btrim(o.id_convenio)
left join public.hospitais h on nullif(btrim(o.id_unidade), '') is not null and h.micrologos_codigo::text = btrim(o.id_unidade);

insert into legacy_micrologos.ocorrencias (entidade, legacy_id, severidade, regra, mensagem)
select 'medico_operadora', btrim(o.id_medicos_operadoras), 'info', 'cpf_nao_copiado',
  'Código do médico no convênio é um CPF: não copiado (cadastrar na tela Cadastros → Convênios, se precisar)'
from legacy_micrologos.bruto_medicos_operadoras o
where (length(regexp_replace(coalesce(o.cod_prestador_operadora, ''), '\D', '', 'g')) = 11
    or length(regexp_replace(coalesce(o.cod_prestador_operadora_solic, ''), '\D', '', 'g')) = 11)
  and not exists (select 1 from legacy_micrologos.ocorrencias x where x.entidade = 'medico_operadora' and x.legacy_id = btrim(o.id_medicos_operadoras));

insert into public.profissional_convenio_codigos as p (profissional_id, convenio_id, plano_id, hospital_id, codigo_executante, codigo_solicitante,
  executa_como_id, solicita_como_id, contratado_proprio_executante, contratado_proprio_solicitante, codigo_contratado, grau_participacao)
select distinct on (prof, conv, plano, hosp) prof, conv, plano, hosp, cod_exe, cod_sol, exec_como, sol_como, proprio_exe, proprio_sol, cod_contr, grau
from _mo
where prof is not null
  and (cod_exe is not null or cod_sol is not null or exec_como is not null or sol_como is not null or proprio_exe or proprio_sol or grau is not null)
order by prof, conv, plano, hosp, cod_exe nulls last
on conflict (profissional_id, convenio_id, coalesce(plano_id, '00000000-0000-0000-0000-000000000000'::uuid),
             coalesce(hospital_id, '00000000-0000-0000-0000-000000000000'::uuid))
do update set codigo_executante = excluded.codigo_executante, codigo_solicitante = excluded.codigo_solicitante,
  executa_como_id = excluded.executa_como_id, solicita_como_id = excluded.solicita_como_id,
  contratado_proprio_executante = excluded.contratado_proprio_executante, contratado_proprio_solicitante = excluded.contratado_proprio_solicitante,
  codigo_contratado = excluded.codigo_contratado, grau_participacao = excluded.grau_participacao;

-- conferência
select c.nome as convenio, count(*) as linhas, count(p.codigo_executante) as com_codigo, count(p.executa_como_id) as executa_como
from public.profissional_convenio_codigos p join public.convenios c on c.id = p.convenio_id group by 1 order by 1;
