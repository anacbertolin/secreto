-- =====================================================================
-- 0185 — Bradesco Saúde: Individual unificado no Empresa; preço da Epilação (dona, 26/11/2026)
-- "O Bradesco unificou: paga o mesmo valor para Empresa e Individual; não existe mais Bradesco Individual."
-- - Epilação de Cílios no Bradesco Empresa: R$ 54,57 (a cópia do Micrologos tinha R$ 55,39, tabela de 2015).
-- - Plano "Bradesco Individual" fica inativo (não aparece para novos atendimentos; o histórico continua com ele).
--   Na carga, quem estava no Individual passa para o Empresa (migracao/transformacoes/01_pacientes.sql).
-- =====================================================================
update public.precos x set valor = 54.57
from public.procedimentos pr, public.convenio_planos pl, public.convenios c
where pr.id = x.procedimento_id and pl.id = x.plano_id and c.id = pl.convenio_id
  and c.nome = 'Bradesco Saúde' and pl.nome = 'Bradesco Empresa' and pr.descricao ilike 'Epila%o de C%lios';
update public.convenio_planos pl set ativo = false
from public.convenios c where c.id = pl.convenio_id and c.nome = 'Bradesco Saúde' and pl.nome = 'Bradesco Individual';
update public.pacientes p set plano_id = e.id
from public.convenio_planos i, public.convenio_planos e
where p.plano_id = i.id and i.micrologos_codigo = 5 and e.micrologos_codigo = 4;
