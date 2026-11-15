-- =====================================================================
-- 0013 — Tela de conversas do WhatsApp (Central de atendimento)
-- =====================================================================
--  * Quem da equipe está cuidando de cada conversa (responsavel_id), para que
--    duas pessoas da recepção não respondam o mesmo paciente.
--  * Conversas e mensagens passam a ser enviadas "ao vivo" para a tela
--    (Supabase Realtime). O Realtime respeita as mesmas regras de acesso (RLS):
--    só quem pode ler a tabela recebe os avisos.
--  Complementa a 0012_whatsapp (feita pela sessão da conexão com a Meta).
-- =====================================================================

alter table public.whatsapp_conversas
  add column responsavel_id uuid references public.profissionais(id);
comment on column public.whatsapp_conversas.responsavel_id is
  'Quem da equipe está cuidando desta conversa (null = ninguém assumiu).';
create index whatsapp_conversas_responsavel_idx on public.whatsapp_conversas (responsavel_id);

-- A equipe pode assumir / passar adiante a conversa (além de marcar lida, ligar ao paciente e arquivar)
grant update (responsavel_id) on public.whatsapp_conversas to authenticated;

-- Atualização ao vivo na tela
alter publication supabase_realtime add table public.whatsapp_conversas, public.whatsapp_mensagens;
