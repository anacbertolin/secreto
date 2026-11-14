# Micrologos — levantamento do sistema atual (a ser substituído)

> Levantamento feito em 14/11/2026 a partir de fontes públicas: site institucional
> (micrologos.com.br), o front-end web público do **Clinic by Micrologos**
> (clinic.micrologos.com.br — rotas, menus, chamadas de API e textos da interface
> extraídos do bundle JavaScript), páginas indexadas da wiki/blog da empresa e
> cadastros públicos (Crunchbase, Tracxn, Facebook).
> **Não houve acesso autenticado.** Regras de negócio internas, layouts de relatórios
> e o banco de dados ainda precisam ser confirmados com quem usa o sistema no dia a dia.

Anexos (inventários brutos):
- [`anexos/menus.md`](anexos/menus.md): árvore completa de menus dos 5 módulos, com códigos de permissão
- [`anexos/rotas-web.tsv`](anexos/rotas-web.tsv): 218 rotas (telas) da aplicação web
- [`anexos/endpoints-api.txt`](anexos/endpoints-api.txt): 787 operações de API chamadas pelo front-end (`recurso/access/acao`)
- [`anexos/textos-interface.txt`](anexos/textos-interface.txt): cerca de 2.950 textos da interface (útil para entender regras e mensagens)

---

## 1. A empresa

| | |
|---|---|
| Razão social | Micrologos Máquinas e Serviços Ltda. (marca "Micrologos Software Developer"); o executável desktop também aparece como "AC Valle Informática" |
| Sede | Rio de Janeiro/RJ |
| Fundação | 1983 (o site fala em "43 anos de experiência") |
| Porte | Pequeno (de 2 a 10 pessoas segundo LinkedIn e Tracxn) |
| Foco | Software de gestão para saúde: clínicas, hospitais-dia, consultórios, laboratórios. Forte presença em **oftalmologia** (clientes citados: D'Olhos Hospital Dia e Vista Medicina dos Olhos) |
| Marca white-label | **Clinic Spirit** (clinicspirit.com), o mesmo código com outro domínio |

## 2. Família de produtos

| Produto | O que é | Módulo / código de permissão |
|---|---|---|
| **Clinic by Micrologos** (antigo *Clinic Master Advanced / SP*) | ERP clínico-hospitalar: agenda, PEP, laudos, faturamento convênio/SUS/particular, repasse, estoque | `menuClinic` / `CLM*` |
| **Cash** | ERP financeiro: fluxo de caixa, pagar/receber, conta corrente, NF de entrada e saída, DRE | `menuCash` / `CSM*` |
| **Talklogos / Bot** | Omnichannel: WhatsApp (oficial Meta e QR Code), SMS, e-mail, Facebook, Instagram, X, URA e central telefônica (SIP/telefone IP), agentes de IA, campanhas, funis kanban | `menuBot` / `BOT` |
| **Analytics** | Indicadores, dashboards, relatórios de leads e termos; Data Warehouse com integração nativa a **Power BI** | `menuAnalytics` / `ANM` |
| **Quality** | Uso interno/CRM: SAC, propostas, visitas, licenças, ponto eletrônico, telefonia (só no desktop) | `menuQuality` |
| **Paylogos** | Subadquirente/cobrança: PIX, cartão, link de pagamento, maquininhas (POS), recebedores (split) | dentro do Cash |
| **Doclogos** | Ferramenta de laudos (integração com equipamentos Zeiss para importar imagens) | PEP/Laudo |
| **Chatlogos** | Chat interno entre equipes e grupos | `chatlogos/*` |
| **Authlogos** | Login único: "uma conta, um mundo de soluções"; o mesmo usuário entra em várias clínicas | auth.micrologos.com.br |
| **Portal do Paciente** | Laudos e imagens, envio de exames externos, atualização cadastral, agendamento e pagamento online | rotas públicas |

### Arquitetura atual (o que dá para inferir)
- **Híbrido desktop + web.** Ainda existe o cliente Windows *Clinic Master SP* (`MLClmAdv.exe`). Muitos itens de menu não têm tela web (ver seção 9), e algumas mensagens dizem "Revise-o no desktop".
- **Web:** Vue 3 + Vuex, tema Metronic 8 (Bootstrap), FullCalendar, jKanban, jsTree, DataTables, Google Charts. Interface em português, inglês e espanhol.
- **Backend:** API REST em `backend.micrologos.com.br`, no padrão `POST recurso/access/acao`, com token de sessão. Há backends de chat separados (`backendchat1..4`, `backendio`) e um ambiente de testes (`backendtest`).
- **Assinatura digital** com certificado ICP-Brasil no navegador (Fortify/`webcrypto-socket`, PKI.js) e uma rota pública `/validador` para validar documentos assinados.
- **Teleatendimento** com Jitsi Meet próprio (`teleatendimento.micrologos.com.br`).
- **Imagens:** PACS Orthanc com visualizador OSIMIS e upload DICOM.
- **Multiempresa e multiunidade:** usuário com várias empresas e unidades, troca de unidade/local nos agendamentos e transferência de itens entre unidades.
- **Permissões** por códigos hierárquicos (`CLM` → `CLMCA` → `CLMCAPA`…), com **perfis de usuário** por sistema e um perfil "Master".

---

## 3. Módulo Clinic: funcionalidades

### 3.1 Agenda e recepção
- Agenda por médico, local, unidade e especialidade, com visões **Ambulatório**, **Cirurgia** e **Ocupação**, mais Calendário e mapa de calor.
- Horários do staff configurados por **dia da semana**, por **intervalo**, **avulsos** e **bloqueios**, com feriados e motivos de ausência, cancelamento, desistência, emergência e bloqueio.
- **Agenda flexível**, **fila de espera da agenda**, **agenda fora da clínica** e **sincronização com Google Agenda**.
- Regras de convênio na marcação: limite de atendimentos por plano/médico/dia/mês, se o plano é aceito pelo médico, se o procedimento é permitido ao médico, regra de retorno do paciente, vagas por plano e procedimentos obrigatórios.
- **Kits de procedimentos**, **pacotes de sessões** (com aparelhos, lados e regiões) e orçamentos vinculados ao agendamento.
- Status do agendamento: Agendado, Atendendo, Atendido, Faltou, Desistiu, Canc. Pac., Canc. Med., Esp. Pend., Desmembrado, além de confirmações e cancelamentos por canal (Whats/SMS/Email/Site/Tel Conf. e Canc.).
- Tipo e origem do atendimento: 1ª consulta, seguimento, pré-natal, por encaminhamento, UTI, receptivo, ativo de cuidado planejado, ativo de faltosos, WhatsApp, chat, agendamento online, marketplace.
- **Recepção:** registro de chegada (individual, em lote ou pelo totem), **senhas**, **Totem do paciente** e **Totem do funcionário**, **Chamada na TV** e display do consultório.
- **Gestão de retorno:** controle de retornos pendentes do paciente.
- **Teleatendimento** individual e em grupo, com link copiável.

### 3.2 Pacientes
- Cadastro completo com CPF/RG (busca e verificação de duplicidade), foto, telefones, empresa, profissão, portador (convênio/carteirinha), acompanhantes, CEP e localidade IBGE.
- **Ocorrências** e **avisos** do paciente.
- **Imagens do paciente** com aprovação de uso de imagem.
- **LGPD:** geração de link de consentimento e termos enviados, com relatório.
- Crédito do paciente (saldo usado em pagamentos).
- Arquétipos de paciente (perfis para fichas de dados).

### 3.3 Prontuário Eletrônico (PEP)
- Prontuário com **linha do tempo**, aberto a partir da agenda ou em nova aba.
- **Fichas de dados configuráveis** (formulários por especialidade, médico ou tipo de atendimento): campos, limites, grupos de limites, **arquétipos** e favoritos. São ilimitadas no plano superior.
- **Modelos de texto** por categoria, frases e títulos, com sistemas padrão (texto padrão por sistema).
- Anamnese e exame físico, hipótese diagnóstica, **CID-10**, alergias (com **verificação de alergia × fármaco**) e condutas.
- **Prescrição** com base de mais de 40 mil medicamentos, medicamentos personalizados, posologias, substitutos, formas e intervalos de aplicação, e os 5 itens mais usados por médico.
- Atestados, receitas, solicitação de procedimentos e exames, e complementos.
- **Marcações em imagem** (desenho sobre figuras) e upload de multimídia (PDF, imagem, DICOM e XML de até 50 MB).
- **Assinatura digital** do atendimento e dos documentos (certificado A1/A3, validação de senha do certificado, PDF de assinatura).
- **Auditoria de itens**, histórico de versões dos documentos e pedido de revisão.
- **IA no prontuário:** preenchimento de campo por prompt (`ai/realizarPromptProntuarioCampo`), mais "Resumo by AI" e "Avaliação by AI".
- **Consulta ao CFM** (validação do CRM do médico).
- Fila do PEP (pacientes aguardando atendimento).

### 3.4 Laudos e exames
- **Fila de Exames** e **Fila de Laudos**: laudo associado ao exame, modelos de laudo por médico, importação de arquivo de laudo, marcação de "não executar", complementos.
- **Bloqueio e desbloqueio de laudo** (edição concorrente), log do laudo e laudos pendentes de assinatura.
- **Liberação de laudo e imagem ao paciente**, com envio de acesso por e-mail e "esqueci a senha" do paciente no portal.
- Laudo Web e integração Zeiss/Doclogos para equipamentos de oftalmologia.

### 3.5 Centro cirúrgico e internação (parte grande só no desktop)
- Agenda de cirurgia, Centro Cirúrgico, equipes médicas, anestesia, status dos locais (leitos e salas), enfermaria.
- Prescrição médica e requisição/devolução de material para **internados** e para **ambulatório**, procedimentos realizados em internados, consumo por setor e requisições encerradas.
- Relatórios: **Censo diário** e estatística por tipo de acomodação.

### 3.6 Faturamento
- **Contas de Paciente**: itens (procedimentos, mat/med, taxas, staff/honorários), cálculo de preço por tabela, recálculo, status da conta, pendências da conta, gastos de mat/med e transferência de itens entre contas, unidades e classificação de guia.
- **Tabelas de preço** por convênio/plano, **Brasíndice**, taxas por turno, kits e tempo de duração do atendimento.
- **Guias TISS** (emissão e impressão com imagem da assinatura do médico e do paciente):
  - Consulta, SP/SADT, SADT + honorários, honorários individuais, solicitação de SADT, solicitação e resumo de internação, OPME, outras despesas e odontológica.
  - Guias **SUS**: ambulatorial (BPA) e especiais (APAC), mais **CIHA**.
  - Assinatura do paciente capturada na própria guia.
- **Classificação de guias** e de atendimentos, centros de responsabilidade, layouts de convênio e **configuração de faturamento automático**.
- **Cobranças de Convênio**: lotes e protocolos de entrega, faturamento × pagamento, tipos de **glosa**, **justificativa de glosas técnicas** e acompanhamento.
- **Orçamentos de pacientes** (particular), com parcelamento.
- **DMED**: recibos e relação para a declaração de serviços médicos.
- Integração **Orizon** (autorização, faturamento e cobrança eletrônicos).

### 3.7 Repasse médico
- Cálculo do repasse por período, com regras por categoria de staff, tipo de comissão e donos de equipamentos.
- Lançamentos extras para repasse, relatório de repasse ao staff médico e repasse ligado ao fluxo de caixa. O site promete "repasse em tempo real".

### 3.8 Estoque e suprimentos
- Produtos com categoria, unidade, marca, lotes e **validade** (alerta de lote vencido), **multiestoque** por local e **kits**.
- Dispensação, devolução (quantidade negativa), consumo por setor, contagem de inventário.
- Pedido de compra, solicitação de compra e cotação de preço, ligados à NF de entrada.

### 3.9 Relatórios do Clinic
Agendamentos por plano, web, por médico e por local; faltas por paciente; pacotes de sessão; censo; cruzamento de dados do atendimento (inclusive por palavra-chave); requisições; produtos por prescrição; atendimentos e movimentação de estoque por médico; valores por plano; cobranças entregues; repasse; auditoria (consistências, conferências e cadastros); planilhas por plano/convênio × produto/serviço.

## 4. Módulo Cash (financeiro)
- **Fluxo de caixa**, **contas a pagar e a receber**, parcelas, rateio por centro de responsabilidade e projeto, **alteração e pagamento múltiplos**, cancelamento de pagamento.
- **Conta corrente / Portadores** (bancos e caixas), movimentação entre portadores e **conciliação bancária e de cartão**.
- **Contas recorrentes** e transações programadas, com cobrança automática por e-mail.
- **Boleto**, **PIX** (geração e exclusão), **link de pagamento**, cheque.
- **Notas fiscais de saída** (emissão e cancelamento de **NFS-e Nacional** com certificado da empresa, importação de XML) e **notas de entrada**, ligadas aos títulos.
- Cadastros: emitentes (clientes e fornecedores), empresas, planos financeiros (plano de contas), naturezas de operação, tipos de multa, moedas e índices.
- Relatórios: **DRE e DFC**, fluxo projetado pela agenda semanal, projetado diário por emitente. Integração contábil.

## 5. Paylogos (pagamentos)
Links de pagamento, recebedores (para split entre sociedades médicas), maquininhas (POS), clientes e pedidos. A página pública `/pagar/:codigo` faz o checkout. Também cobra mensalidades de sociedades médicas.

## 6. Talklogos / Bot (comunicação)
- **Canais:** WhatsApp (QR Code e API oficial da Meta, com templates e macros), SMS, e-mail SMTP, Facebook, Instagram e X.
- **Regras de envio automático:** lembretes, confirmação e cancelamento autônomos, pesquisa de satisfação, envio de documentos e atualização cadastral.
- **Agentes de IA** para agendamento autônomo; URAs; usuários do bot; mensagens personalizadas.
- **Campanhas**, **landing pages de leads** (`/lp/:hash`) e **funis kanban** de leads.
- **Créditos pré-pagos** de WhatsApp, SMS, IA e telefonia, com relatórios de consumo e recarga.
- Central telefônica e call center (ML SipPhone, telefone IP, gravação de chamadas).

## 7. Analytics
Indicadores (`bi/obterIndicadores`), dashboards por módulo, relatório de leads, termos enviados. DW alimentado automaticamente e conectores para **Power BI** (setup e licença por usuário).

## 8. Modelo comercial (site)
- Preço **por membro da equipe e por staff médico**, em planos mensal, anual ou híbrido, em 3 faixas ("para começar", "mais flexibilidade" e "equipe em crescimento").
- Extras cobrados à parte: armazenamento de 200 GB, créditos de telefonia com IA, Power BI por usuário, treinamento avulso, implantação para até 10 usuários.
- Promete **conversão de dados de outros sistemas** sem custo, o que nos interessa para a migração de volta.

## 9. Funções que (aparentemente) só existem no desktop
Itens de menu sem tela web, segundo o bundle: Cirurgia/Centro Cirúrgico, Ocupação, Fila do Totem, Inform. Médicas Pendentes, Laudo Web, todo o bloco de **Solicitações de internados/ambulatório** (prescrição, requisição e devolução), Faturamento (tela principal), Pendências, Lançamentos extras de repasse, Justificativa de glosas, Acompanhamento, DMED, CIHA, Protocolos de tratamento, Sessões, Status dos locais, Equipes médicas, CID-10, IBGE, Representantes, Configuração de faturamento automático, Layouts de convênios, Donos de equipamentos, Tipos de comissão, Brasíndice, Formas e intervalos de aplicação, títulos e frases de laudo, CEP, Acompanhantes, utilitários (log de usuários, ponto eletrônico, captura automática de imagem, aviso de entrada de paciente) e quase todos os relatórios do Clinic. O módulo **Quality** é inteiro desktop.

**Consequência para nós:** provavelmente o cliente usa as duas interfaces. Precisamos saber **quais telas desktop são usadas de fato**.

---

## 10. Pontos de atenção para a substituição

1. **Escopo é grande.** São 5 módulos, cerca de 220 telas web, cerca de 790 operações de API e um desktop legado. Precisamos priorizar pelo que **nós** usamos, não pelo que o sistema oferece.
2. **Faturamento TISS/SUS** é o núcleo mais crítico e regulado (padrão TISS da ANS, BPA/APAC/CIHA, DMED, glosas). É onde costuma estar o maior risco de migração.
3. **Repasse médico** tem regras muito específicas por médico, categoria, equipamento e extras. Precisamos levantar as regras reais.
4. **PEP com fichas configuráveis e assinatura ICP-Brasil.** É preciso migrar o histórico clínico preservando assinaturas e versões (há exigência legal de guarda do prontuário por 20 anos).
5. **Integrações a manter ou substituir:** WhatsApp oficial, SMS, e-mail, PIX/cartão/link (Paylogos), NFS-e Nacional, Orizon, PACS/DICOM, equipamentos Zeiss, Google Agenda, Power BI, teleatendimento, totem e TV.
6. **Lock-in:** Paylogos (recebimentos), créditos pré-pagos e laudos no portal do paciente dependem da infraestrutura deles. É preciso planejar a transição de URLs e links já enviados aos pacientes.
7. **Exportação de dados:** pedir formalmente a base completa (cadastros, agenda histórica, PEP, laudos e imagens DICOM, contas, guias, financeiro) e o dicionário de dados.

## 11. Próximos passos sugeridos (para validarmos juntos)
- [ ] Levantar **quais módulos e telas a clínica realmente usa** (web e desktop) e com que volume.
- [ ] Mapear os **convênios** atendidos, o volume de guias por tipo e se há SUS.
- [ ] Documentar as **regras de repasse** atuais.
- [ ] Listar as **integrações ativas** (Paylogos, WhatsApp, NFS-e, PACS, Orizon…).
- [ ] Obter contrato, custos atuais e condições de **exportação de dados** com a Micrologos.
- [ ] Com acesso de usuário: capturar telas e fluxos reais (agenda → atendimento → conta → guia → cobrança → repasse → financeiro).

---

### Fontes
- Site institucional: https://www.micrologos.com.br/
- Aplicação web: https://clinic.micrologos.com.br/ (bundle `js/app.235de41e.js`, versão 1.26.12)
- Blog (indexado): parceria com a Orizon e integração com a Zeiss
- Wiki (indexada): páginas "Emissão Guia APAC", "Brasíndice" e "Transação Programada Email"
- Crunchbase: https://www.crunchbase.com/organization/micrologos
- Tracxn: https://tracxn.com/d/companies/micrologos-software-developer/__EteOWSeVRtPrV91miuCS6lxXdxC9o2oMnPaRiLIa9WA
- Facebook: https://www.facebook.com/micrologos/
- Reclame Aqui: https://www.reclameaqui.com.br/empresa/micrologos-maquinas-e-servicos-ltda/
- Listagem de processo `MLClmAdv.exe`: https://processchecker.com/file.php?page=23587
