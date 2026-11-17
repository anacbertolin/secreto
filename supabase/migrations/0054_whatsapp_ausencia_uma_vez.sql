-- =====================================================================
-- 0054 — Resposta automática fora do horário: uma só, mesmo com várias
-- mensagens seguidas (a marcação e a conferência viram uma instrução só).
-- (O arquivo 0053 já traz esta versão; aqui fica o registro da correção.)
-- =====================================================================
create or replace function public.whatsapp_ausencia_texto(p_conversa uuid)
returns text language plpgsql set search_path = '' as $$
declare
  v_setor text;
  cfg public.whatsapp_ausencia;
  v_agora timestamp := (now() at time zone 'America/Sao_Paulo');
  v_faixa jsonb;
  v_hora time;
begin
  select setor into v_setor from public.whatsapp_conversas where id = p_conversa;
  if v_setor is null then return null; end if;
  select * into cfg from public.whatsapp_ausencia where setor = v_setor;
  if not found or not cfg.ligado then return null; end if;

  v_faixa := cfg.horarios -> extract(isodow from v_agora)::int::text;
  v_hora := v_agora::time;
  if v_faixa is not null and v_hora >= (v_faixa ->> 0)::time and v_hora < (v_faixa ->> 1)::time then
    return null;                                        -- dentro do horário
  end if;
  -- Marca e confere na mesma instrução: várias mensagens seguidas geram uma resposta só
  update public.whatsapp_conversas set ausencia_enviada_em = now()
   where id = p_conversa and (ausencia_enviada_em is null or ausencia_enviada_em <= now() - interval '8 hours');
  if not found then
    return null;                                        -- já avisou há pouco
  end if;
  return cfg.texto;
end $$;
revoke execute on function public.whatsapp_ausencia_texto(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_ausencia_texto(uuid) to service_role;
