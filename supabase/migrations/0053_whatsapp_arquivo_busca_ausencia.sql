-- =====================================================================
-- 0053 — WhatsApp: guardar fotos/áudios para sempre, pesquisar mensagens
--        e resposta automática fora do horário
-- =====================================================================
-- Pedido da dona (17/11/2026), pensando na Orientação Cirúrgica: "às vezes o
-- paciente fala uma coisa com a Alessandra e depois, na sala do médico, diz
-- outra" — é preciso guardar tudo, ouvir os áudios e pesquisar o que foi dito.
--  * A Meta só guarda fotos/áudios por ~30 dias. Agora cada arquivo recebido é
--    copiado para o Storage do Supabase (bucket privado "whatsapp-midia", em
--    São Paulo) assim que chega. A equipe não acessa o bucket direto: a função
--    whatsapp-enviar (ação "midia") confere quem pode ver a conversa e entrega.
--  * whatsapp_buscar: pesquisa no texto das mensagens e na transcrição dos
--    áudios (sem diferenciar acentos/maiúsculas). Respeita as regras de acesso
--    (quem não vê a conversa não acha nada dela).
--  * Resposta automática fora do horário (por número): desligada até a dona
--    aprovar o texto. Vai no máximo uma vez a cada 8 h por conversa.
--  Vale para os dois números (clínica e orientação).
-- =====================================================================

-- ---------- Arquivos guardados ----------
alter table public.whatsapp_mensagens add column midia_caminho text;
comment on column public.whatsapp_mensagens.midia_caminho is
  'Onde a foto/áudio/documento ficou guardado no Storage (bucket whatsapp-midia). Null = ainda só na Meta.';

insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-midia', 'whatsapp-midia', false, 104857600)
on conflict (id) do nothing;
-- Sem políticas para a equipe no bucket: só as funções Edge (chave de serviço) leem e gravam.

-- ---------- Pesquisa ----------
create extension if not exists unaccent with schema extensions;

create or replace function public.whatsapp_buscar(
  p_setor text, p_termo text, p_de date default null, p_ate date default null, p_limite int default 100
) returns table (
  mensagem_id uuid, conversa_id uuid, quando timestamptz, direcao text, tipo text,
  texto text, transcricao text, enviado_por uuid, telefone text, nome text, numero_prontuario int
) language sql stable security invoker set search_path = '' as $$
  select m.id, m.conversa_id, m.quando, m.direcao, m.tipo, m.texto, m.transcricao, m.enviado_por,
         c.telefone, coalesce(p.nome_social, p.nome, c.nome_contato), p.numero_prontuario
    from public.whatsapp_mensagens m
    join public.whatsapp_conversas c on c.id = m.conversa_id
    left join public.pacientes p on p.id = c.paciente_id
   where c.setor = p_setor
     and length(trim(coalesce(p_termo, ''))) >= 2
     and (extensions.unaccent(lower(coalesce(m.texto, '') || ' ' || coalesce(m.transcricao, '')))
          like '%' || extensions.unaccent(lower(trim(p_termo))) || '%')
     and (p_de is null or m.quando >= (p_de::timestamp at time zone 'America/Sao_Paulo'))
     and (p_ate is null or m.quando < ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo'))
   order by m.quando desc
   limit least(coalesce(p_limite, 100), 300)
$$;
revoke execute on function public.whatsapp_buscar(text, text, date, date, int) from public, anon;
grant execute on function public.whatsapp_buscar(text, text, date, date, int) to authenticated;

-- ---------- Resposta automática fora do horário ----------
create table public.whatsapp_ausencia (
  id             uuid not null unique default gen_random_uuid(),   -- para a auditoria
  setor          text primary key check (setor in ('clinica', 'orientacao')),
  ligado         boolean not null default false,
  texto          text not null check (length(trim(texto)) between 10 and 1000),
  -- dia da semana (1 = segunda … 7 = domingo) → ["HH:MM", "HH:MM"]; dia ausente = fechado
  horarios       jsonb not null,
  atualizado_por uuid references public.profissionais(id),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on table public.whatsapp_ausencia is
  'Resposta automática quando o paciente escreve fora do horário de atendimento de cada número.';
comment on column public.whatsapp_ausencia.horarios is
  'Dia da semana (1 = segunda … 7 = domingo) → ["HH:MM", "HH:MM"]; dia ausente = fechado.';
create index whatsapp_ausencia_atualizado_por_idx on public.whatsapp_ausencia (atualizado_por);

insert into public.whatsapp_ausencia (setor, texto, horarios) values
  ('orientacao',
   'Olá! Você está falando com a Orientação Cirúrgica da Consumed Clínica de Olhos. Nosso atendimento por aqui é de segunda a sexta, das 8h às 17h, e aos sábados, das 8h às 12h. Sua mensagem ficou registrada e vamos responder no próximo horário de atendimento.',
   '{"1":["08:00","17:00"],"2":["08:00","17:00"],"3":["08:00","17:00"],"4":["08:00","17:00"],"5":["08:00","17:00"],"6":["08:00","12:00"]}'),
  ('clinica',
   'Olá! Você está falando com a Consumed Clínica de Olhos. Nosso atendimento por aqui é de segunda a sexta, das 8h às 17h, e aos sábados, das 8h às 12h. Sua mensagem ficou registrada e vamos responder no próximo horário de atendimento.',
   '{"1":["08:00","17:00"],"2":["08:00","17:00"],"3":["08:00","17:00"],"4":["08:00","17:00"],"5":["08:00","17:00"],"6":["08:00","12:00"]}');

create trigger atualizado_em before update on public.whatsapp_ausencia
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.whatsapp_ausencia
  for each row execute function interno.tg_auditoria();

alter table public.whatsapp_ausencia enable row level security;
revoke all on public.whatsapp_ausencia from anon;
revoke insert, delete, truncate on public.whatsapp_ausencia from authenticated;
grant select, update (ligado, texto, horarios, atualizado_por) on public.whatsapp_ausencia to authenticated;

create policy quem_ve_le on public.whatsapp_ausencia for select to authenticated
  using (
    (setor = 'clinica' and (select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin', 'faturamento')))
    or (setor = 'orientacao' and ((select interno.tem_funcao('medico', 'admin')) or (select interno.atende_orientacao())))
  );
create policy quem_atende_altera on public.whatsapp_ausencia for update to authenticated
  using (
    (select interno.tem_funcao('admin'))
    or (setor = 'clinica' and (select interno.tem_funcao('recepcao')))
    or (setor = 'orientacao' and (select interno.atende_orientacao()))
  )
  with check (
    (select interno.tem_funcao('admin'))
    or (setor = 'clinica' and (select interno.tem_funcao('recepcao')))
    or (setor = 'orientacao' and (select interno.atende_orientacao()))
  );

alter table public.whatsapp_conversas add column ausencia_enviada_em timestamptz;

-- Chamada pelo webhook quando chega mensagem: devolve o texto a enviar (ou null) e já marca o envio.
create or replace function public.whatsapp_ausencia_texto(p_conversa uuid)
returns text language plpgsql set search_path = '' as $$
declare
  v_setor text;
  cfg public.whatsapp_ausencia;
  v_agora timestamp := (now() at time zone 'America/Sao_Paulo');
  v_faixa jsonb;
  v_hora time;
begin
  select setor into v_setor from public.whatsapp_conversas where id = p_conversa;
  if v_setor is null then return null; end if;
  select * into cfg from public.whatsapp_ausencia where setor = v_setor;
  if not found or not cfg.ligado then return null; end if;

  v_faixa := cfg.horarios -> extract(isodow from v_agora)::int::text;
  v_hora := v_agora::time;
  if v_faixa is not null and v_hora >= (v_faixa ->> 0)::time and v_hora < (v_faixa ->> 1)::time then
    return null;                                        -- dentro do horário
  end if;
  -- Marca e confere na mesma instrução: várias mensagens seguidas geram uma resposta só
  update public.whatsapp_conversas set ausencia_enviada_em = now()
   where id = p_conversa and (ausencia_enviada_em is null or ausencia_enviada_em <= now() - interval '8 hours');
  if not found then
    return null;                                        -- já avisou há pouco
  end if;
  return cfg.texto;
end $$;
revoke execute on function public.whatsapp_ausencia_texto(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_ausencia_texto(uuid) to service_role;
