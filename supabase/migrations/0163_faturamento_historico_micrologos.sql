-- =====================================================================
-- 0163 — Faturamento antigo do Micrologos (sessão "Dados para migração", 25/11/2026)
-- Decisão da dona (25/11): trazer TODAS as contas desde 2016.
--   - De 2021 em diante: contas normais (dá para reabrir cobrança, tirar/recolocar paciente para recurso, gerar XML).
--   - De 2016 a 2020: contas ARQUIVADAS — aparecem em consulta e relatórios, mas não podem ser alteradas.
--     Faturamento/admin podem desarquivar uma conta se um dia precisar mexer nela.
-- Também: guarda os números originais do Micrologos (coluna "legado") e o número da guia novo nunca repete
-- um número antigo.
-- =====================================================================

alter table public.contas      add column if not exists arquivada boolean not null default false;
alter table public.contas      add column if not exists legado jsonb;
alter table public.conta_itens add column if not exists legado jsonb;
alter table public.lotes       add column if not exists arquivado boolean not null default false;
alter table public.lotes       add column if not exists legado jsonb;

comment on column public.contas.arquivada is 'Histórico (Micrologos, antes de 2021): só consulta e relatórios. Desarquivar (faturamento/admin) para alterar.';
comment on column public.contas.legado is 'Dados originais do Micrologos (id da conta, cobrança, guia, tipo de guia TISS).';
comment on column public.lotes.arquivado is 'Cobrança antiga do Micrologos (antes de 2021): só consulta.';

create index if not exists contas_profissional_idx on public.contas (profissional_id);
create index if not exists contas_convenio_data_idx on public.contas (convenio_id, data_atendimento);
create index if not exists contas_lote_idx on public.contas (lote_id);
create index if not exists conta_itens_conta_idx on public.conta_itens (conta_id);
create index if not exists conta_itens_data_idx on public.conta_itens (data_execucao);
create index if not exists conta_itens_profissional_idx on public.conta_itens (profissional_id);
create index if not exists contas_ativas_idx on public.contas (status) where not arquivada;

-- Número da guia no prestador: pula números que já existem (os do Micrologos foram mantidos)
create or replace function interno.proximo_numero_guia()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v text;
begin
  loop
    v := lpad(nextval('public.guia_prestador_seq')::text, 8, '0');
    exit when not exists (select 1 from public.contas where numero_guia_prestador = v);
  end loop;
  return v;
end $$;
revoke execute on function interno.proximo_numero_guia() from public, anon;
grant execute on function interno.proximo_numero_guia() to authenticated;
alter table public.contas alter column numero_guia_prestador set default interno.proximo_numero_guia();

-- Trava das contas arquivadas
create or replace function interno.tg_conta_arquivada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.migracao', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.arquivada then raise exception 'Conta arquivada (histórico do Micrologos) não pode ser apagada.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    new.arquivada := false;  -- só a migração cria conta arquivada
    return new;
  end if;
  if old.arquivada then
    if new.arquivada then
      if (to_jsonb(new) - 'atualizado_em') <> (to_jsonb(old) - 'atualizado_em') then
        raise exception 'Conta arquivada (histórico do Micrologos): desarquive antes de alterar.';
      end if;
    elsif not interno.tem_funcao('admin', 'faturamento') then
      raise exception 'Só o faturamento ou a administração podem desarquivar uma conta.';
    end if;
  elsif new.arquivada then
    raise exception 'Conta não pode ser arquivada de novo pelo sistema.';
  end if;
  return new;
end $$;
revoke execute on function interno.tg_conta_arquivada() from public, anon, authenticated;
drop trigger if exists arquivada on public.contas;
create trigger arquivada before insert or update or delete on public.contas
  for each row execute function interno.tg_conta_arquivada();

create or replace function interno.tg_item_arquivado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.migracao', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if exists (select 1 from public.contas c
             where c.id in (case when tg_op = 'INSERT' then null else old.conta_id end,
                            case when tg_op = 'DELETE' then null else new.conta_id end)
               and c.arquivada) then
    raise exception 'Conta arquivada (histórico do Micrologos): desarquive antes de alterar os itens.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function interno.tg_item_arquivado() from public, anon, authenticated;
drop trigger if exists arquivado on public.conta_itens;
create trigger arquivado before insert or update or delete on public.conta_itens
  for each row execute function interno.tg_item_arquivado();

create or replace function interno.tg_lote_arquivado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.migracao', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then new.arquivado := false; return new; end if;
  if old.arquivado and (tg_op = 'DELETE' or (new.arquivado and (to_jsonb(new) - 'atualizado_em') <> (to_jsonb(old) - 'atualizado_em'))) then
    raise exception 'Cobrança arquivada (histórico do Micrologos): desarquive antes de alterar.';
  end if;
  if tg_op = 'UPDATE' and old.arquivado and not new.arquivado and not interno.tem_funcao('admin', 'faturamento') then
    raise exception 'Só o faturamento ou a administração podem desarquivar uma cobrança.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function interno.tg_lote_arquivado() from public, anon, authenticated;
drop trigger if exists arquivado on public.lotes;
create trigger arquivado before insert or update or delete on public.lotes
  for each row execute function interno.tg_lote_arquivado();
