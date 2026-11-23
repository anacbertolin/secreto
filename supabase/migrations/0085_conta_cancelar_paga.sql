-- 0085 — Cancelar conta particular já paga (pedido da dona, 23/11/2026): a tela passa a permitir;
-- o banco impede cancelar conta com repasse ao médico ativo (cancelar o repasse antes).
-- SECURITY DEFINER para enxergar `repasses` mesmo quando quem cancela é a recepção.
create or replace function interno.tg_conta_regras()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.convenio_id is null then
    new.tipo_guia := 'particular';
  elsif new.tipo_guia = 'particular' then
    new.tipo_guia := 'consulta';
  end if;
  if tg_op = 'UPDATE' and old.status = 'cancelada' and new.status <> 'cancelada' then
    raise exception 'Conta cancelada não pode ser reaberta. Crie uma conta nova.';
  end if;
  if new.status = 'cancelada' and coalesce(trim(new.motivo_cancelamento), '') = '' then
    raise exception 'Informe o motivo do cancelamento da conta.';
  end if;
  if tg_op = 'UPDATE' and new.status = 'cancelada' and old.status <> 'cancelada'
     and exists (select 1 from public.repasses r where r.conta_id = new.id and r.status::text <> 'cancelado') then
    raise exception 'Esta conta tem repasse ao médico lançado: cancele o repasse antes de cancelar a conta.';
  end if;
  if new.status = 'paga' and new.convenio_id is null and new.recebido_em is null then
    new.recebido_em := now();
  end if;
  return new;
end $function$;
revoke execute on function interno.tg_conta_regras() from public, anon, authenticated;
