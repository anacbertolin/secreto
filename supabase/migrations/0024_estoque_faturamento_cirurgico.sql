-- =====================================================================
-- 0024 — Estoque (lentes, medicamentos, materiais) e faturamento automático
--        de cirurgias e injeções intravítreas
-- =====================================================================
--  * estoque_itens / estoque_lotes / estoque_movimentos: entrada por lote (e nº de série
--    da lente), saída automática quando a lente é usada na cirurgia ou o medicamento na
--    injeção, alerta de validade e de estoque mínimo. Movimento não se apaga (corrige com ajuste).
--  * cirurgias e injeções ganham o procedimento faturável (TUSS). Ao FINALIZAR a cirurgia
--    ou REGISTRAR a injeção, o sistema abre/usa uma conta SP/SADT (ou particular) com o
--    procedimento + a lente/medicamento (se o item do estoque estiver ligado a um código).
--    Mesmo modelo do exame realizado (0010, tg_exame_conta).
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só tabelas novas e colunas opcionais nas tabelas
-- novas da 0022. Os gatilhos ficam nas tabelas novas e ignoram app.migracao = 'on'
-- (cirurgias antigas carregadas não geram conta nem baixa de estoque).
-- =====================================================================

-- ---------- Estoque ----------
create table public.estoque_itens (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null check (tipo in ('lio', 'medicamento', 'material')),
  descricao        text not null,
  fabricante       text,
  modelo           text,
  dioptria         numeric(5,2),                         -- lentes
  registro_anvisa  text,
  procedimento_id  uuid references public.procedimentos(id), -- código para faturar (tabela 19/20)
  estoque_minimo   int not null default 0 check (estoque_minimo >= 0),
  ativo            boolean not null default true,
  criado_por       uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on table public.estoque_itens is 'Catálogo do estoque: lentes intraoculares (por modelo e dioptria), medicamentos e materiais.';
create index estoque_itens_procedimento_idx on public.estoque_itens (procedimento_id);
create index estoque_itens_criado_por_idx on public.estoque_itens (criado_por);
create index estoque_itens_busca_idx on public.estoque_itens (tipo, modelo, dioptria);

create table public.estoque_lotes (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.estoque_itens(id),
  lote            text not null,
  serie           text,                                    -- lente: nº de série (uma unidade por série)
  validade        date,
  fornecedor      text,
  nota_fiscal     text,
  custo_unitario  numeric(12,2) check (custo_unitario >= 0),
  consignado      boolean not null default false,          -- lente em consignação (paga só quando usa)
  criado_por      uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.estoque_lotes is 'Lotes (e números de série das lentes) recebidos.';
create index estoque_lotes_item_idx on public.estoque_lotes (item_id);
create index estoque_lotes_lote_idx on public.estoque_lotes (lote);
create index estoque_lotes_criado_por_idx on public.estoque_lotes (criado_por);
create unique index estoque_lotes_serie_unica on public.estoque_lotes (item_id, serie) where serie is not null;

create table public.estoque_movimentos (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid not null references public.estoque_lotes(id),
  tipo            text not null check (tipo in ('entrada', 'saida', 'ajuste', 'perda', 'devolucao')),
  quantidade      numeric(10,2) not null check (quantidade <> 0), -- positivo entra, negativo sai
  paciente_id     uuid references public.pacientes(id),
  cirurgia_id     uuid references public.cirurgias(id),
  injecao_id      uuid references public.injecoes_intravitreas(id),
  motivo          text,
  registrado_por  uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em       timestamptz not null default now(),
  check ((tipo in ('entrada', 'devolucao') and quantidade > 0) or (tipo in ('saida', 'perda') and quantidade < 0) or tipo = 'ajuste'),
  check (tipo not in ('ajuste', 'perda') or coalesce(trim(motivo), '') <> '')
);
comment on table public.estoque_movimentos is 'Entradas e saídas do estoque. Não se apaga nem se altera: corrige-se com um ajuste.';
create index estoque_mov_lote_idx on public.estoque_movimentos (lote_id);
create index estoque_mov_paciente_idx on public.estoque_movimentos (paciente_id);
create index estoque_mov_cirurgia_idx on public.estoque_movimentos (cirurgia_id);
create index estoque_mov_injecao_idx on public.estoque_movimentos (injecao_id);
create index estoque_mov_registrado_por_idx on public.estoque_movimentos (registrado_por);
create unique index estoque_mov_uma_saida_cirurgia on public.estoque_movimentos (cirurgia_id, lote_id) where tipo = 'saida' and cirurgia_id is not null;
create unique index estoque_mov_uma_saida_injecao on public.estoque_movimentos (injecao_id, lote_id) where tipo = 'saida' and injecao_id is not null;

-- Saldo por lote (respeita o RLS de quem consulta)
create or replace view public.estoque_saldos with (security_invoker = true) as
  select l.id as lote_id, l.item_id, i.tipo, i.descricao, i.fabricante, i.modelo, i.dioptria, i.estoque_minimo,
         l.lote, l.serie, l.validade, l.consignado,
         coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.lote_id = l.id), 0) as saldo
  from public.estoque_lotes l join public.estoque_itens i on i.id = l.item_id
  where i.ativo;

-- ---------- Gatilhos padrão ----------
create trigger atualizado_em before update on public.estoque_itens for each row execute function interno.tg_atualizado_em();
create trigger atualizado_em before update on public.estoque_lotes for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.estoque_itens for each row execute function interno.tg_auditoria();
create trigger auditoria after insert or update or delete on public.estoque_lotes for each row execute function interno.tg_auditoria();
create trigger auditoria after insert or update or delete on public.estoque_movimentos for each row execute function interno.tg_auditoria();

-- ---------- Acesso ao estoque ----------
alter table public.estoque_itens enable row level security;
alter table public.estoque_lotes enable row level security;
alter table public.estoque_movimentos enable row level security;
revoke all on public.estoque_itens, public.estoque_lotes, public.estoque_movimentos, public.estoque_saldos from anon;
grant select on public.estoque_saldos to authenticated;

-- Leem: médico, enfermagem, admin e faturamento. Cadastram itens/lotes: enfermagem e admin.
-- Movimentos: médico, enfermagem e admin registram em nome próprio; ninguém altera nem apaga.
do $$
declare t text;
begin
  foreach t in array array['estoque_itens', 'estoque_lotes', 'estoque_movimentos'] loop
    execute format($p$create policy le on public.%I for select to authenticated
      using ((select interno.tem_funcao('medico', 'enfermagem', 'admin', 'faturamento')))$p$, t);
  end loop;
  foreach t in array array['estoque_itens', 'estoque_lotes'] loop
    execute format($p$create policy inclui on public.%I for insert to authenticated
      with check ((select interno.tem_funcao('enfermagem', 'admin')))$p$, t);
    execute format($p$create policy altera on public.%I for update to authenticated
      using ((select interno.tem_funcao('enfermagem', 'admin'))) with check ((select interno.tem_funcao('enfermagem', 'admin')))$p$, t);
  end loop;
end $$;
create policy registra on public.estoque_movimentos for insert to authenticated
  with check ((select interno.tem_funcao('medico', 'enfermagem', 'admin'))
              and registrado_por = (select interno.profissional_atual()));
-- Ligar um item ao código de faturamento também pode ser feito pelo faturamento
create policy faturamento_liga_codigo on public.estoque_itens for update to authenticated
  using ((select interno.tem_funcao('faturamento'))) with check ((select interno.tem_funcao('faturamento')));

-- ---------- Procedimento faturável nas cirurgias e injeções ----------
alter table public.cirurgias add column if not exists procedimento_id uuid references public.procedimentos(id);
alter table public.injecoes_intravitreas add column if not exists procedimento_id uuid references public.procedimentos(id);
alter table public.injecoes_intravitreas add column if not exists convenio_id uuid references public.convenios(id);
create index if not exists cirurgias_procedimento_idx on public.cirurgias (procedimento_id);
create index if not exists injecoes_procedimento_idx on public.injecoes_intravitreas (procedimento_id);
create index if not exists injecoes_convenio_idx on public.injecoes_intravitreas (convenio_id);

-- Abre (ou reaproveita) a conta SP/SADT/particular do dia e devolve o id.
create or replace function interno.conta_do_dia(p_paciente uuid, p_convenio uuid, p_data date, p_prof uuid, p_senha text, p_cid text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_pac   public.pacientes;
  v_tipo  text := case when p_convenio is null then 'particular' else 'sadt' end;
  v_conta uuid;
begin
  select * into v_pac from public.pacientes where id = p_paciente;
  select c.id into v_conta from public.contas c
  where c.paciente_id = p_paciente and c.status = 'aberta' and c.tipo_guia = v_tipo
    and c.convenio_id is not distinct from p_convenio and c.data_atendimento = p_data
    and c.senha_autorizacao is not distinct from p_senha   -- cada autorização (senha) tem a sua guia
  order by c.criado_em desc limit 1;
  if v_conta is null then
    insert into public.contas (paciente_id, data_atendimento, convenio_id, plano_id, tipo_guia, carteirinha, validade_carteirinha,
                               profissional_id, solicitante_id, senha_autorizacao, cid10, criado_por)
    values (p_paciente, p_data, p_convenio,
            case when p_convenio = v_pac.convenio_id then v_pac.plano_id end, v_tipo,
            case when p_convenio = v_pac.convenio_id then v_pac.convenio_carteirinha end,
            case when p_convenio = v_pac.convenio_id then v_pac.convenio_validade end,
            p_prof, p_prof, p_senha, p_cid, interno.profissional_atual())
    returning id into v_conta;
  end if;
  return v_conta;
end $$;
revoke execute on function interno.conta_do_dia(uuid, uuid, date, uuid, text, text) from public, anon, authenticated;

-- Cirurgia finalizada: baixa a lente do estoque e lança a conta
create or replace function interno.tg_cirurgia_finalizada()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_lote  public.estoque_lotes;
  v_item  public.estoque_itens;
  v_conta uuid;
  v_data  date;
begin
  if coalesce(current_setting('app.migracao', true), '') = 'on' then
    return null;
  end if;
  if new.finalizada_em is null or old.finalizada_em is not null then
    return null;
  end if;
  v_data := (new.finalizada_em at time zone 'America/Sao_Paulo')::date;

  -- Lente usada: procura no estoque pelo lote (e série, se houver)
  if new.lio_lote is not null then
    select l.* into v_lote from public.estoque_lotes l join public.estoque_itens i on i.id = l.item_id
    where i.tipo = 'lio' and l.lote = new.lio_lote and (new.lio_serie is null or l.serie = new.lio_serie)
    order by (l.serie is not distinct from new.lio_serie) desc limit 1;
    if v_lote.id is not null then
      select * into v_item from public.estoque_itens where id = v_lote.item_id;
      insert into public.estoque_movimentos (lote_id, tipo, quantidade, paciente_id, cirurgia_id, motivo, registrado_por)
      values (v_lote.id, 'saida', -1, new.paciente_id, new.id, 'Implantada na cirurgia', interno.profissional_atual())
      on conflict do nothing;
    end if;
  end if;

  -- Conta: procedimento + lente (só se houver algo faturável)
  if new.procedimento_id is not null or v_item.procedimento_id is not null then
    v_conta := interno.conta_do_dia(new.paciente_id, new.convenio_id, v_data, new.cirurgiao_id, new.senha_autorizacao, null);
    if new.procedimento_id is not null then
      insert into public.conta_itens (conta_id, procedimento_id, data_execucao, olho, profissional_id)
      values (v_conta, new.procedimento_id, v_data, new.olho, new.cirurgiao_id);
    end if;
    if v_item.procedimento_id is not null then
      insert into public.conta_itens (conta_id, procedimento_id, data_execucao, olho, quantidade, descricao)
      values (v_conta, v_item.procedimento_id, v_data, new.olho, 1,
              concat_ws(' ', v_item.descricao, v_item.modelo, case when v_item.dioptria is not null then v_item.dioptria::text || 'D' end,
                        'lote ' || v_lote.lote, case when v_lote.serie is not null then 'série ' || v_lote.serie end));
    end if;
  end if;
  return null;
end $$;
create trigger faturamento_estoque after update on public.cirurgias
  for each row execute function interno.tg_cirurgia_finalizada();

-- Injeção registrada: baixa o medicamento do estoque e lança a conta
create or replace function interno.tg_injecao_registrada()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_lote  public.estoque_lotes;
  v_item  public.estoque_itens;
  v_conta uuid;
  v_data  date := (new.aplicado_em at time zone 'America/Sao_Paulo')::date;
  v_conv  uuid;
begin
  if coalesce(current_setting('app.migracao', true), '') = 'on' or new.cancelada then
    return null;
  end if;
  if new.lote is not null then
    select l.* into v_lote from public.estoque_lotes l join public.estoque_itens i on i.id = l.item_id
    where i.tipo = 'medicamento' and l.lote = new.lote order by l.criado_em desc limit 1;
    if v_lote.id is not null then
      select * into v_item from public.estoque_itens where id = v_lote.item_id;
      insert into public.estoque_movimentos (lote_id, tipo, quantidade, paciente_id, injecao_id, motivo, registrado_por)
      values (v_lote.id, 'saida', -1, new.paciente_id, new.id, 'Injeção intravítrea', interno.profissional_atual())
      on conflict do nothing;
    end if;
  end if;
  if new.procedimento_id is not null or v_item.procedimento_id is not null then
    v_conv := coalesce(new.convenio_id, (select p.convenio_id from public.pacientes p where p.id = new.paciente_id));
    v_conta := interno.conta_do_dia(new.paciente_id, v_conv, v_data, new.aplicado_por, new.senha_autorizacao, new.indicacao_cid10);
    if new.procedimento_id is not null then
      insert into public.conta_itens (conta_id, procedimento_id, data_execucao, olho, profissional_id)
      values (v_conta, new.procedimento_id, v_data, new.olho, new.aplicado_por);
    end if;
    if v_item.procedimento_id is not null then
      insert into public.conta_itens (conta_id, procedimento_id, data_execucao, olho, quantidade, descricao)
      values (v_conta, v_item.procedimento_id, v_data, new.olho, 1, concat_ws(' ', v_item.descricao, 'lote ' || v_lote.lote));
    end if;
  end if;
  return null;
end $$;
create trigger faturamento_estoque after insert on public.injecoes_intravitreas
  for each row execute function interno.tg_injecao_registrada();
