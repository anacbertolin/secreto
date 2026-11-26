-- 0165 — Remove índice duplicado criado na 0163 (já existia contas_data_idx).
drop index if exists public.contas_data_atendimento_idx;
