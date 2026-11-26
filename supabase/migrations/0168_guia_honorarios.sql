-- =====================================================================
-- 0168 — Guia de Honorários (cirurgia) no faturamento (sessão "Dados para migração", 26/11/2026)
-- Para gerar o XML de honorários igual ao Micrologos (docs/micrologos/mapeamento-telas/arquivos-2026-11-24/D2):
--   - contas.tipo_guia aceita 'honorarios';
--   - contas.hospital_id: hospital/centro cirúrgico onde a cirurgia foi feita (localContratado do XML);
--   - contas.guia_solicitacao: nº da guia de solicitação/internação autorizada (guiaSolicInternacao);
--   - conta_itens.grau_participacao: 00 cirurgião, 01 1º auxiliar, 02 2º auxiliar, 05 instrumentador, 06 anestesista…
--     (cada participação é um item próprio, com o seu valor, como no Micrologos).
-- =====================================================================
alter table public.contas add column if not exists hospital_id uuid references public.hospitais(id);
alter table public.contas add column if not exists guia_solicitacao text;
create index if not exists contas_hospital_idx on public.contas (hospital_id);
alter table public.contas drop constraint if exists contas_tipo_guia_check;
alter table public.contas add constraint contas_tipo_guia_check check (tipo_guia in ('consulta', 'sadt', 'honorarios', 'particular'));

alter table public.conta_itens add column if not exists grau_participacao text
  check (grau_participacao is null or grau_participacao ~ '^\d{2}$');
comment on column public.conta_itens.grau_participacao is
  'Grau de participação TISS (dm_grauPart): 00 cirurgião, 01 1º auxiliar, 02 2º auxiliar, 03 3º, 04 4º, 05 instrumentador, 06 anestesista, 12 clínico.';
