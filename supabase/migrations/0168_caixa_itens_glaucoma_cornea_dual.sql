-- =====================================================================
-- 0168 — Itens que faltavam na tabela particular do caixa (pedido da dona e da recepção, 26/11/2026)
--  * Consulta Glaucoma — Dr. Max ............ R$ 500,00
--  * Consulta Córnea — Dr. Pedro ............ R$ 600,00
--  * Campo Visual — Dual (parceria) ......... R$ 140,00
--    A Dual é uma clínica parceira que manda pacientes para fazer campo visual aqui. Regras completas da Dual
--    (exames, valores, descontos) virão do Micrologos depois — a dona vai verificar.
-- Os itens antigos "Consulta Glaucoma" (R$ 600) e "Consulta Córnea" (R$ 500) vieram da tabela da Micrologos e
-- continuam como estavam (valores trocados em relação ao que a recepção informou — perguntar à dona).
-- =====================================================================
insert into public.procedimentos (tabela, descricao, tipo, observacao)
select '00', v.descricao, v.tipo, v.obs
from (values
  ('Consulta Glaucoma — Dr. Max', 'consulta', 'Incluída a pedido da dona (26/11/2026).'),
  ('Consulta Córnea — Dr. Pedro', 'consulta', 'Incluída a pedido da dona (26/11/2026).'),
  ('Campo Visual — Dual (parceria)', 'exame', 'Clínica parceira Dual: campo visual feito aqui. Regras da Dual a confirmar no Micrologos.')
) v(descricao, tipo, obs)
where not exists (select 1 from public.procedimentos p where p.descricao = v.descricao);

insert into public.precos (procedimento_id, convenio_id, plano_id, valor, vigente_de)
select p.id, null, null, v.valor, date '2026-11-26'
from (values
  ('Consulta Glaucoma — Dr. Max', 500.00),
  ('Consulta Córnea — Dr. Pedro', 600.00),
  ('Campo Visual — Dual (parceria)', 140.00)
) v(descricao, valor)
join public.procedimentos p on p.descricao = v.descricao
where not exists (select 1 from public.precos pr where pr.procedimento_id = p.id and pr.convenio_id is null and pr.plano_id is null);
