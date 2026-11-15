-- =====================================================================
-- 0051 — Telefonia: a mesma chamada tocando em vários ramais vira UMA ligação
-- mesmo quando a central manda o número com/sem 55 (compara pela chave do telefone).
-- =====================================================================
create or replace function public.telefonia_inicio(p_direcao text, p_numero text, p_sip_call_id text default null,
                                                   p_paciente_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r   public.telefonia_ramais;
  v   uuid;
  num text := regexp_replace(coalesce(p_numero, ''), '\D', '', 'g');
begin
  r := interno.telefonia_exige_ramal();
  if p_direcao not in ('entrada', 'saida') then raise exception 'Direção inválida.'; end if;
  if num = '' then num := 'desconhecido'; end if;

  if p_direcao = 'entrada' then
    select id into v from public.ligacoes
    where direcao = 'entrada' and situacao in ('tocando', 'perdida', 'em_andamento')
      and iniciada_em > now() - interval '2 minutes'
      and (sip_call_id = p_sip_call_id
           or (situacao = 'tocando'
               and (numero = num
                    or interno.chave_telefone(numero) = interno.chave_telefone(num))))
    order by iniciada_em desc limit 1;
    if v is not null then return v; end if;
    insert into public.ligacoes (direcao, numero, paciente_id, sip_call_id)
    values ('entrada', num, interno.telefonia_paciente(num), p_sip_call_id)
    returning id into v;
  else
    insert into public.ligacoes (direcao, numero, paciente_id, situacao, profissional_id, ramal, sip_call_id)
    values ('saida', num, coalesce(p_paciente_id, interno.telefonia_paciente(num)), 'tocando',
            interno.profissional_atual(), r.ramal, p_sip_call_id)
    returning id into v;
    -- Ligou de volta para quem tinha ligado e ninguém atendeu
    update public.ligacoes set retornada_em = now(), retornada_por = interno.profissional_atual()
    where direcao = 'entrada' and situacao = 'perdida' and retornada_em is null
      and interno.chave_telefone(numero) = interno.chave_telefone(num)
      and iniciada_em > now() - interval '30 days';
  end if;
  return v;
end $$;
revoke execute on function public.telefonia_inicio(text, text, text, uuid) from public, anon;
grant execute on function public.telefonia_inicio(text, text, text, uuid) to authenticated;
