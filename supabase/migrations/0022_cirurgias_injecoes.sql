-- =====================================================================
-- 0022 — Centro cirúrgico, lente intraocular (LIO) e injeções intravítreas
-- =====================================================================
--  * cirurgias ............. indicação → agendamento → checklist de cirurgia segura (OMS) →
--                            descrição cirúrgica → finalizada (imutável, como o laudo).
--                            Biometria e LIO com lote/série/validade (rastreabilidade ANVISA).
--  * injecoes_intravitreas . cada aplicação (anti-VEGF etc.), com lote, nº na série e a
--                            próxima aplicação prevista.
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só tabelas NOVAS. Nada muda em pacientes, agenda ou
-- atendimentos. Os gatilhos novos só existem nas tabelas novas e ignoram app.migracao = 'on'
-- (permite carregar cirurgias antigas já finalizadas, se um dia vierem do Micrologos).
-- =====================================================================

create table public.cirurgias (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references public.pacientes(id),
  atendimento_id     uuid references public.atendimentos(id),      -- consulta em que foi indicada
  agendamento_id     uuid references public.agendamentos(id),      -- horário no mapa cirúrgico
  cirurgiao_id       uuid not null references public.profissionais(id) default interno.profissional_atual(),
  procedimento       text not null,
  olho               public.olho not null check (olho in ('OD', 'OE')),
  anestesia          text check (anestesia in ('topica', 'peribulbar', 'retrobulbar', 'subtenoniana', 'sedacao', 'geral')),
  status             text not null default 'indicada'
                     check (status in ('indicada', 'aguardando_autorizacao', 'autorizada', 'agendada', 'realizada', 'cancelada')),
  data_prevista      timestamptz,
  sala               text,
  equipe             text,                                         -- auxiliar, anestesista, instrumentador
  convenio_id        uuid references public.convenios(id),
  senha_autorizacao  text,
  prioridade         text not null default 'eletiva' check (prioridade in ('eletiva', 'prioritaria', 'urgencia')),
  observacoes        text,
  -- Biometria / cálculo da LIO
  comprimento_axial  numeric(5,2),
  k1                 numeric(5,2),
  k2                 numeric(5,2),
  acd                numeric(4,2),
  formula            text,
  constante_a        numeric(6,3),
  refracao_alvo      numeric(5,2),
  -- Lente implantada (rastreabilidade)
  lio_fabricante     text,
  lio_modelo         text,
  lio_dioptria       numeric(5,2),
  lio_lote           text,
  lio_serie          text,
  lio_validade       date,
  lio_registro_anvisa text,
  -- Checklist de cirurgia segura (OMS): {"item": "2026-11-15T10:00:00Z", ...}
  checklist          jsonb not null default '{}'::jsonb,
  -- Ato cirúrgico
  inicio_em          timestamptz,
  fim_em             timestamptz,
  descricao_cirurgica text,
  intercorrencias    text,
  motivo_cancelamento text,
  finalizada_em      timestamptz,
  finalizada_por     uuid references public.profissionais(id),
  criado_por         uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  check (status <> 'cancelada' or motivo_cancelamento is not null),
  check (finalizada_em is null or status = 'realizada')
);
comment on table public.cirurgias is 'Cirurgias oftalmológicas: indicação, autorização, mapa, checklist OMS, LIO (lote/série) e descrição. Finalizada não muda.';
create index cirurgias_paciente_idx on public.cirurgias (paciente_id);
create index cirurgias_data_idx on public.cirurgias (data_prevista);
create index cirurgias_status_idx on public.cirurgias (status);
create index cirurgias_cirurgiao_idx on public.cirurgias (cirurgiao_id);
create index cirurgias_atendimento_idx on public.cirurgias (atendimento_id);
create index cirurgias_agendamento_idx on public.cirurgias (agendamento_id);
create index cirurgias_convenio_idx on public.cirurgias (convenio_id);
create index cirurgias_finalizada_por_idx on public.cirurgias (finalizada_por);
create index cirurgias_criado_por_idx on public.cirurgias (criado_por);
create index cirurgias_lio_lote_idx on public.cirurgias (lio_lote) where lio_lote is not null;

create table public.injecoes_intravitreas (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references public.pacientes(id),
  olho               public.olho not null check (olho in ('OD', 'OE')),
  medicamento        text not null,
  dose               text,
  lote               text,
  validade           date,
  indicacao_cid10    text,
  indicacao          text,
  protocolo          text check (protocolo in ('ataque_mensal', 'tratar_e_estender', 'prn', 'outro')),
  aplicado_em        timestamptz not null default now(),
  aplicado_por       uuid not null references public.profissionais(id) default interno.profissional_atual(),
  proxima_semanas    smallint check (proxima_semanas between 1 and 52),
  senha_autorizacao  text,
  intercorrencias    text,
  observacoes        text,
  cancelada          boolean not null default false,
  motivo_cancelamento text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  check (not cancelada or motivo_cancelamento is not null)
);
comment on table public.injecoes_intravitreas is 'Aplicações de medicamento dentro do olho (anti-VEGF, corticoide): lote, série e próxima aplicação.';
create index injecoes_paciente_idx on public.injecoes_intravitreas (paciente_id, olho, aplicado_em desc);
create index injecoes_aplicado_por_idx on public.injecoes_intravitreas (aplicado_por);
create index injecoes_lote_idx on public.injecoes_intravitreas (lote) where lote is not null;

-- ---------- Regras da cirurgia ----------
create or replace function interno.tg_cirurgia_regras()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.migracao', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.finalizada_em is not null then
    raise exception 'Esta cirurgia já foi finalizada e não pode ser alterada. Registre um adendo no prontuário.';
  end if;
  if new.finalizada_em is not null and (tg_op = 'INSERT' or old.finalizada_em is null) then
    if not interno.tem_funcao('medico') then
      raise exception 'Só o médico finaliza a cirurgia.';
    end if;
    if coalesce(trim(new.descricao_cirurgica), '') = '' then
      raise exception 'Preencha a descrição cirúrgica antes de finalizar.';
    end if;
    new.finalizada_em := now();
    new.finalizada_por := interno.profissional_atual();
    new.status := 'realizada';
  end if;
  return new;
end $$;

create trigger regras before insert or update on public.cirurgias
  for each row execute function interno.tg_cirurgia_regras();
create trigger atualizado_em before update on public.cirurgias
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.cirurgias
  for each row execute function interno.tg_auditoria();
create trigger atualizado_em before update on public.injecoes_intravitreas
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.injecoes_intravitreas
  for each row execute function interno.tg_auditoria();

-- ---------- Acesso ----------
alter table public.cirurgias enable row level security;
alter table public.injecoes_intravitreas enable row level security;
revoke all on public.cirurgias, public.injecoes_intravitreas from anon;

-- Médico e enfermagem leem e registram (enfermagem preenche checklist, lote da LIO, horários).
-- Só o médico finaliza (conferido no gatilho). Ninguém apaga: cirurgia é cancelada com motivo.
do $$
declare t text;
begin
  foreach t in array array['cirurgias', 'injecoes_intravitreas'] loop
    execute format($p$create policy clinico_le on public.%I for select to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
    execute format($p$create policy clinico_inclui on public.%I for insert to authenticated
      with check ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
    execute format($p$create policy clinico_altera on public.%I for update to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem')))
      with check ((select interno.tem_funcao('medico', 'enfermagem')))$p$, t);
  end loop;
end $$;

-- ---------- Injeções: série por olho e próxima aplicação ----------
-- SECURITY INVOKER: respeita o RLS (só médico/enfermagem veem algo).
create or replace view public.injecoes_resumo with (security_invoker = true) as
  select i.*,
         case when not i.cancelada then count(*) filter (where not i.cancelada) over (partition by i.paciente_id, i.olho order by i.aplicado_em) end as numero_na_serie,
         case when i.proxima_semanas is not null
              then ((i.aplicado_em at time zone 'America/Sao_Paulo')::date + i.proxima_semanas * 7) end as proxima_prevista
  from public.injecoes_intravitreas i;
revoke all on public.injecoes_resumo from anon;
grant select on public.injecoes_resumo to authenticated;

-- Próximas aplicações (última de cada paciente+olho), para a lista "a aplicar / atrasadas"
create or replace function public.injecoes_pendentes()
returns table (paciente_id uuid, numero_prontuario bigint, nome text, telefone text, olho public.olho, medicamento text,
               ultima_em timestamptz, aplicacoes bigint, proxima_prevista date, dias_para int, proximo_agendamento timestamptz)
language sql stable security invoker set search_path = '' as $$
  with ult as (
    select distinct on (i.paciente_id, i.olho) i.paciente_id, i.olho, i.medicamento, i.aplicado_em, i.proxima_semanas
    from public.injecoes_intravitreas i where not i.cancelada
    order by i.paciente_id, i.olho, i.aplicado_em desc
  )
  select p.id, p.numero_prontuario, p.nome, p.telefone, u.olho, u.medicamento, u.aplicado_em,
         (select count(*) from public.injecoes_intravitreas x where x.paciente_id = u.paciente_id and x.olho = u.olho and not x.cancelada),
         (u.aplicado_em at time zone 'America/Sao_Paulo')::date + u.proxima_semanas * 7,
         ((u.aplicado_em at time zone 'America/Sao_Paulo')::date + u.proxima_semanas * 7 - current_date)::int,
         (select min(g.inicio) from public.agendamentos g
           where g.paciente_id = u.paciente_id and g.inicio >= now() and g.status in ('agendado', 'confirmado'))
  from ult u join public.pacientes p on p.id = u.paciente_id and p.ativo
  where u.proxima_semanas is not null
  order by 9
$$;
revoke execute on function public.injecoes_pendentes() from public, anon;
grant execute on function public.injecoes_pendentes() to authenticated;
