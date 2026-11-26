-- =====================================================================
-- 0164 — Relatório de produção do faturamento (sessão "Dados para migração", 26/11/2026)
-- Substitui os relatórios do Micrologos que o Luciano e o Dr. Gelson usam todo mês
-- ("Atendimentos por Médico", "Faturamento por Médico", "Valores resumidos por plano", cirurgias…):
-- soma os itens das contas (inclusive as arquivadas do Micrologos) por médico, convênio e procedimento.
-- A tela compara o período com outro (mês anterior, mesmo mês do ano anterior…).
-- Contas canceladas ficam de fora. Data = data do atendimento da conta.
-- =====================================================================
create or replace function public.rel_faturamento(p_de date, p_ate date)
returns table (
  profissional_id uuid, profissional text, convenio_id uuid, convenio text, tipo text,
  codigo text, procedimento text, quantidade numeric, itens bigint, contas bigint, pacientes bigint,
  valor numeric, glosado numeric)
language sql stable security invoker set search_path = '' as $$
  select coalesce(i.profissional_id, c.profissional_id),
         coalesce(p.nome, 'Sem médico'),
         c.convenio_id, coalesce(cv.nome, 'Particular'),
         coalesce(pr.tipo::text, case when i.legado ? 'staff' then 'honorario' else 'outro' end),
         i.codigo, i.descricao,
         sum(i.quantidade), count(*), count(distinct c.id), count(distinct c.paciente_id),
         sum(i.valor_total), sum(i.glosa_valor - coalesce(i.recurso_valor_recuperado, 0))
  from public.contas c
  join public.conta_itens i on i.conta_id = c.id
  left join public.profissionais p on p.id = coalesce(i.profissional_id, c.profissional_id)
  left join public.convenios cv on cv.id = c.convenio_id
  left join public.procedimentos pr on pr.id = i.procedimento_id
  where c.data_atendimento between p_de and p_ate and c.status <> 'cancelada'
  group by 1, 2, 3, 4, 5, 6, 7
$$;
revoke execute on function public.rel_faturamento(date, date) from public, anon;
grant execute on function public.rel_faturamento(date, date) to authenticated;
