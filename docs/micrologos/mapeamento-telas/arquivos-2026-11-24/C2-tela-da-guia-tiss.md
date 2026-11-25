# C2) Tela da guia TISS no Micrologos (vista com a Ana Carolina em 22/11/2026)

**Como abrir:** Conta ▸ buscar o paciente ▸ selecionar a conta ▸ botão **TISS** (lado esquerdo).
**Exemplo usado:** paciente de teste "Teste" (cód. 69489), conta 270743, Klini Saúde, Consulta em Consultório.
A guia estava **"TISS Conferido"**, por isso aparece o aviso *"Alteração possível somente após des-conferir as informações sobre a TISS"*: a guia conferida fica **travada**. Nada foi alterado.

## Janela "Informações TISS da Conta NNNN – Ambulatório"
Topo: **Tipo da Guia** (ex.: SP/SADT – travado depois de conferido) · Nome do beneficiário · botão **2º Plano**.
Rodapé: **Ok** · Refaz · **PDF** · **Imprime Guia** · **Des-Confere TISS** (mostra quem conferiu e quando) · status "Atualizado" · **Cancela**.

### Aba 1 – Bloco Padrão
- **Nº Guia** (prestador) · **Nº Guia Operadora** · **Nº Guia Principal** · **Dt. Autoriz.** · **Senha** · **Validade** (da senha).
- Dados do Beneficiário: **Emissão** · **Nº carteira** (com máscara do plano) · **Plano** · **Valid. carteira**.
- Dados do Atendimento: **Indicação do Acidente** (lista) · **Nº Guia OPME** · **Tipo de doença** (Aguda / Crônica / Nenhuma) · **Tempo da doença** (nº + Dias / Meses / Anos / Nenhum).
- **Observação** (até 1000 caracteres, com contador).

### Aba 2 – Solicitação
- Contratado Solicitante: Código por **C.Oper. / CNPJ / CPF** (ex.: CNPJ 05.894.660/0001-87) · Nome do contratado (Consumed Consultórios Médicos Ltda) · **Código CNES** (3176479) · **Nº Guia Solicitação (SADT ou Res.)**.
- Profissional Solicitante: nome (busca em Médico ou Contato externo) · **Conselho Profissional** (Conselho Regional de Medicina) · **Nº Conselho** (CRM) · **UF** · **Código CBO** (225265) · **Data/Hora da Solicitação**.
- **CID-10** (código + descrição).
- **Caráter da Solicitação:** Eletiva / (Urgência).

### Aba 3 – Executante
- Contratado Executante: Código por **C.Oper. / CNPJ / CPF** · **Reg. ANS** do plano (ex.: 422029 Klini) · **C. Oper.** (código na operadora) · Nome do contratado · endereço completo (tipo de logradouro, logradouro, nº, complemento, município, UF, **Cód. IBGE**, CEP) · **Código CNES**.
- Profissional Executante: código por C.Oper./CNPJ/**CPF** · "Somente esse médico sairá na guia como executante" · nome · CPF · **Conselho** · **Nº no conselho** · **UF** · **Código CBO** (2252.65) · **Grau de Participação** (ex.: 12 – Clínico).

### Aba 4 – Atendimento (Dados do Atendimento SP/SADT)
- **Tipo Atendimento** (ex.: 23 – Exames) · **Motivo Saída** (ex.: 12 – Alta melhorado) · **Regime de Atendimento** · **Saúde Ocupacional** · **Cobertura Especial** · **Ausência Cód. Validação** · **Tipo Consulta** (ex.: 1 – Primeira consulta) · **Tipo Saída** (ex.: 5 – Alta).
  Todas são listas com os códigos das tabelas de domínio da ANS.

### Aba 5 – Procedimentos
- Grade: ✓ (sai na guia) · **Médico** · **AMB/Cd.Espec** (código enviado, ex.: 98901012) · **Procedimento** · **Valor Total** · **Qtd**.
- Para cada item: **Procedimento Principal** · **Técnica Utilizada** (Convencional…) · **Tipo Cirurgia / Via de Acesso** (Única…) · **Cód. TISS (só se for diferente)** · **Procedim. Emergência** · **Grau de Participação** · **Sem guia** / **Guia de Honorário** (nº).

## Observações para o sistema novo
1. **Guia conferida = travada:** só altera depois de "Des-Conferir", que registra quem conferiu e quando. Vale manter esse controle (trilha de auditoria).
2. Os dados vêm **pré-preenchidos** da conta, do cadastro do convênio, do médico e da unidade. A pessoa só completa senha, autorização, carteira e CID.
3. Na guia de teste, o código enviado é **98901012** (código próprio da tabela de pacote da Klini), e não o TUSS 10101012. Os códigos podem mudar por tabela/convênio.
4. Botões **PDF** e **Imprime Guia** geram a guia em papel no modelo ANS.
