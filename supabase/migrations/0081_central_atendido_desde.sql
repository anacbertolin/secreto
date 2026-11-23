-- =====================================================================
-- 0081 — Central de atendimento: desde quando a conversa está com a atendente
-- =====================================================================
-- Para o cabeçalho "Em conversa desde dd/mm hh:mm com <atendente>" (igual ao Talklogos, pedido da dona 23/11/2026).
-- Só acrescenta uma coluna opcional; o gatilho da fila (0080) passa a preencher.
-- =====================================================================
alter table public.whatsapp_conversas add column atendido_desde timestamptz;
comment on column public.whatsapp_conversas.atendido_desde is
  'Quando a atendente atual assumiu a conversa (nulo sem responsável).';

create or replace function interno.tg_whatsapp_fila_conversa()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- quem está atendendo e desde quando
  if new.responsavel_id is null then
    new.atendido_desde := null;
  elsif new.responsavel_id is distinct from old.responsavel_id then
    new.atendido_desde := now();
  end if;

  -- fila (migração 0080)
  if new.arquivada or new.responsavel_id is not null then
    new.fila_desde := null;
  elsif old.responsavel_id is not null or old.arquivada then
    new.fila_desde := case
      when new.ultima_recebida_em is not null
       and new.ultima_recebida_em >= coalesce(new.ultima_mensagem_em, new.ultima_recebida_em)
      then coalesce(new.fila_desde, new.ultima_recebida_em) end;
  end if;
  return new;
end $$;

update public.whatsapp_conversas set atendido_desde = atualizado_em where responsavel_id is not null and not arquivada;
