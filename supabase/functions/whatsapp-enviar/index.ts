// Envia mensagens de WhatsApp em nome da equipe (pela API oficial da Meta).
// Dois números na mesma conta da Meta (setor da conversa):
//   clinica    → número da clínica. Toda a equipe vê; só recepção e admin ENVIAM (decisão da dona, 15/11/2026).
//   orientacao → número da Orientação Cirúrgica (16/11/2026). Veem: quem atende a orientação
//                (profissionais.orientacao_cirurgica), médicos e admin. ENVIA só quem atende a orientação.
//
// Ações (POST, corpo JSON com "acao"):
//   estado     → o WhatsApp já está configurado? (sem segredos na resposta)
//   texto      → { conversa_id, texto }  resposta livre (só até 24 h depois da última mensagem do paciente)
//   retomar    → { conversa_id } ou { paciente_id, setor? }  envia o modelo "retomar_conversa"
//                (ou "retomar_orientacao" no número da orientação) — fora das 24 h
//   lembretes  → { data: "AAAA-MM-DD", simular?: true }  lembrete com botões para os agendamentos do dia
//                ou { agendamento_id, simular?: true }  só para um paciente (botão da Agenda; pode repetir)
//                A Orientação Cirúrgica (tipo 'orientacao', só registro) nunca recebe lembrete.
//                (só recepção e admin; "simular" só conta, não envia)
//   midia      → { mensagem_id }  abre a foto/áudio/documento que o paciente mandou (cópia guardada no
//                Storage, bucket "whatsapp-midia"; se ainda não houver, busca na Meta e guarda)
//   arquivo    → multipart/form-data: conversa_id, arquivo, legenda?, como_documento? ("1")
//                envia foto, áudio, vídeo ou documento (só dentro das 24 h). O arquivo vai para a Meta sem
//                compressão e a cópia original fica guardada no Storage. "como_documento" manda a foto como
//                arquivo (qualidade original, melhor para exames e receitas).
//
// Segredos (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN            token permanente (usuário do sistema na Meta)
//   WHATSAPP_PHONE_NUMBER_ID  "Identificação do número de telefone" (Meta → WhatsApp → Configuração da API)
//   WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID  o mesmo, do número da Orientação Cirúrgica
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
type Setor = "clinica" | "orientacao";
const NUMERO = (setor: Setor = "clinica") =>
  Deno.env.get(setor === "orientacao" ? "WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID" : "WHATSAPP_PHONE_NUMBER_ID") ?? "";
const NOME_SETOR: Record<Setor, string> = { clinica: "WhatsApp da clínica", orientacao: "WhatsApp da Orientação Cirúrgica" };
const GRAPH = () => `https://graph.facebook.com/${Deno.env.get("WHATSAPP_API_VERSION") ?? "v24.0"}`;

/** Chama a API da Meta para enviar. Devolve o id da mensagem ou o erro em português simples. */
async function enviarMeta(corpo: Json, setor: Setor): Promise<{ wa_id?: string; erro?: string }> {
  try {
    const r = await fetch(`${GRAPH()}/${NUMERO(setor)}/messages`, {
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
  conversa_id: string; tipo: string; texto: string | null; modelo?: string; agendamento_id?: string;
  enviado_por: string; wa_id?: string; erro?: string;
  id?: string; midia_id?: string | null; midia_tipo?: string | null; midia_nome?: string | null; midia_caminho?: string | null;
}) {
  const agora = new Date().toISOString();
  const { data, error } = await db.from("whatsapp_mensagens").insert({
    ...(dados.id ? { id: dados.id } : {}),
    conversa_id: dados.conversa_id, direcao: "enviada", tipo: dados.tipo, texto: dados.texto,
    modelo: dados.modelo ?? null, agendamento_id: dados.agendamento_id ?? null, enviado_por: dados.enviado_por,
    wa_id: dados.wa_id ?? null, situacao: dados.wa_id ? "enviada" : "falhou", erro: dados.erro ?? null, quando: agora,
    midia_id: dados.midia_id ?? null, midia_tipo: dados.midia_tipo ?? null, midia_nome: dados.midia_nome ?? null,
    midia_caminho: dados.midia_caminho ?? null,
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
  const { data: eu_prof } = await db.from("profissionais").select("id, funcao, ativo, orientacao_cirurgica")
    .eq("email", u.user.email.toLowerCase()).maybeSingle();
  if (!eu_prof?.ativo) return resposta({ erro: "Você não tem acesso ao WhatsApp da clínica." }, 403);
  // Mesmas regras do banco (migração 0052): quem vê e quem responde cada número
  const ve = (setor: Setor) => setor === "orientacao"
    ? eu_prof.orientacao_cirurgica === true || ["medico", "admin"].includes(eu_prof.funcao)
    : ["medico", "enfermagem", "recepcao", "admin", "faturamento"].includes(eu_prof.funcao);
  const atende = (setor: Setor) => setor === "orientacao"
    ? eu_prof.orientacao_cirurgica === true
    : ["recepcao", "admin"].includes(eu_prof.funcao);
  const semPermissao = (setor: Setor) => resposta({
    erro: setor === "orientacao"
      ? "Quem responde a Orientação Cirúrgica é a pessoa da orientação. Você pode acompanhar as conversas, mas não enviar."
      : "Quem responde o WhatsApp é a recepção. Você pode acompanhar as conversas, mas não enviar.",
  }, 403);
  const naoLigado = (setor: Setor) => resposta({
    erro: `O ${NOME_SETOR[setor]} ainda não foi ligado: faltam os dados da conta da Meta (token e número).`,
  }, 503);
  const ligado = (setor: Setor) => !!(TOKEN() && NUMERO(setor));

  let corpo: Json;
  let arquivoEnviado: File | null = null;
  try {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await req.formData();
      corpo = {
        acao: "arquivo", conversa_id: form.get("conversa_id"), legenda: form.get("legenda") ?? "",
        como_documento: form.get("como_documento") === "1",
      };
      const f = form.get("arquivo");
      arquivoEnviado = f instanceof File ? f : null;
    } else {
      corpo = await req.json();
    }
  } catch {
    return resposta({ erro: "Dados inválidos (o arquivo pode ser grande demais)." }, 400);
  }

  if (corpo.acao === "estado") {
    return resposta({
      configurado: ligado("clinica"),
      orientacao_configurado: ligado("orientacao"),
      recebimento: !!(Deno.env.get("WHATSAPP_APP_SECRET") && Deno.env.get("WHATSAPP_VERIFY_TOKEN")),
    });
  }

  // ---------- Resposta livre ----------
  if (corpo.acao === "texto") {
    const texto = String(corpo.texto ?? "").trim();
    if (!texto) return resposta({ erro: "Escreva a mensagem." }, 400);
    if (texto.length > 4000) return resposta({ erro: "Mensagem muito longa (máximo 4.000 letras)." }, 400);
    const { data: c } = await db.from("whatsapp_conversas").select("*").eq("id", corpo.conversa_id).maybeSingle();
    if (!c || !ve(c.setor)) return resposta({ erro: "Conversa não encontrada." }, 404);
    if (!atende(c.setor)) return semPermissao(c.setor);
    if (!ligado(c.setor)) return naoLigado(c.setor);
    if (!c.ultima_recebida_em || Date.now() - new Date(c.ultima_recebida_em).getTime() > JANELA_MS) {
      return resposta({ erro: "Passaram mais de 24 h desde a última mensagem do paciente. Pela regra da Meta, use “Chamar o paciente de novo”." }, 409);
    }
    const r = await enviarMeta({ to: c.telefone, type: "text", text: { body: texto, preview_url: true } }, c.setor);
    const msg = await gravarEnviada(db, { conversa_id: c.id, tipo: "texto", texto, enviado_por: eu_prof.id, ...r });
    return r.erro ? resposta({ erro: r.erro, mensagem: msg }, 502) : resposta({ ok: true, mensagem: msg });
  }

  // ---------- Foto, áudio, vídeo ou documento ----------
  if (corpo.acao === "arquivo") {
    if (!arquivoEnviado || arquivoEnviado.size === 0) return resposta({ erro: "Escolha um arquivo." }, 400);
    const { data: c } = await db.from("whatsapp_conversas").select("*").eq("id", corpo.conversa_id).maybeSingle();
    if (!c || !ve(c.setor)) return resposta({ erro: "Conversa não encontrada." }, 404);
    if (!atende(c.setor)) return semPermissao(c.setor);
    if (!ligado(c.setor)) return naoLigado(c.setor);
    if (!c.ultima_recebida_em || Date.now() - new Date(c.ultima_recebida_em).getTime() > JANELA_MS) {
      return resposta({ erro: "Passaram mais de 24 h desde a última mensagem do paciente. Pela regra da Meta, use “Chamar o paciente de novo”." }, 409);
    }

    const MB = 1024 * 1024;
    const mime = (arquivoEnviado.type || "application/octet-stream").split(";")[0].trim().toLowerCase();
    const nome = (arquivoEnviado.name || "arquivo").slice(0, 200);
    const legenda = String(corpo.legenda ?? "").trim().slice(0, 1024) || null;
    // Tipo do WhatsApp (regras e limites da Meta)
    let tipoMeta: "image" | "audio" | "video" | "document" = "document";
    if (!corpo.como_documento) {
      if (["image/jpeg", "image/png"].includes(mime) && arquivoEnviado.size <= 5 * MB) tipoMeta = "image";
      else if (["audio/mpeg", "audio/mp4", "audio/aac", "audio/amr", "audio/ogg"].includes(mime) && arquivoEnviado.size <= 16 * MB) tipoMeta = "audio";
      else if (["video/mp4", "video/3gpp"].includes(mime) && arquivoEnviado.size <= 16 * MB) tipoMeta = "video";
    }
    if (arquivoEnviado.size > 100 * MB) return resposta({ erro: "Arquivo grande demais (máximo de 100 MB pela Meta)." }, 400);
    const TIPO_DB = { image: "imagem", audio: "audio", video: "video", document: "documento" } as const;

    // 1) Guarda a cópia original no Storage
    const id = crypto.randomUUID();
    const bytes = await arquivoEnviado.arrayBuffer();
    const caminho = `${c.setor}/${new Date().toISOString().slice(0, 7)}/enviado-${id}`;
    const { error: eUp } = await db.storage.from("whatsapp-midia").upload(caminho, bytes, { contentType: mime, upsert: true });
    if (eUp) console.error("arquivo: não guardou no Storage", eUp.message);

    // 2) Sobe o arquivo para a Meta (sem compressão)
    const fd = new FormData();
    fd.append("messaging_product", "whatsapp");
    fd.append("type", mime);
    fd.append("file", new Blob([bytes], { type: mime }), nome);
    let midiaId: string | null = null;
    let erroUpload: string | null = null;
    try {
      const up = await fetch(`${GRAPH()}/${NUMERO(c.setor)}/media`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN()}` }, body: fd });
      const ju = await up.json().catch(() => ({}));
      if (up.ok && ju.id) midiaId = String(ju.id);
      else erroUpload = explicarErro(ju.error?.code, ju.error?.error_data?.details ?? ju.error?.message ?? `HTTP ${up.status}`);
    } catch (e) {
      erroUpload = `Sem conexão com a Meta: ${(e as Error).message}`;
    }

    // 3) Envia a mensagem
    let r: { wa_id?: string; erro?: string } = { erro: erroUpload ?? "Falha ao enviar o arquivo para a Meta." };
    if (midiaId) {
      const conteudo: Json = { id: midiaId };
      if (legenda && tipoMeta !== "audio") conteudo.caption = legenda;
      if (tipoMeta === "document") conteudo.filename = nome;
      r = await enviarMeta({ to: c.telefone, type: tipoMeta, [tipoMeta]: conteudo }, c.setor);
    }
    const msg = await gravarEnviada(db, {
      id, conversa_id: c.id, tipo: TIPO_DB[tipoMeta], texto: legenda, enviado_por: eu_prof.id, ...r,
      midia_id: midiaId, midia_tipo: mime, midia_nome: nome, midia_caminho: eUp ? null : caminho,
    });
    return r.erro ? resposta({ erro: r.erro, mensagem: msg }, 502) : resposta({ ok: true, mensagem: msg });
  }

  // ---------- Chamar o paciente de novo (modelo) ----------
  if (corpo.acao === "retomar") {
    let conversaId: string | null = corpo.conversa_id ?? null;
    const pacienteId: string | null = corpo.paciente_id ?? null;
    // Setor: o da conversa; para conversa nova, o pedido (padrão: clínica)
    let setor: Setor = corpo.setor === "orientacao" ? "orientacao" : "clinica";
    if (conversaId) {
      const { data: c0 } = await db.from("whatsapp_conversas").select("setor").eq("id", conversaId).maybeSingle();
      if (!c0 || !ve(c0.setor)) return resposta({ erro: "Conversa não encontrada." }, 404);
      setor = c0.setor;
    }
    if (!atende(setor)) return semPermissao(setor);
    if (!ligado(setor)) return naoLigado(setor);
    // Na orientação, a recusa de mensagens ("SAIR") do número da clínica não impede o acompanhamento da cirurgia
    const respeitaRecusa = setor === "clinica";

    const finalidade = setor === "orientacao" ? "retomar_orientacao" : "retomar_conversa";
    const modelo = await lerModelo(db, finalidade);
    if (!modelo?.ativo) {
      return resposta({ erro: `O modelo “${finalidade.replace("_", " ")}” ainda não foi aprovado/ligado (botão Modelos).` }, 409);
    }

    if (!conversaId && pacienteId) {
      const { data: p } = await db.from("pacientes").select("telefone, whatsapp_autorizado").eq("id", pacienteId).maybeSingle();
      if (!p) return resposta({ erro: "Paciente não encontrado." }, 404);
      if (respeitaRecusa && p.whatsapp_autorizado === false) return resposta({ erro: "Este paciente não autorizou mensagens pelo WhatsApp." }, 409);
      const { data: numero } = await db.rpc("telefone_whatsapp", { p: p.telefone });
      if (!numero) return resposta({ erro: "O telefone do cadastro não é um celular válido." }, 400);
      const { data: id, error } = await db.rpc("whatsapp_conversa", { p_telefone: numero, p_paciente: pacienteId, p_setor: setor });
      if (error) return resposta({ erro: error.message }, 500);
      conversaId = id;
    }
    const { data: c } = await db.from("whatsapp_conversas").select("*, pacientes(nome, nome_social, whatsapp_autorizado)")
      .eq("id", conversaId).maybeSingle();
    if (!c) return resposta({ erro: "Conversa não encontrada." }, 404);
    if (respeitaRecusa && c.pacientes?.whatsapp_autorizado === false) return resposta({ erro: "Este paciente pediu para não receber mensagens." }, 409);
    const nome = c.pacientes ? primeiroNome(c.pacientes) : (c.nome_contato?.split(" ")[0] ?? "tudo bem");
    const m = montarModelo(modelo, { paciente: nome });
    const r = await enviarMeta({ to: c.telefone, ...m.corpo }, setor);
    const msg = await gravarEnviada(db, { conversa_id: c.id, tipo: "modelo", texto: m.texto, modelo: modelo.nome, enviado_por: eu_prof.id, ...r });
    return r.erro ? resposta({ erro: r.erro, mensagem: msg }, 502) : resposta({ ok: true, conversa_id: c.id, mensagem: msg });
  }

  // ---------- Lembretes do dia ----------
  if (corpo.acao === "lembretes") {
    if (!atende("clinica")) return semPermissao("clinica");
    if (!ligado("clinica")) return naoLigado("clinica");
    const umSo = typeof corpo.agendamento_id === "string" && corpo.agendamento_id ? String(corpo.agendamento_id) : "";
    const dia = String(corpo.data ?? "");
    if (!umSo && !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return resposta({ erro: "Data inválida." }, 400);
    const modelo = await lerModelo(db, "lembrete_consulta");
    if (!modelo?.ativo) return resposta({ erro: "O modelo de lembrete ainda não foi aprovado/ligado (WhatsApp → Modelos)." }, 409);

    let q = db.from("agendamentos")
      .select("id, inicio, status, pacientes(id, nome, nome_social, telefone, whatsapp_autorizado), profissionais(nome)")
      .eq("status", "agendado").neq("tipo", "orientacao").order("inicio");
    if (umSo) q = q.eq("id", umSo);
    else {
      // Brasil não tem horário de verão desde 2019: o dia vai de 00:00 a 24:00 em -03:00
      const ini = new Date(`${dia}T00:00:00-03:00`);
      const fim = new Date(ini.getTime() + 24 * 60 * 60 * 1000);
      q = q.gte("inicio", ini.toISOString()).lt("inicio", fim.toISOString());
    }
    const { data: ags, error } = await q;
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
      // em lote não repete; pedido de um paciente só (botão da Agenda) manda de novo
      if (enviados.has(a.id)) { res.ja_enviados++; if (!umSo) continue; }
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
        const r = await enviarMeta({ to: numero, ...m.corpo }, "clinica");
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

  // ---------- Abrir foto/áudio/documento ----------
  // Primeiro a cópia guardada no Storage (para sempre); se ainda não houver, busca na Meta (~30 dias) e guarda.
  if (corpo.acao === "midia") {
    const { data: m } = await db.from("whatsapp_mensagens")
      .select("id, midia_id, midia_tipo, midia_nome, midia_caminho, whatsapp_conversas(setor)")
      .eq("id", corpo.mensagem_id).maybeSingle();
    // deno-lint-ignore no-explicit-any
    const setor: Setor = (m as any)?.whatsapp_conversas?.setor ?? "clinica";
    if (!m?.midia_id || !ve(setor)) return resposta({ erro: "Arquivo não encontrado." }, 404);
    const entregar = (corpoArq: BodyInit, tipo: string) => new Response(corpoArq, {
      headers: { ...cors, "Content-Type": tipo, "Cache-Control": "private, no-store" },
    });

    if (m.midia_caminho) {
      const { data: arq, error } = await db.storage.from("whatsapp-midia").download(m.midia_caminho);
      if (!error && arq) return entregar(arq, m.midia_tipo ?? arq.type ?? "application/octet-stream");
      console.error("midia: cópia guardada não abriu", m.id, error?.message);
    }

    if (!TOKEN()) return naoLigado("clinica");
    const info = await fetch(`${GRAPH()}/${m.midia_id}`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
    const j = await info.json().catch(() => ({}));
    if (!info.ok || !j.url) return resposta({ erro: "Este arquivo não foi guardado a tempo e a Meta já apagou (ela guarda cerca de 30 dias)." }, 410);
    const arq = await fetch(j.url, { headers: { Authorization: `Bearer ${TOKEN()}` } });
    if (!arq.ok) return resposta({ erro: "Não foi possível baixar o arquivo." }, 502);
    const tipo = m.midia_tipo ?? j.mime_type ?? "application/octet-stream";
    const bytes = await arq.arrayBuffer();
    const caminho = `${setor}/${new Date().toISOString().slice(0, 7)}/${m.id}`;
    const { error: eUp } = await db.storage.from("whatsapp-midia").upload(caminho, bytes, { contentType: tipo, upsert: true });
    if (!eUp) await db.from("whatsapp_mensagens").update({ midia_caminho: caminho }).eq("id", m.id);
    else console.error("midia: não guardou", m.id, eUp.message);
    return entregar(bytes, tipo);
  }

  return resposta({ erro: "Ação desconhecida." }, 400);
});
