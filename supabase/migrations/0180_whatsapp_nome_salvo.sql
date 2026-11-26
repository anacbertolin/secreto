-- =====================================================================
-- 0180 — WhatsApp: "salvar contato" (nome dado pela equipe a um número)
-- =====================================================================
-- Pedido da dona (26/11/2026): com o número novo da Orientação, as conversas chegam com o nome do PERFIL do
-- WhatsApp (apelido, nome da mãe, da vizinha...). No celular antigo a Alessandra tinha o contato salvo com o nome
-- do paciente. Agora a equipe pode salvar um nome para o número (sem precisar ligar ao prontuário) e uma observação.
--  * nome_salvo tem prioridade sobre nome_contato (que a Meta manda de novo a cada mensagem).
--  * Ligar ao paciente (prontuário) continua existindo e tem prioridade sobre os dois.
--  * Quem pode alterar: as mesmas regras de update da conversa (quem responde o número).
-- =====================================================================
alter table public.whatsapp_conversas
  add column nome_salvo text check (nome_salvo is null or length(trim(nome_salvo)) between 1 and 120),
  add column contato_obs text check (contato_obs is null or length(contato_obs) <= 500);
comment on column public.whatsapp_conversas.nome_salvo is
  'Nome dado pela equipe a este número (como "salvar contato" no celular). Tem prioridade sobre o nome do perfil do WhatsApp (nome_contato), que a Meta manda a cada mensagem.';
comment on column public.whatsapp_conversas.contato_obs is
  'Observação sobre o número, ex.: "telefone da vizinha — paciente Maria da Silva".';
grant update (nome_salvo, contato_obs) on public.whatsapp_conversas to authenticated;

-- Pesquisa de mensagens passa a mostrar o nome salvo
create or replace function public.whatsapp_buscar(
  p_setor text, p_termo text, p_de date default null, p_ate date default null, p_limite int default 100
) returns table (
  mensagem_id uuid, conversa_id uuid, quando timestamptz, direcao text, tipo text,
  texto text, transcricao text, enviado_por uuid, telefone text, nome text, numero_prontuario int
) language sql stable security invoker set search_path = '' as $$
  select m.id, m.conversa_id, m.quando, m.direcao, m.tipo, m.texto, m.transcricao, m.enviado_por,
         c.telefone, coalesce(p.nome_social, p.nome, c.nome_salvo, c.nome_contato), p.numero_prontuario
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
