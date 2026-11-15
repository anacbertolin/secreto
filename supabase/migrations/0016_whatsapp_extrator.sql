-- =====================================================================
-- 0016 — Extrator do WhatsApp (assistente que lê as conversas)
-- =====================================================================
-- Depois que uma conversa "esfria" (alguns minutos sem mensagem nova), a
-- função Edge `whatsapp-extrator` lê o trecho novo e faz 3 coisas:
--   1. AGENDA: encontra pedidos de consulta/exame. Se a data, a hora e o
--      médico foram combinados na conversa e o horário está livre, marca
--      sozinho na agenda; senão, deixa um pedido para a recepção resolver.
--   2. QUALIDADE: dá notas ao atendimento (cordialidade, clareza,
--      resolução) e mede o tempo de resposta.
--   3. ROBÔ: monta a base de conhecimento (perguntas frequentes, como a
--      equipe responde, o que faltou saber) para um futuro robô.
--
-- Nasce DESLIGADO (`whatsapp_extrator_config.ligado = false`). A admin liga
-- na tela "Assistente do WhatsApp" depois de cadastrar a chave da IA.
-- Quem grava: só a função Edge (chave de serviço). A equipe só lê/decide.
--   * Pedidos de agendamento ........ recepção e admin (leem e resolvem)
--   * Análises (resumo da conversa) .. recepção e admin
--   * Avaliações de qualidade ........ só admin (avalia funcionários)
--   * Base de conhecimento do robô ... recepção e admin leem; admin aprova
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------- Configuração (uma linha só) ----------
create table public.whatsapp_extrator_config (
  id                        int primary key default 1 check (id = 1),
  ligado                    boolean not null default false,
  agendar_automatico        boolean not null default true,
  criar_paciente_automatico boolean not null default true,
  confianca_minima          numeric(3,2) not null default 0.85 check (confianca_minima between 0.5 and 1),
  silencio_minutos          int not null default 20 check (silencio_minutos between 5 and 240),
  modelo                    text not null default 'claude-opus-5-5',
  atualizado_por            uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now()
);
comment on table public.whatsapp_extrator_config is 'Liga/desliga o assistente que lê as conversas do WhatsApp. Só a admin altera.';
insert into public.whatsapp_extrator_config (id) values (1);

-- Chave interna que o agendador (pg_cron) usa para chamar a função Edge.
-- Gerada aqui dentro do banco; ninguém da equipe lê.
create table interno.extrator_chave (
  id    int primary key default 1 check (id = 1),
  chave text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into interno.extrator_chave (id) values (1);
revoke all on interno.extrator_chave from public, anon, authenticated;
grant select on interno.extrator_chave to service_role;

-- ---------- Até onde cada conversa já foi lida ----------
create table public.whatsapp_extrator_estado (
  conversa_id        uuid primary key references public.whatsapp_conversas(id),
  analisado_ate      timestamptz,
  em_processo_desde  timestamptz,
  tentativas         int not null default 0,
  ultimo_erro        text,
  atualizado_em      timestamptz not null default now()
);
comment on table public.whatsapp_extrator_estado is 'Controle interno do extrator: até que mensagem cada conversa já foi analisada.';

-- ---------- Análise de cada trecho de conversa ----------
create table public.whatsapp_analises (
  id                 uuid primary key default gen_random_uuid(),
  conversa_id        uuid not null references public.whatsapp_conversas(id),
  paciente_id        uuid references public.pacientes(id),
  de                 timestamptz not null,
  ate                timestamptz not null,
  mensagens          int not null,
  intencao_principal text,
  intencoes          text[] not null default '{}',
  resumo             text,
  bot_resolveria     text check (bot_resolveria in ('sim', 'parcial', 'nao')),
  bot_motivo         text,
  modelo             text,
  tokens_entrada     int,
  tokens_saida       int,
  resultado          jsonb,
  criado_em          timestamptz not null default now()
);
create index whatsapp_analises_conversa_idx on public.whatsapp_analises (conversa_id, ate desc);
create index whatsapp_analises_paciente_idx on public.whatsapp_analises (paciente_id);
create index whatsapp_analises_criado_idx on public.whatsapp_analises (criado_em desc);
comment on table public.whatsapp_analises is 'O que o assistente entendeu de cada trecho de conversa do WhatsApp.';

-- ---------- Pedidos de agendamento encontrados nas conversas ----------
create table public.whatsapp_pedidos_agendamento (
  id                    uuid primary key default gen_random_uuid(),
  analise_id            uuid not null references public.whatsapp_analises(id),
  conversa_id           uuid not null references public.whatsapp_conversas(id),
  paciente_id           uuid references public.pacientes(id),
  acao                  text not null check (acao in ('agendar', 'remarcar', 'cancelar')),
  nome_informado        text,
  nascimento_informado  date,
  tipo                  public.tipo_agendamento not null default 'consulta',
  exame_ou_procedimento text,
  profissional_id       uuid references public.profissionais(id),
  profissional_citado   text,
  convenio_id           uuid references public.convenios(id),
  convenio_citado       text,
  particular            boolean not null default false,
  inicio                timestamptz,
  preferencia           text,
  primeira_vez          boolean,
  agendamento_existente uuid references public.agendamentos(id),
  acordo_fechado        boolean not null default false,
  confianca             numeric(3,2),
  evidencia             text,
  situacao              text not null default 'pendente'
                        check (situacao in ('pendente', 'agendado_auto', 'resolvido', 'descartado')),
  motivo                text,
  agendamento_id        uuid references public.agendamentos(id),
  resolvido_por         uuid references public.profissionais(id),
  resolvido_em          timestamptz,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
create index whatsapp_pedidos_situacao_idx on public.whatsapp_pedidos_agendamento (situacao, criado_em desc);
create index whatsapp_pedidos_analise_idx on public.whatsapp_pedidos_agendamento (analise_id);
create index whatsapp_pedidos_conversa_idx on public.whatsapp_pedidos_agendamento (conversa_id);
create index whatsapp_pedidos_paciente_idx on public.whatsapp_pedidos_agendamento (paciente_id);
create index whatsapp_pedidos_profissional_idx on public.whatsapp_pedidos_agendamento (profissional_id);
create index whatsapp_pedidos_convenio_idx on public.whatsapp_pedidos_agendamento (convenio_id);
create index whatsapp_pedidos_ag_existente_idx on public.whatsapp_pedidos_agendamento (agendamento_existente);
create index whatsapp_pedidos_agendamento_idx on public.whatsapp_pedidos_agendamento (agendamento_id);
create index whatsapp_pedidos_resolvido_por_idx on public.whatsapp_pedidos_agendamento (resolvido_por);
comment on table public.whatsapp_pedidos_agendamento is 'Pedidos de marcação/remarcação/cancelamento achados nas conversas. Os seguros viram agendamento sozinhos; o resto fica para a recepção.';

-- Quem resolve um pedido fica registrado
create or replace function interno.tg_pedido_resolvido()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.situacao is distinct from old.situacao and new.situacao in ('resolvido', 'descartado') then
    new.resolvido_em := now();
    new.resolvido_por := coalesce(interno.profissional_atual(), new.resolvido_por);
  end if;
  return new;
end $$;
create trigger pedido_resolvido before update on public.whatsapp_pedidos_agendamento
  for each row execute function interno.tg_pedido_resolvido();

-- ---------- Avaliação da qualidade do atendimento ----------
create table public.whatsapp_avaliacoes (
  id                   uuid primary key default gen_random_uuid(),
  analise_id           uuid not null unique references public.whatsapp_analises(id),
  conversa_id          uuid not null references public.whatsapp_conversas(id),
  atendentes           uuid[] not null default '{}',
  primeira_resposta_seg int,
  resposta_media_seg   int,
  maior_espera_seg     int,
  sem_resposta         boolean not null default false,
  nota_geral           numeric(3,1),
  cordialidade         numeric(3,1),
  clareza              numeric(3,1),
  resolutividade       numeric(3,1),
  informacao_correta   numeric(3,1),
  resolvido            boolean,
  pontos_positivos     text[] not null default '{}',
  pontos_melhorar      text[] not null default '{}',
  sugestao             text,
  criado_em            timestamptz not null default now()
);
create index whatsapp_avaliacoes_conversa_idx on public.whatsapp_avaliacoes (conversa_id);
create index whatsapp_avaliacoes_criado_idx on public.whatsapp_avaliacoes (criado_em desc);
comment on table public.whatsapp_avaliacoes is 'Notas do atendimento por WhatsApp (feitas pelo assistente). Só a administração vê.';

-- ---------- Base de conhecimento para o futuro robô ----------
create table public.bot_conhecimento (
  id                uuid primary key default gen_random_uuid(),
  categoria         text not null check (categoria in (
                      'agendamento', 'convenios', 'precos_pagamento', 'endereco_horarios', 'exames_preparo',
                      'resultados_laudos', 'receitas_documentos', 'cirurgias_procedimentos', 'pos_operatorio',
                      'sintomas_urgencia', 'outros')),
  pergunta          text not null,
  exemplos          text[] not null default '{}',
  resposta_equipe   text,
  resposta_aprovada text,
  precisa_humano    boolean not null default false,
  lacunas           int not null default 0,
  vezes             int not null default 1,
  ultima_vez        timestamptz not null default now(),
  situacao          text not null default 'sugerida' check (situacao in ('sugerida', 'aprovada', 'descartada')),
  aprovado_por      uuid references public.profissionais(id),
  aprovado_em       timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index bot_conhecimento_categoria_idx on public.bot_conhecimento (categoria, vezes desc);
create index bot_conhecimento_aprovado_por_idx on public.bot_conhecimento (aprovado_por);
comment on table public.bot_conhecimento is 'Perguntas frequentes dos pacientes no WhatsApp e a resposta que o futuro robô deve dar (aprovada pela admin). Exemplos sem nomes nem números.';

create or replace function interno.tg_bot_aprovado()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.situacao = 'aprovada' and old.situacao is distinct from 'aprovada' then
    new.aprovado_em := now();
    new.aprovado_por := coalesce(interno.profissional_atual(), new.aprovado_por);
  end if;
  return new;
end $$;
create trigger bot_aprovado before update on public.bot_conhecimento
  for each row execute function interno.tg_bot_aprovado();

-- Registra (ou soma) uma pergunta vista numa conversa. Só a função Edge chama.
create or replace function public.bot_conhecimento_registrar(
  p_id uuid, p_categoria text, p_pergunta text, p_exemplo text,
  p_resposta text, p_precisa_humano boolean, p_lacuna boolean, p_quando timestamptz)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if p_id is not null then
    update public.bot_conhecimento
       set vezes = vezes + 1,
           ultima_vez = greatest(ultima_vez, p_quando),
           lacunas = lacunas + case when p_lacuna then 1 else 0 end,
           precisa_humano = precisa_humano or coalesce(p_precisa_humano, false),
           resposta_equipe = coalesce(nullif(p_resposta, ''), resposta_equipe),
           exemplos = (case when p_exemplo is null or p_exemplo = '' or p_exemplo = any(exemplos) then exemplos
                            else (array_append(exemplos, p_exemplo))[greatest(1, cardinality(exemplos) - 8):] end)
     where id = p_id
     returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.bot_conhecimento (categoria, pergunta, exemplos, resposta_equipe, precisa_humano, lacunas, ultima_vez)
  values (p_categoria, p_pergunta,
          case when coalesce(p_exemplo, '') = '' then '{}' else array[p_exemplo] end,
          nullif(p_resposta, ''), coalesce(p_precisa_humano, false),
          case when p_lacuna then 1 else 0 end, p_quando)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Fila de trabalho do extrator (só a função Edge) ----------
-- Pega conversas com mensagem nova, paradas há `p_silencio` minutos, e marca como "em processo".
create or replace function public.whatsapp_extrator_pegar(p_limite int, p_silencio int, p_conversa uuid default null)
returns table (conversa_id uuid, analisado_ate timestamptz)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
begin
  insert into public.whatsapp_extrator_estado (conversa_id)
  select c.id from public.whatsapp_conversas c
  where c.ultima_mensagem_em is not null and (p_conversa is null or c.id = p_conversa)
  on conflict do nothing;

  return query
  with escolhidas as (
    select e.conversa_id as cid
      from public.whatsapp_extrator_estado e
      join public.whatsapp_conversas c on c.id = e.conversa_id
     where ((p_conversa is not null and e.conversa_id = p_conversa)
            or (p_conversa is null
                and c.ultima_mensagem_em > coalesce(e.analisado_ate, '-infinity'::timestamptz)
                and c.ultima_mensagem_em <= now() - make_interval(mins => p_silencio)
                and e.tentativas < 5))
       and (e.em_processo_desde is null or e.em_processo_desde < now() - interval '15 minutes')
     order by c.ultima_mensagem_em
     limit p_limite
     for update of e skip locked
  ), marcadas as (
    update public.whatsapp_extrator_estado e
       set em_processo_desde = now(), atualizado_em = now()
      from escolhidas x
     where e.conversa_id = x.cid
    returning e.conversa_id as cid, e.analisado_ate as ate
  )
  select m.cid, m.ate from marcadas m;
end $$;

-- Pacientes ativos que usam este número (para achar quem é quem numa família)
create or replace function public.whatsapp_extrator_pacientes_do_numero(p_telefone text)
returns table (id uuid, nome text, nome_social text, data_nascimento date, convenio_id uuid, plano_id uuid)
language sql stable set search_path = '' as $$
  select p.id, p.nome, p.nome_social, p.data_nascimento, p.convenio_id, p.plano_id
    from public.pacientes p
   where p.ativo
     and interno.chave_telefone(p_telefone) is not null
     and (interno.chave_telefone(p.telefone) = interno.chave_telefone(p_telefone)
          or interno.chave_telefone(p.telefone_secundario) = interno.chave_telefone(p_telefone))
   limit 20
$$;

-- Confere a chave do agendador
create or replace function public.whatsapp_extrator_chave_ok(p_chave text)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(p_chave, '') <> '' and exists (select 1 from interno.extrator_chave where chave = p_chave)
$$;

-- Há trabalho? (o agendador só chama a função Edge quando precisa)
create or replace function interno.extrator_tem_trabalho()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select ligado from public.whatsapp_extrator_config where id = 1), false)
     and exists (
       select 1 from public.whatsapp_conversas c
         left join public.whatsapp_extrator_estado e on e.conversa_id = c.id
        where c.ultima_mensagem_em > coalesce(e.analisado_ate, '-infinity'::timestamptz)
          and c.ultima_mensagem_em <= now() - make_interval(mins => (select silencio_minutos from public.whatsapp_extrator_config where id = 1))
          and coalesce(e.tentativas, 0) < 5
          and (e.em_processo_desde is null or e.em_processo_desde < now() - interval '15 minutes'))
$$;

-- ---------- Resumos para as telas (respeitam o RLS de quem consulta) ----------
create view public.bot_prontidao with (security_invoker = true) as
select categoria,
       count(*) filter (where situacao <> 'descartada')                     as perguntas,
       count(*) filter (where situacao = 'aprovada')                         as aprovadas,
       coalesce(sum(vezes) filter (where situacao <> 'descartada'), 0)       as vezes,
       coalesce(sum(lacunas) filter (where situacao <> 'descartada'), 0)     as lacunas,
       count(*) filter (where precisa_humano and situacao <> 'descartada')   as precisam_humano
  from public.bot_conhecimento
 group by categoria;

-- ---------- Permissões ----------
alter table public.whatsapp_extrator_config     enable row level security;
alter table public.whatsapp_extrator_estado     enable row level security;
alter table public.whatsapp_analises            enable row level security;
alter table public.whatsapp_pedidos_agendamento enable row level security;
alter table public.whatsapp_avaliacoes          enable row level security;
alter table public.bot_conhecimento             enable row level security;

revoke all on public.whatsapp_extrator_config, public.whatsapp_extrator_estado, public.whatsapp_analises,
              public.whatsapp_pedidos_agendamento, public.whatsapp_avaliacoes, public.bot_conhecimento,
              public.bot_prontidao
  from anon;
revoke insert, update, delete, truncate on public.whatsapp_extrator_config, public.whatsapp_extrator_estado,
              public.whatsapp_analises, public.whatsapp_pedidos_agendamento, public.whatsapp_avaliacoes,
              public.bot_conhecimento
  from authenticated;
grant select on public.whatsapp_extrator_config, public.whatsapp_extrator_estado, public.whatsapp_analises,
                public.whatsapp_pedidos_agendamento, public.whatsapp_avaliacoes, public.bot_conhecimento,
                public.bot_prontidao
  to authenticated;
grant update (ligado, agendar_automatico, criar_paciente_automatico, confianca_minima, silencio_minutos)
  on public.whatsapp_extrator_config to authenticated;
grant update (situacao, agendamento_id, motivo) on public.whatsapp_pedidos_agendamento to authenticated;
grant update (categoria, pergunta, resposta_aprovada, precisa_humano, situacao) on public.bot_conhecimento to authenticated;

create policy admin_le on public.whatsapp_extrator_config for select to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin')));
create policy admin_altera on public.whatsapp_extrator_config for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));

create policy admin_le on public.whatsapp_extrator_estado for select to authenticated
  using ((select interno.tem_funcao('admin')));

create policy recepcao_admin_le on public.whatsapp_analises for select to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin')));

create policy recepcao_admin_le on public.whatsapp_pedidos_agendamento for select to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin')));
create policy recepcao_admin_altera on public.whatsapp_pedidos_agendamento for update to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin'))) with check ((select interno.tem_funcao('recepcao', 'admin')));

create policy admin_le on public.whatsapp_avaliacoes for select to authenticated
  using ((select interno.tem_funcao('admin')));

create policy recepcao_admin_le on public.bot_conhecimento for select to authenticated
  using ((select interno.tem_funcao('recepcao', 'admin')));
create policy admin_altera on public.bot_conhecimento for update to authenticated
  using ((select interno.tem_funcao('admin'))) with check ((select interno.tem_funcao('admin')));

-- Funções: só a chave de serviço
revoke execute on function public.bot_conhecimento_registrar(uuid, text, text, text, text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke execute on function public.whatsapp_extrator_pegar(int, int, uuid) from public, anon, authenticated;
revoke execute on function public.whatsapp_extrator_pacientes_do_numero(text) from public, anon, authenticated;
revoke execute on function public.whatsapp_extrator_chave_ok(text) from public, anon, authenticated;
grant execute on function public.bot_conhecimento_registrar(uuid, text, text, text, text, boolean, boolean, timestamptz) to service_role;
grant execute on function public.whatsapp_extrator_pegar(int, int, uuid) to service_role;
grant execute on function public.whatsapp_extrator_pacientes_do_numero(text) to service_role;
grant execute on function public.whatsapp_extrator_chave_ok(text) to service_role;
revoke execute on function interno.extrator_tem_trabalho() from public, anon, authenticated;
revoke execute on function interno.tg_pedido_resolvido() from public, anon;
revoke execute on function interno.tg_bot_aprovado() from public, anon;

-- ---------- Gatilhos de data e auditoria ----------
do $$
declare t text;
begin
  foreach t in array array['whatsapp_extrator_config', 'whatsapp_pedidos_agendamento', 'bot_conhecimento'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
  end loop;
  -- (a configuração tem id numérico; a auditoria genérica espera uuid, então ela fica de fora)
  foreach t in array array['whatsapp_pedidos_agendamento', 'bot_conhecimento'] loop
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;

-- ---------- Agendador: a cada 10 minutos, se estiver ligado e houver conversa parada ----------
select cron.schedule(
  'whatsapp-extrator',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://ogflxjolbwrzayjtxvhj.supabase.co/functions/v1/whatsapp-extrator',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-extrator-chave', (select chave from interno.extrator_chave where id = 1)),
    body := '{"acao":"rodar"}'::jsonb,
    timeout_milliseconds := 10000)
  where interno.extrator_tem_trabalho();
  $cron$
);
