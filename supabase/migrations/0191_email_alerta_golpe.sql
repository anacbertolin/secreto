-- =====================================================================
-- 0191 — E-mail: alerta de golpe (pedido da dona, 27/11/2026)
-- =====================================================================
--  * A função Edge `email` analisa cada e-mail recebido e grava os motivos de desconfiança:
--    e-mail que o Google não conseguiu confirmar a origem (SPF/DKIM/DMARC falhou), remetente novo
--    falando de boleto/Pix/pagamento, pedido de troca de conta bancária, empresa conhecida usando
--    e-mail gratuito, respostas desviadas para outro endereço, anexos perigosos, pedido de senha.
--  * email_mensagens.alerta = [{nivel: 'alto'|'atencao', motivo: text}]
--  * email_conversas.alerta = maior nível entre as mensagens recebidas ('alto' | 'atencao' | null)
--  * O Gmail não repassa para outros sistemas a faixa "Tenha cuidado com esta mensagem";
--    este alerta cobre essa falta dentro do sistema.
-- =====================================================================
alter table public.email_mensagens add column alerta jsonb not null default '[]';
alter table public.email_conversas add column alerta text check (alerta in ('alto', 'atencao'));
comment on column public.email_mensagens.alerta is 'Motivos de desconfiança (alerta de golpe), calculados pela função Edge ao receber.';
comment on column public.email_conversas.alerta is 'Maior nível de alerta de golpe entre as mensagens recebidas da conversa.';
