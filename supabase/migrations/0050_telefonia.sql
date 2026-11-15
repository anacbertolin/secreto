-- =====================================================================
-- 0050 — Telefonia: telefone dentro do sistema (ramais pelo navegador)
-- =====================================================================
-- Pedido da dona (15/11/2026): as atendentes atendem e fazem ligações na mesma
-- tela do WhatsApp, transferem para outro ramal. Teste com a Api4Com (PABX em
-- nuvem com WebRTC), sem portabilidade por enquanto.
--
-- Funciona com QUALQUER central que aceite ramal SIP pelo navegador (WebRTC /
-- WebSocket seguro): Api4Com, Nvoip, Telecall (se oferecer)...
--
--  * telefonia_config ........ liga/desliga, endereço WSS e domínio SIP (só admin altera)
--  * telefonia_ramais ........ ramais e quem usa cada um (equipe lê, para transferir)
--  * interno.telefonia_senhas  senha SIP de cada ramal — fora da API; só a própria pessoa
--                              recebe a sua (função telefonia_minhas_credenciais)
--  * ligacoes ................ histórico (recebidas, feitas, perdidas, transferidas)
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só tabelas NOVAS, nada muda nas existentes.
-- =====================================================================

-- ---------- Configuração ----------
create table public.telefonia_config (
  id            int primary key default 1 check (id = 1),
  ligado        boolean not null default false,
  provedor      text not null default 'Api4Com',
  wss_url       text check (wss_url is null or wss_url ~ '^wss://'),
  sip_dominio   text check (sip_dominio is null or sip_dominio ~ '^[A-Za-z0-9.-]+(:[0-9]+)?$'),
  atualizado_em timestamptz not null default now()
);
comment on table public.telefonia_config is 'Telefone no sistema: liga/desliga, endereço WSS e domínio SIP da central. Só a admin altera.';
insert into public.telefonia_config (id) values (1);
create trigger atualizado_em before update on public.telefonia_config
  for each row execute function interno.tg_atualizado_em();

-- ---------- Ramais ----------
create table public.telefonia_ramais (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,                       -- ex.: "Recepção 1"
  ramal            text not null unique check (ramal ~ '^[0-9A-Za-z_.-]{1,32}$'),
  sip_usuario      text check (sip_usuario is null or sip_usuario ~ '^[0-9A-Za-z_.@+-]{1,64}$'), -- se vazio, usa o ramal
  profissional_id  uuid unique references public.profissionais(id),
  senha_cadastrada boolean not null default false,      -- mantido pela função telefonia_definir_senha
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on table public.telefonia_ramais is 'Ramais da central telefônica e quem da equipe usa cada um. A senha fica em interno.telefonia_senhas.';
create trigger atualizado_em before update on public.telefonia_ramais
  for each row execute function interno.tg_atualizado_em();

create table interno.telefonia_senhas (
  ramal_id  uuid primary key references public.telefonia_ramais(id) on delete cascade,
  senha     text not null,
  definida_em timestamptz not null default now()
);
revoke all on interno.telefonia_senhas from public, anon, authenticated;

-- Auditoria das mudanças de configuração e ramais (sem a senha)
create or replace function interno.tg_telefonia_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.log_auditoria (acao, tabela, detalhes, dados_antes, dados_depois)
  values (tg_op, tg_table_name, 'Telefonia: configuração/ramais alterados',
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;
create trigger auditoria after update on public.telefonia_config
  for each row execute function interno.tg_telefonia_auditoria();
create trigger auditoria after insert or update or delete on public.telefonia_ramais
  for each row execute function interno.tg_telefonia_auditoria();

-- ---------- Histórico de ligações ----------
create table public.ligacoes (
  id               uuid primary key default gen_random_uuid(),
  direcao          text not null check (direcao in ('entrada', 'saida')),
  numero           text not null,                          -- número do paciente/contato (só dígitos)
  paciente_id      uuid references public.pacientes(id),
  situacao         text not null default 'tocando'
                   check (situacao in ('tocando', 'em_andamento', 'atendida', 'perdida', 'nao_atendida', 'falhou')),
  profissional_id  uuid references public.profissionais(id), -- quem atendeu / quem ligou
  ramal            text,
  sip_call_id      text,
  iniciada_em      timestamptz not null default now(),
  atendida_em      timestamptz,
  encerrada_em     timestamptz,
  transferida_para text,                                    -- ramal ou número para onde foi transferida
  retornada_em     timestamptz,                             -- perdida que alguém já ligou de volta
  retornada_por    uuid references public.profissionais(id),
  observacao       text
);
comment on table public.ligacoes is 'Histórico de ligações do telefone do sistema. Gravado só pelas funções telefonia_*.';
create index ligacoes_recentes_idx on public.ligacoes (iniciada_em desc);
create index ligacoes_paciente_idx on public.ligacoes (paciente_id);
create index ligacoes_profissional_idx on public.ligacoes (profissional_id);
create index ligacoes_retornada_por_idx on public.ligacoes (retornada_por);
create index ligacoes_numero_idx on public.ligacoes ((interno.chave_telefone(numero)), iniciada_em desc);

-- ---------- Funções internas ----------
-- Ramal ativo de quem está logado (null se não tiver)
create or replace function interno.telefonia_meu_ramal()
returns public.telefonia_ramais language sql stable security definer set search_path = '' as $$
  select r.* from public.telefonia_ramais r
  where r.ativo and r.profissional_id = interno.profissional_atual()
$$;

create or replace function interno.telefonia_exige_ramal()
returns public.telefonia_ramais language plpgsql stable security definer set search_path = '' as $$
declare r public.telefonia_ramais;
begin
  r := interno.telefonia_meu_ramal();
  if r.id is null then
    raise exception 'Você não tem um ramal de telefone no sistema.' using errcode = '42501';
  end if;
  return r;
end $$;

-- Paciente do número (só quando bate com UM paciente; família com o mesmo número fica sem)
create or replace function interno.telefonia_paciente(p_numero text)
returns uuid language sql stable security definer set search_path = '' as $$
  select case when count(*) = 1 then min(id::text)::uuid end
  from public.pacientes
  where ativo
    and interno.chave_telefone(p_numero) is not null
    and (interno.chave_telefone(telefone) = interno.chave_telefone(p_numero)
         or interno.chave_telefone(telefone_secundario) = interno.chave_telefone(p_numero)
         or interno.chave_telefone(responsavel_telefone) = interno.chave_telefone(p_numero))
$$;

-- ---------- Funções chamadas pela tela ----------

-- Dados para o telefone do navegador se conectar. Só devolve o ramal da PRÓPRIA pessoa.
create or replace function public.telefonia_minhas_credenciais()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.telefonia_config;
  r public.telefonia_ramais;
  s text;
begin
  select * into c from public.telefonia_config where id = 1;
  r := interno.telefonia_meu_ramal();
  if r.id is null then
    return jsonb_build_object('situacao', 'sem_ramal', 'ligado', c.ligado);
  end if;
  if not c.ligado then
    return jsonb_build_object('situacao', 'desligado', 'ligado', false, 'ramal', r.ramal);
  end if;
  select senha into s from interno.telefonia_senhas where ramal_id = r.id;
  if c.wss_url is null or c.sip_dominio is null or s is null then
    return jsonb_build_object('situacao', 'incompleto', 'ligado', true, 'ramal', r.ramal);
  end if;
  return jsonb_build_object(
    'situacao', 'pronto', 'ligado', true,
    'wss_url', c.wss_url, 'dominio', c.sip_dominio,
    'ramal', r.ramal, 'nome', r.nome,
    'usuario', coalesce(r.sip_usuario, r.ramal), 'senha', s);
end $$;

-- Admin cadastra/troca a senha SIP de um ramal (a senha nunca volta para a tela)
create or replace function public.telefonia_definir_senha(p_ramal_id uuid, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not interno.tem_funcao('admin') then
    raise exception 'Só a administração cadastra senhas de ramal.' using errcode = '42501';
  end if;
  if p_senha is null or length(p_senha) = 0 then
    delete from interno.telefonia_senhas where ramal_id = p_ramal_id;
    update public.telefonia_ramais set senha_cadastrada = false where id = p_ramal_id;
    return;
  end if;
  insert into interno.telefonia_senhas (ramal_id, senha) values (p_ramal_id, p_senha)
  on conflict (ramal_id) do update set senha = excluded.senha, definida_em = now();
  update public.telefonia_ramais set senha_cadastrada = true where id = p_ramal_id;
  if not found then
    raise exception 'Ramal não encontrado.';
  end if;
end $$;

-- Quem está ligando: pacientes com esse número (pode ser mais de um: família) e o próximo horário
create or replace function public.telefonia_quem_ligou(p_numero text)
returns table (paciente_id uuid, nome text, nome_social text, numero_prontuario bigint,
               data_nascimento date, proximo_agendamento timestamptz)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.nome, p.nome_social, p.numero_prontuario, p.data_nascimento,
         (select min(a.inicio) from public.agendamentos a
           where a.paciente_id = p.id and a.inicio >= now()
             and a.status not in ('cancelado', 'faltou'))
  from public.pacientes p
  where p.ativo
    and interno.chave_telefone(p_numero) is not null
    and (interno.chave_telefone(p.telefone) = interno.chave_telefone(p_numero)
         or interno.chave_telefone(p.telefone_secundario) = interno.chave_telefone(p_numero)
         or interno.chave_telefone(p.responsavel_telefone) = interno.chave_telefone(p_numero))
  order by p.nome
  limit 10
$$;

-- Começo de uma ligação. Na entrada, várias atendentes tocam ao mesmo tempo: a ligação do
-- mesmo número nos últimos 2 minutos que ainda está tocando é reaproveitada (não duplica).
create or replace function public.telefonia_inicio(p_direcao text, p_numero text, p_sip_call_id text default null,
                                                   p_paciente_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r   public.telefonia_ramais;
  v   uuid;
  num text := regexp_replace(coalesce(p_numero, ''), '\D', '', 'g');
begin
  r := interno.telefonia_exige_ramal();
  if p_direcao not in ('entrada', 'saida') then raise exception 'Direção inválida.'; end if;
  if num = '' then num := 'desconhecido'; end if;

  if p_direcao = 'entrada' then
    select id into v from public.ligacoes
    where direcao = 'entrada' and situacao in ('tocando', 'perdida', 'em_andamento')
      and iniciada_em > now() - interval '2 minutes'
      and (sip_call_id = p_sip_call_id
           or (numero = num and situacao = 'tocando'))
    order by iniciada_em desc limit 1;
    if v is not null then return v; end if;
    insert into public.ligacoes (direcao, numero, paciente_id, sip_call_id)
    values ('entrada', num, interno.telefonia_paciente(num), p_sip_call_id)
    returning id into v;
  else
    insert into public.ligacoes (direcao, numero, paciente_id, situacao, profissional_id, ramal, sip_call_id)
    values ('saida', num, coalesce(p_paciente_id, interno.telefonia_paciente(num)), 'tocando',
            interno.profissional_atual(), r.ramal, p_sip_call_id)
    returning id into v;
    -- Ligou de volta para quem tinha ligado e ninguém atendeu
    update public.ligacoes set retornada_em = now(), retornada_por = interno.profissional_atual()
    where direcao = 'entrada' and situacao = 'perdida' and retornada_em is null
      and interno.chave_telefone(numero) = interno.chave_telefone(num)
      and iniciada_em > now() - interval '30 days';
  end if;
  return v;
end $$;

-- Alguém atendeu (entrada) ou o paciente atendeu (saída). Devolve false se outra atendente já pegou.
create or replace function public.telefonia_atendida(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.telefonia_ramais;
begin
  r := interno.telefonia_exige_ramal();
  update public.ligacoes
     set situacao = 'em_andamento', atendida_em = now(), encerrada_em = null,
         profissional_id = interno.profissional_atual(), ramal = r.ramal
   where id = p_id
     and (situacao = 'tocando'
          -- outra atendente pode ter marcado "perdida" um instante antes (a chamada parou de tocar nela)
          or (situacao = 'perdida' and encerrada_em > now() - interval '30 seconds')
          or (situacao = 'em_andamento' and profissional_id = interno.profissional_atual()));
  return found;
end $$;

-- Fim da ligação.
--  * quem estava falando encerra → 'atendida' (entrada) ou 'atendida' (saída)
--  * entrada que parou de tocar sem ninguém atender → 'perdida'
--  * saída que ninguém atendeu / deu erro → 'nao_atendida' / 'falhou'
create or replace function public.telefonia_fim(p_id uuid, p_motivo text default null, p_transferida_para text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.ligacoes;
begin
  perform interno.telefonia_exige_ramal();
  select * into l from public.ligacoes where id = p_id for update;
  if l.id is null then return; end if;

  if l.situacao = 'em_andamento' and l.profissional_id = interno.profissional_atual() then
    update public.ligacoes set situacao = 'atendida', encerrada_em = now(),
           transferida_para = coalesce(p_transferida_para, transferida_para)
     where id = p_id;
  elsif l.situacao = 'tocando' and l.direcao = 'entrada' then
    update public.ligacoes set situacao = 'perdida', encerrada_em = now() where id = p_id;
  elsif l.situacao = 'tocando' and l.direcao = 'saida' and l.profissional_id = interno.profissional_atual() then
    update public.ligacoes set situacao = case when p_motivo = 'falhou' then 'falhou' else 'nao_atendida' end,
           encerrada_em = now()
     where id = p_id;
  end if;
end $$;

-- Anotação sobre a ligação e ligação ao paciente certo (família com o mesmo número)
create or replace function public.telefonia_anotar(p_id uuid, p_observacao text default null, p_paciente_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform interno.telefonia_exige_ramal();
  update public.ligacoes
     set observacao  = coalesce(nullif(trim(p_observacao), ''), observacao),
         paciente_id = coalesce(p_paciente_id, paciente_id)
   where id = p_id;
end $$;

-- Marcar uma perdida como resolvida sem ligar (ex.: paciente mandou WhatsApp)
create or replace function public.telefonia_marcar_retornada(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not interno.tem_funcao('recepcao', 'admin') and interno.telefonia_meu_ramal() is null then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.ligacoes set retornada_em = now(), retornada_por = interno.profissional_atual()
   where id = p_id and situacao = 'perdida' and retornada_em is null;
end $$;

-- Ligação que ficou "tocando"/"em andamento" porque o navegador fechou no meio: encerra sozinha
create or replace function interno.telefonia_limpar_presas()
returns void language sql security definer set search_path = '' as $$
  update public.ligacoes set situacao = 'perdida', encerrada_em = iniciada_em + interval '1 minute'
   where situacao = 'tocando' and direcao = 'entrada' and iniciada_em < now() - interval '5 minutes';
  update public.ligacoes set situacao = 'nao_atendida', encerrada_em = iniciada_em + interval '1 minute'
   where situacao = 'tocando' and direcao = 'saida' and iniciada_em < now() - interval '5 minutes';
  update public.ligacoes set situacao = 'atendida', encerrada_em = coalesce(encerrada_em, atendida_em)
   where situacao = 'em_andamento' and atendida_em < now() - interval '4 hours';
$$;

-- ---------- Permissões das funções ----------
revoke execute on function interno.telefonia_meu_ramal() from public, anon;
revoke execute on function interno.telefonia_exige_ramal() from public, anon;
revoke execute on function interno.telefonia_paciente(text) from public, anon;
revoke execute on function interno.telefonia_limpar_presas() from public, anon, authenticated;
revoke execute on function interno.tg_telefonia_auditoria() from public, anon, authenticated;
grant execute on function interno.telefonia_meu_ramal() to authenticated;
grant execute on function interno.telefonia_exige_ramal() to authenticated;
grant execute on function interno.telefonia_paciente(text) to authenticated;

revoke execute on function public.telefonia_minhas_credenciais() from public, anon;
revoke execute on function public.telefonia_definir_senha(uuid, text) from public, anon;
revoke execute on function public.telefonia_quem_ligou(text) from public, anon;
revoke execute on function public.telefonia_inicio(text, text, text, uuid) from public, anon;
revoke execute on function public.telefonia_atendida(uuid) from public, anon;
revoke execute on function public.telefonia_fim(uuid, text, text) from public, anon;
revoke execute on function public.telefonia_anotar(uuid, text, uuid) from public, anon;
revoke execute on function public.telefonia_marcar_retornada(uuid) from public, anon;
grant execute on function public.telefonia_minhas_credenciais() to authenticated;
grant execute on function public.telefonia_definir_senha(uuid, text) to authenticated;
grant execute on function public.telefonia_quem_ligou(text) to authenticated;
grant execute on function public.telefonia_inicio(text, text, text, uuid) to authenticated;
grant execute on function public.telefonia_atendida(uuid) to authenticated;
grant execute on function public.telefonia_fim(uuid, text, text) to authenticated;
grant execute on function public.telefonia_anotar(uuid, text, uuid) to authenticated;
grant execute on function public.telefonia_marcar_retornada(uuid) to authenticated;

-- ---------- Segurança (RLS) ----------
alter table public.telefonia_config enable row level security;
alter table public.telefonia_ramais enable row level security;
alter table public.ligacoes enable row level security;
revoke all on public.telefonia_config, public.telefonia_ramais, public.ligacoes from anon;

-- Configuração: equipe lê; só admin altera (sem inserir/apagar: é uma linha só)
revoke insert, delete, truncate on public.telefonia_config from authenticated;
create policy equipe_le on public.telefonia_config for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
create policy admin_altera on public.telefonia_config for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));

-- Ramais: equipe lê (lista para transferir); só admin cria/altera/apaga.
-- senha_cadastrada só muda pela função telefonia_definir_senha.
revoke update on public.telefonia_ramais from authenticated;
grant update (nome, ramal, sip_usuario, profissional_id, ativo) on public.telefonia_ramais to authenticated;
create policy equipe_le on public.telefonia_ramais for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));
create policy admin_inclui on public.telefonia_ramais for insert to authenticated
  with check ((select interno.tem_funcao('admin')) and not senha_cadastrada);
create policy admin_altera on public.telefonia_ramais for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));
create policy admin_apaga on public.telefonia_ramais for delete to authenticated
  using ((select interno.tem_funcao('admin')));

-- Ligações: toda a equipe vê (mesma decisão do WhatsApp); ninguém grava direto, só pelas funções.
revoke insert, update, delete, truncate on public.ligacoes from authenticated;
create policy equipe_le on public.ligacoes for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')));

-- Ao vivo na tela de ligações (Realtime respeita o RLS)
alter publication supabase_realtime add table public.ligacoes;

-- Encerra ligações presas a cada 10 minutos (se o pg_cron existir, como na 0040)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('telefonia-limpar-presas', '*/10 * * * *', 'select interno.telefonia_limpar_presas()');
  end if;
end $$;
