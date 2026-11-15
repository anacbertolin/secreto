// Extrator do WhatsApp: lê as conversas paradas, agenda o que foi combinado,
// avalia o atendimento e monta a base de conhecimento do futuro robô.
//
// Quem chama (POST, corpo JSON com "acao"):
//   * o agendador do banco (pg_cron), a cada 10 min, com o cabeçalho x-extrator-chave → { acao: "rodar" }
//   * a tela "Assistente do WhatsApp" (recepção/admin logados):
//       estado              → está ligado? a chave da IA existe? quantas conversas na fila?
//       rodar               → (só admin) analisa agora as conversas paradas
//       analisar            → { conversa_id } analisa já o trecho novo de uma conversa
//
// Segredo necessário (Supabase → Edge Functions → Secrets): ANTHROPIC_API_KEY
// Sem ele a função não faz nada (responde que falta configurar).
//
// O que vai para a IA: o texto das mensagens com CPF, e-mails, telefones e números longos
// trocados por [CPF]/[número]; o primeiro nome do paciente; listas de médicos, convênios e
// horários. Nada é guardado pela IA para treino (API comercial).
import Anthropic from "npm:@anthropic-ai/sdk@1.7.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { ESQUEMA, Resultado, SISTEMA } from "./prompt.ts";
import {
  encaixeNoHorario, FUSO, horaLocalParaData, medirTempos, mesmoNome, normalizarNome, telefoneCadastro, transcrever,
  type HorarioMedico, type Mensagem,
} from "./logica.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

// deno-lint-ignore no-explicit-any
type Json = any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const POR_RODADA = 6;          // conversas por chamada
const SIMULTANEAS = 2;         // conversas analisadas ao mesmo tempo
const PRAZO_MS = 300_000;      // não começa conversa nova depois de 5 min (limite da função: 400 s)
const MAX_NOVAS = 150;         // mensagens novas por análise (o resto fica para a próxima)
const CONTEXTO = 12;           // mensagens anteriores enviadas como contexto

interface Config {
  ligado: boolean;
  agendar_automatico: boolean;
  criar_paciente_automatico: boolean;
  confianca_minima: number;
  silencio_minutos: number;
  modelo: string;
  usar_horario_padrao: boolean;
  padrao_dias: number[];
  padrao_inicio: string;
  padrao_fim: string;
  padrao_duracao_min: number;
}

const MODELOS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"];
const modeloDe = (cfg: Config) => (MODELOS.includes(cfg.modelo) ? cfg.modelo : "claude-sonnet-5-5");

/** Horário padrão da clínica (para o médico sem horário próprio cadastrado) */
function horarioPadrao(cfg: Config): HorarioMedico[] {
  if (!cfg.usar_horario_padrao) return [];
  return (cfg.padrao_dias ?? []).map((d) => ({
    dia_semana: d, hora_inicio: cfg.padrao_inicio, hora_fim: cfg.padrao_fim,
    duracao_min: cfg.padrao_duracao_min || 15, local_id: null, vigente_de: null, vigente_ate: null,
  }));
}

interface Referencias {
  medicos: { id: string; nome: string; especialidade: string | null }[];
  convenios: { id: string; nome: string }[];
  horarios: Map<string, HorarioMedico[]>;
  conhecidas: { id: string; categoria: string; pergunta: string }[];
  textoFixo: string;
}

const fmtAgora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const fmtDiaHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const primeiroNome = (n: string | null | undefined) => {
  const p = (n ?? "").trim().split(/\s+/)[0] ?? "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

// =====================================================================
// Servidor
// =====================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let corpo: Json;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Dados inválidos" }, 400);
  }

  // Quem está chamando: o agendador (chave interna) ou alguém da equipe logado
  let funcao: string | null = null;
  const chave = req.headers.get("x-extrator-chave");
  if (chave) {
    const { data: ok } = await db.rpc("whatsapp_extrator_chave_ok", { p_chave: chave });
    if (ok !== true) return resposta({ erro: "Chave inválida" }, 401);
    funcao = "agendador";
  } else {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: eu } = await db.auth.getUser(jwt);
    if (eu || !u?.user?.email) return resposta({ erro: "Sessão inválida. Entre novamente." }, 401);
    const { data: p } = await db.from("profissionais").select("funcao, ativo")
      .eq("email", u.user.email.toLowerCase()).maybeSingle();
    if (!p?.ativo || !["recepcao", "admin"].includes(p.funcao)) {
      return resposta({ erro: "Só a recepção e a administração usam o assistente do WhatsApp." }, 403);
    }
    funcao = p.funcao;
  }

  const { data: cfg, error: ec } = await db.from("whatsapp_extrator_config").select("*").eq("id", 1).single();
  if (ec || !cfg) return resposta({ erro: "Configuração do assistente não encontrada." }, 500);
  const temChave = !!Deno.env.get("ANTHROPIC_API_KEY");

  if (corpo.acao === "estado") {
    const [{ count: fila }, { count: comErro }] = await Promise.all([
      db.from("whatsapp_extrator_estado").select("conversa_id", { count: "exact", head: true }).not("em_processo_desde", "is", null),
      db.from("whatsapp_extrator_estado").select("conversa_id", { count: "exact", head: true }).gt("tentativas", 0),
    ]);
    return resposta({ ia_configurada: temChave, ligado: cfg.ligado, em_processo: fila ?? 0, com_erro: comErro ?? 0 });
  }

  if (!temChave) {
    return resposta({ erro: "Falta a chave da IA (ANTHROPIC_API_KEY) nos segredos do Supabase." }, 503);
  }

  if (corpo.acao === "rodar") {
    if (funcao !== "agendador" && funcao !== "admin") return resposta({ erro: "Só a administração pode fazer isso." }, 403);
    if (!cfg.ligado) return resposta({ ok: true, ligado: false, mensagem: "O assistente está desligado." });
    const trabalho = processarLote(db, cfg as Config).catch((e) => console.error("lote", e));
    EdgeRuntime.waitUntil(trabalho);
    return resposta({ ok: true, mensagem: "Análise iniciada. Os resultados aparecem em alguns minutos." }, 202);
  }

  if (corpo.acao === "analisar") {
    const conversa = String(corpo.conversa_id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(conversa)) return resposta({ erro: "Conversa inválida" }, 400);
    const { data: pegas, error } = await db.rpc("whatsapp_extrator_pegar", { p_limite: 1, p_silencio: 0, p_conversa: conversa });
    if (error) return resposta({ erro: error.message }, 500);
    if (!pegas?.length) return resposta({ erro: "Esta conversa já está sendo analisada. Tente daqui a pouco." }, 409);
    const refs = await carregarReferencias(db, cfg as Config);
    const r = await processarConversa(db, cliente(), cfg as Config, refs, pegas[0].conversa_id, pegas[0].analisado_ate);
    return resposta(r);
  }

  return resposta({ erro: "Ação desconhecida" }, 400);
});

function cliente() {
  return new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY"), timeout: 180_000, maxRetries: 2 });
}

// =====================================================================
// Lote: várias conversas paradas
// =====================================================================
async function processarLote(db: SupabaseClient, cfg: Config) {
  const inicio = Date.now();
  const { data: pegas, error } = await db.rpc("whatsapp_extrator_pegar", {
    p_limite: POR_RODADA, p_silencio: cfg.silencio_minutos, p_conversa: null,
  });
  if (error) throw error;
  if (!pegas?.length) return;
  const refs = await carregarReferencias(db, cfg);
  const ia = cliente();
  const fila = [...pegas] as { conversa_id: string; analisado_ate: string | null }[];
  let parar = false;

  async function trabalhador() {
    while (fila.length && !parar) {
      const item = fila.shift()!;
      if (Date.now() - inicio > PRAZO_MS) {
        await liberar(db, item.conversa_id); // fica para a próxima rodada
        continue;
      }
      const r = await processarConversa(db, ia, cfg, refs, item.conversa_id, item.analisado_ate);
      if (r.limite) parar = true; // limite de uso da IA: para e tenta na próxima rodada
    }
  }
  await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhador));
  for (const item of fila) await liberar(db, item.conversa_id);
}

async function liberar(db: SupabaseClient, conversa: string) {
  await db.from("whatsapp_extrator_estado").update({ em_processo_desde: null }).eq("conversa_id", conversa);
}

// =====================================================================
// Dados da clínica usados em todas as análises
// =====================================================================
async function carregarReferencias(db: SupabaseClient, cfg: Config): Promise<Referencias> {
  const [med, conv, hor, conh] = await Promise.all([
    db.from("profissionais").select("id, nome, especialidade").eq("ativo", true).eq("funcao", "medico").order("nome"),
    db.from("convenios").select("id, nome").eq("ativo", true).order("nome"),
    db.from("horarios_profissional")
      .select("profissional_id, dia_semana, hora_inicio, hora_fim, duracao_min, local_id, vigente_de, vigente_ate")
      .eq("ativo", true).order("dia_semana").order("hora_inicio"),
    db.from("bot_conhecimento").select("id, categoria, pergunta").neq("situacao", "descartada")
      .order("vezes", { ascending: false }).limit(300),
  ]);
  for (const r of [med, conv, hor, conh]) if (r.error) throw r.error;

  const horarios = new Map<string, HorarioMedico[]>();
  for (const h of hor.data ?? []) {
    const l = horarios.get(h.profissional_id) ?? [];
    l.push(h as HorarioMedico);
    horarios.set(h.profissional_id, l);
  }
  const medicos = med.data ?? [];
  const convenios = conv.data ?? [];
  const conhecidas = conh.data ?? [];

  const faixas = (l: HorarioMedico[]) =>
    l.map((h) => `${DIAS[h.dia_semana]} ${h.hora_inicio.slice(0, 5)}–${h.hora_fim.slice(0, 5)}`).join(", ");
  const padrao = faixas(horarioPadrao(cfg));
  const linhasMedicos = medicos.map((m) => {
    const proprio = faixas(horarios.get(m.id) ?? []);
    const hs = proprio || (padrao ? `${padrao} (horário padrão da clínica)` : "horários não cadastrados");
    return `- id ${m.id} | ${m.nome}${m.especialidade ? ` (${m.especialidade})` : ""} | atende: ${hs}`;
  });
  const textoFixo = [
    "# Dados de referência da clínica",
    "## Médicos",
    linhasMedicos.join("\n") || "(nenhum médico ativo cadastrado)",
    "## Convênios aceitos",
    convenios.map((c) => `- id ${c.id} | ${c.nome}`).join("\n") || "(nenhum convênio cadastrado; particular)",
    "## Perguntas já conhecidas na base do robô",
    conhecidas.map((c) => `- id ${c.id} | ${c.categoria} | ${c.pergunta}`).join("\n") || "(nenhuma ainda)",
  ].join("\n");

  return { medicos, convenios, horarios, conhecidas, textoFixo };
}

// =====================================================================
// Uma conversa
// =====================================================================
interface ResultadoConversa {
  ok: boolean;
  conversa_id: string;
  mensagem?: string;
  erro?: string;
  limite?: boolean;
  analise_id?: string;
  agendados?: number;
  pendentes?: number;
}

async function processarConversa(
  db: SupabaseClient, ia: Anthropic, cfg: Config, refs: Referencias, conversaId: string, analisadoAte: string | null,
): Promise<ResultadoConversa> {
  try {
    // Mensagens novas e um pouco de contexto
    let q = db.from("whatsapp_mensagens")
      .select("id, direcao, tipo, texto, modelo, midia_nome, enviado_por, quando")
      .eq("conversa_id", conversaId).order("quando").limit(MAX_NOVAS);
    if (analisadoAte) q = q.gt("quando", analisadoAte);
    const { data: novasD, error: en } = await q;
    if (en) throw en;
    const novas = (novasD ?? []) as Mensagem[];
    if (!novas.length) {
      await concluir(db, conversaId, analisadoAte);
      return { ok: true, conversa_id: conversaId, mensagem: "Nada novo nesta conversa desde a última análise." };
    }
    const ate = novas[novas.length - 1].quando;
    if (!novas.some((m) => m.direcao === "recebida")) {
      await concluir(db, conversaId, ate);
      return { ok: true, conversa_id: conversaId, mensagem: "Só mensagens da clínica; nada para analisar." };
    }
    let contexto: Mensagem[] = [];
    if (analisadoAte) {
      const { data } = await db.from("whatsapp_mensagens")
        .select("id, direcao, tipo, texto, modelo, midia_nome, enviado_por, quando")
        .eq("conversa_id", conversaId).lte("quando", analisadoAte).order("quando", { ascending: false }).limit(CONTEXTO);
      contexto = ((data ?? []) as Mensagem[]).reverse();
    }

    // Conversa, paciente e agendamentos do número
    const { data: conversa, error: ecv } = await db.from("whatsapp_conversas")
      .select("id, telefone, nome_contato, paciente_id").eq("id", conversaId).single();
    if (ecv) throw ecv;
    const { data: doNumero } = await db.rpc("whatsapp_extrator_pacientes_do_numero", { p_telefone: conversa.telefone });
    const pacientesNumero = (doNumero ?? []) as Json[];
    const ligado = conversa.paciente_id ? pacientesNumero.find((p) => p.id === conversa.paciente_id) ?? null : null;
    const idsNumero = [...new Set([conversa.paciente_id, ...pacientesNumero.map((p) => p.id)].filter(Boolean))];
    let futuros: Json[] = [];
    if (idsNumero.length) {
      const { data } = await db.from("agendamentos")
        .select("id, paciente_id, inicio, tipo, status, profissional_id, pacientes(nome)")
        .in("paciente_id", idsNumero).gte("inicio", new Date(Date.now() - 86400000).toISOString())
        .not("status", "in", "(cancelado,faltou)").order("inicio").limit(20);
      futuros = data ?? [];
    }

    // Atendentes viram "Atendente 1, 2…" (a IA não precisa do nome)
    const apelidos = new Map<string, string>();
    for (const m of [...contexto, ...novas]) {
      if (m.enviado_por && !apelidos.has(m.enviado_por)) apelidos.set(m.enviado_por, `Atendente ${apelidos.size + 1}`);
    }

    const nomeMedico = (id: string) => refs.medicos.find((m) => m.id === id)?.nome ?? "outro profissional";
    const textoVariavel = [
      `Agora: ${fmtAgora.format(new Date())} (horário de Brasília).`,
      "## Esta conversa",
      `- Paciente ligado ao número: ${ligado ? primeiroNome(ligado.nome_social || ligado.nome) : "nenhum (pode ser paciente novo)"}`,
      `- Pacientes cadastrados com este número: ${pacientesNumero.length}`,
      "## Agendamentos futuros de pacientes deste número",
      futuros.map((a) =>
        `- id ${a.id} | ${fmtDiaHora.format(new Date(a.inicio))} | ${nomeMedico(a.profissional_id)} | ${a.tipo} | ${a.status} | paciente: ${primeiroNome(a.pacientes?.nome)}`
      ).join("\n") || "(nenhum)",
      "## Contexto (já analisado antes; só para entender)",
      contexto.length ? transcrever(contexto, apelidos) : "(início da conversa)",
      "## MENSAGENS NOVAS (analise estas)",
      transcrever(novas, apelidos),
    ].join("\n");

    // ---------- IA ----------
    let resp;
    try {
      resp = await ia.beta.messages.create({
        model: modeloDe(cfg),
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
        system: SISTEMA,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: refs.textoFixo, cache_control: { type: "ephemeral" } },
            { type: "text", text: textoVariavel },
          ],
        }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) {
        await liberar(db, conversaId);
        return { ok: false, conversa_id: conversaId, limite: true, erro: "Limite de uso da IA atingido; tenta de novo na próxima rodada." };
      }
      if (e instanceof Anthropic.AuthenticationError) throw new Error("A chave da IA (ANTHROPIC_API_KEY) é inválida.");
      if (e instanceof Anthropic.APIError) throw new Error(`IA respondeu erro ${e.status}: ${e.message}`);
      throw e;
    }
    if (resp.stop_reason === "refusal") throw new Error("A IA se recusou a analisar esta conversa.");
    if (resp.stop_reason === "max_tokens") throw new Error("A resposta da IA ficou grande demais.");
    const texto = resp.content.map((b: Json) => (b.type === "text" ? b.text : "")).join("");
    let bruto: unknown;
    try {
      bruto = JSON.parse(texto);
    } catch {
      throw new Error("A IA devolveu um formato inesperado.");
    }
    const val = Resultado.safeParse(bruto);
    if (!val.success) throw new Error("A IA devolveu dados incompletos: " + val.error.issues[0]?.message);
    const r = val.data;

    // ---------- Grava a análise ----------
    const { data: analise, error: ea } = await db.from("whatsapp_analises").insert({
      conversa_id: conversaId,
      paciente_id: conversa.paciente_id,
      de: novas[0].quando,
      ate,
      mensagens: novas.length,
      intencao_principal: r.intencao_principal,
      intencoes: [...new Set(r.intencoes)],
      resumo: r.resumo,
      bot_resolveria: r.bot.resolveria,
      bot_motivo: r.bot.motivo,
      modelo: resp.model,
      tokens_entrada: (resp.usage.input_tokens ?? 0) + (resp.usage.cache_read_input_tokens ?? 0) +
        (resp.usage.cache_creation_input_tokens ?? 0),
      tokens_saida: resp.usage.output_tokens,
      resultado: r,
    }).select("id").single();
    if (ea) throw ea;

    // Qualidade
    const tempos = medirTempos(novas);
    if (r.qualidade.avaliavel || tempos.sem_resposta) {
      const q = r.qualidade;
      const { error } = await db.from("whatsapp_avaliacoes").insert({
        analise_id: analise.id,
        conversa_id: conversaId,
        atendentes: [...apelidos.keys()].filter((id) => novas.some((m) => m.enviado_por === id)),
        ...tempos,
        nota_geral: q.avaliavel ? q.nota_geral : null,
        cordialidade: q.avaliavel ? q.cordialidade : null,
        clareza: q.avaliavel ? q.clareza : null,
        resolutividade: q.avaliavel ? q.resolutividade : null,
        informacao_correta: q.avaliavel ? q.informacao_correta : null,
        resolvido: q.resolvido,
        pontos_positivos: q.pontos_positivos.slice(0, 3),
        pontos_melhorar: q.pontos_melhorar.slice(0, 3),
        sugestao: q.sugestao || null,
      });
      if (error) throw error;
    }

    // Base do robô
    const idsConhecidos = new Set(refs.conhecidas.map((c) => c.id));
    for (const p of r.bot.perguntas) {
      const id = p.conhecimento_id && idsConhecidos.has(p.conhecimento_id) ? p.conhecimento_id : null;
      const { data: novoId, error } = await db.rpc("bot_conhecimento_registrar", {
        p_id: id, p_categoria: p.categoria, p_pergunta: p.pergunta.slice(0, 300),
        p_exemplo: p.exemplo_paciente.slice(0, 400), p_resposta: p.resposta_equipe?.slice(0, 1000) ?? null,
        p_precisa_humano: p.precisa_humano, p_lacuna: !p.resposta_adequada, p_quando: ate,
      });
      if (error) throw error;
      if (!id && novoId) refs.conhecidas.push({ id: novoId, categoria: p.categoria, pergunta: p.pergunta });
    }

    // Agendamentos
    let agendados = 0, pendentes = 0;
    for (const a of r.agendamentos) {
      const d = await decidirAgendamento(db, cfg, refs, conversa, pacientesNumero, futuros, a);
      const valido = (id: string | null, lista: { id: string }[]) => (id && lista.some((x) => x.id === id) ? id : null);
      const { error } = await db.from("whatsapp_pedidos_agendamento").insert({
        analise_id: analise.id,
        conversa_id: conversaId,
        paciente_id: d.paciente_id ?? null,
        acao: a.acao,
        nome_informado: a.nome_paciente,
        nascimento_informado: /^\d{4}-\d{2}-\d{2}$/.test(a.data_nascimento ?? "") ? a.data_nascimento : null,
        tipo: a.tipo,
        exame_ou_procedimento: a.exame_ou_procedimento,
        profissional_id: valido(a.profissional_id, refs.medicos),
        profissional_citado: a.profissional_citado,
        convenio_id: valido(a.convenio_id, refs.convenios),
        convenio_citado: a.convenio_citado,
        particular: a.particular,
        inicio: horaLocalParaData(a.data_hora)?.toISOString() ?? null,
        preferencia: a.preferencia,
        primeira_vez: a.primeira_vez,
        agendamento_existente: valido(a.agendamento_existente_id, futuros),
        acordo_fechado: a.acordo_fechado,
        confianca: Math.round(a.confianca * 100) / 100,
        evidencia: a.evidencia.slice(0, 500),
        situacao: d.situacao,
        motivo: d.motivo,
        agendamento_id: d.agendamento_id ?? null,
      });
      if (error) throw error;
      if (d.situacao === "agendado_auto") agendados++;
      if (d.situacao === "pendente") pendentes++;
    }

    await concluir(db, conversaId, ate);
    return { ok: true, conversa_id: conversaId, analise_id: analise.id, agendados, pendentes };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.error("conversa", conversaId, msg);
    const { data: est } = await db.from("whatsapp_extrator_estado").select("tentativas").eq("conversa_id", conversaId).single();
    await db.from("whatsapp_extrator_estado").update({
      em_processo_desde: null, tentativas: (est?.tentativas ?? 0) + 1, ultimo_erro: msg.slice(0, 500),
      atualizado_em: new Date().toISOString(),
    }).eq("conversa_id", conversaId);
    return { ok: false, conversa_id: conversaId, erro: msg };
  }
}

async function concluir(db: SupabaseClient, conversa: string, ate: string | null) {
  await db.from("whatsapp_extrator_estado").update({
    analisado_ate: ate, em_processo_desde: null, tentativas: 0, ultimo_erro: null, atualizado_em: new Date().toISOString(),
  }).eq("conversa_id", conversa);
}

// =====================================================================
// Agendamento automático (só quando tudo bate; senão vira pendência da recepção)
// =====================================================================
interface Decisao {
  situacao: "pendente" | "agendado_auto" | "resolvido";
  motivo: string;
  paciente_id?: string | null;
  agendamento_id?: string | null;
}

type PedidoIA = Resultado["agendamentos"][number];

async function decidirAgendamento(
  db: SupabaseClient, cfg: Config, refs: Referencias, conversa: Json, pacientesNumero: Json[], futuros: Json[], a: PedidoIA,
): Promise<Decisao> {
  const pend = (motivo: string, paciente_id: string | null = null): Decisao => ({ situacao: "pendente", motivo, paciente_id });

  // Quem é o paciente? (ainda sem criar cadastro)
  const quem = await acharPaciente(db, cfg, conversa, pacientesNumero, a);
  const pacienteId = "id" in quem ? quem.id : null;

  if (a.acao === "remarcar") return pend("Pedido de remarcação: a recepção confere e muda na agenda.", pacienteId);
  if (a.acao === "cancelar") return pend("Pedido de cancelamento: a recepção confere e cancela na agenda.", pacienteId);
  if (!cfg.agendar_automatico) return pend("O agendamento automático está desligado.", pacienteId);
  if (!a.acordo_fechado) return pend("Dia e hora ainda não foram combinados na conversa.", pacienteId);
  if (a.confianca < Number(cfg.confianca_minima)) {
    return pend(`O assistente não teve certeza suficiente (${Math.round(a.confianca * 100)}%).`, pacienteId);
  }
  const inicio = horaLocalParaData(a.data_hora);
  if (!inicio) return pend("Faltou dia e hora exatos.", pacienteId);
  if (inicio.getTime() < Date.now() + 30 * 60000) return pend("O horário combinado já passou ou está muito próximo.", pacienteId);
  const medico = refs.medicos.find((m) => m.id === a.profissional_id);
  if (!medico) return pend("Não deu para saber com qual médico.", pacienteId);
  if ("motivo" in quem) return pend(quem.motivo, null);

  const proprios = refs.horarios.get(medico.id) ?? [];
  const horarios = proprios.length ? proprios : horarioPadrao(cfg);
  if (!horarios.length) return pend(`Os horários de atendimento de ${medico.nome} não estão cadastrados.`, pacienteId);
  const faixa = encaixeNoHorario(inicio, horarios);
  if (!faixa) {
    return pend(`Fora do horário de atendimento de ${medico.nome}${proprios.length ? "" : " (horário padrão da clínica)"}.`, pacienteId);
  }
  const fim = new Date(inicio.getTime() + (faixa.duracao_min || 15) * 60000);

  const { data: bloqueios } = await db.from("bloqueios_agenda").select("id")
    .eq("ativo", true).lt("inicio", fim.toISOString()).gt("fim", inicio.toISOString())
    .or(`profissional_id.eq.${medico.id},profissional_id.is.null`).limit(1);
  if (bloqueios?.length) return pend("A agenda do médico está bloqueada nesse horário.", pacienteId);

  // Já marcado pela recepção durante a conversa? (mesmo paciente, mesmo médico, mesmo dia)
  if (pacienteId) {
    const diaSP = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d);
    const ja = futuros.find((f) =>
      f.paciente_id === pacienteId && f.profissional_id === medico.id && diaSP(new Date(f.inicio)) === diaSP(inicio)
    );
    if (ja) return { situacao: "resolvido", motivo: "Já estava na agenda (marcado pela recepção).", paciente_id: pacienteId, agendamento_id: ja.id };
  }

  // Cria o cadastro, se for paciente novo
  let paciente: { id: string; convenio_id: string | null; plano_id: string | null };
  if ("id" in quem) {
    paciente = quem;
  } else {
    const conv = a.particular ? null : refs.convenios.find((c) => c.id === a.convenio_id)?.id ?? null;
    const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO }).format(new Date());
    const { data: novo, error } = await db.from("pacientes").insert({
      nome: normalizarNome(quem.criar.nome),
      telefone: telefoneCadastro(conversa.telefone),
      data_nascimento: quem.criar.nascimento,
      convenio_id: conv,
      observacoes: `Cadastro criado automaticamente pelo assistente do WhatsApp em ${hoje}. Conferir documentos e dados na chegada.`,
    }).select("id, convenio_id, plano_id").single();
    if (error) return pend(`Não consegui criar o cadastro do paciente: ${error.message}`);
    paciente = novo;
    if (!conversa.paciente_id && a.para_quem !== "outra_pessoa") {
      await db.from("whatsapp_conversas").update({ paciente_id: novo.id }).eq("id", conversa.id);
      conversa.paciente_id = novo.id;
    }
  }

  const convenio = a.particular ? null : refs.convenios.find((c) => c.id === a.convenio_id)?.id ?? paciente.convenio_id;
  const { data: ag, error: eag } = await db.from("agendamentos").insert({
    paciente_id: paciente.id,
    profissional_id: medico.id,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    tipo: a.tipo,
    status: "agendado",
    convenio_id: convenio,
    plano_id: convenio && convenio === paciente.convenio_id ? paciente.plano_id : null,
    local_id: faixa.local_id,
    primeira_vez: a.primeira_vez ?? !("id" in quem),
    observacoes: `Marcado automaticamente pelo assistente do WhatsApp${a.exame_ou_procedimento ? ` (${a.exame_ou_procedimento})` : ""}.`,
  }).select("id").single();
  if (eag) {
    if (/agenda_sem_conflito/.test(eag.message)) return pend("O horário combinado já está ocupado na agenda.", paciente.id);
    return pend(`Não consegui marcar: ${eag.message}`, paciente.id);
  }
  futuros.push({ id: ag.id, paciente_id: paciente.id, profissional_id: medico.id, inicio: inicio.toISOString() });
  return { situacao: "agendado_auto", motivo: "Marcado automaticamente.", paciente_id: paciente.id, agendamento_id: ag.id };
}

type Quem =
  | { id: string; convenio_id: string | null; plano_id: string | null }
  | { criar: { nome: string; nascimento: string | null } }
  | { motivo: string };

async function acharPaciente(
  db: SupabaseClient, cfg: Config, conversa: Json, doNumero: Json[], a: PedidoIA,
): Promise<Quem> {
  const nasc = /^\d{4}-\d{2}-\d{2}$/.test(a.data_nascimento ?? "") ? a.data_nascimento : null;
  const pac = (p: Json) => ({ id: p.id as string, convenio_id: p.convenio_id ?? null, plano_id: p.plano_id ?? null });
  const nome = (a.nome_paciente ?? "").trim();
  const partes = normalizarNome(nome).split(" ").filter(Boolean);

  if (nome) {
    // 1) Entre os pacientes deste número
    let iguais = doNumero.filter((p) => mesmoNome(nome, p.nome) || mesmoNome(nome, p.nome_social));
    if (!iguais.length && partes.length === 1 && a.para_quem !== "outra_pessoa") {
      iguais = doNumero.filter((p) => normalizarNome(p.nome_social || p.nome).split(" ")[0] === partes[0]);
    }
    if (nasc && iguais.length > 1) iguais = iguais.filter((p) => !p.data_nascimento || p.data_nascimento === nasc);
    if (iguais.length === 1) return pac(iguais[0]);
    if (iguais.length > 1) return { motivo: "Há mais de um paciente com esse nome neste número." };

    // 2) Mesmo nome completo cadastrado com outro telefone
    if (partes.length >= 2) {
      const { data: homonimos } = await db.from("pacientes").select("id, nome, data_nascimento, convenio_id, plano_id")
        .eq("ativo", true).ilike("nome", normalizarNome(nome)).limit(5);
      const h = homonimos ?? [];
      if (h.length) {
        const mesmo = nasc ? h.filter((p) => p.data_nascimento === nasc) : [];
        if (mesmo.length === 1) return pac(mesmo[0]);
        return { motivo: "Já existe paciente com esse nome cadastrado com outro telefone; a recepção confere se é o mesmo." };
      }
    }
  } else {
    // Sem nome: vale o paciente ligado à conversa, se a consulta é para quem escreve
    if (a.para_quem === "proprio_contato") {
      const ligado = doNumero.find((p) => p.id === conversa.paciente_id);
      if (ligado) return pac(ligado);
      if (doNumero.length === 1) return pac(doNumero[0]);
    }
    if (a.para_quem === "nao_sei" && doNumero.length === 1 && conversa.paciente_id === doNumero[0].id) return pac(doNumero[0]);
    return { motivo: doNumero.length > 1 ? "Este número é de mais de um paciente; falta saber qual." : "Faltou o nome do paciente." };
  }

  // 3) Paciente novo
  if (partes.length < 2) return { motivo: "Paciente novo, mas faltou o nome completo para o cadastro." };
  if (!cfg.criar_paciente_automatico) return { motivo: "Paciente novo: precisa fazer o cadastro." };
  return { criar: { nome, nascimento: nasc } };
}
