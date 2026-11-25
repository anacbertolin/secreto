-- =====================================================================
-- 0157 — Sociedade Dr. Gelson + Dr. Max: a parte do médico é dividida 50/50 (decisão do Dr. Gelson, 25/11/2026)
-- =====================================================================
-- Em todo repasse cujo médico é o Dr. Gelson OU o Dr. Max (qualquer procedimento; PIX, dinheiro, débito, crédito;
-- venda só de lente; Clínica Vital), a parte do médico — o que sobra depois de imposto, taxa do cartão, custos e 20%
-- da clínica — é dividida meio a meio entre os dois. O centavo que sobrar fica com o Dr. Gelson.
-- Cada um recebe a sua metade nas mesmas datas da parcela (0156). Vale também para os repasses já lançados.
-- O banco guarda o total do médico por parcela; a divisão sai da visão public.repasse_parcelas_medicos
-- (as demais partes — valor, imposto, taxa, clínica — são divididas na mesma proporção, só para os relatórios).
-- Clínica Vital: continua sem imposto e sem os 20%; o cirurgião padrão passa a ser o Dr. Max (R$ 250 para cada).
-- =====================================================================

create table public.repasse_sociedade (
  profissional_id uuid primary key references public.profissionais(id),
  fica_centavo    boolean not null default false,          -- quem leva o centavo que sobra na divisão
  criado_em       timestamptz not null default now()
);
comment on table public.repasse_sociedade is 'Médicos sócios: a parte do médico de qualquer um deles é dividida igualmente entre todos.';
create unique index repasse_sociedade_um_centavo on public.repasse_sociedade ((true)) where fica_centavo;
create trigger auditoria after insert or update or delete on public.repasse_sociedade for each row execute function interno.tg_auditoria();
alter table public.repasse_sociedade enable row level security;
create policy le on public.repasse_sociedade for select to authenticated using ((select interno.tem_funcao('faturamento', 'admin')));
create policy inclui on public.repasse_sociedade for insert to authenticated with check ((select interno.tem_funcao('admin')));
create policy altera on public.repasse_sociedade for update to authenticated using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));
create policy apaga on public.repasse_sociedade for delete to authenticated using ((select interno.tem_funcao('admin')));

insert into public.repasse_sociedade (profissional_id, fica_centavo)
select id, nome ilike 'Gelson%' from public.profissionais where funcao = 'medico' and (nome ilike 'Gelson%' or nome ilike 'Max %');

-- cota de um valor dividido por n: quem fica com o centavo leva o resto
create or replace function interno.repasse_cota(v numeric, n int, fica boolean)
returns numeric language sql immutable set search_path = '' as $$
  select case when v is null then null
              when n <= 1 then v
              when fica then v - (n - 1) * trunc(v / n, 2)
              else trunc(v / n, 2) end
$$;
grant execute on function interno.repasse_cota(numeric, int, boolean) to authenticated;

-- uma linha por parcela e por médico que recebe (sócios: uma linha para cada)
create view public.repasse_parcelas_medicos with (security_invoker = on) as
with soc as (select s.profissional_id, s.fica_centavo, count(*) over () as n from public.repasse_sociedade s)
select p.id as parcela_id, p.repasse_id, p.numero, p.data_prevista, p.recebido_em, p.pago_medico_em,
       coalesce(soc.profissional_id, r.profissional_id) as profissional_id,
       pr.nome as medico_nome,
       (soc.profissional_id is not null) as dividido,
       r.profissional_id as cirurgiao_id, cir.nome as cirurgiao_nome,
       r.numero as repasse_numero, r.procedimento, r.data_cirurgia, r.forma_pagamento, r.parcelas, r.status, r.regra,
       pa.nome as paciente_nome, pa.nome_social as paciente_nome_social,
       interno.repasse_cota(p.valor, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as valor,
       interno.repasse_cota(p.imposto, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as imposto,
       interno.repasse_cota(p.taxa_interna, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as taxa_interna,
       interno.repasse_cota(p.custos, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as custos,
       interno.repasse_cota(p.centro_cirurgico, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as centro_cirurgico,
       interno.repasse_cota(p.medico, coalesce(soc.n, 1)::int, coalesce(soc.fica_centavo, true)) as medico
from public.repasse_parcelas p
join public.repasses r on r.id = p.repasse_id
left join soc on exists (select 1 from public.repasse_sociedade x where x.profissional_id = r.profissional_id)
join public.profissionais pr on pr.id = coalesce(soc.profissional_id, r.profissional_id)
join public.profissionais cir on cir.id = r.profissional_id
left join public.pacientes pa on pa.id = r.paciente_id;
comment on view public.repasse_parcelas_medicos is 'Parcelas do repasse por médico que recebe (sócios Gelson + Max: metade para cada, centavo para o Gelson).';
revoke all on public.repasse_parcelas_medicos from anon;
grant select on public.repasse_parcelas_medicos to authenticated;

-- Clínica Vital: cirurgião padrão = Dr. Max
update public.repasse_procedimentos set profissional_id = (select id from public.profissionais where nome ilike 'Max %' and funcao = 'medico' limit 1),
       observacoes = observacoes || ' Cirurgião padrão: Dr. Max (pacientes vindos da Vital; R$ 500 divididos R$ 250 Dr. Gelson / R$ 250 Dr. Max).'
 where nome = 'Catarata — Clínica Vital';
