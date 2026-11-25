# Convênios copiados do Micrologos (um por dia)

**Fluxo:**
1. A dona cola o texto padrão no Claude do computador da clínica (só leitura, sem dados de pacientes).
2. Ele gera `Convenio-<Nome>-<data>.md` e a dona manda o arquivo à sessão "Dados para migração".
3. Essa sessão cria uma migração `015x_convenio_<nome>.sql` que cadastra no banco:
   - o convênio (com as regras TISS em `convenios.tiss` e os descontos em `convenios.descontos`);
   - os planos (máscara da carteirinha);
   - os procedimentos (código interno do Micrologos, tabela '00');
   - os preços por plano (`precos`, com `codigo_guia`, `tabela_guia`, `necessita_autorizacao` e `tabela_preco`);
   - os códigos dos hospitais no convênio (`hospital_convenio_codigos`);
   - os códigos dos médicos (`profissional_convenio_codigos`).

A estrutura é da migração `0150_tiss_cadastro_convenios`.

| Ordem | Convênio (cód. Micrologos) | Arquivo | Migração | Situação |
|---|---|---|---|---|
| 1 | Bradesco Saúde (2) | Convenio-BradescoSaude-2026-11-24.md | 0151 | ✅ cadastrado em 25/11/2026 |
| 2 | Bradesco Saúde Operadora (23) | — | — | próximo |
| 3 | Unimed Consumed Cirurgia (26) | — | — | depois dos moldes TISS 4.01 |
| 4 | Amil (28) | — | — | |

## Pendências do Bradesco Saúde (perguntar à dona / conferir com XML real)
- **Epilação de Cílios (54) no plano Bradesco Empresa:** aparece em duas tabelas: 31 Bradesco Cirurgia = 55,39 e 4 Bradesco Empresa = 54,57. Ficou 55,39 (a 1ª tabela da grade do plano). Qual vale?
- **Colírios (90xxxxxx):** cadastrados para sair como medicamento (tabela TISS 20). Conferir com um XML real.
- **CNPJ da clínica na aba Complementares:** aparece com 13 dígitos (0589466000187). No sistema novo usamos o correto, 05894660000187.
- **Máscara da carteirinha:** 15 dígitos, contados num print pequeno. Conferir.
- **Médicos:** nenhum tem código no Bradesco. A guia sai pelo código da clínica (0000110502) e pelo CRM do médico, como nos XML reais.
