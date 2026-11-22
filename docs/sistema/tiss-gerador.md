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
2. **Regra do hash:** MD5 do texto de todos os elementos, em ISO-8859-1, sem o epílogo. Conferir com `conferir_hash.py` num XML real.
3. **valorTotal do item:** hoje é calculado como quantidade × valorUnitário × fator. Confirmar se o Micrologos já manda o unitário com o fator.
4. **numeroLote:** dentro de `loteGuias`, está com 12 dígitos como o `sequencialTransacao`. Confirmar.
5. **Formato do arquivo:** prefixo `ans:`, sem quebras de linha, extensão `.XML`, `xsi:schemaLocation`.
6. **Na 4.01.00:** quando a Amil omite `atendimentoRN`/`caraterAtendimento` nos honorários. Por ora há a opção `omitirOpcionaisHonorarios`.
7. **"Formato de data dd/mm/aaaa" da Geap:** o XSD só aceita AAAA-MM-DD. Provavelmente é uma configuração de outra coisa no Micrologos.

## Próximos passos
1. Teste de igualdade com 1 XML real de cada tipo: Honorários Bradesco, Honorários Amil, SP/SADT pacote Unimed,
   SP/SADT exames, Consulta Bradesco, Consulta Amil na SP/SADT.
2. Cadastros que alimentam o gerador:
   - configuração TISS por convênio/prestador (Unimed por médico);
   - hospitais com código e CNES por convênio;
   - regra de fator convênio × procedimento × olho;
   - código enviado por tabela de preço.
3. Tela: montar o lote a partir das contas, gerar o XML e o `.zip`, baixar, e registrar no lote (com a trava de "guia conferida").
