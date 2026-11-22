-- =====================================================================
-- 0030 — Receita digital pela Memed (decisão da dona, 15/11/2026)
-- =====================================================================
--  * profissionais_dados_pessoais: CPF, nascimento e sexo do prescritor (a Memed exige; RDC 1000/25).
--    Fica FORA de `profissionais` porque a equipe toda lê aquela tabela: aqui só a admin e o próprio.
--  * memed_config: liga/desliga, ambiente (homologação/produção), CNES e nome do local (setWorkplace).
--  * memed_prescricoes: cópia de cada receita emitida na Memed (evento prescricaoImpressa), marcada
--    como excluída quando a Memed avisa (prescricaoExcluida). Exigência da Memed para homologar.
-- As chaves da Memed (api-key/secret-key) ficam só nos segredos do Supabase (função Edge memed-token).
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só tabelas NOVAS.
-- =====================================================================

create table public.profissionais_dados_pessoais (
  profissional_id uuid primary key references public.profissionais(id),
  cpf             text check (cpf ~ '^[0-9]{11}$'),
  data_nascimento date,
  sexo            text check (sexo in ('M', 'F')),
  telefone        text,
  atualizado_em   timestamptz not null default now()
);
comment on table public.profissionais_dados_pessoais is 'CPF/nascimento dos profissionais (Memed). Só a admin e o próprio leem.';
create trigger atualizado_em before update on public.profissionais_dados_pessoais
  for each row execute function interno.tg_atualizado_em();

alter table public.profissionais_dados_pessoais enable row level security;
revoke all on public.profissionais_dados_pessoais from anon;
create policy admin_ou_proprio_le on public.profissionais_dados_pessoais for select to authenticated
  using ((select interno.tem_funcao('admin')) or profissional_id = (select interno.profissional_atual()));
create policy admin_ou_proprio_inclui on public.profissionais_dados_pessoais for insert to authenticated
  with check ((select interno.tem_funcao('admin')) or profissional_id = (select interno.profissional_atual()));
create policy admin_ou_proprio_altera on public.profissionais_dados_pessoais for update to authenticated
  using ((select interno.tem_funcao('admin')) or profissional_id = (select interno.profissional_atual()))
  with check ((select interno.tem_funcao('admin')) or profissional_id = (select interno.profissional_atual()));

-- Auditoria sem o CPF no log (registra só que mudou)
create or replace function interno.tg_dados_pessoais_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.log_auditoria (acao, tabela, detalhes)
  values (tg_op, 'profissionais_dados_pessoais', 'Dados pessoais do profissional ' || new.profissional_id || ' alterados');
  return null;
end $$;
create trigger auditoria after insert or update on public.profissionais_dados_pessoais
  for each row execute function interno.tg_dados_pessoais_auditoria();

create table public.memed_config (
  id            int primary key default 1 check (id = 1),
  ligado        boolean not null default false,
  ambiente      text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  cnes          text,
  nome_local    text,
  atualizado_em timestamptz not null default now()
);
comment on table public.memed_config is 'Receita digital Memed: liga/desliga, ambiente, CNES e nome do local. Só a admin altera.';
insert into public.memed_config (id) values (1);
create trigger atualizado_em before update on public.memed_config
  for each row execute function interno.tg_atualizado_em();
create or replace function interno.tg_memed_config_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.log_auditoria (acao, tabela, detalhes, dados_antes, dados_depois)
  values ('UPDATE', 'memed_config', 'Configuração da Memed alterada', to_jsonb(old), to_jsonb(new));
  return null;
end $$;
create trigger auditoria after update on public.memed_config
  for each row execute function interno.tg_memed_config_auditoria();

alter table public.memed_config enable row level security;
revoke all on public.memed_config from anon;
revoke insert, delete, truncate on public.memed_config from authenticated;
create policy equipe_le on public.memed_config for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
create policy admin_altera on public.memed_config for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));

create table public.memed_prescricoes (
  id              uuid primary key default gen_random_uuid(),
  memed_id        text not null unique,
  paciente_id     uuid not null references public.pacientes(id),
  atendimento_id  uuid references public.atendimentos(id),
  profissional_id uuid not null references public.profissionais(id) default interno.profissional_atual(),
  emitida_em      timestamptz not null default now(),
  itens           jsonb not null default '[]'::jsonb,    -- [{nome, posologia, quantidade, receituario, tipo}]
  assinada        boolean not null default false,
  reimpressao     boolean not null default false,
  excluida        boolean not null default false,
  excluida_em     timestamptz,
  criado_em       timestamptz not null default now()
);
comment on table public.memed_prescricoes is 'Cópia das receitas emitidas pela Memed (evento prescricaoImpressa); excluída quando a Memed avisa.';
create index memed_prescricoes_paciente_idx on public.memed_prescricoes (paciente_id, emitida_em desc);
create index memed_prescricoes_atendimento_idx on public.memed_prescricoes (atendimento_id);
create index memed_prescricoes_profissional_idx on public.memed_prescricoes (profissional_id);
create trigger auditoria after insert or update or delete on public.memed_prescricoes
  for each row execute function interno.tg_auditoria();

alter table public.memed_prescricoes enable row level security;
revoke all on public.memed_prescricoes from anon;
create policy clinico_le on public.memed_prescricoes for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy medico_registra on public.memed_prescricoes for insert to authenticated
  with check ((select interno.tem_funcao('medico')) and profissional_id = (select interno.profissional_atual()));
-- o médico só marca a própria receita como excluída (nada mais muda)
revoke update on public.memed_prescricoes from authenticated;
grant update (excluida, excluida_em) on public.memed_prescricoes to authenticated;
create policy medico_marca_excluida on public.memed_prescricoes for update to authenticated
  using ((select interno.tem_funcao('medico')) and profissional_id = (select interno.profissional_atual()))
  with check ((select interno.tem_funcao('medico')) and profissional_id = (select interno.profissional_atual()));
