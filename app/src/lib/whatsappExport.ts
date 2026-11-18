// Leitura do arquivo de "Exportar conversa" do WhatsApp (Android e iPhone, em português ou inglês).
//
// Formatos de linha conhecidos:
//   Android: "18/11/2026 14:30 - Maria: Bom dia"        (ano com 2 ou 4 dígitos, às vezes com vírgula)
//   iPhone:  "[18/11/2026 14:30:15] Maria: Bom dia"     (às vezes com caracteres invisíveis no começo)
// Mensagem com várias linhas: as linhas seguintes não têm data e continuam a anterior.
// Linhas sem "Nome: " são avisos do próprio WhatsApp (criptografia, número mudou…) e são ignoradas.
// Anexos:
//   Android com mídia: "IMG-20261118-WA0001.jpg (arquivo anexado)"   ou "(file attached)"
//   iPhone com mídia:  "<anexado: 00000012-PHOTO-2026-11-18-14-30-15.jpg>"  ou "<attached: …>"
//   Sem mídia:         "<Mídia oculta>" / "<Media omitted>" / "imagem ocultada" …

export interface MensagemExportada {
  quando: Date;
  autor: string;
  texto: string;
  arquivo: string | null;   // nome do anexo citado na conversa (se houver)
  midiaOculta: boolean;     // exportada "sem mídia": havia um anexo que não veio
  ordem: number;            // posição no arquivo (desempata mensagens no mesmo minuto)
}

export interface ConversaExportada {
  titulo: string;           // nome do contato tirado do nome do arquivo, quando der
  mensagens: MensagemExportada[];
  autores: { nome: string; total: number }[];
  ignoradas: number;        // avisos do sistema e linhas que não deu para entender
}

const INVISIVEIS = /[‎‏‪-‮⁦-⁩﻿]/g;
const ESPACOS = /[   ]/g;
const DATA = String.raw`(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s?m\.?)?`;
const RE_ANDROID = new RegExp(`^${DATA}\\s+-\\s+(.*)$`, "i");
const RE_IPHONE = new RegExp(`^\\[${DATA}\\]\\s+(.*)$`, "i");
const RE_ANEXO_ANDROID = /^(.+?\.[a-z0-9]{2,5})\s+\((?:arquivo anexado|file attached|archivo adjunto)\)\s*$/i;
const RE_ANEXO_IPHONE = /^<(?:anexado|attached|adjunto):\s*(.+?)>\s*$/i;
const RE_OCULTA = /^<?\s*(?:m[íi]dia oculta|media omitted|multimedia omitido|imagem ocultada|[áa]udio ocultado|v[íi]deo omitido|figurinha omitida|documento omitido|sticker omitted|image omitted|audio omitted|video omitted|document omitted|gif omitido|gif omitted)\s*>?$/i;

const AVISO_SISTEMA = /^\s*(?:as mensagens e (?:as )?chamadas (?:são|estão) protegidas|messages and calls are end-to-end encrypted|esta empresa usa um serviço seguro|this business uses a secure service|as mensagens e chamadas são criptografadas)/i;

/** Data/hora do arquivo (horário de Brasília) → Date */
function montarData(m: RegExpMatchArray): Date | null {
  const dia = Number(m[1]), mes = Number(m[2]);
  let ano = Number(m[3]);
  if (ano < 100) ano += 2000;
  let hora = Number(m[4]);
  const min = Number(m[5]), seg = Number(m[6] ?? 0);
  const ampm = m[7]?.toLowerCase();
  if (ampm === "p" && hora < 12) hora += 12;
  if (ampm === "a" && hora === 12) hora = 0;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || hora > 23 || min > 59) return null;
  // Brasil sem horário de verão desde 2019: -03:00 (para conversas antigas, pode haver 1 h de diferença)
  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}T${String(hora).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}-03:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Nome do contato a partir do nome do arquivo exportado */
export function tituloDoArquivo(nome: string): string {
  return nome
    .replace(/\.(txt|zip)$/i, "")
    .replace(/^(?:Conversa do WhatsApp com|WhatsApp Chat with|WhatsApp Chat -|Conversa do WhatsApp -|Chat de WhatsApp con)\s*/i, "")
    .replace(/^_chat$/i, "")
    .trim();
}

export function lerExportacao(conteudo: string, nomeArquivo = ""): ConversaExportada {
  const linhas = conteudo.replace(/\r\n?/g, "\n").split("\n");
  const mensagens: MensagemExportada[] = [];
  let ignoradas = 0;
  let atual: MensagemExportada | null = null;

  for (const bruta of linhas) {
    const linha = bruta.replace(INVISIVEIS, "").replace(ESPACOS, " ");
    const m = linha.match(RE_IPHONE) ?? linha.match(RE_ANDROID);
    if (!m) {
      if (atual) atual.texto += (atual.texto ? "\n" : "") + linha;   // continuação da mensagem anterior
      else if (linha.trim()) ignoradas++;
      continue;
    }
    const quando = montarData(m);
    const resto = m[8] ?? "";
    const sep = resto.indexOf(": ");
    if (!quando || sep <= 0) {
      // aviso do WhatsApp (sem autor): não é mensagem de ninguém
      atual = null;
      ignoradas++;
      continue;
    }
    const texto = resto.slice(sep + 2);
    if (AVISO_SISTEMA.test(texto)) {
      // no iPhone o aviso de criptografia vem com o nome da conta, como se fosse mensagem
      atual = null;
      ignoradas++;
      continue;
    }
    atual = { quando, autor: resto.slice(0, sep).trim(), texto, arquivo: null, midiaOculta: false, ordem: mensagens.length };
    mensagens.push(atual);
  }

  // Anexos: olham só a primeira linha; o resto é legenda
  for (const msg of mensagens) {
    const [primeira, ...demais] = msg.texto.split("\n");
    const p = primeira.trim();
    const anexo = p.match(RE_ANEXO_IPHONE) ?? p.match(RE_ANEXO_ANDROID);
    if (anexo) {
      msg.arquivo = anexo[1].trim();
      msg.texto = demais.join("\n").trim();
    } else if (RE_OCULTA.test(p)) {
      msg.midiaOculta = true;
      msg.texto = demais.join("\n").trim();
    } else {
      msg.texto = msg.texto.trim();
    }
  }

  const contagem = new Map<string, number>();
  for (const msg of mensagens) contagem.set(msg.autor, (contagem.get(msg.autor) ?? 0) + 1);
  const autores = [...contagem.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  return { titulo: tituloDoArquivo(nomeArquivo), mensagens, autores, ignoradas };
}

/** Tipo da mensagem a partir da extensão do anexo */
export function tipoDoArquivo(nome: string | null): { tipo: string; mime: string | null } {
  if (!nome) return { tipo: "texto", mime: null };
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  const MIME: Record<string, [string, string]> = {
    jpg: ["imagem", "image/jpeg"], jpeg: ["imagem", "image/jpeg"], png: ["imagem", "image/png"], gif: ["imagem", "image/gif"], heic: ["imagem", "image/heic"],
    webp: [/^STK-|STICKER/i.test(nome) ? "figurinha" : "imagem", "image/webp"],
    opus: ["audio", "audio/ogg"], ogg: ["audio", "audio/ogg"], mp3: ["audio", "audio/mpeg"], m4a: ["audio", "audio/mp4"], aac: ["audio", "audio/aac"], amr: ["audio", "audio/amr"], wav: ["audio", "audio/wav"],
    mp4: ["video", "video/mp4"], "3gp": ["video", "video/3gpp"], mov: ["video", "video/quicktime"],
    pdf: ["documento", "application/pdf"], doc: ["documento", "application/msword"],
    docx: ["documento", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xls: ["documento", "application/vnd.ms-excel"], xlsx: ["documento", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    txt: ["documento", "text/plain"], vcf: ["contato", "text/vcard"],
  };
  const [tipo, mime] = MIME[ext] ?? ["documento", "application/octet-stream"];
  return { tipo, mime };
}

/** Se o autor da conversa é um número (contato não salvo), devolve só os dígitos */
export function numeroDoAutor(nome: string): string | null {
  const d = nome.replace(/\D/g, "");
  return /^[+\d\s()-]+$/.test(nome.trim()) && d.length >= 10 && d.length <= 15 ? d : null;
}

/** Código estável de uma mensagem (importar o mesmo arquivo de novo não duplica) */
export async function codigoMensagem(partes: (string | number | null)[]): Promise<string> {
  const bytes = new TextEncoder().encode(partes.map((p) => String(p ?? "")).join("␟"));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash).slice(0, 20), (b) => b.toString(16).padStart(2, "0")).join("");
}
