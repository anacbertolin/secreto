# 01 · Visão geral: empresa e produtos

## Empresa
| | |
|---|---|
| Razão social | Micrologos Máquinas e Serviços Ltda. (marca "Micrologos Software Developer") ✅ |
| Outro nome | "AC Valle Informática" aparece como fabricante do executável desktop ✅ |
| Sede | Rio de Janeiro/RJ ✅ |
| Fundação | 1983; o site fala em "43 anos de experiência" ✅ |
| Porte | De 2 a 10 pessoas segundo LinkedIn e Tracxn. O ZoomInfo diz de 51 a 200 🔶 |
| Público | Clínicas, consultórios, hospitais-dia, laboratórios. Clientes citados: D'Olhos Hospital Dia e Vista Medicina dos Olhos (oftalmologia) ✅ |
| White-label | **Clinic Spirit** (clinicspirit.com) usa o mesmo código e o mesmo backend ✅ |
| Idiomas da interface | Português, inglês e espanhol ✅ |

## Família de produtos

| Produto | Função | Menu / prefixo de permissão |
|---|---|---|
| **Clinic by Micrologos** (antigo *Clinic Master Advanced / SP*) | ERP clínico-hospitalar: agenda, PEP, laudos, faturamento convênio/SUS/particular, repasse, estoque, internação | `menuClinic` / `CLM` |
| **Cash** | ERP financeiro: fluxo de caixa, pagar/receber, conta corrente, NF de entrada e saída, DRE/DFC | `menuCash` / `CSM` |
| **Talklogos** (menu "Bot") | Omnichannel: WhatsApp, SMS, e-mail, Facebook, Instagram, X, URA, telefonia IP, agentes de IA, campanhas, funis | `menuBot` / `BOT` |
| **Analytics** | Indicadores, dashboards, DW com Power BI | `menuAnalytics` / `ANM` |
| **Quality** | CRM e SAC interno, propostas, licenças, ponto eletrônico, telefonia (só no desktop) | `menuQuality` |
| **Paylogos** | Pagamentos: PIX, cartão, link, maquininhas, split entre recebedores | dentro do Cash |
| **Doclogos** | Elaboração de laudos (integração com equipamentos Zeiss) | PEP/Laudos |
| **Chatlogos** | Chat interno entre equipes e grupos | `chatlogos/*` |
| **Authlogos** | Login único para todas as soluções e várias clínicas | auth.micrologos.com.br |
| **Portal do Paciente** | Laudos, imagens, envio de exames externos, atualização cadastral, agendamento e pagamento | rotas públicas |

## Modelo comercial (site público)
- Preço **por membro da equipe e por staff médico**, nas modalidades mensal, anual ou híbrida, em 3 faixas.
- Recursos usados para separar as faixas: fichas de dados ilimitadas, gestão de retorno, teleatendimento em grupo, prontuário com linha do tempo, fila de espera, prescrição com mais de 40 mil medicamentos, laudos no portal, agenda fora da clínica, faturamento particular, convênio e SUS, repasse e extras de repasse, pagar/receber, fluxo de caixa, portadores, integração contábil, NF de compra, dispensação, multiestoque, contagem, pedido, solicitação e cotação de compra, chat interno e em grupo, chatbot de agendamento, Facebook e Instagram, kanban de leads, "Resumo by AI", "Avaliação by AI", central telefônica, ML SipPhone e telefone IP.
- Extras cobrados à parte: implantação para até 10 usuários, treinamento avulso, armazenamento de 200 GB, crédito de telefonia com IA, Power BI por usuário e setup.
- O site promete **converter dados de outros sistemas**. Isso indica que eles têm rotinas de exportação e importação, um ponto a usar na negociação da saída.
