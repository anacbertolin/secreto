-- =====================================================================
-- 0003 — Segurança: quem vê e quem altera cada coisa (RLS)
-- =====================================================================
--  Recepção ....... cadastro, agenda, convênios (SEM conteúdo clínico)
--  Enfermagem ..... + histórico, triagem, refração, adendos (leitura clínica total)
--  Médico ......... + atendimento, exame, diagnóstico, receitas, pedidos, documentos
--  Admin .......... equipe, convênios, leitura da auditoria
--  Ninguém apaga: registros são inativados, cancelados ou corrigidos por adendo.
--  Visitante anônimo: nenhum acesso.
-- =====================================================================

-- Anônimos não acessam nada
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
grant execute on function public.registrar_leitura(uuid, text) to authenticated;

revoke execute on all functions in schema interno from public, anon;
grant execute on all functions in schema interno to authenticated, service_role;

-- Liga RLS em todas as tabelas
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Cadastros (toda a equipe) ----------
create policy equipe_le on public.profissionais for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
create policy admin_inclui on public.profissionais for insert to authenticated
  with check ((select interno.tem_funcao('admin')));
create policy admin_altera on public.profissionais for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));

create policy equipe_le on public.convenios for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
create policy recepcao_admin_inclui on public.convenios for insert to authenticated
  with check ((select interno.tem_funcao('recepcao', 'admin')));
create policy recepcao_admin_altera on public.convenios for update to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin'))) with check ((select interno.tem_funcao('recepcao', 'admin')));

do $$
declare t text;
begin
  foreach t in array array['pacientes', 'agendamentos'] loop
    execute format($p$create policy equipe_le on public.%I for select to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')))$p$, t);
    execute format($p$create policy equipe_inclui on public.%I for insert to authenticated
      with check ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')))$p$, t);
    execute format($p$create policy equipe_altera on public.%I for update to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')))
      with check ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')))$p$, t);
  end loop;
end $$;

-- ---------- Clínico: médico e enfermagem leem e registram ----------
do $$
declare t text;
begin
  foreach t in array array['alergias', 'medicamentos_em_uso', 'antecedentes', 'triagens', 'refracoes'] loop
    execute format($p$create policy clinico_le on public.%I for select to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
    execute format($p$create policy clinico_inclui on public.%I for insert to authenticated
      with check ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
    execute format($p$create policy clinico_altera on public.%I for update to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem')))
      with check ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
  end loop;
end $$;

-- ---------- Clínico: médico registra, enfermagem lê ----------
do $$
declare t text;
begin
  foreach t in array array['exames_oftalmologicos', 'diagnosticos', 'prescricoes_oculos', 'prescricoes',
                           'prescricao_itens', 'solicitacoes_exames', 'documentos_clinicos'] loop
    execute format($p$create policy clinico_le on public.%I for select to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
    execute format($p$create policy medico_inclui on public.%I for insert to authenticated
      with check ((select interno.tem_funcao('medico')))$p$, t);
    execute format($p$create policy medico_altera on public.%I for update to authenticated
      using ((select interno.tem_funcao('medico')))
      with check ((select interno.tem_funcao('medico')))$p$, t);
  end loop;
end $$;

-- ---------- Atendimento: só o médico responsável altera ----------
create policy clinico_le on public.atendimentos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy medico_inclui on public.atendimentos for insert to authenticated
  with check ((select interno.tem_funcao('medico')) and profissional_id = (select interno.profissional_atual()));
create policy medico_responsavel_altera on public.atendimentos for update to authenticated
  using ((select interno.tem_funcao('medico')) and profissional_id = (select interno.profissional_atual()))
  with check (profissional_id = (select interno.profissional_atual()));

-- ---------- Adendos: só inclusão, em nome próprio ----------
create policy clinico_le on public.adendos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy clinico_inclui on public.adendos for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem')) and autor_id = (select interno.profissional_atual()));

-- ---------- Auditoria ----------
create policy admin_le on public.log_auditoria for select to authenticated
  using ((select interno.tem_funcao('admin')));
create policy equipe_registra_leitura on public.log_auditoria for insert to authenticated
  with check (
    acao = 'LEITURA'
    and email = (select interno.email_atual())
    and (select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin'))
  );
