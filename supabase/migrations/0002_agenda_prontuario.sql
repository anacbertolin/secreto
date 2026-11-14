-- =====================================================================
-- 0002 — Agenda e prontuário oftalmológico
-- =====================================================================
-- Regra de ouro: atendimento FINALIZADO não pode mais ser alterado.
-- Correções depois disso são feitas por ADENDO (exigência do CFM).
-- Nada clínico é apagado (guarda mínima de 20 anos).
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------- Agenda ----------
create type public.tipo_agendamento as enum ('consulta', 'retorno', 'exame', 'procedimento', 'cirurgia');
create type public.status_agendamento as enum
  ('agendado', 'confirmado', 'chegou', 'em_atendimento', 'atendido', 'faltou', 'cancelado');

create table public.agendamentos (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null references public.pacientes(id),
  profissional_id     uuid not null references public.profissionais(id),
  inicio              timestamptz not null,
  fim                 timestamptz not null,
  tipo                public.tipo_agendamento not null default 'consulta',
  status              public.status_agendamento not null default 'agendado',
  convenio_id         uuid references public.convenios(id),
  sala                text,
  observacoes         text,
  motivo_cancelamento text,
  criado_por          uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (fim > inicio),
  -- impede dois horários sobrepostos para o mesmo profissional
  constraint agenda_sem_conflito exclude using gist (
    profissional_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status not in ('cancelado', 'faltou'))
);
create index agendamentos_paciente_idx on public.agendamentos (paciente_id);
create index agendamentos_inicio_idx on public.agendamentos (inicio);

-- ---------- Atendimento (a "folha" de cada consulta) ----------
create type public.status_atendimento as enum ('em_andamento', 'finalizado');

create table public.atendimentos (
  id                     uuid primary key default gen_random_uuid(),
  paciente_id            uuid not null references public.pacientes(id),
  agendamento_id         uuid references public.agendamentos(id),
  profissional_id        uuid not null references public.profissionais(id) default interno.profissional_atual(),
  inicio                 timestamptz not null default now(),
  tipo                   public.tipo_agendamento not null default 'consulta',
  queixa_principal       text,
  historia_doenca_atual  text,
  revisao_sistemas       text,
  conduta                text,
  orientacoes            text,
  retorno_em             text,
  status                 public.status_atendimento not null default 'em_andamento',
  finalizado_em          timestamptz,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
create index atendimentos_paciente_idx on public.atendimentos (paciente_id, inicio desc);
create index atendimentos_profissional_idx on public.atendimentos (profissional_id);
create index atendimentos_agendamento_idx on public.atendimentos (agendamento_id);

-- ---------- Triagem / pré-consulta (enfermagem) ----------
create table public.triagens (
  id                  uuid primary key default gen_random_uuid(),
  atendimento_id      uuid not null references public.atendimentos(id),
  pressao_sistolica   int,
  pressao_diastolica  int,
  frequencia_cardiaca int,
  glicemia            int,
  peso_kg             numeric(5,1),
  altura_cm           numeric(5,1),
  av_longe_od_sc      text,   -- acuidade visual sem correção
  av_longe_oe_sc      text,
  av_longe_od_cc      text,   -- acuidade visual com correção
  av_longe_oe_cc      text,
  av_perto_od         text,
  av_perto_oe         text,
  pio_od              numeric(4,1),  -- pressão intraocular (mmHg)
  pio_oe              numeric(4,1),
  pio_metodo          text,
  pio_hora            time,
  observacoes         text,
  registrado_por      uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index triagens_atendimento_idx on public.triagens (atendimento_id);

-- ---------- Refração / lensometria / ceratometria ----------
create table public.refracoes (
  id              uuid primary key default gen_random_uuid(),
  atendimento_id  uuid not null references public.atendimentos(id),
  tipo            text not null check (tipo in
                    ('lensometria', 'autorrefracao', 'dinamica', 'estatica_cicloplegia', 'ceratometria')),
  olho            public.olho not null check (olho in ('OD', 'OE')),
  esferico        numeric(5,2),
  cilindrico      numeric(5,2),
  eixo            int check (eixo between 0 and 180),
  adicao          numeric(4,2),
  acuidade_visual text,
  k1              numeric(5,2),
  k2              numeric(5,2),
  eixo_k          int check (eixo_k between 0 and 180),
  observacoes     text,
  registrado_por  uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index refracoes_atendimento_idx on public.refracoes (atendimento_id);

-- ---------- Exame oftalmológico (médico) ----------
create table public.exames_oftalmologicos (
  id                 uuid primary key default gen_random_uuid(),
  atendimento_id     uuid not null unique references public.atendimentos(id),
  ectoscopia         text,
  motilidade_ocular  text,
  reflexos_pupilares text,
  biomicroscopia_od  text,
  biomicroscopia_oe  text,
  gonioscopia_od     text,
  gonioscopia_oe     text,
  pio_aplanacao_od   numeric(4,1),
  pio_aplanacao_oe   numeric(4,1),
  fundoscopia_od     text,
  fundoscopia_oe     text,
  outros_achados     text,
  registrado_por     uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- ---------- Diagnósticos ----------
create table public.diagnosticos (
  id             uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id),
  cid10          text not null,
  descricao      text not null,
  olho           public.olho,
  principal      boolean not null default false,
  registrado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index diagnosticos_atendimento_idx on public.diagnosticos (atendimento_id);
create index diagnosticos_cid_idx on public.diagnosticos (cid10);

-- ---------- Receita de óculos ----------
create table public.prescricoes_oculos (
  id                uuid primary key default gen_random_uuid(),
  atendimento_id    uuid not null references public.atendimentos(id),
  longe_od_esferico   numeric(5,2),
  longe_od_cilindrico numeric(5,2),
  longe_od_eixo       int check (longe_od_eixo between 0 and 180),
  longe_oe_esferico   numeric(5,2),
  longe_oe_cilindrico numeric(5,2),
  longe_oe_eixo       int check (longe_oe_eixo between 0 and 180),
  adicao            numeric(4,2),
  dnp_od            numeric(4,1),
  dnp_oe            numeric(4,1),
  tipo_lente        text,
  observacoes       text,
  validade          date,
  registrado_por    uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index prescricoes_oculos_atendimento_idx on public.prescricoes_oculos (atendimento_id);

-- ---------- Receita de medicamentos ----------
create type public.tipo_receita as enum ('simples', 'controle_especial', 'antimicrobiano');

create table public.prescricoes (
  id             uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id),
  tipo_receita   public.tipo_receita not null default 'simples',
  observacoes    text,
  registrado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index prescricoes_atendimento_idx on public.prescricoes (atendimento_id);

create table public.prescricao_itens (
  id            uuid primary key default gen_random_uuid(),
  prescricao_id uuid not null references public.prescricoes(id),
  ordem         int not null default 1,
  medicamento   text not null,
  apresentacao  text,
  posologia     text not null,
  olho          public.olho,
  via           text,
  duracao       text,
  quantidade    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index prescricao_itens_prescricao_idx on public.prescricao_itens (prescricao_id);

-- ---------- Pedidos de exame ----------
create table public.solicitacoes_exames (
  id             uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id),
  exame          text not null,
  codigo_tuss    text,
  olho           public.olho,
  justificativa  text,
  urgente        boolean not null default false,
  status         text not null default 'solicitado'
                 check (status in ('solicitado', 'agendado', 'realizado', 'cancelado')),
  registrado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index solicitacoes_atendimento_idx on public.solicitacoes_exames (atendimento_id);

-- ---------- Atestados, declarações, laudos, termos ----------
create table public.documentos_clinicos (
  id               uuid primary key default gen_random_uuid(),
  atendimento_id   uuid not null references public.atendimentos(id),
  tipo             text not null check (tipo in
                     ('atestado', 'declaracao_comparecimento', 'laudo', 'relatorio', 'encaminhamento', 'termo_consentimento')),
  conteudo         text not null,
  dias_afastamento int,
  cid10            text,
  registrado_por   uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index documentos_atendimento_idx on public.documentos_clinicos (atendimento_id);

-- ---------- Adendos (correções após finalizar) ----------
create table public.adendos (
  id             uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id),
  texto          text not null,
  autor_id       uuid not null references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now()
);
create index adendos_atendimento_idx on public.adendos (atendimento_id);

-- =====================================================================
-- Travas: atendimento finalizado não muda
-- =====================================================================
create or replace function interno.tg_atendimento_trava()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'finalizado' then
    raise exception 'Este atendimento já foi finalizado e não pode ser alterado. Registre um adendo.';
  end if;
  if new.status = 'finalizado' then
    new.finalizado_em := now();
  end if;
  return new;
end $$;

create trigger trava_finalizado before update on public.atendimentos
  for each row execute function interno.tg_atendimento_trava();

create or replace function interno.tg_bloquear_se_finalizado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_linhas jsonb[];
  v_linha  jsonb;
  v_atend  uuid;
begin
  v_linhas := array_remove(array[
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end], null);

  foreach v_linha in array v_linhas loop
    if v_linha ? 'atendimento_id' then
      v_atend := (v_linha ->> 'atendimento_id')::uuid;
    else
      select p.atendimento_id into v_atend
      from public.prescricoes p where p.id = (v_linha ->> 'prescricao_id')::uuid;
    end if;

    if exists (select 1 from public.atendimentos a where a.id = v_atend and a.status = 'finalizado') then
      raise exception 'Este atendimento já foi finalizado e não pode ser alterado. Registre um adendo.';
    end if;
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Gatilhos: atualizado_em, auditoria e trava
do $$
declare t text;
begin
  foreach t in array array['agendamentos', 'atendimentos', 'triagens', 'refracoes', 'exames_oftalmologicos',
                           'diagnosticos', 'prescricoes_oculos', 'prescricoes', 'prescricao_itens',
                           'solicitacoes_exames', 'documentos_clinicos'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
  end loop;

  foreach t in array array['agendamentos', 'atendimentos', 'triagens', 'refracoes', 'exames_oftalmologicos',
                           'diagnosticos', 'prescricoes_oculos', 'prescricoes', 'prescricao_itens',
                           'solicitacoes_exames', 'documentos_clinicos', 'adendos'] loop
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;

  foreach t in array array['triagens', 'refracoes', 'exames_oftalmologicos', 'diagnosticos', 'prescricoes_oculos',
                           'prescricoes', 'prescricao_itens', 'solicitacoes_exames', 'documentos_clinicos'] loop
    execute format('create trigger trava_finalizado before insert or update or delete on public.%I for each row execute function interno.tg_bloquear_se_finalizado()', t);
  end loop;
end $$;
