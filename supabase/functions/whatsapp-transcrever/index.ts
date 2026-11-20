// Transcreve os áudios que os pacientes mandam pelo WhatsApp (Whisper, da OpenAI).
//
// Quem chama (POST, corpo JSON com "acao"):
//   * o banco (gatilho ao chegar um áudio e o agendador a cada 10 min), com o cabeçalho x-extrator-chave:
//       { acao: "transcrever", mensagem_id }   → um áudio
//       { acao: "pendentes" }                  → até 10 áudios que ficaram pendentes
//   (áudios recebidos e também os enviados pela equipe; usa a cópia guardada no Storage quando existe)
//   * a tela do WhatsApp (recepção/admin logados; na Orientação Cirúrgica, quem atende a orientação):
//       { acao: "transcrever", mensagem_id } (botão "Transcrever")
//
// Segredos (Supabase → Edge Functions → Secrets): OPENAI_API_KEY, WHATSAPP_TOKEN (já existe),
// WHATSAPP_API_VERSION (opcional). Sem a chave da OpenAI a função responde que falta configurar.
// O áudio vai para a OpenAI (EUA) só para virar texto; a OpenAI não usa dados da API para treinar a IA.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const GRAPH = () => `https://graph.facebook.com/${Deno.env.get("WHATSAPP_API_VERSION") ?? "v24.0"}`;
const MAX_TENTATIVAS = 3;
// Vocabulário da clínica: ajuda o Whisper a acertar termos e nomes
const DICA = "Conversa de paciente com a recepção de uma clínica de oftalmologia. Consulta, retorno, exame, " +
  "mapeamento de retina, fundo de olho, pressão do olho, catarata, glaucoma, óculos, lente, colírio, convênio, " +
  "Unimed, Amil, Bradesco Saúde, SulAmérica, particular, carteirinha, Dr. Max. " +
  "Pós-operatório, cirurgia, tampão, protetor ocular, olho vermelho, vista embaçada, lacrimejamento.";

const EXTENSAO: Record<string, string> = {
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "m4a", "audio/amr": "amr",
  "audio/wav": "wav", "audio/webm": "webm", "audio/x-m4a": "m4a",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let corpo: { acao?: string; mensagem_id?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Dados inválidos" }, 400);
  }

  // Quem chama: o banco (chave interna) ou recepção/admin logados
  const chave = req.headers.get("x-extrator-chave");
  if (chave) {
    const { data: ok } = await db.rpc("whatsapp_extrator_chave_ok", { p_chave: chave });
    if (ok !== true) return resposta({ erro: "Chave inválida" }, 401);
  } else {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error } = await db.auth.getUser(jwt);
    if (error || !u?.user?.email) return resposta({ erro: "Sessão inválida. Entre novamente." }, 401);
    const { data: p } = await db.from("profissionais").select("funcao, ativo, orientacao_cirurgica")
      .eq("email", u.user.email.toLowerCase()).maybeSingle();
    if (corpo.acao !== "transcrever") return resposta({ erro: "Ação não permitida" }, 403);
    // Quem pede: no número da clínica, recepção/admin; no da Orientação Cirúrgica, quem atende a orientação
    const { data: m } = await db.from("whatsapp_mensagens").select("whatsapp_conversas(setor)")
      .eq("id", String(corpo.mensagem_id ?? "")).maybeSingle();
    // deno-lint-ignore no-explicit-any
    const setor = (m as any)?.whatsapp_conversas?.setor ?? "clinica";
    const pode = !!p?.ativo && (setor === "orientacao" ? p.orientacao_cirurgica === true : ["recepcao", "admin"].includes(p.funcao));
    if (!pode) {
      return resposta({ erro: setor === "orientacao"
        ? "Só quem atende a Orientação Cirúrgica pede transcrição destes áudios."
        : "Só a recepção e a administração pedem transcrição." }, 403);
    }
  }

  if (!Deno.env.get("OPENAI_API_KEY")) {
    return resposta({ erro: "Falta a chave da OpenAI (OPENAI_API_KEY) nos segredos do Supabase." }, 503);
  }
  if (!Deno.env.get("WHATSAPP_TOKEN")) {
    return resposta({ erro: "O WhatsApp ainda não foi ligado (falta o token da Meta)." }, 503);
  }

  if (corpo.acao === "transcrever") {
    const id = String(corpo.mensagem_id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return resposta({ erro: "Mensagem inválida" }, 400);
    const r = await transcrever(db, id);
    return resposta(r, r.ok ? 200 : 502);
  }

  if (corpo.acao === "pendentes") {
    const { data, error } = await db.rpc("whatsapp_transcricao_pendentes", { p_limite: 10 });
    if (error) return resposta({ erro: error.message }, 500);
    const resultados = [];
    for (const m of data ?? []) resultados.push(await transcrever(db, m.id));
    return resposta({ ok: true, feitos: resultados.filter((r) => r.ok).length, total: resultados.length });
  }

  return resposta({ erro: "Ação desconhecida" }, 400);
});

async function transcrever(db: SupabaseClient, id: string): Promise<{ ok: boolean; erro?: string; texto?: string }> {
  const { data: m } = await db.from("whatsapp_mensagens")
    .select("id, tipo, midia_id, midia_tipo, midia_caminho, transcricao_tentativas").eq("id", id).maybeSingle();
  if ((!m?.midia_id && !m?.midia_caminho) || m.tipo !== "audio") return { ok: false, erro: "Áudio não encontrado." };

  try {
    // 1. Pega o áudio: a cópia guardada no Storage ou, se ainda não houver, na Meta
    let audio: Blob | null = null;
    let tipo = (m.midia_tipo ?? "audio/ogg").split(";")[0].trim();
    if (m.midia_caminho) {
      const { data: arqGuardado } = await db.storage.from("whatsapp-midia").download(m.midia_caminho);
      if (arqGuardado) audio = arqGuardado;
    }
    if (!audio) {
      const token = Deno.env.get("WHATSAPP_TOKEN")!;
      const info = await fetch(`${GRAPH()}/${m.midia_id}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await info.json().catch(() => ({}));
      if (!info.ok || !j.url) throw new Error("A Meta não tem mais este áudio (eles ficam cerca de 30 dias).");
      const arq = await fetch(j.url, { headers: { Authorization: `Bearer ${token}` } });
      if (!arq.ok) throw new Error(`Não foi possível baixar o áudio da Meta (HTTP ${arq.status}).`);
      tipo = (m.midia_tipo ?? j.mime_type ?? "audio/ogg").split(";")[0].trim();
      audio = await arq.blob();
    }
    if (audio.size > 25 * 1024 * 1024) throw new Error("Áudio maior que 25 MB (limite do Whisper).");

    // 2. Manda para o Whisper
    const form = new FormData();
    form.append("file", new File([audio], `audio.${EXTENSAO[tipo] ?? "ogg"}`, { type: tipo }));
    form.append("model", "whisper-1");
    form.append("language", "pt");
    form.append("response_format", "text");
    form.append("prompt", DICA);
    const w = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
      body: form,
    });
    const texto = (await w.text()).trim();
    if (!w.ok) {
      let msg = texto;
      try { msg = JSON.parse(texto)?.error?.message ?? texto; } catch { /* texto puro */ }
      if (w.status === 401) throw new Error("A chave da OpenAI é inválida.");
      if (w.status === 429) throw new Error("Limite ou saldo da OpenAI esgotado. Confira os créditos na conta da OpenAI.");
      throw new Error(`OpenAI respondeu erro ${w.status}: ${msg.slice(0, 200)}`);
    }

    // 3. Guarda o texto
    await db.from("whatsapp_mensagens").update({
      transcricao: texto || "(áudio sem fala)", transcricao_situacao: "feita", transcricao_erro: null,
      transcricao_tentativas: (m.transcricao_tentativas ?? 0) + 1,
    }).eq("id", id);
    return { ok: true, texto };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    const tentativas = (m.transcricao_tentativas ?? 0) + 1;
    await db.from("whatsapp_mensagens").update({
      transcricao_tentativas: tentativas, transcricao_erro: msg.slice(0, 500),
      transcricao_situacao: tentativas >= MAX_TENTATIVAS ? "falhou" : "pendente",
    }).eq("id", id);
    console.error("transcrever", id, msg);
    return { ok: false, erro: msg };
  }
}
