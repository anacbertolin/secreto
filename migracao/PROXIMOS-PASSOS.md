# Migração Micrologos: estado atual e próximos passos

> **Para a próxima sessão do Claude:** leia este arquivo primeiro, depois `README.md` (roteiro técnico)
> e `GUIA-PASSO-A-PASSO.md` (o que a dona faz). A dona **não é técnica**: fale em português simples.
> Última atualização: 14/11/2026, sessão "Dados para migração".

## Onde está o trabalho
| O quê | Onde |
|---|---|
| Esta preparação (staging, ferramenta, guias) | branch **`claude/beautiful-meitner-8eu6jk`**, pasta `migracao/` + `supabase/migrations/0100_migracao_staging.sql` |
| Mapeamento do Micrologos (106 entidades, plano de migração) | branch `claude/stoic-johnson-8ky6di`, pasta `docs/micrologos/` |
| Sistema (app) e migrações 0005–0008 | branch `claude/trusting-tesla-e5u50x` (sessão "Desenvolvimento do sistema", `session_01RxZddnY3mA77HY8MtevrQ7`) |
| Banco | Supabase "secreto" `ogflxjolbwrzayjtxvhj` (sa-east-1) |

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
- **Empresa no Micrologos:** Consumed Consultórios Médicos Ltda, CNPJ 05.894.660/0001-87, CNES 3176479 (❓ confirmar se é o do Hospital de Olhos da Baixada). Há 14 "unidades", que são hospitais parceiros, com código na operadora e CNES por convênio.
- Os requisitos do sistema (TISS, pós-envio, PEP) foram enviados à sessão de desenvolvimento em 22/11/2026.

## 🔀 Levar este trabalho para o `main`
- A sessão de desenvolvimento avisou em 14/11/2026 que a dona definiu o `main` como versão oficial: toda mudança entra por PR.
- O PR [anacbertolin/secreto#2](https://github.com/anacbertolin/secreto/pull/2) leva o sistema para o `main`.
- Em 22/11/2026 a branch foi atualizada com o `main`; o conflito no CLAUDE.md foi resolvido mantendo as duas seções. **Pendente, com confirmação da dona:** abrir o PR desta branch para o `main`.

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
