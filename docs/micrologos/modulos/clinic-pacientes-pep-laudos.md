# Clinic · Pacientes, prontuário (PEP) e laudos

## Cadastro de paciente
Recursos: `pacientes`, `pacientesImagens`, `pacientesArquetipos`, `lGPD`, `contatosExternos`.

- Identificação: nome, CPF, RG (com verificação de duplicidade e busca por CPF, ID e telefone), **CNS** (cartão SUS), foto. ✅
- Vínculos: **portador** (carteirinha de convênio/plano), **empresa**, **profissão**, **acompanhantes**, naturalidade, procedência, CEP e localidade IBGE. ✅/🔶
- **Ocorrências** (tipos configuráveis) e **avisos** que aparecem no atendimento. ✅
- **Imagens do paciente** com **aprovação de uso de imagem**. ✅
- **LGPD**: geração de link de consentimento, termos enviados e relatório. ✅
- **Crédito do paciente** (saldo usado em pagamentos). ✅
- **Arquétipos de paciente** (perfis que definem quais fichas de dados se aplicam). ✅
- Cadastro simplificado (`salvarSimples`) para marcação rápida. ✅
- ❓ A lista exata de campos não aparece no código web (vem do servidor). Confirmar com a exportação.

## Prontuário Eletrônico do Paciente (PEP)
Recurso: `atendimentos` (71 operações). Telas: `/pep/:id[/:idAgenda[/:idAgendaExame/:idProduto[/:idDiversos]]]`, mais as versões "nova aba".

### Estrutura
- **Linha do tempo** do paciente, que pode ser agrupada (`TIMELINE_PEP_ENTRA_AGRUPADA`). ✅
- O atendimento é aberto a partir da agenda ou **sem agenda** (`INCLUI_ATENDIMENTO_SEM_AGENDA`, configurável). ✅
- Dividido em **áreas** (`ID_ATENDIMENTO_AREA`), **sistemas** (`ID_ATENDIMENTO_SISTEMA`, com texto padrão por sistema), **detalhes**, **histórico** de versões e **auditoria**. ✅
- Obrigatoriedades configuráveis: CID (`OBRIG_CID_ATENDIMENTO`), dados (`OBRIG_DADOS_ATENDIMENTO`), confirmação de anexos, CIDs, textos e solicitações. ✅

### Fichas de dados (formulários configuráveis) ✅
- **Campos**, **limites**, **grupos de limites**, **arquétipos** e **favoritos** por médico.
- Máscaras (inteiro, sinal), **campos calculados** e configuração de fonte e altura da tela.
- Download da ficha em PDF.
- São o equivalente a formulários por especialidade (ex.: oftalmologia com acuidade visual, refração, PIO… 🔶).

### Conteúdo clínico ✅
- Anamnese e exame físico, hipótese diagnóstica, condutas.
- **CID-10** (vários por atendimento, com CID principal).
- **Alergias**, com **verificação de alergia × fármaco** na prescrição.
- **Modelos de texto** do PEP, com categorias, títulos e frases.
- **Prescrição**: base com mais de 40 mil medicamentos (tabela `DML`), **medicamentos personalizados**, **posologias**, **substitutos**, formas e intervalos de aplicação, e os 5 itens mais usados por médico.
- **Atestados**, **receitas**, **solicitação de procedimentos e exames** (gera a solicitação SADT da guia TISS).
- **Complementos** e "diversos" (anexos ligados ao exame).
- **Marcações sobre imagens** (anotação gráfica). ✅
- Upload multimídia: PDF, imagem, **DICOM** e XML de até 50 MB, com captura automática de imagem de equipamento (desktop). ✅
- Pedido de **revisão** a outro médico (`ID_MEDICO_REVISOR_INDICADO`). ✅
- Auditoria de itens do PEP (`PERMITE_REALIZAR_AUDITORIA_PEP`); há um campo `USUARIO_MEMBRO_ONA` (acreditação ONA). ✅

### Assinatura digital ✅
- Assinatura do atendimento e dos documentos com certificado ICP-Brasil (A1/A3) via Fortify no navegador.
- Fluxo: `iniciarAssinatura` → `completarAssinatura`, com validação da senha do certificado e PDF do detalhe da assinatura.
- Laudos pendentes de assinatura ficam numa lista própria e podem ser descartados.
- Documentos assinados são validados publicamente em `/validador`.

### IA no PEP ✅
- `ai/realizarPromptProntuarioCampo`: preenche um campo do prontuário a partir de um prompt.
- **Resumo do PEP por IA** (`HABILITAR_RESUMO_IA_PEP`); marcadores "Realizado por IA" e "via IA".
- O site cita "Resumo by AI" e "Avaliação by AI".

### Outros
- **Consultar CFM** (validação do CRM). ✅
- Teleatendimento iniciado dentro do PEP. ✅

## Laudos e exames
Recursos: `agendamentosFilaLaudo`, `modelosLaudos`, `solicitacaoExames`. Telas: `/filaExames`, `/filaLaudo`.

- **Fila de Exames** → execução → **Fila de Laudos**. ✅
- Laudo ligado ao exame da agenda (`ID_AGENDA_EXAME`), com **modelos de laudo por médico**, títulos e frases. ✅
- Importação de arquivo de laudo e opção "não executar laudo". ✅
- **Bloqueio do laudo** durante a edição (concorrência), desbloqueio e **log do laudo**. ✅
- Status do laudo (`LAUDO_STATUS`) ❓ (valores a confirmar).
- **Liberação ao paciente** do laudo e das imagens, com envio de acesso por e-mail, recuperação de senha no portal e histórico de envios. ✅
- Laudos médicos especiais e de prorrogação (campos TISS). ✅
- **Doclogos + Zeiss**: importação de imagens de equipamentos oftalmológicos. ✅ (blog)
- **PACS Orthanc** para imagens DICOM. ✅

## Portal do Paciente ✅ (site)
Laudos e exames, envio de exames externos, atualização cadastral, agendamento online e pagamento.
