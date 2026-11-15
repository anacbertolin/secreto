// Utilidades de formatação e rótulos em português

export type Funcao = "medico" | "enfermagem" | "recepcao" | "admin" | "faturamento";

export const FUNCOES: Record<Funcao, string> = {
  medico: "Médico(a)",
  enfermagem: "Enfermagem / Técnico(a)",
  recepcao: "Recepção",
  faturamento: "Faturamento",
  admin: "Administração",
};

export const STATUS_AGENDA: Record<string, { rotulo: string; cor: string }> = {
  agendado: { rotulo: "Agendado", cor: "cinza" },
  confirmado: { rotulo: "Confirmado", cor: "azul" },
  chegou: { rotulo: "Na espera", cor: "amarelo" },
  em_atendimento: { rotulo: "Em atendimento", cor: "roxo" },
  atendido: { rotulo: "Atendido", cor: "verde" },
  faltou: { rotulo: "Faltou", cor: "vermelho" },
  cancelado: { rotulo: "Cancelado", cor: "vermelho" },
};

export const TIPOS_AGENDA: Record<string, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  exame: "Exame",
  procedimento: "Procedimento",
  cirurgia: "Cirurgia",
};

export const STATUS_EXAME: Record<string, { rotulo: string; cor: string }> = {
  aguardando: { rotulo: "Aguardando", cor: "cinza" },
  em_execucao: { rotulo: "Em execução", cor: "amarelo" },
  aguardando_laudo: { rotulo: "Aguardando laudo", cor: "roxo" },
  laudado: { rotulo: "Laudado", cor: "verde" },
  cancelado: { rotulo: "Cancelado", cor: "vermelho" },
};

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const TZ = "America/Sao_Paulo";

export function fmtData(d?: string | Date | null): string {
  if (!d) return "";
  const dt = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d);
  return dt.toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function fmtHora(d?: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function fmtDataHora(d?: string | Date | null): string {
  if (!d) return "";
  return `${fmtData(d)} ${fmtHora(d)}`;
}

export function fmtDataLonga(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2026-11-14" na data local */
export function isoDia(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function somaDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function idade(nasc?: string | null): string {
  if (!nasc) return "";
  const n = new Date(nasc + "T12:00:00");
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
  if (a < 1) {
    const meses = (h.getFullYear() - n.getFullYear()) * 12 + m - (h.getDate() < n.getDate() ? 1 : 0);
    return `${Math.max(meses, 0)} meses`;
  }
  return `${a} anos`;
}

export function minutosDesde(d?: string | null): number {
  if (!d) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
}

export function fmtEspera(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

export const soNumeros = (s: string) => (s ?? "").replace(/\D/g, "");

export function fmtCPF(s?: string | null): string {
  const n = soNumeros(s ?? "");
  if (n.length !== 11) return s ?? "";
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

export function fmtTelefone(s?: string | null): string {
  const n = soNumeros(s ?? "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return s ?? "";
}

export function cpfValido(cpf: string): boolean {
  const n = soNumeros(cpf);
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  const dig = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(n[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(n[9]) && dig(10) === Number(n[10]);
}

/** Formata grau de lente: +1.25 / -0.50 / plano */
export function fmtGrau(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (n === 0) return "Plano";
  return (n > 0 ? "+" : "") + n.toFixed(2).replace(".", ",");
}

/** Converte texto digitado ("-1,25", "+0.5") em número ou null */
export function numOuNulo(s: unknown): number | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(",", ".");
  if (t === "") return null;
  if (/^plano$/i.test(t)) return 0;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

export function nomeExibicao(p: { nome: string; nome_social?: string | null }): string {
  return p.nome_social ? `${p.nome_social} (${p.nome})` : p.nome;
}

export function senhaAleatoria(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join("");
}

export const STATUS_CONTA: Record<string, { rotulo: string; cor: string }> = {
  aberta: { rotulo: "Em conferência", cor: "amarelo" },
  pronta: { rotulo: "Pronta p/ lote", cor: "azul" },
  faturada: { rotulo: "Enviada", cor: "roxo" },
  paga: { rotulo: "Paga", cor: "verde" },
  glosada: { rotulo: "Paga c/ glosa", cor: "vermelho" },
  cancelada: { rotulo: "Cancelada", cor: "cinza" },
};

export const STATUS_LOTE: Record<string, { rotulo: string; cor: string }> = {
  aberto: { rotulo: "Montando", cor: "amarelo" },
  enviado: { rotulo: "Enviado", cor: "roxo" },
  pago: { rotulo: "Pago", cor: "verde" },
  pago_parcial: { rotulo: "Pago c/ glosa", cor: "vermelho" },
  cancelado: { rotulo: "Cancelado", cor: "cinza" },
};

export const TIPO_GUIA: Record<string, string> = { consulta: "Guia de Consulta", sadt: "Guia SP/SADT", particular: "Particular" };

export const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", debito: "Cartão de débito", credito: "Cartão de crédito",
  boleto: "Boleto", transferencia: "Transferência", cortesia: "Cortesia",
};

export function fmtMoeda(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "jan/2026" */
export function fmtCompetencia(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(". de ", "/").replace(" de ", "/");
}
