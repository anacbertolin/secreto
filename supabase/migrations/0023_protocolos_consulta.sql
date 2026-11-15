-- =====================================================================
-- 0023 — Protocolos de consulta (modelos que preenchem a consulta inteira)
-- =====================================================================
-- Ex.: "Retorno de glaucoma" preenche anamnese, exame, conduta, orientações, pede
-- campo visual + OCT e marca o acompanhamento. Só preenche campos VAZIOS.
-- Os protocolos-padrão vêm prontos no sistema (código); esta tabela guarda os que
-- cada médico salvar a partir de um atendimento.
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só uma tabela NOVA. Nada muda no que existe.
-- =====================================================================

create table public.protocolos_consulta (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  conteudo        jsonb not null default '{}'::jsonb,   -- {atendimento:{...}, exame:{...}, exames:[...], seguimento:{condicao, dias}}
  profissional_id uuid references public.profissionais(id) default interno.profissional_atual(),
  compartilhado   boolean not null default true,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.protocolos_consulta is 'Protocolos de consulta salvos pelos médicos (preenchem os campos vazios do atendimento).';
create index protocolos_consulta_profissional_idx on public.protocolos_consulta (profissional_id);

create trigger atualizado_em before update on public.protocolos_consulta
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.protocolos_consulta
  for each row execute function interno.tg_auditoria();

alter table public.protocolos_consulta enable row level security;
revoke all on public.protocolos_consulta from anon;

-- Médico e enfermagem veem os compartilhados e os próprios; o médico cria e altera só os seus.
create policy clinico_le on public.protocolos_consulta for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem'))
         and (compartilhado or profissional_id = (select interno.profissional_atual())));
create policy medico_inclui on public.protocolos_consulta for insert to authenticated
  with check ((select interno.tem_funcao('medico')) and profissional_id = (select interno.profissional_atual()));
create policy dono_altera on public.protocolos_consulta for update to authenticated
  using (profissional_id = (select interno.profissional_atual()))
  with check (profissional_id = (select interno.profissional_atual()));
