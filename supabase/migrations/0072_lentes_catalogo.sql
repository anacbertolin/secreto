-- =====================================================================
-- 0072 — Catálogo de lentes intraoculares (custo de compra e preço de venda)
-- =====================================================================
-- Pedido da dona (23/11/2026): registrar as lentes "premium" da Alcon que a clínica usa,
-- com o valor de compra (com IPI) da tabela do fornecedor, para depois entrarem no
-- repasse/faturamento e no estoque. O catálogo é por MODELO (o estoque é por unidade:
-- dioptria, lote e nº de série, migração 0024). Mais tarde, cada item do estoque poderá
-- apontar para o modelo do catálogo (coluna estoque_itens.lente_id).
-- Tipos ópticos: monofocal (simples: um foco, em geral longe; óculos para perto),
-- foco estendido (EDOF, ex.: Vivity), multifocal/trifocal (ex.: PanOptix). Tórica = corrige astigmatismo.
-- "AutonoMe" = lente já carregada no injetor descartável da Alcon.
-- =====================================================================

create table public.lentes_catalogo (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,                    -- código do fornecedor (ex.: CNA0T0.060)
  descricao       text not null,
  fabricante      text not null default 'Alcon',
  linha           text,                                    -- Clareon, Clareon Vivity, Clareon PanOptix…
  tipo_optico     text not null check (tipo_optico in ('monofocal', 'foco_estendido', 'multifocal')),
  torica          boolean not null default false,
  pre_carregada   boolean not null default false,          -- AutonoMe (injetor pré-carregado)
  custo_compra    numeric(12,2) check (custo_compra >= 0), -- com IPI, tabela do fornecedor
  preco_venda     numeric(12,2) check (preco_venda >= 0),  -- ao paciente (a definir)
  observacoes     text,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.lentes_catalogo is 'Modelos de lente intraocular com custo de compra e preço de venda (o estoque é por unidade).';

alter table public.estoque_itens add column lente_id uuid references public.lentes_catalogo(id);
create index estoque_itens_lente_idx on public.estoque_itens (lente_id);

create trigger atualizado_em before update on public.lentes_catalogo for each row execute function interno.tg_atualizado_em();
create trigger auditoria after insert or update or delete on public.lentes_catalogo for each row execute function interno.tg_auditoria();

alter table public.lentes_catalogo enable row level security;
-- Leem: faturamento, admin, médico e enfermagem. Alteram: faturamento e admin (preço é informação financeira).
create policy le on public.lentes_catalogo for select to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin', 'medico', 'enfermagem')));
create policy inclui on public.lentes_catalogo for insert to authenticated
  with check ((select interno.tem_funcao('faturamento', 'admin')));
create policy altera on public.lentes_catalogo for update to authenticated
  using ((select interno.tem_funcao('faturamento', 'admin'))) with check ((select interno.tem_funcao('faturamento', 'admin')));

-- Tabela da Alcon enviada pela dona (e-mail de 01/04/2026, valores com IPI)
insert into public.lentes_catalogo (codigo, descricao, linha, tipo_optico, torica, pre_carregada, custo_compra) values
  ('SY60WF.060',  'Clareon (monofocal)',                            'Clareon',          'monofocal',      false, false,  684.60),
  ('CNA0T0.060',  'Clareon AutonoMe (monofocal, pré-carregada)',    'Clareon',          'monofocal',      false, true,   861.00),
  ('CNW0T2.060',  'Clareon Toric (monofocal tórica)',               'Clareon',          'monofocal',      true,  false, 1584.45),
  ('CNA0T2.060',  'Clareon Toric AutonoMe (monofocal tórica, pré-carregada)', 'Clareon', 'monofocal',     true,  true,  1584.45),
  ('CNWET0.125',  'Clareon Vivity (foco estendido)',                'Clareon Vivity',   'foco_estendido', false, false, 4198.95),
  ('CNAET0.070',  'Clareon Vivity AutonoMe (foco estendido, pré-carregada)', 'Clareon Vivity', 'foco_estendido', false, true, 4198.95),
  ('CNWET2.135',  'Clareon Vivity Toric (foco estendido tórica)',   'Clareon Vivity',   'foco_estendido', true,  false, 5553.45),
  ('CNAET2.110',  'Clareon Vivity Toric AutonoMe (foco estendido tórica, pré-carregada)', 'Clareon Vivity', 'foco_estendido', true, true, 5553.45),
  ('CNATT0.065',  'Clareon PanOptix AutonoMe (trifocal, pré-carregada)', 'Clareon PanOptix', 'multifocal', false, true, 4198.95),
  ('CNATT2.125',  'Clareon PanOptix Toric AutonoMe (trifocal tórica, pré-carregada)', 'Clareon PanOptix', 'multifocal', true, true, 5553.45);
insert into public.lentes_catalogo (codigo, descricao, fabricante, linha, tipo_optico, custo_compra, observacoes) values
  ('HOYA-MONO', 'Lente intraocular monofocal Hoya', 'Hoya', null, 'monofocal', 320.00,
   'Valor usado nos procedimentos do Dr. Pedro (Fascectomia, Fascectomia + TREC, Campo Grande). Confirmar o modelo.');
