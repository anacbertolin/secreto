-- =====================================================================
-- 0176 — Convênios Unimed PROVISÓRIOS, para a agenda (pedido da dona, 26/11/2026)
-- A Alessandra precisa marcar cirurgias da Unimed (e mandar o WhatsApp) antes de a migração terminar.
-- Cria só o nome, com o MESMO código do Micrologos (micrologos_codigo), marcados com tiss.provisorio = true.
-- A carga da migração (migracao/transformacoes/02_convenios.sql) completa estes convênios pelo código:
-- planos, dados TISS do prestador, preços. Nada duplica (índice único em micrologos_codigo).
-- Na Unimed cada médico cooperado é um "convênio" (mapeamento do Micrologos, 22/11/2026):
--   8 Gelson · 10 Gisele · 15 Luciano · 22 Max · 26 Consumed Cirurgia (PJ 1474) · 29 Antonio (médico de fora)
--   (33 Unimed Pedro não atende mais pela Unimed: fica para a carga, como inativo.)
-- ANS da Unimed: 344397. Não usar para XML antes da carga completar (falta o código do prestador).
-- =====================================================================
insert into public.convenios (nome, registro_ans, versao_tiss, ativo, micrologos_codigo, observacoes_faturamento, tiss)
select v.nome, '344397', '4.01.00', true, v.cod,
       'PROVISÓRIO (26/11/2026): só o nome, para a agenda. A migração do Micrologos completa planos, preços e TISS.',
       jsonb_build_object('provisorio', true)
from (values
  ('Unimed Gelson', 8), ('Unimed Gisele', 10), ('Unimed Luciano', 15), ('Unimed Max', 22),
  ('Unimed Consumed Cirurgia', 26), ('Unimed Antonio', 29)
) v(nome, cod)
where not exists (select 1 from public.convenios c where c.micrologos_codigo = v.cod or c.nome = v.nome);
