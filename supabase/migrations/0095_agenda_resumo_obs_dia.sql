-- =====================================================================
-- 0095 — Agenda no estilo do Micrologos (pedido da dona, 23/11/2026)
--  * agendamentos.atualizado_por: quem fez a última alteração (aparece no quadro de resumo, junto com quem incluiu).
--  * agenda_obs_dia: observação do dia de cada coluna da agenda ("Obs do Dia do Médico" do Micrologos),
--    ex.: "Dr. Gelson chega às 10h", "Orientação: Alessandra de folga à tarde".
-- =====================================================================

alter table public.agendamentos add column if not exists atualizado_por uuid references public.profissionais(id);
create index if not exists agendamentos_atualizado_por_idx on public.agendamentos (atualizado_por);
comment on column public.agendamentos.atualizado_por is 'Quem fez a última alteração no agendamento.';

create or replace function interno.tg_agendamento_quem_alterou()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.atualizado_por := coalesce(interno.profissional_atual(), new.atualizado_por);
  return new;
end $$;
revoke execute on function interno.tg_agendamento_quem_alterou() from public, anon, authenticated;
create trigger quem_alterou before update on public.agendamentos
  for each row execute function interno.tg_agendamento_quem_alterou();

create table public.agenda_obs_dia (
  id              uuid not null unique default gen_random_uuid(),   -- para a auditoria
  profissional_id uuid not null references public.profissionais(id),
  dia             date not null,
  texto           text not null check (length(trim(texto)) between 1 and 1000),
  atualizado_por  uuid references public.profissionais(id) default interno.profissional_atual(),
  atualizado_em   timestamptz not null default now(),
  primary key (profissional_id, dia)
);
comment on table public.agenda_obs_dia is 'Observação do dia de cada coluna da agenda (como o "Obs do Dia do Médico" do Micrologos).';
create index agenda_obs_dia_dia_idx on public.agenda_obs_dia (dia);
create index agenda_obs_dia_atualizado_por_idx on public.agenda_obs_dia (atualizado_por);

create or replace function interno.tg_agenda_obs_quem()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(interno.profissional_atual(), new.atualizado_por);
  return new;
end $$;
revoke execute on function interno.tg_agenda_obs_quem() from public, anon, authenticated;
create trigger quem_alterou before insert or update on public.agenda_obs_dia
  for each row execute function interno.tg_agenda_obs_quem();
create trigger auditoria after insert or update or delete on public.agenda_obs_dia
  for each row execute function interno.tg_auditoria();

alter table public.agenda_obs_dia enable row level security;
revoke all on public.agenda_obs_dia from anon;
grant select, insert, update, delete on public.agenda_obs_dia to authenticated;
-- Quem vê a agenda vê e escreve as observações do dia
create policy equipe_le on public.agenda_obs_dia for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
create policy equipe_inclui on public.agenda_obs_dia for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
create policy equipe_altera on public.agenda_obs_dia for update to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')))
  with check ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
create policy equipe_apaga on public.agenda_obs_dia for delete to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
