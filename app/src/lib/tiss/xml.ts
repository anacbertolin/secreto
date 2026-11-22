// Montagem do XML TISS: árvore simples de elementos, serialização em ISO-8859-1
// e cálculo do hash do epílogo.
import { md5 } from "./md5";

/** Um elemento: nome + filhos (elementos) ou valor (texto). */
export type No = { n: string; v: No[] | string };

type Valor = string | number | null | undefined;

/** Elemento com valor de texto. Retorna null quando o valor é vazio (o elemento é omitido). */
export function t(nome: string, valor: Valor): No | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s === "" ? null : { n: nome, v: s };
}

/** Elemento com filhos. Retorna null quando nenhum filho sobrou (o elemento é omitido). */
export function e(nome: string, ...filhos: (No | null | undefined | (No | null)[])[]): No | null {
  const lista = filhos.flat().filter((f): f is No => !!f);
  return lista.length ? { n: nome, v: lista } : null;
}

/** Igual a `e`, mas o elemento é obrigatório: erro se ficar vazio. */
export function eObrig(nome: string, ...filhos: (No | null | undefined | (No | null)[])[]): No {
  const r = e(nome, ...filhos);
  if (!r) throw new Error(`Campo obrigatório vazio: ${nome}`);
  return r;
}

/** Igual a `t`, mas obrigatório. */
export function tObrig(nome: string, valor: Valor): No {
  const r = t(nome, valor);
  if (!r) throw new Error(`Campo obrigatório vazio: ${nome}`);
  return r;
}

// ---------------------------------------------------------------- formatos
export const dec2 = (v: number | null | undefined) => (v === null || v === undefined ? undefined : v.toFixed(2));

/** Data no formato do XML (AAAA-MM-DD). Aceita Date, 'AAAA-MM-DD' ou timestamp ISO. */
export function data(v: string | Date | null | undefined): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (!m) throw new Error(`Data inválida: ${v}`);
  return m[1];
}

export function hora(v: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
}

export const soDigitos = (v: string | null | undefined) => (v ? v.replace(/\D/g, "") : undefined);

// ---------------------------------------------------------------- ISO-8859-1
const TROCAS: Record<string, string> = {
  "–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"',
  "…": "...", " ": " ", "•": "-", "º": "o", "ª": "a",
};

/** Deixa o texto representável em ISO-8859-1 (troca aspas curvas, travessões etc.). */
export function latin1Seguro(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if (TROCAS[ch] !== undefined) out += TROCAS[ch];
    else if (c < 0x20 && ch !== "\n" && ch !== "\t") out += " ";
    else if (c <= 0xff) out += ch;
    else out += ch.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\xff]/g, "");
  }
  return out;
}

export function paraLatin1(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) throw new Error(`Caractere fora do ISO-8859-1: ${s[i]}`);
    b[i] = c;
  }
  return b;
}

// ---------------------------------------------------------------- serialização
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface OpcoesXml {
  prefixo: string; // normalmente "ans"
  indentar: boolean;
}

export function serializar(raiz: No, op: OpcoesXml, atributosRaiz = ""): string {
  const p = op.prefixo ? `${op.prefixo}:` : "";
  const nl = op.indentar ? "\n" : "";
  const out: string[] = [];
  const rec = (no: No, nivel: number, raizAttrs: string) => {
    const ind = op.indentar ? "\t".repeat(nivel) : "";
    if (typeof no.v === "string") {
      out.push(`${ind}<${p}${no.n}>${esc(latin1Seguro(no.v))}</${p}${no.n}>${nl}`);
    } else {
      out.push(`${ind}<${p}${no.n}${raizAttrs}>${nl}`);
      for (const f of no.v) rec(f, nivel + 1, "");
      out.push(`${ind}</${p}${no.n}>${nl}`);
    }
  };
  rec(raiz, 0, atributosRaiz);
  return out.join("");
}

/** Concatena, na ordem do documento, o texto de todos os elementos. */
export function textoConcatenado(no: No): string {
  if (typeof no.v === "string") return latin1Seguro(no.v);
  return no.v.map(textoConcatenado).join("");
}

/**
 * Hash do epílogo TISS: MD5 do conteúdo (texto) de todos os elementos da mensagem,
 * sem as tags, na ordem em que aparecem, codificado em ISO-8859-1. O próprio epílogo fica de fora.
 * ⚠️ Conferir contra XML reais aceitos pelas operadoras (teste de igualdade).
 */
export function hashEpilogo(cabecalho: No, corpo: No): string {
  return md5(paraLatin1(textoConcatenado(cabecalho) + textoConcatenado(corpo)));
}
