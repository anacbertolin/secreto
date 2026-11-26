-- =====================================================================
-- 0166 — Número do lote no XML TISS (sessão "Dados para migração", 26/11/2026)
-- No Micrologos cada convênio tem a sua própria sequência de lotes de XML ("último lote", ex.: Bradesco Saúde 1676),
-- que vai no sequencialTransacao/numeroLote e no nome do arquivo. O nº interno do lote do sistema é outro (global).
-- Na primeira vez que o XML de um lote é gerado, ele recebe o próximo número do convênio (convenios.tiss.ultimo_lote + 1),
-- e mantém esse número se o XML for gerado de novo (ex.: depois de reabrir a cobrança para corrigir).
-- =====================================================================
alter table public.lotes add column if not exists numero_tiss integer;
comment on column public.lotes.numero_tiss is 'Nº do lote no XML TISS (sequência própria de cada convênio, como no Micrologos).';

create or replace function public.lote_numero_tiss(p_lote uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare v_l public.lotes; v_n integer;
begin
  if not interno.tem_funcao('admin', 'faturamento') then
    raise exception 'Só o faturamento ou a administração geram o XML.';
  end if;
  select * into v_l from public.lotes where id = p_lote for update;
  if not found then raise exception 'Lote não encontrado.'; end if;
  if v_l.numero_tiss is not null then return v_l.numero_tiss; end if;
  update public.convenios
     set tiss = jsonb_set(coalesce(tiss, '{}'::jsonb), '{ultimo_lote}',
                          to_jsonb(coalesce(nullif(tiss->>'ultimo_lote', '')::integer, 0) + 1))
   where id = v_l.convenio_id
  returning (tiss->>'ultimo_lote')::integer into v_n;
  update public.lotes set numero_tiss = v_n where id = p_lote;
  return v_n;
end $$;
revoke execute on function public.lote_numero_tiss(uuid) from public, anon;
grant execute on function public.lote_numero_tiss(uuid) to authenticated;
