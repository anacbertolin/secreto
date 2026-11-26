-- =====================================================================
-- 0184 — Registro dos pacientes da equipe juntados na troca (sessão "Dados para migração", 26/11/2026)
-- Pacientes cadastrados no sistema novo antes da troca que eram a mesma pessoa de um prontuário do Micrologos
-- (assumem o nº do Micrologos) ou que tiveram o nº provisório trocado. Preenchido por 01_pacientes.sql.
-- =====================================================================
create table if not exists legacy_micrologos.ajustes_equipe (
  paciente_id   uuid primary key,
  numero_antigo bigint,
  numero_novo   bigint,
  legacy_id     text,
  criterio      text,
  criado_em     timestamptz default now()
);
alter table legacy_micrologos.ajustes_equipe enable row level security;
