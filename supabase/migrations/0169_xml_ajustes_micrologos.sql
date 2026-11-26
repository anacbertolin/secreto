-- =====================================================================
-- 0169 — Ajustes do XML para ficar igual ao Micrologos (comparação com XML reais do Bradesco, 26/11/2026)
--   - profissional_dados_tiss: nome do médico como sai na guia e CPF (código do profissional quando o convênio não tem
--     código próprio). Só faturamento/administração leem (CPF é dado pessoal).
--   - conta_itens.fator: % redução/acréscimo informado na guia (ex.: 2,00 na facectomia do Bradesco); o valor unitário
--     já vem com o fator aplicado, como no Micrologos.
--   - conta_itens.numero_guia: nas cirurgias, cada participante (auxiliar, instrumentador) tem a sua própria Guia de
--     Honorários, com número próprio.
-- =====================================================================
create table if not exists public.profissional_dados_tiss (
  profissional_id uuid primary key references public.profissionais(id) on delete cascade,
  nome_guia       text,
  cpf             text check (cpf is null or cpf ~ '^\d{11}$'),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
alter table public.profissional_dados_tiss enable row level security;
create policy faturamento_le on public.profissional_dados_tiss for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create policy faturamento_inclui on public.profissional_dados_tiss for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy faturamento_altera on public.profissional_dados_tiss for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy faturamento_apaga on public.profissional_dados_tiss for delete to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin')));
create trigger atualizado_em before update on public.profissional_dados_tiss
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.profissional_dados_tiss
  for each row execute function interno.tg_auditoria();
comment on table public.profissional_dados_tiss is 'Dados do médico para o XML TISS: nome como sai na guia e CPF (só faturamento/admin).';

alter table public.conta_itens add column if not exists fator numeric(6,2) not null default 1 check (fator > 0);
alter table public.conta_itens add column if not exists numero_guia text;
create unique index if not exists conta_itens_numero_guia_uk on public.conta_itens (numero_guia) where numero_guia is not null;

-- nº de guia novo não repete nº de conta nem de guia de participante
create or replace function interno.proximo_numero_guia()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v text;
begin
  loop
    v := lpad(nextval('public.guia_prestador_seq')::text, 8, '0');
    exit when not exists (select 1 from public.contas where numero_guia_prestador = v)
          and not exists (select 1 from public.conta_itens where numero_guia = v);
  end loop;
  return v;
end $$;

-- participante da cirurgia (auxiliar, instrumentador…) ganha nº de guia próprio
create or replace function interno.tg_item_numero_guia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.migracao', true) = 'on' then return new; end if;
  if new.numero_guia is null and coalesce(new.grau_participacao, '00') <> '00'
     and exists (select 1 from public.contas c where c.id = new.conta_id and c.tipo_guia = 'honorarios') then
    new.numero_guia := interno.proximo_numero_guia();
  end if;
  return new;
end $$;
revoke execute on function interno.tg_item_numero_guia() from public, anon, authenticated;
drop trigger if exists numero_guia on public.conta_itens;
create trigger numero_guia before insert or update of grau_participacao on public.conta_itens
  for each row execute function interno.tg_item_numero_guia();
