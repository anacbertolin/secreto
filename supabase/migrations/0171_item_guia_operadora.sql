-- =====================================================================
-- 0171 — Nº da guia na operadora do participante da cirurgia (sessão "Dados para migração", 26/11/2026)
-- No XML de honorários do Micrologos, a guia do auxiliar/instrumentador tem nº de guia próprio no prestador
-- (conta_itens.numero_guia, migração 0169) e também nº próprio na operadora (senha/guia autorizada para ele).
-- =====================================================================
alter table public.conta_itens add column if not exists numero_guia_operadora text;
comment on column public.conta_itens.numero_guia_operadora is 'Honorários: nº da guia na operadora da participação deste item (auxiliar, instrumentador…).';
