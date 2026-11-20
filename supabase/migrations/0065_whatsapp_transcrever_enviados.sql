-- =====================================================================
-- 0065 — Transcrever também os áudios ENVIADOS pela equipe (20/11/2026)
-- Pedido da dona: a Alessandra manda muitos áudios; o que ela orientou precisa
-- ficar escrito e entrar na pesquisa das mensagens, igual aos áudios dos pacientes.
-- Só áudios que passaram pela Meta (midia_id preenchido); conversas importadas
-- do celular não disparam transcrição automática.
-- =====================================================================
create or replace function interno.tg_audio_transcrever()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.tipo = 'audio' and new.midia_id is not null
     and (new.direcao = 'recebida' or (new.direcao = 'enviada' and new.situacao <> 'falhou'))
     and coalesce((select transcrever_audios from public.whatsapp_extrator_config where id = 1), false) then
    update public.whatsapp_mensagens set transcricao_situacao = 'pendente' where id = new.id;
    perform interno.chamar_transcricao(jsonb_build_object('acao', 'transcrever', 'mensagem_id', new.id));
  end if;
  return null;
end $$;
revoke execute on function interno.tg_audio_transcrever() from public, anon, authenticated;
