-- =====================================================================
-- 0018 — Assistente do WhatsApp: parâmetros na tela (pedido da dona, 15/11/2026)
--  * Modelo da IA escolhido na tela (padrão: Claude Sonnet 5.5).
--  * Horário padrão da clínica: vale para o médico que ainda não tem
--    horário próprio em "Horários e bloqueios".
-- =====================================================================
alter table public.whatsapp_extrator_config
  alter column modelo set default 'claude-sonnet-5-5',
  add column usar_horario_padrao boolean not null default true,
  add column padrao_dias smallint[] not null default '{1,2,3,4,5}'
    check (padrao_dias <@ array[0,1,2,3,4,5,6]::smallint[]),
  add column padrao_inicio time not null default '08:00',
  add column padrao_fim time not null default '18:00',
  add column padrao_duracao_min int not null default 20 check (padrao_duracao_min between 5 and 240),
  add constraint whatsapp_extrator_modelo_ok
    check (modelo in ('claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5')),
  add constraint whatsapp_extrator_padrao_ok check (padrao_fim > padrao_inicio);

update public.whatsapp_extrator_config set modelo = 'claude-sonnet-5-5' where id = 1;

grant update (modelo, usar_horario_padrao, padrao_dias, padrao_inicio, padrao_fim, padrao_duracao_min)
  on public.whatsapp_extrator_config to authenticated;
