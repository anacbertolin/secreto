-- =====================================================================
-- 0182 — Função de carga do Micrologos pela API (sessão "Dados para migração", 26/11/2026)
-- A carga roda fora do Supabase (ensaio local já transformado) e grava pela API REST com a chave secreta
-- "migracao_claude" (segredo de rede do ambiente do Claude; a dona salvou, o Claude não vê o valor).
-- public.carga_micrologos(tabela, linhas jsonb, simular):
--   - só a chave secreta (papel service_role) pode chamar; anon/authenticated não;
--   - liga app.migracao = 'on' só nesta transação (gatilhos de auditoria, conta automática etc. não disparam);
--   - insere as linhas com "on conflict do nothing" (repetir a carga não duplica);
--   - simular = true: grava e desfaz na hora (teste sem deixar nada no banco), devolvendo quantas linhas entrariam.
-- Os gatilhos de preço/trava/totais dos itens passam a respeitar app.migracao (os itens antigos entram como estão).
-- =====================================================================

-- gatilhos dos itens: não recalculam nem travam durante a carga
drop trigger if exists preco on public.conta_itens;
create trigger preco before insert on public.conta_itens for each row
  when (current_setting('app.migracao', true) is distinct from 'on')
  execute function interno.tg_item_preco();
drop trigger if exists trava on public.conta_itens;
create trigger trava before insert or delete or update on public.conta_itens for each row
  when (current_setting('app.migracao', true) is distinct from 'on')
  execute function interno.tg_item_trava();
drop trigger if exists totais on public.conta_itens;
create trigger totais after insert or delete or update on public.conta_itens for each row
  when (current_setting('app.migracao', true) is distinct from 'on')
  execute function interno.tg_conta_totais();

create or replace function public.carga_micrologos(p_tabela text, p_linhas jsonb, p_simular boolean default false)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_schema text := split_part(p_tabela, '.', 1);
  v_nome   text := split_part(p_tabela, '.', 2);
  v_cols   text;
  v_n      integer := 0;
begin
  if v_schema not in ('public', 'legacy_micrologos') or v_nome = '' then
    raise exception 'Tabela inválida: %', p_tabela;
  end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    return 0;
  end if;
  -- colunas: as que vieram no primeiro registro e existem na tabela (sem colunas calculadas)
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into v_cols
  from information_schema.columns c
  where c.table_schema = v_schema and c.table_name = v_nome and c.is_generated = 'NEVER'
    and (p_linhas -> 0) ? c.column_name;
  if v_cols is null then
    raise exception 'Tabela % não encontrada ou sem colunas em comum', p_tabela;
  end if;
  perform set_config('app.migracao', 'on', true);
  begin
    execute format(
      'insert into %I.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::%I.%I, $1) on conflict do nothing',
      v_schema, v_nome, v_cols, v_cols, v_schema, v_nome) using p_linhas;
    get diagnostics v_n = row_count;
    if p_simular then
      raise exception using errcode = 'P0001', message = 'SIMULADO:' || v_n;
    end if;
  exception when sqlstate 'P0001' then
    if sqlerrm like 'SIMULADO:%' then
      return split_part(sqlerrm, ':', 2)::integer;  -- o bloco foi desfeito: nada ficou gravado
    end if;
    raise;
  end;
  return v_n;
end $$;
revoke execute on function public.carga_micrologos(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.carga_micrologos(text, jsonb, boolean) to service_role;
comment on function public.carga_micrologos(text, jsonb, boolean) is
  'Carga do Micrologos (só a chave secreta). Insere linhas com app.migracao ligado; simular = grava e desfaz.';
