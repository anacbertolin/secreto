-- 0089 — Verificação em duas etapas (código do aplicativo autenticador) para a ADMINISTRAÇÃO (pedido da dona, 24/11/2026).
-- Quem é admin e já ativou o código só tem os poderes de admin depois de digitar o código no login (sessão "aal2").
-- Enquanto a pessoa não ativou, nada muda (para poder ativar). Outras funções não são afetadas.
-- Celular perdido: um técnico remove o fator em auth.mfa_factors e ela ativa de novo.

create or replace function interno.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
revoke execute on function interno.mfa_ok() from public, anon;
grant execute on function interno.mfa_ok() to authenticated;

create or replace function interno.tem_funcao(variadic funcoes public.funcao_profissional[])
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select p.funcao = any(funcoes) and (p.funcao <> 'admin' or interno.mfa_ok())
     from public.profissionais p
     where p.email = interno.email_atual() and p.ativo),
    false)
$function$;

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
    where pr.email = interno.email_atual() and pr.ativo
      and (pr.funcao <> 'admin' or interno.mfa_ok())), false)
$function$;
