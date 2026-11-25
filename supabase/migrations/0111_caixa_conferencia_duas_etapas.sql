-- =====================================================================
-- 0111 — Caixa: conferência em DUAS etapas (pedido da dona, 25/11/2026)
--
-- Caminho: aberto → fechado → DINHEIRO CONFERIDO → conferido (conferência completa) → aprovado (Luciano).
--  1º check (no dia): a recepção do 4º andar conta o dinheiro recebido e digita o valor → "Dinheiro OK".
--  2º check (durante a semana): a MESMA pessoa marca, aos poucos, cartões (maquininha), PIX (extrato) e
--     notas fiscais (check geral, com observação). Com os três marcados → "Conferência completa" → vai ao Luciano.
--  Decisão da dona: a mesma pessoa que deu o 1º check termina a conferência (a administração autorizada —
--  caixa_corrigir — também pode, para não travar se a pessoa faltar).
-- =====================================================================

alter table public.caixas drop constraint caixas_status_check;
alter table public.caixas add constraint caixas_status_check
  check (status in ('aberto', 'fechado', 'dinheiro_conferido', 'conferido', 'aprovado', 'cancelado'));
alter table public.caixas
  add column dinheiro_conferido_por uuid references public.profissionais(id),
  add column dinheiro_conferido_em  timestamptz,
  add column dinheiro_recebido      numeric(12,2),    -- quanto a conferente contou ao receber o caixa
  add column obs_dinheiro           text,
  add column check_cartoes_em       timestamptz,
  add column obs_cartoes            text,
  add column check_pix_em           timestamptz,
  add column obs_pix                text,
  add column check_notas_em         timestamptz,
  add column obs_notas              text;
create index caixas_dinheiro_conferido_por_idx on public.caixas (dinheiro_conferido_por);

-- 1º check: dinheiro
create or replace function public.caixa_conferir_dinheiro(p_caixa uuid, p_contado numeric, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_fechou uuid;
begin
  if not interno.caixa_papel('conferir') then raise exception 'Você não está marcada(o) para conferir o caixa (tela Equipe).'; end if;
  if p_contado is null or p_contado < 0 then raise exception 'Informe quanto dinheiro você recebeu (contado).'; end if;
  select fechado_por into v_fechou from public.caixas where id = p_caixa and status = 'fechado' for update;
  if not found then raise exception 'Só dá para conferir o dinheiro de um caixa fechado.'; end if;
  if v_fechou = interno.profissional_atual() then raise exception 'Quem fechou o caixa não pode conferir o próprio caixa.'; end if;
  update public.caixas set status = 'dinheiro_conferido', dinheiro_conferido_por = interno.profissional_atual(),
    dinheiro_conferido_em = now(), dinheiro_recebido = p_contado, obs_dinheiro = nullif(trim(coalesce(p_obs, '')), ''),
    check_cartoes_em = null, obs_cartoes = null, check_pix_em = null, obs_pix = null, check_notas_em = null, obs_notas = null
  where id = p_caixa;
end $$;

-- 2º check: itens marcados aos poucos (cartoes, pix, notas)
create or replace function public.caixa_conferencia_marcar(p_caixa uuid, p_item text, p_feito boolean, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_quem uuid; v_obs text := nullif(trim(coalesce(p_obs, '')), '');
begin
  select dinheiro_conferido_por into v_quem from public.caixas where id = p_caixa and status = 'dinheiro_conferido' for update;
  if not found then raise exception 'Este caixa não está em conferência.'; end if;
  if v_quem is distinct from interno.profissional_atual() and not interno.caixa_corrige() then
    raise exception 'Só quem conferiu o dinheiro deste caixa pode continuar a conferência.';
  end if;
  if p_item = 'cartoes' then
    update public.caixas set check_cartoes_em = case when p_feito then now() end, obs_cartoes = v_obs where id = p_caixa;
  elsif p_item = 'pix' then
    update public.caixas set check_pix_em = case when p_feito then now() end, obs_pix = v_obs where id = p_caixa;
  elsif p_item = 'notas' then
    update public.caixas set check_notas_em = case when p_feito then now() end, obs_notas = v_obs where id = p_caixa;
  else
    raise exception 'Item de conferência inválido.';
  end if;
end $$;

-- conferência completa (2º check final) → vai para a aprovação
create or replace function public.caixa_conferir(p_caixa uuid, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.caixas where id = p_caixa for update;
  if c.status is distinct from 'dinheiro_conferido' then
    raise exception 'Primeiro confira o dinheiro (1º check). A conferência completa vem depois.';
  end if;
  if c.dinheiro_conferido_por is distinct from interno.profissional_atual() and not interno.caixa_corrige() then
    raise exception 'Só quem conferiu o dinheiro deste caixa pode concluir a conferência.';
  end if;
  if c.check_cartoes_em is null or c.check_pix_em is null or c.check_notas_em is null then
    raise exception 'Marque cartões, PIX e notas fiscais antes de concluir a conferência.';
  end if;
  update public.caixas set status = 'conferido', conferido_por = interno.profissional_atual(), conferido_em = now(),
    obs_conferencia = nullif(trim(coalesce(p_obs, '')), '')
  where id = p_caixa;
end $$;

-- devolver: também durante a conferência (só quem está conferindo)
create or replace function public.caixa_devolver(p_caixa uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text; v_setor text; v_quem uuid;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escreva o motivo da devolução.'; end if;
  select status, setor, dinheiro_conferido_por into v_status, v_setor, v_quem from public.caixas where id = p_caixa for update;
  if v_status = 'fechado' and not interno.caixa_papel('conferir') then raise exception 'Só quem confere pode devolver o caixa.'; end if;
  if v_status = 'dinheiro_conferido' and v_quem is distinct from interno.profissional_atual() and not interno.caixa_corrige() then
    raise exception 'Só quem está conferindo este caixa pode devolvê-lo.';
  end if;
  if v_status = 'conferido' and not interno.caixa_papel('aprovar') then raise exception 'Só quem aprova pode devolver um caixa conferido.'; end if;
  if v_status is null or v_status not in ('fechado', 'dinheiro_conferido', 'conferido') then
    raise exception 'Só dá para devolver um caixa fechado, em conferência ou conferido.';
  end if;
  if exists (select 1 from public.caixas where status = 'aberto' and setor = v_setor) then
    raise exception 'Há outro caixa deste setor aberto agora. Feche-o antes de devolver este para correção.';
  end if;
  update public.caixas set status = 'aberto',
    fechado_por = null, fechado_em = null, esperado_dinheiro = null, contado_dinheiro = null, diferenca_dinheiro = null,
    dinheiro_conferido_por = null, dinheiro_conferido_em = null, dinheiro_recebido = null, obs_dinheiro = null,
    check_cartoes_em = null, obs_cartoes = null, check_pix_em = null, obs_pix = null, check_notas_em = null, obs_notas = null,
    conferido_por = null, conferido_em = null,
    devolvido_por = interno.profissional_atual(), devolvido_em = now(), motivo_devolucao = trim(p_motivo)
  where id = p_caixa;
end $$;

-- reabrir (só a administração autorizada): inclui caixa em conferência
create or replace function public.caixa_reabrir(p_caixa uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text; v_setor text;
begin
  if not interno.caixa_corrige() then raise exception 'Só a administração autorizada pode reabrir um caixa.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escreva o motivo da reabertura.'; end if;
  select status, setor into v_status, v_setor from public.caixas where id = p_caixa for update;
  if v_status is null or v_status not in ('fechado', 'dinheiro_conferido', 'conferido', 'aprovado') then
    raise exception 'Só dá para reabrir um caixa fechado, em conferência, conferido ou aprovado.';
  end if;
  if exists (select 1 from public.caixas where status = 'aberto' and setor = v_setor) then
    raise exception 'Há outro caixa deste setor aberto agora. Feche-o antes de reabrir este.';
  end if;
  update public.caixas set status = 'aberto',
    fechado_por = null, fechado_em = null, esperado_dinheiro = null, contado_dinheiro = null, diferenca_dinheiro = null,
    dinheiro_conferido_por = null, dinheiro_conferido_em = null, dinheiro_recebido = null, obs_dinheiro = null,
    check_cartoes_em = null, obs_cartoes = null, check_pix_em = null, obs_pix = null, check_notas_em = null, obs_notas = null,
    conferido_por = null, conferido_em = null, aprovado_por = null, aprovado_em = null,
    reaberto_por = interno.profissional_atual(), reaberto_em = now(), motivo_reabertura = trim(p_motivo)
  where id = p_caixa;
end $$;

revoke execute on function public.caixa_conferir_dinheiro(uuid, numeric, text), public.caixa_conferencia_marcar(uuid, text, boolean, text) from public, anon;
grant execute on function public.caixa_conferir_dinheiro(uuid, numeric, text), public.caixa_conferencia_marcar(uuid, text, boolean, text) to authenticated;
