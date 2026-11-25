-- =====================================================================
-- 0104 — Conversa interna: editar a própria mensagem
-- =====================================================================
-- Pedido da dona (25/11/2026): na conversa interna da equipe (aba Interno da Central) dá para corrigir uma
-- mensagem mandada errada. Diferente do WhatsApp (a Meta não deixa editar), aqui a mensagem é nossa.
--  * Só o autor edita, só o texto, e só nas primeiras 24 h.
--  * O texto original fica guardado (texto_original) e a mensagem mostra "editada".
-- =====================================================================

alter table public.interno_mensagens
  add column editado_em timestamptz,
  add column texto_original text;
comment on column public.interno_mensagens.texto_original is 'Texto como foi mandado da primeira vez (guardado na primeira edição).';

create or replace function interno.tg_interno_mensagem_editada()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.texto is distinct from old.texto then
    new.editado_em := now();
    new.texto_original := coalesce(old.texto_original, old.texto);
  end if;
  -- só o texto muda
  new.conversa_id := old.conversa_id;
  new.autor_id := old.autor_id;
  new.criado_em := old.criado_em;
  return new;
end $$;
create trigger editada before update on public.interno_mensagens
  for each row execute function interno.tg_interno_mensagem_editada();

grant update (texto) on public.interno_mensagens to authenticated;
create policy autor_edita on public.interno_mensagens for update to authenticated
  using (autor_id = (select interno.profissional_atual()) and criado_em > now() - interval '24 hours')
  with check (autor_id = (select interno.profissional_atual()) and length(trim(texto)) > 0);
