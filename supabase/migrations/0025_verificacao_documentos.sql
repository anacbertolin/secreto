-- =====================================================================
-- 0025 — Código de autenticidade (QR) nos documentos impressos
-- =====================================================================
-- Cada receita, receita de óculos, atestado/documento, laudo e pedido de exames ganha um
-- código (QR) na impressão. Ótica, farmácia ou empresa conferem em /verificar/<código>,
-- SEM login. A página mostra só o necessário para conferir o papel: tipo, data, médico e
-- CRM, nome do paciente ABREVIADO e o conteúdo essencial (graus, medicamentos, dias de
-- afastamento). O código é aleatório (12 caracteres ≈ 60 bits): não dá para adivinhar.
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só uma tabela e funções NOVAS.
-- =====================================================================

create table public.documentos_verificacao (
  codigo          text primary key,
  tipo            text not null check (tipo in ('oculos', 'receita', 'documento', 'laudo', 'pedidos')),
  referencia_id   uuid not null,
  paciente_id     uuid not null references public.pacientes(id),
  emitido_em      timestamptz not null default now(),
  emitido_por     uuid references public.profissionais(id) default interno.profissional_atual(),
  resumo          jsonb not null,             -- o que a página pública mostra
  cancelado       boolean not null default false,
  motivo_cancelamento text
);
comment on table public.documentos_verificacao is 'Códigos de autenticidade dos documentos impressos (QR). A página pública mostra só o resumo.';
create unique index documentos_verificacao_ref on public.documentos_verificacao (tipo, referencia_id);
create index documentos_verificacao_paciente_idx on public.documentos_verificacao (paciente_id);
create index documentos_verificacao_emitido_por_idx on public.documentos_verificacao (emitido_por);
create trigger auditoria after insert or update or delete on public.documentos_verificacao
  for each row execute function interno.tg_auditoria();

alter table public.documentos_verificacao enable row level security;
revoke all on public.documentos_verificacao from anon;
create policy clinico_le on public.documentos_verificacao for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem', 'admin')));
-- inclusão só pela função abaixo; cancelamento só por médico
create policy medico_cancela on public.documentos_verificacao for update to authenticated
  using ((select interno.tem_funcao('medico'))) with check ((select interno.tem_funcao('medico')));

-- Nome abreviado: "Maria Aparecida da Silva" → "Maria A. d. S."
create or replace function interno.nome_abreviado(p text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(
    (select string_agg(case when i = 1 then w else left(w, 1) || '.' end, ' ' order by i)
     from unnest(regexp_split_to_array(trim(p), '\s+')) with ordinality as t(w, i)), '')
$$;

-- Gera (ou devolve o já gerado) o código de um documento. Só médico e enfermagem (quem imprime).
-- SECURITY DEFINER: monta o resumo lendo as tabelas clínicas e grava o código; confere a função de quem chama.
create or replace function public.documento_codigo(p_tipo text, p_ref uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_cod   text;
  v_pac   uuid;
  v_prof  uuid;
  v_data  timestamptz;
  v_conteudo jsonb;
  v_p     public.pacientes;
  v_m     public.profissionais;
begin
  if not interno.tem_funcao('medico', 'enfermagem') then
    raise exception 'Sem permissão.';
  end if;
  select codigo into v_cod from public.documentos_verificacao where tipo = p_tipo and referencia_id = p_ref;
  if v_cod is not null then
    return v_cod;
  end if;

  if p_tipo = 'oculos' then
    select a.paciente_id, a.profissional_id, o.criado_em,
           jsonb_build_object('od', jsonb_build_object('esf', o.longe_od_esferico, 'cil', o.longe_od_cilindrico, 'eixo', o.longe_od_eixo),
                              'oe', jsonb_build_object('esf', o.longe_oe_esferico, 'cil', o.longe_oe_cilindrico, 'eixo', o.longe_oe_eixo),
                              'adicao', o.adicao, 'validade', o.validade)
      into v_pac, v_prof, v_data, v_conteudo
    from public.prescricoes_oculos o join public.atendimentos a on a.id = o.atendimento_id where o.id = p_ref;
  elsif p_tipo = 'receita' then
    select a.paciente_id, a.profissional_id, r.criado_em,
           jsonb_build_object('tipo_receita', r.tipo_receita, 'itens',
             (select coalesce(jsonb_agg(jsonb_build_object('medicamento', i.medicamento, 'posologia', i.posologia, 'quantidade', i.quantidade) order by i.ordem), '[]'::jsonb)
              from public.prescricao_itens i where i.prescricao_id = r.id))
      into v_pac, v_prof, v_data, v_conteudo
    from public.prescricoes r join public.atendimentos a on a.id = r.atendimento_id where r.id = p_ref;
  elsif p_tipo = 'documento' then
    -- atestado: mostra os dias de afastamento, NÃO o CID nem o texto
    select a.paciente_id, a.profissional_id, d.criado_em,
           jsonb_build_object('tipo_documento', d.tipo, 'dias_afastamento', d.dias_afastamento)
      into v_pac, v_prof, v_data, v_conteudo
    from public.documentos_clinicos d join public.atendimentos a on a.id = d.atendimento_id where d.id = p_ref;
  elsif p_tipo = 'laudo' then
    select e.paciente_id, e.laudado_por, e.laudado_em, jsonb_build_object('exame', e.exame, 'olho', e.olho)
      into v_pac, v_prof, v_data, v_conteudo
    from public.exames_realizados e where e.id = p_ref and e.status = 'laudado';
  elsif p_tipo = 'pedidos' then
    select a.paciente_id, a.profissional_id, a.inicio,
           jsonb_build_object('exames', (select coalesce(jsonb_agg(s.exame order by s.criado_em), '[]'::jsonb)
                                         from public.solicitacoes_exames s where s.atendimento_id = a.id and s.status <> 'cancelado'))
      into v_pac, v_prof, v_data, v_conteudo
    from public.atendimentos a where a.id = p_ref;
  else
    raise exception 'Tipo de documento desconhecido.';
  end if;
  if v_pac is null then
    raise exception 'Documento não encontrado.';
  end if;

  select * into v_p from public.pacientes where id = v_pac;
  select * into v_m from public.profissionais where id = v_prof;
  v_cod := upper(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1IL', ''), 1, 12));
  insert into public.documentos_verificacao (codigo, tipo, referencia_id, paciente_id, resumo)
  values (v_cod, p_tipo, p_ref, v_pac, jsonb_build_object(
    'paciente', interno.nome_abreviado(coalesce(v_p.nome_social, v_p.nome)),
    'data', v_data,
    'medico', v_m.nome,
    'crm', concat_ws(' ', coalesce(v_m.conselho, 'CRM'), v_m.numero_conselho || coalesce('/' || v_m.uf_conselho, '')),
    'conteudo', v_conteudo));
  return v_cod;
end $$;
revoke execute on function public.documento_codigo(text, uuid) from public, anon;
grant execute on function public.documento_codigo(text, uuid) to authenticated;

-- Página pública: confere um código. Devolve só o resumo (ou nada).
create or replace function public.verificar_documento(p_codigo text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('tipo', d.tipo, 'emitido_em', d.emitido_em, 'cancelado', d.cancelado,
                            'motivo_cancelamento', d.motivo_cancelamento) || d.resumo
  from public.documentos_verificacao d
  where d.codigo = upper(trim(p_codigo)) and length(trim(p_codigo)) between 8 and 20
$$;
revoke execute on function public.verificar_documento(text) from public;
grant execute on function public.verificar_documento(text) to anon, authenticated;
