-- 0160 — Guia "Como funciona" com LEITURA OBRIGATÓRIA nas 5 primeiras vezes (pedido do Dr. Gelson, 25/11/2026)
-- Conta por pessoa (vale em qualquer computador). Se o guia mudar, o app usa uma versão nova e a contagem recomeça.
create table public.guia_leituras (
  profissional_id uuid not null references public.profissionais(id),
  guia            text not null,
  versao          int  not null,
  vezes           int  not null default 0,
  primeira_em     timestamptz not null default now(),
  ultima_em       timestamptz not null default now(),
  primary key (profissional_id, guia, versao)
);
comment on table public.guia_leituras is 'Quantas vezes cada pessoa confirmou a leitura de cada guia do sistema (leitura obrigatória).';
alter table public.guia_leituras enable row level security;
create policy le on public.guia_leituras for select to authenticated
  using (profissional_id = (select interno.profissional_atual()) or (select interno.tem_funcao('admin')));
-- grava só pela função abaixo
revoke insert, update, delete, truncate on public.guia_leituras from authenticated, anon;

create or replace function public.guia_vezes(p_guia text, p_versao int)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select vezes from public.guia_leituras
                    where profissional_id = interno.profissional_atual() and guia = p_guia and versao = p_versao), 0)
$$;
create or replace function public.guia_li(p_guia text, p_versao int)
returns int language plpgsql security definer set search_path = '' as $$
declare v int; v_eu uuid := interno.profissional_atual();
begin
  if v_eu is null then raise exception 'Usuário sem cadastro na equipe.'; end if;
  insert into public.guia_leituras as g (profissional_id, guia, versao, vezes)
  values (v_eu, p_guia, p_versao, 1)
  on conflict (profissional_id, guia, versao) do update set vezes = g.vezes + 1, ultima_em = now()
  returning vezes into v;
  return v;
end $$;
revoke execute on function public.guia_vezes(text, int), public.guia_li(text, int) from public, anon;
grant execute on function public.guia_vezes(text, int), public.guia_li(text, int) to authenticated;
