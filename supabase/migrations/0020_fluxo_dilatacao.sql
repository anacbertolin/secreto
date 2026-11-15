-- =====================================================================
-- 0020 — Fluxo do paciente na clínica: etapas, dilatação e chamada (TV)
-- =====================================================================
-- Enquanto o paciente está na clínica (status 'chegou'), ele passa por etapas:
--   pre_consulta  → com a enfermagem (AV, PIO, refração)
--   dilatando     → pingou colírio de dilatação; cronômetro corre
--   pronto_medico → pronto para o médico chamar
--   exames        → fazendo exame complementar no meio da consulta
-- Também guarda a última chamada do paciente (nome aparece na TV da sala de espera).
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só colunas NOVAS e OPCIONAIS (podem ficar
-- vazias). Nada muda para quem insere agendamentos antigos. O gatilho não faz nada
-- com app.migracao = 'on'.
-- =====================================================================

alter table public.agendamentos
  add column if not exists etapa text
    check (etapa in ('pre_consulta', 'dilatando', 'pronto_medico', 'exames')),
  add column if not exists etapa_em            timestamptz,
  add column if not exists dilatacao_inicio_em timestamptz,
  add column if not exists dilatacao_minutos   smallint check (dilatacao_minutos between 5 and 120),
  add column if not exists dilatacao_colirio   text,
  add column if not exists dilatacao_olho      public.olho,
  add column if not exists chamada_em          timestamptz,
  add column if not exists chamada_local       text;

comment on column public.agendamentos.etapa is 'Etapa do paciente dentro da clínica (pré-consulta, dilatando, pronto para o médico, exames).';
comment on column public.agendamentos.dilatacao_inicio_em is 'Hora em que pingou o colírio de dilatação (cronômetro).';
comment on column public.agendamentos.chamada_em is 'Última vez que o paciente foi chamado (aparece na TV da sala de espera).';

-- Horas sempre do servidor (relógio do computador da recepção pode estar errado)
create or replace function interno.tg_agendamento_etapa()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.migracao', true), '') = 'on' then
    return new;
  end if;
  if new.etapa is distinct from old.etapa then
    new.etapa_em := case when new.etapa is null then null else now() end;
    if new.etapa = 'dilatando' and new.dilatacao_inicio_em is not distinct from old.dilatacao_inicio_em then
      new.dilatacao_inicio_em := now();
    end if;
  end if;
  if new.dilatacao_inicio_em is distinct from old.dilatacao_inicio_em and new.dilatacao_inicio_em is not null then
    new.dilatacao_inicio_em := now();
    new.dilatacao_minutos := coalesce(new.dilatacao_minutos, 30);
  end if;
  if new.chamada_em is distinct from old.chamada_em and new.chamada_em is not null then
    new.chamada_em := now();
  end if;
  return new;
end $$;

create trigger etapa_fluxo before update on public.agendamentos
  for each row execute function interno.tg_agendamento_etapa();

-- Busca rápida do painel da TV (chamadas recentes do dia)
create index if not exists agendamentos_chamada_idx on public.agendamentos (chamada_em desc) where chamada_em is not null;
