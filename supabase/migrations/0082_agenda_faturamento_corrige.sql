-- 0082 — Faturamento também remarca, cancela e corrige agendamentos (pedido da dona, 23/11/2026):
-- é o faturamento que corrige erros da agenda na hora de faturar / importar o XML.
create policy faturamento_altera on public.agendamentos
  for update to authenticated
  using ((select interno.tem_funcao('faturamento'::funcao_profissional)))
  with check ((select interno.tem_funcao('faturamento'::funcao_profissional)));
