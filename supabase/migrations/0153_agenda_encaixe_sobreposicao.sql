-- =====================================================================
-- 0153 — Encaixe pode ocupar o mesmo horário (sessão "Dados para migração", 25/11/2026)
-- A regra agenda_sem_conflito (0002) impedia QUALQUER sobreposição na mesma coluna, inclusive encaixe
-- (o botão "Encaixar" da Agenda cria no mesmo horário e era barrado) e o histórico do Micrologos,
-- onde 26% dos agendamentos ficam no mesmo horário de outro (encaixes, vários pacientes por horário).
-- Nova regra: continua proibido sobrepor agendamentos "vivos" comuns; não entram na regra
--   - encaixe = true (é justamente o paciente colocado num horário já ocupado);
--   - atendimentos já concluídos (status 'atendido'), além de 'cancelado' e 'faltou' como antes.
-- =====================================================================
alter table public.agendamentos drop constraint if exists agenda_sem_conflito;
alter table public.agendamentos add constraint agenda_sem_conflito
  exclude using gist (profissional_id with =, tstzrange(inicio, fim) with &&)
  where (status <> all (array['cancelado', 'faltou', 'atendido']::public.status_agendamento[]) and not coalesce(encaixe, false));
