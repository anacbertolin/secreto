-- =====================================================================
-- 0153 — Caixa é só para DINHEIRO em espécie (decisão do Dr. Gelson, 25/11/2026)
-- =====================================================================
-- Muda a 0098: a venda da Orientação Cirúrgica só entra no caixa da Orientação quando a forma de pagamento é
-- DINHEIRO. Cartão (crédito/débito) e PIX não entram no caixa (ficam na venda e no repasse).
-- Correção da venda (devolvida → corrigida) acompanha: mudou para dinheiro → entra; deixou de ser dinheiro ou foi
-- cancelada → sai (cancelado com motivo). Se o caixa daquele dia já foi fechado, é preciso devolvê-lo antes.
-- Só é preciso ter o caixa da Orientação aberto para registrar venda em DINHEIRO.
-- O índice de venda passa a valer só para lançamento não cancelado (a venda pode sair e voltar ao caixa).
-- =====================================================================

drop index public.caixa_atend_venda_idx;
create unique index caixa_atend_venda_idx on public.caixa_atendimentos (venda_id) where venda_id is not null and not cancelado;

create or replace function interno.tg_orientacao_venda_caixa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_caixa uuid; v_at uuid; v_at_caixa uuid; v_cx_status text; v_cx_data date;
  v_nome text := (select p.nome from public.pacientes p where p.id = new.paciente_id);
  v_desc text := case new.tipo when 'lente' then 'Lente: ' else 'Cirurgia: ' end || new.procedimento || ' (venda nº ' || new.numero || ')';
  v_quer boolean := new.forma_pagamento = 'dinheiro' and new.status <> 'cancelada';   -- deve estar no caixa?
  v_motivo text;
begin
  perform set_config('app.venda_caixa', 'on', true);
  select a.id, a.caixa_id, c.status, c.data into v_at, v_at_caixa, v_cx_status, v_cx_data
  from public.caixa_atendimentos a join public.caixas c on c.id = a.caixa_id
  where a.venda_id = new.id and not a.cancelado;

  if v_at is null then
    -- ainda não está no caixa: entra se for dinheiro (venda nova, ou corrigida para dinheiro)
    if v_quer and (tg_op = 'INSERT' or old.forma_pagamento <> 'dinheiro' or old.status = 'cancelada') then
      select c.id into v_caixa from public.caixas c where c.setor = 'orientacao' and c.status = 'aberto';
      if not found then
        raise exception 'Pagamento em dinheiro: abra o caixa da Orientação Cirúrgica (menu Caixa) antes de registrar a venda.';
      end if;
      insert into public.caixa_atendimentos (caixa_id, paciente_nome, paciente_id, medico_id, descricao, valor, venda_id)
      values (v_caixa, coalesce(v_nome, 'Paciente'), new.paciente_id, new.profissional_id, v_desc, new.valor_total, new.id)
      returning id into v_at;
      insert into public.caixa_pagamentos (caixa_id, atendimento_id, forma, parcelas, valor)
      values (v_caixa, v_at, 'dinheiro', 1, new.valor_total);
    end if;
  elsif not v_quer or new.valor_total <> old.valor_total then
    -- está no caixa e precisa sair (não é mais dinheiro / cancelada) ou mudar o valor
    if v_cx_status <> 'aberto' then
      raise exception 'O caixa da Orientação Cirúrgica de % já foi fechado. Para mudar o valor, a forma de pagamento ou cancelar esta venda, peça para devolverem esse caixa para correção.',
        to_char(v_cx_data, 'DD/MM/YYYY');
    end if;
    v_motivo := case when new.status = 'cancelada' then 'Venda nº ' || new.numero || ' cancelada: ' || coalesce(new.motivo, '')
                     when not v_quer then 'Venda nº ' || new.numero || ' mudou para ' || new.forma_pagamento || ' (caixa é só dinheiro)'
                     else 'Venda nº ' || new.numero || ' corrigida' end;
    update public.caixa_pagamentos set cancelado = true, motivo_cancelamento = v_motivo where atendimento_id = v_at and not cancelado;
    if not v_quer then
      update public.caixa_atendimentos set cancelado = true, motivo_cancelamento = v_motivo where id = v_at;
    else
      update public.caixa_atendimentos set paciente_nome = coalesce(v_nome, paciente_nome), paciente_id = new.paciente_id,
             medico_id = new.profissional_id, descricao = v_desc, valor = new.valor_total where id = v_at;
      insert into public.caixa_pagamentos (caixa_id, atendimento_id, forma, parcelas, valor)
      values (v_at_caixa, v_at, 'dinheiro', 1, new.valor_total);
    end if;
  elsif v_cx_status = 'aberto' then
    -- só dados descritivos (paciente, médico, procedimento)
    update public.caixa_atendimentos set paciente_nome = coalesce(v_nome, paciente_nome), paciente_id = new.paciente_id,
           medico_id = new.profissional_id, descricao = v_desc
     where id = v_at and (paciente_id, medico_id, descricao) is distinct from (new.paciente_id, new.profissional_id, v_desc);
  end if;
  perform set_config('app.venda_caixa', '', true);
  return null;
end $$;
revoke execute on function interno.tg_orientacao_venda_caixa() from public, anon, authenticated;

-- vendas já registradas no cartão/PIX saem do caixa (caixa aberto)
do $$
declare r record;
begin
  perform set_config('app.venda_caixa', 'on', true);
  for r in select a.id, v.numero from public.caixa_atendimentos a
           join public.orientacao_vendas v on v.id = a.venda_id
           join public.caixas c on c.id = a.caixa_id
           where not a.cancelado and v.forma_pagamento <> 'dinheiro' and c.status = 'aberto' loop
    update public.caixa_pagamentos set cancelado = true, motivo_cancelamento = 'Venda nº ' || r.numero || ' não é em dinheiro (caixa é só dinheiro — Dr. Gelson, 25/11)'
     where atendimento_id = r.id and not cancelado;
    update public.caixa_atendimentos set cancelado = true, motivo_cancelamento = 'Venda nº ' || r.numero || ' não é em dinheiro (caixa é só dinheiro — Dr. Gelson, 25/11)'
     where id = r.id;
  end loop;
  perform set_config('app.venda_caixa', '', true);
end $$;
