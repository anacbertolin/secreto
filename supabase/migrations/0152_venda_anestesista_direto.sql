-- 0152 — Anestesista pago direto pelo paciente (pedido do Dr. Gelson, 25/11/2026)
-- Caso real: vitrectomia de R$ 25.000; a paciente pagou R$ 23.000 à clínica e R$ 2.000 direto ao anestesista (Fábio).
-- A venda guarda quanto foi pago direto ao anestesista; no repasse esse custo NÃO é descontado de novo
-- (a linha do anestesista entra com valor 0 e a anotação "pago direto pelo paciente").
alter table public.orientacao_vendas
  add column anestesista_direto numeric(12,2) check (anestesista_direto > 0);
comment on column public.orientacao_vendas.anestesista_direto is
  'Valor que o paciente pagou DIRETO ao anestesista (fora da clínica). Não entra no caixa nem é descontado no repasse.';
