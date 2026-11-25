# D2) Análise dos XML TISS reais — cirurgias, injeções, exames e consultas

**Data:** 22/11/2026 · **Autorização:** Ana Carolina liberou a leitura dos XML nas pastas `C:\<convênio>`.
**Privacidade:** li 41 XML recentes (Unimed Consumed, Amil, Bradesco Saúde e Bradesco Operadora) **com um programa que extrai só a estrutura e os códigos de configuração**. Nenhum nome, carteirinha, CPF, senha ou nº de guia de paciente foi anotado. CPFs de médicos também foram omitidos. As cópias temporárias foram **apagadas** ao final.

---

## 1. O que existe em cada pasta de convênio
Além dos XML, as pastas guardam o **controle manual pós-envio**:
- **Unimed – Consumed Prestador:** PDFs "Remessa de Documentos Recebido" e "RemessaXXXXXXXX.pdf" (comprovantes do portal) + pasta **"Recurso de glosa"**.
- **Amil:** "Capa de Lote NNN.pdf", "Comprovante _Lote NNN.pdf", "Protocolo – Lote NN.pdf", "Recibo de entrega … Previsão de pagto …pdf", contrato e anexos da rede.
- **Bradesco:** XML de **Bradesco Saúde (ANS 005711)** e **Bradesco Operadora (ANS 421715)** **na mesma pasta**, mais arquivos **.ZIP** com o mesmo padrão de nome (o portal do Bradesco recebe o lote compactado).
➜ **Requisito para o sistema novo:** anexar ao lote o protocolo/comprovante/capa e registrar a previsão de pagamento (hoje isso fica em PDFs soltos na pasta).

## 2. Regras gerais (valem para todos os XML analisados)
| Item | Valor encontrado |
|---|---|
| Codificação | `ISO-8859-1` em **todos** (inclusive Amil, cujo cadastro diz UTF-8 — conferir) |
| Transação | `ENVIO_LOTE_GUIAS` · `sequencialTransacao` = nº do lote com 12 dígitos (ex.: 000000000258) |
| Versão (`Padrao`) | Unimed e Amil **4.01.00** · Bradesco Saúde e Operadora **4.03.00** |
| Origem | `codigoPrestadorNaOperadora`: Unimed **1474** · Amil **10453164** · Bradesco **0000110502** |
| CNES do executante | **3176479** (Consumed) |
| Conselho / UF / CBO | `06` (CRM) · `33` (RJ) · **225265** (médico oftalmologista) |
| Fim do arquivo | `epilogo/hash` (MD5 do conteúdo) |
| Nome do arquivo | `<ANS 6 dígitos><AAAAMM><lote 4 dígitos>_<hash>.xml` |
| 1 lote = 1 tipo de guia | cada XML contém só Consulta, **ou** só SP/SADT, **ou** só Honorários |

## 3. CIRURGIAS — Guia de Honorários (`guiaHonorarios`)
Usada pelo **Bradesco** e pela **Amil** (Facectomia com LIO 30306027, Cirurgias Fistulizantes Antiglaucomatosas 30310032…). Estrutura exata:

```
guiaHonorarios
 ├ cabecalhoGuia: registroANS, numeroGuiaPrestador
 ├ guiaSolicInternacao        (nº da guia de solicitação/internação)
 ├ senha                       (senha de autorização)
 ├ numeroGuiaOperadora
 ├ beneficiario: numeroCarteira, atendimentoRN (N)
 ├ localContratado             ← HOSPITAL/CENTRO CIRÚRGICO onde a cirurgia foi feita
 │   ├ codigoContratado/codigoNaOperadora   (código do hospital na operadora)
 │   ├ nomeContratado
 │   └ cnes                                  (CNES do hospital)
 ├ dadosContratadoExecutante   ← A CLÍNICA (quem cobra o honorário)
 │   ├ codigonaOperadora  (Bradesco 0000110502 / Amil 10453164)
 │   └ cnesContratadoExecutante (3176479)
 ├ dadosInternacao: dataInicioFaturamento, dataFimFaturamento, caraterAtendimento (1 = eletivo)
 ├ procedimentosRealizados/procedimentoRealizado  (1 por profissional/procedimento)
 │   ├ sequencialItem, dataExecucao
 │   ├ procedimento: codigoTabela (22 = TUSS), codigoProcedimento, descricaoProcedimento
 │   ├ quantidadeExecutada, viaAcesso (1), tecnicaUtilizada (1)
 │   ├ reducaoAcrescimo, valorUnitario, valorTotal
 │   └ profissionais: grauParticipacao, codProfissional, nomeProfissional,
 │                    conselhoProfissional (06), numeroConselhoProfissional, UF (33), CBO (225265)
 ├ observacao
 ├ valorTotalHonorarios
 └ dataEmissaoGuia
```
**Locais (hospitais) encontrados nas guias:**
| Convênio | localContratado | Código na operadora | CNES |
|---|---|---|---|
| Bradesco Saúde | PRO OFTALMO MICRO CIRURGIA OCULAR S/C LTDA | 193216 | 5325722 |
| Amil | BARRA DAY SERVIÇOS MÉDICOS LTDA | 73122076 | 102881 |
➜ Isso explica as **"Unidades"** do Micrologos: são os hospitais onde os médicos operam; o cadastro precisa guardar **código na operadora e CNES de cada hospital por convênio**.

**Equipe:** cada cirurgia gera itens com **grauParticipacao 00 (cirurgião) e 01 (1º auxiliar)** — o mesmo procedimento aparece uma vez para cada profissional.
**Atenção – fator `reducaoAcrescimo`:** Bradesco usa **2.00** na facectomia; Amil usa **1.00**. ⚠️ Confirmar a regra (bilateral? acordo do Bradesco?). Esse fator multiplica o valor e é ponto clássico de glosa.
**Diferença Amil × Bradesco:** na Amil o campo `caraterAtendimento` e `atendimentoRN` **não aparecem em todos os itens/guias** (opcional na 4.01.00); no Bradesco (4.03.00) sempre aparecem.

## 4. INJEÇÕES INTRAVÍTREAS e CIRURGIAS na UNIMED — SP/SADT com PACOTE
A Unimed (Consumed Prestador, ANS 344397) **não usa guia de honorários**: tudo vai em **SP/SADT com códigos de pacote da tabela 98**.
| Código | Descrição | Ocorrências (lote 258) |
|---|---|---|
| 69911312 | Pacote Tratamento Ocular **Eylia** | 27 |
| 69911096 | Pacote Fotocoagulação Unimed | 5 |
| 69911070 | Pacote **Facectomia** com Lente Intraocular | 3 |
| 69911320 | Pacote **Ozurdex** Unimed | 2 |
| 69911185 | Pacote Pálpebra Reconstrução Total | 1 |
Campos usados: `codigoTabela` **98** (pacotes) · `grauPart` **00** dentro de `equipeSadt` · `reducaoAcrescimo` 1.00 · `tipoAtendimento` **03** (maioria) ou **02** · `regimeAtendimento` 01 · `tipoConsulta` 2 · `indicacaoAcidente` 9 · `caraterAtendimento` 1 · `indicacaoClinica` preenchida · `dadosAutorizacao` com **numeroGuiaOperadora, dataAutorizacao, senha e dataValidadeSenha** (obrigatórios em todas as 38 guias).
Solicitante: `nomeContratadoSolicitante` = CONSUMED CONSULTÓRIOS MÉDICOS LTDA ou o **próprio médico** (ex.: Dr. Antonio, médico de fora). `codigoPrestadorNaOperadora` do executante 1474 e do profissional na equipe = código de cooperado do médico.
➜ **Para o sistema novo:** a injeção (Eylia, Ozurdex, Lucentis) precisa ser cadastrada **como pacote por convênio** (Unimed = código 699…/tabela 98; outras operadoras podem usar TUSS 30312132 + medicamento). Não encontrei nenhum lote com `outrasDespesas` (medicamento/material separado) nas amostras — o medicamento vai embutido no pacote.

## 5. EXAMES — SP/SADT (`guiaSP-SADT`) com TUSS (tabela 22)
Exemplos: Tonometria 41301323, Microscopia Especular 41301269, Ceratoscopia 41301080, Paquimetria 41501128, Mapeamento de Retina 41301250, Retinografia 41301315, Gonioscopia 41301242, OCT 41501144, Biometria 41501012, Angiografia 41301013, Ultrassonografia 40901017, Exercícios de Ortóptica 20103239, Capsulotomia YAG 30306019, Fotocoagulação 30312043, Iridotomia 30310083.
Estrutura: cabecalhoGuia · dadosAutorizacao · dadosBeneficiario · dadosSolicitante (contratado + profissional) · dadosSolicitacao (dataSolicitacao, caraterAtendimento, indicacaoClinica) · dadosExecutante (código + CNES) · dadosAtendimento (tipoAtendimento, indicacaoAcidente 9, tipoConsulta, regimeAtendimento 01) · procedimentosExecutados (sequencialItem, dataExecucao, procedimento, quantidade, viaAcesso 1, tecnicaUtilizada 1, reducaoAcrescimo, valores, **equipeSadt** com grauPart **12** (executante) e CBO 225265) · observacao · valorTotal.
- `tipoAtendimento`: Bradesco e Amil usam **23** (exames); alguns itens **03**.
- **`reducaoAcrescimo` 2.00** aparece em exames binoculares (microscopia, paquimetria, ceratoscopia) na Amil e no Bradesco → o sistema marca **"ambos os olhos" = fator 2**. ⚠️ Confirmar se é essa a regra.
- **Amil manda a CONSULTA dentro da SP/SADT** (10101012, tabela 22, tipoAtendimento **04**, grauPart 12, tipoConsulta 1 ou 2).

## 6. CONSULTAS — Guia de Consulta (`guiaConsulta`) — Bradesco
Estrutura: cabecalhoConsulta (registroANS, numeroGuiaPrestador) · numeroGuiaOperadora · dadosBeneficiario (numeroCarteira, atendimentoRN) · contratadoExecutante (codigoPrestadorNaOperadora, CNES) · profissionalExecutante (nome, conselho, nº, UF, CBOS) · indicacaoAcidente · dadosAtendimento (regimeAtendimento, dataAtendimento, tipoConsulta, procedimento: codigoTabela 22 + 10101012 + valorProcedimento) · observacao.

## 7. Resumo por convênio (amostra out–nov/2026)
| Convênio | Versão | Consulta | Exames | Cirurgia | Injeção |
|---|---|---|---|---|---|
| Unimed Consumed (cirurgia) | 4.01.00 | – | – | SP/SADT pacote (tab. 98) | SP/SADT pacote Eylia/Ozurdex (tab. 98) |
| Amil | 4.01.00 | **dentro da SP/SADT** | SP/SADT | Honorários (local = Barra Day) | (não visto na amostra) |
| Bradesco Saúde | 4.03.00 | Guia de Consulta | SP/SADT | Honorários (local = Pro Oftalmo), fator 2.00 | (não visto) |
| Bradesco Operadora | 4.03.00 | Guia de Consulta | SP/SADT | (não visto) | (não visto) |

## 8. Respostas da Ana Carolina (22/11/2026)
- **Fator 2,00** em exames de ambos os olhos e na facectomia do Bradesco está **correto**. Cada convênio cobra conforme o contrato, e o sistema novo precisa permitir **regra de fator por convênio × procedimento**, sem padronizar.
- **Injeções:** hoje só são cobradas na **Unimed**. Amil, Bradesco, Geap e Hapvida **não** têm injeção (o credenciamento está em andamento). ➜ O sistema novo deve permitir cadastrar o pacote de injeção por convênio quando o credenciamento sair.
- **Envio compactado (.zip):** **Bradesco, Mediservice e Klini** só aceitam o lote **zipado** no portal. ➜ Requisito: gerar o XML e também o **.zip** com o mesmo nome.
- Mediservice e Porto Seguro são atendidos (já estão no `A-convenios.md`).

## 9. Pontos ainda a confirmar com o faturamento
1. O cadastro da Amil diz UTF-8, mas o XML sai em ISO-8859-1 — a Amil aceita normalmente?
2. Quais glosas mais aparecem hoje (pasta "Recurso de glosa" da Unimed)? Ajuda a desenhar validações no sistema novo.
