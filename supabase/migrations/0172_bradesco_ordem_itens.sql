-- =====================================================================
-- 0172 — Bradesco Saúde: itens da SP/SADT do maior para o menor valor (como no XML do Micrologos; comparação de 26/11/2026).
-- Na Amil, Geap e Hapvida os itens saem na ordem de lançamento.
-- =====================================================================
update public.convenios set tiss = tiss || '{"ordenar_itens_por_valor": true}'::jsonb
where micrologos_codigo = 2 and not (tiss ? 'ordenar_itens_por_valor');
