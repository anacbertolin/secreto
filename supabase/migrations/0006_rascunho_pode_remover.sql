-- =====================================================================
-- 0006 — Itens do atendimento EM ANDAMENTO podem ser removidos
-- =====================================================================
-- Enquanto o atendimento não foi finalizado, o médico pode tirar um item
-- lançado por engano (diagnóstico, receita, pedido de exame, documento).
-- Depois de finalizado, a trava (tg_bloquear_se_finalizado) impede qualquer
-- remoção. Toda remoção fica registrada na auditoria.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['diagnosticos', 'prescricoes_oculos', 'prescricoes', 'prescricao_itens',
                           'solicitacoes_exames', 'documentos_clinicos'] loop
    execute format($p$create policy medico_remove_rascunho on public.%I for delete to authenticated
      using ((select interno.tem_funcao('medico')))$p$, t);
  end loop;
  foreach t in array array['refracoes'] loop
    execute format($p$create policy clinico_remove_rascunho on public.%I for delete to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
  end loop;
end $$;
