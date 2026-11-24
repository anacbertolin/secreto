-- =====================================================================
-- 0097 — Vendas da Orientação Cirúrgica → Repasse médico (pedido do Dr. Gelson, 24/11/2026)
-- =====================================================================
-- Fluxo:
--  1. A Alessandra (quem atende a Orientação Cirúrgica) recebe o pagamento do paciente (maquininha/PIX) e registra a
--     VENDA: paciente, médico, procedimento (ou só a lente, nos pacientes de convênio), lente premium, valor, forma de
--     pagamento e parcelas. Ela NÃO vê custos nem a divisão (só o valor que o paciente paga).
--  2. A venda fica "aguardando conferência" no Repasse médico. O Luciano (faturamento) confere, ajusta e lança o repasse
--     (repasse_lancar com venda_id → venda "lançada") ou DEVOLVE à Alessandra com o motivo.
-- A lista de procedimentos e lentes chega à orientação por funções que mostram só nome e valor de venda.
-- =====================================================================

create table public.orientacao_vendas (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint generated always as identity unique,
  tipo              text not null default 'cirurgia' check (tipo in ('cirurgia', 'lente')),  -- lente = paciente de convênio paga só a lente
  paciente_id       uuid not null references public.pacientes(id),
  profissional_id   uuid not null references public.profissionais(id),          -- médico
  procedimento_id   uuid references public.repasse_procedimentos(id),
  procedimento      text not null check (trim(procedimento) <> ''),
  lente_id          uuid references public.lentes_catalogo(id),                  -- lente premium (cirurgia) ou lente vendida (tipo lente)
  convenio_id       uuid references public.convenios(id),                        -- informativo (cirurgia pelo convênio)
  agendamento_id    uuid references public.agendamentos(id),                     -- atendimento da orientação, se houver
  data_cirurgia     date,
  data_pagamento    date not null default current_date,
  valor_total       numeric(12,2) not null check (valor_total > 0),
  forma_pagamento   text not null check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito')),
  parcelas          int not null default 1 check (parcelas between 1 and 24),
  observacoes       text,
  status            text not null default 'aguardando' check (status in ('aguardando', 'devolvida', 'lancada', 'cancelada')),
  motivo            text,                                                        -- da devolução ou do cancelamento
  repasse_id        uuid references public.repasses(id),
  conferido_por     uuid references public.profissionais(id),
  conferido_em      timestamptz,
  criado_por        uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
comment on table public.orientacao_vendas is 'Vendas (cirurgias e lentes) registradas pela Orientação Cirúrgica, para o Luciano conferir e lançar no repasse.';
create index orientacao_vendas_status_idx on public.orientacao_vendas (status, criado_em desc);
create index orientacao_vendas_paciente_idx on public.orientacao_vendas (paciente_id);
create index orientacao_vendas_profissional_idx on public.orientacao_vendas (profissional_id);
create index orientacao_vendas_procedimento_idx on public.orientacao_vendas (procedimento_id);
create index orientacao_vendas_lente_idx on public.orientacao_vendas (lente_id);
create index orientacao_vendas_convenio_idx on public.orientacao_vendas (convenio_id);
create index orientacao_vendas_agendamento_idx on public.orientacao_vendas (agendamento_id);
create index orientacao_vendas_repasse_idx on public.orientacao_vendas (repasse_id);
create index orientacao_vendas_conferido_por_idx on public.orientacao_vendas (conferido_por);
create index orientacao_vendas_criado_por_idx on public.orientacao_vendas (criado_por);

-- ---------- regras de quem muda o quê ----------
create or replace function interno.tg_orientacao_venda_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_fat boolean := interno.tem_funcao('faturamento', 'admin');
begin
  if new.forma_pagamento <> 'credito' then new.parcelas := 1; end if;
  if not exists (select 1 from public.profissionais where id = new.profissional_id and funcao = 'medico') then
    raise exception 'Escolha o médico.';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'aguardando'; new.motivo := null; new.repasse_id := null; new.conferido_por := null; new.conferido_em := null;
    return new;
  end if;
  if old.status in ('lancada', 'cancelada') then
    -- lançamento feito pela função repasse_lancar (aguardando → lançada) já passou; depois disso não muda
    raise exception 'Esta venda já foi % e não pode mudar.', case old.status when 'lancada' then 'lançada no repasse' else 'cancelada' end;
  end if;
  if (new.status = 'lancada' or new.repasse_id is not null) and coalesce(current_setting('app.venda_lancando', true), '') <> 'on' then
    raise exception 'A venda só fica "lançada" pelo lançamento do repasse.';
  end if;
  if new.status = 'devolvida' and old.status <> 'devolvida' then
    if not v_fat then raise exception 'Só o faturamento devolve uma venda.'; end if;
    if coalesce(trim(new.motivo), '') = '' then raise exception 'Informe o motivo da devolução.'; end if;
  end if;
  if new.status = 'cancelada' and coalesce(trim(new.motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  -- o faturamento não altera os dados da venda (só devolve ou lança); quem registrou corrige
  if v_fat and not interno.atende_orientacao() and not interno.tem_funcao('admin') and
     (new.paciente_id, new.profissional_id, new.procedimento_id, new.procedimento, new.lente_id, new.valor_total,
      new.forma_pagamento, new.parcelas, new.data_pagamento, new.data_cirurgia, new.tipo)
     is distinct from
     (old.paciente_id, old.profissional_id, old.procedimento_id, old.procedimento, old.lente_id, old.valor_total,
      old.forma_pagamento, old.parcelas, old.data_pagamento, old.data_cirurgia, old.tipo) then
    raise exception 'Os dados da venda são corrigidos por quem a registrou. Devolva com o motivo.';
  end if;
  new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  return new;
end $$;
create trigger regras before insert or update on public.orientacao_vendas
  for each row execute function interno.tg_orientacao_venda_regras();
create trigger atualizado_em before update on public.orientacao_vendas for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.orientacao_vendas for each row execute function interno.tg_auditoria();

alter table public.orientacao_vendas enable row level security;
create policy le on public.orientacao_vendas for select to authenticated
  using ((select interno.atende_orientacao()) or (select interno.tem_funcao('faturamento', 'admin')));
create policy inclui on public.orientacao_vendas for insert to authenticated
  with check ((select interno.atende_orientacao()) or (select interno.tem_funcao('admin')));
create policy altera on public.orientacao_vendas for update to authenticated
  using ((select interno.atende_orientacao()) or (select interno.tem_funcao('faturamento', 'admin')))
  with check ((select interno.atende_orientacao()) or (select interno.tem_funcao('faturamento', 'admin')));

-- ---------- o que a orientação enxerga: nome e valor de venda (sem custos) ----------
create or replace function public.orientacao_procedimentos()
returns table (id uuid, nome text, profissional_id uuid, valor_sugerido numeric, tem_lente boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.profissional_id, p.valor_sugerido,
         exists (select 1 from public.repasse_procedimento_custos c where c.procedimento_id = p.id and c.tipo = 'insumo' and c.descricao ilike '%lente%')
  from public.repasse_procedimentos p
  where p.ativo and p.regra = 'geral'
    and (interno.atende_orientacao() or interno.tem_funcao('faturamento', 'admin'))
  order by p.nome
$$;
create or replace function public.orientacao_lentes()
returns table (id uuid, descricao text, fabricante text, premium boolean, preco_venda numeric)
language sql stable security definer set search_path = '' as $$
  select l.id, l.descricao, l.fabricante, l.fabricante not in ('Rayner', 'Hoya'), l.preco_venda
  from public.lentes_catalogo l
  where l.ativo and l.preco_venda is not null
    and (interno.atende_orientacao() or interno.tem_funcao('faturamento', 'admin'))
  order by l.preco_venda, l.descricao
$$;
-- valor sugerido: procedimento + (venda da lente premium − custo da lente simples do procedimento); só lente: preço da lente
create or replace function public.orientacao_valor(p_procedimento uuid, p_lente uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select case
    when not (interno.atende_orientacao() or interno.tem_funcao('faturamento', 'admin')) then null
    when p_procedimento is null then (select preco_venda from public.lentes_catalogo where id = p_lente)
    else (select p.valor_sugerido
            + coalesce((select l.preco_venda from public.lentes_catalogo l where l.id = p_lente), 0)
            - case when p_lente is null then 0 else coalesce((select c.valor from public.repasse_procedimento_custos c
                where c.procedimento_id = p.id and c.tipo = 'insumo' and c.descricao ilike '%lente%' order by c.ordem limit 1), 0) end
          from public.repasse_procedimentos p where p.id = p_procedimento)
  end
$$;
revoke execute on function public.orientacao_procedimentos(), public.orientacao_lentes(), public.orientacao_valor(uuid, uuid) from public, anon;
grant execute on function public.orientacao_procedimentos(), public.orientacao_lentes(), public.orientacao_valor(uuid, uuid) to authenticated;

-- ---------- lançamento do repasse marca a venda como lançada ----------
create or replace function public.repasse_lancar(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_custo jsonb; v_total numeric := 0; v_tipo text; v_valor numeric; v_ordem int := 0;
  v_regra text := coalesce(nullif(p ->> 'regra', ''), 'geral');
begin
  if not interno.tem_funcao('faturamento', 'admin') then
    raise exception 'Você não tem permissão para lançar repasses.';
  end if;
  if v_regra not in ('geral', 'direto', 'cobranca') then
    raise exception 'Tipo de lançamento inválido.';
  end if;
  for v_custo in select * from jsonb_array_elements(coalesce(p -> 'custos', '[]'::jsonb)) loop
    v_tipo := v_custo ->> 'tipo';
    v_valor := (v_custo ->> 'valor')::numeric;
    if v_tipo is null or v_tipo not in ('sala', 'instrumentacao', 'auxiliar', 'anestesista', 'insumo', 'outro') then
      raise exception 'Tipo de custo inválido.';
    end if;
    if v_valor is null or v_valor < 0 then
      raise exception 'Valor de custo inválido.';
    end if;
    if coalesce(trim(v_custo ->> 'descricao'), '') = '' then
      raise exception 'Descreva cada custo.';
    end if;
    v_total := v_total + round(v_valor, 2);
  end loop;
  if v_regra = 'cobranca' and v_total <= 0 then
    raise exception 'Na cobrança ao médico, informe o que ele deve (taxa de sala, lente…).';
  end if;

  perform set_config('app.repasse_custos', v_total::text, true);
  insert into public.repasses (conta_id, paciente_id, profissional_id, procedimento_id, procedimento, data_cirurgia,
                               data_pagamento, valor_total, forma_pagamento, parcelas, observacoes, regra)
  values (nullif(p ->> 'conta_id', '')::uuid, nullif(p ->> 'paciente_id', '')::uuid, (p ->> 'profissional_id')::uuid,
          nullif(p ->> 'procedimento_id', '')::uuid, p ->> 'procedimento', (p ->> 'data_cirurgia')::date,
          coalesce((p ->> 'data_pagamento')::date, current_date),
          case when v_regra = 'cobranca' then v_total else (p ->> 'valor_total')::numeric end,
          case when v_regra = 'cobranca' then 'pix' else p ->> 'forma_pagamento' end,
          case when v_regra = 'cobranca' then 1 else coalesce((p ->> 'parcelas')::int, 1) end,
          nullif(trim(p ->> 'observacoes'), ''), v_regra)
  returning id into v_id;
  perform set_config('app.repasse_custos', '', true);

  for v_custo in select * from jsonb_array_elements(coalesce(p -> 'custos', '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_tipo := v_custo ->> 'tipo';
    insert into public.repasse_custos (repasse_id, tipo, descricao, valor, favorecido_profissional_id, favorecido_nome, ordem)
    values (v_id, v_tipo, trim(v_custo ->> 'descricao'), round((v_custo ->> 'valor')::numeric, 2),
            -- sala e insumo ficam para a clínica; na cobrança tudo é devido à clínica
            case when v_tipo in ('sala', 'insumo') or v_regra = 'cobranca' then null else nullif(v_custo ->> 'favorecido_profissional_id', '')::uuid end,
            case when v_tipo in ('sala', 'insumo') or v_regra = 'cobranca' then null else nullif(trim(v_custo ->> 'favorecido_nome'), '') end,
            v_ordem);
  end loop;
  -- veio de uma venda registrada pela Orientação Cirúrgica: marca como lançada (migração 0097)
  if nullif(p ->> 'venda_id', '') is not null then
    perform set_config('app.venda_lancando', 'on', true);
    update public.orientacao_vendas set status = 'lancada', repasse_id = v_id, conferido_por = interno.profissional_atual(), conferido_em = now()
    where id = (p ->> 'venda_id')::uuid and status = 'aguardando';
    if not found then
      raise exception 'Esta venda da Orientação Cirúrgica não está aguardando conferência (já lançada, devolvida ou cancelada).';
    end if;
    perform set_config('app.venda_lancando', '', true);
  end if;
  return v_id;
end $$;
revoke execute on function public.repasse_lancar(jsonb) from public, anon;
grant execute on function public.repasse_lancar(jsonb) to authenticated;
