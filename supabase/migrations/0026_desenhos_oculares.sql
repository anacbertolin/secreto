-- =====================================================================
-- 0026 — Desenho do olho (fundo de olho e segmento anterior) no atendimento
-- =====================================================================
-- O médico desenha sobre um diagrama, com as cores padrão da oftalmologia
-- (vermelho = retina aplicada/hemorragia, azul = retina descolada, verde = vítreo/opacidade,
-- preto = pigmento/cicatriz, amarelo = exsudato). Guardado como traços (JSON).
-- Segue a regra do prontuário: atendimento finalizado não muda (mesma trava da 0002).
--
-- CUIDADO COM A MIGRAÇÃO DO MICROLOGOS: só uma tabela NOVA.
-- =====================================================================

create table public.desenhos_oculares (
  id             uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id),
  olho           public.olho not null check (olho in ('OD', 'OE')),
  tipo           text not null default 'fundo' check (tipo in ('fundo', 'segmento_anterior')),
  tracos         jsonb not null default '[]'::jsonb,   -- [{cor, largura, pontos:[[x,y],...]}] em coordenadas 0–100
  legenda        text,
  registrado_por uuid references public.profissionais(id) default interno.profissional_atual(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (atendimento_id, olho, tipo)
);
comment on table public.desenhos_oculares is 'Desenhos do fundo de olho / segmento anterior feitos pelo médico no atendimento.';
create index desenhos_oculares_registrado_por_idx on public.desenhos_oculares (registrado_por);

create trigger atualizado_em before update on public.desenhos_oculares
  for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.desenhos_oculares
  for each row execute function interno.tg_auditoria();
create trigger trava_finalizado before insert or update or delete on public.desenhos_oculares
  for each row execute function interno.tg_bloquear_se_finalizado();

alter table public.desenhos_oculares enable row level security;
revoke all on public.desenhos_oculares from anon;
create policy clinico_le on public.desenhos_oculares for select to authenticated
  using ((select interno.tem_funcao('medico', 'enfermagem')));
create policy medico_inclui on public.desenhos_oculares for insert to authenticated
  with check ((select interno.tem_funcao('medico')));
create policy medico_altera on public.desenhos_oculares for update to authenticated
  using ((select interno.tem_funcao('medico'))) with check ((select interno.tem_funcao('medico')));
create policy medico_remove_rascunho on public.desenhos_oculares for delete to authenticated
  using ((select interno.tem_funcao('medico')));
