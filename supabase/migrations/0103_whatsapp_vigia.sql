-- =====================================================================
-- 0103 — WhatsApp: "vigia" do recebimento
-- =====================================================================
-- Pedido da dona (25/11/2026): o número da Orientação Cirúrgica está só na API oficial (não há celular para
-- conferir). Se a entrega da Meta para o sistema (webhook) parar, ninguém perceberia. Esta função dá à tela os
-- sinais de vida do recebimento; a tela calcula o tempo sem sinal DENTRO do horário de atendimento e alerta.
-- Sinais (só do número pedido; security invoker — cada um só vê o que já pode ver):
--   ultimo_recebido  → última mensagem que um paciente mandou e chegou aqui
--   ultimo_status    → última confirmação de entrega/leitura (✓✓) que a Meta mandou de volta
--   sem_confirmacao  → mensagens enviadas nas últimas 3 h, há mais de 15 min, ainda sem ✓✓ (sinal de webhook parado)
-- =====================================================================

create or replace function public.whatsapp_vigia(p_setor text)
returns table (ultimo_recebido timestamptz, ultimo_status timestamptz, sem_confirmacao int, confirmadas_3h int)
language sql stable security invoker set search_path = '' as $$
  select
    (select max(m.criado_em) from public.whatsapp_mensagens m join public.whatsapp_conversas c on c.id = m.conversa_id
      where c.setor = p_setor and m.direcao = 'recebida' and not coalesce(m.importada, false)),
    (select max(m.atualizado_em) from public.whatsapp_mensagens m join public.whatsapp_conversas c on c.id = m.conversa_id
      where c.setor = p_setor and m.direcao = 'enviada' and m.situacao in ('entregue', 'lida')
        and m.atualizado_em > now() - interval '30 days'),
    (select count(*)::int from public.whatsapp_mensagens m join public.whatsapp_conversas c on c.id = m.conversa_id
      where c.setor = p_setor and m.direcao = 'enviada' and m.situacao = 'enviada' and m.wa_id is not null
        and m.quando between now() - interval '3 hours' and now() - interval '15 minutes'),
    (select count(*)::int from public.whatsapp_mensagens m join public.whatsapp_conversas c on c.id = m.conversa_id
      where c.setor = p_setor and m.direcao = 'enviada' and m.situacao in ('entregue', 'lida')
        and m.quando > now() - interval '3 hours')
$$;
revoke execute on function public.whatsapp_vigia(text) from public, anon;
grant execute on function public.whatsapp_vigia(text) to authenticated;
