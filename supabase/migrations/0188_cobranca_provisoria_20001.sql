-- =====================================================================
-- 0188 — Nº das cobranças novas no período em paralelo com o Micrologos (sessão "Dados para migração", 26/11/2026)
-- A dona decidiu usar os dois sistemas em paralelo, com atualização diária a partir da cópia do Micrologos.
-- O Micrologos continua numerando as cobranças dele (11.403, 11.404…), e essas chegam ao sistema novo com o mesmo nº.
-- Para não colidir (lotes.numero é único), as cobranças criadas NO SISTEMA NOVO passam a sair a partir de 20.001,
-- como os prontuários provisórios (0181, a partir de 200.001). Na troca definitiva dá para voltar à sequência.
-- O nº do lote no XML (convenios.tiss.ultimo_lote, função lote_numero_tiss) não muda.
-- =====================================================================
select setval('public.lotes_numero_seq', greatest(20000, (select coalesce(max(numero), 0) from public.lotes)));
