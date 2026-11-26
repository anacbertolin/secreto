-- =====================================================================
-- 0175 — Cirurgião no agendamento do Centro Cirúrgico (pedido da dona, 26/11/2026)
-- A Alessandra marca cirurgias e injeções na coluna "Centro Cirúrgico". O paciente fica nessa coluna
-- (profissional_id = Centro Cirúrgico) e o médico que vai operar fica em cirurgiao_id.
-- SÓ INFORMATIVO, para aparecer na agenda: NÃO entra no faturamento, na conta nem no XML (decisão da dona).
-- RLS: as políticas existentes de agendamentos já cobrem a coluna nova.
-- =====================================================================
alter table public.agendamentos
  add column if not exists cirurgiao_id uuid references public.profissionais(id);
comment on column public.agendamentos.cirurgiao_id is
  'Médico que vai operar (agenda do Centro Cirúrgico). Só aparece na agenda; não entra no faturamento nem no XML.';
create index if not exists agendamentos_cirurgiao_idx on public.agendamentos (cirurgiao_id) where cirurgiao_id is not null;
