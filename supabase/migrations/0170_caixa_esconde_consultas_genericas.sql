-- =====================================================================
-- 0170 — Caixa: esconder "Consulta Glaucoma" e "Consulta Córnea" genéricas (dona, 26/11/2026)
-- Confundiam a recepção: agora existem as versões por médico (0168/0169). A dona confirmou Córnea — Dr. Max = R$ 500.
-- Só o preço PARTICULAR dos genéricos é desativado (some do caixa); o procedimento continua ativo
-- (ligação com a migração da Micrologos e uso em convênios).
-- =====================================================================
update public.precos pr set ativo = false
from public.procedimentos p
where p.id = pr.procedimento_id and pr.convenio_id is null and pr.plano_id is null
  and p.tabela = '00' and p.descricao in ('Consulta Glaucoma', 'Consulta Córnea');

update public.procedimentos set observacao = 'Preço por médico (dona, 26/11/2026). Valor confirmado pela dona.'
where descricao = 'Consulta Córnea — Dr. Max';
