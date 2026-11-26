-- =====================================================================
-- 0167 — Profissionais que atendem pacientes e não são médicos aparecem no caixa (dona, 26/11/2026)
-- A Eveline (tecnóloga: campo visual e ortóptica) não aparecia na lista "Médico" do caixa da recepção.
-- profissionais.atende_pacientes: a pessoa atende/realiza exames e aparece no caixa como profissional
-- (além dos médicos). Marcado na tela Equipe.
-- =====================================================================
alter table public.profissionais add column if not exists atende_pacientes boolean not null default false;
comment on column public.profissionais.atende_pacientes is
  'Atende pacientes sem ser médico (ex.: tecnóloga de campo visual/ortóptica): aparece no caixa como profissional.';

update public.profissionais
   set atende_pacientes = true,
       especialidade = coalesce(especialidade, 'Tecnóloga — Campo visual e Ortóptica')
 where nome = 'Eveline Isabel Alves dos Santos' and not agenda_recurso;
