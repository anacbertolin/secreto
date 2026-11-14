# 03 · Modelo de dados (inferido)

> Construído a partir dos 106 identificadores `ID_*` e dos campos usados pelo front-end web.
> **É uma hipótese de trabalho** 🔶: os nomes de tabelas e colunas reais virão da exportação ou do
> dicionário de dados da Micrologos. A lista bruta está em [anexos/campos-observados.txt](anexos/campos-observados.txt).
> O padrão de nomes (`ID_<ENTIDADE>`, MAIÚSCULAS) sugere que a chave de cada tabela é `ID_<TABELA>`.

## Diagrama de alto nível 🔶
```
EMPRESA ─┬─ UNIDADE ─── LOCAL (─ LOCAL_CATEGORIA)
         │
CONVENIO_MESTRE ── CONVENIO/PLANO ── TABELA_PRECO ── PRECO_PRODUTO ── PRODUTO (─ CATEGORIA, UNIDADE, MARCA)
                                                                              │
MEDICO (staff) ─ MEDICO_CATEGORIA, ESPECIALIDADE, HORARIOS                   │
     │                                                                        │
PACIENTE ─┬─ AGENDA ─┬─ AGENDA_EXAME ── PACIENTE_LAUDO ── LAUDO_LOG           │
          │          └─ AGENDA_RETORNO                                         │
          ├─ ATENDIMENTO ─┬─ ATENDIMENTO_DETALHE (fichas, textos) ─ HISTORICO/LOG/AUDITORIA
          │               ├─ ATENDIMENTOS_CID ── CID
          │               ├─ ATENDIMENTOS_MEDICAMENTOS ── MEDICAMENTO (DML) / MEDICAMENTO_PERSONALIZADO
          │               └─ SOLICITACAO_EXAME
          ├─ PACIENTE_CONTA ─ itens (produto/procedimento/staff) ─ FATURAMENTO ─ FATURAMENTO_STAFF_MEDICO
          │        └─ guias TISS ── CLASSIFICA_GUIA ── COBRANCA ─ protocolos/glosas
          ├─ PACIENTE_ORCAMENTO, PACIENTE_DOCUMENTO, PACIENTE_IMAGEM(_APROVACAO), PACIENTE_OCORRENCIA, PACIENTE_ARQUETIPO
          └─ portador (carteirinha)
EMITENTE (cliente/fornecedor) ─ EMITENTE_CATEGORIA
FLUXO_DE_CAIXA (título) ─ parcelas, rateio ─ PLANO_FINANCEIRO, CENTRO_RESPONSABILIDADE, PROJETO, PORTADOR
     ├─ NOTA_FISCAL (saída) / NF_ENTRADA
     └─ PORTADOR_MOVIMENTACAO
PAY_CLIENTE ─ PAY_PEDIDO ─ PAY_RECEBEDOR ─ PAY_RECEBEDOR_POS
```

## Catálogo de entidades por domínio

### Estrutura e cadastros base
| Chave | Entidade | Notas |
|---|---|---|
| `ID_EMPRESA` | Empresa (pessoa jurídica) | Multiempresa |
| `ID_UNIDADE` | Unidade / estabelecimento | |
| `ID_LOCAL`, `ID_LOCAL_CATEGORIA` | Local de atendimento (sala, consultório, leito) e categoria | |
| `ID_ESPECIALIDADE` | Especialidade | |
| `ID_FERIADO` | Feriado | |
| `ID_PROFISSAO` | Profissão | |
| `ID_TURNO`, `ID_TAXA` | Turno e taxa de turno | |
| `ID_MOTIVO_AUSENCIA` | Motivos (ausência, cancelamento…) | |
| `ID_TIPO_OCORRENCIA` | Tipo de ocorrência | |
| `ID_CONTATO_EXTERNO` | Contato externo (médico solicitante etc.) | |
| `ID_EMITENTE_ML` | A clínica como cliente da Micrologos | Não migrar |

### Profissionais
| Chave | Entidade |
|---|---|
| `ID_MEDICO` | Staff médico (também aparece como `ID_MEDICO_SOLICITANTE`, `ID_MEDICO_EXECUTANTE`, `ID_MEDICO_REVISOR_INDICADO`) |
| `ID_MEDICO_CATEGORIA` | Categoria do staff (usada no repasse) |

### Convênios, preços e produtos
| Chave | Entidade |
|---|---|
| `ID_CONVENIO_MESTRE` | Operadora / convênio "pai" |
| `ID_CONVENIO` | Convênio/plano |
| `ID_PRECO_PRODUTO` | Preço de um produto ou procedimento em uma tabela |
| `ID_PRODUTO`, `ID_PRODUTO_CATEGORIA` (hierárquica: `CODIGO_PRODUTO_CATEGORIA_SUPERIOR`), `ID_PRODUTO_UNIDADE`, `ID_PRODUTO_MARCA` | Produtos, procedimentos e serviços |
| `ID_PRODUTO_ESTOQUE_LOCAL`, `ID_PRODUTO_MOVIMENTACAO` | Estoque por local e movimentações |
| `ID_DML_MEDICAMENTO`, `ID_MEDICAMENTO`, `ID_MEDICAMENTO_PERSONALIZADO` | Base de medicamentos (DML = base externa, mais de 40 mil itens) e personalizados |

### Paciente
| Chave | Entidade |
|---|---|
| `ID_PACIENTE` | Paciente |
| `ID_PACIENTE_ARQUETIPO` | Arquétipo do paciente |
| `ID_PACIENTE_DOCUMENTO` | Documento anexado |
| `ID_PACIENTE_IMAGEM`, `ID_PACIENTE_IMAGEM_APROVACAO` | Imagens e aprovação de uso |
| `ID_PACIENTE_OCORRENCIA` | Ocorrência |
| `ID_PACIENTE_ORCAMENTO` (`_PAI`) | Orçamento (com hierarquia) |
| `ID_PACIENTE_LAUDO` | Laudo |
| `ID_PACIENTE_CONTA` | Conta do paciente (faturamento) |

### Agenda
| Chave | Entidade |
|---|---|
| `ID_AGENDA` | Agendamento |
| `ID_AGENDA_EXAME`, `ID_AGENDA_EXAME_AUX` | Exame/procedimento do agendamento |
| `ID_AGENDA_RETORNO` | Retorno |
| `ID_TOTEM_SENHA` | Senha do totem |

### PEP
| Chave | Entidade |
|---|---|
| `ID_ATENDIMENTO` | Atendimento (consulta) |
| `ID_ATENDIMENTO_TIPO` | Tipo de atendimento |
| `ID_ATENDIMENTO_AREA`, `ID_ATENDIMENTO_SISTEMA` | Áreas e sistemas do prontuário |
| `ID_ATENDIMENTO_DETALHE` (+ `_LOG`) | Conteúdo detalhado e log |
| `ID_ATENDIMENTO_HISTORICO` | Versões |
| `ID_ATENDIMENTO_AUDITORIA` | Auditoria |
| `ID_ATENDIMENTOS_CID`, `ID_CID` | CIDs do atendimento |
| `ID_ATENDIMENTOS_MEDICAMENTOS` | Prescrição |
| `ID_SOLICITACAO_EXAME` | Solicitações |
| `ID_FICHA_DADOS_CAMPO` (+ `_FAVORITO`), `ID_FICHA_DADOS_ARQUETIPOS` | Fichas de dados configuráveis |
| `ID_TEXTO`, `ID_TEXTO_CATEGORIA`, `ID_TEXTO_HTML`, `ID_TEXTO_LAUDO` | Modelos de texto e laudo |
| `ID_LAUDO_LOG` | Log do laudo |
| `ID_DIVERSOS` | Anexos e "diversos" do exame |
| `ID_CLASSIFICA_ATENDIMENTO` | Classificação de atendimento |

### Faturamento
| Chave | Entidade |
|---|---|
| `ID_FATURAMENTO`, `ID_FATURAMENTO_STAFF_MEDICO` | Itens faturados e participação do staff (base do repasse) |
| `ID_CLASSIFICA_GUIA` | Classificação de guias |
| `ID_COBRANCA` | Cobrança/lote ao convênio |
| `ID_TIPO_GLOSA` | Tipo de glosa |
| `ID_PENDENCIA`, `ID_PENDENCIA_TIPO` | Pendências da conta |
| `ID_CENTRO_RESPONSABILIDADE` | Centro de responsabilidade |

### Financeiro
| Chave | Entidade |
|---|---|
| `ID_EMITENTE`, `ID_EMITENTE_CATEGORIA` | Cliente/fornecedor e categorias (hierárquicas) |
| `ID_FLUXO_DE_CAIXA` | Título (pagar/receber) |
| `ID_PLANO_FINANCEIRO` (hierárquico) | Plano de contas |
| `ID_PROJETO` | Projeto |
| `ID_PORTADOR`, `ID_PORTADOR_MOVIMENTACAO`, `ID_PORTADORE_MP_TAXA`, `ID_CONTA_DESTINO` | Contas/caixas, movimentações, taxas |
| `ID_NOTA_FISCAL`, `ID_NF_ENTRADA` | NF de saída e de entrada |
| `ID_NATUREZA_OPERACAO`, `ID_TIPO_DE_MULTA`, `ID_MOEDA_ESTRANGEIRA` | Tabelas |
| `ID_TRANSACAO_PROGRAMADA` | Conta recorrente |
| `ID_PAY_CLIENTE`, `ID_PAY_PEDIDO`, `ID_PAY_RECEBEDOR`, `ID_PAY_RECEBEDOR_POS`, `ID_PAY_AUTOMACAO` | Paylogos |

### Comunicação
| Chave | Entidade |
|---|---|
| `ID_CANAL_ATENDIMENTO` | Canal (WhatsApp, SMS…) |
| `ID_CONFIGURACAO_ENVIO` | Regra de envio |
| `ID_CAMPANHA` | Campanha |
| `ID_KANBAN`, `ID_KANBAN_BOARD` | Funis |
| `ID_PESQUISA_SATISFACAO` | Pesquisa |

## Campos conhecidos (amostra)
- **TISS no atendimento ou conta:** `TISS_INDICACAO_CLINICA`, `TISS_INDICADOR_ACIDENTE`, `TISS_TIPO_ATENDIMENTO`, `TISS_TIPO_DOENCA`, `TISS_TEMPO_DOENCA`, `TISS_TEMPO_DOENCA_TIPO`, `TISS_TIPO_SAIDA`, `TISS_LAUDO_ESPECIAL`, `TISS_LAUDO_PRORROGACAO`, `TISS_OBSERVACAO`, `VERSAO_TISS`.
- **Guia:** `TIPO_GUIA`, `ORIGEM_GUIA`, `CAMPOS` (campos numerados conforme o layout ANS), `PAGINAS`, `ASSINATURAS`, `PROFISSIONAL_SOLICITANTE`, `PROFISSIONAL_EXECUTANTE`.
- **Staff:** `IMAGEM`, `IMAGEM_ASSINATURA_GUIAS`, `FIRMA`.
- **Laudo:** `LAUDO_STATUS`, `LIBERAR_LAUDO`, `LIBERAR_LAUDO_PACIENTE`, `OBRIG_LAUDO`.
- **Paciente:** `CNS`, `CARTEIRA`, `CPF`, `RG`, `TELEFONE`.
- **Auditoria genérica:** `SISTEMA`, `MODULO`, `OPERACAO`, `USUARIO`, `CAMPO`, `CONTEUDO`, `CONTEUDO_NOME`, `NIVEL`.
