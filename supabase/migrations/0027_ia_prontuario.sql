-- =====================================================================
-- 0027 — Resumo do prontuário por IA (Claude) — NASCE DESLIGADO
-- =====================================================================
-- Botão "✨ Resumo (IA)" no atendimento e na ficha: a função Edge `prontuario-resumo`
-- lê o histórico COM O LOGIN DE QUEM PEDIU (o RLS continua valendo), tira nome, CPF,
-- telefone, endereço e números longos, e pede à IA um resumo para o médico.
-- Nada do resumo é guardado; a auditoria registra que o resumo foi pedido.
-- Só a administração liga/desliga, e só depois do aval da dona (envio de dado de saúde,
-- sem identificação direta, à Anthropic — EUA).
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só uma tabela NOVA.
-- =====================================================================
create table public.ia_prontuario_config (
  id            int primary key default 1 check (id = 1),
  ligado        boolean not null default false,
  atualizado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  atualizado_em timestamptz not null default now()
);
comment on table public.ia_prontuario_config is 'Liga/desliga o resumo do prontuário por IA. Só a admin altera. Nasce desligado.';
insert into public.ia_prontuario_config (id) values (1);
create index ia_prontuario_config_atualizado_por_idx on public.ia_prontuario_config (atualizado_por);
create trigger atualizado_em before update on public.ia_prontuario_config
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.ia_prontuario_config
  for each row execute function interno.tg_auditoria();

alter table public.ia_prontuario_config enable row level security;
revoke all on public.ia_prontuario_config from anon;
revoke insert, delete, truncate on public.ia_prontuario_config from authenticated;
create policy equipe_le on public.ia_prontuario_config for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'admin')));
create policy admin_altera on public.ia_prontuario_config for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));
