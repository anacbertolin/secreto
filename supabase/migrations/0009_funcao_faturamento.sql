-- =====================================================================
-- 0009 — Nova função de equipe: faturamento
-- (vê contas, guias, lotes e cadastro do paciente; NÃO vê prontuário)
-- =====================================================================
alter type public.funcao_profissional add value if not exists 'faturamento';
