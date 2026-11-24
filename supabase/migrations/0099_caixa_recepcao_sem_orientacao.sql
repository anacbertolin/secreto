-- 0099 — Quem é da recepção mas atende a Orientação Cirúrgica fica SÓ com o caixa da orientação
-- (pedido do Dr. Gelson, 24/11/2026, sobre a Alessandra). Não muda conferir/aprovar.
create or replace function interno.caixa_papel(p text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((
    select case p
      when 'lancar'   then (pr.funcao = 'recepcao' and not pr.orientacao_cirurgica) or pr.funcao in ('admin', 'faturamento')
      when 'conferir' then pr.caixa_conferir or pr.funcao = 'admin'
      when 'aprovar'  then pr.caixa_aprovar  or pr.funcao = 'admin'
      when 'ver'      then (pr.funcao = 'recepcao' and not pr.orientacao_cirurgica) or pr.funcao in ('admin', 'faturamento')
                           or pr.caixa_conferir or pr.caixa_aprovar
      else false end
    from public.profissionais pr
    where pr.email = interno.email_atual() and pr.ativo
      and (pr.funcao <> 'admin' or interno.mfa_ok())), false)
$function$;
