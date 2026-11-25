-- =====================================================================
-- 0112 — Conferência em duas etapas vale SÓ para o caixa da recepção (dona, 25/11/2026).
-- O caixa da Orientação Cirúrgica volta ao caminho simples: fechado → conferido (um clique) → aprovado.
-- =====================================================================

create or replace function public.caixa_conferir_dinheiro(p_caixa uuid, p_contado numeric, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_fechou uuid;
begin
  if not interno.caixa_papel('conferir') then raise exception 'Você não está marcada(o) para conferir o caixa (tela Equipe).'; end if;
  if p_contado is null or p_contado < 0 then raise exception 'Informe quanto dinheiro você recebeu (contado).'; end if;
  select fechado_por into v_fechou from public.caixas where id = p_caixa and status = 'fechado' and setor = 'recepcao' for update;
  if not found then raise exception 'Só dá para conferir o dinheiro de um caixa da recepção fechado.'; end if;
  if v_fechou = interno.profissional_atual() then raise exception 'Quem fechou o caixa não pode conferir o próprio caixa.'; end if;
  update public.caixas set status = 'dinheiro_conferido', dinheiro_conferido_por = interno.profissional_atual(),
    dinheiro_conferido_em = now(), dinheiro_recebido = p_contado, obs_dinheiro = nullif(trim(coalesce(p_obs, '')), ''),
    check_cartoes_em = null, obs_cartoes = null, check_pix_em = null, obs_pix = null, check_notas_em = null, obs_notas = null
  where id = p_caixa;
end $$;

create or replace function public.caixa_conferir(p_caixa uuid, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.caixas where id = p_caixa for update;
  if c.id is null then raise exception 'Caixa não encontrado.'; end if;
  if c.setor = 'orientacao' then
    -- caminho simples (como antes da 0111)
    if not interno.caixa_papel('conferir') then raise exception 'Você não está marcada(o) para conferir o caixa (tela Equipe).'; end if;
    if c.status <> 'fechado' then raise exception 'Só dá para conferir um caixa fechado.'; end if;
    if c.fechado_por = interno.profissional_atual() then raise exception 'Quem fechou o caixa não pode conferir o próprio caixa.'; end if;
  else
    if c.status is distinct from 'dinheiro_conferido' then
      raise exception 'Primeiro confira o dinheiro (1º check). A conferência completa vem depois.';
    end if;
    if c.dinheiro_conferido_por is distinct from interno.profissional_atual() and not interno.caixa_corrige() then
      raise exception 'Só quem conferiu o dinheiro deste caixa pode concluir a conferência.';
    end if;
    if c.check_cartoes_em is null or c.check_pix_em is null or c.check_notas_em is null then
      raise exception 'Marque cartões, PIX e notas fiscais antes de concluir a conferência.';
    end if;
  end if;
  update public.caixas set status = 'conferido', conferido_por = interno.profissional_atual(), conferido_em = now(),
    obs_conferencia = nullif(trim(coalesce(p_obs, '')), '')
  where id = p_caixa;
end $$;
