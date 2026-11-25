# J) Códigos de cada médico em cada convênio (Staff Médico ▸ Detalhamento ▸ Inf. TISS)

**Visto em:** 22/11/2026. Só olhando, nada alterado.
**Onde fica no Micrologos:** Cadastros ▸ Staff Médico ▸ Detalhamento ▸ sub-aba **Inf. TISS**.
**Privacidade:** não copiei CPF, RG, endereço nem telefone. Em alguns cadastros, o campo "código na operadora" está preenchido com o **CPF** do profissional. Esses campos aparecem aqui como **[CPF – omitido]**.

## Como o Micrologos guarda isso
- **Bloco "Layout TISS" (um por profissional):**
  - Código CNES (quase todos usam 9999999, o genérico);
  - Conselho Profissional;
  - Nº no Conselho (sem prefixo e sem DV);
  - UF do Conselho;
  - Cód. na Operadora (geral);
  - Cód. UF (IBGE);
  - caixa "Ñ faz parte da guia de honorários".
- **Tabela por convênio**, com as colunas:
  - Convênio, Plano e Unidade (hospital);
  - Cód. Operadora e Nome do Profissional **Executante**;
  - Cód. Operadora e Nome do Profissional **Solicitante**.
  - ➜ Um mesmo médico pode ter **códigos diferentes por convênio, por plano e por unidade (hospital)**.
- **CBO:** não aparece nessas telas. Vem da **especialidade** do médico (Staff ▸ Relações ▸ Especialidades: "Oftalmo Geral", "Oftalmo Retina e Vítreo"…). Nos XML reais, o CBO é sempre **225265** (médico oftalmologista).
- **Nº no Conselho no cadastro × no XML:** no cadastro do médico, o "CRM" aparece com o prefixo 52 (código do RJ). Ex.: 52863602. No bloco TISS, vai sem prefixo (863602). Isso combina com a regra "Usa campo C.R.M. do médico (completo)" vista no arquivo I.

## Profissionais ativos (20 no cadastro)

### Médicos (conselho CRM-RJ)
| Cód | Médico | Nº Conselho (TISS) | UF | CNES no cadastro | Convênio → código Executante / Solicitante |
|---|---|---|---|---|---|
| 1 | Gelson Moura Brasil | 863602 | RJ | 9999999 | Assim: 30725 / 30725 · Geap: (sem código, só nome) · Hapvida: (sem código) · Klini: (sem código) · **Unimed Consumed Cirurgia** (unid. Consumed): 863602 / 863602 · **Unimed Gelson**: 863602 |
| 3 | Gisele Moura Brasil | 873799 | RJ | 9999999 | Assim (unid. Consumed Consultórios, Barra Day e UTI Rio): 30724 (solic. 30724 na Consumed) · Geap: 17101182 (= código da clínica) · Hapvida: (sem código) · **Unimed Consumed Cirurgia** (Consumed): 873799 / 873799 · **Unimed Gisele**: 873799 |
| 2 | Max Oliveira Guimarães | 863866 | RJ | **3176479** | Geap: (sem código) · Hapvida: (sem código) · **Unimed Max** (unidades Clínica e Cirurgia de Olhos Dr…, Consumed, Barra Day): 410374 |
| 4 | Luiza Morone Pereira | 917753 | RJ | 9999999 | Assim: 36987 / 36987 · Geap: 17101182 · Hapvida: (sem código) |
| 5 | Marcos Aurelio Costa Leal Arnaut | 937118 | RJ | (vazio) | Assim: 36988 / 36988 · Geap: (sem código) · Hapvida: [CPF – omitido], com nome "Prestador Nao Identificado Migracao" ⚠️ |
| 19 | Pedro Boni Goncalves | 866989 | RJ | 9999999 | Assim: 45538 / 45538 · Amil, Assist, Bradesco Saúde, Bradesco Operadora, Fundação Itaú, Geap, Hapvida, Klini, Mediservice (unid. Consumed Consultórios), Notre Dame, Porto Seguro, Siass-Geap, Unimed Consumed Cirurgia (Consumed): **sem código**, só o nome |
| 22 | Matheus de Souza Cerveira Pereira | 5201277375 ⚠️ (parece incluir o prefixo 52) | RJ | **3176479** | Assim: 51467 / 51467 · Geap: 17101182 · Amil, Assist, Bradesco Saúde, Bradesco Operadora, Fundação Itaú, Hapvida, Klini, Mediservice, Notre Dame, Porto Seguro: sem código, só o nome |
| 15 | Renato Sztern Queiroz | 927430 | RJ | 9999999 | Assim (Consumed Consultórios e Barra Day): 43099 / 43099 · Amil, Assist, Bradesco Saúde, Bradesco Operadora, Fundação Itaú, Geap, Hapvida, Klini, Notre Dame, Porto Seguro: sem código, só o nome |
| 27 | Annamaria Ciminelli Barbosa | 947300 | RJ | 9999999 | nenhum convênio cadastrado |
| 24 | Antonio Carlos de Souza Ferreira (cirurgião externo) | 788066 | RJ | 9999999 | **Unimed Antonio** (unid. Consumed): 788066 / 788066 · **Unimed Consumed Cirurgia** (Consumed): 788066 / 788066 |
| 9 | Fernanda | – | – | – | sem dados TISS |
| 25 | Medico Transcrição Rio de Janeiro | 41231 | RJ | – | sem convênios (cadastro de apoio) |
| 26 | Prestador Nao Identificado Migracao | 99880 | RJ | – | sem convênios (cadastro da migração antiga) |

### Outros profissionais
| Cód | Profissional | Conselho | Convênios |
|---|---|---|---|
| 8 | Luciano Campino Pinto – **Instrumentador** | **COREN-RJ** 192354 (Conselho Regional de Enfermagem) | Assim (Largo do Machado e Barra Day) e Geap: código = [CPF – omitido] · **Unimed Luciano** (unid. Clínica e Cirurgia de Olhos Dr…, Consumed, Barra Day): **941222** |
| 6 | Eveline – Campo Visual | CRM nº "123" (provisório?) | nenhum |
| 12 | Centro Cirurgico (cadastro de apoio) | – | Unimed Gelson (Consumed): executante **1474** "Consumed Olhos"; solicitante 863602 (Gelson) |
| 23, 31, 28, 20 | Consumed Olhos, Contatólogo, Orientação Cirúrgica, Ortóptica (cadastros de apoio/agenda) | – | nenhum |

## O que isso significa para o sistema novo
1. **Tabela "profissional × convênio × plano × unidade(hospital) → código executante / código solicitante".** O mesmo médico tem códigos diferentes por hospital em alguns convênios (Assim, Unimed Max, Unimed Luciano).
2. Quando não há código, o Micrologos usa o que está configurado no convênio. Pela regra "Usa Executante e Solicitante pelo cadastro de códigos", quase sempre vale o **código da clínica** (ex.: Bradesco 0000110502, Amil 10453164) mais o **CRM do médico**.
3. Nas **Unimed**, o código de cooperado do médico é obrigatório: Gelson 863602, Gisele 873799, Max 410374, Antonio 788066. Luciano (instrumentador) usa 941222.
4. O **instrumentador** (COREN) também entra nas guias da Unimed Luciano. O sistema novo precisa aceitar profissionais de **outros conselhos**, não só CRM.

## Pontos para conferir com a clínica
- **Matheus:** o Nº no Conselho está como 5201277375. Parece ter o prefixo 52 junto. Confirmar o CRM correto.
- **Marcos, na Hapvida:** o código está preenchido com o CPF e com o nome "Prestador Nao Identificado Migracao". Parece um resto da migração antiga.
- **Luciano, na Assim e na Geap:** o código está preenchido com o CPF. Confirmar se é exigência da operadora.
- **Max e Matheus** estão com o CNES da clínica (3176479); os demais usam 9999999.
