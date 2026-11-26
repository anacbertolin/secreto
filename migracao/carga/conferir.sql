-- Conferência depois do envio (rodar no Supabase pelo execute_sql): contagens para comparar com o banco "carga".
select 'pacientes' t, count(*) from public.pacientes
union all select 'agendamentos', count(*) from public.agendamentos
union all select 'prontuario_legado', count(*) from public.prontuario_legado
union all select 'lotes', count(*) from public.lotes
union all select 'contas', count(*) from public.contas
union all select 'conta_itens', count(*) from public.conta_itens
union all select 'convenios', count(*) from public.convenios
union all select 'convenio_planos', count(*) from public.convenio_planos
union all select 'precos', count(*) from public.precos
union all select 'profissionais', count(*) from public.profissionais
union all select 'mapa_ids', count(*) from legacy_micrologos.mapa_ids;
-- totais por ano das contas (comparar com a saída do 06_faturamento no banco "carga")
select extract(year from data_atendimento)::int ano, count(*), round(sum(valor_total)) from public.contas group by 1 order by 1;
