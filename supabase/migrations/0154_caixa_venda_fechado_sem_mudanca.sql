-- 0154 — Correção da 0153 (25/11/2026): devolver/reenviar/lançar uma venda cujo lançamento ficou num caixa JÁ FECHADO
-- dava erro mesmo sem mudar nada de dinheiro (caso: venda nº 3, no cartão, registrada antes da regra "caixa só dinheiro").
-- Agora o caixa fechado só bloqueia quando muda a forma, o valor ou a venda é cancelada.
create or replace function interno.tg_orientacao_venda_caixa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_caixa uuid; v_at uuid; v_at_caixa uuid; v_cx_status text; v_cx_data date;
  v_nome text := (select p.nome from public.pacientes p where p.id = new.paciente_id);
  v_desc text := case new.tipo when 'lente' then 'Lente: ' else 'Cirurgia: ' end || new.procedimento || ' (venda nº ' || new.numero || ')';
  v_quer boolean := new.forma_pagamento = 'dinheiro' and new.status <> 'cancelada';   -- deve estar no caixa?
  v_motivo text;
  -- mudou algo de dinheiro? (forma, valor ou cancelamento) — só isso exige mexer num caixa fechado
  v_mudou boolean := tg_op = 'UPDATE' and (new.forma_pagamento <> old.forma_pagamento or new.valor_total <> old.valor_total
                                            or (new.status = 'cancelada' and old.status <> 'cancelada'));
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
    if v_cx_status <> 'aberto' and not v_mudou then
      -- lançamento antigo num caixa já fechado (ex.: venda no cartão de antes da 0153) e nada de dinheiro mudou agora:
      -- deixa como está e não impede devolver/reenviar/lançar a venda
      perform set_config('app.venda_caixa', '', true);
      return null;
    end if;
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
