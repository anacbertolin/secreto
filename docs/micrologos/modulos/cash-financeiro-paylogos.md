# Cash (financeiro) e Paylogos

## Fluxo de caixa, pagar e receber
Recursos: `fluxoDeCaixa` (24 operações), `transacoesRecorrentes`, `portadores`, `portadoresMovimentacao`. Telas: `/fluxoDeCaixa`, `/fluxoDeCaixa/pagar`, `/fluxoDeCaixa/receber`.
- Títulos a pagar e a receber, com **parcelas** e **rateio** (por centro de responsabilidade e projeto). ✅
- **Relacionamento entre movimentos** (vínculo título ↔ conta do paciente, cobrança, repasse, NF). ✅
- **Alteração múltipla** e **pagamento múltiplo**, cancelamento de pagamento. ✅
- Indicadores do fluxo de caixa. ✅
- **Anexos (GED)** nos títulos. ✅
- **Contas recorrentes** (transações programadas), com cobrança automática por **e-mail** (há página na wiki "Transação Programada Email"). ✅
- Formas de pagamento: dinheiro, cheque, **boleto** (inclusive "boleto em aberto"), **PIX** (gerar e excluir), cartão, **link de pagamento**, crédito do paciente. ✅

## Conta corrente / portadores
- **Portadores** = contas bancárias, caixas e carteiras. ✅
- Movimentação entre portadores e transferências (`ID_CONTA_DESTINO`). ✅
- Taxas de meio de pagamento por portador (`ID_PORTADORE_MP_TAXA`). ✅
- **Conciliação bancária e de cartão**. ✅ (site)

## Notas fiscais
Recurso: `notasFiscais`. Telas: `/notasFiscais` (saída), `/notasFiscaisEntrada`.
- **Saída:** emissão e cancelamento de **NFS-e Nacional** (exige certificado da empresa, um serviço contratado à parte com a Micrologos), consulta de NFS-e e importação de XML. NF ligada ao título a receber e à conta do paciente. "NF discriminatória". ✅
- **Entrada:** NF de compra ligada ao título a pagar. ✅
- Tipo de nota fiscal configurado por empresa. ✅

## Cadastros financeiros
- **Emitentes** = cadastro único de clientes e fornecedores (pessoas e empresas), com categorias hierárquicas, profissões e ocorrências. ✅
- **Empresas** (as pessoas jurídicas do grupo; multiempresa). ✅
- **Planos financeiros** = plano de contas hierárquico (`CODIGO_PLANO_FINANCEIRO_SUPERIOR`). ✅
- **Projetos**, **centros de responsabilidade**, **naturezas de operação**, **tipos de multa**, **moedas e índices** (moeda estrangeira), feriados. ✅

## Relatórios ✅
- **DRE e DFC**.
- Projetado da agenda semanal (receita prevista pela agenda).
- Projetado diário por emitente.
- Integração contábil (site). ❓ Formato a confirmar.

## Paylogos (pagamentos)
Recursos: `payPedidos`, `payClientes`, `payRecebedores`, `payRecebedoresPos`. Telas: `/payLinks`, `/payRecebedores`, `/payMaquininhas`, `/payClientes`, `/pagar/:codigo`.
- **Links de pagamento** e checkout público. ✅
- **Recebedores** (contas que recebem, com split, por exemplo entre sociedades médicas). ✅
- **Maquininhas** (POS) ligadas aos recebedores. ✅
- **Clientes** e **pedidos**. ✅
- Usado também para cobrar mensalidades de sociedades médicas. ✅ (site)
- ❓ Adquirente ou gateway por trás: não identificado. Saldo e recebíveis em trânsito precisam de plano de transição.
