-- =====================================================================
-- 0021 — Acompanhamento de doenças crônicas e busca ativa
-- =====================================================================
-- Glaucoma, retinopatia diabética, DMRI etc. não doem: o paciente some e perde a visão.
--  * seguimentos ............ o médico marca "este paciente deve voltar a cada X dias" (e a PIO alvo)
--  * busca_ativa_contatos ... a recepção registra cada tentativa de contato
--  * busca_ativa() .......... lista de quem está atrasado e sem consulta marcada
--  * busca_ativa_sugestoes()  pacientes com CID crônico que ainda não têm acompanhamento
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só tabelas e funções NOVAS. Nenhum gatilho em
-- tabela existente. A "última consulta" é calculada na hora e considera também o
-- prontuário antigo (prontuario_legado) e os agendamentos atendidos importados.
-- =====================================================================

create table public.seguimentos (
  id               uuid primary key default gen_random_uuid(),
  paciente_id      uuid not null references public.pacientes(id),
  condicao         text not null check (condicao in
                     ('glaucoma', 'suspeita_glaucoma', 'retinopatia_diabetica', 'diabetes_sem_retinopatia',
                      'dmri', 'ceratocone', 'uveite', 'pos_operatorio', 'catarata', 'outro')),
  descricao        text,
  intervalo_dias   int not null default 180 check (intervalo_dias between 7 and 730),
  pio_alvo_od      numeric(4,1),
  pio_alvo_oe      numeric(4,1),
  medico_id        uuid references public.profissionais(id) default interno.profissional_atual(),
  ativo            boolean not null default true,
  encerrado_motivo text,
  criado_por       uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  check (ativo or encerrado_motivo is not null)
);
comment on table public.seguimentos is 'Pacientes em acompanhamento (doença crônica): intervalo de retorno e PIO alvo. Base da busca ativa.';
create index seguimentos_paciente_idx on public.seguimentos (paciente_id);
create index seguimentos_medico_idx on public.seguimentos (medico_id);
create index seguimentos_criado_por_idx on public.seguimentos (criado_por);
create unique index seguimentos_um_ativo_por_condicao on public.seguimentos (paciente_id, condicao) where ativo;

create table public.busca_ativa_contatos (
  id             uuid primary key default gen_random_uuid(),
  paciente_id    uuid not null references public.pacientes(id),
  canal          text not null check (canal in ('telefone', 'whatsapp', 'presencial', 'outro')),
  resultado      text not null check (resultado in
                   ('agendou', 'vai_ligar', 'nao_atendeu', 'numero_errado', 'recusou', 'faz_em_outro_lugar',
                    'mudou_cidade', 'faleceu', 'outro')),
  observacao     text,
  registrado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now()
);
comment on table public.busca_ativa_contatos is 'Tentativas de contato da busca ativa (ligação, WhatsApp). Não se apaga.';
create index busca_ativa_contatos_paciente_idx on public.busca_ativa_contatos (paciente_id, criado_em desc);
create index busca_ativa_contatos_registrado_por_idx on public.busca_ativa_contatos (registrado_por);

-- Gatilhos padrão (hora de alteração + auditoria)
create trigger atualizado_em before update on public.seguimentos
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.seguimentos
  for each row execute function interno.tg_auditoria();
create trigger auditoria after insert or update or delete on public.busca_ativa_contatos
  for each row execute function interno.tg_auditoria();

-- ---------- Acesso ----------
alter table public.seguimentos enable row level security;
alter table public.busca_ativa_contatos enable row level security;
revoke all on public.seguimentos, public.busca_ativa_contatos from anon;

-- Seguimento é informação clínica: médico e enfermagem leem; só médico cria/altera. Ninguém apaga (encerra).
create policy clinico_le on public.seguimentos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy medico_inclui on public.seguimentos for insert to authenticated
  with check ((select interno.tem_funcao('medico')));
create policy medico_altera on public.seguimentos for update to authenticated
  using ((select interno.tem_funcao('medico'))) with check ((select interno.tem_funcao('medico')));

-- Contatos: quem faz a busca ativa (recepção, enfermagem, médico, admin) lê e registra em nome próprio.
create policy equipe_le on public.busca_ativa_contatos for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
create policy equipe_registra on public.busca_ativa_contatos for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin'))
              and registrado_por = (select interno.profissional_atual()));

-- ---------- Lista da busca ativa ----------
-- SECURITY DEFINER de propósito: a recepção precisa saber QUEM ligar, mas não pode ler o
-- prontuário. A função confere a função de quem chama e só devolve a doença (condicao)
-- para médico e enfermagem; para recepção/admin vem só "acompanhamento".
create or replace function public.busca_ativa(p_tolerancia_dias int default 15)
returns table (
  paciente_id uuid, numero_prontuario bigint, nome text, nome_social text, telefone text,
  whatsapp_autorizado boolean, condicoes text, ultima_consulta date, previsto_em date, dias_atraso int,
  proximo_agendamento timestamptz, tentativas int, ultimo_contato_em timestamptz, ultimo_resultado text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_clinico boolean := interno.tem_funcao('medico', 'enfermagem');
begin
  if not interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin') then
    raise exception 'Sem permissão para a busca ativa.';
  end if;
  return query
  with seg as (
    select s.paciente_id,
           min(s.intervalo_dias) as intervalo,
           string_agg(s.condicao, ', ' order by s.condicao) as condicoes
    from public.seguimentos s where s.ativo group by s.paciente_id
  ), ult as (
    select seg.paciente_id, greatest(
      (select max(a.inicio) from public.atendimentos a where a.paciente_id = seg.paciente_id),
      (select max(g.inicio) from public.agendamentos g where g.paciente_id = seg.paciente_id and g.status = 'atendido'),
      (select max(l.data) from public.prontuario_legado l where l.paciente_id = seg.paciente_id)
    ) as ultima
    from seg
  ), cont as (
    select c.paciente_id, count(*)::int as n, max(c.criado_em) as em,
           (array_agg(c.resultado order by c.criado_em desc))[1] as resultado
    from public.busca_ativa_contatos c group by c.paciente_id
  )
  select p.id, p.numero_prontuario, p.nome, p.nome_social, p.telefone, p.whatsapp_autorizado,
         case when v_clinico then seg.condicoes else 'acompanhamento' end,
         (ult.ultima at time zone 'America/Sao_Paulo')::date,
         ((ult.ultima at time zone 'America/Sao_Paulo')::date + seg.intervalo),
         (current_date - ((ult.ultima at time zone 'America/Sao_Paulo')::date + seg.intervalo))::int,
         (select min(g.inicio) from public.agendamentos g
           where g.paciente_id = p.id and g.inicio >= now() and g.status in ('agendado', 'confirmado')),
         coalesce(cont.n, 0), cont.em, cont.resultado
  from seg
  join public.pacientes p on p.id = seg.paciente_id and p.ativo
  left join ult on ult.paciente_id = seg.paciente_id
  left join cont on cont.paciente_id = seg.paciente_id
  where coalesce((ult.ultima at time zone 'America/Sao_Paulo')::date + seg.intervalo, current_date)
        <= current_date - p_tolerancia_dias
    and not exists (select 1 from public.agendamentos g
                    where g.paciente_id = p.id and g.inicio >= now() and g.status in ('agendado', 'confirmado'))
    and coalesce(cont.resultado, '') not in ('faleceu', 'mudou_cidade', 'faz_em_outro_lugar', 'recusou')
  order by 10 desc nulls first;
end $$;
revoke execute on function public.busca_ativa(int) from public, anon;
grant execute on function public.busca_ativa(int) to authenticated;

-- ---------- Sugestões: CID crônico sem acompanhamento ----------
-- SECURITY INVOKER: só quem já pode ler diagnósticos (médico/enfermagem) vê alguma coisa.
create or replace function public.busca_ativa_sugestoes()
returns table (paciente_id uuid, numero_prontuario bigint, nome text, condicao text, cid10 text, descricao text, ultima_consulta date)
language sql stable security invoker set search_path = '' as $$
  with d as (
    select a.paciente_id, dg.cid10, dg.descricao, a.inicio,
      case
        when dg.cid10 ~ '^H40\.0' then 'suspeita_glaucoma'
        when dg.cid10 ~ '^(H40|H42)' then 'glaucoma'
        when dg.cid10 ~ '^(H36\.0|E1[0-4]\.3)' then 'retinopatia_diabetica'
        when dg.cid10 ~ '^E1[0-4]' then 'diabetes_sem_retinopatia'
        when dg.cid10 ~ '^H35\.3' then 'dmri'
        when dg.cid10 ~ '^H18\.6' then 'ceratocone'
        when dg.cid10 ~ '^(H20|H30)' then 'uveite'
      end as condicao
    from public.diagnosticos dg join public.atendimentos a on a.id = dg.atendimento_id
  )
  select distinct on (d.paciente_id, d.condicao)
         p.id, p.numero_prontuario, p.nome, d.condicao, d.cid10, d.descricao,
         (select (max(a2.inicio) at time zone 'America/Sao_Paulo')::date from public.atendimentos a2 where a2.paciente_id = p.id)
  from d join public.pacientes p on p.id = d.paciente_id and p.ativo
  where d.condicao is not null
    and not exists (select 1 from public.seguimentos s where s.paciente_id = d.paciente_id and s.ativo
                    and (s.condicao = d.condicao or (d.condicao = 'suspeita_glaucoma' and s.condicao = 'glaucoma')))
  order by d.paciente_id, d.condicao, d.inicio desc
$$;
revoke execute on function public.busca_ativa_sugestoes() from public, anon;
grant execute on function public.busca_ativa_sugestoes() to authenticated;
