-- =====================================================================
-- 0004 — Índices nas chaves estrangeiras (recomendação do Supabase)
-- =====================================================================
create index if not exists adendos_autor_idx               on public.adendos (autor_id);
create index if not exists agendamentos_convenio_idx       on public.agendamentos (convenio_id);
create index if not exists agendamentos_criado_por_idx     on public.agendamentos (criado_por);
create index if not exists alergias_registrado_por_idx     on public.alergias (registrado_por);
create index if not exists antecedentes_registrado_por_idx on public.antecedentes (registrado_por);
create index if not exists diagnosticos_registrado_por_idx on public.diagnosticos (registrado_por);
create index if not exists documentos_registrado_por_idx   on public.documentos_clinicos (registrado_por);
create index if not exists exames_registrado_por_idx       on public.exames_oftalmologicos (registrado_por);
create index if not exists medicamentos_registrado_por_idx on public.medicamentos_em_uso (registrado_por);
create index if not exists pacientes_criado_por_idx        on public.pacientes (criado_por);
create index if not exists prescricoes_registrado_por_idx  on public.prescricoes (registrado_por);
create index if not exists prescr_oculos_registrado_por_idx on public.prescricoes_oculos (registrado_por);
create index if not exists refracoes_registrado_por_idx    on public.refracoes (registrado_por);
create index if not exists solicitacoes_registrado_por_idx on public.solicitacoes_exames (registrado_por);
create index if not exists triagens_registrado_por_idx     on public.triagens (registrado_por);
