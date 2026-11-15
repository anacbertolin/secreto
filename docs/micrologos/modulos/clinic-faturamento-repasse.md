# Clinic · Faturamento, cobrança e repasse

Este é o núcleo mais crítico da migração (área regulada pela ANS e pelo SUS).

## Fluxo geral 🔶
```
Agendamento → Atendimento/execução → Conta do paciente (itens) → Guia (TISS/SUS) ou recibo/NF (particular)
   → Lote/Protocolo de cobrança ao convênio → Retorno do pagamento e glosas → Recurso de glosa
   → Repasse ao médico → Fluxo de caixa (Cash)
```

## Contas de paciente
Recursos: `contasPaciente` (44 operações), `contasPacientePendencia`. Telas: `/contasPaciente`, `/contasPaciente/:idAgenda`.

- Itens da conta ✅: **procedimentos**, **produtos físicos** (mat/med), **staff médico** (honorários por função), taxas.
- Preço calculado por **tabela de preço** do convênio/plano (`calcularPrecoStaff`), com recálculo da conta. ✅
- **Status da conta** com etapas (`prepararStatusConta`, `salvarStatusConta`). ❓ Valores exatos a confirmar.
- **Pendências** da conta, com tipos configuráveis. ✅
- **Transferências**: itens entre contas, conta para outra **unidade** ou para outra **classificação de guia**. ✅
- Gastos de mat/med e gráficos da conta. ✅
- Pagamento particular na conta: várias formas, parcelas, **crédito do paciente**, recibo, **recibo DMED**. ✅
- Ligação com a agenda (itens por agendamento) e com o fluxo de caixa. ✅
- "Refazer informações TISS" da conta (`refazerInfoTiss`). ✅

## Guias TISS ✅
Recurso: `guiasTiss`. Campo `TIPO_GUIA`; versão do padrão em `VERSAO_TISS`.

| Tipo (`TIPO_GUIA`) | Guia |
|---|---|
| `consulta` | Guia de Consulta |
| `sadt` | SP/SADT |
| `sadt_honorarios` | SP/SADT com honorários |
| `honorarios` | Honorário individual |
| `solicitacao_sadt` | Solicitação de SP/SADT (vinda do PEP ou da conta) |
| `solicitacao_internacao` | Solicitação de internação |
| `resumo_internacao` | Resumo de internação |
| `outras_despesas` | Outras despesas |
| `opme` | Anexo de OPME |
| `odontologica` | Tratamento odontológico |
| `sus_ambulatorial` | SUS ambulatorial (BPA 🔶) |
| `sus_especiais` | SUS procedimentos especiais (**APAC**; há página na wiki) |

- Campos TISS do atendimento ✅: `TISS_INDICACAO_CLINICA`, `TISS_INDICADOR_ACIDENTE`, `TISS_TIPO_ATENDIMENTO`, `TISS_TIPO_DOENCA`, `TISS_TEMPO_DOENCA`, `TISS_TEMPO_DOENCA_TIPO`, `TISS_TIPO_SAIDA`, `TISS_LAUDO_ESPECIAL`, `TISS_LAUDO_PRORROGACAO`, `TISS_OBSERVACAO`.
- Impressão com **imagem da assinatura** do médico solicitante e executante (`IMAGEM_ASSINATURA_GUIAS`) e **assinatura do paciente** capturada na tela. ✅
- `ORIGEM_GUIA`: conta ou solicitação. Há listas de solicitações pendentes e validação. ✅
- **Classificação de guias** e de atendimentos (agrupamento para faturamento e lotes). ✅
- **Layouts de convênios** e **configuração de faturamento automático** (só no desktop). ✅
- ❓ Geração de **XML TISS** e envio do lote: o site cita "XML TISS". Confirmar se é feito no desktop.
- **Integração Orizon** (autorização, faturamento e cobrança eletrônicos). ✅ (blog)

## Cobrança de convênio e glosas
Recurso: `cobrancas`. Tela: `/cobrancasConvenio`.
- **Cobranças** (lotes) com **protocolos** de entrega. ✅
- **Faturamento × pagamento** (`salvarFatPag`): registro do que o convênio pagou, ligado ao fluxo de caixa. ✅
- **Tipos de glosa**, **justificativas de glosas técnicas** e **acompanhamento** (os dois últimos só no desktop). ✅
- Relatórios: valores resumidos por plano de saúde e cobranças entregues. ✅

## Particular
- **Orçamentos de pacientes**, com parcelamento e taxa, ligados à agenda (`/orcamentoPaciente`). Status: Em aberto · Já agendado · Perdido · Fora da validade. ✅
- Cobrança via **Paylogos** (PIX, cartão, link) e emissão de **NFS-e** (ver [Cash](cash-financeiro-paylogos.md)). ✅

## Obrigações acessórias ✅
- **DMED**: relação para a declaração de serviços médicos (Receita Federal), com recibos DMED.
- **CIHA**: comunicação de internação hospitalar e ambulatorial ao SUS.
- **BPA/APAC**: faturamento SUS.

## Repasse médico
Recurso: `repasse` (`calcularPeriodo`, `listar`, `atualizarRepasse`). Tela: `/repasse`.
- Cálculo **por período**, com regras por **categoria do staff**, **tipo de comissão**, **donos de equipamentos** (o equipamento rende comissão ao dono). ✅
- **Lançamentos extras** para repasse (desktop). ✅
- Ligado ao fluxo de caixa (`listarRepassePorFluxoDeCaixa`) e a `ID_FATURAMENTO_STAFF_MEDICO`. ✅
- O site promete repasse "em tempo real" e "extras no repasse". ✅
- ❓ **As regras reais por médico são a principal pendência.** Precisamos levantá-las com o financeiro.

## Tabelas que alimentam o faturamento
Centros de responsabilidade · Tipos de pendência · Tipos de glosa · Turnos e **taxas de turno** (adicional por horário) · Classificação de guias e de atendimentos · Tabelas de preço · **Brasíndice** (preço de medicamentos) · Tempo de duração do atendimento · Categorias de produtos e serviços. ❓ TUSS, CBHPM e SIMPRO não aparecem no código web; confirmar quais tabelas de codificação são usadas.

## Relatórios ✅
Atendimentos por médico · Faturamento e movimentação de estoque por médico · Valores resumidos por plano · Cobranças entregues · Repasse staff médico · Planilhas por plano/convênio × produto/serviço · Auditoria (consistências, conferências, cadastros).
