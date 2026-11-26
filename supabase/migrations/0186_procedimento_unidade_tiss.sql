-- =====================================================================
-- 0186 — Medicamentos e materiais no XML (pedido da dona, 26/11/2026)
-- A clínica ainda não cobra medicamento/material dos convênios, mas o sistema fica pronto: item da conta cujo
-- procedimento é do tipo "medicamento" ou "material" sai no XML em "outras despesas" (02 medicamentos, tabela 20;
-- 03 materiais, tabela 19), com a unidade de medida TISS e o registro ANVISA do cadastro.
-- =====================================================================
alter table public.procedimentos add column if not exists unidade_tiss text check (unidade_tiss is null or unidade_tiss ~ '^\d{3}$');
alter table public.procedimentos add column if not exists registro_anvisa text;
comment on column public.procedimentos.unidade_tiss is 'Unidade de medida TISS (dm_unidadeMedida) para medicamento/material: 036 unidade, 013 frasco, 001 ampola, 014 frasco-ampola…';
comment on column public.procedimentos.registro_anvisa is 'Registro ANVISA do medicamento/material (vai no XML em outras despesas).';
