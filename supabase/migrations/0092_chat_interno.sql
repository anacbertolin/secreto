-- =====================================================================
-- 0092 — Conversa interna da equipe (aba "Interno" da Central de atendimento)
-- =====================================================================
-- Pedido da dona (23/11/2026): "a gente fala com o paciente e fala entre a gente (funcionários e médicos) no sistema,
-- tudo no mesmo local" — como o Interno/Grupos do Talklogos.
--  * Conversa direta (duas pessoas) ou grupo (nome + participantes).
--  * Só quem participa lê e escreve (pode haver conteúdo de pacientes: RLS por participante).
--  * Ninguém apaga mensagens (registro do que foi combinado).
-- Só tabelas novas.
-- =====================================================================

create table public.interno_conversas (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text not null check (tipo in ('direta', 'grupo')),
  nome               text check (tipo = 'direta' or length(trim(nome)) > 0),
  chave_direta       text unique,                       -- menor-id|maior-id, para não duplicar conversa a dois
  criado_por         uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em          timestamptz not null default now(),
  ultima_mensagem_em timestamptz
);
create index interno_conversas_criado_por_idx on public.interno_conversas (criado_por);

create table public.interno_participantes (
  conversa_id     uuid not null references public.interno_conversas(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id),
  lida_em         timestamptz not null default now(),
  primary key (conversa_id, profissional_id)
);
create index interno_participantes_prof_idx on public.interno_participantes (profissional_id);

create table public.interno_mensagens (
  id          uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.interno_conversas(id) on delete cascade,
  autor_id    uuid not null references public.profissionais(id) default interno.profissional_atual(),
  texto       text not null check (length(trim(texto)) > 0 and length(texto) <= 4000),
  criado_em   timestamptz not null default now()
);
create index interno_mensagens_conversa_idx on public.interno_mensagens (conversa_id, criado_em);
create index interno_mensagens_autor_idx on public.interno_mensagens (autor_id);

-- Quem está logado participa da conversa?
create or replace function interno.interno_participa(p_conversa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.interno_participantes
                  where conversa_id = p_conversa and profissional_id = interno.profissional_atual())
$$;

-- Nova mensagem → atualiza a hora da conversa (para ordenar a lista)
create or replace function interno.tg_interno_mensagem()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.interno_conversas set ultima_mensagem_em = new.criado_em where id = new.conversa_id;
  update public.interno_participantes set lida_em = new.criado_em
   where conversa_id = new.conversa_id and profissional_id = new.autor_id;
  return null;
end $$;
create trigger ultima after insert on public.interno_mensagens
  for each row execute function interno.tg_interno_mensagem();

-- Abrir (ou criar) a conversa a dois com um colega
create or replace function public.interno_abrir_direta(p_outro uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  eu    uuid := interno.profissional_atual();
  chave text;
  v     uuid;
begin
  if eu is null then raise exception 'Sem acesso.' using errcode = '42501'; end if;
  if p_outro is null or p_outro = eu then raise exception 'Escolha outra pessoa.'; end if;
  if not exists (select 1 from public.profissionais where id = p_outro and ativo) then
    raise exception 'Pessoa não encontrada ou inativa.';
  end if;
  chave := least(eu::text, p_outro::text) || '|' || greatest(eu::text, p_outro::text);
  select id into v from public.interno_conversas where chave_direta = chave;
  if v is null then
    insert into public.interno_conversas (tipo, chave_direta, criado_por) values ('direta', chave, eu) returning id into v;
    insert into public.interno_participantes (conversa_id, profissional_id) values (v, eu), (v, p_outro);
  end if;
  return v;
end $$;

-- Criar um grupo (quem cria entra automaticamente)
create or replace function public.interno_criar_grupo(p_nome text, p_membros uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := interno.profissional_atual();
  v  uuid;
begin
  if eu is null then raise exception 'Sem acesso.' using errcode = '42501'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Dê um nome ao grupo.'; end if;
  insert into public.interno_conversas (tipo, nome, criado_por) values ('grupo', trim(p_nome), eu) returning id into v;
  insert into public.interno_participantes (conversa_id, profissional_id)
  select v, p.id from public.profissionais p
   where p.ativo and (p.id = eu or p.id = any(coalesce(p_membros, '{}')))
  on conflict do nothing;
  return v;
end $$;

-- Acrescentar pessoas a um grupo (qualquer participante)
create or replace function public.interno_adicionar(p_conversa uuid, p_membros uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not interno.interno_participa(p_conversa)
     or (select tipo from public.interno_conversas where id = p_conversa) <> 'grupo' then
    raise exception 'Só quem participa do grupo pode acrescentar pessoas.' using errcode = '42501';
  end if;
  insert into public.interno_participantes (conversa_id, profissional_id)
  select p_conversa, p.id from public.profissionais p where p.ativo and p.id = any(p_membros)
  on conflict do nothing;
end $$;

-- ---------- Permissões ----------
revoke execute on function interno.interno_participa(uuid) from public, anon;
grant execute on function interno.interno_participa(uuid) to authenticated;
revoke execute on function interno.tg_interno_mensagem() from public, anon, authenticated;
revoke execute on function public.interno_abrir_direta(uuid) from public, anon;
revoke execute on function public.interno_criar_grupo(text, uuid[]) from public, anon;
revoke execute on function public.interno_adicionar(uuid, uuid[]) from public, anon;
grant execute on function public.interno_abrir_direta(uuid) to authenticated;
grant execute on function public.interno_criar_grupo(text, uuid[]) to authenticated;
grant execute on function public.interno_adicionar(uuid, uuid[]) to authenticated;

alter table public.interno_conversas enable row level security;
alter table public.interno_participantes enable row level security;
alter table public.interno_mensagens enable row level security;
revoke all on public.interno_conversas, public.interno_participantes, public.interno_mensagens from anon;

-- Conversas: só quem participa vê; criação só pelas funções
revoke insert, update, delete, truncate on public.interno_conversas from authenticated;
create policy participante_le on public.interno_conversas for select to authenticated
  using ((select interno.interno_participa(id)));

-- Participantes: vê quem está nas suas conversas; cada um só marca a própria leitura
revoke insert, update, delete, truncate on public.interno_participantes from authenticated;
grant update (lida_em) on public.interno_participantes to authenticated;
create policy participante_le on public.interno_participantes for select to authenticated
  using ((select interno.interno_participa(conversa_id)));
create policy marca_propria_leitura on public.interno_participantes for update to authenticated
  using (profissional_id = (select interno.profissional_atual()))
  with check (profissional_id = (select interno.profissional_atual()));

-- Mensagens: participantes leem e escrevem em nome próprio; ninguém altera nem apaga
revoke update, delete, truncate on public.interno_mensagens from authenticated;
create policy participante_le on public.interno_mensagens for select to authenticated
  using ((select interno.interno_participa(conversa_id)));
create policy participante_escreve on public.interno_mensagens for insert to authenticated
  with check ((select interno.interno_participa(conversa_id)) and autor_id = (select interno.profissional_atual()));

alter publication supabase_realtime add table public.interno_mensagens;
alter publication supabase_realtime add table public.interno_participantes;
