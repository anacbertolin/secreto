# 00 – Resumo do mapeamento do Micrologos (ML Clinic Master ASP)

**Data:** 22/11/2026 · **Versão do sistema:** 13.13.30.00 · **Computador:** DESKTOP-MCDT7V5 · **Usuário:** AnaCarolina (MASTER)
**Modo:** somente leitura. Usei apenas os pacientes de teste ("Teste" código 69489 e "Teste Micrologos" 108477). Nenhum nome, CPF ou telefone de paciente foi anotado.

## Arquivos desta pasta
| Arquivo | Conteúdo |
|---|---|
| A-convenios.md | 32 convênios ativos + 4 inativos: planos, ANS, código do prestador, versão TISS, regras |
| B-tabelas-e-procedimentos.md | 193 procedimentos (TUSS/AMB/CBHPM), 66 tabelas de preço, qual plano usa cada tabela, kits/pacotes |
| B2-precos-por-tabela.md | Valores de todas as tabelas de preço |
| C-faturamento.md | Conta do paciente, guias, lotes (cobranças), glosas, pendências, repasse |
| D-xml-tiss.md | Onde ficam os XML, padrão do nome, versões |
| E-prontuario-pep.md | 12 fichas oftalmológicas com todos os campos, 56 modelos de texto, medicamentos |
| F-agenda-recepcao.md | Agenda, status, regras de marcação, horários |
| G-cadastros-de-apoio.md | Menus completos, unidades, médicos (CRM/CBO/TISS), especialidades, locais, motivos, cadastro de paciente |
| H-exportacao.md | Exportações e relatórios disponíveis |

## Principais descobertas
1. **Empresa no sistema = "Consumed Consultórios Médicos Ltda"** (CNPJ 05.894.660/0001-87, CNES 3176479). Não existe unidade "Hospital de Olhos da Baixada". Há outras 13 unidades (hospitais/centros cirúrgicos parceiros).
2. **TISS:** versão 4.01.00 na maioria; 4.03.00 (Bradesco); 4.02.00 (Cedae, Klini); 3.02.01 (particulares Appai/Assist). A configuração muda de convênio para convênio (formato de data, UTF-8 × ISO-8859-1, dígitos do lote, máx. 10 procedimentos por guia, consulta dentro da SP/SADT na Amil etc.).
3. **Tipos de guia usados:** Consulta (classif. "Consulta"), SP/SADT (exames e medicamentos), Honorário individual (cirurgia). Sem guias de internação em uso.
4. **Unimed faturada por médico:** cada médico cooperado é um "convênio" separado, com o próprio código; além da "Unimed Consumed Cirurgia" (PJ).
5. **Lotes ("Cobranças"):** um processo por convênio/período; o sistema desconta **15% de impostos** automaticamente; ao gerar o XML exige "Termo de concordância" e registra uma ocorrência.
6. **XML ficam em `C:\<nome do convênio>\`** neste computador (ex.: C:\Amil, C:\Bradesco, C:\Geap, C:\Klini, C:\Porto Seguro, C:\Unimed Gelson…). Nome: `<ANS><AAAAMM><lote>_<hash>.XML`.
7. **Envio às operadoras é manual** (portais). Nenhum web service/Orizon configurado.
8. **Protocolo, recebimento e glosa quase não são registrados no Micrologos** (só 1 lote de 2017). O controle deve estar fora do sistema.
9. **Prazos de envio/pagamento, prazo de retorno e limites por convênio estão vazios** no cadastro. A exigência de autorização fica marcada **por procedimento em cada tabela de preço** ("Necessita Autoriz.").
10. **Repasse:** regras percentuais — médico 70% (geral), consulta 60%, campo visual 40%, e exceções por médico/plano.
11. **PEP oftalmológico rico:** fichas com AV, refração (esf/cil/eixo, adição, DP), PIO com gráfico, biomicroscopia/fundo de olho com desenho, mapeamento, OCT, campo visual, gonioscopia, paquimetria, ficha pré-operatória de catarata, retina, lente de contato, ortóptica. Receitas/atestados/laudos por modelos de texto com variáveis (nome, data, CRM, RQE).
12. **Agenda:** intervalos de 10 min (médicos) / 15 min (centro cirúrgico); status Espera, Atendido, Desistiu, Faltou, Cancelado (paciente/médico), confirmações por e-mail/WhatsApp; regras de encaixe, 1ª vez, revisão e retorno no cadastro de cada médico.
13. **Exportação:** não há "exportar para Excel" nas telas; existem Relatórios ▸ Planilhas, XML TISS e relatórios diversos. Para migração completa, pedir **exportação do banco de dados** à Micrologos.

## O que NÃO deu para ver (por segurança)
- **Tela da guia TISS** (botão "TISS" da conta): pode gerar/registrar nº de guia.
- **PEP por dentro** (atendimento aberto, histórico, impressão de receita): "Abrir Atendimento" cria um atendimento.
- Tela de **Solicitação de exames**, **Cirurgia** e **Totem**: podem criar registros.
- Telas de geração de XML, entrega, fechamento, recebimento de protocolo, recurso de glosa: alteram dados.
- Relatórios e "Listar": não executados.
- Detalhe de cada plano (só o da Amil) e lista completa de alguns cadastros (planos da Assim/Hapvida/Mediservice/Porto, 56 textos, 52 medicamentos, especialidades).

## Ocorrência durante o mapeamento
Na Agenda, um clique abriu sem querer o formulário de **inclusão de agendamento**; fechei a busca de paciente sem selecionar ninguém e cliquei em **Cancela** — nada foi gravado. Também mudei por engano o **filtro de exibição "Status"** da tela da agenda (não altera dados; volta ao normal ao reabrir).

## Respostas recebidas (22/11/2026)
- **XML:** confirmado. São gerados no Micrologos e gravados direto nas pastas `C:\<convênio>\` deste computador.
- **Convênios que não são mais atendidos:** Appai, Assist, Assim e Golden Cross. Os demais foram confirmados como ativos.
- **Conferência no Micrologos (lotes de 01/06 a 22/11/2026, 614 processos):** tiveram cobrança Amil · Assist (último lote em 01/09/2026) · Bradesco Saúde / Bradesco Operadora · Fundação Saúde Itaú · Geap · Hapvida NotreDame/Intermédica · Klini · Mediservice · Porto Seguro · Portomed · Saúde Caixa · Select · Unimed Consumed (cirurgia) · Unimed Gelson · Unimed Gisele · Unimed Luciano · Unimed Max.
  **Respostas da Ana Carolina:**
  - **Blue:** atendido e faturado por XML, mas sem pacientes recentemente.
  - **Cedae, Cisbaf e Siass-Geap:** atendidos, mas **sem faturamento no Micrologos**. O paciente só é registrado no prontuário e a funcionária digita direto no sistema do plano.
  - **Notre Dame:** não é mais atendido (virou Hapvida).
  - **Unimed Dr. Antonio:** é médico de fora que **opera na clínica**. O cadastro existe para faturar as cirurgias dele.
  - **Unimed Dr. Pedro:** não atende pela Unimed.
  - **Bradesco Saúde** e **Bradesco Saúde Operadora de Planos:** é o mesmo Bradesco, mas com **XML separados** (registros ANS 5711 e 421715).
  - **Prioridade máxima:** o **TISS de cirurgias e de injeções intravítreas** precisa ficar perfeito no sistema novo, sem nenhuma alteração, para não gerar glosas.
  - **Fator 2,00** (ambos os olhos; facectomia Bradesco) está correto: a regra é **por contrato de cada convênio**.
  - **Injeções** são cobradas só na Unimed. Amil, Bradesco, Geap e Hapvida estão em credenciamento.
  - **Bradesco, Mediservice e Klini** exigem o lote em **.zip** no portal.
  **Sem nenhum lote no período:** Blue · Cedae Periódico · Cisbaf · Notre Dame (separado) · Siass-Geap · Unimed Antonio · Unimed Pedro (Particular e Livre Escolha não geram lote). A confirmar se ainda são atendidos ou se são cobrados por fora.
- **Depois do envio do XML**, o controle de protocolo, pagamento, glosa e fechamento **não é feito no Micrologos**, porque essa parte é confusa e nunca foi usada. ➜ **Requisito para o sistema novo:** um módulo simples de acompanhamento pós-envio (lote enviado → protocolo → demonstrativo → pago / glosado → recurso), que hoje não existe na prática.

## Perguntas em aberto
1. O CNPJ/empresa "Consumed Consultórios Médicos" é o do Hospital de Olhos da Baixada? As outras 13 unidades ainda são usadas?
2. Onde vocês controlam **protocolos, pagamentos, demonstrativos e glosas** hoje (planilha? portal?)
3. Por qual **portal/canal** cada operadora recebe os XML (portal próprio, Orizon, outro)?
4. **Prazos** de envio e de pagamento e **prazo de retorno** de cada convênio: existe uma lista fora do sistema?
5. A **Assim** ainda é atendida? As 3 tabelas de preço dela não estão ligadas a nenhum plano.
6. Quais **fichas do PEP** os médicos usam hoje (Oftalmo III, Consulta, Catarata, Retina…)?
7. Os 15% descontados nos lotes são todos impostos? Variam por convênio?
8. Confirmar os percentuais de repasse que aparecem cortados (provavelmente 100%) e se há outras regras fora do sistema.
9. Posso (ou você prefere) clicar em **"TISS"** na conta do paciente de teste e em **"Abrir Atendimento"** do paciente de teste, para completar o mapeamento da guia e do PEP? Isso cria registros de teste.
10. Valores da tabela Particular que aparecem cortados (≥ R$ 10 mil?): Blefaroplastia Sup+Ptose, Ciclofotocoagulação Transescleral, Faco/goniotomia, Faco/TREC, Implante de Dreno Susanna, TREC/VVPP.
11. Quem pode pedir à Micrologos a **exportação do banco de dados** para a migração?
