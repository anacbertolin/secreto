-- =====================================================================
-- 0071 — Repasse: três tipos de lançamento, anestesista e novos procedimentos
-- =====================================================================
-- Decisões da dona (23/11/2026):
--  • 'geral' (o que já existia): valor − imposto 15% − taxa do cartão − custos = honorários → 20% clínica / 80% médico.
--  • 'direto' (ex.: Clínica Vital, que traz pacientes de catarata e paga R$ 1.500 por cirurgia):
--      SEM imposto e SEM os 20%: médico = valor − taxa do cartão (se houver) − custos.
--      Ex.: 1.500 − centro cirúrgico 1.000 (fica para a clínica) = 500 para o cirurgião.
--  • 'cobranca' (ex.: pacientes do consultório do Dr. Pedro em Campo Grande): o paciente paga ao médico lá fora e o
--      MÉDICO FICA DEVENDO à clínica a taxa de sala, a lente etc. Valor = soma dos custos; nada vai para o médico;
--      a "parcela" é o pagamento do médico à clínica (marcar quando ele pagar). Sem imposto.
--  • Novo tipo de custo 'anestesista' (o Luciano transfere, como o auxiliar).
--  • Lente (Hoya) é comprada pela clínica: custo do tipo 'insumo', fica para a clínica, antes da divisão.
-- Procedimentos novos (PDFs de 23/11): Gisele — Blefaroplastia com castanhares, Ptose palpebral, Tumor de carúncula,
--   Cisto, Cisto com biópsia (sem custo de laboratório); Pedro — Fascectomia, Fascectomia + TREC;
--   Pedro/Campo Grande (cobrança) — Cirurgia Campo Grande (sala 1.100 + lente 320), Ciclofoto Campo Grande (1.500);
--   Catarata — Clínica Vital (direto; valor 1.500, centro cirúrgico 1.000). O PDF da Clínica Vital trazia sala 1.100;
--   a dona informou 1.000 — usado 1.000 (editável na tela).
-- =====================================================================

-- ---------- tipo de lançamento ----------
alter table public.repasses
  add column regra text not null default 'geral' check (regra in ('geral', 'direto', 'cobranca'));
alter table public.repasse_procedimentos
  add column regra text not null default 'geral' check (regra in ('geral', 'direto', 'cobranca'));

-- ---------- custo "anestesista" ----------
alter table public.repasse_custos drop constraint repasse_custos_tipo_check;
alter table public.repasse_custos add constraint repasse_custos_tipo_check
  check (tipo in ('sala', 'instrumentacao', 'auxiliar', 'anestesista', 'insumo', 'outro'));
alter table public.repasse_procedimento_custos drop constraint repasse_procedimento_custos_tipo_check;
alter table public.repasse_procedimento_custos add constraint repasse_procedimento_custos_tipo_check
  check (tipo in ('sala', 'instrumentacao', 'auxiliar', 'anestesista', 'insumo', 'outro'));

-- ---------- lançamento ----------
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
  return v_id;
end $$;
revoke execute on function public.repasse_lancar(jsonb) from public, anon;
grant execute on function public.repasse_lancar(jsonb) to authenticated;

-- ---------- cálculo por tipo de lançamento ----------
create or replace function interno.tg_repasse_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cfg public.repasse_config; v_conta public.contas; v_bruto numeric; v_honorarios numeric;
begin
  if tg_op = 'INSERT' then
    if new.forma_pagamento <> 'credito' then
      new.parcelas := 1;
    end if;
    if new.conta_id is not null then
      select * into v_conta from public.contas where id = new.conta_id;
      if v_conta.convenio_id is not null then
        raise exception 'O repasse v1 é só para cirurgia particular. Esta conta é de convênio.';
      end if;
      if v_conta.status = 'cancelada' then
        raise exception 'Esta conta foi cancelada.';
      end if;
      new.paciente_id := coalesce(new.paciente_id, v_conta.paciente_id);
    end if;
    if not exists (select 1 from public.profissionais where id = new.profissional_id and funcao = 'medico') then
      raise exception 'Escolha o médico.';
    end if;

    select * into v_cfg from public.repasse_config limit 1;
    new.taxa_arredondamento := v_cfg.taxa_arredondamento;
    new.custos_total := coalesce(nullif(current_setting('app.repasse_custos', true), '')::numeric, 0);

    if new.regra = 'cobranca' then
      -- o médico deve os custos à clínica; nada vai para ele
      new.imposto_pct := 0; new.centro_cirurgico_pct := 0; new.taxa_interna_pct := 0;
      new.imposto_total := 0; new.taxa_interna_total := 0;
      new.valor_total := new.custos_total;
      new.centro_cirurgico_total := 0; new.medico_total := 0;
    else
      if new.forma_pagamento in ('credito', 'debito') then
        new.taxa_interna_pct := null;
        select t.taxa_total into new.taxa_interna_pct from public.repasse_taxas_cartao t
        where t.forma = new.forma_pagamento and t.parcelas = new.parcelas;
        if new.taxa_interna_pct is null then
          raise exception 'Não há taxa cadastrada para % em %x. Cadastre na tabela de taxas do repasse.',
            case new.forma_pagamento when 'debito' then 'débito' else 'crédito' end, new.parcelas;
        end if;
      else
        new.taxa_interna_pct := 0;
      end if;
      if new.regra = 'direto' then
        new.imposto_pct := 0; new.centro_cirurgico_pct := 0;
      else
        new.imposto_pct := v_cfg.imposto_pct; new.centro_cirurgico_pct := v_cfg.centro_cirurgico_pct;
      end if;
      new.imposto_total := round(new.valor_total * new.imposto_pct / 100, 2);
      v_bruto := new.valor_total * new.taxa_interna_pct / 100;
      new.taxa_interna_total := case when new.taxa_arredondamento = 'arredondar' then round(v_bruto, 2) else trunc(v_bruto, 2) end;
      v_honorarios := new.valor_total - new.imposto_total - new.taxa_interna_total - new.custos_total;
      if v_honorarios < 0 then
        raise exception 'Imposto, taxa do cartão e custos (R$ %) passam do valor da cirurgia (R$ %). Confira os valores.',
          new.imposto_total + new.taxa_interna_total + new.custos_total, new.valor_total;
      end if;
      new.centro_cirurgico_total := round(v_honorarios * new.centro_cirurgico_pct / 100, 2);
      new.medico_total := v_honorarios - new.centro_cirurgico_total;
    end if;
    new.status := 'aberto';
    new.motivo_cancelamento := null;
    return new;
  end if;

  if (new.valor_total, new.forma_pagamento, new.parcelas, new.imposto_pct, new.centro_cirurgico_pct,
      new.taxa_interna_pct, new.taxa_arredondamento, new.imposto_total, new.centro_cirurgico_total,
      new.taxa_interna_total, new.medico_total, new.custos_total, new.procedimento_id, new.regra,
      new.profissional_id, new.data_pagamento, new.conta_id, new.criado_por, new.criado_em, new.numero)
     is distinct from
     (old.valor_total, old.forma_pagamento, old.parcelas, old.imposto_pct, old.centro_cirurgico_pct,
      old.taxa_interna_pct, old.taxa_arredondamento, old.imposto_total, old.centro_cirurgico_total,
      old.taxa_interna_total, old.medico_total, old.custos_total, old.procedimento_id, old.regra,
      old.profissional_id, old.data_pagamento, old.conta_id, old.criado_por, old.criado_em, old.numero) then
    raise exception 'Valor, forma de pagamento, parcelas, custos e médico não mudam depois de lançados. Cancele este repasse e lance de novo.';
  end if;
  if old.status = 'cancelado' and (new.status <> 'cancelado' or new.motivo_cancelamento is distinct from old.motivo_cancelamento) then
    raise exception 'Repasse cancelado não pode ser reaberto. Lance um novo.';
  end if;
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    if coalesce(trim(new.motivo_cancelamento), '') = '' then
      raise exception 'Informe o motivo do cancelamento.';
    end if;
    if exists (select 1 from public.repasse_parcelas where repasse_id = new.id and pago_medico_em is not null) then
      raise exception 'Já há parcela paga ao médico neste repasse. Desmarque o pagamento antes de cancelar.';
    end if;
    if exists (select 1 from public.repasse_custos where repasse_id = new.id and pago_em is not null) then
      raise exception 'Já há custo pago (auxiliar/instrumentação/anestesista) neste repasse. Desmarque o pagamento antes de cancelar.';
    end if;
    if new.regra = 'cobranca' and exists (select 1 from public.repasse_parcelas where repasse_id = new.id and recebido_em is not null) then
      raise exception 'O médico já pagou esta cobrança. Desmarque o pagamento antes de cancelar.';
    end if;
  end if;
  return new;
end $$;

-- ---------- parcelas: na cobrança, nada entra sozinho (marca quando o médico pagar) ----------
create or replace function interno.tg_repasse_parcelas_criar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  i int;
  n int := new.parcelas;
  v_imp numeric(12,2) := trunc(new.imposto_total / n, 2);
  v_tx  numeric(12,2) := trunc(new.taxa_interna_total / n, 2);
  v_cu  numeric(12,2) := trunc(new.custos_total / n, 2);
  v_cc  numeric(12,2) := trunc(new.centro_cirurgico_total / n, 2);
  v_med numeric(12,2) := trunc(new.medico_total / n, 2);
  a numeric(12,2); b numeric(12,2); k numeric(12,2); c numeric(12,2); d numeric(12,2);
  v_vista boolean := new.forma_pagamento in ('dinheiro', 'pix') and new.regra <> 'cobranca';
begin
  for i in 1..n loop
    a := case when i = n then new.imposto_total          - v_imp * (n - 1) else v_imp end;
    b := case when i = n then new.taxa_interna_total     - v_tx  * (n - 1) else v_tx  end;
    k := case when i = n then new.custos_total           - v_cu  * (n - 1) else v_cu  end;
    c := case when i = n then new.centro_cirurgico_total - v_cc  * (n - 1) else v_cc  end;
    d := case when i = n then new.medico_total           - v_med * (n - 1) else v_med end;
    insert into public.repasse_parcelas (repasse_id, numero, data_prevista, valor, imposto, taxa_interna, custos,
                                         centro_cirurgico, medico, valor_recebido, recebido_em)
    values (new.id, i,
            case when new.forma_pagamento = 'credito' then (new.data_pagamento + make_interval(months => i))::date
                 else new.data_pagamento end,
            a + b + k + c + d, a, b, k, c, d,
            case when v_vista then new.valor_total end,
            case when v_vista then new.data_pagamento end);
  end loop;
  return null;
end $$;

-- ---------- parcela: na cobrança não há pagamento ao médico ----------
create or replace function interno.tg_repasse_parcela_calculo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text; v_regra text;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;
  select status, regra into v_status, v_regra from public.repasses where id = old.repasse_id;
  if v_status = 'cancelado' then
    raise exception 'Este repasse foi cancelado: as parcelas não mudam.';
  end if;
  new.repasse_id := old.repasse_id; new.numero := old.numero; new.valor := old.valor;
  new.imposto := old.imposto; new.taxa_interna := old.taxa_interna; new.custos := old.custos;
  new.centro_cirurgico := old.centro_cirurgico; new.medico := old.medico;
  if v_regra = 'cobranca' and new.pago_medico_em is not null then
    raise exception 'Numa cobrança o médico paga à clínica: marque só "Médico pagou".';
  end if;
  if new.pago_medico_em is not null and new.recebido_em is null then
    raise exception 'Marque que a parcela % entrou antes de marcar o pagamento ao médico.', new.numero;
  end if;
  return new;
end $$;

-- ---------- situação: cobrança fica "concluída" quando o médico paga ----------
create or replace function interno.tg_repasse_situacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_regra text; v_novo text;
begin
  select regra into v_regra from public.repasses where id = new.repasse_id;
  if v_regra = 'cobranca' then
    v_novo := case when exists (select 1 from public.repasse_parcelas p where p.repasse_id = new.repasse_id and p.recebido_em is null)
                   then 'aberto' else 'concluido' end;
  else
    v_novo := case when exists (select 1 from public.repasse_parcelas p where p.repasse_id = new.repasse_id and p.pago_medico_em is null)
                   then 'aberto' else 'concluido' end;
  end if;
  update public.repasses r set status = v_novo
  where r.id = new.repasse_id and r.status <> 'cancelado' and r.status is distinct from v_novo;
  return null;
end $$;
drop trigger situacao on public.repasse_parcelas;
create trigger situacao after update of pago_medico_em, recebido_em on public.repasse_parcelas
  for each row execute function interno.tg_repasse_situacao();

-- ---------- procedimentos novos (PDFs de 23/11/2026) ----------
insert into public.repasse_procedimentos (nome, profissional_id, valor_sugerido, regra, observacoes)
select x.nome, (select id from public.profissionais where nome ilike x.medico || '%' and funcao = 'medico' limit 1), x.valor, x.regra, x.obs
from (values
  ('Blefaroplastia com castanhares', 'Gisele', 9900.00,  'geral', null),
  ('Ptose palpebral',                'Gisele', 8000.00,  'geral', null),
  ('Tumor de carúncula',             'Gisele', 3000.00,  'geral', null),
  ('Cisto',                          'Gisele', 1600.00,  'geral', null),
  ('Cisto com biópsia',              'Gisele', 2600.00,  'geral', 'A biópsia não tem custo de laboratório.'),
  ('Fascectomia',                    'Pedro',  5500.00,  'geral', null),
  ('Fascectomia + TREC',             'Pedro',  10500.00, 'geral', null),
  ('Cirurgia Campo Grande (cobrança)', 'Pedro', null,    'cobranca', 'Paciente do consultório do Dr. Pedro em Campo Grande: ele deve à clínica a taxa de sala e a lente.'),
  ('Ciclofoto Campo Grande (cobrança)', 'Pedro', null,   'cobranca', 'Paciente do consultório do Dr. Pedro em Campo Grande: ele deve à clínica o custo da cirurgia.')
) x(nome, medico, valor, regra, obs);
insert into public.repasse_procedimentos (nome, profissional_id, valor_sugerido, regra, observacoes) values
  ('Catarata — Clínica Vital', null, 1500.00, 'direto',
   'A Clínica Vital paga R$ 1.500 por cirurgia: R$ 1.000 ficam para o centro cirúrgico e R$ 500 para o cirurgião. Sem imposto e sem os 20%.');

insert into public.repasse_procedimento_custos (procedimento_id, tipo, descricao, valor, favorecido_profissional_id, favorecido_nome, ordem)
select p.id, c.tipo, c.descricao, c.valor,
       case when c.tipo = 'auxiliar' then (select id from public.profissionais where nome ilike 'Matheus%' and funcao = 'medico' limit 1) end,
       case when c.tipo = 'instrumentacao' and p.regra <> 'cobranca' then 'Instrumentação'
            when c.tipo = 'anestesista' then 'Anestesista' end,
       c.ordem
from public.repasse_procedimentos p
join (values
  ('Blefaroplastia com castanhares', 'auxiliar',       'Auxiliar',              2000.00, 1),
  ('Blefaroplastia com castanhares', 'sala',           'Taxa de sala',           900.00, 2),
  ('Blefaroplastia com castanhares', 'instrumentacao', 'Instrumentação',         250.00, 3),
  ('Ptose palpebral',                'auxiliar',       'Auxiliar',              1500.00, 1),
  ('Ptose palpebral',                'sala',           'Taxa de sala',           500.00, 2),
  ('Ptose palpebral',                'instrumentacao', 'Instrumentação',         200.00, 3),
  ('Tumor de carúncula',             'auxiliar',       'Auxiliar',               750.00, 1),
  ('Tumor de carúncula',             'sala',           'Taxa de sala',           200.00, 2),
  ('Tumor de carúncula',             'instrumentacao', 'Instrumentação',         100.00, 3),
  ('Cisto',                          'sala',           'Taxa de sala',           200.00, 1),
  ('Cisto',                          'instrumentacao', 'Instrumentação',         100.00, 2),
  ('Cisto com biópsia',              'sala',           'Taxa de sala',           200.00, 1),
  ('Cisto com biópsia',              'instrumentacao', 'Instrumentação',         100.00, 2),
  ('Fascectomia',                    'sala',           'Taxa de sala',          1100.00, 1),
  ('Fascectomia',                    'insumo',         'Lente Hoya',             320.00, 2),
  ('Fascectomia',                    'anestesista',    'Anestesista',            350.00, 3),
  ('Fascectomia',                    'instrumentacao', 'Instrumentação',         100.00, 4),
  ('Fascectomia + TREC',             'sala',           'Taxa de sala',          1800.00, 1),
  ('Fascectomia + TREC',             'insumo',         'Lente intraocular Hoya', 320.00, 2),
  ('Fascectomia + TREC',             'anestesista',    'Anestesista',            800.00, 3),
  ('Fascectomia + TREC',             'instrumentacao', 'Instrumentação',         200.00, 4),
  ('Cirurgia Campo Grande (cobrança)', 'sala',         'Taxa de sala',          1100.00, 1),
  ('Cirurgia Campo Grande (cobrança)', 'insumo',       'Lente Hoya',             320.00, 2),
  ('Ciclofoto Campo Grande (cobrança)', 'sala',        'Custo da cirurgia',     1500.00, 1),
  ('Catarata — Clínica Vital',       'sala',           'Centro cirúrgico',      1000.00, 1)
) c(proc, tipo, descricao, valor, ordem) on c.proc = p.nome;
