-- =====================================================================
-- 0066 — Caixa da Recepção (pedido da dona, 18–19/11/2026)
--
-- Substitui a folha de papel do caixa. Funciona SOZINHO: não depende da
-- agenda, do prontuário nem do cadastro de pacientes do nosso sistema
-- (enquanto o Micrologos for o oficial, o nome do paciente é digitado).
-- NÃO tem relação com o Repasse médico (0060–0062): tabelas separadas.
--
-- Caminho do caixa (um caixa só para a clínica, um por dia):
--   1. ABERTO     — recepção abre com o fundo de troco e lança recebimentos,
--                   cortesias e saídas.
--   2. FECHADO    — quem está no caixa conta a gaveta e fecha; o sistema guarda
--                   o esperado e a diferença. Ninguém altera mais nada.
--   3. CONFERIDO  — alguém marcado "confere o caixa" (meninas do telefone/WhatsApp)
--                   confere; pode DEVOLVER para correção (volta a ABERTO).
--                   Quem fechou não confere o próprio caixa.
--   4. APROVADO   — alguém marcado "aprova o caixa" (Luciano, Soraline) aprova.
--
-- Formas: dinheiro, PIX (separado!), débito, crédito à vista, crédito parcelado.
-- Cortesia: atendimento sem cobrança, com motivo e quem autorizou (no
-- Micrologos era lançado como R$ 0,01 — confirmado pela dona em 18/11).
-- Pagamento parcial: o atendimento guarda o valor; os pagamentos podem ser
-- vários (inclusive em outro dia/caixa); "falta receber" = valor − pago.
-- Nada é apagado: lançamentos, pagamentos e saídas são CANCELADOS com motivo.
-- =====================================================================

-- ---------- Quem confere / aprova (marcado na tela Equipe) ----------
alter table public.profissionais
  add column caixa_conferir boolean not null default false,
  add column caixa_aprovar  boolean not null default false;
comment on column public.profissionais.caixa_conferir is 'Confere o caixa da recepção depois de fechado (telefone/WhatsApp).';
comment on column public.profissionais.caixa_aprovar  is 'Dá a aprovação final do caixa da recepção (supervisão).';

create or replace function interno.caixa_papel(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case p
      when 'lancar'   then pr.funcao in ('recepcao', 'admin')
      when 'conferir' then pr.caixa_conferir or pr.funcao = 'admin'
      when 'aprovar'  then pr.caixa_aprovar  or pr.funcao = 'admin'
      when 'ver'      then pr.funcao in ('recepcao', 'admin') or pr.caixa_conferir or pr.caixa_aprovar
      else false end
    from public.profissionais pr
    where pr.email = interno.email_atual() and pr.ativo), false)
$$;
revoke execute on function interno.caixa_papel(text) from public, anon;
grant execute on function interno.caixa_papel(text) to authenticated, service_role;

-- ---------- Caixas ----------
create table public.caixas (
  id                  uuid primary key default gen_random_uuid(),
  data                date not null default (now() at time zone 'America/Sao_Paulo')::date,
  status              text not null default 'aberto' check (status in ('aberto', 'fechado', 'conferido', 'aprovado')),
  fundo_troco         numeric(12,2) not null default 0 check (fundo_troco >= 0),
  aberto_por          uuid references public.profissionais(id) default interno.profissional_atual(),
  aberto_em           timestamptz not null default now(),
  -- fechamento (guardado no momento em que fecha)
  fechado_por         uuid references public.profissionais(id),
  fechado_em          timestamptz,
  esperado_dinheiro   numeric(12,2),
  contado_dinheiro    numeric(12,2),
  diferenca_dinheiro  numeric(12,2),
  obs_fechamento      text,
  -- conferência
  conferido_por       uuid references public.profissionais(id),
  conferido_em        timestamptz,
  obs_conferencia     text,
  -- aprovação
  aprovado_por        uuid references public.profissionais(id),
  aprovado_em         timestamptz,
  obs_aprovacao       text,
  -- devolução para correção (a última)
  devolvido_por       uuid references public.profissionais(id),
  devolvido_em        timestamptz,
  motivo_devolucao    text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
-- um caixa só: no máximo um aberto de cada vez
create unique index caixas_um_aberto on public.caixas ((true)) where status = 'aberto';
create index caixas_data_idx on public.caixas (data desc);
create index caixas_aberto_por_idx on public.caixas (aberto_por);
create index caixas_fechado_por_idx on public.caixas (fechado_por);
create index caixas_conferido_por_idx on public.caixas (conferido_por);
create index caixas_aprovado_por_idx on public.caixas (aprovado_por);
create index caixas_devolvido_por_idx on public.caixas (devolvido_por);

-- ---------- Atendimentos lançados no caixa ----------
create table public.caixa_atendimentos (
  id                  uuid primary key default gen_random_uuid(),
  caixa_id            uuid not null references public.caixas(id),
  paciente_nome       text not null check (length(trim(paciente_nome)) > 1),
  paciente_id         uuid references public.pacientes(id),          -- opcional (futuro: agenda)
  medico_id           uuid references public.profissionais(id),
  descricao           text,                                          -- consulta, exame, cirurgia…
  valor               numeric(12,2) not null default 0 check (valor >= 0),
  cortesia            boolean not null default false,
  motivo_cortesia     text,
  cortesia_autorizada_por text,
  observacao          text,
  cancelado           boolean not null default false,
  motivo_cancelamento text,
  cancelado_por       uuid references public.profissionais(id),
  cancelado_em        timestamptz,
  criado_por          uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (not cortesia or (valor = 0 and coalesce(trim(motivo_cortesia), '') <> '')),
  check (not cancelado or coalesce(trim(motivo_cancelamento), '') <> '')
);
create index caixa_atend_caixa_idx on public.caixa_atendimentos (caixa_id);
create index caixa_atend_paciente_idx on public.caixa_atendimentos (paciente_id);
create index caixa_atend_medico_idx on public.caixa_atendimentos (medico_id);
create index caixa_atend_criado_por_idx on public.caixa_atendimentos (criado_por);
create index caixa_atend_cancelado_por_idx on public.caixa_atendimentos (cancelado_por);

-- ---------- Pagamentos (vários por atendimento; podem cair em outro caixa) ----------
create table public.caixa_pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  caixa_id            uuid not null references public.caixas(id),
  atendimento_id      uuid not null references public.caixa_atendimentos(id),
  forma               text not null check (forma in ('dinheiro', 'pix', 'debito', 'credito_vista', 'credito_parcelado')),
  parcelas            int not null default 1 check (parcelas between 1 and 24),
  valor               numeric(12,2) not null check (valor > 0),
  pagador             text,                                          -- nome de quem pagou (PIX)
  cancelado           boolean not null default false,
  motivo_cancelamento text,
  cancelado_por       uuid references public.profissionais(id),
  cancelado_em        timestamptz,
  criado_por          uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check ((forma = 'credito_parcelado') = (parcelas >= 2)),
  check (not cancelado or coalesce(trim(motivo_cancelamento), '') <> '')
);
create index caixa_pag_caixa_idx on public.caixa_pagamentos (caixa_id);
create index caixa_pag_atend_idx on public.caixa_pagamentos (atendimento_id);
create index caixa_pag_criado_por_idx on public.caixa_pagamentos (criado_por);
create index caixa_pag_cancelado_por_idx on public.caixa_pagamentos (cancelado_por);

-- ---------- Saídas / sangrias ----------
create table public.caixa_saidas (
  id                  uuid primary key default gen_random_uuid(),
  caixa_id            uuid not null references public.caixas(id),
  valor               numeric(12,2) not null check (valor > 0),
  motivo              text not null check (length(trim(motivo)) > 1),
  autorizado_por      text,
  cancelado           boolean not null default false,
  motivo_cancelamento text,
  cancelado_por       uuid references public.profissionais(id),
  cancelado_em        timestamptz,
  criado_por          uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (not cancelado or coalesce(trim(motivo_cancelamento), '') <> '')
);
create index caixa_saidas_caixa_idx on public.caixa_saidas (caixa_id);
create index caixa_saidas_criado_por_idx on public.caixa_saidas (criado_por);
create index caixa_saidas_cancelado_por_idx on public.caixa_saidas (cancelado_por);

-- ---------- Regras: só mexe em caixa ABERTO; cancelar é a única alteração ----------
create or replace function interno.tg_caixa_movimento()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  select c.status into v_status from public.caixas c where c.id = new.caixa_id;
  if v_status is distinct from 'aberto' then
    raise exception 'Este caixa já foi fechado: não dá para lançar nem alterar. Peça para devolverem o caixa para correção.';
  end if;
  if tg_op = 'INSERT' then
    new.criado_por := interno.profissional_atual();
    new.criado_em  := now();
    new.cancelado  := false;
    new.cancelado_por := null; new.cancelado_em := null; new.motivo_cancelamento := null;
    if tg_table_name = 'caixa_pagamentos' then
      -- o pagamento entra no caixa aberto; o atendimento pode ser de outro dia (saldo pendente)
      if exists (select 1 from public.caixa_atendimentos a where a.id = new.atendimento_id and (a.cancelado or a.cortesia)) then
        raise exception 'Este atendimento está cancelado ou é cortesia: não recebe pagamento.';
      end if;
    end if;
    return new;
  end if;
  -- UPDATE
  if new.caixa_id <> old.caixa_id or new.criado_por is distinct from old.criado_por or new.criado_em <> old.criado_em then
    raise exception 'Não é permitido mudar o caixa ou o autor de um lançamento.';
  end if;
  if old.cancelado then
    raise exception 'Este lançamento já foi cancelado.';
  end if;
  if new.cancelado then
    new.cancelado_por := interno.profissional_atual();
    new.cancelado_em  := now();
  end if;
  return new;
end $$;

create trigger regras before insert or update on public.caixa_atendimentos for each row execute function interno.tg_caixa_movimento();
create trigger regras before insert or update on public.caixa_pagamentos  for each row execute function interno.tg_caixa_movimento();
create trigger regras before insert or update on public.caixa_saidas      for each row execute function interno.tg_caixa_movimento();

-- pagamento de atendimento: não pode passar do valor do atendimento
create or replace function interno.tg_caixa_pagamento_limite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_valor numeric; v_pago numeric;
begin
  if new.cancelado then return new; end if;
  select a.valor into v_valor from public.caixa_atendimentos a where a.id = new.atendimento_id;
  select coalesce(sum(p.valor), 0) into v_pago from public.caixa_pagamentos p
   where p.atendimento_id = new.atendimento_id and not p.cancelado and p.id <> new.id;
  if v_pago + new.valor > v_valor then
    raise exception 'O pagamento passa do valor do atendimento (falta receber só R$ %).', to_char(v_valor - v_pago, 'FM999G999G990D00');
  end if;
  return new;
end $$;
create trigger limite after insert or update on public.caixa_pagamentos for each row execute function interno.tg_caixa_pagamento_limite();

-- valor do atendimento não pode ficar menor que o já pago
create or replace function interno.tg_caixa_atendimento_valor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cancelado and not old.cancelado then
    if exists (select 1 from public.caixa_pagamentos p where p.atendimento_id = new.id and not p.cancelado) then
      raise exception 'Cancele primeiro os pagamentos deste atendimento.';
    end if;
  elsif new.valor < (select coalesce(sum(p.valor), 0) from public.caixa_pagamentos p where p.atendimento_id = new.id and not p.cancelado) then
    raise exception 'O valor não pode ficar menor do que o já recebido.';
  end if;
  return new;
end $$;
create trigger valor before update on public.caixa_atendimentos for each row execute function interno.tg_caixa_atendimento_valor();

-- ---------- Auditoria e atualizado_em (padrão do sistema) ----------
do $$
declare t text;
begin
  foreach t in array array['caixas', 'caixa_atendimentos', 'caixa_pagamentos', 'caixa_saidas'] loop
    execute format('create trigger atualizado_em before update on public.%I for each row execute function interno.tg_atualizado_em()', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function interno.tg_auditoria()', t);
  end loop;
end $$;

-- ---------- Ações do caixa (só por estas funções; ninguém altera "caixas" direto) ----------
create or replace function public.caixa_abrir(p_fundo numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not interno.caixa_papel('lancar') then raise exception 'Só a recepção ou a administração abre o caixa.'; end if;
  if exists (select 1 from public.caixas where status = 'aberto') then
    raise exception 'Já existe um caixa aberto. Feche-o antes de abrir outro.';
  end if;
  insert into public.caixas (fundo_troco, aberto_por) values (coalesce(p_fundo, 0), interno.profissional_atual())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.caixa_esperado_dinheiro(p_caixa uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select c.fundo_troco
       + coalesce((select sum(p.valor) from public.caixa_pagamentos p where p.caixa_id = c.id and p.forma = 'dinheiro' and not p.cancelado), 0)
       - coalesce((select sum(s.valor) from public.caixa_saidas s where s.caixa_id = c.id and not s.cancelado), 0)
  from public.caixas c where c.id = p_caixa and interno.caixa_papel('ver')
$$;

create or replace function public.caixa_fechar(p_caixa uuid, p_contado numeric, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_esp numeric;
begin
  if not interno.caixa_papel('lancar') then raise exception 'Só a recepção ou a administração fecha o caixa.'; end if;
  if p_contado is null or p_contado < 0 then raise exception 'Informe quanto dinheiro foi contado na gaveta.'; end if;
  perform 1 from public.caixas where id = p_caixa and status = 'aberto' for update;
  if not found then raise exception 'Este caixa não está aberto.'; end if;
  v_esp := public.caixa_esperado_dinheiro(p_caixa);
  update public.caixas set
    status = 'fechado', fechado_por = interno.profissional_atual(), fechado_em = now(),
    esperado_dinheiro = v_esp, contado_dinheiro = p_contado, diferenca_dinheiro = p_contado - v_esp,
    obs_fechamento = nullif(trim(coalesce(p_obs, '')), '')
  where id = p_caixa;
end $$;

create or replace function public.caixa_conferir(p_caixa uuid, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_fechou uuid;
begin
  if not interno.caixa_papel('conferir') then raise exception 'Você não está marcada(o) para conferir o caixa (tela Equipe).'; end if;
  select fechado_por into v_fechou from public.caixas where id = p_caixa and status = 'fechado' for update;
  if not found then raise exception 'Só dá para conferir um caixa fechado.'; end if;
  if v_fechou = interno.profissional_atual() then raise exception 'Quem fechou o caixa não pode conferir o próprio caixa.'; end if;
  update public.caixas set status = 'conferido', conferido_por = interno.profissional_atual(), conferido_em = now(),
    obs_conferencia = nullif(trim(coalesce(p_obs, '')), '')
  where id = p_caixa;
end $$;

create or replace function public.caixa_devolver(p_caixa uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escreva o motivo da devolução.'; end if;
  select status into v_status from public.caixas where id = p_caixa for update;
  if v_status = 'fechado' and not interno.caixa_papel('conferir') then raise exception 'Só quem confere pode devolver o caixa.'; end if;
  if v_status = 'conferido' and not interno.caixa_papel('aprovar') then raise exception 'Só quem aprova pode devolver um caixa conferido.'; end if;
  if v_status is null or v_status not in ('fechado', 'conferido') then raise exception 'Só dá para devolver um caixa fechado ou conferido.'; end if;
  if exists (select 1 from public.caixas where status = 'aberto') then
    raise exception 'Há outro caixa aberto agora. Feche-o antes de devolver este para correção.';
  end if;
  update public.caixas set status = 'aberto',
    fechado_por = null, fechado_em = null, esperado_dinheiro = null, contado_dinheiro = null, diferenca_dinheiro = null,
    conferido_por = null, conferido_em = null,
    devolvido_por = interno.profissional_atual(), devolvido_em = now(), motivo_devolucao = trim(p_motivo)
  where id = p_caixa;
end $$;

create or replace function public.caixa_aprovar(p_caixa uuid, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not interno.caixa_papel('aprovar') then raise exception 'Você não está marcada(o) para aprovar o caixa (tela Equipe).'; end if;
  perform 1 from public.caixas where id = p_caixa and status = 'conferido' for update;
  if not found then raise exception 'Só dá para aprovar um caixa já conferido.'; end if;
  update public.caixas set status = 'aprovado', aprovado_por = interno.profissional_atual(), aprovado_em = now(),
    obs_aprovacao = nullif(trim(coalesce(p_obs, '')), '')
  where id = p_caixa;
end $$;

revoke execute on function public.caixa_abrir(numeric), public.caixa_esperado_dinheiro(uuid), public.caixa_fechar(uuid, numeric, text),
  public.caixa_conferir(uuid, text), public.caixa_devolver(uuid, text), public.caixa_aprovar(uuid, text) from public, anon;
grant execute on function public.caixa_abrir(numeric), public.caixa_esperado_dinheiro(uuid), public.caixa_fechar(uuid, numeric, text),
  public.caixa_conferir(uuid, text), public.caixa_devolver(uuid, text), public.caixa_aprovar(uuid, text) to authenticated;
revoke execute on function interno.tg_caixa_movimento(), interno.tg_caixa_pagamento_limite(), interno.tg_caixa_atendimento_valor() from public, anon, authenticated;

-- ---------- Segurança (RLS) ----------
alter table public.caixas              enable row level security;
alter table public.caixa_atendimentos  enable row level security;
alter table public.caixa_pagamentos    enable row level security;
alter table public.caixa_saidas        enable row level security;
revoke all on public.caixas, public.caixa_atendimentos, public.caixa_pagamentos, public.caixa_saidas from anon;
-- "caixas" só muda pelas funções acima
revoke insert, update, delete, truncate on public.caixas from authenticated;
revoke delete, truncate on public.caixa_atendimentos, public.caixa_pagamentos, public.caixa_saidas from authenticated;

create policy le on public.caixas for select to authenticated using ((select interno.caixa_papel('ver')));

create policy le on public.caixa_atendimentos for select to authenticated using ((select interno.caixa_papel('ver')));
create policy inclui on public.caixa_atendimentos for insert to authenticated with check ((select interno.caixa_papel('lancar')));
create policy altera on public.caixa_atendimentos for update to authenticated
  using ((select interno.caixa_papel('lancar'))) with check ((select interno.caixa_papel('lancar')));

create policy le on public.caixa_pagamentos for select to authenticated using ((select interno.caixa_papel('ver')));
create policy inclui on public.caixa_pagamentos for insert to authenticated with check ((select interno.caixa_papel('lancar')));
create policy altera on public.caixa_pagamentos for update to authenticated
  using ((select interno.caixa_papel('lancar'))) with check ((select interno.caixa_papel('lancar')));

create policy le on public.caixa_saidas for select to authenticated using ((select interno.caixa_papel('ver')));
create policy inclui on public.caixa_saidas for insert to authenticated with check ((select interno.caixa_papel('lancar')));
create policy altera on public.caixa_saidas for update to authenticated
  using ((select interno.caixa_papel('lancar'))) with check ((select interno.caixa_papel('lancar')));
