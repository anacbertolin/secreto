# Convênio Bradesco Saúde (código 2) — cadastro completo no Micrologos

**Data:** 24/11/2026 · **Sistema:** ML Clinic Master ASP 13.13.30.00 · **Usuário:** AnaCarolina (MASTER)
**Modo:** só leitura. Tudo foi visto em modo "Visualizando". Nada foi salvo, alterado, incluído ou excluído. Saí das telas pelo X (Fechar).
**Fora deste arquivo:** o convênio 23 "Bradesco Saude Operadora de Planos" (ANS 421715) é outro cadastro e fica para outro dia.
**Privacidade:** nenhum dado de paciente foi copiado e nenhuma conta, guia ou lote foi aberto. CPFs de médicos foram omitidos: eles aparecem na tela do Staff, mas não foram anotados.

**Legenda das caixas:** SIM = marcada · NÃO = desmarcada · (—) = indeterminada (azul com traço). "(vazio)" = campo em branco na tela.

**Caminho:** Cadastros ▸ Convênios/Planos Saúde ▸ busca "Bradesco" ▸ código 2.

---

## 1. Identificação

| Campo | Valor na tela |
|---|---|
| Código do convênio | 2 |
| Nome (Descrição) | Bradesco Saúde |
| Razão social (Complementares, "descrição resumida" TISS/ABRANGE) | Bradesco Saude |
| CNPJ da operadora | NÃO VISTO (não existe campo de CNPJ da operadora na tela do convênio; o Emitente "Bradesco Saúde", código 4, fica no cadastro financeiro, que não foi aberto) |
| Registro ANS | 5711 |
| Ativo/inativo | Ativo (caixa "Inativo" = NÃO) |
| Endereço / telefone / site da operadora | NÃO VISTO (não há esses campos no cadastro do convênio; telefone e contato existem só no plano, e estão vazios) |
| Observações | (vazio) (aba Adicionais) |
| Emitente | Bradesco Saúde, código 4 |
| Unidade | (vazio) |
| Portador Boleto | (vazio); ao lado do ícone aparece o número "9" |
| Incluído por / em | MASTER, 04/03/2016 11:56 |
| Atualizado por / em | Soraline, 09/09/2026 14:1? (os minutos aparecem cortados na tela) |

## 2. Aba Visão Geral e Detalhamento

### 2.1 Visão Geral
- Busca "Bradesco" (Ativos) mostrou 2 convênios: **2 Bradesco Saúde** e 23 Bradesco Saude Operadora de Planos.
- Planos de Saúde do convênio 2 (grade): **4 Bradesco Empresa** e **5 Bradesco Individual**. As colunas Descrição TISS, Partic, Web, Teleatend, Pessoa Fis e Part.PJ estão vazias nas duas linhas.

### 2.2 Detalhamento ▸ Adicionais
| Campo | Valor |
|---|---|
| Observação (pode aparecer no PEP se configurado) | (vazio) |
| Qtd. atendimentos permitidos no dia | (vazio) |
| Validade da matrícula obrigatória | (—) |
| Utiliza token de paciente | (—) |
| Financeiro (Cobrança): Dia limite Fech. das Contas | (vazio) |
| Dia limite de Entrega | (vazio) |
| Dia útil | NÃO |
| Prazo Recebimento (dias) | (vazio) |
| Obrigatoriedades: CPF do Titular do Plano | NÃO |
| Abre + Info. Proced. Ag. | NÃO |
| SUS | NÃO |
| Fatura uma Conta para cada Sessão | NÃO |
| Fatura todas as sessões já incluídas | (—) |
| Desmembra Itens da Conta para cada sessão realizada | NÃO |
| só na chegada | (—) |
| Permite cobrança de Fat. mesmo sem Conferir, LIberar e Conf.TISS | NÃO |
| Guia de solicitação no agendamento não obrigatória | NÃO |
| Tipo de Faturamento. Utiliza: | **1 ou + Contas p/ cada agenda** (marcado). Outras opções, não marcadas: "1 mesma Conta p/ várias Agendas", "Ambas as modalidades" |

### 2.3 Detalhamento ▸ Descontos (sub-aba Gerais)
**Faturamento pelo Centro Cirúrgico (% do valor para cálculo do preço)**
- "% dos procedimentos será sempre em cima de um único valor (o maior valor)": **SIM**
- 2º Procedimento 70,00% · 3º Procedimento 50,00% · 4º Procedimento 50,00% · 5º Procedimento 50,00%

**Faturamento pela Agenda de Exames (% do valor para o cálculo de preço)**
- "% dos procedimentos será sempre em cima de um único valor (o maior valor)": NÃO
- "Se 2º, 3º, 4º e 5º procedimentos tiverem quantidade maior que 1, desconsiderar os descontos sobre as quantidades": NÃO
- (Mesma área): 2º 50,00% · 3º 50,00% · 4º 50,00% · 5º 50,00%
- (Áreas diferentes): 2º 50,00% · 3º 50,00% · 4º 50,00% · 5º 50,00%

**Sub-aba Por Categoria de Procedimento:** grade vazia (colunas Categoria, 2º–5º Proced., 2º–5º Proc. Área #).

## 3. Aba Faturamento (do convênio)
A aba "Faturamento" do convênio só tem o **gráfico de faturamento**. Valores na tela: Período "Diário"; base "Por Dt.Faturamento"; 3D NÃO; Degradê Amarelo NÃO; Legenda SIM; Início 01/11/2026; Fim 24/11/2026; Texto acima "Valor"; Tipo "Linha"; Refaz Gráfico SIM; Geral da Clínica NÃO; botões Faz Gráfico e Lista Gráfico (não foram acionados).

Impostos, prazos e limites **não ficam nessa aba**. Abaixo estão onde ficam e o que mostram:

| Item | Onde fica | Valor |
|---|---|---|
| ISS, IRRF, CSLL, PIS/PASEP, COFINS, Outras deduções (%) | Detalhamento de cada **plano** ▸ Impostos | (vazio) nos planos 4 e 5 |
| Valor mínimo de guia (IRRF) / Vl. mínimo p/ impostos | Plano ▸ Impostos | (vazio) nos dois planos |
| Descontos 2º–5º procedimento (cirurgia e exames) | Convênio ▸ Descontos | ver seção 2.3 (70/50/50/50 cirurgia; 50% exames) |
| Descontos 2º–5º no plano | Plano ▸ Descontos | (vazio) nos dois planos |
| Prazo de fechamento / entrega / recebimento | Convênio ▸ Adicionais e Plano ▸ Financeiro | (vazio) em todos |
| Prazo de retorno do paciente | Plano ▸ Permissões | (vazio) nos dois planos |
| Limites de atendimento (dia/mês/mesmo paciente) | Convênio ▸ Adicionais e Plano ▸ Permissões | (vazio) em todos |
| No agendamento obrigatório senha do supervisor | Plano ▸ Permissões | (—) nos dois planos |

## 4. Configuração TISS

### 4.1 Aba "1ª Config. TISS"
**Informações TISS**
- Código utilizado pelo Convênio: CPF/CNPJ (não) · **Cód.Operadora (marcado)**
- Código para definir Prod/Serv nas guias do TISS: Micrologos (não) · **Brasíndice (marcado)** · SIMPRO (não) · Cód. na Tab. Preço (não)
- Nº sequencial da Guia automático: NÃO
- Numeração única p/ todos os tipos de guia: NÃO

**ÚLTIMOS Nos. DE GUIAS** (todos com dois campos "… / …", todos vazios):
| Tipo | Valor |
|---|---|
| (campo único à esquerda, 2 caixas) | (vazio) / (vazio) |
| Comprovante Presencial | (vazio) |
| Solic. Internação | (vazio) / (vazio) |
| Resumo Intern. | (vazio) / (vazio) |
| Consulta | (vazio) / (vazio) |
| OPME | (vazio) / (vazio) |
| SP/SADT | (vazio) / (vazio) |
| Honorários | (vazio) / (vazio) |
| Odontologia | (vazio) / (vazio) |
| Recurso Glosa | (vazio) / (vazio) |

**Versão TISSNet**
| Campo | Valor |
|---|---|
| Data Formato | aaaa-mm-dd |
| Data/Hora Formato | aaaa-mm-ddT99:99:99 |
| xml version | xml version="1.0" encoding="ISO-8859- (o fim aparece cortado na tela) |
| Usa CBO-S Ago/2011 | SIM |
| Hora formato | 99:99:99 |
| Diagnostico | diagnosticoAtendimento |
| versaoPadrao | 4.03.00 |

### 4.2 Aba "2ª Config. TISS"
| Campo | Valor |
|---|---|
| Procedimentos que não irão ser enviados via XML (foram autorizados on line) | 2 linhas, ambas (vazio) |
| Usa essa configuração de nº guias por XML e não a configuração geral do sistema | NÃO |
| Nº de guias que podem ir no XML | (vazio) |
| Qtd. dígitos no Nº do Lote | 12 |
| Qtd. dígitos no Lote do Nome do Arq. | (vazio) |
| Qtd. dígitos do nº Senha autorização | (vazio) |
| Qtd. dígitos do nº CNES | (vazio) |
| Não utiliza TISS | (—) |
| Guias: Info Doença Obrigatório | NÃO |
| Qtd. Máx. de Procedimentos na guia | (vazio) |
| Qtd. dígitos do nº da Guia | 0 |
| Não mostra CID | NÃO |
| Grava CID na Indicação | NÃO |
| Grava Obs Itens na Indic. | (—) |
| Grava c/Cód. | (—) |
| Não usa padrão ANS Reapresentação | NÃO |
| Usa campo "C.R.M." do médico (completo) | SIM |
| Para sair na Observação: Descrição CID | NÃO |
| Só Consulta | NÃO |
| Mensagem | (vazio) |
| Imagem p/ Impressão de Guias | logotipo "Bradesco" associado (Incluído: MASTER, 11/03/2016 13:39:58) |

### 4.3 Aba "Outras Config. TISS"

**Sub-aba SP/SADT**
| Caixa / campo | Valor |
|---|---|
| Usa a guia como "Solicitação de Outras Despesas" (sem itens) p/ procedimentos cirúrgicos c/ Guias de Honorários | NÃO |
| Escreve o grau de participação somente se for procedimento cirúrgico | NÃO |
| Agrupa Procedimentos por Produto+Preço Unitário | NÃO |
| Guia de Procedimento Cirúrgico somente com os Totais de Procedimento e Geral | NÃO |
| Total pacote sairá somado ao "Total de Procedimento" e ñ em Honorários | NÃO |
| Não escreve tipo de consulta | (—) |
| Valor unitário de Pacote com valor 0 (zero) | NÃO |
| No médico executante usar sempre o CPF | (—) |
| Não escreve nos XMLs os grupos `<membroEquipe>` e `<equipeSadt>` | NÃO |
| Utiliza Guia de Honorário Médico se for Cirurgia | NÃO |
| Escreve Qt.Autoriz. = a Qt.Solic | NÃO |
| Não escreve os dados do profissional executante | NÃO |
| Ñ mostra Dt, Qtd e Vl.Tot. (p/Sessão) | NÃO |
| Ñ mostra Valor dos Procedimentos (p/ guias que não são de sessão) | NÃO |
| Só preenche a Guia Princ. se Peq.Cirurg. | NÃO |
| Não preenche a Guia Princ. | NÃO |
| Data da Emissão da Guia igual a data de solicitação | NÃO |
| Tipo Atendimento padrão | (vazio) |
| Sessão - Escreve o procedimento com a quantidade total e as linhas de "Data da Realização do Procedimentos em Série" | SIM |
| Consultas na guia SP/SADT | NÃO |
| Procedim. c/ categ. "Consulta" mas Tp.Atendimento <> de "Consulta" => guia SP/SADT | SIM |

**Sub-aba Hon/Outras Desp**
| Caixa / campo | Valor |
|---|---|
| Honorários: Somente p/ procedimentos Cirúrgicos | SIM |
| C/ o nome do Contratado como sendo o próprio médico | NÃO |
| Permite guias iguais (somará os totais como se fossem uma única guia) | NÃO |
| Produtos usados como pacote não sairão nas guias de honorários | NÃO |
| XML com Senha, data da senha e data de validade da Senha | NÃO |
| Permite guias de honorários com valor 0 | NÃO |
| Sempre utilizar o Código na Operadora para o Contratado e o Executante | (—) |
| No codigoPrestadorNaOperadora do XML colocar sempre o CNPJ ou CPF | (—) |
| Guia de Outras Despesas: Ñ agrupa produtos | NÃO |
| Filme como Mat. | NÃO |
| Se "qtde do produto" < 1, escrever no XML 1 | NÃO |
| Por Classificação de Item | NÃO |
| Por tipo de acomodação | NÃO |
| Unidade de conversão para as quantidades | SEM UNIDADE DE MEDIDA |

**Sub-aba Res.Intern.** (todas desmarcadas)
| Caixa | Valor |
|---|---|
| Sem Equipe na Guia de Resumo | NÃO |
| Qdo o Prç.Procedim.estiver 0, soma o "Total Materiais" ao "Total de Procedimento" | NÃO |
| Sem Equipe na Guia qdo Pacote de Produto | NÃO |
| Sem Guia de Honorários | NÃO |
| Equipe c/o código na operadora (mesmo que o convênio use CNPJ/CPF) | NÃO |
| Agrupa Proced. por Tp.Acomodação+Produto+Prç.Unit. | NÃO |
| Membro equipe desmembrado (repete o procedimento para cada membro da equipe) | NÃO |
| Total pacote sairá somado ao "Total de Procedimento" | NÃO |
| Equipe em nome dos próprios médicos | NÃO |
| Ñ soma ao "Total de Procedimento" o valor do médico principal | NÃO |
| Ñ soma ao "Total de Procedimento" o valor dos procedimentos | NÃO |
| Guia de Proced.Cirúrgico só com os Totais de Proced. e Geral | NÃO |

**Sub-aba 1º Geral**
| Caixa / campo | Valor |
|---|---|
| Usa Executante e Solicitante pelo cadastro de códigos nas operadoras dos médicos | SIM |
| Contratado Solicitante é o próprio Profissional Solicitante | NÃO |
| Cód.Operadora do Médico Executante = ao Cód.Contratado | NÃO |
| Cód. Operadora do Contratado (Solic e Exec) = ao do Médico | NÃO |
| Totais: Total geral somente na última página (p/ todas as guias) | NÃO |
| Total geral igual em todas as páginas | (—) |
| Total parcial nas páginas da guia de Outras Despesas | NÃO |
| Na quantidade aparecerá sempre 1 | NÃO |
| Mostra % Red./Acresc. nas guias e XML | SIM |
| O Valor Unitário da Guia deve ser o Original (sem o desconto sobre quantidade > que 1). Obs.: só p/ Proced. e Serviços | NÃO |
| Se a quantidade for maior que 1 e não tiver desconto sobre a quantidade > 1, o % Red./Acresc. será sempre 2 | NÃO |
| Se a quantidade for maior que 1 e não tiver desconto sobre a quantidade > 1, o % Red./Acresc. será sempre 1 | NÃO |
| Se a quantidade for maior que 1 e tiver % Red./Acresc, colocar a quantidade como 1 | NÃO |
| Se tem taxa de turno, mostra % s/ o desconto qnt >1 | NÃO |
| Acrescenta à "Hora Final" … min em cima da "Hora Inicial" | 0 |
| Guias SP/SADT e Resumo Internação: Utiliza pacote | NÃO |
| XML e Guias sem os procedimentos zerados | NÃO |
| Em branco se ñ tiver % Red./Acresc. | NÃO |
| Se ñ tiver Taxa de Turno e % Red./Acresc., o % será 0% se a quantidade for 1 e 1% se a quantidade for > que 1 | NÃO |

**Sub-aba 2º Geral**
| Caixa / campo | Valor |
|---|---|
| Usa o mesmo nº da senha p/a informação referente à "Guia Solicitação ou Guia Principal" ou o próprio nº da guia de solicitação | NÃO |
| Usa o mesmo nº da guia p/a guia principal | NÃO |
| Se data autorização em branco usa a data da conta | SIM |
| Validade da senha em branco permanece em branco na guia | NÃO |
| Guias: . Prestador=Guia . Operadora=Senha | NÃO |
| Usa a tag `<ans:cpf>` em maiúsculo - FORA do padrão da ANS | NÃO |
| Ñ coloca zero no código TISS p/ Produtos | NÃO |
| Qtd. digitos do Cód.TISS:: | 10 |
| Coloca zero no código TISS para Serviços (se o código estiver em branco) na Guia | NÃO |
| Guia operadora deve ir em branco no XML | NÃO |
| Guia operadora = Guia Prestador | NÃO |
| Campos não obrigatórios serão impressos com fundo cinza (abaixo da versão 3.00.00) | NÃO |
| HASH em minúsculo | NÃO |
| Coloca Ficha, CPF e Dt.Nascimento na Observação | NÃO |
| Não mostra os CIDs do atendimento nas guias de Consulta e Solicitação de Internação | NÃO |
| Se a qtde procedimento > 1, escrever uma linha p/ cada uma das quantidades - | NÃO |
| Mesmo se o % Red.Acrésc. igual a 0 | (—) |
| Informa nas guias e XMLs a hora início e a hora final dos procedimentos, materiais e medicamentos | NÃO |
| Se procedimento cirurgico a HORA INICIO será a HORA AGENDADA (e não a hora da chegada) | NÃO |
| Não escreve o grau de participação na Guia e XML (para procedimentos marcados como "Pacote") | NÃO |

**Sub-aba 3º Geral** (Guias SP/SADT e Honorário)
| Caixa | Valor |
|---|---|
| Utiliza uma única guia para toda a equipe | NÃO |
| Soma ao "Total de Procedimento" o valor do Staff (Faz c/ que Ñ repita o procedimento quando for um guia única de Staff) | NÃO |
| Não escreve a equipe na guia do médico principal | SIM |
| Não escreve nome de médico repetido na equipe da guia | NÃO |
| Se a quantidade for maior que 1 e tiver % Red./Acresc, dividir o % encontrado pela quantidade | NÃO |
| Se a quantidade for maior que 1, % Red./Acresc será sempre 1 | NÃO |
| % Red./Acresc. sempre 1 | (—) |
| O valor unitário nas guias de SADT honorários e de Honorários será o "Valor do Cirurgião" | NÃO |
| Escrever somente o profissional executante principal da guia | NÃO |
| Pacotes devem sair sem as informações referente ao médico executante (SADT e Resumo Internação) | NÃO |
| Se 1 linha p/ cada uma das quantidades dos produtos e a 1ª via de acesso for "Única", as próximas serão "Diversas" | (—) |
| Se não for mostrar o valor original de procedimentos e produtos, o % Red./Acresc. será 1 | (—) |
| Não mostra via de acesso nas guias e XML | (—) |
| Não inclui material e medicamentos no XML | (—) |
| Procedimento principal sempre em "Única Via" e demais procedimentos em "Mesma Via" | (—) |
| Se quantidade maior que 1 os procedimentos vão como "Mesma Via" | (—) |

**Sub-aba 4º Geral** (todas indeterminadas)
| Caixa | Valor |
|---|---|
| Se Staff Médico utilizar no valor original, o valor do procedimento | (—) |
| Layout XML no padrão 1 procedimento por cabeçalho de guia (separando tb as outras despesas) | (—) |
| Imprimir o código de barras do nº da guia | (—) |
| Se desmembra quantidade maior que 1, a linha da 2ª quantidade ficará com o % Red./Acresc zerado (procedimento cirúrgico) | (—) |
| Acrescenta no XML o C.Resp (Setor de Consumo) à descrição do material ou medicamento | (—) |
| Quando solicitante é contato externo o contratado solicitante é o prestador | (—) |
| Não imprime assinatura do médico | (—) |
| Observação da guia SP/SADT com cód. especial do proced. + CID + observações dos itens | (—) |
| Não envia nº da carteira do paciente | (—) |

### 4.4 Aba "Complementares"

**Configurações Gerais — Operadora (Convênio)**
| Campo | Valor |
|---|---|
| Razão social (descrição resumida) - (TISS / ABRANGE) | Bradesco Saude |
| Código na empresa de conectividade (TISS / ABRANGE) | (vazio) |
| Código | 2 |
| Código do registro na ANS (TISS) | 5711 |
| **Último lote de XML** | **1676** |

**Configurações Gerais — Prestadora (Clínica)**
| Campo | Valor |
|---|---|
| Pessoa (TISS / ABRANGE) | Jurídica (marcado); Física (não) |
| CNPJ ou CPF (TISS / ABRANGE) | 0589466000187 ⚠️ a tela mostra só 13 dígitos. O CNPJ da Consumed em outros cadastros é 05894660000187 (14 dígitos), então o campo pode estar cortado ou com um zero a menos. Copiei exatamente como aparece. |
| Nº CRO | (vazio) |
| Nome ou razão social do prestador (TISS / ABRANGE) | Consumed Consultorios Medicos Ltda |
| Código junto a operadora (TISS) | 0000110502 |
| Código CNES (TISS) | 3176479 |
| Emitente Associado | Consumed (23) |

**Configurações Abrange:** "Gera arquivos separados pelo 2º nível da categoria dos Proc/Prod/Serv (ABRANGE)" NÃO; Prefixo Identificador de numeração definido na implantação (ABRANGE) (vazio); grade Plano × "Código do plano para layout ABRANGE" vazia.

**Configurações SUS:** todos os campos estão vazios: Nome do órgão de origem responsável pela informação; Sigla ou código do órgão de origem responsável pela digitação; CGC do prestador ou do órgão público responsável pela informação; Nome do órgão de destino do arquivo; Código do emissor; Indicador do órgão destino (Estadual/Municipal, nenhum marcado); Versao Banco; Versao APAC; CNS do médico responsável; Versao BPA; Unidade do certificado; Versao AIH; Categoria dos Procedimentos para importação pelo arquivo TXT de Agenda.

**Web Service:** Ambiente = **Sem ambiente** (marcado). Homologação e Produção não estão marcados.

## 5. Planos

Os dois planos que aparecem na grade estão ativos. Nenhum plano inativo apareceu na lista do convênio 2.

| Item | Plano 4 – Bradesco Empresa | Plano 5 – Bradesco Individual |
|---|---|---|
| Ativo/inativo | Ativo (Inativo = NÃO) | Ativo (Inativo = NÃO) |
| Descrição | Bradesco Empresa | Bradesco Individual |
| Descr.TISS | (vazio) | (vazio) |
| Máscara da carteirinha | 999999999999999 (15 noves, contados na tela) | 999999999999999 (15 noves, contados na tela) |
| Telef / Contato | (vazio) / (vazio) | (vazio) / (vazio) |
| Acomodação (Apartamento/Enfermaria/Ambos) | nenhuma marcada | nenhuma marcada |
| Plano Padrão | SIM | SIM |
| Particular | NÃO | NÃO |
| Vê na Web | NÃO | NÃO |
| Pessoa Física | NÃO | NÃO |
| Associados | (—) | (—) |
| Particular PJ | (—) | (—) |
| Teleatendimento | (—) | (—) |
| Dígitos iniciais da matrícula | (vazio) | (vazio) |
| Validade obrigatória | no convênio: "Validade da matrícula obrigatória" (—); não há campo no plano | idem |
| Token | no convênio: "Utiliza token de paciente" (—); não há campo no plano | idem |
| **Tabelas (Código · Descrição · Valor CH · Prioridade · Categoria de Local)** | 31 Bradesco Cirurgia · 0,0000 · 20 · Sem Categoria de Local<br>4 Bradesco Empresa · 0,0000 · 20 · Sem Categoria de Local<br>20 Medicamentos · 0,0000 · 20 · Sem Categoria de Local | 31 Bradesco Cirurgia · 0,0000 · 20 · Sem Categoria de Local<br>3 Bradesco Individual · 0,0000 · 20 · Sem Categoria de Local<br>20 Medicamentos · 0,0000 · 20 · Sem Categoria de Local |
| Cash Adv: Pl. Financeiro / Portador / Empresa | Convênios / 9 Bradesco / 1 Consumed | Convênios / 9 Bradesco / 1 Consumed |
| Financeiro: Prazo Recebimento / Fechamento | (vazio) / (vazio) | (vazio) / (vazio) |
| Usar esse CH (+ valor) / Valor do Filme / Cód.Filme (TISS) / Custo Operacional | NÃO (vazio) / (vazio) / (vazio) / (vazio) | NÃO (vazio) / (vazio) / (vazio) / (vazio) |
| Ñ Multiplica | NÃO | NÃO |
| Tabela de Preço acordada para pacotes | (vazio) | (vazio) |
| Detalhes: Observação | (vazio) | (vazio) |
| Classificação | Sem Classificação | Sem Classificação |
| Permissões: Qtd dias p/ permitir o retorno / Qtd. atend. mês mesmo paciente / Qtd. atend. mês / Qtd. atend. dia | (vazio) / (vazio) / (vazio) / (vazio) | (vazio) / (vazio) / (vazio) / (vazio) |
| No agendamento obrigatório senha do supervisor | (—) | (—) |
| Impostos: Outras deduções % / ISS % / Valor mínimo de guia / IRRF % / Vl.mínimo p/impostos / CSLL % / PIS/PASEP % / COFINS % (2 caixas) | todos (vazio) | todos (vazio) |
| Descontos (Centro Cirúrg. 2º–5º; Agenda Exames mesma área e áreas diferentes 2º–5º) | todos (vazio) | todos (vazio) |
| Incluído / Atualizado | MASTER 04/03/2016 11:58 / Luciano 29/11/2019 10:38 | MASTER 04/03/2016 11:59 / Luciano 29/11/2019 10:38 |

Todas as tabelas têm a **mesma prioridade (20)**. Em nenhum lugar aparece uma ordem diferente entre elas.

## 6. Tabelas de preço usadas por esse convênio

**Caminho:** Cadastros ▸ Tabelas ▸ Produtos / Serviços ▸ Preços.
**Colunas da tela:** Ordem · TUSS/C.Esp · Produto/Serviço · Valor · Marca · CH · Franquia · CO · Filme · Anestes. · Necessita Autoriz. · Moeda · Cód. Proced. · Cód. Categ · Categoria · Cód.Brasíndice · Ult.Alteração.

**Como ler a tabela abaixo:**
- **Código interno** = coluna "Cód. Proced." (código do procedimento no Micrologos). **Código enviado na guia** = coluna "TUSS/C.Esp".
- **Ordem, Franquia, CO, Filme, Moeda e Cód.Brasíndice** estão vazios em **todos** os itens das 4 tabelas. A Marca é "SEM MARCA" em todos.
- **Necessita autorização:** a tela mostra **1** (= SIM) ou **0** (= NÃO).
- **Valor:** copiado como aparece, com 3 casas decimais.
- **Tabela TISS (22, 98, 00…):** NÃO VISTO. Essa coluna não existe na tela de preços. Veja a seção 11.
- **Últ. alteração:** a tela corta os segundos, então anotei só data, hora e minuto.
- Os nomes completos dos procedimentos foram lidos alargando a coluna Produto/Serviço na tela. Isso é só visual: a largura foi devolvida ao normal e nenhum dado foi alterado.

### Tabela 31 – Bradesco Cirurgia (Dt.Ref. 26/02/2015) – 25 itens
Usada pelos planos 4 e 5.

| Código interno | Procedimento | Código enviado na guia (TUSS/C.Esp) | Tabela TISS | Valor | CH/fator | Necessita autorização | Observação |
|---|---|---|---|---|---|---|---|
| 87 | Autotransplante Conjuntival | 30303010 | NÃO VISTO | 223,180 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:00 |
| 204 | Cirurgia Antiglaucomatosa Via Angular Com Implante de Stent | 30310172 | NÃO VISTO | 827,840 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração vazia |
| 114 | Cirurgia Com Sutura Ajustavel | 30311020 | NÃO VISTO | 626,480 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 03/06/2026 15:06 |
| 112 | Cirurgias Fistulizantes Antiglaucomatosas | 30310032 | NÃO VISTO | 757,490 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:00 |
| 113 | Cirurgias Fistulizantes Com Implantes Valvulares | 30310040 | NÃO VISTO | 865,850 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:01 |
| 206 | Delaminacao Corneana Com Fotoablacao Estromal - Lasik | 30304105 | NÃO VISTO | 786,040 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração vazia |
| 43 | Endolaser/ Endodiatermia | 30307031 | NÃO VISTO | 337,940 | (vazio) | SIM | Categoria 0103 Cirurgia; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:01 |
| 54 | Epilação de Cílios | 30301122 | NÃO VISTO | 55,390 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:36 |
| 107 | Estrabismo Ciclo Vertical/transposicao Monocular | 30311039 | NÃO VISTO | 740,190 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 03/06/2026 15:06 |
| 108 | Estrabismo Horizontal Monocular | 30311047 | NÃO VISTO | 714,480 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 03/06/2026 15:06 |
| 19 | Facectomia Com Implante de Lio | 30306027 | NÃO VISTO | 1.191,270 | (vazio) | SIM | Categoria 0103 Cirurgia; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:01 |
| 205 | Fotoablacao de Superficie Convencional - Prk | 30304091 | NÃO VISTO | 555,350 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 03/06/2026 17:18 |
| 127 | Goniotomia Ou Trabeculotomia | 30310075 | NÃO VISTO | 874,310 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:16 |
| 44 | Implante de Silicone Intravitreo | 30307040 | NÃO VISTO | 542,200 | (vazio) | SIM | Categoria 0103 Cirurgia; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:03 |
| 49 | Implante Secundario/explante/fixacao Escleral Ou Iriana | 30306060 | NÃO VISTO | 699,820 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:02 |
| 121 | Infusao de Gas Expansor | 30312051 | NÃO VISTO | 254,640 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração vazia |
| 45 | Infusão de Perfluocarbono | 30307058 | NÃO VISTO | 337,940 | (vazio) | SIM | Categoria 0103 Cirurgia; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:03 |
| 80 | Membranectomia Epi Ou Sub- Retiniana | 30307066 | NÃO VISTO | 699,820 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:03 |
| 68 | Palpebra- Reconstruçao Parcial Com Ou Sem Resseccao de Tumor | 30301165 | NÃO VISTO | 297,110 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 09/03/2023 11:51 |
| 46 | Pterigio-exerese | 30303060 | NÃO VISTO | 217,660 | 280 | SIM | Categoria 0103 Cirurgia; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:36 |
| 69 | Resseccao de Tumores Palpebrais | 30301190 | NÃO VISTO | 200,540 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:31 |
| 42 | Retinopexia Com Introflexão Escleral | 30312086 | NÃO VISTO | 970,370 | (vazio) | SIM | Categoria 0103 Cirurgia; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:10 |
| 120 | Troca Fluido Gasosa | 30307090 | NÃO VISTO | 320,370 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração vazia |
| 50 | Vitrectomia Anterior | 30307112 | NÃO VISTO | 998,250 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração 05/03/2026 12:11 |
| 41 | Vitrectomia Vias Pars Plana | 30307120 | NÃO VISTO | 1.150,360 | (vazio) | SIM | Categoria 0103 Cirurgia; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:12 |

### Tabela 4 – Bradesco Empresa (Dt.Ref. 26/02/2016) – 29 itens
Usada pelo plano 4 Bradesco Empresa.

| Código interno | Procedimento | Código enviado na guia (TUSS/C.Esp) | Tabela TISS | Valor | CH/fator | Necessita autorização | Observação |
|---|---|---|---|---|---|---|---|
| 12 | Angiografia | 41301013 | NÃO VISTO | 81,640 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:04 |
| 115 | Avaliação de Vias Lacrimais ( Teste de Schirmer ) Monocular | 41301170 | NÃO VISTO | 31,720 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:04 |
| 223 | Avaliacao Orbito-palpebral-exoftalmometria - Binocular | 41301030 | NÃO VISTO | 23,820 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração vazia |
| 3 | Biometria | 41501012 | NÃO VISTO | 59,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:05 |
| 15 | Campo Visual Computadorizado | 40103137 | NÃO VISTO | 31,720 | 0 | NÃO | Categoria 010201 Campo Visual; Marca SEM MARCA; Últ. alteração 09/03/2023 11:06 |
| 24 | Capsulotomia Yag Ou Cirurgica | 30306019 | NÃO VISTO | 343,650 | 0 | NÃO | Categoria 01 Procedimentos; Marca SEM MARCA; Últ. alteração 05/03/2026 12:50 |
| 6 | Ceratoscopia Corneana | 41301080 | NÃO VISTO | 99,170 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:07 |
| 1 | Consulta | 10101012 | NÃO VISTO | 135,440 | 0 | NÃO | Categoria 0101 Consulta; Marca SEM MARCA; Últ. alteração 13/02/2026 12:51 |
| 27 | Consulta Em Consultorio | 10101012 | NÃO VISTO | 135,440 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 13/02/2026 12:51 |
| 22 | Corpo Estranho da Cornea - Retirada | 30304032 | NÃO VISTO | 57,150 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 10:46 |
| 25 | Curva Tensional Diaria-binocular | 41301129 | NÃO VISTO | 49,580 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:08 |
| 13 | Ecobiometria | 41501012 | NÃO VISTO | 59,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:09 |
| 54 | Epilação de Cílios | 30301122 | NÃO VISTO | 54,570 | 0 | NÃO | Categoria 0103 Cirurgia; Marca SEM MARCA; Últ. alteração vazia |
| 100 | Exame de Motilidade Ocular (teste Ortoptico)- Binocular | 41301200 | NÃO VISTO | 23,970 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:09 |
| 201 | Exercicios de Ortoptica Por Sessao | 20103239 | NÃO VISTO | 11,650 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 23/09/2026 12:35 |
| 17 | Fotocoagulação A Laser | 30312043 | NÃO VISTO | 343,650 | 0 | NÃO | Categoria 01 Procedimentos; Marca SEM MARCA; Últ. alteração 05/03/2026 10:01 |
| 48 | Fotocoagulação A Laser Ao | 30312043 | NÃO VISTO | 343,650 | 0 | NÃO | Categoria 01 Procedimentos; Marca SEM MARCA; Últ. alteração 05/03/2026 10:01 |
| 10 | Gonioscopia | 41301242 | NÃO VISTO | 49,580 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:10 |
| 33 | Iridotomia (yag Laser) | 30310083 | NÃO VISTO | 337,940 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 05/03/2026 12:51 |
| 5 | Mapeamento de Retina | 41301250 | NÃO VISTO | 27,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:11 |
| 7 | Microscopia Especular | 41301269 | NÃO VISTO | 138,870 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:11 |
| 4 | Paquimetria Ultrassonica | 41501128 | NÃO VISTO | 59,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:12 |
| 20 | Potencial de Acuidade Visual | 41301307 | NÃO VISTO | 19,820 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:12 |
| 11 | Retinografia | 41301315 | NÃO VISTO | 23,310 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:12 |
| 125 | Sondagem das Vias Lacrimais - Com Ou Sem Lavagem | 30313066 | NÃO VISTO | 85,410 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 05/03/2026 12:52 |
| 23 | Teste do Reflexo Vermelho | 41301471 | NÃO VISTO | 28,880 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:13 |
| 61 | Tomografia de Coerencia Optica Monocular | 41501144 | NÃO VISTO | 77,840 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 06/01/2026 11:37 |
| 2 | Tonometria | 41301323 | NÃO VISTO | 13,740 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:13 |
| 36 | Ultrassonografia Bilateral | 40901017 | NÃO VISTO | 156,390 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:14 |

### Tabela 3 – Bradesco Individual (Dt.Ref. 26/02/2016) – 25 itens
Usada pelo plano 5 Bradesco Individual. Em relação à tabela 4, não tem Avaliação de Vias Lacrimais, Epilação de Cílios, Fotocoagulação A Laser Ao nem Sondagem das Vias Lacrimais. O Corpo Estranho custa 64,040 (na tabela 4 é 57,150). A coluna Anestes. mostra 0,00 na maioria dos itens.

| Código interno | Procedimento | Código enviado na guia (TUSS/C.Esp) | Tabela TISS | Valor | CH/fator | Necessita autorização | Observação |
|---|---|---|---|---|---|---|---|
| 12 | Angiografia | 41301013 | NÃO VISTO | 81,640 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:29 |
| 223 | Avaliacao Orbito-palpebral-exoftalmometria - Binocular | 41301030 | NÃO VISTO | 23,820 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração vazia |
| 3 | Biometria | 41501012 | NÃO VISTO | 59,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:29 |
| 15 | Campo Visual Computadorizado | 40103137 | NÃO VISTO | 31,720 | 0 | NÃO | Categoria 010201 Campo Visual; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:30 |
| 24 | Capsulotomia Yag Ou Cirurgica | 30306019 | NÃO VISTO | 343,650 | 0 | NÃO | Categoria 01 Procedimentos; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:52 |
| 6 | Ceratoscopia Corneana | 41301080 | NÃO VISTO | 99,170 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:30 |
| 1 | Consulta | 10101012 | NÃO VISTO | 135,440 | 0 | NÃO | Categoria 0101 Consulta; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 13/02/2026 12:51 |
| 27 | Consulta Em Consultorio | 10101012 | NÃO VISTO | 135,440 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 13/02/2026 12:51 |
| 22 | Corpo Estranho da Cornea - Retirada | 30304032 | NÃO VISTO | 64,040 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:40 |
| 25 | Curva Tensional Diaria-binocular | 41301129 | NÃO VISTO | 49,580 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:31 |
| 13 | Ecobiometria | 41501012 | NÃO VISTO | 59,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:31 |
| 100 | Exame de Motilidade Ocular (teste Ortoptico)- Binocular | 41301200 | NÃO VISTO | 23,970 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração 09/03/2023 11:32 |
| 201 | Exercicios de Ortoptica Por Sessao | 20103239 | NÃO VISTO | 11,650 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Últ. alteração vazia |
| 17 | Fotocoagulação A Laser | 30312043 | NÃO VISTO | 343,650 | 0 | NÃO | Categoria 01 Procedimentos; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 10:02 |
| 10 | Gonioscopia | 41301242 | NÃO VISTO | 49,580 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:32 |
| 33 | Iridotomia (yag Laser) | 30310083 | NÃO VISTO | 337,940 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 05/03/2026 12:53 |
| 5 | Mapeamento de Retina | 41301250 | NÃO VISTO | 27,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:32 |
| 7 | Microscopia Especular | 41301269 | NÃO VISTO | 138,870 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:33 |
| 4 | Paquimetria Ultrassonica | 41501128 | NÃO VISTO | 59,500 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:33 |
| 20 | Potencial de Acuidade Visual | 41301307 | NÃO VISTO | 19,820 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:33 |
| 11 | Retinografia | 41301315 | NÃO VISTO | 23,310 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:33 |
| 23 | Teste do Reflexo Vermelho | 41301471 | NÃO VISTO | 28,880 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:34 |
| 61 | Tomografia de Coerencia Optica Monocular | 41501144 | NÃO VISTO | 77,840 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 06/01/2026 11:37 |
| 2 | Tonometria | 41301323 | NÃO VISTO | 13,740 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:34 |
| 36 | Ultrassonografia Bilateral | 40901017 | NÃO VISTO | 156,390 | 0 | NÃO | Categoria 0102 Exames; Marca SEM MARCA; Anestes. 0,00; Últ. alteração 09/03/2023 11:34 |

### Tabela 20 – Medicamentos (Dt.Ref. 23/04/2015) – 5 itens
Usada pelos planos 4 e 5. Atenção: esta tabela tem nome genérico e pode ser usada também por outros convênios. Os códigos 9xxxxxxx parecem ser de medicamentos (Brasíndice/TISS 20), mas a coluna Tabela TISS não aparece na tela.

| Código interno | Procedimento | Código enviado na guia (TUSS/C.Esp) | Tabela TISS | Valor | CH/fator | Necessita autorização | Observação |
|---|---|---|---|---|---|---|---|
| 29 | Colirio Anestalcon | 90005767 | NÃO VISTO | 6,820 | 0 | NÃO | Categoria 0202 Medicamentos; Marca SEM MARCA; Últ. alteração 16/08/2016 22:57 |
| 28 | Colirio Fenilefrina | 90006585 | NÃO VISTO | 7,640 | 0 | NÃO | Categoria 0202 Medicamentos; Marca SEM MARCA; Últ. alteração 16/08/2016 23:02 |
| 30 | Colirio Fluoresceina | 90548906 | NÃO VISTO | 6,460 | 0 | NÃO | Categoria 0202 Medicamentos; Marca SEM MARCA; Últ. alteração 16/08/2016 23:03 |
| 31 | Colirio Mydriacyl | 90006020 | NÃO VISTO | 10,830 | 0 | NÃO | Categoria 0202 Medicamentos; Marca SEM MARCA; Últ. alteração 16/08/2016 23:03 |
| 32 | Colirio Visonest | 90007085 | NÃO VISTO | 7,050 | 0 | NÃO | Categoria 0202 Medicamentos; Marca SEM MARCA; Últ. alteração 16/08/2016 23:04 |

## 7. Kits e pacotes
- **Nenhuma das 4 tabelas do Bradesco tem item de pacote.** Não há código 98xxxxxx nem item com "Pacote" no nome. Em todos os planos, "Tabela de Preço acordada para pacotes" está (vazio).
- **Composição de Kit** (Cadastros ▸ Procedimentos ▸ aba Composição de Kit), conferida nas facectomias:
  - 19 Facectomia Com Implante de Lio: há só 1 kit, "76 Lente Intra Ocular", e ele é do plano **Golden Cross** (Unidade Est./Fin. "Unidade", Qt.Fin 1, Vincula "Não"). **Não há kit para os planos Bradesco.**
  - 77 Facectomia (Material) e 79 Facectomia Sem Implante de Lio: grade de kit vazia.
- No convênio: "Valor unitário de Pacote com valor 0" NÃO; "Total pacote sairá somado ao Total de Procedimento e ñ em Honorários" NÃO; "Utiliza pacote" (1º Geral) NÃO; "Produtos usados como pacote não sairão nas guias de honorários" NÃO.
- Os outros 190 procedimentos não foram abertos um a um para ver o kit (seção 11).

## 8. Regras de fator de redução/acréscimo e via de acesso
**O que está no cadastro do convênio 2:**
- 1º Geral: "Mostra % Red./Acresc. nas guias e XML" **SIM**. As regras de quantidade > 1 (será sempre 2 / sempre 1 / colocar quantidade 1 / valor unitário original) estão todas NÃO. "Em branco se ñ tiver % Red./Acresc." NÃO.
- 2º Geral: "Se a qtde procedimento > 1, escrever uma linha p/ cada uma das quantidades" NÃO; "Mesmo se o % Red.Acrésc. igual a 0" (—).
- 3º Geral: "Se a quantidade for maior que 1 e tiver % Red./Acresc, dividir o % encontrado pela quantidade" NÃO; "Se a quantidade for maior que 1, % Red./Acresc será sempre 1" NÃO; "% Red./Acresc. sempre 1" (—); "Se não for mostrar o valor original…, o % Red./Acresc. será 1" (—).
- **Via de acesso** (3º Geral), todas (—): "Se 1 linha p/ cada uma das quantidades dos produtos e a 1ª via de acesso for 'Única', as próximas serão 'Diversas'"; "Não mostra via de acesso nas guias e XML"; "Procedimento principal sempre em 'Única Via' e demais procedimentos em 'Mesma Via'"; "Se quantidade maior que 1 os procedimentos vão como 'Mesma Via'".
- 4º Geral: "Se desmembra quantidade maior que 1, a linha da 2ª quantidade ficará com o % Red./Acresc zerado (procedimento cirúrgico)" (—).
- Descontos de 2º a 5º procedimento: ver a seção 2.3 (cirurgia 70/50/50/50, com "% sempre em cima do maior valor" = SIM).

**No procedimento** (19 Facectomia Com Implante de Lio, aba Detalhamento): "Membros" = OD quantidade 1 e OE quantidade 1. Não há "AO". Tipo Atendimento "Pequena Cirurgia"; Classificação de Item "Honorários"; Cirúrgico SIM; Cid Obrigatório SIM; Comissão Médicos SIM; Solicitação Obrigatória (—); Executante Obrigatório (—); Vacina (—); Fatura para Médico que Indicou SIM.

**Não existe na tela** um campo do tipo "fator 2,00 para ambos os olhos". O fator 2,00 que o Bradesco recebe na facectomia e nos exames binoculares foi visto **nos XML** em 22/11 (arquivo D2) e não num campo de cadastro. Pelas caixas acima, parece vir da quantidade/membros do atendimento. Isso **não foi confirmado na tela**.

## 9. Médicos nesse convênio
Fonte: Cadastros ▸ Staff Médico ▸ Detalhamento ▸ Inf. TISS (grade de códigos por convênio). Revisei os 20 cadastros ativos. **CPF omitido.**

**Só 3 médicos têm uma linha "Bradesco Saúde" na grade, e nos 3 o código está VAZIO:**

| Cód. | Médico | CRM (lista) / Nº no Conselho / UF | Conselho | CBO | Linha "Bradesco Saúde" na grade de Inf. TISS | CNES no cadastro do médico |
|---|---|---|---|---|---|---|
| 22 | Matheus de Souza Cerveira Pereira | 521277375 / 5201277375 / RJ | CONSELHO REGIONAL DE MEDICINA | Especialidade "Oftalmo Geral". O CBO não aparece no cadastro do médico; no cadastro de Especialidades (mapeamento de 22/11), Oftalmo Geral = 2252.65 | Plano "Sem Convênio" · Unidade (vazio) · Cód. Operadora Prof.Exec **(vazio)** · Nome Prof.Exec "Matheus de Souza Cerveira Pe…" (cortado) · Cód.Solic (vazio) · Nome Solic (vazio) | 3176479 |
| 19 | Pedro Boni Goncalves | 52866989 / 866989 / RJ | CONSELHO REGIONAL DE MEDICINA | Oftalmo Geral (2252.65 pelo cadastro de Especialidades) | Sem Convênio · (vazio) · **(vazio)** · "Pedro Boni Goncalves" · (vazio) · (vazio) | 9999999 |
| 15 | Renato Sztern Queiroz | 52927430 / 927430 / RJ | CONSELHO REGIONAL DE MEDICINA | Oftalmo Geral (2252.65 pelo cadastro de Especialidades) | Sem Convênio · (vazio) · **(vazio)** · "Renato Sztern Queiroz" · (vazio) · (vazio) | 9999999 |

⚠️ A divergência entre CRM 521277375 (lista) e Nº no Conselho 5201277375 (Inf. TISS) do Matheus está exatamente assim na tela.

**Médicos ativos SEM linha Bradesco Saúde** (para referência):

| Cód. | Médico | CRM (lista) / Nº Conselho / UF | Especialidade (CBO) |
|---|---|---|---|
| 27 | Annamaria Ciminelli Barbosa | 52947300 / 947300 / RJ | não conferida |
| 24 | Antonio Carlos de Souza Ferreira | 52788066 / 788066 / RJ | não conferida |
| 1 | Gelson Moura Brasil | 52863602 / 863602 / RJ | não conferida |
| 3 | Gisele Moura Brasil | 52873799 / 873799 / RJ | não conferida |
| 4 | Luiza Morone Pereira | 52917753 / 917753 / RJ | não conferida |
| 5 | Marcos Aurelio Costa Leal Arnaut | 52937118 / 937118 / RJ | não conferida |
| 2 | Max Oliveira Guimarães | 52863866 / 863866 / RJ | Oftalmo Geral e Oftalmo Catarata (2252.65) |
| 8 | Luciano Campino Pinto (Instrumentador) | 192354 / 192354 / RJ, CONSELHO REGIONAL DE ENFERMAGEM | não conferida |
| 25 | Medico Transcrição Rio de Janeiro | 41231 / 41231 / RJ | não conferida |
| 26 | Prestador Nao Identificado Migracao | 99880 / 99880 / RJ | não conferida |
| 6 | Eveline (Campo Visual) | — / 123 / RJ | não conferida |

Os cadastros 12 Centro Cirurgico, 23 Consumed Olhos, 31 Contatólogo, 9 Fernanda, 28 Orientação Cirurgica e 20 Ortóptica são agendas, sem CRM e sem linha Bradesco.

**Para o sistema novo:** como o código do médico no Bradesco está vazio em todos, as guias do Bradesco saem pelo **código da clínica (0000110502)**, que é o que se viu nos XML em 22/11. O campo "Usa Executante e Solicitante pelo cadastro de códigos nas operadoras dos médicos" está SIM, mas não há código cadastrado.

## 10. Hospitais/locais nesse convênio
Fonte: Cadastros ▸ Unidades ▸ Detalhamento ▸ Informações TISS ("Informações TISS utilizadas para honorários médicos – Contratado aonde foi executado o serviço, Casos de cirurgia externa"). Revisei as 14 unidades. **6 unidades têm código no Bradesco Saúde:**

| Cód. | Unidade | CNPJ da empresa | CNES | Código no Bradesco Saúde | Também tem código no Bradesco Operadora? |
|---|---|---|---|---|---|
| 10 | Pro Oftalmo Micro Cirurgia Ocular S/c Ltda | NÃO VISTO | 5325722 | 193216 | sim, 193216 |
| 7 | Hospital Oftalmologico da Barra | NÃO VISTO | 7544227 | 427810 | sim, 427810 |
| 13 | Rio Vision Hospital Ltda | NÃO VISTO | 4708490 | 54409 | sim, 54409 |
| 2 | Largo do Machado | NÃO VISTO | 3135268 | 684724 | sim, 684724 |
| 5 | Hospital Daniel Lipp Ltda | NÃO VISTO | 3014673 | 195510 | não |
| 6 | Day Clinic Meier | NÃO VISTO | 5136989 | 203114 | não |

- A coluna "Código CNES" da grade (CNES por convênio) está **vazia** nas 6 linhas do Bradesco.
- **CNPJ:** não aparece na tela da Unidade. Ele deve estar no cadastro do **Emitente** ligado a cada unidade, que não foi aberto. Os códigos de emitente que aparecem na tela estão cortados (ex.: 15181…, 9182…, 25068…, 179…, 2846…, 9181…).
- A unidade **1 Consumed Consultórios Médicos Ltda** (a clínica, CNES 3176479) **não tem linha Bradesco**. Para o Bradesco, a clínica usa o código 0000110502 e o CNES 3176479 da aba Complementares do convênio.
- Sem código Bradesco: 3 Barra Day, 11 Clínica e Cirurgia de Olhos Dr. […], 12 Consumed, 1 Consumed Consultórios Médicos, 4 Jardim de Alah, 14 Oftalmo Rio, 15 Unimed Regional Fluminense, 9 UTI Rio.

## 11. O que não foi visto ou ficou em dúvida
1. **CNPJ da operadora Bradesco:** NÃO VISTO. Não há esse campo no convênio; ele deve estar no cadastro financeiro do Emitente "Bradesco Saúde" (cód. 4), que não foi aberto.
2. **Endereço, telefone e site da operadora:** NÃO VISTO. Não existem campos para isso no cadastro do convênio.
3. **CNPJ da clínica na aba Complementares:** aparece como "0589466000187" (13 dígitos). O CNPJ da Consumed é 05894660000187 (14 dígitos), então o campo pode estar cortado ou errado. ⚠️ Vale conferir clicando no campo, no próprio Micrologos, se o Bradesco recusar.
4. **xml version / encoding:** a caixa mostra "…encoding="ISO-8859-" cortado. Provavelmente é ISO-8859-1, que é o que aparece nos XML, mas não foi visto inteiro.
5. **Tabela TISS (22, 98, 00…) de cada item:** NÃO VISTO. A tela de preços não tem essa coluna. Nos XML lidos em 22/11, os procedimentos do Bradesco saíram com codigoTabela **22**; os colírios provavelmente vão como medicamento (20), mas isso não foi confirmado.
6. **Máscara da carteirinha:** contei 15 noves numa imagem pequena. Vale conferir, porque pode ser 14 ou 16.
7. **CNPJ das unidades/hospitais:** NÃO VISTO (fica no cadastro do Emitente de cada unidade).
8. **CBO de cada médico:** não existe campo de CBO no cadastro do médico; vem da Especialidade. Conferi só Matheus, Pedro, Renato e Max (todos Oftalmo Geral = 2252.65). Os demais não foram conferidos porque não têm linha Bradesco.
9. **Kits/pacotes:** conferi só as facectomias (19, 77, 79). Os outros procedimentos não foram abertos um a um para ver se têm kit para planos Bradesco.
10. **Fator 2,00 ("ambos os olhos"):** não existe campo de cadastro com esse nome. A origem (quantidade/membros do atendimento) é uma dedução e não foi confirmada na tela.
11. **Planos inativos:** a grade de planos mostra só os planos 4 e 5. Não há filtro de ativos/inativos para planos, então presumo que não existam planos inativos no convênio 2.
12. **Horário de "Atualizado"** do convênio: aparece cortado (09/09/2026 14:1?).
13. **Relatório "Listar"** e botões "Faz Gráfico" / "Lista Gráfico" não foram acionados, por segurança.
14. **Nenhuma alteração foi feita.** O único ajuste foi visual: alarguei e devolvi a largura da coluna Produto/Serviço na tela de preços. Também maximizei e restaurei as janelas e, na busca de tabelas, o texto "Medicamentos" foi digitado uma vez colado a "Bradesco". Isso foi corrigido no campo de busca, que não é salvo.
