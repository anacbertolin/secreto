-- 0084 — Excluir agendamento lançado por engano (pedido da dona, 23/11/2026).
-- "Cancelar" mantém o paciente riscado na agenda; quando foi erro de digitação ou o paciente desistiu antes de
-- vir, toda a equipe (inclusive faturamento) pode EXCLUIR. Travas: não exclui se já houve atendimento, exame,
-- cirurgia ou se a conta já foi para lote/recebimento. Fica registrado na auditoria (quem, quando e o motivo).
create or replace function public.agendamento_excluir(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_status public.status_agendamento;
begin
  if not interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento') then
    raise exception 'Você não tem permissão para excluir agendamentos.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escreva o motivo da exclusão.';
  end if;

  select status into v_status from public.agendamentos where id = p_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_status::text in ('chegou', 'em_atendimento', 'atendido') then
    raise exception 'O paciente já chegou ou foi atendido: não dá para excluir. Desfaça a chegada ou use "Cancelar".';
  end if;
  if exists (select 1 from public.atendimentos where agendamento_id = p_id)
     or exists (select 1 from public.exames_realizados where agendamento_id = p_id)
     or exists (select 1 from public.cirurgias where agendamento_id = p_id) then
    raise exception 'Este agendamento já tem atendimento, exame ou cirurgia ligado: use "Cancelar".';
  end if;
  if exists (select 1 from public.contas c where c.agendamento_id = p_id
             and (c.lote_id is not null or c.status::text not in ('aberta', 'cancelada')
                  or exists (select 1 from public.repasses r where r.conta_id = c.id))) then
    raise exception 'A conta deste agendamento já entrou no faturamento (lote, recebimento ou repasse): use "Cancelar".';
  end if;

  -- conta aberta/cancelada criada automaticamente: sai junto
  delete from public.conta_itens where conta_id in (select id from public.contas where agendamento_id = p_id);
  delete from public.contas where agendamento_id = p_id;
  -- WhatsApp: mantém as mensagens, só solta o vínculo
  update public.whatsapp_mensagens set agendamento_id = null where agendamento_id = p_id;
  update public.whatsapp_pedidos_agendamento set agendamento_id = null where agendamento_id = p_id;
  update public.whatsapp_pedidos_agendamento set agendamento_existente = null where agendamento_existente = p_id;

  -- registra o motivo na auditoria antes de apagar
  update public.agendamentos set motivo_cancelamento = 'EXCLUÍDO: ' || trim(p_motivo) where id = p_id;
  delete from public.agendamentos where id = p_id;
end $$;

revoke execute on function public.agendamento_excluir(uuid, text) from public, anon;
grant execute on function public.agendamento_excluir(uuid, text) to authenticated;
