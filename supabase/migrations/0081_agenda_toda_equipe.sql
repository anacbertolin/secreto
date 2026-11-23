-- 0081 — Toda a equipe pode marcar e encaixar pacientes na agenda (pedido da dona, 23/11/2026).
-- Antes só médico, enfermagem, recepção e admin incluíam; o faturamento só via.
-- Agora o faturamento também inclui agendamentos (inclusive encaixe) e cadastra paciente novo.
-- Remarcar/cancelar/check-in (UPDATE em agendamentos) continua com médico, enfermagem, recepção e admin.

create policy faturamento_inclui on public.agendamentos
  for insert to authenticated
  with check ((select interno.tem_funcao('faturamento'::funcao_profissional)));

create policy faturamento_inclui on public.pacientes
  for insert to authenticated
  with check ((select interno.tem_funcao('faturamento'::funcao_profissional)));
