-- =====================================================================
-- 0007 — Pedido de exame pode mudar de situação depois do atendimento finalizado
-- =====================================================================
-- A situação do pedido (solicitado → agendado → realizado) é administrativa.
-- A trava continua impedindo mudar o CONTEÚDO do pedido (exame, olho,
-- justificativa…) depois que o atendimento foi finalizado.
-- =====================================================================
create or replace function interno.tg_bloquear_se_finalizado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_linhas jsonb[];
  v_linha  jsonb;
  v_atend  uuid;
begin
  -- Só a situação do pedido de exame mudou? Liberado.
  if tg_op = 'UPDATE' and tg_table_name = 'solicitacoes_exames'
     and (to_jsonb(new) - 'status' - 'atualizado_em') = (to_jsonb(old) - 'status' - 'atualizado_em') then
    return new;
  end if;

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

create or replace function interno.tg_exame_atualiza_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.solicitacao_id is not null and new.status in ('aguardando_laudo', 'laudado') then
    update public.solicitacoes_exames set status = 'realizado'
    where id = new.solicitacao_id and status <> 'realizado';
  end if;
  return null;
end $$;

-- Corrige pedidos de exames que já foram feitos
update public.solicitacoes_exames s set status = 'realizado'
where s.status <> 'realizado'
  and exists (select 1 from public.exames_realizados e
              where e.solicitacao_id = s.id and e.status in ('aguardando_laudo', 'laudado'));
