-- 0093 — Novo tipo de agendamento: 'orientacao' (Orientação Cirúrgica). Pedido da dona, 23/11/2026.
-- Fica numa migração só dele porque um valor novo de enum não pode ser usado na mesma transação em que é criado.
alter type public.tipo_agendamento add value if not exists 'orientacao';
