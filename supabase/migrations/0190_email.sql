-- =====================================================================
-- 0190 — E-mail da clínica dentro do sistema (Google Workspace, domínio cmdolhos.com.br)
-- =====================================================================
--  Decisões da dona (25–27/11/2026, ver docs/sistema/HISTORICO.md):
--  * Uma conta do Google para a equipe (clinica@cmdolhos.com.br) com vários endereços
--    (apelidos). Cada endereço vira uma CAIXA no sistema.
--  * Cada caixa só é vista por quem tem acesso a ela; a administração vê todas.
--    Quem vê, também responde.
--  * A equipe lê, responde, encaminha e envia (com anexos) sem sair do sistema.
--  * Os e-mails ficam guardados aqui (Brasil). Quem grava são só as funções Edge
--    (`email`), com a chave de serviço. A equipe lê e marca lida/arquivada pelo sistema.
--  * Registro de quem leu (email_leituras) e de quem enviou (email_mensagens.enviado_por).
--  * Segredos (Client ID/Secret do Google e o token de acesso) ficam em interno.email_google,
--    fora da API; a admin digita na tela Cadastros → E-mail; nunca voltam para a tela.
-- =====================================================================

-- ---------- Caixas ----------
create table public.email_caixas (
  id               uuid primary key default gen_random_uuid(),
  endereco         text not null unique check (endereco = lower(endereco) and endereco ~ '^[a-z0-9._-]+@[a-z0-9.-]+$'),
  nome             text not null,
  descricao        text,
  tipo             text not null default 'setor' check (tipo in ('setor', 'medico', 'geral')),
  profissional_id  uuid references public.profissionais(id),          -- caixa de médico: o dono
  funcoes          public.funcao_profissional[] not null default '{}', -- todos dessa função têm acesso (ex.: recepção)
  assinatura       text,
  ordem            int not null default 100,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now()
);
comment on table public.email_caixas is 'Caixas de e-mail (endereços @cmdolhos.com.br). Quem acessa: email_caixa_acesso, funcoes, o médico dono e a admin.';
create index email_caixas_profissional_idx on public.email_caixas (profissional_id);

create table public.email_caixa_acesso (
  caixa_id         uuid not null references public.email_caixas(id) on delete cascade,
  profissional_id  uuid not null references public.profissionais(id) on delete cascade,
  primary key (caixa_id, profissional_id)
);
create index email_caixa_acesso_prof_idx on public.email_caixa_acesso (profissional_id);
comment on table public.email_caixa_acesso is 'Quem da equipe vê e responde cada caixa de e-mail.';

-- Quem pode ver esta caixa?
create or replace function interno.email_pode_caixa(p_caixa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select interno.tem_funcao('admin') or exists (
    select 1 from public.email_caixas c
      join public.profissionais p on p.id = interno.profissional_atual()
     where c.id = p_caixa and c.ativo and (
       c.profissional_id = p.id
       or p.funcao = any(c.funcoes)
       or exists (select 1 from public.email_caixa_acesso a where a.caixa_id = c.id and a.profissional_id = p.id)))
$$;
revoke execute on function interno.email_pode_caixa(uuid) from public, anon;
grant execute on function interno.email_pode_caixa(uuid) to authenticated, service_role;

-- ---------- Conversas e mensagens ----------
create table public.email_conversas (
  id                  uuid primary key default gen_random_uuid(),
  caixa_id            uuid not null references public.email_caixas(id),
  gmail_thread_id     text not null,
  assunto             text,
  contato             text,            -- com quem é a conversa (nome <e-mail>) — o último que escreveu de fora
  previa              text,
  ultima_mensagem_em  timestamptz,
  ultima_recebida_em  timestamptz,
  ultima_enviada_em   timestamptz,
  nao_lida            boolean not null default true,
  arquivada           boolean not null default false,
  responsavel_id      uuid references public.profissionais(id),
  qtd_mensagens       int not null default 0,
  tem_anexo           boolean not null default false,
  criado_em           timestamptz not null default now(),
  unique (caixa_id, gmail_thread_id)
);
create index email_conversas_caixa_idx on public.email_conversas (caixa_id, arquivada, ultima_mensagem_em desc nulls last);
create index email_conversas_responsavel_idx on public.email_conversas (responsavel_id);

create table public.email_mensagens (
  id            uuid primary key default gen_random_uuid(),
  conversa_id   uuid not null references public.email_conversas(id) on delete cascade,
  gmail_id      text not null,
  direcao       text not null check (direcao in ('recebida', 'enviada')),
  de            text,
  para          text,
  cc            text,
  assunto       text,
  texto         text,          -- corpo em texto simples
  html          text,          -- corpo em HTML (mostrado numa moldura isolada, sem scripts)
  message_id    text,          -- cabeçalho Message-ID (para responder no mesmo fio)
  referencias   text,
  anexos        jsonb not null default '[]',  -- [{nome, tipo, tamanho, gmail_anexo_id, caminho?}]
  quando        timestamptz not null default now(),
  enviado_por   uuid references public.profissionais(id),
  criado_em     timestamptz not null default now(),
  unique (conversa_id, gmail_id)
);
create index email_mensagens_conversa_idx on public.email_mensagens (conversa_id, quando);
create index email_mensagens_enviado_por_idx on public.email_mensagens (enviado_por);
comment on table public.email_mensagens is 'E-mails recebidos e enviados. Gravados só pela função Edge `email`.';

create table public.email_leituras (
  conversa_id      uuid not null references public.email_conversas(id) on delete cascade,
  profissional_id  uuid not null references public.profissionais(id),
  lida_em          timestamptz not null default now(),
  primary key (conversa_id, profissional_id)
);
create index email_leituras_prof_idx on public.email_leituras (profissional_id);
comment on table public.email_leituras is 'Quem abriu cada conversa de e-mail e quando (última vez).';

-- ---------- Conexão com o Google (fora da API) ----------
create table interno.email_google (
  id               int primary key default 1 check (id = 1),
  client_id        text,
  client_secret    text,
  refresh_token    text,
  conta            text,          -- e-mail da conta conectada (clinica@…)
  estado_oauth     text,          -- valor aleatório do pedido de conexão em andamento
  estado_oauth_em  timestamptz,
  historico_id     text,          -- ponto em que a sincronização parou (historyId do Gmail)
  ultima_sinc      timestamptz,
  ultimo_erro      text
);
insert into interno.email_google (id) values (1);
revoke all on interno.email_google from public, anon, authenticated;
grant select, update on interno.email_google to service_role;

-- Situação da conexão (sem segredos) — para a tela
create or replace function public.email_situacao()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'credenciais', coalesce(g.client_id, '') <> '' and coalesce(g.client_secret, '') <> '',
    'conectado', coalesce(g.refresh_token, '') <> '',
    'conta', g.conta, 'ultima_sinc', g.ultima_sinc,
    'ultimo_erro', case when interno.tem_funcao('admin') then g.ultimo_erro end)
  from interno.email_google g where g.id = 1
$$;
revoke execute on function public.email_situacao() from public, anon;
grant execute on function public.email_situacao() to authenticated;

-- Admin cadastra o Client ID / Client Secret do Google (nunca voltam para a tela)
create or replace function public.email_definir_credenciais(p_client_id text, p_client_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not interno.tem_funcao('admin') then
    raise exception 'Só a administração configura o e-mail.' using errcode = '42501';
  end if;
  update interno.email_google set
    client_id = coalesce(nullif(trim(p_client_id), ''), client_id),
    client_secret = coalesce(nullif(trim(p_client_secret), ''), client_secret)
  where id = 1;
end $$;
revoke execute on function public.email_definir_credenciais(text, text) from public, anon;
grant execute on function public.email_definir_credenciais(text, text) to authenticated;

-- ---------- Regras de acesso (RLS) ----------
alter table public.email_caixas enable row level security;
alter table public.email_caixa_acesso enable row level security;
alter table public.email_conversas enable row level security;
alter table public.email_mensagens enable row level security;
alter table public.email_leituras enable row level security;

create policy ve_suas on public.email_caixas for select to authenticated
  using (interno.email_pode_caixa(id));
create policy admin_altera on public.email_caixas for all to authenticated
  using (interno.tem_funcao('admin')) with check (interno.tem_funcao('admin'));

create policy ve_acessos on public.email_caixa_acesso for select to authenticated
  using (interno.tem_funcao('admin') or profissional_id = interno.profissional_atual());
create policy admin_altera on public.email_caixa_acesso for all to authenticated
  using (interno.tem_funcao('admin')) with check (interno.tem_funcao('admin'));

create policy ve_da_caixa on public.email_conversas for select to authenticated
  using (interno.email_pode_caixa(caixa_id));
create policy ve_da_caixa on public.email_mensagens for select to authenticated
  using (exists (select 1 from public.email_conversas c where c.id = conversa_id and interno.email_pode_caixa(c.caixa_id)));
create policy ve_da_caixa on public.email_leituras for select to authenticated
  using (exists (select 1 from public.email_conversas c where c.id = conversa_id and interno.email_pode_caixa(c.caixa_id)));

grant select on public.email_caixas, public.email_caixa_acesso, public.email_conversas,
  public.email_mensagens, public.email_leituras to authenticated;
grant insert, update, delete on public.email_caixas, public.email_caixa_acesso to authenticated;

-- ---------- Ações da equipe ----------
-- Abriu a conversa: marca como lida e registra quem leu
create or replace function public.email_marcar_lida(p_conversa uuid, p_lida boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_caixa uuid; v_eu uuid := interno.profissional_atual();
begin
  select caixa_id into v_caixa from public.email_conversas where id = p_conversa;
  if v_caixa is null or not interno.email_pode_caixa(v_caixa) then
    raise exception 'Você não tem acesso a esta caixa de e-mail.' using errcode = '42501';
  end if;
  update public.email_conversas set nao_lida = not p_lida where id = p_conversa;
  if p_lida and v_eu is not null then
    insert into public.email_leituras (conversa_id, profissional_id) values (p_conversa, v_eu)
    on conflict (conversa_id, profissional_id) do update set lida_em = now();
  end if;
end $$;

create or replace function public.email_arquivar(p_conversa uuid, p_arquivar boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_caixa uuid;
begin
  select caixa_id into v_caixa from public.email_conversas where id = p_conversa;
  if v_caixa is null or not interno.email_pode_caixa(v_caixa) then
    raise exception 'Você não tem acesso a esta caixa de e-mail.' using errcode = '42501';
  end if;
  update public.email_conversas set arquivada = p_arquivar where id = p_conversa;
end $$;

-- "Quem está cuidando" (null = ninguém)
create or replace function public.email_responsavel(p_conversa uuid, p_profissional uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_caixa uuid;
begin
  select caixa_id into v_caixa from public.email_conversas where id = p_conversa;
  if v_caixa is null or not interno.email_pode_caixa(v_caixa) then
    raise exception 'Você não tem acesso a esta caixa de e-mail.' using errcode = '42501';
  end if;
  update public.email_conversas set responsavel_id = p_profissional where id = p_conversa;
end $$;

-- Quantas conversas não lidas em cada caixa que eu vejo
create or replace function public.email_contagem()
returns table (caixa_id uuid, nao_lidas bigint, sem_resposta bigint)
language sql stable security definer set search_path = '' as $$
  select c.id,
         count(v.id) filter (where v.nao_lida and not v.arquivada),
         count(v.id) filter (where not v.arquivada and v.ultima_recebida_em is not null
                               and v.ultima_recebida_em < now() - interval '2 days'
                               and (v.ultima_enviada_em is null or v.ultima_enviada_em < v.ultima_recebida_em))
    from public.email_caixas c
    left join public.email_conversas v on v.caixa_id = c.id
   where c.ativo and interno.email_pode_caixa(c.id)
   group by c.id
$$;

revoke execute on function public.email_marcar_lida(uuid, boolean), public.email_arquivar(uuid, boolean),
  public.email_responsavel(uuid, uuid), public.email_contagem() from public, anon;
grant execute on function public.email_marcar_lida(uuid, boolean), public.email_arquivar(uuid, boolean),
  public.email_responsavel(uuid, uuid), public.email_contagem() to authenticated;

-- ---------- Anexos (bucket privado; só a função Edge lê e grava) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('email-anexos', 'email-anexos', false, 52428800)
on conflict (id) do nothing;

-- ---------- Sincronização automática (a cada 2 minutos, só quando conectado) ----------
create or replace function interno.chamar_email(p_corpo jsonb)
returns void language sql security definer set search_path = '' as $$
  select null::void from (
    select net.http_post(
      url := 'https://ogflxjolbwrzayjtxvhj.supabase.co/functions/v1/email',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-extrator-chave', (select chave from interno.extrator_chave where id = 1)),
      body := p_corpo,
      timeout_milliseconds := 60000)
  ) x
$$;
revoke execute on function interno.chamar_email(jsonb) from public, anon, authenticated;

select cron.schedule(
  'email-sincronizar',
  '*/2 * * * *',
  $cron$
  select interno.chamar_email('{"acao":"sincronizar"}'::jsonb)
  where exists (select 1 from interno.email_google where id = 1 and coalesce(refresh_token, '') <> '');
  $cron$
);

-- ---------- Caixas combinadas com a dona (27/11/2026) ----------
insert into public.email_caixas (endereco, nome, descricao, tipo, ordem, funcoes) values
  ('faturamento@cmdolhos.com.br',       'Faturamento',         'Convênios: autorizações, guias, glosas', 'setor', 10, '{}'),
  ('financeiro@cmdolhos.com.br',        'Financeiro',          'Contas a pagar: boletos, notas fiscais, fornecedores e insumos', 'setor', 20, '{}'),
  ('centrocirurgico@cmdolhos.com.br',   'Centro cirúrgico',    'Cirurgias, orientação cirúrgica e centro cirúrgico', 'setor', 30, '{}'),
  ('exames@cmdolhos.com.br',            'Exames',              'Exames e laudos', 'setor', 40, '{}'),
  ('centraldemarcacao@cmdolhos.com.br', 'Central de marcação', 'Marcação de consultas', 'setor', 50, '{}'),
  ('contato@cmdolhos.com.br',           'Contato',             'Pacientes, público e formulário do site', 'setor', 60, '{}'),
  ('marketing@cmdolhos.com.br',         'Marketing',           'Instagram e avaliações do Google', 'setor', 70, '{}'),
  ('recepcao@cmdolhos.com.br',          'Recepção',            'Recepção em geral', 'setor', 80, '{recepcao}'),
  ('clinica@cmdolhos.com.br',           'Geral (clinica@)',    'E-mails enviados direto para a conta da equipe ou sem caixa definida — só a administração', 'geral', 200, '{}');

-- Médicos: cada um vê só a sua
insert into public.email_caixas (endereco, nome, tipo, ordem, profissional_id)
select v.endereco, v.nome, 'medico', 100 + v.n,
       (select p.id from public.profissionais p where p.funcao = 'medico' and p.ativo and p.nome ilike v.busca order by p.criado_em limit 1)
  from (values (1, 'dr.gelson@cmdolhos.com.br',  'Dr. Gelson',  'Gelson %'),
               (2, 'dr.gisele@cmdolhos.com.br',  'Dra. Gisele', 'Gisele %'),
               (3, 'dr.luiza@cmdolhos.com.br',   'Dra. Luiza',  'Luiza %'),
               (4, 'dr.matheus@cmdolhos.com.br', 'Dr. Matheus', 'Matheus %'),
               (5, 'dr.max@cmdolhos.com.br',     'Dr. Max',     'Max %'),
               (6, 'dr.pedro@cmdolhos.com.br',   'Dr. Pedro',   'Pedro %'),
               (7, 'dr.renato@cmdolhos.com.br',  'Dr. Renato',  'Renato %')) v(n, endereco, nome, busca);

-- Quem acessa cada caixa de setor
insert into public.email_caixa_acesso (caixa_id, profissional_id)
select c.id, p.id
  from (values ('faturamento@cmdolhos.com.br', 'Andrea Camilo%'),
               ('faturamento@cmdolhos.com.br', 'Soraline%'),
               ('financeiro@cmdolhos.com.br', 'Luciano Campino%'),
               ('financeiro@cmdolhos.com.br', 'Soraline%'),
               ('centrocirurgico@cmdolhos.com.br', 'Alessandra Galter%'),
               ('centrocirurgico@cmdolhos.com.br', 'Andrea Camilo%'),
               ('centrocirurgico@cmdolhos.com.br', 'Luciano Campino%'),
               ('centrocirurgico@cmdolhos.com.br', 'Soraline%'),
               ('centrocirurgico@cmdolhos.com.br', 'Guilherme Pontes%'),
               ('exames@cmdolhos.com.br', 'Juliany%'),
               ('exames@cmdolhos.com.br', 'Guilherme Pontes%'),
               ('centraldemarcacao@cmdolhos.com.br', 'Isabelle%'),
               ('centraldemarcacao@cmdolhos.com.br', 'Ingrid%'),
               ('contato@cmdolhos.com.br', 'Andrea Camilo%'),
               ('contato@cmdolhos.com.br', 'Soraline%'),
               ('marketing@cmdolhos.com.br', 'Andrea Camilo%')) v(endereco, busca)
  join public.email_caixas c on c.endereco = v.endereco
  join lateral (select id from public.profissionais where ativo and nome ilike v.busca order by criado_em limit 1) p on true
on conflict do nothing;

-- ---------- Leitura/gravação da conexão pela função Edge (só a chave de serviço) ----------
create or replace function public.email_google_ler()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(g) from interno.email_google g where g.id = 1
$$;
create or replace function public.email_google_gravar(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update interno.email_google set
    refresh_token   = case when p ? 'refresh_token'   then p->>'refresh_token'   else refresh_token end,
    conta           = case when p ? 'conta'           then p->>'conta'           else conta end,
    estado_oauth    = case when p ? 'estado_oauth'    then p->>'estado_oauth'    else estado_oauth end,
    estado_oauth_em = case when p ? 'estado_oauth'    then now()                 else estado_oauth_em end,
    historico_id    = case when p ? 'historico_id'    then p->>'historico_id'    else historico_id end,
    ultima_sinc     = case when p ? 'ultima_sinc'     then (p->>'ultima_sinc')::timestamptz else ultima_sinc end,
    ultimo_erro     = case when p ? 'ultimo_erro'     then p->>'ultimo_erro'     else ultimo_erro end
  where id = 1;
end $$;
revoke execute on function public.email_google_ler(), public.email_google_gravar(jsonb) from public, anon, authenticated;
grant execute on function public.email_google_ler(), public.email_google_gravar(jsonb) to service_role;
