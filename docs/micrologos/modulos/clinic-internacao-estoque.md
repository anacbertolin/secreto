# Clinic · Centro cirúrgico, internação e estoque

## Centro cirúrgico e internação (maior parte só no desktop)
- Agenda de **cirurgia**, tela de **Centro Cirúrgico**, **equipes médicas**, anestesia. ✅
- **Status dos locais** (leitos e salas), enfermaria, tipos de acomodação, unidades de internação (`guiasTiss/unidadesInternacao`). ✅
- **Solicitações** (menu "Atendimentos → Solicitações") ✅:
  - Requisição e devolução de material de **internados**
  - **Prescrição médica** de internados
  - Procedimentos realizados em internados
  - Requisição e devolução **ambulatório**
  - Prescrição médica ambulatório
  - Requisição e devolução por **consumo de setor**
  - Requisições encerradas
- Relatórios: **Censo diário**, estatística por tipo de acomodação, requisições por paciente e por setor, produtos por prescrição. ✅

## Estoque e suprimentos
Recursos: `produtos`, `produtosCategoria`, `produtosUnidade`, `marcas`, `produtosEstoqueLocais`, `tiposDeEstoque`, `tiposMovimento`, `unidadesMedida`.
- Produtos com categoria (hierárquica), unidade, marca e preço. ✅
- **Lotes e validade**: alerta de lote vencido, opção "incluir lotes vencidos". ✅
- **Multiestoque** por local (`ID_PRODUTO_ESTOQUE_LOCAL`), tipos de estoque e de movimento (`ID_PRODUTO_MOVIMENTACAO`). ✅
- **Kits** de procedimento, com checagem de vínculo circular. ✅
- Dispensação, **devolução** (lançada com quantidade negativa), consumo por setor. ✅
- **Contagem** de inventário. ✅ (site)
- **Solicitação de compra → cotação de preço → pedido de compra → NF de entrada** (Cash). ✅ (site)
- Gasto de mat/med na conta do paciente. ✅

## Só no desktop
Itens de menu sem tela web no bundle 1.26.12 (o uso real precisa ser confirmado):

- **Atendimento:** Cirurgia, Centro Cirúrgico, Ocupação, Fila do Totem, Inform. Médicas Pendentes, Laudo Web, Atendimento (tela clássica).
- **Solicitações:** o bloco inteiro de requisição e prescrição.
- **Faturamento:** Faturamento (tela principal), Pendências, Lançamentos extras para repasse, Justificativas de glosas técnicas, Acompanhamento, DMED, CIHA.
- **Tabelas:** Protocolos de tratamento, Sessões (aparelhos, lados, regiões), Status dos locais, Equipes médicas, IBGE, Representantes, CID-10, Modelos de texto do PEP, Fichas de dados (campos, limites, arquétipos), Configuração de faturamento automático, Layouts de convênios, Donos de equipamentos, Tipos de comissão, Tempo de duração do atendimento, Brasíndice, Formas e intervalos de aplicação, Títulos e frases de laudo, Empresas, Portadores, CEP, Acompanhantes, Facilitadores.
- **Utilitários:** Mensagens Linha Master, Captura automática de imagem, Aviso de entrada de paciente, Log de usuários (simples e avançado), Ponto eletrônico.
- **Relatórios:** quase todos os do Clinic.
- **Módulo Quality:** inteiro.
