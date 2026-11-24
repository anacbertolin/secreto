-- =====================================================================
-- 0098 — Caixa da Orientação Cirúrgica, SEPARADO do caixa da recepção (pedido do Dr. Gelson, 24/11/2026)
-- =====================================================================
-- "O dinheiro que a Alessandra recebe (cirurgias, lentes, tudo) também entra no caixa, mas num caixa separado da
--  recepção. No final o caixa é o total da clínica, mas entra dinheiro por 2 lugares e não pode misturar."
--
-- Como fica:
--  * caixas.setor = 'recepcao' (tudo o que já existia) ou 'orientacao'. Pode haver UM caixa aberto POR SETOR.
--  * O caminho é o mesmo (aberto → fechado → conferido → aprovado), com as mesmas pessoas que conferem/aprovam.
--  * Quem atende a Orientação (marcação orientacao_cirurgica) abre, lança e fecha SÓ o caixa da orientação e não vê o
--    da recepção. A recepção não vê o da orientação. Faturamento, administração e quem confere/aprova veem os dois.
--  * Um pagamento não pode cair no caixa do outro setor (saldo de um setor só se recebe no próprio setor).
--  * Cada VENDA registrada pela Orientação (0097) entra sozinha no caixa da orientação que estiver aberto
--    (atendimento + pagamento). Sem caixa aberto, a venda não é registrada (aviso para abrir o caixa).
--    Correção de valor/forma (depois de devolvida) ou cancelamento da venda acompanham no caixa enquanto ele está
--    aberto; se o caixa daquele dia já foi fechado, é preciso devolver o caixa para correção antes.
--    Os lançamentos que vieram de uma venda só mudam pela tela de vendas (não pela tela do caixa).
-- =====================================================================

-- ---------- setor do caixa ----------
alter table public.caixas
  add column setor text not null default 'recepcao' check (setor in ('recepcao', 'orientacao'));
comment on column public.caixas.setor is 'recepcao (caixa da recepção) ou orientacao (caixa da Orientação Cirúrgica). Não se misturam.';
drop index public.caixas_um_aberto;
create unique index caixas_um_aberto_por_setor on public.caixas (setor) where status = 'aberto';
create index caixas_setor_data_idx on public.caixas (setor, data desc);

-- ---------- ligação com a venda da orientação ----------
alter table public.caixa_atendimentos add column venda_id uuid references public.orientacao_vendas(id);
create unique index caixa_atend_venda_idx on public.caixa_atendimentos (venda_id) where venda_id is not null;
comment on column public.caixa_atendimentos.venda_id is 'Venda da Orientação Cirúrgica que gerou este lançamento (muda só pela tela de vendas).';

-- ---------- quem pode o quê, por setor ----------
create or replace function interno.caixa_pode(p text, p_setor text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_setor = 'orientacao' then case p
      when 'lancar'   then interno.atende_orientacao() or interno.tem_funcao('admin', 'faturamento')
      when 'ver'      then interno.atende_orientacao() or interno.tem_funcao('admin', 'faturamento')
                           or interno.caixa_papel('conferir') or interno.caixa_papel('aprovar')
      else interno.caixa_papel(p) end
    when p_setor = 'recepcao' then interno.caixa_papel(p)
    else false end
$$;
create or replace function interno.caixa_pode_caixa(p text, p_caixa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select interno.caixa_pode(p, c.setor) from public.caixas c where c.id = p_caixa), false)
$$;
revoke execute on function interno.caixa_pode(text, text), interno.caixa_pode_caixa(text, uuid) from public, anon;
grant execute on function interno.caixa_pode(text, text), interno.caixa_pode_caixa(text, uuid) to authenticated, service_role;

-- ---------- RLS por setor ----------
drop policy le on public.caixas;
create policy le on public.caixas for select to authenticated using (interno.caixa_pode('ver', setor));

do $$
declare t text;
begin
  foreach t in array array['caixa_atendimentos', 'caixa_pagamentos', 'caixa_saidas'] loop
    execute format('drop policy le on public.%I', t);
    execute format('drop policy inclui on public.%I', t);
    execute format('drop policy altera on public.%I', t);
    execute format('create policy le on public.%I for select to authenticated using (interno.caixa_pode_caixa(''ver'', caixa_id))', t);
    execute format('create policy inclui on public.%I for insert to authenticated with check (interno.caixa_pode_caixa(''lancar'', caixa_id))', t);
    execute format('create policy altera on public.%I for update to authenticated using (interno.caixa_pode_caixa(''lancar'', caixa_id)) with check (interno.caixa_pode_caixa(''lancar'', caixa_id))', t);
  end loop;
end $$;

-- ---------- não misturar setores; lançamento de venda só muda pela venda ----------
create or replace function interno.tg_caixa_setor_venda()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_venda uuid;
begin
  if tg_table_name = 'caixa_pagamentos' then
    if tg_op = 'INSERT' and (select c.setor from public.caixas c where c.id = new.caixa_id)
       is distinct from (select c.setor from public.caixa_atendimentos a join public.caixas c on c.id = a.caixa_id where a.id = new.atendimento_id) then
      raise exception 'Este atendimento é do caixa do outro setor: receba no caixa em que ele foi lançado (recepção e orientação não se misturam).';
    end if;
    select a.venda_id into v_venda from public.caixa_atendimentos a where a.id = new.atendimento_id;
  else
    v_venda := new.venda_id;
    if tg_op = 'UPDATE' and new.venda_id is distinct from old.venda_id then
      raise exception 'Não é permitido mudar a venda ligada a um lançamento do caixa.';
    end if;
  end if;
  if v_venda is not null and coalesce(current_setting('app.venda_caixa', true), '') <> 'on' then
    raise exception 'Este lançamento veio de uma venda da Orientação Cirúrgica: corrija ou cancele pela tela "Vendas da orientação".';
  end if;
  return new;
end $$;
create trigger setor_venda before insert or update on public.caixa_atendimentos for each row execute function interno.tg_caixa_setor_venda();
create trigger setor_venda before insert or update on public.caixa_pagamentos  for each row execute function interno.tg_caixa_setor_venda();
revoke execute on function interno.tg_caixa_setor_venda() from public, anon, authenticated;

-- ---------- ações do caixa, agora por setor ----------
drop function public.caixa_abrir(numeric);
create function public.caixa_abrir(p_fundo numeric, p_setor text default 'recepcao')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_setor is null or p_setor not in ('recepcao', 'orientacao') then raise exception 'Setor do caixa inválido.'; end if;
  if not interno.caixa_pode('lancar', p_setor) then
    raise exception 'Você não pode abrir o caixa %.', case p_setor when 'orientacao' then 'da Orientação Cirúrgica' else 'da recepção' end;
  end if;
  if exists (select 1 from public.caixas where status = 'aberto' and setor = p_setor) then
    raise exception 'Já existe um caixa % aberto. Feche-o antes de abrir outro.', case p_setor when 'orientacao' then 'da Orientação Cirúrgica' else 'da recepção' end;
  end if;
  insert into public.caixas (fundo_troco, aberto_por, setor) values (coalesce(p_fundo, 0), interno.profissional_atual(), p_setor)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.caixa_esperado_dinheiro(p_caixa uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select c.fundo_troco
       + coalesce((select sum(p.valor) from public.caixa_pagamentos p where p.caixa_id = c.id and p.forma = 'dinheiro' and not p.cancelado), 0)
       - coalesce((select sum(s.valor) from public.caixa_saidas s where s.caixa_id = c.id and not s.cancelado), 0)
  from public.caixas c where c.id = p_caixa and interno.caixa_pode('ver', c.setor)
$$;

create or replace function public.caixa_fechar(p_caixa uuid, p_contado numeric, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_esp numeric;
begin
  if not interno.caixa_pode_caixa('lancar', p_caixa) then raise exception 'Você não pode fechar este caixa.'; end if;
  if p_contado is null or p_contado < 0 then raise exception 'Informe quanto dinheiro foi contado na gaveta.'; end if;
  perform 1 from public.caixas where id = p_caixa and status = 'aberto' for update;
  if not found then raise exception 'Este caixa não está aberto.'; end if;
  v_esp := public.caixa_esperado_dinheiro(p_caixa);
  update public.caixas set
    status = 'fechado', fechado_por = interno.profissional_atual(), fechado_em = now(),
    esperado_dinheiro = v_esp, contado_dinheiro = p_contado, diferenca_dinheiro = p_contado - v_esp,
    obs_fechamento = nullif(trim(coalesce(p_obs, '')), '')
  where id = p_caixa;
end $$;

create or replace function public.caixa_devolver(p_caixa uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text; v_setor text;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escreva o motivo da devolução.'; end if;
  select status, setor into v_status, v_setor from public.caixas where id = p_caixa for update;
  if v_status = 'fechado' and not interno.caixa_papel('conferir') then raise exception 'Só quem confere pode devolver o caixa.'; end if;
  if v_status = 'conferido' and not interno.caixa_papel('aprovar') then raise exception 'Só quem aprova pode devolver um caixa conferido.'; end if;
  if v_status is null or v_status not in ('fechado', 'conferido') then raise exception 'Só dá para devolver um caixa fechado ou conferido.'; end if;
  if exists (select 1 from public.caixas where status = 'aberto' and setor = v_setor) then
    raise exception 'Há outro caixa deste setor aberto agora. Feche-o antes de devolver este para correção.';
  end if;
  update public.caixas set status = 'aberto',
    fechado_por = null, fechado_em = null, esperado_dinheiro = null, contado_dinheiro = null, diferenca_dinheiro = null,
    conferido_por = null, conferido_em = null,
    devolvido_por = interno.profissional_atual(), devolvido_em = now(), motivo_devolucao = trim(p_motivo)
  where id = p_caixa;
end $$;

revoke execute on function public.caixa_abrir(numeric, text) from public, anon;
grant execute on function public.caixa_abrir(numeric, text) to authenticated;

-- ---------- a venda da orientação entra sozinha no caixa da orientação ----------
create or replace function interno.tg_orientacao_venda_caixa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_caixa uuid; v_at uuid; v_cx_status text; v_cx_data date;
  v_forma text := case new.forma_pagamento
                    when 'credito' then case when new.parcelas >= 2 then 'credito_parcelado' else 'credito_vista' end
                    else new.forma_pagamento end;
  v_nome text := (select p.nome from public.pacientes p where p.id = new.paciente_id);
  v_desc text := case new.tipo when 'lente' then 'Lente: ' else 'Cirurgia: ' end || new.procedimento || ' (venda nº ' || new.numero || ')';
  v_dinheiro boolean;
begin
  perform set_config('app.venda_caixa', 'on', true);
  if tg_op = 'INSERT' then
    select c.id into v_caixa from public.caixas c where c.setor = 'orientacao' and c.status = 'aberto';
    if not found then
      raise exception 'O caixa da Orientação Cirúrgica está fechado. Abra o caixa (menu Caixa) antes de registrar a venda.';
    end if;
    insert into public.caixa_atendimentos (caixa_id, paciente_nome, paciente_id, medico_id, descricao, valor, venda_id)
    values (v_caixa, coalesce(v_nome, 'Paciente'), new.paciente_id, new.profissional_id, v_desc, new.valor_total, new.id)
    returning id into v_at;
    insert into public.caixa_pagamentos (caixa_id, atendimento_id, forma, parcelas, valor)
    values (v_caixa, v_at, v_forma, case when v_forma = 'credito_parcelado' then new.parcelas else 1 end, new.valor_total);
  else
    select a.id, c.status, c.data into v_at, v_cx_status, v_cx_data
    from public.caixa_atendimentos a join public.caixas c on c.id = a.caixa_id where a.venda_id = new.id;
    if found then  -- vendas de antes do caixa da orientação não têm lançamento
      v_dinheiro := (new.valor_total, new.forma_pagamento, new.parcelas) is distinct from (old.valor_total, old.forma_pagamento, old.parcelas)
                    or (new.status = 'cancelada' and old.status <> 'cancelada');
      if v_cx_status <> 'aberto' then
        if v_dinheiro then
          raise exception 'O caixa da Orientação Cirúrgica de % já foi fechado. Para mudar o valor, a forma de pagamento ou cancelar esta venda, peça para devolverem esse caixa para correção.',
            to_char(v_cx_data, 'DD/MM/YYYY');
        end if;
      elsif new.status = 'cancelada' and old.status <> 'cancelada' then
        update public.caixa_pagamentos set cancelado = true, motivo_cancelamento = 'Venda nº ' || new.numero || ' cancelada: ' || new.motivo
         where atendimento_id = v_at and not cancelado;
        update public.caixa_atendimentos set cancelado = true, motivo_cancelamento = 'Venda nº ' || new.numero || ' cancelada: ' || new.motivo
         where id = v_at;
      else
        if v_dinheiro then
          update public.caixa_pagamentos set cancelado = true, motivo_cancelamento = 'Venda nº ' || new.numero || ' corrigida'
           where atendimento_id = v_at and not cancelado;
        end if;
        update public.caixa_atendimentos set paciente_nome = coalesce(v_nome, paciente_nome), paciente_id = new.paciente_id,
               medico_id = new.profissional_id, descricao = v_desc, valor = new.valor_total
         where id = v_at
           and (paciente_id, medico_id, descricao, valor) is distinct from (new.paciente_id, new.profissional_id, v_desc, new.valor_total);
        if v_dinheiro then
          insert into public.caixa_pagamentos (caixa_id, atendimento_id, forma, parcelas, valor)
          select a.caixa_id, a.id, v_forma, case when v_forma = 'credito_parcelado' then new.parcelas else 1 end, new.valor_total
          from public.caixa_atendimentos a where a.id = v_at;
        end if;
      end if;
    end if;
  end if;
  perform set_config('app.venda_caixa', '', true);
  return null;
end $$;
create trigger caixa after insert or update on public.orientacao_vendas
  for each row execute function interno.tg_orientacao_venda_caixa();
revoke execute on function interno.tg_orientacao_venda_caixa() from public, anon, authenticated;
