-- 0087 — (pedido da dona, 23/11/2026)
-- 1) Revisão e Fotocoagulação continuação passam a R$ 0,00. Os valores de 0,01 e 0,10 só existiam porque a
--    Micrologos não aceitava zero. Revisão = cortesia; sessão seguinte do pacote de fotocoagulação já foi paga.
-- 2) Na chegada de paciente PARTICULAR para consulta, a recepção escolhe a consulta (Cartão ou Dinheiro/Pix, ou outra
--    consulta da tabela). A escolha fica em agendamentos.consulta_procedimento_id e é o item lançado na conta.

update public.precos pr set valor = 0
from public.procedimentos p
where pr.procedimento_id = p.id and p.tabela = '00' and p.codigo in ('105', '106') and pr.convenio_id is null;

update public.procedimentos set descricao = 'Revisão', observacao = 'Sem cobrança (cortesia). Na Micrologos era R$ 0,01 porque lá não dava para zerar.'
where tabela = '00' and codigo = '105';
update public.procedimentos set observacao = 'Sessão seguinte de pacote já pago: sem cobrança. Na Micrologos era R$ 0,10 porque lá não dava para zerar.'
where tabela = '00' and codigo = '106';

alter table public.agendamentos add column if not exists consulta_procedimento_id uuid references public.procedimentos(id);
create index if not exists agendamentos_consulta_proc_idx on public.agendamentos (consulta_procedimento_id);
comment on column public.agendamentos.consulta_procedimento_id is
  'Consulta escolhida na chegada (particular: cartão ou dinheiro/Pix). Vazio = consulta padrão.';

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

  if new.status not in ('chegou', 'em_atendimento', 'atendido') or new.tipo = 'retorno' then
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
