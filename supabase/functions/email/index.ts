// E-mail da clínica dentro do sistema (Google Workspace / Gmail API) — migração 0190.
// Uma conta do Google da equipe (clinica@cmdolhos.com.br) com vários endereços (apelidos);
// cada endereço é uma caixa no sistema (public.email_caixas). Quem vê a caixa também responde.
//
// Publicada SEM verificação automática de login (verify_jwt = false) porque o Google volta aqui
// (GET ?code=&state=) ao conectar a conta. Todas as outras ações conferem o login aqui dentro.
//
// Ações (POST JSON com "acao", ou multipart para "enviar"):
//   conectar      (admin)  → { url } endereço do Google para autorizar a conta da equipe
//   desconectar   (admin)  → apaga o acesso guardado
//   sincronizar   (agendador com x-extrator-chave, ou qualquer pessoa da equipe) → busca e-mails novos
//   enviar        multipart: caixa_id, conversa_id?, responde_a? (id da mensagem), modo (novo|responder|encaminhar),
//                 para, cc?, assunto, texto, encaminhar_anexos? ("1"), arquivos (vários)
//   anexo         { mensagem_id, indice } → o arquivo (baixa do Google na 1ª vez e guarda no Storage)
//   spam_listar   → e-mails que o Google pôs no spam (últimos 30 dias), só das caixas que a pessoa vê (0191)
//   nao_e_spam    { gmail_id } → tira do spam no Google e traz para a caixa certa no sistema
//   marcar_spam   { conversa_id } → manda a conversa para o spam do Google (ensina o filtro) e arquiva
//
// Segredos: Client ID / Client Secret e o token ficam em interno.email_google (a admin digita na tela
// Cadastros → E-mail). Nada disso volta para o navegador.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { analisarGolpe, nivelMaior, type Alerta } from "./golpe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const URL_FUNCAO = "https://ogflxjolbwrzayjtxvhj.supabase.co/functions/v1/email";
const SISTEMA = () => Deno.env.get("SISTEMA_URL") ?? "https://sistema-production-addc59db.up.railway.app";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const ESCOPO = "https://www.googleapis.com/auth/gmail.modify";
const LIMITE_ENVIO = 24 * 1024 * 1024; // o Gmail aceita até 25 MB por e-mail (já contando a codificação)

// deno-lint-ignore no-explicit-any
type Json = any;

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function pagina(titulo: string, texto: string, ok: boolean) {
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${titulo}</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px;color:#222">
<h1 style="color:${ok ? "#1b7f3b" : "#b3261e"}">${titulo}</h1><p style="font-size:18px">${texto}</p>
<p><a href="${SISTEMA()}/cadastros/email" style="font-size:18px">Voltar ao sistema</a></p></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ---------- Conexão com o Google ----------
interface Google {
  client_id: string | null; client_secret: string | null; refresh_token: string | null; conta: string | null;
  estado_oauth: string | null; estado_oauth_em: string | null; historico_id: string | null;
}
async function lerGoogle(db: SupabaseClient): Promise<Google> {
  const { data, error } = await db.rpc("email_google_ler");
  if (error) throw new Error(error.message);
  return data as Google;
}
async function gravarGoogle(db: SupabaseClient, p: Record<string, unknown>) {
  const { error } = await db.rpc("email_google_gravar", { p });
  if (error) console.error("email_google_gravar", error.message);
}

let tokenCache: { token: string; ate: number } | null = null;
async function tokenAcesso(g: Google): Promise<string> {
  if (tokenCache && tokenCache.ate > Date.now() + 60_000) return tokenCache.token;
  if (!g.refresh_token || !g.client_id || !g.client_secret) throw new Error("A conta do Google ainda não foi conectada.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: g.client_id, client_secret: g.client_secret, refresh_token: g.refresh_token, grant_type: "refresh_token",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error(j.error === "invalid_grant"
      ? "O Google recusou o acesso guardado (senha trocada ou acesso removido). Conecte a conta de novo em Cadastros → E-mail."
      : `Falha ao falar com o Google: ${j.error_description ?? j.error ?? r.status}`);
  }
  tokenCache = { token: j.access_token, ate: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function gmail(token: string, caminho: string, init: RequestInit = {}): Promise<Json> {
  const r = await fetch(caminho.startsWith("http") ? caminho : `${GMAIL}${caminho}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error?.message ?? `Gmail respondeu ${r.status}`) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return j;
}

// ---------- Leitura das mensagens do Gmail ----------
function b64urlParaBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
const b64urlTexto = (s: string) => new TextDecoder().decode(b64urlParaBytes(s));

function cab(m: Json, nome: string): string | null {
  const h = (m.payload?.headers ?? []).find((x: Json) => x.name.toLowerCase() === nome.toLowerCase());
  return h?.value ?? null;
}
function cabTodos(m: Json, nome: string): string[] {
  return (m.payload?.headers ?? []).filter((x: Json) => x.name.toLowerCase() === nome.toLowerCase()).map((x: Json) => x.value);
}
function enderecos(s: string | null | undefined): string[] {
  return [...(s ?? "").matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((x) => x[0].toLowerCase());
}

interface Anexo { nome: string; tipo: string; tamanho: number; parte: string; caminho?: string }
function lerCorpo(payload: Json) {
  let texto = null as string | null, html = null as string | null;
  const anexos: Anexo[] = [];
  const andar = (p: Json) => {
    if (!p) return;
    const tipo = (p.mimeType ?? "").toLowerCase();
    if (p.filename && (p.body?.attachmentId || p.body?.data)) {
      anexos.push({ nome: p.filename, tipo: tipo || "application/octet-stream", tamanho: p.body?.size ?? 0, parte: p.partId ?? "" });
    } else if (tipo === "text/plain" && p.body?.data && texto === null) {
      texto = b64urlTexto(p.body.data);
    } else if (tipo === "text/html" && p.body?.data && html === null) {
      html = b64urlTexto(p.body.data);
    }
    for (const f of p.parts ?? []) andar(f);
  };
  andar(payload);
  if (!texto && html) texto = htmlParaTexto(html);
  return { texto, html, anexos };
}
function htmlParaTexto(h: string): string {
  return h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
}

interface Caixa { id: string; endereco: string; nome: string; tipo: string; assinatura: string | null }

/** Guarda uma mensagem do Gmail nas caixas certas. Devolve quantas conversas foram tocadas. */
async function guardarMensagem(db: SupabaseClient, token: string, id: string, caixas: Caixa[]): Promise<number> {
  const { data: ja } = await db.from("email_mensagens").select("id").eq("gmail_id", id).limit(1);
  if (ja?.length) return 0;
  let m: Json;
  try {
    m = await gmail(token, `/messages/${id}?format=full`);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return 0; // apagada no meio do caminho
    throw e;
  }
  const rotulos: string[] = m.labelIds ?? [];
  if (rotulos.some((r) => ["SPAM", "TRASH", "DRAFT"].includes(r))) return 0;
  const enviada = rotulos.includes("SENT");
  const de = cab(m, "From"), para = cab(m, "To"), cc = cab(m, "Cc");
  const alvo = caixasAlvo(m, caixas, enviada);
  if (!alvo.size) return 0;
  const { texto, html, anexos } = lerCorpo(m.payload);
  const quando = new Date(Number(m.internalDate) || Date.now()).toISOString();
  const assunto = cab(m, "Subject");
  // Alerta de golpe (0191): só nos recebidos
  let alerta: Alerta[] = [];
  if (!enviada) {
    const remetente = enderecos(de)[0] ?? "";
    alerta = analisarGolpe({
      de, remetente, responderPara: cab(m, "Reply-To"), assunto, texto, anexos,
      autenticacao: cabTodos(m, "Authentication-Results").join(" ") || cab(m, "ARC-Authentication-Results"),
      remetenteConhecido: await remetenteConhecido(db, remetente, caixas),
    });
  }
  for (const caixaId of alvo) {
    const conversaId = await conversaDoFio(db, caixaId, m.threadId, assunto);
    const { error } = await db.from("email_mensagens").insert({
      conversa_id: conversaId, gmail_id: id, direcao: enviada ? "enviada" : "recebida", de, para, cc, assunto,
      texto: texto?.slice(0, 200_000) ?? null, html: html && html.length <= 800_000 ? html : null,
      message_id: cab(m, "Message-ID") ?? cab(m, "Message-Id"), referencias: cab(m, "References"),
      anexos, quando, alerta,
    });
    if (error && !/duplicate key/.test(error.message)) throw new Error(error.message);
    if (!error) await atualizarConversa(db, conversaId, { enviada, quando, de, para, previa: m.snippet ?? texto ?? "", anexo: anexos.length > 0, alerta: nivelMaior(alerta) });
  }
  return alvo.size;
}

/** Em quais caixas este e-mail deve aparecer (recebido: pelos destinatários; enviado: pelo remetente). */
function caixasAlvo(m: Json, caixas: Caixa[], enviada: boolean): Set<string> {
  const porEndereco = new Map(caixas.map((c) => [c.endereco, c]));
  const alvo = new Set<string>();
  const candidatos = enviada
    ? enderecos(cab(m, "From"))
    : [...enderecos(cab(m, "To")), ...enderecos(cab(m, "Cc")), ...cabTodos(m, "Delivered-To").flatMap(enderecos), ...enderecos(cab(m, "X-Original-To"))];
  for (const e of candidatos) if (porEndereco.has(e) && porEndereco.get(e)!.tipo !== "geral") alvo.add(porEndereco.get(e)!.id);
  if (!alvo.size) {
    const geral = caixas.find((c) => c.tipo === "geral");
    if (geral) alvo.add(geral.id);
  }
  return alvo;
}

/** A clínica já trocou e-mail com este endereço antes? (endereços da própria clínica contam como conhecidos) */
async function remetenteConhecido(db: SupabaseClient, email: string, caixas: Caixa[]): Promise<boolean> {
  if (!email) return false;
  if (caixas.some((c) => c.endereco === email) || email.endsWith("@cmdolhos.com.br")) return true;
  const padrao = `%${email.replace(/[%_\\]/g, (x) => "\\" + x)}%`;
  const { data } = await db.from("email_mensagens").select("id")
    .or(`and(direcao.eq.enviada,para.ilike.${padrao}),and(direcao.eq.enviada,cc.ilike.${padrao}),and(direcao.eq.recebida,de.ilike.${padrao})`)
    .limit(1);
  return !!data?.length;
}

async function conversaDoFio(db: SupabaseClient, caixaId: string, fio: string, assunto: string | null): Promise<string> {
  const { data } = await db.from("email_conversas").select("id").eq("caixa_id", caixaId).eq("gmail_thread_id", fio).maybeSingle();
  if (data) return data.id;
  const { data: nova, error } = await db.from("email_conversas")
    .upsert({ caixa_id: caixaId, gmail_thread_id: fio, assunto }, { onConflict: "caixa_id,gmail_thread_id" })
    .select("id").single();
  if (error) throw new Error(error.message);
  return nova.id;
}

async function atualizarConversa(db: SupabaseClient, conversaId: string, d: {
  enviada: boolean; quando: string; de: string | null; para: string | null; previa: string; anexo: boolean;
  alerta?: "alto" | "atencao" | null;
}) {
  const { data: c } = await db.from("email_conversas")
    .select("ultima_mensagem_em, ultima_recebida_em, ultima_enviada_em, qtd_mensagens, tem_anexo, contato, alerta").eq("id", conversaId).single();
  if (!c) return;
  const maisNova = !c.ultima_mensagem_em || d.quando >= c.ultima_mensagem_em;
  const upd: Record<string, unknown> = { qtd_mensagens: (c.qtd_mensagens ?? 0) + 1, tem_anexo: c.tem_anexo || d.anexo };
  if (d.alerta && c.alerta !== "alto") upd.alerta = d.alerta;
  if (maisNova) {
    upd.ultima_mensagem_em = d.quando;
    upd.previa = d.previa.replace(/\s+/g, " ").slice(0, 240);
  }
  if (d.enviada) {
    if (!c.ultima_enviada_em || d.quando > c.ultima_enviada_em) upd.ultima_enviada_em = d.quando;
    if (!c.contato) upd.contato = d.para;
  } else {
    if (!c.ultima_recebida_em || d.quando > c.ultima_recebida_em) upd.ultima_recebida_em = d.quando;
    upd.contato = maisNova || !c.contato ? d.de : c.contato;
    if (maisNova) { upd.nao_lida = true; upd.arquivada = false; }
  }
  await db.from("email_conversas").update(upd).eq("id", conversaId);
}

async function sincronizar(db: SupabaseClient): Promise<{ novas: number }> {
  const g = await lerGoogle(db);
  const token = await tokenAcesso(g);
  const { data: cx } = await db.from("email_caixas").select("id, endereco, nome, tipo, assinatura").eq("ativo", true);
  const caixas = (cx ?? []) as Caixa[];
  const ids: string[] = [];
  let historico = g.historico_id;
  let novoHistorico: string | null = null;

  const listarRecentes = async (q: string, max: number) => {
    let pagina: string | undefined;
    do {
      const j = await gmail(token, `/messages?q=${encodeURIComponent(q)}&maxResults=100${pagina ? `&pageToken=${pagina}` : ""}`);
      for (const x of j.messages ?? []) ids.push(x.id);
      pagina = j.nextPageToken;
    } while (pagina && ids.length < max);
  };

  if (!historico) {
    const perfil = await gmail(token, "/profile");
    novoHistorico = String(perfil.historyId);
    await listarRecentes("newer_than:30d -in:spam -in:trash -in:drafts", 300);
  } else {
    try {
      let pagina: string | undefined;
      do {
        const j = await gmail(token, `/history?startHistoryId=${historico}&historyTypes=messageAdded&maxResults=500${pagina ? `&pageToken=${pagina}` : ""}`);
        for (const h of j.history ?? []) for (const a of h.messagesAdded ?? []) ids.push(a.message.id);
        novoHistorico = String(j.historyId ?? historico);
        pagina = j.nextPageToken;
      } while (pagina);
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
      // ponto antigo demais: recomeça pelos últimos dias
      const perfil = await gmail(token, "/profile");
      novoHistorico = String(perfil.historyId);
      historico = null;
      await listarRecentes("newer_than:3d -in:spam -in:trash -in:drafts", 300);
    }
  }

  let novas = 0;
  const unicos = [...new Set(ids)].reverse(); // mais antigas primeiro
  const inicio = Date.now();
  let parouNo = -1;
  for (let i = 0; i < unicos.length; i++) {
    if (Date.now() - inicio > 100_000) { parouNo = i; break; } // não estoura o tempo da função
    novas += await guardarMensagem(db, token, unicos[i], caixas);
  }
  // Só avança o ponto de leitura se terminou tudo (senão, a próxima rodada continua; repetidas são ignoradas)
  const gravar: Record<string, unknown> = { ultima_sinc: new Date().toISOString(), ultimo_erro: null };
  if (parouNo < 0 && novoHistorico) gravar.historico_id = novoHistorico;
  await gravarGoogle(db, gravar);
  return { novas };
}

// ---------- Envio ----------
const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const quebrar = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const cabUtf8 = (s: string) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(new TextEncoder().encode(s))}?=`;
const semQuebra = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

function montarMime(d: {
  de: string; para: string; cc: string; assunto: string; texto: string; inReplyTo?: string | null; referencias?: string | null;
  arquivos: { nome: string; tipo: string; bytes: Uint8Array }[];
}): Uint8Array {
  const fronteira = "cmd_" + crypto.randomUUID().replace(/-/g, "");
  const linhas: string[] = [
    `From: ${d.de}`,
    `To: ${semQuebra(d.para)}`,
    ...(d.cc ? [`Cc: ${semQuebra(d.cc)}`] : []),
    `Subject: ${cabUtf8(semQuebra(d.assunto))}`,
    "MIME-Version: 1.0",
    ...(d.inReplyTo ? [`In-Reply-To: ${d.inReplyTo}`] : []),
    ...(d.referencias ? [`References: ${semQuebra(d.referencias)}`] : []),
    `Content-Type: multipart/mixed; boundary="${fronteira}"`,
    "",
    `--${fronteira}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    quebrar(b64(new TextEncoder().encode(d.texto))),
  ];
  for (const a of d.arquivos) {
    const nome = cabUtf8(a.nome.replace(/["\r\n]/g, ""));
    linhas.push(
      `--${fronteira}`,
      `Content-Type: ${a.tipo || "application/octet-stream"}; name="${nome}"`,
      `Content-Disposition: attachment; filename="${nome}"`,
      "Content-Transfer-Encoding: base64",
      "",
      quebrar(b64(a.bytes)),
    );
  }
  linhas.push(`--${fronteira}--`, "");
  return new TextEncoder().encode(linhas.join("\r\n"));
}

async function enviarGmail(token: string, mime: Uint8Array, fio: string | null): Promise<{ id: string; threadId: string }> {
  const fronteira = "env_" + crypto.randomUUID().replace(/-/g, "");
  const inicio = new TextEncoder().encode(
    `--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fio ? { threadId: fio } : {})}\r\n` +
    `--${fronteira}\r\nContent-Type: message/rfc822\r\n\r\n`);
  const fim = new TextEncoder().encode(`\r\n--${fronteira}--`);
  const corpo = new Uint8Array(inicio.length + mime.length + fim.length);
  corpo.set(inicio); corpo.set(mime, inicio.length); corpo.set(fim, inicio.length + mime.length);
  return await gmail(token, "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart", {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${fronteira}` }, body: corpo,
  });
}

/** Baixa um anexo de uma mensagem recebida (pelo número da parte). */
async function baixarAnexoGmail(token: string, gmailId: string, parte: string): Promise<Uint8Array | null> {
  const m = await gmail(token, `/messages/${gmailId}?format=full`);
  let achada: Json = null;
  const andar = (p: Json) => { if (!p || achada) return; if (p.partId === parte) achada = p; for (const f of p.parts ?? []) andar(f); };
  andar(m.payload);
  if (!achada) return null;
  if (achada.body?.data) return b64urlParaBytes(achada.body.data);
  const j = await gmail(token, `/messages/${gmailId}/attachments/${achada.body.attachmentId}`);
  return b64urlParaBytes(j.data);
}

// ---------- Servidor ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // ---- Volta do Google depois de autorizar a conta ----
  if (req.method === "GET") {
    const u = new URL(req.url);
    const code = u.searchParams.get("code"), state = u.searchParams.get("state");
    if (u.searchParams.get("error")) return pagina("Conexão cancelada", "O Google não autorizou o acesso. Tente de novo pela tela Cadastros → E-mail.", false);
    if (!code || !state) return pagina("Endereço inválido", "Abra a conexão pela tela Cadastros → E-mail do sistema.", false);
    const g = await lerGoogle(db);
    const vencido = !g.estado_oauth_em || Date.now() - new Date(g.estado_oauth_em).getTime() > 30 * 60_000;
    if (!g.estado_oauth || g.estado_oauth !== state || vencido) {
      return pagina("Pedido vencido", "Este pedido de conexão expirou. Clique de novo em “Conectar com o Google” no sistema.", false);
    }
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: g.client_id ?? "", client_secret: g.client_secret ?? "", redirect_uri: URL_FUNCAO, grant_type: "authorization_code",
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.refresh_token) {
      return pagina("Não deu certo", `O Google não devolveu o acesso (${j.error_description ?? j.error ?? r.status}). Tente de novo.`, false);
    }
    tokenCache = { token: j.access_token, ate: Date.now() + (j.expires_in ?? 3600) * 1000 };
    let conta = "";
    try { conta = (await gmail(j.access_token, "/profile")).emailAddress ?? ""; } catch { /* segue */ }
    await gravarGoogle(db, { refresh_token: j.refresh_token, conta, estado_oauth: null, historico_id: null, ultimo_erro: null });
    return pagina("E-mail conectado ✓", `A conta <b>${conta}</b> foi ligada ao sistema. Os e-mails dos últimos 30 dias começam a aparecer em poucos minutos.`, true);
  }
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405);

  // ---- Agendador (a cada 2 minutos) ----
  const chave = req.headers.get("x-extrator-chave");
  if (chave) {
    const { data: ok } = await db.rpc("whatsapp_extrator_chave_ok", { p_chave: chave });
    if (!ok) return resposta({ erro: "Chave inválida" }, 401);
    try {
      return resposta(await sincronizar(db));
    } catch (e) {
      await gravarGoogle(db, { ultimo_erro: (e as Error).message });
      return resposta({ erro: (e as Error).message }, 500);
    }
  }

  // ---- Pessoa da equipe ----
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u, error: eu } = await db.auth.getUser(jwt);
  if (eu || !u?.user?.email) return resposta({ erro: "Sessão inválida. Entre novamente." }, 401);
  const { data: eu_prof } = await db.from("profissionais").select("id, nome, funcao, ativo")
    .eq("email", u.user.email.toLowerCase()).maybeSingle();
  if (!eu_prof?.ativo) return resposta({ erro: "Você não tem acesso ao e-mail da clínica." }, 403);
  // Cliente com o login da pessoa: as regras do banco (RLS) dizem quais caixas ela vê
  const comoEu = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const admin = eu_prof.funcao === "admin";

  let corpo: Json; let form: FormData | null = null;
  try {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      form = await req.formData();
      corpo = { acao: "enviar" };
    } else corpo = await req.json();
  } catch {
    return resposta({ erro: "Dados inválidos (os anexos podem ser grandes demais)." }, 400);
  }

  try {
    if (corpo.acao === "conectar") {
      if (!admin) return resposta({ erro: "Só a administração conecta a conta do Google." }, 403);
      const g = await lerGoogle(db);
      if (!g.client_id || !g.client_secret) return resposta({ erro: "Primeiro cadastre o Client ID e o Client Secret do Google." }, 400);
      const estado = crypto.randomUUID();
      await gravarGoogle(db, { estado_oauth: estado });
      const p = new URLSearchParams({
        client_id: g.client_id, redirect_uri: URL_FUNCAO, response_type: "code", scope: ESCOPO,
        access_type: "offline", prompt: "consent", state: estado, login_hint: "clinica@cmdolhos.com.br",
      });
      return resposta({ url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` });
    }

    if (corpo.acao === "desconectar") {
      if (!admin) return resposta({ erro: "Só a administração desconecta a conta do Google." }, 403);
      await gravarGoogle(db, { refresh_token: null, historico_id: null });
      tokenCache = null;
      return resposta({ ok: true });
    }

    if (corpo.acao === "sincronizar") {
      try {
        return resposta(await sincronizar(db));
      } catch (e) {
        await gravarGoogle(db, { ultimo_erro: (e as Error).message });
        throw e;
      }
    }

    // ---- Spam (0191): ver o que o Google segurou, tirar de lá, ou mandar para lá ----
    if (corpo.acao === "spam_listar" || corpo.acao === "nao_e_spam") {
      const { data: visiveis } = await comoEu.from("email_caixas").select("id, endereco, nome, tipo, assinatura").eq("ativo", true);
      const minhas = new Map(((visiveis ?? []) as Caixa[]).map((c) => [c.id, c]));
      const { data: todas } = await db.from("email_caixas").select("id, endereco, nome, tipo, assinatura").eq("ativo", true);
      const caixas = (todas ?? []) as Caixa[];
      const token = await tokenAcesso(await lerGoogle(db));
      const META = "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Delivered-To&metadataHeaders=X-Original-To&metadataHeaders=Reply-To";

      if (corpo.acao === "nao_e_spam") {
        const id = String(corpo.gmail_id ?? "");
        const m = await gmail(token, `/messages/${encodeURIComponent(id)}?${META}`);
        if (![...caixasAlvo(m, caixas, false)].some((c) => minhas.has(c))) return resposta({ erro: "Este e-mail não é de uma caixa sua." }, 403);
        await gmail(token, `/messages/${encodeURIComponent(id)}/modify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ removeLabelIds: ["SPAM"], addLabelIds: ["INBOX"] }),
        });
        await guardarMensagem(db, token, id, caixas);
        // se já estava no sistema (alguém tinha marcado como spam), volta para a entrada
        const { data: ja } = await db.from("email_mensagens").select("conversa_id").eq("gmail_id", id);
        for (const j of ja ?? []) await db.from("email_conversas").update({ arquivada: false }).eq("id", j.conversa_id);
        return resposta({ ok: true });
      }

      const lista = await gmail(token, `/messages?q=${encodeURIComponent("in:spam newer_than:30d")}&maxResults=60`);
      const itens: Json[] = [];
      for (const x of lista.messages ?? []) {
        const m = await gmail(token, `/messages/${x.id}?${META}`);
        const alvo = [...caixasAlvo(m, caixas, false)].filter((c) => minhas.has(c));
        if (!alvo.length) continue;
        itens.push({
          gmail_id: x.id, de: cab(m, "From"), para: cab(m, "To"), assunto: cab(m, "Subject"), previa: m.snippet ?? "",
          quando: new Date(Number(m.internalDate) || Date.now()).toISOString(),
          caixas: alvo.map((c) => minhas.get(c)!.nome),
        });
      }
      return resposta({ itens });
    }

    if (corpo.acao === "marcar_spam") {
      const { data: conv } = await comoEu.from("email_conversas").select("id").eq("id", corpo.conversa_id).maybeSingle();
      if (!conv) return resposta({ erro: "Conversa não encontrada ou sem acesso." }, 404);
      const { data: msgs } = await db.from("email_mensagens").select("gmail_id").eq("conversa_id", conv.id).eq("direcao", "recebida");
      const token = await tokenAcesso(await lerGoogle(db));
      for (const m of msgs ?? []) {
        try {
          await gmail(token, `/messages/${encodeURIComponent(m.gmail_id)}/modify`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] }),
          });
        } catch (e) { if ((e as { status?: number }).status !== 404) throw e; }
      }
      await db.from("email_conversas").update({ arquivada: true }).eq("id", conv.id);
      return resposta({ ok: true });
    }

    if (corpo.acao === "anexo") {
      const { data: msg } = await comoEu.from("email_mensagens").select("id, gmail_id, anexos").eq("id", corpo.mensagem_id).maybeSingle();
      if (!msg) return resposta({ erro: "E-mail não encontrado ou sem acesso." }, 404);
      const lista = (msg.anexos ?? []) as Anexo[];
      const a = lista[Number(corpo.indice)];
      if (!a) return resposta({ erro: "Anexo não encontrado." }, 404);
      let bytes: Uint8Array | null = null;
      if (a.caminho) {
        const { data } = await db.storage.from("email-anexos").download(a.caminho);
        if (data) bytes = new Uint8Array(await data.arrayBuffer());
      }
      if (!bytes) {
        const token = await tokenAcesso(await lerGoogle(db));
        bytes = await baixarAnexoGmail(token, msg.gmail_id, a.parte);
        if (!bytes) return resposta({ erro: "O anexo não está mais no Google." }, 404);
        const caminho = `${msg.id}/${Number(corpo.indice)}`;
        const { error } = await db.storage.from("email-anexos").upload(caminho, bytes, { contentType: a.tipo, upsert: true });
        if (!error) {
          lista[Number(corpo.indice)] = { ...a, caminho };
          await db.from("email_mensagens").update({ anexos: lista }).eq("id", msg.id);
        }
      }
      return new Response(new Blob([bytes as BlobPart]), {
        headers: { ...cors, "Content-Type": a.tipo || "application/octet-stream",
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nome)}` },
      });
    }

    if (corpo.acao === "enviar" && form) {
      const caixaId = String(form.get("caixa_id") ?? "");
      const { data: caixa } = await comoEu.from("email_caixas").select("id, endereco, nome, tipo, assinatura").eq("id", caixaId).maybeSingle();
      if (!caixa) return resposta({ erro: "Você não tem acesso a esta caixa de e-mail." }, 403);
      const para = String(form.get("para") ?? "").trim(), cc = String(form.get("cc") ?? "").trim();
      const assunto = String(form.get("assunto") ?? "").trim(), texto = String(form.get("texto") ?? "");
      if (!enderecos(para).length) return resposta({ erro: "Coloque pelo menos um e-mail válido no campo “Para”." }, 400);
      if (!assunto) return resposta({ erro: "Escreva o assunto do e-mail." }, 400);

      // Mensagem original (resposta ou encaminhamento): tem que ser de uma conversa que a pessoa vê
      let original: Json = null, conversa: Json = null;
      const respondeA = String(form.get("responde_a") ?? "");
      if (respondeA) {
        const { data } = await comoEu.from("email_mensagens").select("id, gmail_id, conversa_id, message_id, referencias, anexos").eq("id", respondeA).maybeSingle();
        if (!data) return resposta({ erro: "E-mail original não encontrado." }, 404);
        original = data;
      }
      const modo = String(form.get("modo") ?? "novo");
      const conversaId = String(form.get("conversa_id") ?? "") || (modo === "responder" ? original?.conversa_id : "");
      if (conversaId) {
        const { data } = await comoEu.from("email_conversas").select("id, caixa_id, gmail_thread_id").eq("id", conversaId).maybeSingle();
        if (!data) return resposta({ erro: "Conversa não encontrada." }, 404);
        conversa = data;
      }

      const g = await lerGoogle(db);
      const token = await tokenAcesso(g);
      const arquivos: { nome: string; tipo: string; bytes: Uint8Array }[] = [];
      for (const f of form.getAll("arquivos")) {
        if (f instanceof File) arquivos.push({ nome: f.name, tipo: f.type || "application/octet-stream", bytes: new Uint8Array(await f.arrayBuffer()) });
      }
      if (modo === "encaminhar" && original && form.get("encaminhar_anexos") === "1") {
        for (const a of (original.anexos ?? []) as Anexo[]) {
          let bytes: Uint8Array | null = null;
          if (a.caminho) {
            const { data } = await db.storage.from("email-anexos").download(a.caminho);
            if (data) bytes = new Uint8Array(await data.arrayBuffer());
          }
          if (!bytes && a.parte) bytes = await baixarAnexoGmail(token, original.gmail_id, a.parte);
          if (bytes) arquivos.push({ nome: a.nome, tipo: a.tipo, bytes });
        }
      }
      const total = arquivos.reduce((s, a) => s + a.bytes.length, 0);
      if (total * 1.37 > LIMITE_ENVIO) return resposta({ erro: "Os anexos passam do limite do Gmail (25 MB por e-mail). Mande em mais de um e-mail." }, 413);

      const corpoFinal = caixa.assinatura ? `${texto.trimEnd()}\n\n--\n${caixa.assinatura}` : texto;
      const de = `${cabUtf8(caixa.nome.replace(/[<>"]/g, ""))} <${caixa.endereco}>`;
      const responde = modo === "responder" && original;
      const mime = montarMime({
        de, para, cc, assunto, texto: corpoFinal, arquivos,
        inReplyTo: responde ? original.message_id : null,
        referencias: responde ? [original.referencias, original.message_id].filter(Boolean).join(" ") : null,
      });
      const env = await enviarGmail(token, mime, responde ? conversa?.gmail_thread_id ?? null : null);

      // Guarda na conversa (a sincronização vai reconhecer pelo id e não duplica)
      const caixaDaConversa = conversa && conversa.caixa_id === caixa.id ? conversa.id : null;
      const convId = caixaDaConversa ?? await conversaDoFio(db, caixa.id, env.threadId, assunto);
      const { data: nova } = await db.from("email_mensagens").insert({
        conversa_id: convId, gmail_id: env.id, direcao: "enviada", de: `${caixa.nome} <${caixa.endereco}>`, para, cc: cc || null,
        assunto, texto: corpoFinal, anexos: [], quando: new Date().toISOString(), enviado_por: eu_prof.id,
      }).select("id").single();
      // Cópia dos anexos enviados no Storage (para abrir depois sem ir ao Google)
      if (nova && arquivos.length) {
        const lista: Anexo[] = [];
        for (let i = 0; i < arquivos.length; i++) {
          const caminho = `${nova.id}/${i}`;
          const { error } = await db.storage.from("email-anexos").upload(caminho, arquivos[i].bytes, { contentType: arquivos[i].tipo, upsert: true });
          lista.push({ nome: arquivos[i].nome, tipo: arquivos[i].tipo, tamanho: arquivos[i].bytes.length, parte: "", ...(error ? {} : { caminho }) });
        }
        await db.from("email_mensagens").update({ anexos: lista }).eq("id", nova.id);
      }
      await atualizarConversa(db, convId, { enviada: true, quando: new Date().toISOString(), de: caixa.endereco, para, previa: texto, anexo: arquivos.length > 0 });
      return resposta({ ok: true, conversa_id: convId });
    }

    return resposta({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("email", (e as Error).message);
    return resposta({ erro: (e as Error).message }, 500);
  }
});
