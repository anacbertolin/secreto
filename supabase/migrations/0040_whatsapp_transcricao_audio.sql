-- =====================================================================
-- 0040 — Transcrição dos áudios do WhatsApp (Whisper / OpenAI) — pedido da dona, 15/11/2026
-- =====================================================================
-- (Numeração 0040 para não chocar com a sequência 0020+ de outra sessão.)
-- Quando chega um ÁUDIO de paciente, o banco chama a função Edge
-- `whatsapp-transcrever`, que baixa o arquivo da Meta, manda para o Whisper
-- (OpenAI, EUA — decisão da dona) e guarda o texto em `transcricao`.
--  * A tela do WhatsApp mostra o texto embaixo do áudio.
--  * O assistente (extrator) lê a transcrição como se fosse mensagem escrita
--    e espera até 45 min por um áudio ainda "pendente" antes de analisar.
--  * A cada 10 min, áudios que falharam são tentados de novo (até 3 vezes).
--  * Liga/desliga: whatsapp_extrator_config.transcrever_audios (tela do assistente).
-- Segredo necessário na função Edge: OPENAI_API_KEY (e os WHATSAPP_* que já existem).
-- =====================================================================

alter table public.whatsapp_mensagens
  add column transcricao text,
  add column transcricao_situacao text check (transcricao_situacao in ('pendente', 'feita', 'falhou')),
  add column transcricao_tentativas int not null default 0,
  add column transcricao_erro text;

alter table public.whatsapp_extrator_config
  add column transcrever_audios boolean not null default true;
grant update (transcrever_audios) on public.whatsapp_extrator_config to authenticated;

create index whatsapp_mensagens_transcricao_pendente_idx on public.whatsapp_mensagens (quando)
  where transcricao_situacao = 'pendente';

-- Chama a função Edge (assíncrono, pelo pg_net)
create or replace function interno.chamar_transcricao(p_corpo jsonb)
returns void language sql security definer set search_path = '' as $$
  select null::void from (
    select net.http_post(
      url := 'https://ogflxjolbwrzayjtxvhj.supabase.co/functions/v1/whatsapp-transcrever',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-extrator-chave', (select chave from interno.extrator_chave where id = 1)),
      body := p_corpo,
      timeout_milliseconds := 30000)
  ) x
$$;

-- Áudio de paciente chegou → marca "pendente" e pede a transcrição
create or replace function interno.tg_audio_transcrever()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.tipo = 'audio' and new.direcao = 'recebida' and new.midia_id is not null
     and coalesce((select transcrever_audios from public.whatsapp_extrator_config where id = 1), false) then
    update public.whatsapp_mensagens set transcricao_situacao = 'pendente' where id = new.id;
    perform interno.chamar_transcricao(jsonb_build_object('acao', 'transcrever', 'mensagem_id', new.id));
  end if;
  return null;
end $$;

create trigger transcrever_audio after insert on public.whatsapp_mensagens
  for each row execute function interno.tg_audio_transcrever();

revoke execute on function interno.chamar_transcricao(jsonb) from public, anon, authenticated;
revoke execute on function interno.tg_audio_transcrever() from public, anon, authenticated;

-- Fila para a função Edge: pega áudios pendentes (para novas tentativas)
create or replace function public.whatsapp_transcricao_pendentes(p_limite int default 10)
returns table (id uuid, midia_id text, midia_tipo text)
language sql set search_path = '' as $$
  select m.id, m.midia_id, m.midia_tipo from public.whatsapp_mensagens m
   where m.transcricao_situacao = 'pendente' and m.transcricao_tentativas < 3
   order by m.quando limit p_limite
$$;
revoke execute on function public.whatsapp_transcricao_pendentes(int) from public, anon, authenticated;
grant execute on function public.whatsapp_transcricao_pendentes(int) to service_role;

-- A cada 10 min: tenta de novo os áudios que ficaram pendentes há mais de 5 min
select cron.schedule(
  'whatsapp-transcricao-reprocessar',
  '*/10 * * * *',
  $cron$
  select interno.chamar_transcricao('{"acao":"pendentes"}'::jsonb)
  where exists (select 1 from public.whatsapp_mensagens
                 where transcricao_situacao = 'pendente' and transcricao_tentativas < 3
                   and quando < now() - interval '5 minutes')
    and coalesce((select transcrever_audios from public.whatsapp_extrator_config where id = 1), false);
  $cron$
);

-- O extrator passa a ler a transcrição
create or replace function interno.extrator_descrever(p_tipo text, p_texto text, p_modelo text, p_midia text, p_transcricao text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_tipo = 'audio' and nullif(trim(p_transcricao), '') is not null
      then '[áudio transcrito] ' || interno.mascarar(trim(p_transcricao))
    else interno.extrator_descrever(p_tipo, p_texto, p_modelo, p_midia) end
$$;
revoke execute on function interno.extrator_descrever(text, text, text, text, text) from public, anon, authenticated;
grant execute on function interno.extrator_descrever(text, text, text, text, text) to service_role;

create or replace function public.whatsapp_extrator_preparar(p_limite int default 5)
returns jsonb language plpgsql set search_path = '' as $$
declare
  cfg public.whatsapp_extrator_config;
  v_dias text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
  v_padrao text;
  v_refs text;
  v_lista jsonb := '[]'::jsonb;
  c record;
  cv public.whatsapp_conversas;
  v_ate timestamptz;
  v_tem_paciente boolean;
  v_texto text;
  v_ligado text;
  v_qtd int;
begin
  select * into cfg from public.whatsapp_extrator_config where id = 1;
  update public.whatsapp_extrator_config set ultima_execucao = now() where id = 1;
  if not cfg.ligado then
    return jsonb_build_object('ligado', false, 'conversas', '[]'::jsonb);
  end if;

  v_padrao := case when cfg.usar_horario_padrao then
    (select string_agg(v_dias[d + 1], ', ' order by d) from unnest(cfg.padrao_dias) d)
    || ' ' || to_char(cfg.padrao_inicio, 'HH24:MI') || '–' || to_char(cfg.padrao_fim, 'HH24:MI') end;

  v_refs := concat_ws(E'\n',
    '# Dados de referência da clínica',
    '## Médicos',
    coalesce((select string_agg(format('- id %s | %s%s | atende: %s', p.id, p.nome,
                coalesce(' (' || p.especialidade || ')', ''),
                coalesce((select string_agg(v_dias[h.dia_semana + 1] || ' ' || to_char(h.hora_inicio, 'HH24:MI') || '–' || to_char(h.hora_fim, 'HH24:MI'), ', ' order by h.dia_semana, h.hora_inicio)
                            from public.horarios_profissional h where h.profissional_id = p.id and h.ativo),
                         v_padrao || ' (horário padrão da clínica)', 'horários não cadastrados')), E'\n' order by p.nome)
              from public.profissionais p where p.ativo and p.funcao = 'medico'), '(nenhum médico ativo cadastrado)'),
    '## Convênios aceitos',
    coalesce((select string_agg(format('- id %s | %s', id, nome), E'\n' order by nome) from public.convenios where ativo),
             '(nenhum convênio cadastrado; particular)'),
    '## Perguntas já conhecidas na base do robô',
    coalesce((select string_agg(format('- id %s | %s | %s', id, categoria, pergunta), E'\n')
              from (select * from public.bot_conhecimento where situacao <> 'descartada' order by vezes desc limit 300) k),
             '(nenhuma ainda)'));

  for c in select * from public.whatsapp_extrator_pegar(p_limite, cfg.silencio_minutos, null) loop
    select * into cv from public.whatsapp_conversas where id = c.conversa_id;

    -- mensagens novas (até 150)
    create temp table if not exists _novas (like public.whatsapp_mensagens) on commit drop;
    truncate _novas;
    insert into _novas
      select * from public.whatsapp_mensagens m
       where m.conversa_id = c.conversa_id and m.quando > coalesce(c.analisado_ate, '-infinity'::timestamptz)
       order by m.quando limit 150;
    select max(quando), bool_or(direcao = 'recebida') into v_ate, v_tem_paciente from _novas;

    -- áudio ainda sendo transcrito (chegou há menos de 45 min)? espera a próxima passagem
    if exists (select 1 from _novas where transcricao_situacao = 'pendente' and quando > now() - interval '45 minutes') then
      update public.whatsapp_extrator_estado set em_processo_desde = null, atualizado_em = now() where conversa_id = c.conversa_id;
      continue;
    end if;

    if v_ate is null or not v_tem_paciente then
      update public.whatsapp_extrator_estado
         set analisado_ate = coalesce(v_ate, analisado_ate), em_processo_desde = null, atualizado_em = now()
       where conversa_id = c.conversa_id;
      continue;
    end if;

    select (select initcap(split_part(coalesce(p.nome_social, p.nome), ' ', 1)) from public.pacientes p where p.id = cv.paciente_id),
           (select count(*) from public.whatsapp_extrator_pacientes_do_numero(cv.telefone))
      into v_ligado, v_qtd;

    with ctx as (
      select * from (select * from public.whatsapp_mensagens m
                      where m.conversa_id = c.conversa_id and c.analisado_ate is not null and m.quando <= c.analisado_ate
                      order by m.quando desc limit 12) z
    ), todas as (
      select 'ctx' parte, * from ctx union all select 'nova', * from _novas
    ), apelidos as (
      select enviado_por, 'Atendente ' || row_number() over (order by min(quando)) apelido
        from todas where enviado_por is not null group by enviado_por
    ), linhas as (
      select t.parte, t.quando, '[' || interno.extrator_quando(t.quando) || '] ' ||
             case when t.direcao = 'recebida' then 'PACIENTE'
                  when t.enviado_por is not null then 'CLÍNICA (' || a.apelido || ')'
                  else 'CLÍNICA (automático)' end
             || ': ' || interno.extrator_descrever(t.tipo, t.texto, t.modelo, t.midia_nome, t.transcricao) linha
        from todas t left join apelidos a on a.enviado_por = t.enviado_por
    )
    select concat_ws(E'\n',
      'Agora: ' || interno.extrator_quando(now()) || ' (horário de Brasília).',
      '## Esta conversa',
      '- Paciente ligado ao número: ' || coalesce(v_ligado, 'nenhum (pode ser paciente novo)'),
      '- Pacientes cadastrados com este número: ' || v_qtd,
      '## Agendamentos futuros de pacientes deste número',
      coalesce((select string_agg(format('- id %s | %s | %s | %s | %s | paciente: %s', ag.id, interno.extrator_quando(ag.inicio),
                  coalesce(pr.nome, 'outro profissional'), ag.tipo, ag.status, initcap(split_part(pa.nome, ' ', 1))), E'\n' order by ag.inicio)
                from public.agendamentos ag
                join public.pacientes pa on pa.id = ag.paciente_id
                left join public.profissionais pr on pr.id = ag.profissional_id
               where ag.inicio >= now() - interval '1 day' and ag.status not in ('cancelado', 'faltou')
                 and (ag.paciente_id = cv.paciente_id
                      or ag.paciente_id in (select id from public.whatsapp_extrator_pacientes_do_numero(cv.telefone)))), '(nenhum)'),
      '## Contexto (já analisado antes; só para entender)',
      coalesce((select string_agg(linha, E'\n' order by quando) from linhas where parte = 'ctx'), '(início da conversa)'),
      '## MENSAGENS NOVAS (analise estas)',
      (select string_agg(linha, E'\n' order by quando) from linhas where parte = 'nova'))
    into v_texto;

    v_lista := v_lista || jsonb_build_object('conversa_id', c.conversa_id, 'ate', v_ate, 'texto', v_texto);
  end loop;

  return jsonb_build_object(
    'ligado', true,
    'modelo', cfg.modelo,
    'instrucoes', public.whatsapp_extrator_instrucoes(),
    'referencias', v_refs,
    'conversas', v_lista);
end $$;

