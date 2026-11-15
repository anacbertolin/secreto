import { useEffect, useRef, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_CHAVE } from "./supabase";

export interface Conversa {
  id: string;
  telefone: string;
  nome_contato: string | null;
  paciente_id: string | null;
  responsavel_id: string | null;
  ultima_mensagem_em: string | null;
  ultima_recebida_em: string | null;
  nao_lidas: number;
  arquivada: boolean;
  pacientes?: { id: string; nome: string; nome_social: string | null; numero_prontuario: number; whatsapp_autorizado: boolean | null } | null;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  direcao: "recebida" | "enviada";
  tipo: string;
  texto: string | null;
  modelo: string | null;
  midia_id: string | null;
  midia_tipo: string | null;
  midia_nome: string | null;
  situacao: string;
  erro: string | null;
  agendamento_id: string | null;
  enviado_por: string | null;
  quando: string;
}

export interface ModeloWA {
  id: string;
  finalidade: string;
  nome: string;
  idioma: string;
  corpo: string;
  parametros: string[];
  botoes: boolean;
  ativo: boolean;
}

export const SELECT_CONVERSA = "*, pacientes(id, nome, nome_social, numero_prontuario, whatsapp_autorizado)";

/** Janela de 24 h da Meta: só dá para escrever livremente até 24 h depois da última mensagem do paciente. */
export function janelaAberta(c: Conversa): boolean {
  return !!c.ultima_recebida_em && Date.now() - new Date(c.ultima_recebida_em).getTime() < 24 * 60 * 60 * 1000;
}

export function fmtNumeroWA(t: string): string {
  const n = t.startsWith("55") ? t.slice(2) : t;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return "+" + t;
}

/** Chama a função "whatsapp-enviar" e devolve a resposta (ou lança erro com a mensagem em português). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function whatsapp<T = any>(acao: string, dados: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("whatsapp-enviar", { body: { acao, ...dados } });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    try {
      const j = await ctx?.json();
      if (j?.erro) msg = j.erro;
    } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data as T;
}

/** Baixa a foto/áudio/documento que o paciente mandou e devolve um endereço local para mostrar. */
export async function baixarMidia(mensagemId: string): Promise<string> {
  const { data: s } = await supabase.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-enviar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.session?.access_token ?? ""}`,
      apikey: SUPABASE_CHAVE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ acao: "midia", mensagem_id: mensagemId }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.erro ?? "Não foi possível abrir o arquivo.");
  }
  return URL.createObjectURL(await r.blob());
}

// ---------- Aviso de mensagem nova (som + notificação do computador) ----------

let audioCtx: AudioContext | null = null;
export function tocarAviso() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const t = ctx.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, t + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.15 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.15 + 0.14);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.15);
      o.stop(t + i * 0.15 + 0.15);
    }
  } catch {
    /* navegador sem som: ignora */
  }
}

export function notificarComputador(titulo: string, corpo: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
      const n = new Notification(titulo, { body: corpo, icon: "/icone.png", tag: "whatsapp" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    /* ignora */
  }
}

/**
 * Total de mensagens não lidas (para o menu), ao vivo.
 * Toca o aviso quando chega mensagem nova, em qualquer tela do sistema.
 */
export function useNaoLidas(ligado: boolean): number {
  const [total, setTotal] = useState(0);
  const anterior = useRef<number | null>(null);

  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    let timer: number | undefined;

    async function contar() {
      const { data } = await supabase.from("whatsapp_conversas").select("nao_lidas").gt("nao_lidas", 0).eq("arquivada", false);
      if (!vivo) return;
      const t = (data ?? []).reduce((s, c) => s + (c.nao_lidas as number), 0);
      if (anterior.current !== null && t > anterior.current) {
        tocarAviso();
        notificarComputador("Nova mensagem no WhatsApp", "Abra o sistema para responder.");
      }
      anterior.current = t;
      setTotal(t);
    }
    const agendar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(contar, 400);
    };

    contar();
    const canal = supabase
      .channel("whatsapp-nao-lidas")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversas" }, agendar)
      .subscribe();
    const reserva = window.setInterval(contar, 60_000); // se o "ao vivo" cair, confere a cada minuto
    return () => {
      vivo = false;
      window.clearTimeout(timer);
      window.clearInterval(reserva);
      supabase.removeChannel(canal);
    };
  }, [ligado]);

  return total;
}
