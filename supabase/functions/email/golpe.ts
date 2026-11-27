// Alerta de golpe (migração 0191). Analisa um e-mail RECEBIDO e devolve os motivos de desconfiança.
// O Gmail não repassa para outros sistemas a faixa "Tenha cuidado com esta mensagem"; isto cobre essa falta.
// Não bloqueia nada: só avisa quem for ler. Regra de ouro na tela: confirmar por telefone.

export interface Alerta { nivel: "alto" | "atencao"; motivo: string }

const GRATUITOS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br", "live.com", "msn.com",
  "yahoo.com", "yahoo.com.br", "ymail.com", "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "icloud.com",
  "proton.me", "protonmail.com", "gmx.com", "aol.com", "zoho.com",
]);
// Nomes que golpistas costumam imitar (convênios, bancos, órgãos e empresas conhecidas)
const MARCAS = /\b(unimed|bradesco|amil|sul ?am[eé]rica|golden ?cross|hapvida|notredame|geap|cassi|petrobras|caixa|ita[uú]|santander|banco do brasil|nubank|sicoob|sicredi|receita federal|correios|serasa|anvisa|cremerj|cfm|google|microsoft|registro\.br|hostinger|supabase)\b/i;
const ANEXO_PERIGOSO = /\.(exe|scr|bat|cmd|com|pif|js|jse|vbs|vbe|wsf|hta|msi|jar|ps1|lnk|iso|img|html?|svg)$/i;
const ANEXO_COMPACTADO = /\.(zip|rar|7z)$/i;

const DADOS_BANCARIOS = /(troca|trocamos|altera[cç][aã]o|alteramos|mudan[cç]a|mudamos|nov[ao]s?|atualiza[cç][aã]o|atualizamos)\s+(d[aeo]s?\s+|de\s+)?(nossa\s+|nosso\s+)?(conta\s*(banc[aá]ria|corrente)?|dados\s+banc[aá]rios|chave\s+pix|banco|favorecido)/i;
const DINHEIRO = /\b(boleto|pix|pagamento|pagar|transfer[eê]ncia|dep[oó]sito|fatura|cobran[cç]a|nota fiscal|vencid[oa]|em aberto|d[eé]bito)\b/i;
const URGENCIA = /\b(urgente|urg[eê]ncia|hoje|imediat|[uú]ltim[oa] (aviso|chance|dia)|bloquead|suspens|protesto|negativa|cancelamento|prazo final|evite)\b/i;
const CREDENCIAIS = /((informe|digite|envie|confirme|atualize|cadastre) (a |sua |seu )?(nova )?senha|c[oó]digo de (verifica|seguran)|confirm(e|ar) (seus|os) dados|atualiz(e|ar) (seus|os|o seu) (dados|cadastro)|clique (aqui|no link) para (confirmar|validar|atualizar|desbloquear))/i;

export function dominio(email: string): string {
  return (email.split("@")[1] ?? "").toLowerCase();
}

/** Nome que aparece em "Fulano <x@y>" */
function nomeExibido(de: string): string {
  const m = de.match(/^\s*"?([^"<]*?)"?\s*</);
  return (m?.[1] ?? "").trim();
}

export function analisarGolpe(d: {
  de: string | null; remetente: string | null; responderPara: string | null; assunto: string | null; texto: string | null;
  autenticacao: string | null; anexos: { nome: string }[]; remetenteConhecido: boolean;
}): Alerta[] {
  const alertas: Alerta[] = [];
  const add = (nivel: Alerta["nivel"], motivo: string) => alertas.push({ nivel, motivo });
  const rem = (d.remetente ?? "").toLowerCase();
  const dom = dominio(rem);
  const conteudo = `${d.assunto ?? ""}\n${(d.texto ?? "").slice(0, 20000)}`;

  // 1. O Google não conseguiu confirmar a origem
  const aut = (d.autenticacao ?? "").toLowerCase();
  if (/dmarc=fail/.test(aut) || (/spf=(fail|softfail)/.test(aut) && /dkim=(fail|none)/.test(aut))) {
    add("alto", `O Google não conseguiu confirmar que este e-mail veio mesmo de ${dom || "quem diz ser"}. Pode ser falso.`);
  }

  // 2. Empresa conhecida usando e-mail gratuito (ex.: "Unimed" <unimed.pagamentos@gmail.com>)
  const nome = nomeExibido(d.de ?? "");
  const marca = (nome.match(MARCAS) ?? [])[0];
  if (marca && GRATUITOS.has(dom)) {
    add("alto", `Diz ser “${nome}”, mas usa um e-mail gratuito (${dom}). Empresas de verdade não fazem isso.`);
  }

  // 3. Respostas desviadas para outro endereço
  const resp = (d.responderPara ?? "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0];
  if (resp && dom && dominio(resp) !== dom) {
    add("atencao", `Se responder, a resposta vai para outro endereço: ${resp}.`);
  }

  // 4. Troca de conta bancária / chave Pix (o golpe mais comum com fornecedores e convênios)
  if (DADOS_BANCARIOS.test(conteudo)) {
    add(d.remetenteConhecido ? "atencao" : "alto",
      "Fala de troca de conta bancária ou de chave Pix. Antes de pagar, confirme por telefone, no número que vocês já têm.");
  }

  // 5. Dinheiro + pressa, ou dinheiro vindo de quem nunca escreveu
  const dinheiro = DINHEIRO.test(conteudo);
  if (dinheiro && !d.remetenteConhecido) {
    add(URGENCIA.test(conteudo) ? "alto" : "atencao", "Remetente novo (nunca trocou e-mail com a clínica) falando de pagamento, boleto ou Pix.");
  } else if (dinheiro && URGENCIA.test(conteudo)) {
    add("atencao", "Pede pagamento com pressa. Golpistas usam urgência para ninguém conferir.");
  }

  // 6. Pedido de senha / código / "clique para confirmar seus dados"
  if (CREDENCIAIS.test(conteudo)) {
    add(d.remetenteConhecido ? "atencao" : "alto", "Pede senha, código ou para “confirmar seus dados” por um link. Não clique: entre pelo site oficial.");
  }

  // 7. Anexos perigosos
  for (const a of d.anexos) {
    if (ANEXO_PERIGOSO.test(a.nome)) add("alto", `Anexo perigoso: “${a.nome}”. Não abra.`);
    else if (ANEXO_COMPACTADO.test(a.nome) && !d.remetenteConhecido) add("atencao", `Arquivo compactado (“${a.nome}”) de remetente novo. Só abra se esperava receber.`);
  }

  // Sem repetir o mesmo motivo
  const vistos = new Set<string>();
  return alertas.filter((a) => !vistos.has(a.motivo) && vistos.add(a.motivo));
}

export function nivelMaior(alertas: Alerta[]): "alto" | "atencao" | null {
  if (alertas.some((a) => a.nivel === "alto")) return "alto";
  return alertas.length ? "atencao" : null;
}
