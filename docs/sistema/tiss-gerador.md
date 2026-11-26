# Gerador de XML TISS (sessão "Dados para migração", a partir de 22/11/2026)

**Objetivo (prioridade nº 1 da dona):** gerar o XML TISS de cirurgias e injeções **igual** ao que o Micrologos gera hoje
e as operadoras aceitam, sem glosa. Requisitos em `docs/micrologos/mapeamento-telas/` (Parte 1 §4, Parte 9 = D2).

## Onde está
- `app/src/lib/tiss/`: biblioteca pura em TypeScript, sem banco e sem tela.
  - `gerarLote(lote)` devolve `{ xml, bytes (ISO-8859-1), hash, nomeArquivo }`.
  - `validarLote`: valida antes de gerar.
  - `zipar`: monta o `.zip` (Bradesco, Mediservice, Klini).
- Guias: **Honorários** (cirurgia: hospital em `localContratado`, um item por profissional 00/01), **SP/SADT** (exames
  tabela 22; pacotes Unimed tabela 98, como Eylia 69911312 e Ozurdex 69911320; consulta da Amil com tipoAtendimento 04) e
  **Consulta**.
- `app/scripts/tiss/`:
  - `testar.ts`: lotes 100% fictícios de cada tipo.
  - `validar.sh`: `xmllint` contra o XSD oficial.
  - `conferir_hash.py`: hash calculado de forma independente; serve também para XML reais.
  - `xsd/4.03.00/`: XSD oficial da ANS, de PadroTISSComunicao_202511.zip, gov.br.

```bash
cd app && npx -y tsx@4.19.2 scripts/tiss/testar.ts /tmp/tiss && scripts/tiss/validar.sh /tmp/tiss 4.03.00
```

## Situação (22/11/2026)
- ✅ Os 4 tipos de lote passam no XSD 4.03.00.
- ✅ O MD5 confere com os vetores da RFC 1321.
- ✅ O hash do epílogo confere com o cálculo independente.
- ✅ O nome do arquivo segue o padrão `<ANS6><AAAAMM><lote4>_<hash>.XML`.
- ✅ Validações já feitas: um tipo de guia por lote, máximo de guias e de procedimentos, senha vencida, item sem
  profissional ou sem fator.

## ⚠️ A confirmar com XML reais do Micrologos (anonimizados; ainda não recebidos)
1. **XSD 4.01.00 e 4.02.00:** não estão mais no site da ANS. Pedir à dona os arquivos `.xsd` do computador do Micrologos.
2. **Regra do hash:** ✅ **confirmada no Componente Organizacional (set/2026, item 148)**: "apenas a concatenação do conteúdo das tags, desprezando as tags", de forma literal, "o encoding a ser utilizado será sempre o ISO-8859-1", sem nomes de elementos ou atributos. É exatamente o que o gerador faz. Falta só conferir com um XML real.
3. **valorTotal do item:** hoje é calculado como quantidade × valorUnitário × fator. Confirmar se o Micrologos já manda o unitário com o fator.
4. **numeroLote:** dentro de `loteGuias`, está com 12 dígitos como o `sequencialTransacao`. Confirmar.
5. **Formato do arquivo:** prefixo `ans:`, sem quebras de linha, extensão `.XML`, `xsi:schemaLocation`.
6. **Na 4.01.00:** quando a Amil omite `atendimentoRN`/`caraterAtendimento` nos honorários. Por ora há a opção `omitirOpcionaisHonorarios`.
7. **"Formato de data dd/mm/aaaa" da Geap:** o XSD só aceita AAAA-MM-DD. Provavelmente é uma configuração de outra coisa no Micrologos.

## Atualização do mapeamento (22/11/2026, tarde)
- Novo RESUMÃO: `docs/micrologos/mapeamento-telas/MAPEAMENTO-COMPLETO-2026-11-22.md` (versão atualizada, com a Parte 15 = configuração TISS de cada convênio).
- **Regra de ouro da dona:** as configurações TISS atuais do Micrologos não geram glosa. Replicar exatamente, convênio por
  convênio, e conferir contra XML reais aceitos.
- **Versões:** gerar 4.01.00, 4.02.00 ou 4.03.00, conforme o convênio, e estar pronto para migrar todos para a 4.03.00.
- Destaques do arquivo I (a dona vai enviar o arquivo completo):
  - Mediservice: no máximo **5** procedimentos por guia; Amil: 10.
  - Unimed Gelson usa **8 dígitos** no código TISS (os demais, 10).
  - Unimed Consumed: via de acesso "Única" no procedimento principal e "Mesma/Diversas" nos demais. O **valor unitário é o
    original**, o que reforça a regra atual (valorTotal = quantidade × unitário × fator).
  - Geap, Hapvida, Porto, Portomed e Unimed Luciano mostram data dd/mm/aaaa no cadastro. Gerar igual aos XML reais aceitos
    (o XSD só aceita AAAA-MM-DD).
- ✅ Arquivo I recebido: é a Parte 15 do mapeamento completo. Os links de XSD 4.01/4.02 apontam para a página de histórico, que não tem os arquivos para baixar (conferido em 22/11). Continuam faltando.

## Decisão da dona (22/11/2026)
- Prestador em todas as guias e XML: **Consumed Consultórios Médicos Ltda**, CNPJ 05.894.660/0001-87, CNES 3176479. "Hospital de Olhos da Baixada" é só um nome fantasia para o futuro (2027).

## Cadastro TISS dos convênios (migração 0150, 25/11/2026)
- `convenios.tiss` (jsonb) guarda as regras de cada operadora copiadas do Micrologos. Chaves principais:
  - **prestador:** `prestador{tipo PJ/PF, identificacao codigo_operadora|cnpj|cpf, codigo_operadora, cnpj, nome, cnes}`;
  - **versão e formato:** `versao`, `encoding`, `formato_data`;
  - **dígitos:** `digitos_lote`, `digitos_lote_arquivo`, `digitos_guia`, `digitos_codigo_tiss`;
  - **limites:** `max_procedimentos_guia`, `max_guias_lote`;
  - **numeração:** `numeracao_guia` (manual/automatica), `numeracao_unica`;
  - **tipo de guia:** `consulta_em_sadt`, `honorarios_se_cirurgia`, `honorarios_somente_cirurgicos`, `sessao_em_serie`;
  - **conteúdo da guia:** `mostra_fator`, `data_autorizacao_vazia_usa_data_conta`, `guia_operadora_igual_prestador`, `guia_principal_mesmo_numero`, `nao_preenche_guia_principal`, `nao_escreve_equipe_guia_medico_principal`, `uma_guia_toda_equipe`, `observacao_descricao_cid`, `usa_codigos_medicos_cadastro`;
  - **arquivo e controle:** `exige_zip`, `ultimo_lote`, `fonte`.
- `convenios.descontos`: 2º ao 5º procedimento (cirurgia e exames), em %.
- `precos`: `codigo_guia` e `tabela_guia` (o que vai na guia), `necessita_autorizacao` e `tabela_preco` (origem no Micrologos).
  O gatilho `interno.tg_item_preco` usa o código e a tabela da guia do preço do convênio.
- `hospitais` + `hospital_convenio_codigos` (localContratado) e `profissional_convenio_codigos` (executante/solicitante).
- Convênios cadastrados: ver `docs/micrologos/mapeamento-telas/convenios/LEIAME.md`.

## Próximos passos
1. Teste de igualdade com 1 XML real de cada tipo: Honorários Bradesco, Honorários Amil, SP/SADT pacote Unimed,
   SP/SADT exames, Consulta Bradesco, Consulta Amil na SP/SADT.
2. Cadastros que alimentam o gerador:
   - configuração TISS por convênio/prestador (Unimed por médico);
   - hospitais com código e CNES por convênio;
   - regra de fator convênio × procedimento × olho;
   - código enviado por tabela de preço.
3. Tela: montar o lote a partir das contas, gerar o XML e o `.zip`, baixar, e registrar no lote (com a trava de "guia conferida").

## Botão "📄 Gerar XML" no lote (26/11/2026)
- Tela do lote (Faturamento → Lotes → lote) → **Gerar XML**: baixa o `.XML` (ou `.zip`, se `tiss.exige_zip`, ex.: Bradesco).
- `app/src/lib/tissMontar.ts` (parte pura, testável) transforma as contas em guias; `app/src/lib/tissLote.ts` busca no banco.
  Teste com dados fictícios: `cd app && npx -y tsx@4.19.2 scripts/tiss/testar_lote.ts /tmp/tiss-lote && scripts/tiss/validar.sh /tmp/tiss-lote 4.03.00` (✅ XSD e hash ok).
- Nº do lote no XML: sequência própria do convênio (`convenios.tiss.ultimo_lote` + 1), gravada em `lotes.numero_tiss`
  na primeira geração e mantida se gerar de novo (migração 0166, função `lote_numero_tiss`).
- Regras desta primeira versão:
  - conta "consulta" → Guia de Consulta (ou SP/SADT com tipoAtendimento 04 se `consulta_em_sadt`); conta "sadt" → SP/SADT
    tipoAtendimento 23, equipe grauPart 12; um lote só pode ter um tipo de guia (o sistema avisa);
  - profissional: conselho 06/UF 33/CBO 225265; nº do conselho = CRM com prefixo 52 se `crm_completo`, sem prefixo se não;
    código na operadora = `profissional_convenio_codigos` ou, se não houver, o código da clínica (arquivo J);
  - item "ambos os olhos" com quantidade 2 → quantidade 1 e fator 2,00 (mesmo total), se `mostra_fator`;
  - data de autorização vazia → data da conta, se `data_autorizacao_vazia_usa_data_conta`.
- ✅ **Guia de Honorários (cirurgia)** (26/11, migração 0168): conta com tipo "Honorários" (ou com cirurgia, se
  `honorarios_se_cirurgia`); hospital da conta (`contas.hospital_id` → `hospital_convenio_codigos` = localContratado),
  nº da guia de solicitação (`contas.guia_solicitacao`), um item por participação com `conta_itens.grau_participacao`
  (00 cirurgião, 01 auxiliar, 05 instrumentador…) e o médico do item. Com `honorarios_somente_cirurgicos`, itens que não
  são cirurgia (ex.: lente) ficam fora da guia (aviso). Teste fictício passa no XSD 4.03.00.
- Códigos dos médicos (migração 0167 + `migracao/transformacoes/07_codigos_medicos.sql`): código executante/solicitante por
  convênio/plano/hospital e "executa como"/"solicita como" (médico que sai na guia no lugar de outro). Códigos que são CPF
  não são copiados (ocorrência registrada).
- ⚠️ Calibrar com XML reais do Micrologos, convênio por convênio (plano combinado com a dona em 26/11): nº do CRM com ou sem
  52, tipoConsulta, fator 2,00, guia de solicitação, ordem dos itens.

## Comparação com XML reais do Micrologos — Bradesco Saúde (26/11/2026)
A dona enviou os XML das cobranças 11378 (honorários, lote 1670), 11379 (consultas, lote 1677) e 11380 (SP/SADT,
lote 1676) pelo Storage (`migracao-micrologos/xml-teste/`). Comparação: `migracao/xml/comparar_xml.py` (não imprime dados
de paciente). Regras descobertas e aplicadas (migração 0169 + `tissMontar.ts`):
- `numeroLote` **sem zeros à esquerda** (o `sequencialTransacao` continua com 12 dígitos).
- Textos **sem acento e sem barra** ("S/C" → "S C", "Fotocoagulação" → "Fotocoagulacao"); nome do médico como no
  cadastro do Micrologos ("Gisele Moura Brasil"), em `profissional_dados_tiss.nome_guia`.
- Médico sem código próprio no convênio → `codProfissional/cpfContratado` (CPF do médico, guardado em
  `profissionais_dados_pessoais` — a mesma tabela da Memed — e lido pelo XML via `tiss_dados_medicos()`, só faturamento/admin;
  migração 0170). Nome na guia: tela Equipe → "Nome nas guias / XML do convênio".
- `observacao` = "Conta <nº da conta no Micrologos>" em todas as guias.
- SP/SADT: `guiaPrincipal` = nº da guia; `tipoConsulta` sempre; `dataSolicitacao` = data da autorização; exames →
  tipoAtendimento 23 / grauPart 12; procedimento (fotocoagulação) → 03 / 00; fator = quantidade (2 olhos → 2,00) e
  valorTotal = quantidade × unitário.
- Honorários: **uma guia por participante** (cirurgião na guia da conta; auxiliar/instrumentador com nº de guia próprio,
  `conta_itens.numero_guia`); fator = valor ÷ valor de tabela (facectomia 2,00) com o unitário já multiplicado
  (`conta_itens.fator`).
- Itens na ordem do Micrologos (ordem de lançamento).
- Formato: o Micrologos grava com quebras de linha (CRLF) e indentação; o novo grava em uma linha. O hash não muda
  (só conteúdo das tags conta). ⚠️ Se algum portal recusar, ligar `indentar`.
- Nº do lote: a cópia do banco é de antes da cobrança 11379 (lote 1677); na cópia final o `ultimo_lote` vem certo.
- **Resultado (26/11, fim da tarde):** depois dos ajustes (migrações 0169–0171), os 3 XML do sistema novo ficaram
  **iguais** aos do Micrologos, guia a guia e campo a campo (só mudam data/hora de registro e o hash, que dependem da hora
  da geração): 11378 honorários R$ 3.097,30 (2 guias: cirurgião e auxiliar), 11379 consultas R$ 6.365,68 (47 guias),
  11380 SP/SADT R$ 6.359,32 (50 guias), todos válidos no XSD 4.03.00. Outras regras achadas nesta rodada: na SP/SADT os
  itens vão do maior para o menor valor total; nos honorários o nome do médico vai em maiúsculas; a guia do auxiliar tem
  nº próprio também na operadora (`conta_itens.numero_guia_operadora`); textos sem hífen; conta do Micrologos com nº de
  guia repetido sai com o nº original no XML (`legado.guia_micrologos`).
- Desempenho da carga 06: precisa de `set local jit = off` e `analyze` das tabelas temporárias (sem isso passa de 30 min).

## 2ª rodada de comparação — Amil, Unimed Consumed Cirurgia, Geap, Hapvida (26/11/2026, noite)
Cobranças 11226 (Amil honorários, lote 195), 11351 (Amil SP/SADT, 204), 11390 (Unimed pacotes, 259), 11354 (Geap
SP/SADT, 373), 11399 (Hapvida consultas, 1923), 11400 (Hapvida SP/SADT, 1924) + as 3 do Bradesco de novo:
**as 9 ficaram iguais ao Micrologos, campo a campo, com os mesmos totais.** Regras novas (todas no `tissMontar.ts`):
- CRM sempre completo (com o 52) em todos os convênios.
- Hapvida identifica a clínica pelo **CNPJ** (`prestador.identificacao = cnpj_cpf`).
- 4.01.00 (Amil): honorários sem `caraterAtendimento`. ⚠️ Esse XML não passa no XSD 4.03 (falta o XSD 4.01 para validar),
  mas é igual ao que o Micrologos manda e a Amil aceita.
- Fator informado = (valor do 1º olho + valor do 2º) ÷ valor do 1º (Hapvida 2º olho a 70% = 1,70; sem desconto = 2,00);
  Geap informa 1,00 e **desmembra** em 2 linhas (via 1 e via 3) quando o 2º olho tem valor diferente
  (`tiss_se_desmembra_via_diversas`). Valores do 1º/2º olho vêm de `legado.v1`/`v2` do item.
- Grau: exame/consulta = grau do médico no convênio (`profissional_convenio_codigos.grau_participacao`, Geap 11) ou 12;
  procedimento/cirurgia = 00. Tipo de atendimento e data da solicitação: os da conta do Micrologos (`legado`).
- Ordem dos itens: Bradesco e Geap (`tiss_sadt_semequipe_guia_princ`) do maior para o menor valor unitário; os demais
  com o de maior valor primeiro.
- Unimed: sem `guiaPrincipal` (`tiss_guiasadt_solic_embranco`), pacote tabela 98 sem via/técnica (`tiss_usa_pacote_sadt`),
  código do cooperado do médico (cadastrado na unidade da clínica).
- Contratado solicitante sempre "CONSUMED CONSULTORIOS MEDICOS LTDA".
- **Carga das contas:** os produtos lançados na conta (PRODUTOS_MOVIMENTACAO: pacotes Unimed, lentes, medicamentos —
  4,5 mil itens, R$ 6,3 milhões) agora entram como itens. Com isso 9.921 de 10.904 cobranças batem centavo a centavo
  com o total do Micrologos (antes 9.212).

## 3ª rodada — Bradesco Operadora, Mediservice, Porto Seguro, Fundação Itaú, Saúde Caixa, Unimed Max/Gelson/Gisele, Select (26/11/2026, noite)
16 cobranças (11050, 11348, 11349, 11361, 11359, 11367, 11371, 11363, 11362, 11357, 11358, 11393, 11253, 11394, 11043,
11044) + as 9 anteriores de novo: **as 25 ficaram iguais ao Micrologos, com os mesmos totais.** Regras novas:
- **Uma conta pode ter itens em cobranças diferentes** (Unimed por médico: o honorário do auxiliar vai na "Unimed Max",
  o do cirurgião na Unimed dele). A carga grava a cobrança de cada item (`conta_itens.legado->>'id_cobranca'`, de
  FATURAMENTOS_PAGAMENTOS; índice na migração 0173) e o XML de uma cobrança antiga leva só os itens dela, inclusive de
  contas de outra cobrança. O convênio do lote é o da própria cobrança (`id_convenio_mestre`).
  Na cobrança do auxiliar a guia sai com o nº de guia próprio da participação dele.
- Unimed por médico (prestador = o próprio médico): contratado solicitante = o médico solicitante, com o código de
  cooperado dele (de qualquer convênio em `profissional_convenio_codigos`).
- Honorários com quantidade 2 (cirurgia nos 2 olhos): via 3 e fator 2,00. Visita hospitalar (10102019) e convênios com
  `tiss_xmlcom_horario_produto`: hora inicial/final do item; visita sem via de acesso.
- `tiss_sem_via_acesso` (Unimed Gelson, Fundação Itaú): sem via de acesso. `tiss_cid_na_obs` (Porto, Fundação): observação
  = observação da conta + "Conta nº". Hospital pelo CNPJ (`cnpjLocalExecutante`) só quando o convênio identifica por CNPJ
  (`tiss_cpfcnpj_codoper = C`, Mediservice).
- Nome do contratado solicitante = "nome do prestador" do convênio (Mediservice "... LTDA ME"; Unimed Gisele "GISELE MOURA
  BRASIL"); "Consumed Olhos" (Unimed Cirurgia) vira a razão social.
- Grau de participação do item (01 auxiliar) também na SP/SADT.
- Carga 03: quem já estava na Equipe sem conselho recebe o do Micrologos (ex.: Luciano, COREN, instrumentador).
- Não testados (sem XML): Bradesco Operadora 11381/11382 e Klini 11402 (sem lote no Micrologos), Assist 11135 (arquivo
  do lote 561 não achado em C:\Assist).
