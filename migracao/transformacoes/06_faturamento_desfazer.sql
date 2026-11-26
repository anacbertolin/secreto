-- Desfaz a carga 06_faturamento (SÓ para o ensaio local / antes da virada; apaga o faturamento vindo do Micrologos).
-- Rodar numa transação com: set local app.migracao = 'on';
alter table public.conta_itens disable trigger trava;
alter table public.conta_itens disable trigger totais;
delete from public.conta_itens i using legacy_micrologos.mapa_ids m
 where m.entidade in ('item', 'item_staff', 'item_produto') and m.novo_id = i.id;
delete from public.contas c using legacy_micrologos.mapa_ids m where m.entidade = 'conta' and m.novo_id = c.id;
delete from public.lotes l using legacy_micrologos.mapa_ids m where m.entidade = 'cobranca' and m.novo_id = l.id;
delete from legacy_micrologos.mapa_ids where entidade in ('conta', 'item', 'item_staff', 'item_produto', 'cobranca');
alter table public.conta_itens enable trigger trava;
alter table public.conta_itens enable trigger totais;
