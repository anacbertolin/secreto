-- =====================================================================
-- 0173 — Caixa: tabela de preços "Guia Rosa" (pedido da dona/recepção, 27/11/2026)
-- Fonte: folha "TABELA 2026 ATUALIZADA EM 15/06/26" da recepção (coluna GUIA ROSA).
--  * precos_parceria: preço de um procedimento numa tabela de parceria do caixa (hoje só 'guia_rosa').
--    Itens sem preço na Guia Rosa (***** na folha) usam o preço particular.
--  * caixa_atendimentos.tabela: qual tabela foi usada no recebimento ('particular' ou 'guia_rosa').
--  * Consulta (AV de grau) na Guia Rosa: R$ 200 (vale para "Consulta Cartao" e "Consulta Dinheiro/pix").
--  * A confirmar com a dona: Ecobiometria na folha = particular R$ 110 / Guia Rosa R$ 160 (maior que o particular?)
--    — não cadastrado; Laser única sessão na folha = particular R$ 450 (no sistema está R$ 400).
-- =====================================================================
create table public.precos_parceria (
  id              uuid primary key default gen_random_uuid(),
  tabela          text not null check (tabela in ('guia_rosa')),
  procedimento_id uuid not null references public.procedimentos(id),
  valor           numeric(12,2) not null check (valor >= 0),
  ativo           boolean not null default true,
  observacao      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (tabela, procedimento_id)
);
comment on table public.precos_parceria is 'Preços das tabelas de parceria do caixa (ex.: Guia Rosa). Sem linha aqui = usa o preço particular.';
create index precos_parceria_procedimento_idx on public.precos_parceria (procedimento_id);
create trigger atualizado_em before update on public.precos_parceria for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.precos_parceria for each row execute function interno.tg_auditoria();
alter table public.precos_parceria enable row level security;
revoke all on public.precos_parceria from anon;
create policy le on public.precos_parceria for select to authenticated using ((select interno.caixa_papel('ver')));
create policy inclui on public.precos_parceria for insert to authenticated with check ((select interno.tem_funcao('admin', 'faturamento')));
create policy altera on public.precos_parceria for update to authenticated
  using ((select interno.tem_funcao('admin', 'faturamento'))) with check ((select interno.tem_funcao('admin', 'faturamento')));

alter table public.caixa_atendimentos
  add column tabela text not null default 'particular' check (tabela in ('particular', 'guia_rosa'));
comment on column public.caixa_atendimentos.tabela is 'Tabela de preços usada no recebimento: particular ou guia_rosa.';

insert into public.precos_parceria (tabela, procedimento_id, valor)
select 'guia_rosa', p.id, v.valor
from (values
  ('Teste Ortóptico', 80), ('Exercício Ortóptico', 50), ('Exercício Ortóptico 10 Sessões', 350),
  ('Tonometria', 70), ('Gonioscopia', 120), ('Retinografia Particular', 200), ('Angiografia Particular', 380),
  ('Paquimetria Particular', 125), ('Iol Master', 270), ('Biometria Particular/externo', 160),
  ('Campo Visual Particular', 140), ('Curva de Pressão', 125), ('Curva Tensional Diaria-binocular', 125),
  ('Topografia Particular', 170), ('Ultrassonografia Particular', 250), ('Capsulotomia Yag Ou Cirurgica', 380),
  ('Microscopia Particular', 170), ('Iridotomia (yag Laser)', 380), ('Pam Particular', 115),
  ('Laser (uma Única Sessão)', 350), ('Oct Macula Particular', 380), ('Oct Disco Particular', 380),
  ('Mapeamento de Retina Particular', 200), ('Consulta Cartao', 200), ('Consulta Dinheiro/pix', 200)
) v(descricao, valor)
join public.procedimentos p on p.descricao = v.descricao and p.ativo;
