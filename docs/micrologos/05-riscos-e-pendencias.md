# 05 · Riscos e perguntas em aberto

## Riscos principais
| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | **Faturamento TISS/SUS** mal reproduzido (layouts por convênio, versões TISS, BPA/APAC/CIHA) | Receita parada, glosas | Começar pelo mapeamento dos convênios ativos; validar XMLs com cada operadora antes da virada |
| R2 | **Regras de repasse** não documentadas | Conflito com médicos | Levantar regras com o financeiro e comparar o cálculo dos 2 sistemas em paralelo por 1 a 2 meses |
| R3 | **Prontuário**: perda de histórico ou de validade das assinaturas digitais | Risco legal (CFM, guarda de 20 anos) | Migrar os documentos assinados originais e manter o legado acessível em modo leitura |
| R4 | Dados que **só existem no desktop** | Migração incompleta | Exigir o dump do banco, não só a API web |
| R5 | **Lock-in do Paylogos** e dos créditos pré-pagos | Recebíveis em trânsito, saldo de créditos | Planejar a troca de gateway; zerar créditos antes da virada |
| R6 | Links antigos (portal de laudos, links de pagamento, validador) | Pacientes sem acesso | Comunicação aos pacientes e período de convivência |
| R7 | **Escopo enorme** (5 módulos, cerca de 220 telas) | Projeto que não termina | Priorizar pelo uso real; MVP para a virada; o resto depois |
| R8 | Integrações de equipamentos (Zeiss, captura de imagem, PACS) | Parada do setor de exames | Levantar equipamentos e protocolos (DICOM worklist?) |

## Perguntas em aberto ❓
**Uso**
- Quais módulos e telas a clínica usa hoje? Web, desktop ou ambos? Quantos usuários?
- Usa internação, centro cirúrgico, SUS, Quality, Talklogos, Paylogos, NFS-e?

**Faturamento**
- Quais convênios estão ativos e qual o volume mensal de guias por tipo?
- Envio de lotes XML: é feito pelo Micrologos, pela Orizon ou pelo portal de cada operadora?
- Quais tabelas de codificação são usadas (TUSS, CBHPM, AMB, Brasíndice, SIMPRO)?
- Quais são as regras de repasse por médico (percentual, valor fixo, por procedimento, por equipamento, extras)?

**Dados**
- Qual é o banco de dados do legado? Qual o tamanho? Há backup local?
- Qual o volume de imagens DICOM e anexos? O PACS (Orthanc) é da Micrologos ou da clínica?
- O contrato prevê exportação dos dados? Qual o prazo e o custo?

**Integrações**
- Quais números de WhatsApp (oficial ou QR) e provedores de SMS e e-mail são usados?
- Qual a prefeitura ou a NFS-e Nacional, e onde está o certificado da empresa?
- Quais equipamentos se integram (Zeiss, outros)?

## Registro de decisões
| Data | Decisão | Motivo |
|---|---|---|
| | | |
