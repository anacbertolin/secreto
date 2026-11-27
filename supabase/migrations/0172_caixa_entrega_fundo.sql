-- =====================================================================
-- 0172 — Caixa: fundo de troco separado do dinheiro do dia (pedido da dona/recepção, 27/11/2026)
-- A recepção devolve o fundo de troco (R$ 200) ao administrativo separado do dinheiro do dia, e quer ver os dois
-- separados na tela. Nova entrega: caixa_saidas.tipo = 'entrega_fundo' (também precisa do "Recebi").
-- =====================================================================
alter table public.caixa_saidas drop constraint caixa_saidas_tipo_check;
alter table public.caixa_saidas add constraint caixa_saidas_tipo_check
  check (tipo in ('despesa', 'entrega_adm', 'entrega_fundo'));

create or replace function public.caixa_entrega_receber(p_saida uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  if not interno.caixa_papel('receber') then
    raise exception 'Você não está marcada(o) para receber o dinheiro entregue pela recepção (tela Equipe).';
  end if;
  select * into s from public.caixa_saidas where id = p_saida for update;
  if s.id is null or s.tipo not in ('entrega_adm', 'entrega_fundo') then raise exception 'Entrega não encontrada.'; end if;
  if s.cancelado then raise exception 'Esta entrega foi cancelada.'; end if;
  if s.recebido_em is not null then raise exception 'Esta entrega já foi recebida.'; end if;
  perform set_config('app.caixa_entrega', 'on', true);
  update public.caixa_saidas set recebido_por = interno.profissional_atual(), recebido_em = now() where id = p_saida;
  perform set_config('app.caixa_entrega', '', true);
end $$;
