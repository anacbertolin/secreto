# 04 · Plano de migração de dados (Micrologos → novo sistema)

Objetivo: **importar todos os dados** do Micrologos, com rastreabilidade (todo registro novo guarda o ID de origem)
e conferência por totais.

## 1. Como obter os dados (em ordem de preferência)
| # | Fonte | Prós | Contras | Situação |
|---|---|---|---|---|
| 1 | **Dump completo do banco** + dicionário de dados, pedido formalmente à Micrologos | Completo, inclui o que só existe no desktop | Depende do fornecedor e do contrato | ❓ pedir |
| 2 | **Exportações nativas** (relatórios, planilhas, CSV, XML TISS, XML de NFS-e) | Não depende de negociação | Incompleto, trabalhoso | ❓ ver o que existe |
| 3 | **API web** (`backend.micrologos.com.br`, `recurso/access/listar|obter`) com um usuário nosso | Estruturado, mesmos nomes de campos | Só cobre o que a web expõe; limites de uso; precisa de autorização contratual | Possível (ver [02](02-arquitetura-tecnica.md)) |
| 4 | **Arquivos**: laudos em PDF, imagens DICOM (PACS Orthanc), anexos (GED) | Necessário de qualquer forma | Volume grande | ❓ |

> Fundamentos para o pedido: a **LGPD** (portabilidade dos dados do controlador, que é a clínica) e a guarda
> obrigatória do **prontuário por 20 anos** (Lei 13.787/2018). O próprio site da Micrologos diz que faz conversões de
> dados, logo há ferramental.

## 2. Ordem de carga (respeitando dependências)
1. **Estrutura:** empresas → unidades → locais (e categorias) → especialidades → feriados → turnos e taxas → centros de responsabilidade → usuários e perfis (só o mapeamento; senhas não migram).
2. **Tabelas de domínio:** profissões, motivos, tipos de ocorrência, pendência, glosa e multa, naturezas de operação, moedas, CID-10, classificação de guias e atendimentos.
3. **Profissionais:** staff médico (CRM/UF, CBO, conselho), categorias, especialidades, **horários**, **imagens de assinatura**, modelos de laudo e texto.
4. **Convênios:** convênio mestre → planos → **tabelas de preço** → preços por produto (com vigência) → regras de limite e vagas → layouts e configuração TISS (registro ANS, código do prestador na operadora).
5. **Produtos e estoque:** categorias, unidades, marcas → produtos e procedimentos (códigos TUSS/Brasíndice) → kits → saldo por local e lote (**saldo inicial na data de corte**, não o histórico de movimentos, a decidir ❓).
6. **Financeiro base:** emitentes (clientes e fornecedores) → plano financeiro → projetos → portadores (com saldo na data de corte).
7. **Pacientes:** cadastro → portadores/carteirinhas → ocorrências e avisos → consentimentos LGPD e aprovações de imagem → documentos, fotos e imagens.
8. **Agenda:** histórico de agendamentos (com status) → **agendamentos futuros** (críticos no dia da virada) → fila de espera → retornos pendentes → pacotes de sessão e saldos.
9. **PEP:** atendimentos → detalhes, fichas de dados e textos → CIDs → prescrições → solicitações → anexos → **assinaturas digitais** (manter o PDF assinado original e os metadados de verificação) → histórico e auditoria.
10. **Laudos e imagens:** laudos (texto e PDF assinado) ↔ exames da agenda; imagens DICOM do PACS; status de liberação ao paciente.
11. **Faturamento:** contas de paciente e itens → guias TISS/SUS (número da guia no prestador e na operadora, senha de autorização) → cobranças, lotes e protocolos → pagamentos e glosas → **contas em aberto** (críticas).
12. **Repasse:** histórico de repasse calculado e pago, **repasses pendentes** na data de corte.
13. **Financeiro movimentos:** títulos a pagar e a receber (abertos = críticos; pagos = histórico), parcelas, rateios, notas fiscais (XML), recorrências.
14. **Comunicação (opcional):** histórico de envios, leads, campanhas, templates de mensagem.
15. **Orçamentos** de pacientes.

## 3. Regras gerais
- **Rastreabilidade:** cada tabela nova recebe `legacy_source = 'micrologos'` e `legacy_id` (o `ID_*` original). As cargas devem ser **idempotentes** (reexecutáveis).
- **Área de staging:** carregar os dados brutos como vieram (schema `legacy_micrologos`), transformar depois. Nunca transformar direto da fonte.
- **Datas de corte:** definir o D-0 da virada. Antes dele, migrar como histórico (somente leitura). Pendências abertas no D-0 são migradas como operação viva.
- **Deduplicação de pacientes** por CPF, CNS e nome + data de nascimento. Registrar as fusões.
- **Normalizações:** CPF/CNPJ (só dígitos e validação), telefones (E.164), CEP, e-mails, codificação de texto (o legado pode ter Latin-1 ou Windows-1252).
- **Valores monetários** em decimal, nunca float. Conferir arredondamentos de guias e repasse.
- **Arquivos** por hash (SHA-256) para deduplicar e verificar integridade.

## 4. Validações de conferência (por carga)
| Domínio | Conferência |
|---|---|
| Pacientes | Contagem total, por unidade, com CPF, sem CPF |
| Agenda | Contagem por status × mês; agendamentos futuros 1 a 1 |
| PEP | Atendimentos por médico × ano; anexos e assinaturas (hash) |
| Laudos e imagens | Quantidade de laudos e estudos DICOM; amostragem visual |
| Faturamento | Valor total por convênio × competência; contas abertas 1 a 1; glosas totais |
| Repasse | Total por médico × período; pendências 1 a 1 |
| Financeiro | Saldo por portador no D-0; títulos abertos 1 a 1; DRE do último exercício bate |
| Estoque | Saldo por produto × local × lote no D-0 |

## 5. Checklist
- [ ] Pedido formal de exportação completa e dicionário de dados à Micrologos
- [ ] Confirmar o banco de dados usado (SQL Server? Firebird? MySQL?) e o formato do dump
- [ ] Levantar o volume: pacientes, atendimentos, laudos, GB de imagens e anexos
- [ ] Inventário das telas e módulos usados de fato (web e desktop)
- [ ] Inventário de integrações ativas e plano de troca (Paylogos, WhatsApp, NFS-e, PACS, Orizon…)
- [ ] Definir o D-0 e a estratégia de congelamento (janela sem operação ou dupla digitação)
- [ ] Ensaio de migração completo em homologação, com relatório de conferência
- [ ] Plano para links já enviados a pacientes (portal de laudos, links de pagamento)
- [ ] Encerramento contratual: acesso de leitura ao legado por um período após a virada
