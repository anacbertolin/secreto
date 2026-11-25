-- =====================================================================
-- 0110 — Caixa: correções que só a dona faz (pedido da dona, 25/11/2026)
--
--  * "Cancelar caixa": para caixa aberto por engano/teste. Só se não houver nada válido lançado
--    (cancele os lançamentos antes). O caixa NÃO some: fica no histórico como "cancelado", com quem e o motivo.
--  * "Reabrir para correção": caixa fechado, conferido ou APROVADO volta a ficar aberto (com motivo) e
--    passa de novo por fechamento → conferência → aprovação.
--  * Quem pode: marcação profissionais.caixa_corrigir (hoje só a Ana Carolina, administração) + verificação em
--    duas etapas da administração (interno.mfa_ok, migração 0089).
--  * Incluir exames no mesmo paciente (tela): o atendimento do caixa aberto pode ter o valor aumentado e a
--    descrição completada — isso já era permitido pelas regras da 0066 (a auditoria registra a mudança).
-- =====================================================================

alter table public.profissionais add column caixa_corrigir boolean not null default false;
comment on column public.profissionais.caixa_corrigir is
  'Pode cancelar caixa aberto por engano e reabrir caixa fechado/conferido/aprovado para correção (decisão da dona: só ela).';
-- hoje a única pessoa da administração é a Ana Carolina (conferido em 25/11/2026)
update public.profissionais set caixa_corrigir = true where funcao = 'admin' and ativo;

alter table public.caixas drop constraint caixas_status_check;
alter table public.caixas add constraint caixas_status_check
  check (status in ('aberto', 'fechado', 'conferido', 'aprovado', 'cancelado'));
alter table public.caixas
  add column cancelado_por        uuid references public.profissionais(id),
  add column cancelado_em         timestamptz,
  add column motivo_cancelamento  text,
  add column reaberto_por         uuid references public.profissionais(id),
  add column reaberto_em          timestamptz,
  add column motivo_reabertura    text;
create index caixas_cancelado_por_idx on public.caixas (cancelado_por);
create index caixas_reaberto_por_idx on public.caixas (reaberto_por);

create or replace function interno.caixa_corrige()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select pr.caixa_corrigir and pr.funcao = 'admin' and interno.mfa_ok()
                   from public.profissionais pr where pr.email = interno.email_atual() and pr.ativo), false)
$$;
revoke execute on function interno.caixa_corrige() from public, anon;
grant execute on function interno.caixa_corrige() to authenticated, service_role;

create or replace function public.caixa_cancelar(p_caixa uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not interno.caixa_corrige() then raise exception 'Só a administração autorizada pode cancelar um caixa.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escreva o motivo do cancelamento.'; end if;
  perform 1 from public.caixas where id = p_caixa and status = 'aberto' for update;
  if not found then raise exception 'Só dá para cancelar um caixa aberto. Se ele já foi fechado, use "Reabrir para correção".'; end if;
  if exists (select 1 from public.caixa_atendimentos where caixa_id = p_caixa and not cancelado)
     or exists (select 1 from public.caixa_pagamentos where caixa_id = p_caixa and not cancelado)
     or exists (select 1 from public.caixa_saidas where caixa_id = p_caixa and not cancelado) then
    raise exception 'Este caixa tem lançamentos. Cancele cada lançamento antes (botão Cancelar na linha) e depois cancele o caixa.';
  end if;
  update public.caixas set status = 'cancelado', cancelado_por = interno.profissional_atual(), cancelado_em = now(),
    motivo_cancelamento = trim(p_motivo)
  where id = p_caixa;
end $$;

create or replace function public.caixa_reabrir(p_caixa uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text; v_setor text;
begin
  if not interno.caixa_corrige() then raise exception 'Só a administração autorizada pode reabrir um caixa.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escreva o motivo da reabertura.'; end if;
  select status, setor into v_status, v_setor from public.caixas where id = p_caixa for update;
  if v_status is null or v_status not in ('fechado', 'conferido', 'aprovado') then
    raise exception 'Só dá para reabrir um caixa fechado, conferido ou aprovado.';
  end if;
  if exists (select 1 from public.caixas where status = 'aberto' and setor = v_setor) then
    raise exception 'Há outro caixa deste setor aberto agora. Feche-o antes de reabrir este.';
  end if;
  update public.caixas set status = 'aberto',
    fechado_por = null, fechado_em = null, esperado_dinheiro = null, contado_dinheiro = null, diferenca_dinheiro = null,
    conferido_por = null, conferido_em = null, aprovado_por = null, aprovado_em = null,
    reaberto_por = interno.profissional_atual(), reaberto_em = now(), motivo_reabertura = trim(p_motivo)
  where id = p_caixa;
end $$;

revoke execute on function public.caixa_cancelar(uuid, text), public.caixa_reabrir(uuid, text) from public, anon;
grant execute on function public.caixa_cancelar(uuid, text), public.caixa_reabrir(uuid, text) to authenticated;
