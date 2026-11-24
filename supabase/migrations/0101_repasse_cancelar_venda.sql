-- =====================================================================
-- 0101 — Cancelar um repasse que veio de uma venda da Orientação Cirúrgica (pedido do Dr. Gelson, 24/11/2026)
-- =====================================================================
-- Antes: venda "lançada" não mudava mais; se o Luciano cancelasse o repasse, a venda e o caixa ficavam desencontrados.
-- Agora o cancelamento do repasse leva a venda junto, de um dos dois jeitos (escolha do Luciano na tela):
--   * "só corrigir o repasse": a venda VOLTA para "aguardando conferência" (o dinheiro continua no caixa) e ele lança de novo;
--   * "o paciente desistiu": a venda é CANCELADA e o valor sai do caixa da Orientação (gatilho da 0098).
-- Continua bloqueado se já houver parcela paga ao médico ou custo pago (regra da 0070) e, para tirar do caixa,
-- se o caixa daquele dia já estiver fechado (precisa devolver o caixa antes — regra da 0098).
-- Qualquer cancelamento de repasse com venda (mesmo sem a função) devolve a venda para conferência.
-- =====================================================================

create or replace function interno.tg_orientacao_venda_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_fat boolean := interno.tem_funcao('faturamento', 'admin');
begin
  if new.forma_pagamento <> 'credito' then new.parcelas := 1; end if;
  if not exists (select 1 from public.profissionais where id = new.profissional_id and funcao = 'medico') then
    raise exception 'Escolha o médico.';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'aguardando'; new.motivo := null; new.repasse_id := null; new.conferido_por := null; new.conferido_em := null;
    return new;
  end if;
  if old.status = 'lancada' and coalesce(current_setting('app.venda_lancando', true), '') = 'on' then
    -- cancelamento do repasse (função repasse_cancelar, migração 0101): a venda volta para conferência ou é cancelada
    new.criado_por := old.criado_por; new.criado_em := old.criado_em;
    return new;
  end if;
  if old.status in ('lancada', 'cancelada') then
    -- lançamento feito pela função repasse_lancar (aguardando → lançada) já passou; depois disso não muda
    raise exception 'Esta venda já foi % e não pode mudar.', case old.status when 'lancada' then 'lançada no repasse' else 'cancelada' end;
  end if;
  if (new.status = 'lancada' or new.repasse_id is not null) and coalesce(current_setting('app.venda_lancando', true), '') <> 'on' then
    raise exception 'A venda só fica "lançada" pelo lançamento do repasse.';
  end if;
  if new.status = 'devolvida' and old.status <> 'devolvida' then
    if not v_fat then raise exception 'Só o faturamento devolve uma venda.'; end if;
    if coalesce(trim(new.motivo), '') = '' then raise exception 'Informe o motivo da devolução.'; end if;
  end if;
  if new.status = 'cancelada' and coalesce(trim(new.motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  -- o faturamento não altera os dados da venda (só devolve ou lança); quem registrou corrige
  if v_fat and not interno.atende_orientacao() and not interno.tem_funcao('admin') and
     (new.paciente_id, new.profissional_id, new.procedimento_id, new.procedimento, new.lente_id, new.valor_total,
      new.forma_pagamento, new.parcelas, new.data_pagamento, new.data_cirurgia, new.tipo)
     is distinct from
     (old.paciente_id, old.profissional_id, old.procedimento_id, old.procedimento, old.lente_id, old.valor_total,
      old.forma_pagamento, old.parcelas, old.data_pagamento, old.data_cirurgia, old.tipo) then
    raise exception 'Os dados da venda são corrigidos por quem a registrou. Devolva com o motivo.';
  end if;
  new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  return new;
end $$;

create or replace function interno.tg_repasse_cancela_venda()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    perform set_config('app.venda_lancando', 'on', true);
    if coalesce(current_setting('app.repasse_venda_acao', true), '') = 'cancelar' then
      update public.orientacao_vendas
         set status = 'cancelada', motivo = 'Repasse nº ' || new.numero || ' cancelado: ' || new.motivo_cancelamento
       where repasse_id = new.id and status = 'lancada';
    else
      update public.orientacao_vendas
         set status = 'aguardando', repasse_id = null, conferido_por = null, conferido_em = null,
             motivo = 'Repasse nº ' || new.numero || ' cancelado para correção: ' || new.motivo_cancelamento
       where repasse_id = new.id and status = 'lancada';
    end if;
    perform set_config('app.venda_lancando', '', true);
  end if;
  return null;
end $$;
create trigger cancela_venda after update of status on public.repasses
  for each row execute function interno.tg_repasse_cancela_venda();
revoke execute on function interno.tg_repasse_cancela_venda() from public, anon, authenticated;

create or replace function public.repasse_cancelar(p_repasse uuid, p_motivo text, p_cancelar_venda boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not interno.tem_funcao('faturamento', 'admin') then
    raise exception 'Você não tem permissão para cancelar repasses.';
  end if;
  perform set_config('app.repasse_venda_acao', case when p_cancelar_venda then 'cancelar' else '' end, true);
  update public.repasses set status = 'cancelado', motivo_cancelamento = nullif(trim(coalesce(p_motivo, '')), '')
   where id = p_repasse and status <> 'cancelado';
  if not found then raise exception 'Este repasse não existe ou já foi cancelado.'; end if;
  perform set_config('app.repasse_venda_acao', '', true);
end $$;
revoke execute on function public.repasse_cancelar(uuid, text, boolean) from public, anon;
grant execute on function public.repasse_cancelar(uuid, text, boolean) to authenticated;
