-- =====================================================================
-- Transformação: AGENDA (Micrologos) -> public.agendamentos   (de-para: legacy_micrologos.mapa_ids, entidade 'agenda')
-- Depende de 01_pacientes, 02_convenios, 03_profissionais e da migração 0153 (encaixe pode sobrepor).
-- Rodar numa transação com: set local app.migracao = 'on';  (não abre contas nem grava auditoria). Idempotente.
--
-- Status do Micrologos (letra) -> sistema novo. Interpretação pelos dados (❓ confirmar com a dona):
--   A  = atendido (tem chegada e atendimento)                     -> atendido
--   C, E, P = chegou / em espera / espera pendente (já passados)   -> atendido
--   O  = não compareceu                                           -> faltou
--   X  = cancelado (quase sempre com motivo)                       -> cancelado
--   M  = cancelado pelo médico                                    -> cancelado
--   D  = desistiu (chegou e foi embora)                           -> cancelado (motivo "Desistiu")
--   1, 2, 5 = confirmação (WhatsApp/SMS/site)                      -> confirmado (futuro) / faltou (passado)
--   vazio = só agendado                                           -> agendado (futuro) / faltou (passado)
-- A letra original vai nas observações ("Status no Micrologos: …").
-- Duração: a do Micrologos quando houver; senão 10 min (Centro Cirúrgico: 15 min), como a grade do Micrologos.
-- Agendamentos futuros que caem no mesmo horário de outro entram como encaixe.
-- Ficam de fora: paciente que não migrou (testes), coluna sem uso (Sem Médico etc.) e datas inválidas (antes de 2000).
-- =====================================================================

create temp table _ag as
select a.*,
  legacy_micrologos.novo_id('paciente', a.id_paciente) as pac,
  legacy_micrologos.novo_id('medico', a.id_medico) as prof,
  legacy_micrologos.data_hora(a.data, a.hora) as ini,
  coalesce(nullif(btrim(a.status), ''), '-') as st
from legacy_micrologos.bruto_agenda a;

insert into legacy_micrologos.ocorrencias (entidade, legacy_id, severidade, regra, mensagem)
select 'agenda', btrim(a.id_agenda), 'info',
  case when a.pac is null then 'sem_paciente' when a.prof is null then 'sem_coluna' else 'data_invalida' end,
  'Agendamento do Micrologos não migrado'
from _ag a
where (a.pac is null or a.prof is null or a.ini is null or a.ini < timestamptz '2000-01-01')
  and not exists (select 1 from legacy_micrologos.ocorrencias o where o.entidade = 'agenda' and o.legacy_id = btrim(a.id_agenda));

delete from _ag where pac is null or prof is null or ini is null or ini < timestamptz '2000-01-01';

create temp table _ag2 as
select a.*,
  a.ini + coalesce(
    case when a.duracao_prevista ~ '^\d{1,2}:\d{2}$' and a.duracao_prevista <> '00:00' then a.duracao_prevista::interval end,
    case when btrim(a.id_medico) = '12' then interval '15 minutes' else interval '10 minutes' end) as fim,
  a.ini >= now() as futuro,
  case
    when a.st = 'A' or a.st in ('C', 'E', 'P') then 'atendido'
    when a.st = 'O' then 'faltou'
    when a.st in ('X', 'M', 'D') then 'cancelado'
    when a.st in ('1', '2', '5') then case when a.ini >= now() then 'confirmado' else 'faltou' end
    else case when a.ini >= now() then 'agendado' else 'faltou' end
  end as status_novo
from _ag a;

-- Agendamentos que a equipe já marcou no sistema novo (decisão da dona, 26/11/2026): o mesmo paciente, no mesmo
-- horário e com o mesmo médico, marcado nos dois sistemas, fica UMA vez só (o do sistema novo, ligado ao WhatsApp).
create temp table _ag_equipe as
select a.id, a.paciente_id, a.profissional_id, a.inicio, a.fim, a.status, coalesce(a.encaixe, false) as encaixe
from public.agendamentos a
where not exists (select 1 from legacy_micrologos.mapa_ids m where m.entidade = 'agenda' and m.novo_id = a.id);
create index on _ag_equipe (paciente_id, inicio);
analyze _ag_equipe;

insert into legacy_micrologos.ocorrencias (entidade, legacy_id, severidade, regra, mensagem)
select 'agenda', btrim(a.id_agenda), 'info', 'ja_no_sistema_novo', 'Agendamento já marcado no sistema novo pela equipe: não duplicado'
from _ag2 a join _ag_equipe e on e.paciente_id = a.pac and e.profissional_id = a.prof and e.inicio = a.ini
where not exists (select 1 from legacy_micrologos.ocorrencias o where o.entidade = 'agenda' and o.legacy_id = btrim(a.id_agenda));
delete from _ag2 a using _ag_equipe e where e.paciente_id = a.pac and e.profissional_id = a.prof and e.inicio = a.ini;

-- futuros sobrepostos viram encaixe (o primeiro do horário fica como agendamento normal)
create temp table _encaixe as
select id_agenda from (
  select id_agenda, ini,
         max(fim) over (partition by prof order by ini, id_agenda rows between unbounded preceding and 1 preceding) as fim_ant
  from _ag2 where status_novo in ('agendado', 'confirmado')
) x where fim_ant > ini;
-- e também os que caem no horário de um agendamento "vivo" da equipe (outro paciente, mesma coluna)
insert into _encaixe
select a.id_agenda from _ag2 a
where a.status_novo in ('agendado', 'confirmado')
  and exists (select 1 from _ag_equipe e where e.profissional_id = a.prof and not e.encaixe
                and e.status not in ('cancelado', 'faltou', 'atendido')
                and tstzrange(e.inicio, e.fim) && tstzrange(a.ini, a.fim))
  and not exists (select 1 from _encaixe x where x.id_agenda = a.id_agenda);
create index on _encaixe (id_agenda);

insert into legacy_micrologos.mapa_ids (entidade, legacy_id, novo_id, tabela_nova)
select 'agenda', btrim(id_agenda), gen_random_uuid(), 'public.agendamentos' from _ag2
on conflict (entidade, legacy_id) do nothing;
analyze legacy_micrologos.mapa_ids;

insert into public.agendamentos (id, paciente_id, profissional_id, inicio, fim, tipo, status, convenio_id, plano_id,
  observacoes, motivo_cancelamento, primeira_vez, encaixe, chegada_em, confirmado_em, criado_em)
select m.novo_id, a.pac, a.prof, a.ini, a.fim,
  (case
     when btrim(a.id_medico) = '12' then 'cirurgia'
     when btrim(a.id_medico) in ('20', '6', '31') then 'exame'
     when a.revisao in ('S', '1') then 'retorno'
     else 'consulta' end)::public.tipo_agendamento,
  a.status_novo::public.status_agendamento,
  pl.convenio_id, pl.id,
  nullif(concat_ws(E'\n', legacy_micrologos.txt(a.notas), 'Status no Micrologos: ' || a.st), ''),
  case when a.status_novo = 'cancelado' then coalesce(
     legacy_micrologos.txt(mo.descricao),
     case a.st when 'D' then 'Desistiu' when 'M' then 'Cancelado pelo médico' else 'Cancelado (Micrologos)' end) end,
  coalesce(a.primeira_vez, '') in ('S', '1'),
  coalesce(a.encaixe, '') in ('S', '1') or e.id_agenda is not null,
  legacy_micrologos.data_hora(a.data_chegada, a.hora_chegada),
  coalesce(legacy_micrologos.data_hora(a.data_confirmacao_wats), legacy_micrologos.data_hora(a.data_confirmacao_sms),
           legacy_micrologos.data_hora(a.data_confirmacao_web), legacy_micrologos.data_hora(a.data_confirmacao_agenda)),
  coalesce(legacy_micrologos.data_hora(a.data_inclusao), a.ini)
from _ag2 a
join legacy_micrologos.mapa_ids m on m.entidade = 'agenda' and m.legacy_id = btrim(a.id_agenda)
left join _encaixe e on e.id_agenda = a.id_agenda
left join public.convenio_planos pl on pl.micrologos_codigo::text = btrim(a.id_convenio)
left join legacy_micrologos.bruto_motivos_ausencia mo on btrim(mo.id_motivo_ausencia) = btrim(a.id_motivo_ausencia) and btrim(a.id_motivo_ausencia) <> '0'
on conflict (id) do nothing;

-- conferência
analyze public.agendamentos;
select status, count(*) as qtd, count(*) filter (where inicio >= now()) as futuros, count(*) filter (where encaixe) as encaixes
from public.agendamentos a join legacy_micrologos.mapa_ids m on m.novo_id = a.id and m.entidade = 'agenda'
group by status order by 2 desc;
