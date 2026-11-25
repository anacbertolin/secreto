-- =====================================================================
-- 0102 — WhatsApp: respostas rápidas (atalho com "/"), como no WhatsApp Business
-- =====================================================================
-- Pedido da dona (25/11/2026): a Alessandra usa no celular mensagens prontas do dia a dia — digita "/" e escolhe.
-- Não é modelo da Meta: é só um texto guardado que vai como mensagem comum (dentro das 24 h).
--  * Uma lista por número (setor): a orientação compartilha entre quem atende; a clínica entre recepção/admin.
--  * Veem: quem vê o número. Criam/alteram/apagam: quem responde o número (e a admin).
--  * {nome} no texto vira o primeiro nome do paciente na hora de usar.
-- =====================================================================

create table public.whatsapp_respostas_rapidas (
  id             uuid primary key default gen_random_uuid(),
  setor          text not null check (setor in ('clinica', 'orientacao')),
  atalho         text not null check (atalho ~ '^[a-z0-9_-]{1,30}$'),
  texto          text not null check (length(trim(texto)) between 1 and 4000),
  criado_por     uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (setor, atalho)
);
comment on table public.whatsapp_respostas_rapidas is
  'Respostas rápidas do WhatsApp (digitar "/" na conversa). Texto comum, não é modelo da Meta. {nome} = primeiro nome do paciente.';
create index whatsapp_respostas_rapidas_criado_por_idx on public.whatsapp_respostas_rapidas (criado_por);

create trigger atualizado_em before update on public.whatsapp_respostas_rapidas
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.whatsapp_respostas_rapidas
  for each row execute function interno.tg_auditoria();

alter table public.whatsapp_respostas_rapidas enable row level security;
revoke all on public.whatsapp_respostas_rapidas from anon;
grant select, insert, update, delete on public.whatsapp_respostas_rapidas to authenticated;

create policy quem_ve_le on public.whatsapp_respostas_rapidas for select to authenticated
  using (
    (setor = 'clinica' and (select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('medico', 'admin')) or (select interno.atende_orientacao())))
  );
create policy quem_responde_inclui on public.whatsapp_respostas_rapidas for insert to authenticated
  with check (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('admin')) or (select interno.atende_orientacao())))
  );
create policy quem_responde_altera on public.whatsapp_respostas_rapidas for update to authenticated
  using (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('admin')) or (select interno.atende_orientacao())))
  )
  with check (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('admin')) or (select interno.atende_orientacao())))
  );
create policy quem_responde_apaga on public.whatsapp_respostas_rapidas for delete to authenticated
  using (
    (setor = 'clinica' and (select interno.tem_funcao('recepcao', 'admin')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('admin')) or (select interno.atende_orientacao())))
  );
