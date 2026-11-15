-- =====================================================================
-- 0015 — WhatsApp: conversa arquivada que recebe mensagem nova volta SEM
-- responsável (combinado com a sessão da tela). Fora isso, a conversa
-- continua com quem a assumiu. Só redefine public.whatsapp_receber.
-- =====================================================================

create or replace function public.whatsapp_receber(
  p_telefone text, p_nome text, p_wa_id text, p_tipo text, p_texto text,
  p_midia_id text default null, p_midia_tipo text default null, p_midia_nome text default null,
  p_em_resposta_a text default null, p_quando timestamptz default now(), p_botao text default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_conversa uuid;
  v_msg      uuid;
  v_paciente uuid;
  v_ag       uuid;
  v_acao     text;
  v_resultado text := null;
begin
  v_conversa := public.whatsapp_conversa(p_telefone, p_nome);

  insert into public.whatsapp_mensagens
    (conversa_id, direcao, wa_id, tipo, texto, midia_id, midia_tipo, midia_nome, situacao, em_resposta_a, quando)
  values
    (v_conversa, 'recebida', p_wa_id, p_tipo, p_texto, p_midia_id, p_midia_tipo, p_midia_nome, 'recebida',
     p_em_resposta_a, coalesce(p_quando, now()))
  on conflict (wa_id) do nothing
  returning id into v_msg;

  if v_msg is null then
    return jsonb_build_object('duplicada', true);   -- a Meta reenviou: nada a fazer
  end if;

  update public.whatsapp_conversas
     set ultima_mensagem_em = greatest(coalesce(ultima_mensagem_em, p_quando), p_quando),
         ultima_recebida_em = greatest(coalesce(ultima_recebida_em, p_quando), p_quando),
         nao_lidas = nao_lidas + 1,
         -- conversa arquivada que volta: ninguém está mais cuidando dela
         responsavel_id = case when arquivada then null else responsavel_id end,
         arquivada = false
   where id = v_conversa
  returning paciente_id into v_paciente;

  -- Botão do lembrete: "CONFIRMAR:<agendamento>" ou "REMARCAR:<agendamento>"
  if p_botao ~ '^(CONFIRMAR|REMARCAR):[0-9a-f-]{36}$' then
    v_acao := split_part(p_botao, ':', 1);
    v_ag := split_part(p_botao, ':', 2)::uuid;
    -- só vale se o lembrete desse agendamento foi mandado para ESTE número
    if exists (select 1 from public.whatsapp_mensagens
               where conversa_id = v_conversa and agendamento_id = v_ag and direcao = 'enviada') then
      update public.whatsapp_mensagens set agendamento_id = v_ag where id = v_msg;
      if v_acao = 'CONFIRMAR' then
        update public.agendamentos
           set status = 'confirmado', canal_confirmacao = 'whatsapp'
         where id = v_ag and status = 'agendado';
        v_resultado := case when found then 'confirmado' else 'ja_estava' end;
      else
        v_resultado := 'quer_remarcar';
      end if;
    end if;
  end if;

  -- Pedido para não receber mais mensagens
  if p_tipo = 'texto' and v_paciente is not null
     and upper(trim(both ' .!' from coalesce(p_texto, ''))) in ('SAIR', 'PARAR', 'CANCELAR MENSAGENS', 'STOP') then
    update public.pacientes set whatsapp_autorizado = false where id = v_paciente;
    v_resultado := 'saiu';
  end if;

  return jsonb_build_object('mensagem_id', v_msg, 'conversa_id', v_conversa, 'resultado', v_resultado);
end $$;
