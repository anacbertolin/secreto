-- 0063 — Login por nome de usuário (decisão da dona, 16/11/2026)
-- Médicos e funcionários entram com USUÁRIO + senha; a administração continua com e-mail.
-- Por trás, o usuário vira um "e-mail interno" <usuario>@equipe.consumedolhos.com.br (nunca recebe
-- mensagens; a conta é criada já confirmada pela função equipe-acesso). Assim todas as regras de
-- acesso (RLS), que comparam o e-mail da sessão com profissionais.email, continuam iguais.

alter table public.profissionais add column usuario text;
alter table public.profissionais add constraint profissionais_usuario_formato
  check (usuario ~ '^[a-z0-9]([a-z0-9._-]{1,38})[a-z0-9]$');
alter table public.profissionais add constraint profissionais_usuario_key unique (usuario);
comment on column public.profissionais.usuario is
  'Nome de usuário do login (sem e-mail). Quando preenchido, o e-mail vira <usuario>@equipe.consumedolhos.com.br (interno).';

create or replace function interno.tg_profissional_usuario()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.usuario := nullif(lower(btrim(new.usuario)), '');
  if new.usuario is not null then
    new.email := new.usuario || '@equipe.consumedolhos.com.br';
  elsif tg_op = 'UPDATE' and old.usuario is not null and new.email = old.email then
    -- deixou de usar usuário sem informar e-mail real
    new.email := null;
  end if;
  return new;
end $$;

create trigger profissional_usuario before insert or update on public.profissionais
  for each row execute function interno.tg_profissional_usuario();
