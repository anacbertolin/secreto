-- 0083 — Faturamento também abre, lança e fecha o caixa da recepção e vê todos os caixas
-- (pedido da dona, 23/11/2026: o faturamento fiscaliza, abre e fecha o caixa).
create or replace function interno.caixa_papel(p text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce((
    select case p
      when 'lancar'   then pr.funcao in ('recepcao', 'admin', 'faturamento')
      when 'conferir' then pr.caixa_conferir or pr.funcao = 'admin'
      when 'aprovar'  then pr.caixa_aprovar  or pr.funcao = 'admin'
      when 'ver'      then pr.funcao in ('recepcao', 'admin', 'faturamento') or pr.caixa_conferir or pr.caixa_aprovar
      else false end
    from public.profissionais pr
    where pr.email = interno.email_atual() and pr.ativo), false)
$function$;
