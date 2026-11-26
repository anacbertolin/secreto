-- =====================================================================
-- 0169 — Consultas diferenciadas com preço POR MÉDICO (dona, 26/11/2026)
-- "O Dr. Max faz glaucoma e cobra 500; o Pedro faz glaucoma e cobra 600. O mesmo na córnea."
-- Completa a 0168 (Glaucoma — Dr. Max 500, Córnea — Dr. Pedro 600) com:
--  * Consulta Glaucoma — Dr. Pedro ... R$ 600,00
--  * Consulta Córnea — Dr. Max ....... R$ 500,00 (a dona não tem certeza deste valor: confirmar)
-- Os itens genéricos da Micrologos ("Consulta Glaucoma" 600, "Consulta Córnea" 500) continuam (ligação com a migração).
-- Retina: "Consulta Retinologo" (R$ 600) é só do Dr. Gelson — fica com um valor só.
-- Dual: o paciente paga na hora, no caixa (decisão provisória da dona; se a Dual pagar depois, muda).
-- =====================================================================
insert into public.procedimentos (tabela, descricao, tipo, observacao)
select '00', v.descricao, 'consulta', v.obs
from (values
  ('Consulta Glaucoma — Dr. Pedro', 'Preço por médico (dona, 26/11/2026).'),
  ('Consulta Córnea — Dr. Max', 'Preço por médico (dona, 26/11/2026). Valor a confirmar com a dona.')
) v(descricao, obs)
where not exists (select 1 from public.procedimentos p where p.descricao = v.descricao);

insert into public.precos (procedimento_id, convenio_id, plano_id, valor, vigente_de)
select p.id, null, null, v.valor, date '2026-11-26'
from (values ('Consulta Glaucoma — Dr. Pedro', 600.00), ('Consulta Córnea — Dr. Max', 500.00)) v(descricao, valor)
join public.procedimentos p on p.descricao = v.descricao
where not exists (select 1 from public.precos pr where pr.procedimento_id = p.id and pr.convenio_id is null and pr.plano_id is null);
