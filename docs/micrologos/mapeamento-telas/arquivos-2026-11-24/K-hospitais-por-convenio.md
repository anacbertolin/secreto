# K) Hospitais e centros cirúrgicos (Cadastros ▸ Unidades) e códigos por convênio

**Visto em:** 22/11/2026. Só olhando, nada alterado.
**Onde fica no Micrologos:** Cadastros ▸ Unidades ▸ Detalhamento ▸ sub-aba **Informações TISS** ("Informações TISS utilizadas para honorários médicos – contratado aonde foi executado o serviço, casos de cirurgia externa").
Cada unidade tem:
- um **Código CNES** próprio;
- uma tabela **Convênio → Código na Operadora → Código CNES** (o CNES da linha só é preenchido quando difere do CNES da unidade).

Esses dados vão no bloco **`localContratado`** da guia de Honorários (ver D2).

**CNPJ e cidade/UF:** a tela de Unidades **não mostra** CNPJ nem endereço. Eles ficam no cadastro do **Emitente** (módulo financeiro Cash Master), que não abri.
- Em alguns convênios, o campo "código na operadora" está preenchido com o **CNPJ da própria unidade**. Esses CNPJs aparecem na coluna "CNPJ (quando aparece)".
- Pelos nomes, todas parecem ser do Rio de Janeiro/RJ. Não confirmei.

| Cód | Unidade | Emitente (cód) | CNES da unidade | CNPJ (quando aparece) | Convênio → código na operadora (CNES da linha) |
|---|---|---|---|---|---|
| 1 | **Consumed Consultórios Médicos Ltda** (principal) | Consumed (23) | **3176479** | 05.894.660/0001-87 | Assim 30717 (3176479) · Unimed Gisele 873799 (3176479) · Unimed Luciano [CPF – omitido] (9999999) · Unimed Gelson 863602 (3176479) · Geap 17101182 (3176479) · Hapvida 17687 (3176479) · Fundação Saúde Itaú 00119315 (3176479) · Klini 05894660000187 (3176479) |
| 12 | Consumed | Consumed (18069) | 3176479 | 05.894.660/0001-87 (Saúde Caixa) | Unimed Gelson 863602 · Unimed Gisele 873799 · Unimed Luciano 941222 · Unimed Max 410374 · Saúde Caixa 05894660000187 |
| 3 | Barra Day Serviços Médicos Ltda | idem (15174) | **102881** | 04.781.174/0001-90 | Assim 43303 · Hapvida 102905 · Notre Dame 102905 · Golden Cross 04781174000190 · **Amil 73122076** |
| 11 | Clínica e Cirurgia de Olhos Dr. Armando Augusto Guedes Ltda | idem (15217) | 9260854 | – | Unimed Gelson 863602 · Unimed Luciano 941222 · Unimed Max 410374 |
| 6 | Day Clinic Méier | idem (9181) | 5136989 | – | Amil 10477071 · Bradesco Saúde 203114 |
| 5 | Hospital Daniel Lipp Ltda | idem (2846) | 3014673 | 73.372.427/0001-94 | Hapvida 8083 · Golden Cross 73372427000194 · Bradesco Saúde 195510 · Unimed Gelson 73372427000194 |
| 7 | Hospital Oftalmológico da Barra | idem (9182) | 7544227 | – | Bradesco Saúde 427810 · Bradesco Operadora 427810 |
| 4 | Jardim de Alah Centro Cirúrgico Ltda | idem (2535) | 3135659 | 01.124.549/0001-50 | Golden Cross 01124549000150 |
| 2 | Largo do Machado | idem (179) | 3135268 | – | Assim 22349 · Geap 17084059 · Bradesco Saúde 684724 · Fundação Saúde Itaú 00197066 · Bradesco Operadora 684724 |
| 14 | Oftalmo Rio Centro de Micro Cirurgia Ocular Ltda EPP | idem (25984) | 5417643 | – | Amil 10485520 |
| 10 | **Pro Oftalmo Micro Cirurgia Ocular S/C Ltda** | idem (15181) | **5325722** | 97.515.480/0001-65 | **Bradesco Saúde 193216** · **Bradesco Operadora 193216** · Amil 10467203 · Porto Seguro 50800004 · Mediservice 97515480000165 · Hapvida 97515480000165 |
| 13 | Rio Vision Hospital Ltda | idem (25068) | 4708490 | – | Bradesco Saúde 54409 · Bradesco Operadora 54409 |
| 15 | Unimed Regional Fluminense Cooperativa de Trabalho Médico | idem (27088) | 8403708 | 28.714.533/0017-11 | Unimed Gelson 28714533001711 |
| 9 | UTI Rio Serviços Médicos Ltda | idem (10126) | 7536747 | – | Geap 17102995 · Assim 31272 (7536747) |

**Conferência com os XML reais (D2):**
- Bradesco → Pro Oftalmo, código 193216, CNES 5325722.
- Amil → Barra Day, código 73122076, CNES 102881.
- Os dois ✅ batem com esta tabela.

## O que isso significa para o sistema novo
- O cadastro de **Hospital / Local de execução** precisa ter: CNES, CNPJ e uma tabela **convênio → código do hospital na operadora** (e CNES, se for diferente).
- Na guia de Honorários, o `localContratado` é preenchido a partir do **hospital onde a cirurgia foi feita** e do **convênio do paciente**. Se faltar esse código, a guia é glosada ou rejeitada.
- Algumas operadoras usam o **CNPJ** do hospital como código. Exemplos: Mediservice e Hapvida na Pro Oftalmo, Golden Cross, Unimed Gelson no Daniel Lipp.

## Quais hospitais ainda são usados?
(resposta da Ana Carolina – ver abaixo)

**Resposta da Ana Carolina (22/11/2026):**
- **Ainda usados:** Pro Oftalmo · Barra Day · Day Clinic Méier · Hospital Oftalmológico da Barra · Rio Vision Hospital · Oftalmo Rio · Largo do Machado · Hospital Daniel Lipp. Mais as duas unidades da própria clínica: Consumed Consultórios Médicos e Consumed.
- **Sem resposta (a confirmar):** Clínica e Cirurgia de Olhos Dr. Armando Guedes · Jardim de Alah · UTI Rio · Unimed Regional Fluminense.
