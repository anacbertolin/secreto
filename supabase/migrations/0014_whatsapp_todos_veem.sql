-- =====================================================================
-- 0014 — WhatsApp: toda a equipe VÊ, só a recepção (e a admin) ATENDE
-- Decisão da dona (15/11/2026): "Quem usa para atender o cliente é a
-- recepção, mas todos devem poder ver as conversas, até para ajudar a
-- gerir o negócio."
--  * Leitura de conversas, mensagens e modelos: médico, enfermagem,
--    recepção, admin e faturamento.
--  * Mexer na conversa (marcar como lida, ligar ao paciente, arquivar,
--    assumir): só recepção e admin. Assim quem só olha não "zera" as não
--    lidas da recepção.
--  * Enviar mensagens: só recepção e admin (conferido na função
--    whatsapp-enviar).
-- =====================================================================

drop policy atendimento_le on public.whatsapp_conversas;
drop policy atendimento_altera on public.whatsapp_conversas;
drop policy atendimento_le on public.whatsapp_mensagens;
drop policy equipe_le on public.whatsapp_modelos;

create policy equipe_le on public.whatsapp_conversas for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
create policy recepcao_admin_altera on public.whatsapp_conversas for update to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin')))
  with check ((select interno.tem_funcao('recepcao', 'admin')));

create policy equipe_le on public.whatsapp_mensagens for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));

create policy equipe_le on public.whatsapp_modelos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
