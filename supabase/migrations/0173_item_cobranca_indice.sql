-- =====================================================================
-- 0173 — Índice para achar os itens enviados numa cobrança do Micrologos (sessão "Dados para migração", 26/11/2026)
-- Na Unimed por médico, itens de uma mesma conta foram enviados em cobranças diferentes; o nº da cobrança de cada item
-- fica em conta_itens.legado->>'id_cobranca' e o XML de uma cobrança antiga busca os itens por ele.
-- =====================================================================
create index if not exists conta_itens_legado_cobranca_idx on public.conta_itens ((legado->>'id_cobranca'))
  where legado ? 'id_cobranca';
