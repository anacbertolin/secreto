// Recebe os avisos da Meta (WhatsApp Cloud API): mensagens dos pacientes e a
// situação das mensagens enviadas (entregue, lida, falhou).
//
// Publicada SEM exigir login (verify_jwt = false), porque quem chama é a Meta.
// A segurança vem da assinatura: a Meta assina cada aviso com a "chave secreta
// do aplicativo" (WHATSAPP_APP_SECRET). Aviso sem assinatura válida é recusado.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   WHATSAPP_VERIFY_TOKEN  senha combinada para a Meta validar este endereço
//   WHATSAPP_APP_SECRET    "Chave secreta do aplicativo" (Meta → Configurações do app → Básico)
//   WHATSAPP_PHONE_NUMBER_ID             número da clínica          → conversas do setor "clinica"
//   WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID  número da Orientação Cirúrgica → conversas do setor "orientacao"
// Os dois números ficam na mesma conta da Meta, então chegam pelo mesmo endereço (e mesma assinatura).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const TIPOS: Record<string, string> = {
  text: "texto", button: "botao", interactive: "botao", image: "imagem", audio: "audio", video: "video",
  document: "documento", sticker: "figurinha", location: "localizacao", contacts: "contato", reaction: "reacao",
};
const SITUACOES: Record<string, string> = { sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou" };

// deno-lint-ignore no-explicit-any
type Json = any;

async function assinaturaValida(corpo: string, cabecalho: string | null, segredo: string): Promise<boolean> {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo)));
  const esperado = Array.from(assinatura, (b) => b.toString(16).padStart(2, "0")).join("");
  const recebido = cabecalho.slice(7).toLowerCase();
  if (recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return dif === 0;
}

/** Transforma a mensagem da Meta nos campos da tabela whatsapp_mensagens */
function lerMensagem(m: Json) {
  const tipo = TIPOS[m.type] ?? "outro";
  let texto: string | null = null;
  let botao: string | null = null;
  let midia: Json = null;

  switch (m.type) {
    case "text":
      texto = m.text?.body ?? null;
      break;
    case "button": // resposta a botão de modelo (lembrete)
      texto = m.button?.text ?? null;
      botao = m.button?.payload ?? null;
      break;
    case "interactive": {
      const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
      texto = r?.title ?? null;
      botao = r?.id ?? null;
      break;
    }
    case "image": case "audio": case "video": case "document": case "sticker":
      midia = m[m.type];
      texto = midia?.caption ?? null;
      break;
    case "location": {
      const l = m.location ?? {};
      texto = [l.name, l.address, `https://maps.google.com/?q=${l.latitude},${l.longitude}`].filter(Boolean).join(" · ");
      break;
    }
    case "contacts":
      texto = (m.contacts ?? []).map((c: Json) =>
        [c.name?.formatted_name, ...(c.phones ?? []).map((p: Json) => p.phone)].filter(Boolean).join(" ")
      ).join("; ");
      break;
    case "reaction":
      texto = m.reaction?.emoji ? `Reagiu com ${m.reaction.emoji}` : "Removeu a reação";
      break;
    default:
      texto = "(tipo de mensagem que o sistema ainda não mostra — veja no celular)";
  }

  return {
    p_telefone: String(m.from),
    p_wa_id: String(m.id),
    p_tipo: tipo,
    p_texto: texto,
    p_midia_id: midia?.id ?? null,
    p_midia_tipo: midia?.mime_type ?? null,
    p_midia_nome: midia?.filename ?? null,
    p_em_resposta_a: m.context?.id ?? null,
    p_quando: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
    p_botao: botao,
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Validação do endereço (feita uma vez, quando se configura o webhook na Meta)
  if (req.method === "GET") {
    const token = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
    if (url.searchParams.get("hub.mode") === "subscribe" && token.length >= 16 &&
        url.searchParams.get("hub.verify_token") === token) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("Proibido", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });

  // 2) Avisos: só com assinatura válida
  const segredo = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
  const corpo = await req.text();
  if (!segredo) {
    console.error("WHATSAPP_APP_SECRET não configurado: aviso recusado.");
    return new Response("Não configurado", { status: 503 });
  }
  if (!(await assinaturaValida(corpo, req.headers.get("x-hub-signature-256"), segredo))) {
    return new Response("Assinatura inválida", { status: 401 });
  }

  let dados: Json;
  try {
    dados = JSON.parse(corpo);
  } catch {
    return new Response("ok"); // corpo inválido: não adianta a Meta reenviar
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const numeroClinica = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const numeroOrientacao = Deno.env.get("WHATSAPP_ORIENTACAO_PHONE_NUMBER_ID") ?? "";
  let falhou = false;

  for (const entrada of dados.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      if (mudanca.field !== "messages") continue;
      const v = mudanca.value ?? {};
      // Qual número recebeu? Número desconhecido (outro número da conta) é ignorado.
      const idNumero = v.metadata?.phone_number_id ?? "";
      let setor: string | null = null;
      if (numeroOrientacao && idNumero === numeroOrientacao) setor = "orientacao";
      else if (!numeroClinica || !idNumero || idNumero === numeroClinica) setor = "clinica";
      if (!setor) continue;

      const nomes = new Map<string, string>();
      for (const c of v.contacts ?? []) if (c.wa_id) nomes.set(String(c.wa_id), c.profile?.name ?? null);

      for (const m of v.messages ?? []) {
        const args = lerMensagem(m);
        const { error } = await db.rpc("whatsapp_receber", { ...args, p_nome: nomes.get(args.p_telefone) ?? null, p_setor: setor });
        if (error) {
          console.error("Erro ao gravar mensagem recebida", m.id, error.message);
          falhou = true;
        }
      }

      for (const s of v.statuses ?? []) {
        const situacao = SITUACOES[s.status];
        if (!situacao) continue;
        const e = s.errors?.[0];
        const erro = e ? [e.code, e.title, e.error_data?.details ?? e.message].filter(Boolean).join(" · ") : null;
        const { error } = await db.rpc("whatsapp_situacao", { p_wa_id: s.id, p_situacao: situacao, p_erro: erro });
        if (error) {
          console.error("Erro ao gravar situação", s.id, error.message);
          falhou = true;
        }
      }
    }
  }

  // Se algo não gravou, responde erro para a Meta tentar de novo (não duplica: o wa_id é único)
  return new Response(falhou ? "erro" : "ok", { status: falhou ? 500 : 200 });
});
