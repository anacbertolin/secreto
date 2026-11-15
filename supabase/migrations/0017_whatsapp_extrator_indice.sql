-- =====================================================================
-- 0017 — Extrator do WhatsApp: índice pedido pelo Supabase e registro de
--        quem mudou a configuração por último.
-- =====================================================================
create index if not exists whatsapp_extrator_config_atualizado_por_idx on public.whatsapp_extrator_config (atualizado_por);
create or replace function interno.tg_extrator_config_quem()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_por := coalesce(interno.profissional_atual(), new.atualizado_por);
  return new;
end $$;
revoke execute on function interno.tg_extrator_config_quem() from public, anon;
create trigger quem_alterou before update on public.whatsapp_extrator_config
  for each row execute function interno.tg_extrator_config_quem();
