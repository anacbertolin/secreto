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
