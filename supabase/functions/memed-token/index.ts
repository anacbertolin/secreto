// Memed (receita digital) — devolve o token do médico para abrir o receituário da Memed na tela.
//
// Quem chama: médico logado (POST {}). O token só é dado ao PRÓPRIO médico.
// Fluxo (documentação Memed, "Autenticação e prescritor"):
//   1. GET  {API}/sinapse-prescricao/usuarios/{external_id}?api-key&secret-key  → token
//   2. se não existir (404): POST {API}/sinapse-prescricao/usuarios?api-key&secret-key com nome, sobrenome,
//      CPF, CRM+UF, nascimento (obrigatórios) → token
// As chaves NUNCA vão para a tela. Produção: segredos MEMED_API_KEY e MEMED_SECRET_KEY no Supabase.
// Homologação: a Memed publica um par de chaves fixo e público para testes (usado se os segredos não existirem).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// deno-lint-ignore no-explicit-any
type Json = any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

const AMBIENTES = {
  homologacao: {
    api: "https://integrations.api.memed.com.br/v1",
    script: "https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js",
    // par de chaves PÚBLICO de homologação, publicado na documentação da Memed (não é segredo)
    chave: "iJGiB4kjDGOLeDFPWMG3no9VnN7Abpqe3w1jEFm6olkhkZD6oSfSmYCm",
    segredo: "Xe8M5GvBGCr4FStKfxXKisRo3SfYKI7KrTMkJpCAstzu2yXVN4av5nmL",
  },
  producao: { api: "https://api.memed.com.br/v1", script: "https://partners.memed.com.br/integration.js", chave: "", segredo: "" },
} as const;

function erroMemed(j: Json, status: number): string {
  const d = j?.errors?.[0]?.detail ?? j?.errors?.[0]?.title ?? j?.message;
  return d ? `Memed: ${d}` : `Memed respondeu erro ${status}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return resposta({ erro: "Entre no sistema." }, 401);

  // Cliente com o login de quem pediu: só lê o que essa pessoa pode ler (inclusive o próprio CPF)
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: u, error: eu } = await db.auth.getUser(jwt);
  if (eu || !u?.user?.email) return resposta({ erro: "Sessão inválida. Entre novamente." }, 401);
  const { data: prof } = await db.from("profissionais")
    .select("id, nome, email, funcao, ativo, conselho, numero_conselho, uf_conselho")
    .eq("email", u.user.email.toLowerCase()).maybeSingle();
  if (!prof?.ativo || prof.funcao !== "medico") return resposta({ erro: "Só médicos prescrevem na Memed." }, 403);

  const { data: cfg } = await db.from("memed_config").select("ligado, ambiente").eq("id", 1).maybeSingle();
  if (!cfg?.ligado) return resposta({ erro: "A receita digital Memed está desligada (Cadastros → Receita digital)." }, 403);
  const amb = AMBIENTES[(cfg.ambiente === "producao" ? "producao" : "homologacao") as keyof typeof AMBIENTES];
  const apiKey = Deno.env.get("MEMED_API_KEY") || amb.chave;
  const secret = Deno.env.get("MEMED_SECRET_KEY") || amb.segredo;
  if (!apiKey || !secret) return resposta({ erro: "Faltam as chaves de produção da Memed nos segredos do Supabase (MEMED_API_KEY e MEMED_SECRET_KEY)." }, 503);

  const { data: dp } = await db.from("profissionais_dados_pessoais").select("cpf, data_nascimento, sexo, telefone").eq("profissional_id", prof.id).maybeSingle();
  const crm = String(prof.numero_conselho ?? "").replace(/\D/g, "");
  const faltam = [!dp?.cpf && "CPF", !dp?.data_nascimento && "data de nascimento", !crm && "número do CRM", !prof.uf_conselho && "UF do CRM"].filter(Boolean);
  if (faltam.length) return resposta({ erro: `Complete o seu cadastro para usar a Memed: falta ${faltam.join(", ")}. (A administração preenche em Cadastros → Equipe.)` }, 400);

  const externalId = `consumed-${prof.id}`;
  const qs = `api-key=${encodeURIComponent(apiKey)}&secret-key=${encodeURIComponent(secret)}`;
  const cab = { Accept: "application/vnd.api+json", "Content-Type": "application/json", "Cache-Control": "no-cache" };

  try {
    // 1) já cadastrado?
    let r = await fetch(`${amb.api}/sinapse-prescricao/usuarios/${encodeURIComponent(externalId)}?${qs}`, { headers: cab });
    let j: Json = await r.json().catch(() => ({}));
    if (r.status === 404) {
      // 2) cadastra o prescritor
      const partes = String(prof.nome).replace(/^(dra?\.?)\s+/i, "").trim().split(/\s+/);
      const [a, m, d] = [dp!.data_nascimento!.slice(0, 4), dp!.data_nascimento!.slice(5, 7), dp!.data_nascimento!.slice(8, 10)];
      r = await fetch(`${amb.api}/sinapse-prescricao/usuarios?${qs}`, {
        method: "POST", headers: cab,
        body: JSON.stringify({ data: { type: "usuarios", attributes: {
          external_id: externalId,
          nome: partes[0], sobrenome: partes.slice(1).join(" ") || partes[0],
          cpf: dp!.cpf,
          board: { board_code: String(prof.conselho || "CRM").toUpperCase(), board_number: crm, board_state: String(prof.uf_conselho).toUpperCase() },
          email: prof.email ?? undefined,
          telefone: dp!.telefone ?? undefined,
          sexo: dp!.sexo ?? undefined,
          data_nascimento: `${d}/${m}/${a}`,
        } } }),
      });
      j = await r.json().catch(() => ({}));
    }
    if (!r.ok) return resposta({ erro: erroMemed(j, r.status) }, 502);
    const token = j?.data?.attributes?.token;
    if (!token) return resposta({ erro: "A Memed não devolveu o token do médico." }, 502);
    return resposta({ token, script: amb.script, ambiente: cfg.ambiente });
  } catch (_e) {
    return resposta({ erro: "Não foi possível falar com a Memed agora. Tente de novo em instantes." }, 502);
  }
});
