-- 0159 — O que a pessoa pode na tela "Cirurgias do dia" (para o menu e a tela saberem o que mostrar)
create or replace function public.cirurgias_acesso()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('lista', interno.pode_cirurgias_dia(), 'valores', interno.pode_valores_cirurgias(),
                            'datas', interno.atende_orientacao() or interno.tem_funcao('faturamento', 'admin'))
$$;
revoke execute on function public.cirurgias_acesso() from public, anon;
grant execute on function public.cirurgias_acesso() to authenticated;
