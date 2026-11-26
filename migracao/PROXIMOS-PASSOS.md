# Migração Micrologos: estado atual e próximos passos

> **Para a próxima sessão do Claude:** leia este arquivo primeiro, depois `README.md` (roteiro técnico)
> e `GUIA-PASSO-A-PASSO.md` (o que a dona faz). A dona **não é técnica**: fale em português simples.
> Última atualização: 14/11/2026, sessão "Dados para migração".

## ⚠️ Aviso da sessão da Agenda (26/11/2026): Unimed provisória já está no banco
- A pedido da dona (a Alessandra precisava marcar cirurgias da Unimed), a migração `0176_convenios_unimed_provisorio`
  criou **só o nome** de 6 convênios, com o MESMO código do Micrologos e `tiss = {"provisorio": true}`:
  Unimed Gelson (8), Gisele (10), Luciano (15), Max (22), Consumed Cirurgia (26), Antonio (29).
- `transformacoes/02_convenios.sql` foi ajustado: o insert agora **completa** quem tem `tiss ? 'provisorio'`
  (on conflict (micrologos_codigo) do update), mantendo o nome. Planos e preços entram normalmente pelo código.
- Agendamentos feitos com esses convênios antes da carga ficam **sem plano**. Conferir/ligar o plano depois da carga.

## Onde está o trabalho
| O quê | Onde |
|---|---|
| Esta preparação (staging, ferramenta, guias) | branch **`claude/beautiful-meitner-8eu6jk`**, pasta `migracao/` + `supabase/migrations/0100_migracao_staging.sql` |
| Mapeamento do Micrologos (106 entidades, plano de migração) | branch `claude/stoic-johnson-8ky6di`, pasta `docs/micrologos/` |
| Sistema (app) e migrações 0005–0008 | branch `claude/trusting-tesla-e5u50x` (sessão "Desenvolvimento do sistema", `session_01RxZddnY3mA77HY8MtevrQ7`) |
| Banco | Supabase "secreto" `ogflxjolbwrzayjtxvhj` (sa-east-1) |

## 🧪 Ensaio local da migração (a partir de 25/11/2026)
- **Ensaio local:** Postgres 16 + Supabase simulado (`migracao/local/`) com todas as migrações do repositório.
- **Cópia do Firebird:** `migracao/firebird/copiar_para_postgres.py` leva as 171 tabelas com dados do MLMASTER para
  `legacy_micrologos.bruto_*`, com as contagens conferidas. Ficou de fora PACIENTES_LOG (2,5 milhões de linhas de auditoria).
- **Pacientes** (`migracao/transformacoes/01_pacientes.sql`), testado no ensaio:
  - 117.240 migrados (excluídos os testes 69489 e 108477 e o registro 0);
  - 74.529 com CPF, 114.836 com telefone, 111.263 com nascimento;
  - nº do prontuário = ID_PACIENTE;
  - **153 CPFs repetidos:** o CPF ficou no cadastro mais recente; os outros têm observação e uma ocorrência `cpf_repetido`.
- **A confirmar com a dona:**
  - telefones sem DDD recebem o DDD 21;
  - o nº do prontuário usado no dia a dia é o "código" (ID) do Micrologos;
  - o que fazer com os 153 CPFs repetidos.
- **Convênios** (`migracao/transformacoes/02_convenios.sql`), testado no ensaio:
  - 31 convênios (22 ativos), 384 planos, 223 procedimentos, 13.905 preços, 47 códigos de hospital;
  - os particulares ficam de fora (particular = sem convênio);
  - **conferência com a tela do Bradesco: 113 de 113 iguais**, só a Epilação no plano Empresa diverge (pergunta à dona em aberto);
  - a cópia do Firebird nunca leva senhas, tokens nem dados bancários (lista no script).
- **Profissionais** (`03_profissionais.sql`), testado no ensaio:
  - os 8 médicos atuais e o Luciano foram LIGADOS aos cadastros do sistema novo (pelo CRM ou pelo nome); o Pedro tem 2 códigos no Micrologos;
  - 9 médicos antigos entram como inativos, sem login;
  - ❓ **Agendas de recurso:** Centro Cirúrgico, Ortóptica, Orientação Cirúrgica, Contatólogo, Eveline/Campo Visual e Sem Médico aguardam a decisão da dona.
  - ❓ **Eveline (pedido da dona, 26/11):** descobrir no Micrologos onde ficam os registros da Eveline (tecnóloga de campo visual e
    ortóptica): se escreve no prontuário ou numa aba própria. No sistema novo ela é "Enfermagem / Técnico(a)" (cadastro
    Eveline Isabel Alves dos Santos), diferente das colunas de agenda "Eveline (Campo Visual)" e "Ortóptica".
- **Agenda** (`04_agenda.sql`), testada no ensaio: **387.732 de 387.736** agendamentos (os 4 restantes são dos pacientes de teste).
  - Resultado: 307.742 atendidos, 62.059 faltas, 17.075 cancelados, 856 futuros e 12.950 encaixes.
  - Os setores vão para as colunas da 0152 e a Orientação vai para a coluna da Alessandra.
  - A migração 0153 permite encaixe (e histórico atendido) no mesmo horário.
  - ❓ Confirmar com a dona o significado das letras de status (A, O, X, C, E, M, D, P, 1, 2, 5).
- **Prontuários** (`05_prontuarios.sql` + `migracao/firebird/converter_rtf.py`), testados no ensaio, vão para `prontuario_legado`:
  - **250.835 atendimentos**, com o texto da consulta convertido de RTF, campos de ficha preenchidos, CID, medicamentos e indicação TISS;
  - **356.158 documentos**: 81 mil óculos, 75 mil receitas, 56 mil pedidos de exame, 22 mil atestados, 12 mil laudos e 60 mil outros;
  - **49.768 referências de imagem**: os arquivos ficam no servidor da clínica (❓ pasta a combinar com o técnico);
  - a tabela `legacy_micrologos.textos_convertidos` precisa existir no Supabase na carga real (criar por migração).
- **Usuários** (SECURITY.FDB, 72), pedido da dona em 25/11 via outra sessão: cadastrar em `profissionais` os funcionários ATIVOS do Micrologos, com `usuario` no formato nome.sobrenome (como `sugerirUsuario` em app/src/lib/util.ts). Ela depois cria a senha na tela Equipe. **Conferir a lista com ela antes de gravar.** O Dr. Antonio Carlos continua na Agenda e no Faturamento (médico sem login).
- **Próximos:** convênios e planos direto do banco (CONVENIOS_MESTRE/CONVENIOS/PRECOS_PRODUTOS…), profissionais, agenda,
  atendimentos (PEP) e contas.
- **Canal para a carga no Supabase:** ainda falta. A dona não conseguiu criar a chave secreta; os links assinados servem
  para baixar, não para gravar. Opções: tentar a chave de novo com ajuda do Claude do computador, ou carregar por lotes
  via conector MCP (lento para milhões de linhas).

## 🗄️ Cópia completa do banco do Micrologos RECEBIDA (25/11/2026)
- O técnico (Marcio) copiou o banco **Firebird 5** para `\\192.168.10.114\BdGelson`. A dona enviou os arquivos direto para
  o Storage `migracao-micrologos/banco-2026-11-25/`: MLMASTER.FDB 2,4 GB (principal), SECURITY.FDB 1 GB (usuários e log de acesso)
  e MLCORREIO.FDB 13 MB.
- A integridade foi conferida: tamanhos exatos, SHA-256 registrado e `gfix` sem erros. Inventário de tabelas e linhas em
  `migracao/INVENTARIO-BANCO-2026-11-25.md`.
- Destaques: 117 mil pacientes, 388 mil agendamentos, 251 mil atendimentos (PEP), 333 mil contas, 411 mil itens faturados,
  37 convênios / 398 planos, 65 tabelas de preço com 1.139 itens e 118 códigos de médicos nas operadoras.
- **Para abrir numa sessão nova:**
  1. baixar do Storage (link assinado gerado pela dona no painel, ou chave secreta);
  2. `dockerd &`;
  3. `docker run -d --name fb5 -e FIREBIRD_ROOT_PASSWORD=... -v <pasta>:/dados firebirdsql/firebird:5.0.3`;
  4. `isql -user SYSDBA`.
  Os dados ficam fora do repositório (`/home/user/dados-micrologos`).
- Consequência: convênios, planos, preços e códigos podem vir **direto do banco**, sem copiar tela por tela. A cópia diária de
  convênios pela tela vira só **conferência**.

## 🗺️ Mapeamento das telas do Micrologos (22/11/2026)
- Feito pela dona com o Claude Desktop, só leitura e sem dados de pacientes: `docs/micrologos/mapeamento-telas/MAPEAMENTO-COMPLETO-2026-11-22.md`. Comece pela Parte 1 (RESUMÃO).
- Versão do Micrologos: **ML Clinic Master ASP 13.13.30.00**. É um programa Windows, no computador DESKTOP-MCDT7V5.
- **Não existe "exportar para Excel/CSV" nas telas.** As opções são Relatórios ▸ Planilhas, XML TISS e **Ferramentas ▸ Backup (banco de dados)**.
  - ➜ Descobrir (só olhando, sem executar) se o banco é **local**: um SQL Server no próprio computador ou num servidor da clínica. Se for, o backup completo pode vir de lá, sem depender da Micrologos. Perguntar à dona/TI antes de rodar qualquer backup.
- **Pacientes de teste a EXCLUIR da migração:** "Teste" (cód. 69489) e "Teste Micrologos" (cód. 108477). A conta de teste é a 270743.
- **XML TISS históricos:** ficam em `C:\<convênio>\` nesse computador. Servem para comparar com os XML do sistema novo (1 lote de cada tipo, anonimizado e enviado por canal seguro).
- **Convênios:**
  - 14 ativos por XML.
  - A Unimed é faturada **por médico** (cada cooperado é um "convênio"), mais a Unimed Consumed Cirurgia (PJ 1474).
  - Sem XML: Cedae, Cisbaf e Siass-Geap.
  - Inativos, a não migrar como ativos: Appai, Assist, Assim, Golden Cross, Notre Dame, Dort Prev e Medprev.
- **Tabelas de preço:**
  - 66 tabelas e 193 procedimentos.
  - "Necessita autorização" é marcado por procedimento em cada tabela.
  - O código enviado na guia pode mudar por tabela (ex.: Klini 98901012).
  - Os valores de todas as tabelas estão na parte B2 do mapeamento, útil para conferir a carga.
- **Empresa no Micrologos:** Consumed Consultórios Médicos Ltda, CNPJ 05.894.660/0001-87, CNES 3176479 (✅ confirmado pela dona em 22/11: é a empresa atual). Há 14 "unidades", que são hospitais parceiros, com código na operadora e CNES por convênio.
- Os requisitos do sistema (TISS, pós-envio, PEP) foram enviados à sessão de desenvolvimento em 22/11/2026.

## 🔀 Levar este trabalho para o `main`
- A sessão de desenvolvimento avisou em 14/11/2026 que a dona definiu o `main` como versão oficial: toda mudança entra por PR.
- O PR [anacbertolin/secreto#2](https://github.com/anacbertolin/secreto/pull/2) leva o sistema para o `main`.
- Em 22/11/2026 a branch foi atualizada com o `main`; o conflito no CLAUDE.md foi resolvido mantendo as duas seções. Levado ao `main` em 22/11/2026 pelo PR anacbertolin/secreto#61 (autorizado pela dona). Próximas mudanças: novo PR para o `main`.

## ✅ Já feito
1. **Banco (migração `migracao_staging`, aplicada):**
   - Schema privado `legacy_micrologos` com as tabelas `cargas`, `mapa_ids` (de-para legacy_id → uuid), `ocorrencias` e `fusoes_pacientes`.
   - Tabelas `bruto_*`, criadas sob demanda.
   - Funções de limpeza: `txt`, `cpf`, `cns`, `telefone`, `cep`, `uf`, `email`, `data`, `data_hora`, `valor`, `sexo`, `status_agenda`, `canal_status_agenda`, `novo_id`.
   - RPCs `public.migracao_iniciar_carga`, `migracao_carregar_lote` e `migracao_concluir_carga`, só para o service_role.
   - Bucket privado `migracao-micrologos`.
   - Testado de ponta a ponta com dados fictícios (já apagados). Os advisors estão ok: só o aviso INFO "RLS sem policy" no schema privado, que é intencional.
2. **Ferramenta `migracao/micrologos.py`:** comandos `inspecionar` (relatório sem dados pessoais), `baixar` (do Storage), `carregar` (via API, em lotes, idempotente) e `gerar-sql` (plano B pelo conector).
3. **Modelo de transformação** `transformacoes/01_pacientes.sql`: ocorrências → duplicados por CPF → de-para → inserção com `overriding system value` → `setval` → conferência. As colunas marcadas `-- AJUSTAR` são palpites.
4. **Rede:** o host `ogflxjolbwrzayjtxvhj.supabase.co` está liberado no ambiente "secreto". Não há acesso TCP ao Postgres.
5. **Sessão de desenvolvimento aplicou a migração 0008:**
   - Tabelas `prontuario_legado`, `paciente_documentos` (bucket `documentos`, 50 MB) e `convenio_planos`, mais `plano_id`.
   - Coluna `pacientes.prontuario_anterior`.
   - `profissionais.email` aceita nulo quando o profissional está inativo.
   - A auditoria fica desligada com `set local app.migracao = 'on'`.
   - Detalhes em `README.md`.

## 🧭 Decisões da dona
| Data | Decisão |
|---|---|
| 14/11/2026 | Manter o **mesmo número de prontuário** do Micrologos (opção B). |
| 25/11/2026 | **Pacientes:** telefone sem DDD recebe 21 (aprovado). **Mesmo CPF + mesmo nome = mesma pessoa: juntar** (fica o nº mais antigo, contato do cadastro mais recente, histórico de todos em ordem cronológica); mesmo CPF com nomes diferentes não junta. No ensaio: 46 juntados, 107 mantidos separados. |
| 25/11/2026 | **Cópias do banco:** a cópia de 24/11 é só para os testes. No dia da virada, o técnico faz uma **cópia final completa** com o Micrologos parado, e a carga definitiva usa essa cópia inteira (não só os últimos dias). Depois da virada, apagar as cópias de teste (avisando a dona) e **guardar a cópia final para sempre** no Storage privado (prontuário: 20 anos, Lei 13.787/2018). Os arquivos baixados na sessão são apagados ao fim dos testes. |
| 22/11/2026 | **Empresa atual:** Consumed Consultórios Médicos Ltda, CNPJ 05.894.660/0001-87, CNES 3176479. Esse é o prestador em todos os XML e guias. "Hospital de Olhos da Baixada" é só uma ideia de nome fantasia para o futuro (previsto para 2027); não usar como prestador. |

## ⏳ Aguardando a dona
- Pedido formal à Micrologos do **banco completo + dicionário de dados + anexos** (modelo no guia).
- Exportar o que der pelas telas, em CSV/Excel, e enviar no Storage `migracao-micrologos` (pasta com a data) ou anexar na conversa.

## ▶️ Quando os arquivos chegarem (roteiro)
1. **Chave:** pedir a chave secreta do Supabase com `request_credential`:
   - host `ogflxjolbwrzayjtxvhj.supabase.co`, cabeçalho `apikey`, sem prefixo;
   - se for uma chave JWT antiga, pode precisar também de `Authorization: Bearer`.
2. **Baixar:** `python3 migracao/micrologos.py baixar /home/user/dados-micrologos --prefixo <pasta>/`. Os dados ficam sempre **fora do repositório**.
3. **Inventário:** `inspecionar … --saida <scratchpad>/relatorio_inspecao.md`. Mostrar à dona em linguagem simples.
4. **Banco completo (.bak, .fdb…):** restaurar num container (ver `README.md`). O Docker precisa de `dockerd &`.
5. **Carga crua:** `carregar … --amostra 200` → conferir → carga completa.
6. **Transformações:** ajustar as colunas `-- AJUSTAR` e escrever as demais, nesta ordem:
   - profissionais (antigos como inativos) → convênios/planos → locais → pacientes;
   - agenda (já com os horários históricos; `agendamento_id` é único por atendimento);
   - PEP histórico → `prontuario_legado`;
   - laudos e anexos → bucket `documentos` + `paciente_documentos` (origem `micrologos`, sha256).
   Cada transformação roda dentro de uma transação com `set local app.migracao = 'on'`.
7. **Conferência:** contagens e relatório para a dona (seção 4 de `docs/micrologos/04-migracao-de-dados.md`). Depois, `get_advisors` (security e performance).
8. **Alterações no sistema:** se faltar algo, pedir à sessão de desenvolvimento com `send_message`.

## ⚠️ Pendências e cuidados
- **Paciente nº 3** no banco, criado em 14/11 às 14:54 pela conta da dona (teste?). Pode colidir com a numeração do Micrologos. **Pedir confirmação à dona antes de apagar** (antes da carga final).
- Não commitar nenhum dado de paciente (o `.gitignore` em `migracao/` ajuda, mas confira).
- Gatilhos do sistema que afetam a carga: `tg_bloquear_se_finalizado` (inserir os itens antes de finalizar o atendimento), `horarios_status` e `somente_equipe`.
- Confirmar no ensaio se o status "Esp. Pend." do Micrologos significa mesmo "agendado".

## Logins da equipe vinda do Micrologos (25/11/2026)
- Migração 0161 criou as pessoas ativas no Micrologos (acesso nos últimos 6 meses) na tela Equipe, com usuário
  nome.sobrenome e função inicial **recepção** (a dona confere a função e gera as senhas).
- Migração 0162 (resposta da dona): saíram Ana Beatriz Carrilho, Beatriz Tomaz e Caroline Aparecida (não trabalham mais);
  entraram Marcio (TI), Darlene e Rafael (senha só se precisar). Alessandra Moura de Oliveira = Alessandra Galter (já existia).
  Nicole, Marise, Juliana do Valle, Kalini e Emilly não trabalham mais: nada criado.
- Não criados (já existiam): Ana Bertolin, Andrea, Gelson, Gisele, Ingrid, Isabelle, Luana, Luciano, Luiza, Matheus, Max,
  Pedro, Renato, Soraline. Dr. Marcos (saiu). Contas genéricas (Mlmaster, Mlsuporte, Sam Call Center).

## Contas de faturamento (decisão da dona, 25–26/11/2026)
- **Decisão:** trazer TODAS as contas desde 2016. De 2021 em diante = contas normais (mexer em cobrança, recurso, XML de novo);
  2016–2020 = **arquivadas** (só consulta e relatórios; faturamento/admin podem desarquivar). Migração 0163.
- Transformação `migracao/transformacoes/06_faturamento.sql` (desfazer no ensaio: `06_faturamento_desfazer.sql`).
  - PACIENTES_CONTA → contas; FATURAMENTOS → conta_itens (valor do Micrologos é UNITÁRIO; total = valor × quantidade);
    FATURAMENTOS_STAFF_MEDICO → 1 item "Primeiro Auxiliar/Instrumentador — procedimento" no nome da pessoa;
    COBRANCAS → lotes (nº do lote = nº da cobrança; a numeração nova continua depois da última).
  - Nº da guia no prestador = PLANO_GUIA do Micrologos (repetidos/vazios: "ML" + nº da conta; o original fica em legado).
    Guias novas pulam números já usados (função interno.proximo_numero_guia).
  - O Micrologos **não registra quando o convênio pagou**. Regra (❓ confirmar com a dona): cobrança fechada há mais de
    6 meses = paga (presumido); últimos 6 meses = "Enviada" (aguardando pagamento); sem cobrança nos últimos 6 meses =
    "Em conferência"; particular = paga. legado.pagamento = 'presumido' marca as presumidas.
  - Ensaio local (26/11): 333.157 contas (2 sem paciente ficaram fora), 410.631 itens, 10,4 mil lotes. Totais por ano
    batem com o Micrologos (diferença de centavos de arredondamento). 2026: 4,3 mil em conferência, 11,5 mil aguardando pagamento.
- Relatório novo (migração 0164 `rel_faturamento` + aba Faturamento → Produção): por médico / convênio / tipo / procedimento,
  com comparação (mesmo período do ano anterior ou mês anterior), planilha e impressão. Substitui "Atendimentos por Médico",
  "Faturamento por Médico" e "Valores resumidos por plano" do Micrologos.
- ❓ Perguntas abertas para a dona:
  - Unimed Gisele / Unimed Gelson: muitas contas sem cobrança no Micrologos (cobradas por fora?). Hoje entram como pagas (presumido).
  - Cirurgias: no Micrologos o item da cirurgia fica na coluna "Centro Cirúrgico", sem o nome do cirurgião. Como o Luciano
    separa a produção de cirurgia por médico? (honorários de auxiliar/instrumentador já saem no nome de cada um)
  - Pedir ao Luciano 2 ou 3 relatórios do Micrologos (PDF) de um mês fechado para conferir o novo relatório número a número.
  - Guia de honorário individual (tipo 06, 1.835 contas) entra como SP/SADT; o tipo original fica em legado.

## Plano combinado com a dona para o XML (26/11/2026)
1. Terminar de copiar tudo do Micrologos: convênios, planos, preços (já no ensaio), **códigos dos médicos por convênio**
   (MEDICOS_OPERADORAS → profissional_convenio_codigos), hospitais e a **Guia de Honorários** (cirurgias).
2. Depois, testes convênio por convênio: Claude pede "baixe no Micrologos o XML do convênio X", a dona manda,
   Claude compara com o XML do sistema novo e corrige. Nada de XML de teste antes disso.
3. Nas telas, "lote" passou a se chamar **cobrança** (como no Micrologos). Para criar: Faturamento → Contas →
   filtro "Pronta p/ cobrança" → marcar as guias de um convênio → "Iniciar cobrança". Em produção ainda não há contas
   (elas entram na troca), por isso a dona não conseguiu criar.
- 26/11: Guia de Honorários pronta (0168) e códigos dos médicos por convênio (0167 + `07_codigos_medicos.sql`, rodar
  depois do 03). Contas antigas tipo 06 viram "honorarios" com hospital, guia de solicitação e grau (00/01/05).
- **Testes de XML (próximo passo):** as cobranças antigas já estão no ensaio local. Para comparar com o Micrologos:
  `psql -v cob=<nº da cobrança> -At -f migracao/xml/dados_cobranca.sql > /tmp/c.json` e
  `cd app && npx -y tsx@4.19.2 scripts/tiss/gerar_de_json.ts /tmp/c.json <nº do lote no XML> /tmp/xml` (os arquivos têm
  dados de pacientes: só na máquina de ensaio). A dona baixa no Micrologos o XML da MESMA cobrança e Claude compara.
  Já testado (sem conferir com o Micrologos ainda): Bradesco cobranças 11378 (honorários), 11379 (consultas),
  11380 (SP/SADT) → XSD e hash ok; honorários com Pro Oftalmo 193216 / CNES 5325722, como no XML real (D2).
- 26/11 (tarde): comparação com 3 XML reais do Bradesco (11378/11379/11380). Regras aplicadas — ver
  `docs/sistema/tiss-gerador.md` ("Comparação com XML reais"). Migração 0169: `profissional_dados_tiss` (nome na guia e
  CPF do médico, preenchidos pelo 03), `conta_itens.fator` e `conta_itens.numero_guia` (guia própria do auxiliar).
  ❓ Falta tela para cadastrar nome-na-guia/CPF de médico NOVO (hoje só vem do Micrologos) e para editar o fator do item.
- 26/11 (noite): 2ª rodada de XML (Amil, Unimed Consumed Cirurgia, Geap, Hapvida) — as 9 cobranças testadas ficaram
  iguais ao Micrologos (ver `docs/sistema/tiss-gerador.md`). A carga 06 passou a trazer também os produtos da conta
  (PRODUTOS_MOVIMENTACAO). Migração 0172 (ordem dos itens do Bradesco). Próximos convênios a testar: Assim, Klini,
  Golden Cross, Mediservice, Porto Seguro, Unimed Gisele/Gelson, Fundação Itaú, Notre Dame, Assist, Bradesco Operadora.
