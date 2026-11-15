-- =====================================================================
-- 0028 — Portal do paciente (link seguro, sem cadastro de senha)
-- =====================================================================
-- A equipe gera um link (/portal/<token>) que vale 7 dias e manda ao paciente (WhatsApp ou papel).
-- Para abrir, o paciente digita a DATA DE NASCIMENTO. 5 erros bloqueiam o link.
-- Mostra: próximas consultas e os documentos dos últimos 180 dias (óculos, receitas,
-- atestados/declarações, pedidos de exame e laudos assinados). Cada abertura fica na auditoria.
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só uma tabela e funções NOVAS.
-- =====================================================================
create table public.portal_links (
  token              text primary key,
  paciente_id        uuid not null references public.pacientes(id),
  criado_por         uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em          timestamptz not null default now(),
  expira_em          timestamptz not null default now() + interval '7 days',
  revogado           boolean not null default false,
  acessos            int not null default 0,
  ultimo_acesso_em   timestamptz,
  tentativas_erradas int not null default 0
);
comment on table public.portal_links is 'Links do portal do paciente (7 dias; abre com a data de nascimento; 5 erros bloqueiam).';
create index portal_links_paciente_idx on public.portal_links (paciente_id);
create index portal_links_criado_por_idx on public.portal_links (criado_por);
create trigger auditoria after insert or update or delete on public.portal_links
  for each row execute function interno.tg_auditoria();

alter table public.portal_links enable row level security;
revoke all on public.portal_links from anon;
create policy equipe_le on public.portal_links for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));
-- revogar (só a coluna revogado)
revoke update on public.portal_links from authenticated;
grant update (revogado) on public.portal_links to authenticated;
create policy equipe_revoga on public.portal_links for update to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')))
  with check ((select interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin')));

-- Gera o link. SECURITY DEFINER: grava o token aleatório; confere a função de quem chama.
create or replace function public.portal_criar_link(p_paciente uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not interno.tem_funcao('medico', 'enfermagem', 'recepcao', 'admin') then
    raise exception 'Sem permissão.';
  end if;
  if not exists (select 1 from public.pacientes where id = p_paciente and ativo) then
    raise exception 'Paciente não encontrado.';
  end if;
  if not exists (select 1 from public.pacientes where id = p_paciente and data_nascimento is not null) then
    raise exception 'Cadastre a data de nascimento do paciente antes (é a senha do portal).';
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.portal_links (token, paciente_id) values (v_token, p_paciente);
  return v_token;
end $$;
revoke execute on function public.portal_criar_link(uuid) from public, anon;
grant execute on function public.portal_criar_link(uuid) to authenticated;

-- Abre o portal. Executável SEM login, de propósito: exige o token (32 caracteres aleatórios)
-- E a data de nascimento; 5 erros bloqueiam o link.
create or replace function public.portal_abrir(p_token text, p_nascimento date)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_link public.portal_links;
  v_pac  public.pacientes;
  v_desde timestamptz := now() - interval '180 days';
begin
  select * into v_link from public.portal_links where token = p_token for update;
  if v_link.token is null or v_link.revogado or v_link.expira_em < now() then
    return jsonb_build_object('erro', 'Link inválido ou vencido. Peça um novo link à clínica.');
  end if;
  if v_link.tentativas_erradas >= 5 then
    return jsonb_build_object('erro', 'Link bloqueado por tentativas erradas. Peça um novo link à clínica.');
  end if;
  select * into v_pac from public.pacientes where id = v_link.paciente_id;
  if v_pac.data_nascimento is distinct from p_nascimento then
    update public.portal_links set tentativas_erradas = tentativas_erradas + 1 where token = p_token;
    return jsonb_build_object('erro', 'Data de nascimento não confere.', 'restam', 4 - v_link.tentativas_erradas);
  end if;

  update public.portal_links set acessos = acessos + 1, ultimo_acesso_em = now(), tentativas_erradas = 0 where token = p_token;
  insert into public.log_auditoria (acao, tabela, paciente_id, registro_id, detalhes, email)
  values ('LEITURA', 'portal_links', v_pac.id, v_pac.id, 'Paciente abriu o portal', null);

  return jsonb_build_object(
    'paciente', split_part(coalesce(v_pac.nome_social, v_pac.nome), ' ', 1),
    'expira_em', v_link.expira_em,
    'consultas', (select coalesce(jsonb_agg(jsonb_build_object('inicio', g.inicio, 'tipo', g.tipo, 'status', g.status, 'medico', pr.nome) order by g.inicio), '[]'::jsonb)
                  from public.agendamentos g join public.profissionais pr on pr.id = g.profissional_id
                  where g.paciente_id = v_pac.id and g.inicio >= now() and g.status in ('agendado', 'confirmado')),
    'oculos', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'data', o.criado_em, 'medico', pr.nome, 'crm', concat_ws(' ', pr.conselho, pr.numero_conselho || coalesce('/' || pr.uf_conselho, '')),
                  'od', jsonb_build_object('esf', o.longe_od_esferico, 'cil', o.longe_od_cilindrico, 'eixo', o.longe_od_eixo),
                  'oe', jsonb_build_object('esf', o.longe_oe_esferico, 'cil', o.longe_oe_cilindrico, 'eixo', o.longe_oe_eixo),
                  'adicao', o.adicao, 'dnp_od', o.dnp_od, 'dnp_oe', o.dnp_oe, 'tipo_lente', o.tipo_lente, 'observacoes', o.observacoes, 'validade', o.validade,
                  'codigo', (select v.codigo from public.documentos_verificacao v where v.tipo = 'oculos' and v.referencia_id = o.id)) order by o.criado_em desc), '[]'::jsonb)
               from public.prescricoes_oculos o join public.atendimentos a on a.id = o.atendimento_id join public.profissionais pr on pr.id = a.profissional_id
               where a.paciente_id = v_pac.id and a.status = 'finalizado' and o.criado_em >= v_desde),
    'receitas', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'data', r.criado_em, 'medico', pr.nome, 'crm', concat_ws(' ', pr.conselho, pr.numero_conselho || coalesce('/' || pr.uf_conselho, '')),
                  'tipo_receita', r.tipo_receita,
                  'itens', (select coalesce(jsonb_agg(jsonb_build_object('medicamento', i.medicamento, 'apresentacao', i.apresentacao, 'posologia', i.posologia, 'olho', i.olho, 'via', i.via, 'duracao', i.duracao, 'quantidade', i.quantidade) order by i.ordem), '[]'::jsonb)
                            from public.prescricao_itens i where i.prescricao_id = r.id),
                  'codigo', (select v.codigo from public.documentos_verificacao v where v.tipo = 'receita' and v.referencia_id = r.id)) order by r.criado_em desc), '[]'::jsonb)
               from public.prescricoes r join public.atendimentos a on a.id = r.atendimento_id join public.profissionais pr on pr.id = a.profissional_id
               where a.paciente_id = v_pac.id and a.status = 'finalizado' and r.criado_em >= v_desde
                 and r.tipo_receita = 'simples'),   -- controle especial/antimicrobiano exigem a via física assinada
    'documentos', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'data', d.criado_em, 'tipo', d.tipo, 'conteudo', d.conteudo, 'dias_afastamento', d.dias_afastamento,
                  'medico', pr.nome, 'crm', concat_ws(' ', pr.conselho, pr.numero_conselho || coalesce('/' || pr.uf_conselho, '')),
                  'codigo', (select v.codigo from public.documentos_verificacao v where v.tipo = 'documento' and v.referencia_id = d.id)) order by d.criado_em desc), '[]'::jsonb)
               from public.documentos_clinicos d join public.atendimentos a on a.id = d.atendimento_id join public.profissionais pr on pr.id = a.profissional_id
               where a.paciente_id = v_pac.id and a.status = 'finalizado' and d.criado_em >= v_desde and d.tipo <> 'termo_consentimento'),
    'pedidos', (select coalesce(jsonb_agg(jsonb_build_object('data', a.inicio, 'medico', pr.nome, 'exames', x.exames) order by a.inicio desc), '[]'::jsonb)
               from public.atendimentos a join public.profissionais pr on pr.id = a.profissional_id
               cross join lateral (select jsonb_agg(s.exame order by s.criado_em) as exames from public.solicitacoes_exames s
                                   where s.atendimento_id = a.id and s.status = 'solicitado') x
               where a.paciente_id = v_pac.id and a.status = 'finalizado' and a.inicio >= v_desde and x.exames is not null),
    'laudos', (select coalesce(jsonb_agg(jsonb_build_object('data', e.laudado_em, 'exame', e.exame, 'olho', e.olho, 'laudo', e.laudo, 'conclusao', e.conclusao, 'medico', pr.nome) order by e.laudado_em desc), '[]'::jsonb)
               from public.exames_realizados e left join public.profissionais pr on pr.id = e.laudado_por
               where e.paciente_id = v_pac.id and e.status = 'laudado' and e.laudado_em >= v_desde)
  );
end $$;
revoke execute on function public.portal_abrir(text, date) from public;
grant execute on function public.portal_abrir(text, date) to anon, authenticated;
