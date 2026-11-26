-- =====================================================================
-- 0171 — Caixa: "Entregar dinheiro ao administrativo" com check de quem recebe (dona, 26/11/2026)
-- Quando entra muito dinheiro durante o dia (ex.: R$ 2.000 de laser), a recepção sobe com o dinheiro antes de fechar
-- o caixa. O caixa continua aberto lá embaixo, mas tem que constar a entrega e o "recebi" de quem pegou o dinheiro.
--  * caixa_saidas.tipo: 'despesa' (dinheiro gasto: água, motoboy…) ou 'entrega_adm' (sangria: subiu para o administrativo).
--  * Entrega fica "aguardando check" até alguém marcado em profissionais.caixa_recebe_entrega (Luciano, Soraline,
--    Andrea — decisão da dona) ou a administração clicar "Recebi" (caixa_entrega_receber). Vale mesmo com o caixa já fechado.
--  * Entrega já recebida não pode ser cancelada.
-- =====================================================================

alter table public.profissionais add column if not exists caixa_recebe_entrega boolean not null default false;
comment on column public.profissionais.caixa_recebe_entrega is
  'Recebe o dinheiro que a recepção entrega ao administrativo durante o dia e dá o check (caixa).';
update public.profissionais set caixa_recebe_entrega = true
 where ativo and nome in ('Luciano Campino Pinto', 'Soraline Juliana', 'Andrea Camilo');

alter table public.caixa_saidas
  add column tipo text not null default 'despesa' check (tipo in ('despesa', 'entrega_adm')),
  add column recebido_por uuid references public.profissionais(id),
  add column recebido_em  timestamptz;
create index caixa_saidas_recebido_por_idx on public.caixa_saidas (recebido_por);

-- quem pode ver o caixa: inclui quem recebe as entregas
create or replace function interno.caixa_papel(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case p
      when 'lancar'   then (pr.funcao = 'recepcao' and not pr.orientacao_cirurgica) or pr.funcao in ('admin', 'faturamento')
      when 'conferir' then pr.caixa_conferir or pr.funcao = 'admin'
      when 'aprovar'  then pr.caixa_aprovar  or pr.funcao = 'admin'
      when 'receber'  then pr.caixa_recebe_entrega or pr.funcao = 'admin'
      when 'ver'      then (pr.funcao = 'recepcao' and not pr.orientacao_cirurgica) or pr.funcao in ('admin', 'faturamento')
                           or pr.caixa_conferir or pr.caixa_aprovar or pr.caixa_recebe_entrega
      else false end
    from public.profissionais pr
    where pr.email = interno.email_atual() and pr.ativo
      and (pr.funcao <> 'admin' or interno.mfa_ok())), false)
$$;

-- regras dos lançamentos: o "recebi" só pela função própria (que pode agir em caixa já fechado)
create or replace function interno.tg_caixa_movimento()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE' and tg_table_name = 'caixa_saidas' and coalesce(current_setting('app.caixa_entrega', true), '') = 'on' then
    return new;
  end if;
  select c.status into v_status from public.caixas c where c.id = new.caixa_id;
  if v_status is distinct from 'aberto' then
    raise exception 'Este caixa já foi fechado: não dá para lançar nem alterar. Peça para devolverem o caixa para correção.';
  end if;
  if tg_op = 'INSERT' then
    new.criado_por := interno.profissional_atual();
    new.criado_em  := now();
    new.cancelado  := false;
    new.cancelado_por := null; new.cancelado_em := null; new.motivo_cancelamento := null;
    if tg_table_name = 'caixa_pagamentos' then
      if exists (select 1 from public.caixa_atendimentos a where a.id = new.atendimento_id and (a.cancelado or a.cortesia)) then
        raise exception 'Este atendimento está cancelado ou é cortesia: não recebe pagamento.';
      end if;
    elsif tg_table_name = 'caixa_saidas' then
      new.recebido_por := null; new.recebido_em := null;
    end if;
    return new;
  end if;
  if new.caixa_id <> old.caixa_id or new.criado_por is distinct from old.criado_por or new.criado_em <> old.criado_em then
    raise exception 'Não é permitido mudar o caixa ou o autor de um lançamento.';
  end if;
  if old.cancelado then
    raise exception 'Este lançamento já foi cancelado.';
  end if;
  if tg_table_name = 'caixa_saidas' then
    if new.recebido_por is distinct from old.recebido_por or new.recebido_em is distinct from old.recebido_em
       or new.tipo is distinct from old.tipo then
      raise exception 'O recebimento da entrega só pode ser marcado pelo botão "Recebi".';
    end if;
    if new.cancelado and old.recebido_em is not null then
      raise exception 'Este dinheiro já foi recebido pelo administrativo: não dá para cancelar a entrega.';
    end if;
  end if;
  if new.cancelado then
    new.cancelado_por := interno.profissional_atual();
    new.cancelado_em  := now();
  end if;
  return new;
end $$;

create or replace function public.caixa_entrega_receber(p_saida uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  if not interno.caixa_papel('receber') then
    raise exception 'Você não está marcada(o) para receber o dinheiro entregue pela recepção (tela Equipe).';
  end if;
  select * into s from public.caixa_saidas where id = p_saida for update;
  if s.id is null or s.tipo <> 'entrega_adm' then raise exception 'Entrega não encontrada.'; end if;
  if s.cancelado then raise exception 'Esta entrega foi cancelada.'; end if;
  if s.recebido_em is not null then raise exception 'Esta entrega já foi recebida.'; end if;
  perform set_config('app.caixa_entrega', 'on', true);
  update public.caixa_saidas set recebido_por = interno.profissional_atual(), recebido_em = now() where id = p_saida;
  perform set_config('app.caixa_entrega', '', true);
end $$;
revoke execute on function public.caixa_entrega_receber(uuid) from public, anon;
grant execute on function public.caixa_entrega_receber(uuid) to authenticated;
