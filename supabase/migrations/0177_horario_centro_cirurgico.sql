-- =====================================================================
-- 0177 — Horário de funcionamento do Centro Cirúrgico na agenda (pedido da dona, 26/11/2026)
-- Mesmo horário da clínica: segunda a sexta 8h–17h; sábado 8h–12h. Intervalos de 15 min.
-- Com isso a coluna do Centro Cirúrgico mostra os horários livres (e o calendário de 3 meses, a ocupação).
-- =====================================================================
insert into public.horarios_profissional (profissional_id, dia_semana, hora_inicio, hora_fim, duracao_min, ativo)
select p.id, d.dia, d.ini::time, d.fim::time, 15, true
from public.profissionais p
cross join (values (1, '08:00', '17:00'), (2, '08:00', '17:00'), (3, '08:00', '17:00'), (4, '08:00', '17:00'),
                   (5, '08:00', '17:00'), (6, '08:00', '12:00')) d(dia, ini, fim)
where p.agenda_recurso and p.nome = 'Centro Cirúrgico'
  and not exists (select 1 from public.horarios_profissional h where h.profissional_id = p.id and h.dia_semana = d.dia and h.ativo);
