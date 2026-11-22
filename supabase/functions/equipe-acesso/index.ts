// Cria ou redefine a senha de acesso de um membro da equipe.
// Só um administrador (logado) pode chamar. A pessoa precisa já estar
// cadastrada em "profissionais". Ela troca a senha no primeiro acesso.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, chaveServico, { auth: { persistSession: false } });

  // Quem está chamando?
  const bootstrap = Deno.env.get("BOOTSTRAP_TOKEN") ?? "";
  const tokenBootstrap = req.headers.get("x-bootstrap-token") ?? "";
  const viaBootstrap = bootstrap.length >= 32 && tokenBootstrap === bootstrap;

  if (!viaBootstrap) {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: eu } = await admin.auth.getUser(jwt);
    if (eu || !u?.user?.email) return resposta({ erro: "Sessão inválida. Entre novamente." }, 401);
    const { data: chamador } = await admin
      .from("profissionais")
      .select("funcao, ativo")
      .eq("email", u.user.email.toLowerCase())
      .maybeSingle();
    if (!chamador || !chamador.ativo || chamador.funcao !== "admin") {
      return resposta({ erro: "Somente administradores podem criar acessos." }, 403);
    }
  }

  let corpo: { email?: string; senha?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Dados inválidos" }, 400);
  }
  const email = (corpo.email ?? "").trim().toLowerCase();
  const senha = corpo.senha ?? "";
  if (!email || senha.length < 8) {
    return resposta({ erro: "Informe o e-mail e uma senha temporária com pelo menos 8 caracteres." }, 400);
  }

  const { data: prof } = await admin
    .from("profissionais").select("id, ativo").eq("email", email).maybeSingle();
  if (!prof || !prof.ativo) {
    return resposta({ erro: "Este e-mail não está cadastrado (ou está inativo) na equipe." }, 404);
  }

  // Já existe conta de acesso?
  let existente: { id: string } | undefined;
  for (let pagina = 1; pagina <= 20 && !existente; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) return resposta({ erro: error.message }, 500);
    existente = data.users.find((x) => x.email?.toLowerCase() === email);
    if (data.users.length < 200) break;
  }

  if (existente) {
    const { error } = await admin.auth.admin.updateUserById(existente.id, {
      password: senha,
      user_metadata: { trocar_senha: true },
      ban_duration: "none",
    });
    if (error) return resposta({ erro: error.message }, 500);
    return resposta({ ok: true, acao: "senha_redefinida" });
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { trocar_senha: true },
  });
  if (error) return resposta({ erro: error.message }, 500);
  return resposta({ ok: true, acao: "acesso_criado" });
});
