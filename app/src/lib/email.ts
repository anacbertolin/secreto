// E-mail da clínica (migração 0190, função Edge "email")
import { useEffect, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_CHAVE } from "./supabase";

export interface CaixaEmail {
  id: string; endereco: string; nome: string; descricao: string | null; tipo: "setor" | "medico" | "geral";
  profissional_id: string | null; funcoes: string[]; assinatura: string | null; ordem: number; ativo: boolean;
}
export interface ConversaEmail {
  id: string; caixa_id: string; assunto: string | null; contato: string | null; previa: string | null;
  ultima_mensagem_em: string | null; ultima_recebida_em: string | null; ultima_enviada_em: string | null;
  nao_lida: boolean; arquivada: boolean; responsavel_id: string | null; qtd_mensagens: number; tem_anexo: boolean;
  alerta: "alto" | "atencao" | null;
}
export interface AnexoEmail { nome: string; tipo: string; tamanho: number }
export interface MensagemEmail {
  id: string; conversa_id: string; direcao: "recebida" | "enviada"; de: string | null; para: string | null; cc: string | null;
  assunto: string | null; texto: string | null; html: string | null; anexos: AnexoEmail[]; quando: string; enviado_por: string | null;
  alerta: { nivel: "alto" | "atencao"; motivo: string }[];
}
export interface SpamEmail { gmail_id: string; de: string | null; para: string | null; assunto: string | null; previa: string; quando: string; caixas: string[] }
export interface Contagem { caixa_id: string; nao_lidas: number; sem_resposta: number }

async function cabecalhos(): Promise<Record<string, string>> {
  const { data: s } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${s.session?.access_token ?? ""}`, apikey: SUPABASE_CHAVE };
}

/** Chama a função "email" e devolve a resposta (ou lança erro em português). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function email<T = any>(acao: string, dados: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/email`, {
    method: "POST", headers: { ...(await cabecalhos()), "Content-Type": "application/json" },
    body: JSON.stringify({ acao, ...dados }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? "Não foi possível falar com o e-mail da clínica.");
  return j as T;
}

export async function enviarEmail(campos: Record<string, string>, arquivos: File[]): Promise<{ conversa_id: string }> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  for (const f of arquivos) fd.append("arquivos", f, f.name);
  const r = await fetch(`${SUPABASE_URL}/functions/v1/email`, { method: "POST", headers: await cabecalhos(), body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? (r.status === 413 ? "Anexos grandes demais (máximo 25 MB por e-mail)." : "Não foi possível enviar o e-mail."));
  return j;
}

export async function abrirAnexo(mensagemId: string, indice: number, nome: string): Promise<void> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/email`, {
    method: "POST", headers: { ...(await cabecalhos()), "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "anexo", mensagem_id: mensagemId, indice }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.erro ?? "Não foi possível abrir o anexo.");
  }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Só o nome de "Fulano <fulano@x.com>" (ou o e-mail, se não tiver nome). */
export function nomeContato(s: string | null): string {
  if (!s) return "—";
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return m[1].trim() || m[2];
  return s.split(",")[0].trim();
}
export function emailsDe(s: string | null): string[] {
  return [...(s ?? "").matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((x) => x[0].toLowerCase());
}

/** Total de e-mails não lidos nas caixas que a pessoa vê (para o menu). */
export function useEmailNaoLidas(ligado: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    const ler = async () => {
      const { data } = await supabase.rpc("email_contagem");
      if (vivo && data) setN((data as Contagem[]).reduce((s, c) => s + Number(c.nao_lidas), 0));
    };
    ler();
    const t = setInterval(ler, 60_000);
    return () => { vivo = false; clearInterval(t); };
  }, [ligado]);
  return n;
}
