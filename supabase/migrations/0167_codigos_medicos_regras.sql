-- =====================================================================
-- 0167 — Códigos dos médicos por convênio: regras do Micrologos (sessão "Dados para migração", 26/11/2026)
-- No Micrologos (Staff Médico ▸ Inf. TISS ▸ MEDICOS_OPERADORAS), além do código do médico em cada convênio/hospital:
--   - "executa como" / "solicita como": o médico que sai na guia no lugar dele (ex.: médico sem credenciamento
--     no convênio sai pelo colega credenciado);
--   - contratado = o próprio profissional (em vez da clínica) no solicitante/executante, com o código do contratado;
--   - grau de participação TISS padrão do médico no convênio.
-- =====================================================================
alter table public.profissional_convenio_codigos
  add column if not exists executa_como_id uuid references public.profissionais(id) on delete set null,
  add column if not exists solicita_como_id uuid references public.profissionais(id) on delete set null,
  add column if not exists contratado_proprio_executante boolean not null default false,
  add column if not exists contratado_proprio_solicitante boolean not null default false,
  add column if not exists codigo_contratado text,
  add column if not exists grau_participacao text;
create index if not exists pcc_executa_como_idx on public.profissional_convenio_codigos (executa_como_id);
create index if not exists pcc_solicita_como_idx on public.profissional_convenio_codigos (solicita_como_id);
comment on column public.profissional_convenio_codigos.executa_como_id is 'Médico que sai como executante na guia no lugar deste (Micrologos: "médico executa").';
comment on column public.profissional_convenio_codigos.solicita_como_id is 'Médico que sai como solicitante na guia no lugar deste (Micrologos: "médico solicita").';
