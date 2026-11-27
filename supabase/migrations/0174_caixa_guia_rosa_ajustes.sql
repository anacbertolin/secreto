-- =====================================================================
-- 0174 — Caixa: ajustes da Guia Rosa e do particular (respostas da Sol, 27/11/2026)
--  * Ecobiometria: particular R$ 110 (pedido da casa) e R$ 190 (pedido de fora); na Guia Rosa R$ 160 nos dois casos.
--  * Laser (uma única sessão): particular R$ 450 por aplicação (era R$ 400, valor antigo da Micrologos); Guia Rosa R$ 350.
--  * Laser — Pacote 5 sessões (cada olho): R$ 2.000 só no particular (na Guia Rosa paga R$ 350 por sessão).
--  * Teste do Olhinho: Dr. Gelson R$ 380, outros médicos R$ 280 — já estava certo.
-- =====================================================================
insert into public.precos_parceria (tabela, procedimento_id, valor)
select 'guia_rosa', p.id, 160 from public.procedimentos p
where p.descricao = 'Biometria Particular' and p.ativo
on conflict (tabela, procedimento_id) do update set valor = excluded.valor, ativo = true;

-- laser particular: novo preço vigente a partir de hoje; o antigo fica desativado (histórico)
update public.precos pr set ativo = false
from public.procedimentos p
where p.id = pr.procedimento_id and p.descricao = 'Laser (uma Única Sessão)'
  and pr.convenio_id is null and pr.plano_id is null and pr.ativo and pr.valor <> 450;
insert into public.precos (procedimento_id, convenio_id, plano_id, valor, vigente_de)
select p.id, null, null, 450, date '2026-11-27' from public.procedimentos p
where p.descricao = 'Laser (uma Única Sessão)' and p.ativo
  and not exists (select 1 from public.precos pr where pr.procedimento_id = p.id and pr.convenio_id is null
                  and pr.plano_id is null and pr.ativo and pr.valor = 450);

insert into public.procedimentos (tabela, descricao, tipo, observacao)
select '00', 'Laser — Pacote 5 sessões (cada olho)', 'procedimento', 'Só particular. Na Guia Rosa o paciente paga por sessão (R$ 350).'
where not exists (select 1 from public.procedimentos where descricao = 'Laser — Pacote 5 sessões (cada olho)');
insert into public.precos (procedimento_id, convenio_id, plano_id, valor, vigente_de)
select p.id, null, null, 2000, date '2026-11-27' from public.procedimentos p
where p.descricao = 'Laser — Pacote 5 sessões (cada olho)'
  and not exists (select 1 from public.precos pr where pr.procedimento_id = p.id and pr.convenio_id is null and pr.plano_id is null);

-- Pacote 5 sessões NÃO existe na Guia Rosa: linha desativada = o caixa esconde o item quando a tabela é Guia Rosa
insert into public.precos_parceria (tabela, procedimento_id, valor, ativo, observacao)
select 'guia_rosa', id, 0, false, 'Não existe na Guia Rosa: o paciente paga por sessão (R$ 350).'
from public.procedimentos where descricao = 'Laser — Pacote 5 sessões (cada olho)'
on conflict (tabela, procedimento_id) do nothing;
