import { supabase, SUPABASE_URL, SUPABASE_CHAVE } from "./supabase";

export interface Conversa {
  id: string;
  telefone: string;
  nome_contato: string | null;
  paciente_id: string | null;
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
