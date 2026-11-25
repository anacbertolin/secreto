# H) Exportação — o que o Micrologos permite tirar

**Status:** verificado nas telas visitadas. **Nenhuma exportação foi executada** (para não gerar arquivos nem relatórios).

## 1. Botões de exportação encontrados
| Área | O que existe | Formato | Onde |
|---|---|---|---|
| Faturamento (lotes) | **Geração do XML TISS** | XML (TISS 3.02.01 a 4.03.00) | Cobranças de Convênios ▸ botão TISS → grava em `C:\<convênio>\` |
| Relatórios | **Relatórios ▸ Planilhas** ▸ Por Planos de Saúde e Prod./Serv. · Por Convênio e Categ. Prod./Serv. → (Faturamento / Movimentação Financeira do Estoque / Faturamento + Mov. Financ. Estoque) | Planilha (provavelmente Excel) | Menu Relatórios |
| Repasse | **Exporta Comissão dos Médicos** | (Interface Web) | Ferramentas ▸ Manutenção do Sistema ▸ Interfaces Web |
| Faturamento | **Importa Excel Padrão Faturamento** (importação, não exportação) | Excel | Ferramentas ▸ Manutenção ▸ Interfaces Diversas |
| Cobrança | Recebe Arquivo Magnético ▸ Pgto de Cobranças (importa demonstrativo) · Outras Opções ▸ Arquivo Magnético ▸ | arquivo | Cobranças ▸ Opções |
| Todas as telas de cadastro | Botão **Listar** (relatório/impressão) | Relatório — não testado se a pré-visualização permite salvar em PDF/Excel | Barra lateral |
| Gestor Eletrônico de Documentos (GED) | Visualiza / Captura | imagens/documentos | Opções de Convênios, Contas e Cobranças |
| Backup | Ferramentas ▸ Backup | banco de dados | Menu Ferramentas |
| BI | botão "BI" na barra secundária | (não aberto) | Barra superior |

**Não encontrei botão "Exportar para Excel/CSV"** dentro das telas de Convênios, Procedimentos, Tabelas de Preço, Contas, Cobranças, Staff, Locais, Textos, Fichas ou Agenda.

## 2. Relatórios disponíveis (menu Relatórios) – úteis para extrair dados
- **Agenda:** Agendamentos por Planos de Saúde · Agendamentos WEB · Agenda por Médico · Agenda por Local · Pacotes de Consulta · Faltas por Paciente · Pacientes por Etapas de Preparação · Estatística de Pacientes · Estatística Motivos · Desistências por Médico · Agendamentos × Confirmação · Configurado da Agenda · Sessões ▸.
- **Atendimentos:** Cruzamento de Dados do Atendimento (com/sem palavra-chave) · Estatística de CIDs · Atendimentos por Médico · Solicitações de Exame por Médico · Medicamentos Prescritos por Médico · Total de Horas por Médico · Laudo por Status · Laudos não Realizados · Configurado de Atendimento Genérico/Específico · Queixas de Paciente por Médico · Atendimentos por campo de Ficha de dados.
- **Solicitações:** Requisições por Paciente · Requisições de Setor · Produtos por Prescrição.
- **Faturamento:** Atendimentos por Médico (Ambulatorial/Internação) · Faturamento/Mov. Estoque por Médico (Realizado, +Indicação, +Vinculação…) · Paciente por Convênios/Planos · De Procedimento/Serviço (Totais por procedimento, por categoria, detalhado, por quantidade, por unidade/médico/convênio, por contato externo, por médico que indicou, por especialidade, franquias, por grupo de CID) · De Produto · Contas de Pacientes (por procedimento/produto, por plano, por procedimento principal, em cobrança, guias emitidas por usuário, pendências) · Movimento do Caixa (Ambulatório/Internação) · Pagamentos de Particular · Produção Mensal SUS · Configurados.
- **Cobrança:** Valores Resumidos por Plano · Cobranças Entregues · Totais por Categoria · Recebimentos de Protocolos · Relação de Glosas Internas · Relação de Glosas Externas.
- **Administrativos:** **Repasse Staff Médico** · Pacientes (1ª vez, revisões, assiduidade, créditos, acompanhantes) · Atendimento (produtividade, remuneração por atendimento, laudos por médico, médicos por unidade de tempo, estatísticas, mapas de ocupação e horários) · Faturamento (comissão por laboratório, % exames × consultas, faturado × recebido por médico, custos × gastos por pacote, quantidade de pacientes faturados) · Preços (por produto/serviço, por plano, margem de lucro por tabela) · Configurados · Ponto eletrônico · Estatísticas da pesquisa Web · Confirmações WhatsApp · Imagens Nuvem Micrologos.
- **Auditoria:** Consistências · Conferências · Cadastros · Inativados.
- **Planilhas:** ver acima.

## 3. Recomendação para a migração
Para levar os dados ao sistema novo, o caminho mais completo **não** é pelas telas: é pedir à Micrologos (ou ao TI) uma **exportação do banco de dados** (ou backup) com dicionário de dados — cadastros, tabelas de preço, contas, guias, agendas e prontuários. Os relatórios/planilhas servem para conferência.
