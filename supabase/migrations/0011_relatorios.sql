-- =====================================================================
-- 0011 — Relatórios
-- =====================================================================
-- Funções de consulta (só leitura) que somam os dados no próprio banco.
-- São SECURITY INVOKER: cada pessoa só vê o que as regras de acesso (RLS)
-- já permitem. Ex.: recepção e administração não veem diagnósticos.
-- Datas sempre no fuso de São Paulo.
-- =====================================================================

-- Agenda: por médico, convênio e tipo
create or replace function public.rel_agenda(p_de date, p_ate date)
returns table (profissional_id uuid, profissional text, convenio text, tipo text,
               total bigint, atendidos bigint, faltas bigint, cancelados bigint, primeira_vez bigint, encaixes bigint)
language sql stable security invoker set search_path = '' as $$
  select a.profissional_id, p.nome, coalesce(c.nome, 'Particular'), a.tipo::text,
         count(*),
         count(*) filter (where a.status = 'atendido'),
         count(*) filter (where a.status = 'faltou'),
         count(*) filter (where a.status = 'cancelado'),
         count(*) filter (where a.primeira_vez),
         count(*) filter (where a.encaixe)
  from public.agendamentos a
  join public.profissionais p on p.id = a.profissional_id
  left join public.convenios c on c.id = a.convenio_id
  where (a.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  group by 1, 2, 3, 4
$$;

-- Recepção: tempo de espera (chegada → chamada) e pontualidade, por médico
create or replace function public.rel_espera(p_de date, p_ate date)
returns table (profissional_id uuid, profissional text, medidos bigint,
               espera_media_min numeric, espera_p90_min numeric, atraso_medio_min numeric)
language sql stable security invoker set search_path = '' as $$
  select a.profissional_id, p.nome, count(*),
         round(avg(extract(epoch from (a.chamado_em - a.chegada_em)) / 60)::numeric, 1),
         round((percentile_cont(0.9) within group (order by extract(epoch from (a.chamado_em - a.chegada_em)) / 60))::numeric, 1),
         round(avg(greatest(0, extract(epoch from (a.chamado_em - a.inicio)) / 60))::numeric, 1)
  from public.agendamentos a
  join public.profissionais p on p.id = a.profissional_id
  where (a.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    and a.chegada_em is not null and a.chamado_em is not null and a.chamado_em >= a.chegada_em
  group by 1, 2
$$;

-- Pacientes que mais faltaram no período
create or replace function public.rel_faltas_pacientes(p_de date, p_ate date, p_limite int default 100)
returns table (paciente_id uuid, nome text, numero_prontuario bigint, telefone text, faltas bigint, agendamentos bigint)
language sql stable security invoker set search_path = '' as $$
  select pa.id, pa.nome, pa.numero_prontuario, pa.telefone,
         count(*) filter (where a.status = 'faltou'), count(*)
  from public.agendamentos a
  join public.pacientes pa on pa.id = a.paciente_id
  where (a.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  group by 1, 2, 3, 4
  having count(*) filter (where a.status = 'faltou') > 0
  order by 5 desc, 6 desc
  limit greatest(1, least(p_limite, 1000))
$$;

-- Pacientes novos (cadastrados no período), por convênio e cidade
create or replace function public.rel_pacientes_novos(p_de date, p_ate date)
returns table (convenio text, cidade text, total bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(c.nome, 'Particular'), coalesce(nullif(trim(pa.cidade), ''), 'Não informada'), count(*)
  from public.pacientes pa
  left join public.convenios c on c.id = pa.convenio_id
  where (pa.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  group by 1, 2
$$;

-- Exames: realizados, laudados e tempo até o laudo
create or replace function public.rel_exames(p_de date, p_ate date)
returns table (exame text, realizados bigint, laudados bigint, aguardando_laudo bigint, cancelados bigint, horas_ate_laudo numeric)
language sql stable security invoker set search_path = '' as $$
  select e.exame,
         count(*) filter (where e.status in ('aguardando_laudo', 'laudado')),
         count(*) filter (where e.status = 'laudado'),
         count(*) filter (where e.status = 'aguardando_laudo'),
         count(*) filter (where e.status = 'cancelado'),
         round(avg(extract(epoch from (e.laudado_em - e.executado_em)) / 3600)
               filter (where e.status = 'laudado' and e.executado_em is not null)::numeric, 1)
  from public.exames_realizados e
  where (coalesce(e.executado_em, e.criado_em) at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  group by 1
$$;

-- Diagnósticos mais frequentes (atendimentos finalizados no período)
create or replace function public.rel_diagnosticos(p_de date, p_ate date, p_limite int default 50)
returns table (cid10 text, descricao text, atendimentos bigint, pacientes bigint, como_principal bigint)
language sql stable security invoker set search_path = '' as $$
  select d.cid10, min(d.descricao), count(distinct d.atendimento_id), count(distinct a.paciente_id),
         count(*) filter (where d.principal)
  from public.diagnosticos d
  join public.atendimentos a on a.id = d.atendimento_id
  where a.status = 'finalizado' and (a.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  group by 1
  order by 3 desc
  limit greatest(1, least(p_limite, 500))
$$;

-- Produção clínica por médico
create or replace function public.rel_producao_medica(p_de date, p_ate date)
returns table (profissional_id uuid, profissional text, atendimentos bigint, pacientes bigint,
               receitas_oculos bigint, receitas_medicamentos bigint, pedidos_exame bigint, documentos bigint, laudos bigint)
language sql stable security invoker set search_path = '' as $$
  with at as (
    select a.* from public.atendimentos a
    where a.status = 'finalizado' and (a.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  )
  select p.id, p.nome,
         (select count(*) from at where at.profissional_id = p.id),
         (select count(distinct at.paciente_id) from at where at.profissional_id = p.id),
         (select count(*) from public.prescricoes_oculos x join at on at.id = x.atendimento_id where at.profissional_id = p.id),
         (select count(*) from public.prescricoes x join at on at.id = x.atendimento_id where at.profissional_id = p.id),
         (select count(*) from public.solicitacoes_exames x join at on at.id = x.atendimento_id where at.profissional_id = p.id),
         (select count(*) from public.documentos_clinicos x join at on at.id = x.atendimento_id where at.profissional_id = p.id),
         (select count(*) from public.exames_realizados e where e.laudado_por = p.id and e.status = 'laudado'
            and (e.laudado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate)
  from public.profissionais p
  where p.funcao = 'medico'
$$;

-- Só usuários logados podem chamar
do $$
declare f text;
begin
  foreach f in array array[
    'rel_agenda(date, date)', 'rel_espera(date, date)', 'rel_faltas_pacientes(date, date, int)',
    'rel_pacientes_novos(date, date)', 'rel_exames(date, date)', 'rel_diagnosticos(date, date, int)',
    'rel_producao_medica(date, date)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
