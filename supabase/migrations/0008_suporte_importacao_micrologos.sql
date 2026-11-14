-- =====================================================================
-- 0008 — Suporte à importação do histórico do Micrologos
-- =====================================================================
-- Aprovado pela dona em 14/11/2026. Combinado com a sessão de migração
-- (roteiro em migracao/README.md, branch claude/beautiful-meitner-8eu6jk).
--  1. pacientes.prontuario_anterior  (nº do prontuário no Micrologos)
--  2. Auditoria não grava linha a linha durante a carga (app.migracao = 'on')
--  3. Profissional inativo pode ficar sem e-mail
--  4. prontuario_legado  (PEP antigo, só leitura)
--  5. paciente_documentos + bucket privado "documentos" (com SHA-256)
--  6. convenio_planos + plano_id em pacientes e agendamentos
-- =====================================================================

-- ---------- 1. Número do prontuário antigo ----------
alter table public.pacientes add column prontuario_anterior text;
create index pacientes_prontuario_anterior_idx on public.pacientes (prontuario_anterior)
  where prontuario_anterior is not null;
comment on column public.pacientes.prontuario_anterior is 'Número do prontuário no Micrologos (sistema antigo).';

-- ---------- 2. Auditoria: carga em massa grava só um resumo ----------
create or replace function interno.tg_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_linha    jsonb;
  v_registro uuid;
  v_paciente uuid;
begin
  -- Durante a importação do Micrologos (set app.migracao = 'on') a sessão de
  -- migração registra uma linha-resumo por carga; não grava linha a linha.
  if coalesce(current_setting('app.migracao', true), '') = 'on' then
    return null;
  end if;

  v_linha := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_registro := (v_linha ->> 'id')::uuid;

  if tg_table_name = 'pacientes' then
    v_paciente := v_registro;
  elsif v_linha ? 'paciente_id' then
    v_paciente := (v_linha ->> 'paciente_id')::uuid;
  elsif v_linha ? 'atendimento_id' then
    select a.paciente_id into v_paciente
    from public.atendimentos a where a.id = (v_linha ->> 'atendimento_id')::uuid;
  elsif v_linha ? 'prescricao_id' then
    select a.paciente_id into v_paciente
    from public.prescricoes p join public.atendimentos a on a.id = p.atendimento_id
    where p.id = (v_linha ->> 'prescricao_id')::uuid;
  elsif v_linha ? 'exame_realizado_id' then
    select e.paciente_id into v_paciente
    from public.exames_realizados e where e.id = (v_linha ->> 'exame_realizado_id')::uuid;
  end if;

  insert into public.log_auditoria (acao, tabela, registro_id, paciente_id, dados_antes, dados_depois)
  values (tg_op, tg_table_name, v_registro, v_paciente,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

-- ---------- 3. Profissional inativo sem e-mail ----------
alter table public.profissionais alter column email drop not null;
alter table public.profissionais add constraint profissionais_email_se_ativo
  check (email is not null or not ativo);
comment on column public.profissionais.email is 'Login no sistema. Obrigatório para quem está ativo; profissionais antigos (inativos) podem não ter.';

-- ---------- 4. Prontuário histórico (Micrologos) ----------
create table public.prontuario_legado (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid not null references public.pacientes(id),
  data            timestamptz not null,
  profissional_id uuid references public.profissionais(id),
  tipo            text not null default 'atendimento',   -- atendimento, evolução, ficha, laudo, receita, atestado…
  titulo          text,
  conteudo        text,
  formato         text not null default 'texto' check (formato in ('texto', 'html')),
  arquivo_caminho text,                                  -- PDF no bucket "documentos", se houver
  assinatura      jsonb,                                 -- metadados da assinatura digital original
  metadados       jsonb,
  importado_em    timestamptz not null default now()
);
create index prontuario_legado_paciente_idx on public.prontuario_legado (paciente_id, data desc);
create index prontuario_legado_profissional_idx on public.prontuario_legado (profissional_id);
comment on table public.prontuario_legado is 'Prontuário histórico importado do Micrologos. Só leitura no sistema; gravado apenas pela importação.';

-- ---------- 5. Documentos do paciente ----------
create table public.paciente_documentos (
  id             uuid primary key default gen_random_uuid(),
  paciente_id    uuid not null references public.pacientes(id),
  tipo           text not null default 'outro'
                 check (tipo in ('laudo', 'exame', 'receita', 'atestado', 'termo', 'foto', 'documento_pessoal', 'outro')),
  titulo         text not null,
  data_documento date,
  caminho        text not null unique,                   -- caminho no bucket "documentos"
  nome_arquivo   text not null,
  tipo_mime      text,
  tamanho_bytes  bigint,
  sha256         text check (sha256 ~ '^[0-9a-f]{64}$'),
  origem         text not null default 'sistema' check (origem in ('sistema', 'micrologos')),
  enviado_por    uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now()
);
create index paciente_documentos_paciente_idx on public.paciente_documentos (paciente_id, criado_em desc);
create index paciente_documentos_enviado_por_idx on public.paciente_documentos (enviado_por);
comment on table public.paciente_documentos is 'Arquivos do paciente (PDFs, fotos, documentos assinados). Nunca apagados.';

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do nothing;

-- ---------- 6. Planos dentro do convênio ----------
create table public.convenio_planos (
  id            uuid primary key default gen_random_uuid(),
  convenio_id   uuid not null references public.convenios(id),
  nome          text not null,
  codigo        text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (convenio_id, nome)
);
alter table public.pacientes    add column plano_id uuid references public.convenio_planos(id);
alter table public.agendamentos add column plano_id uuid references public.convenio_planos(id);
create index pacientes_plano_idx on public.pacientes (plano_id);
create index agendamentos_plano_idx on public.agendamentos (plano_id);

-- ---------- Gatilhos ----------
create trigger atualizado_em before update on public.convenio_planos
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.convenio_planos
  for each row execute function interno.tg_auditoria();
create trigger auditoria after insert or update or delete on public.paciente_documentos
  for each row execute function interno.tg_auditoria();
create trigger auditoria after insert or update or delete on public.prontuario_legado
  for each row execute function interno.tg_auditoria();

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================
alter table public.prontuario_legado   enable row level security;
alter table public.paciente_documentos enable row level security;
alter table public.convenio_planos     enable row level security;

-- Prontuário antigo: médico e enfermagem leem; ninguém grava pelo sistema
create policy clinico_le on public.prontuario_legado for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));

-- Documentos: médico e enfermagem leem e anexam; ninguém altera nem apaga
create policy clinico_le on public.paciente_documentos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy clinico_inclui on public.paciente_documentos for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem')) and origem = 'sistema');

create policy documentos_clinico_le on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (select interno.tem_funcao('medico', 'enfermagem')));
create policy documentos_clinico_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (select interno.tem_funcao('medico', 'enfermagem')));

-- Planos: como convênios
create policy equipe_le on public.convenio_planos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
create policy recepcao_admin_inclui on public.convenio_planos for insert to authenticated
  with check ((select interno.tem_funcao('recepcao', 'admin')));
create policy recepcao_admin_altera on public.convenio_planos for update to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin')))
  with check ((select interno.tem_funcao('recepcao', 'admin')));
