-- =====================================================================
-- 0094 — Agenda da Orientação Cirúrgica dentro da Agenda (pedido da dona, 23/11/2026)
-- =====================================================================
-- Como no Micrologos (aba "Orientação Cirúrgica"): a Alessandra registra na agenda cada paciente que a procura
-- e, nas Notas, o que ele veio fazer (pagar cirurgia, trazer risco cirúrgico, se informar…). É SÓ REGISTRO:
--  * a coluna da agenda é a própria pessoa que atende a orientação (profissionais.orientacao_cirurgica e não médico);
--  * todo agendamento nessa coluna vira tipo 'orientacao' sozinho (e esse tipo só existe nessa coluna);
--  * tipo 'orientacao' NÃO abre conta de faturamento (sem TISS, sem cobrança) — ver tg_agendamento_conta.
-- As telas de recepção, painel da TV, fila do médico e lembretes ignoram esse tipo.
-- =====================================================================

create or replace function interno.tg_agendamento_orientacao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profissionais p
              where p.id = new.profissional_id and p.orientacao_cirurgica and p.funcao <> 'medico') then
    new.tipo := 'orientacao';
  elsif new.tipo = 'orientacao' then
    raise exception 'Agendamento de orientação cirúrgica só pode ficar na agenda da Orientação Cirúrgica.';
  end if;
  return new;
end $$;
revoke execute on function interno.tg_agendamento_orientacao() from public, anon, authenticated;

create trigger orientacao_tipo before insert or update of profissional_id, tipo on public.agendamentos
  for each row execute function interno.tg_agendamento_orientacao();

create or replace function interno.tg_agendamento_conta()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_pac   public.pacientes;
  v_conta uuid;
  v_proc  uuid;
begin
  if coalesce(current_setting('app.migracao', true), '') = 'on' then
    return null;
  end if;

  if new.status in ('faltou', 'cancelado') and old.status is distinct from new.status then
    update public.contas set status = 'cancelada', motivo_cancelamento = 'Agendamento ' || new.status::text
    where agendamento_id = new.id and status = 'aberta';
    return null;
  end if;

  -- Orientação Cirúrgica é só registro: nunca abre conta (migração 0094)
  if new.status not in ('chegou', 'em_atendimento', 'atendido') or new.tipo in ('retorno', 'orientacao') then
    return null;
  end if;
  if exists (select 1 from public.contas where agendamento_id = new.id and status <> 'cancelada') then
    return null;
  end if;

  select * into v_pac from public.pacientes where id = new.paciente_id;
  insert into public.contas (paciente_id, agendamento_id, data_atendimento, convenio_id, plano_id, tipo_guia,
                             carteirinha, validade_carteirinha, profissional_id, criado_por)
  values (new.paciente_id, new.id, (new.inicio at time zone 'America/Sao_Paulo')::date, new.convenio_id,
          coalesce(new.plano_id, case when new.convenio_id = v_pac.convenio_id then v_pac.plano_id end),
          case when new.tipo = 'consulta' then 'consulta' else 'sadt' end,
          case when new.convenio_id = v_pac.convenio_id then v_pac.convenio_carteirinha end,
          case when new.convenio_id = v_pac.convenio_id then v_pac.convenio_validade end,
          new.profissional_id, interno.profissional_atual())
  returning id into v_conta;

  if new.tipo = 'consulta' then
    -- consulta escolhida na chegada (particular: cartão ou Pix); senão, a consulta padrão
    v_proc := new.consulta_procedimento_id;
    if v_proc is null then
      select id into v_proc from public.procedimentos where padrao_consulta and ativo;
    end if;
    if v_proc is not null then
      insert into public.conta_itens (conta_id, procedimento_id, data_execucao)
      values (v_conta, v_proc, (new.inicio at time zone 'America/Sao_Paulo')::date);
    end if;
  end if;
  return null;
end $function$;
