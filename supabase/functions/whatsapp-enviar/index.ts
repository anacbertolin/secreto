// Envia mensagens de WhatsApp em nome da equipe (pela API oficial da Meta).
// Só quem está logado e ativo na equipe (médico, enfermagem, recepção, admin).
//
// Ações (POST, corpo JSON com "acao"):
//   estado     → o WhatsApp já está configurado? (sem segredos na resposta)
//   texto      → { conversa_id, texto }  resposta livre (só até 24 h depois da última mensagem do paciente)
//   retomar    → { conversa_id } ou { paciente_id }  envia o modelo "retomar_conversa" (fora das 24 h)
//   lembretes  → { data: "AAAA-MM-DD", simular?: true }  lembrete com botões para os agendamentos do dia
//                (só recepção e admin; "simular" só conta, não envia)
//   midia      → { mensagem_id }  baixa a foto/áudio/documento que o paciente mandou
//
// Segredos (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN            token permanente (usuário do sistema na Meta)
//   WHATSAPP_PHONE_NUMBER_ID  "Identificação do número de telefone" (Meta → WhatsApp → Configuração da API)
//   WHATSAPP_API_VERSION      opcional (padrão v24.0)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const FUSO = "America/Sao_Paulo";
const JANELA_MS = 24 * 60 * 60 * 1000;

// deno-lint-ignore no-explicit-any
type Json = any;

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const TOKEN = () => Deno.env.get("WHATSAPP_TOKEN") ?? "";
const NUMERO = () => Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const GRAPH = () => `https://graph.facebook.com/${Deno.env.get("WHATSAPP_API_VERSION") ?? "v24.0"}`;

/** Chama a API da Meta para enviar. Devolve o id da mensagem ou o erro em português simples. */
async function enviarMeta(corpo: Json): Promise<{ wa_id?: string; erro?: string }> {
  try {
    const r = await fetch(`${GRAPH()}/${NUMERO()}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...corpo }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.messages?.[0]?.id) return { wa_id: j.messages[0].id };
    const e = j.error ?? {};
    return { erro: explicarErro(e.code, e.error_data?.details ?? e.message ?? `HTTP ${r.status}`) };
  } catch (e) {
    return { erro: `Sem conexão com a Meta: ${(e as Error).message}` };
  }
}

function explicarErro(codigo: number | undefined, detalhe: string): string {
  const conhecidos: Record<number, string> = {
    131047: "Passaram mais de 24 h desde a última mensagem do paciente. Use “Chamar o paciente de novo”.",
    131026: "Este número não tem WhatsApp ou não pode receber mensagens.",
    132001: "O modelo de mensagem não existe ou ainda não foi aprovado pela Meta.",
    132000: "O número de variáveis do modelo não bate com o aprovado na Meta.",
    190: "O token de acesso da Meta expirou ou é inválido.",
    131056: "Muitas mensagens para o mesmo número em pouco tempo. Tente daqui a pouco.",
    131049: "A Meta segurou esta mensagem para não cansar o paciente (limite de mensagens de marketing/lembrete).",
  };
  return codigo && conhecidos[codigo] ? `${conhecidos[codigo]} (${codigo})` : `${detalhe}${codigo ? ` (${codigo})` : ""}`;
}

// ---------- Formatação para os modelos ----------
function primeiroNome(p: { nome: string; nome_social: string | null }): string {
  const n = (p.nome_social || p.nome || "").trim().split(/\s+/)[0] ?? "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}
function nomeCompleto(n: string): string {
  return n.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\s(D[aeo]s?|E)\s/g, (m) => m.toLowerCase());
}
const fmtDia = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit" }).format(d);
const fmtSemana = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long" }).format(d);
const fmtHora = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(d);

interface Modelo { nome: string; idioma: string; corpo: string; parametros: string[]; botoes: boolean; ativo: boolean }

function montarModelo(m: Modelo, valores: Record<string, string>, agendamentoId?: string) {
  // A Meta não aceita quebra de linha, tab ou 4+ espaços dentro das variáveis
  const params = m.parametros.map((p) => (valores[p] ?? "-").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, " ").trim() || "-");
  // deno-lint-ignore no-explicit-any
  const componentes: any[] = [];
  if (params.length) componentes.push({ type: "body", parameters: params.map((text) => ({ type: "text", text })) });
  if (m.botoes && agendamentoId) {
    componentes.push(
      { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: `CONFIRMAR:${agendamentoId}` }] },
      { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: `REMARCAR:${agendamentoId}` }] },
    );
  }
  const texto = m.corpo.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? "");
  return {
    corpo: { type: "template", template: { name: m.nome, language: { code: m.idioma }, components: componentes } },
    texto,
  };
}

async function gravarEnviada(db: SupabaseClient, dados: {
  conversa_id: string; tipo: string; texto: string; modelo?: string; agendamento_id?: string;
  enviado_por: string; wa_id?: string; erro?: string;
}) {
  const agora = new Date().toISOString();
  const { data, error } = await db.from("whatsapp_mensagens").insert({
    conversa_id: dados.conversa_id, direcao: "enviada", tipo: dados.tipo, texto: dados.texto,
    modelo: dados.modelo ?? null, agendamento_id: dados.agendamento_id ?? null, enviado_por: dados.enviado_por,
    wa_id: dados.wa_id ?? null, situacao: dados.wa_id ? "enviada" : "falhou", erro: dados.erro ?? null, quando: agora,
  }).select("*").single();
  if (error) console.error("Erro ao gravar mensagem enviada", error.message);
  if (dados.wa_id) await db.from("whatsapp_conversas").update({ ultima_mensagem_em: agora, arquivada: false }).eq("id", dados.conversa_id);
  return data;
}

async function lerModelo(db: SupabaseClient, finalidade: string): Promise<Modelo | null> {
  const { data } = await db.from("whatsapp_modelos").select("*").eq("finalidade", finalidade).maybeSingle();
  return (data as Modelo) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Quem está chamando?
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u, error: eu } = await db.auth.getUser(jwt);
  if (eu || !u?.user?.email) return resposta({ erro: "Sessão inválida. Entre novamente." }, 401);
  const { data: eu_prof } = await db.from("profissionais").select("id, funcao, ativo")
    .eq("email", u.user.email.toLowerCase()).maybeSingle();
  if (!eu_prof?.ativo || !["medico", "enfermagem", "recepcao", "admin"].includes(eu_prof.funcao)) {
    return resposta({ erro: "Você não tem acesso ao WhatsApp da clínica." }, 403);
  }

  let corpo: Json;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Dados inválidos" }, 400);
  }

  const configurado = !!(TOKEN() && NUMERO());
  if (corpo.acao === "estado") {
    return resposta({
      configurado,
      recebimento: !!(Deno.env.get("WHATSAPP_APP_SECRET") && Deno.env.get("WHATSAPP_VERIFY_TOKEN")),
    });
  }
  if (!configurado) {
    return resposta({ erro: "O WhatsApp ainda não foi ligado: faltam os dados da conta da Meta (token e número)." }, 503);
  }

  // ---------- Resposta livre ----------
  if (corpo.acao === "texto") {
    const texto = String(corpo.texto ?? "").trim();
    if (!texto) return resposta({ erro: "Escreva a mensagem." }, 400);
    if (texto.length > 4000) return resposta({ erro: "Mensagem muito longa (máximo 4.000 letras)." }, 400);
    const { data: c } = await db.from("whatsapp_conversas").select("*").eq("id", corpo.conversa_id).maybeSingle();
    if (!c) return resposta({ erro: "Conversa não encontrada." }, 404);
    if (!c.ultima_recebida_em || Date.now() - new Date(c.ultima_recebida_em).getTime() > JANELA_MS) {
      return resposta({ erro: "Passaram mais de 24 h desde a última mensagem do paciente. Pela regra da Meta, use “Chamar o paciente de novo”." }, 409);
    }
    const r = await enviarMeta({ to: c.telefone, type: "text", text: { body: texto, preview_url: true } });
    const msg = await gravarEnviada(db, { conversa_id: c.id, tipo: "texto", texto, enviado_por: eu_prof.id, ...r });
    return r.erro ? resposta({ erro: r.erro, mensagem: msg }, 502) : resposta({ ok: true, mensagem: msg });
  }

  // ---------- Chamar o paciente de novo (modelo) ----------
  if (corpo.acao === "retomar") {
    const modelo = await lerModelo(db, "retomar_conversa");
    if (!modelo?.ativo) return resposta({ erro: "O modelo “retomar conversa” ainda não foi aprovado/ligado (WhatsApp → Modelos)." }, 409);

    let conversaId: string | null = corpo.conversa_id ?? null;
    const pacienteId: string | null = corpo.paciente_id ?? null;
    if (!conversaId && pacienteId) {
      const { data: p } = await db.from("pacientes").select("telefone, whatsapp_autorizado").eq("id", pacienteId).maybeSingle();
      if (!p) return resposta({ erro: "Paciente não encontrado." }, 404);
      if (p.whatsapp_autorizado === false) return resposta({ erro: "Este paciente não autorizou mensagens pelo WhatsApp." }, 409);
      const { data: numero } = await db.rpc("telefone_whatsapp", { p: p.telefone });
      if (!numero) return resposta({ erro: "O telefone do cadastro não é um celular válido." }, 400);
      const { data: id, error } = await db.rpc("whatsapp_conversa", { p_telefone: numero, p_paciente: pacienteId });
      if (error) return resposta({ erro: error.message }, 500);
      conversaId = id;
    }
    const { data: c } = await db.from("whatsapp_conversas").select("*, pacientes(nome, nome_social, whatsapp_autorizado)")
      .eq("id", conversaId).maybeSingle();
    if (!c) return resposta({ erro: "Conversa não encontrada." }, 404);
    if (c.pacientes?.whatsapp_autorizado === false) return resposta({ erro: "Este paciente pediu para não receber mensagens." }, 409);
    const nome = c.pacientes ? primeiroNome(c.pacientes) : (c.nome_contato?.split(" ")[0] ?? "tudo bem");
    const m = montarModelo(modelo, { paciente: nome });
    const r = await enviarMeta({ to: c.telefone, ...m.corpo });
    const msg = await gravarEnviada(db, { conversa_id: c.id, tipo: "modelo", texto: m.texto, modelo: modelo.nome, enviado_por: eu_prof.id, ...r });
    return r.erro ? resposta({ erro: r.erro, mensagem: msg }, 502) : resposta({ ok: true, conversa_id: c.id, mensagem: msg });
  }

  // ---------- Lembretes do dia ----------
  if (corpo.acao === "lembretes") {
    if (!["recepcao", "admin"].includes(eu_prof.funcao)) return resposta({ erro: "Só a recepção e a administração enviam lembretes." }, 403);
    const dia = String(corpo.data ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return resposta({ erro: "Data inválida." }, 400);
    const modelo = await lerModelo(db, "lembrete_consulta");
    if (!modelo?.ativo) return resposta({ erro: "O modelo de lembrete ainda não foi aprovado/ligado (WhatsApp → Modelos)." }, 409);

    // Brasil não tem horário de verão desde 2019: o dia vai de 00:00 a 24:00 em -03:00
    const ini = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(ini.getTime() + 24 * 60 * 60 * 1000);
    const { data: ags, error } = await db.from("agendamentos")
      .select("id, inicio, status, pacientes(id, nome, nome_social, telefone, whatsapp_autorizado), profissionais(nome)")
      .gte("inicio", ini.toISOString()).lt("inicio", fim.toISOString()).eq("status", "agendado").order("inicio");
    if (error) return resposta({ erro: error.message }, 500);

    const ids = (ags ?? []).map((a: Json) => a.id);
    const { data: jaFoi } = ids.length
      ? await db.from("whatsapp_mensagens").select("agendamento_id")
        .in("agendamento_id", ids).eq("direcao", "enviada").eq("tipo", "modelo").neq("situacao", "falhou")
      : { data: [] };
    const enviados = new Set((jaFoi ?? []).map((x: Json) => x.agendamento_id));

    const res = { total: ids.length, enviados: 0, ja_enviados: 0, sem_autorizacao: 0, nao_perguntado: 0, sem_celular: 0, falhas: [] as string[] };
    const fila: Json[] = [];
    for (const a of (ags ?? []) as Json[]) {
      const p = a.pacientes;
      if (enviados.has(a.id)) { res.ja_enviados++; continue; }
      if (p.whatsapp_autorizado === false) { res.sem_autorizacao++; continue; }
      if (p.whatsapp_autorizado !== true) { res.nao_perguntado++; continue; }
      const { data: numero } = await db.rpc("telefone_whatsapp", { p: p.telefone });
      if (!numero) { res.sem_celular++; continue; }
      fila.push({ a, p, numero });
    }
    if (corpo.simular) return resposta({ ...res, a_enviar: fila.length });

    // Envia de 5 em 5
    for (let i = 0; i < fila.length; i += 5) {
      await Promise.all(fila.slice(i, i + 5).map(async ({ a, p, numero }) => {
        const quando = new Date(a.inicio);
        const m = montarModelo(modelo, {
          paciente: primeiroNome(p), data: fmtDia(quando), dia_semana: fmtSemana(quando), hora: fmtHora(quando),
          medico: a.profissionais?.nome ? nomeCompleto(a.profissionais.nome) : "nossa equipe",
        }, a.id);
        const { data: conversaId, error: ec } = await db.rpc("whatsapp_conversa", { p_telefone: numero, p_paciente: p.id });
        if (ec) { res.falhas.push(`${p.nome}: ${ec.message}`); return; }
        const r = await enviarMeta({ to: numero, ...m.corpo });
        await gravarEnviada(db, {
          conversa_id: conversaId, tipo: "modelo", texto: m.texto, modelo: modelo.nome, agendamento_id: a.id,
          enviado_por: eu_prof.id, ...r,
        });
        if (r.erro) res.falhas.push(`${p.nome}: ${r.erro}`);
        else res.enviados++;
      }));
    }
    return resposta(res);
  }

  // ---------- Baixar mídia recebida ----------
  if (corpo.acao === "midia") {
    const { data: m } = await db.from("whatsapp_mensagens").select("midia_id, midia_tipo, midia_nome")
      .eq("id", corpo.mensagem_id).maybeSingle();
    if (!m?.midia_id) return resposta({ erro: "Arquivo não encontrado." }, 404);
    const info = await fetch(`${GRAPH()}/${m.midia_id}`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
    const j = await info.json().catch(() => ({}));
    if (!info.ok || !j.url) return resposta({ erro: "A Meta não tem mais este arquivo (eles ficam disponíveis por cerca de 30 dias)." }, 410);
    const arq = await fetch(j.url, { headers: { Authorization: `Bearer ${TOKEN()}` } });
    if (!arq.ok) return resposta({ erro: "Não foi possível baixar o arquivo." }, 502);
    return new Response(arq.body, {
      headers: {
        ...cors,
        "Content-Type": m.midia_tipo ?? j.mime_type ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  }

  return resposta({ erro: "Ação desconhecida." }, 400);
});
