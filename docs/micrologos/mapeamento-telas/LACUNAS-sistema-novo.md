# O que falta no sistema novo, comparado ao Micrologos (22/11/2026)

Comparação entre o [mapeamento das telas](MAPEAMENTO-COMPLETO-2026-11-22.md) e o que existe no `main`
(migrações até a 0070 e `app/src/pages/Faturamento.tsx`).
Ordem = prioridade da dona (Parte 1 do mapeamento, §0).

## Já existe no sistema
- `convenios`: ANS, `codigo_prestador`, `versao_tiss`, `exige_senha`, `dias_retorno`.
- `convenio_planos`, `procedimentos` (tabela + código), `precos` (procedimento × convênio × plano).
- `contas` (guia, senha, data de autorização, validade, carteirinha, CID, indicação clínica, status, lote).
- `conta_itens`: glosa e recurso por item. `lotes`: número, competência, status, protocolo, previsão de pagamento, valor pago.
- `cirurgias` e `injecoes_intravitreas`, ligadas a procedimento e convênio; estoque; repasse médico.
- **Não existe geração de XML TISS.** Hoje há só a impressão (`ImprimirFaturamento.tsx`).

## 1. TISS de cirurgias e injeções: prioridade nº 1 (Parte 1 §4; Parte 9 = D2)
| Falta | Detalhe |
|---|---|
| **Gerador de XML TISS** | `ENVIO_LOTE_GUIAS`; versões 4.01.00 e 4.03.00 (e 4.02.00 para a Klini); encoding **ISO-8859-1**; `sequencialTransacao` com 12 dígitos; `epilogo/hash` MD5; nome `<ANS6><AAAAMM><lote4>_<hash>.xml`; `.zip` com o mesmo nome quando o convênio exige (Bradesco, Mediservice, Klini) |
| **Guia de Honorários** | Bradesco e Amil: `localContratado` (hospital: código na operadora + CNES), executante = clínica (CNES 3176479), um item por profissional com `grauParticipacao` 00/01, `viaAcesso`, `tecnicaUtilizada`, `reducaoAcrescimo` |
| **SP/SADT com pacote (tabela 98)** | Unimed: Eylia 69911312, Ozurdex 69911320, Facectomia 69911070, Fotocoagulação 69911096, Pálpebra 69911185. `dadosAutorizacao` completo é obrigatório |
| **SP/SADT de exames** e **Guia de Consulta** | `tipoAtendimento` 23 nos exames; na Amil a consulta vai dentro da SP/SADT (tipo 04); `equipeSadt` grauPart 12 |
| **Validação contra o XSD oficial** da versão, antes de liberar o lote | Mais as validações anti-glosa da Parte 1 §4.5 |
| **Guia "conferida = travada"** | Des-conferir com registro de quem conferiu e quando; PDF da guia no modelo ANS |
| **Testes de igualdade** | Comparar com XML reais anonimizados (1 de cada tipo: Honorários Bradesco, Honorários Amil, SP/SADT pacote Unimed, SP/SADT exames, Consulta Bradesco, Consulta Amil na SP/SADT) |

## 2. Configuração por convênio (Parte 1 §2; Parte 3 = A)
- **Vários "prestadores" por convênio** (PJ da clínica ou PF do médico), cada um com código na operadora e numeração própria de **lote e de guia**. A Unimed é faturada por médico, mais a Unimed Consumed Cirurgia (PJ 1474).
- Configuração TISS por convênio: formato de data, encoding, identificação (código na operadora ou CNPJ/CPF), máximo de guias por lote e de procedimentos por guia, dígitos (lote, guia, senha, CNES), numeração por tipo de guia ou única, "consulta na SP/SADT", "honorários se cirurgia", procedimentos que não vão no XML, exige `.zip`.
- **Hospitais/locais parceiros** (as 14 "unidades"): código na operadora e CNES **por convênio**.
- Impostos por plano: ISS, IRRF, CSLL, PIS, COFINS (hoje há 15% fixos no lote).
- Descontos do 2º ao 5º procedimento (cirurgia/exames).
- Prazos: fechamento, entrega, recebimento, retorno; limites de atendimento.
- Máscara e validade da carteirinha por plano; token do paciente.
- Convênio **"sem TISS / faturamento externo"**: Cedae, Cisbaf, Siass-Geap.

## 3. Tabelas de preço (Parte 4 = B; Parte 5 = B2)
- Entidade **tabela de preço** (66 tabelas, com data de referência). O plano aponta para uma ou mais tabelas, com **prioridade**. Hoje `precos` liga direto procedimento × convênio × plano.
- Por item da tabela: **código enviado na guia** (pode diferir do TUSS: Klini 98901012; pacotes 699…; Select 9xxxxxxx), **"necessita autorização"**, valor (ou CH × fator, como na Fundação Saúde e na Porto CH 0,224/0,28).
- **Regra de fator `reducaoAcrescimo`** por convênio × procedimento × lateralidade (ex.: 2,00 em ambos os olhos na Amil/Bradesco; 2,00 na facectomia do Bradesco).
- Kits/pacotes por plano; preço particular com cartão × dinheiro/Pix.
- Procedimento: AMB, CBHPM, TUSS, CH, olho, cirúrgico, CID obrigatório, solicitação obrigatória, executante obrigatório, sessões, dias de retorno, ficha do PEP ligada.

## 4. Acompanhamento pós-envio: principal melhoria (Parte 1 §6)
- Status do lote: Gerado → Enviado → Protocolado → Em análise → Pago total/parcial → Glosado → Em recurso → Encerrado.
- Anexos no lote: XML, `.zip`, capa, comprovante, protocolo, demonstrativo.
- Previsão de pagamento pelo prazo do convênio, com **alerta de atraso**.
- Importar o demonstrativo TISS (`demonstrativoAnaliseConta`/`demonstrativoPagamento`) ou lançar à mão.
- Glosa com a **tabela ANS de motivos** (527); recurso de glosa em XML TISS (`recursoGlosa`).
- Painel por convênio: enviado × recebido × glosado, % de glosa por motivo.
- **Pedido da dona (25/11/2026):** depois de enviada a cobrança, ela precisa **tirar um paciente da cobrança para fazer
  recurso e depois recolocar** (hoje o sistema só deixa tirar enquanto o lote está "Montando") e **gerar o XML de novo**
  de uma cobrança antiga (inclusive das que vieram do Micrologos).

## 5. PEP (Parte 1 §8; Partes 10 e 11 = E, E2)
- O PEP alimenta a guia: indicação clínica, CID, olho, tipo de atendimento, tempo e tipo de doença.
- Injeção intravítrea estruturada gera o item de pacote do convênio. Confirmar o que a `injecoes_intravitreas` já faz.
- Catarata: LIO e grau da ficha pré-operatória vão para a conta/guia (OPME).
- Fichas com abas: Oftalmo, Catarata, Retina, LC, Óculos, Ortóptica. PIO corrigida pela paquimetria; gráfico da PIO.

## 6. Migração (sessão "Dados para migração")
- Excluir os pacientes de teste do Micrologos: cód. 69489 e 108477.
- As tabelas de preço e os convênios podem ser carregados do banco exportado. A parte B2 serve para conferir valores.
- O Micrologos não exporta CSV pelas telas: depende do **backup do banco** (Ferramentas ▸ Backup). Investigar se o banco é local.

## Decisões da dona
- 22/11/2026: a empresa atual é a **Consumed Consultórios Médicos Ltda** (CNPJ 05.894.660/0001-87, CNES 3176479). "Hospital de Olhos da Baixada" é um nome fantasia para o futuro (2027). O prestador nas guias continua sendo a Consumed.
