// Regras do extrator que não dependem de banco nem de IA (testáveis isoladamente).

export const FUSO = "America/Sao_Paulo";
// O Brasil não tem horário de verão desde 2019: São Paulo é sempre UTC-3.
const OFFSET_SP = "-03:00";

export interface Mensagem {
  id: string;
  direcao: "recebida" | "enviada";
  tipo: string;
  texto: string | null;
  modelo: string | null;
  midia_nome: string | null;
  enviado_por: string | null;
  quando: string;
}

/** Tira do texto o que não precisa ir para a IA: CPF, e-mail, cartões, telefones, números longos. */
export function mascarar(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    // 8 ou mais dígitos seguidos (podendo ter espaço, ponto, hífen ou parênteses no meio) — não pega datas com "/"
    .replace(/\+?\(?\d(?:[\s.\-()]{0,2}\d){7,}/g, "[número]");
}

const fmtCurto = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function descreverMensagem(m: Mensagem): string {
  const t = (m.texto ?? "").trim();
  switch (m.tipo) {
    case "texto":
    case "botao":
      return t ? mascarar(t) : "(mensagem vazia)";
    case "modelo":
      return `[mensagem automática "${m.modelo ?? "modelo"}"]${t ? " " + mascarar(t) : ""}`;
    case "imagem":
      return `[foto]${t ? " legenda: " + mascarar(t) : ""}`;
    case "audio":
      return "[áudio — não transcrito]";
    case "video":
      return `[vídeo]${t ? " legenda: " + mascarar(t) : ""}`;
    case "documento":
      return `[documento${m.midia_nome ? " " + mascarar(m.midia_nome) : ""}]${t ? " " + mascarar(t) : ""}`;
    default:
      return t ? `[${m.tipo}] ${mascarar(t)}` : `[${m.tipo}]`;
  }
}

/** Monta a conversa em texto, uma linha por mensagem. Atendentes viram "Atendente 1, 2…". */
export function transcrever(msgs: Mensagem[], apelidos: Map<string, string>): string {
  return msgs
    .map((m) => {
      const quando = fmtCurto.format(new Date(m.quando));
      const quem = m.direcao === "recebida"
        ? "PACIENTE"
        : m.enviado_por
        ? `CLÍNICA (${apelidos.get(m.enviado_por) ?? "atendente"})`
        : "CLÍNICA (automático)";
      return `[${quando}] ${quem}: ${descreverMensagem(m)}`;
    })
    .join("\n");
}

export interface Tempos {
  primeira_resposta_seg: number | null;
  resposta_media_seg: number | null;
  maior_espera_seg: number | null;
  sem_resposta: boolean;
}

/**
 * Tempo que o paciente esperou: de cada mensagem do paciente que ficou sem resposta
 * até a próxima mensagem escrita por alguém da equipe (mensagens automáticas não contam).
 */
export function medirTempos(msgs: Mensagem[]): Tempos {
  const esperas: number[] = [];
  let aguardandoDesde: number | null = null;
  for (const m of msgs) {
    const t = new Date(m.quando).getTime();
    if (m.direcao === "recebida") {
      if (aguardandoDesde === null) aguardandoDesde = t;
    } else if (m.enviado_por && aguardandoDesde !== null) {
      esperas.push(Math.max(0, Math.round((t - aguardandoDesde) / 1000)));
      aguardandoDesde = null;
    }
  }
  const semResposta = aguardandoDesde !== null;
  if (!esperas.length) {
    return { primeira_resposta_seg: null, resposta_media_seg: null, maior_espera_seg: null, sem_resposta: semResposta };
  }
  return {
    primeira_resposta_seg: esperas[0],
    resposta_media_seg: Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length),
    maior_espera_seg: Math.max(...esperas),
    sem_resposta: semResposta,
  };
}

/** "2026-11-20T14:30" (hora de São Paulo) → Date. Devolve null se o formato não bater. */
export function horaLocalParaData(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const d = new Date(`${s}:00${OFFSET_SP}`);
  return isNaN(d.getTime()) ? null : d;
}

/** Partes de uma data no fuso de São Paulo */
export function partesSP(d: Date): { dia: string; diaSemana: number; minutos: number } {
  const local = new Date(d.getTime() - 3 * 3600 * 1000); // UTC-3 fixo
  const dia = local.toISOString().slice(0, 10);
  return { dia, diaSemana: local.getUTCDay(), minutos: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

const paraMin = (h: string) => {
  const [a, b] = h.split(":");
  return Number(a) * 60 + Number(b);
};

export interface HorarioMedico {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_min: number;
  local_id: string | null;
  vigente_de: string | null;
  vigente_ate: string | null;
}

/** Acha a faixa de atendimento do médico que comporta o horário pedido. */
export function encaixeNoHorario(inicio: Date, horarios: HorarioMedico[]): HorarioMedico | null {
  const { dia, diaSemana, minutos } = partesSP(inicio);
  for (const h of horarios) {
    if (h.dia_semana !== diaSemana) continue;
    if (h.vigente_de && dia < h.vigente_de) continue;
    if (h.vigente_ate && dia > h.vigente_ate) continue;
    const ini = paraMin(h.hora_inicio);
    const fim = paraMin(h.hora_fim);
    if (minutos >= ini && minutos + (h.duracao_min || 15) <= fim) return h;
  }
  return null;
}

/** Compara nomes sem acento, caixa ou espaços extras */
export function normalizarNome(n: string | null | undefined): string {
  return (n ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/** Mesmo nome? Aceita o nome dito na conversa sem o sobrenome do meio (primeiro + último iguais). */
export function mesmoNome(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizarNome(a), y = normalizarNome(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const px = x.split(" "), py = y.split(" ");
  if (px.length < 2 || py.length < 2) return false;
  return px[0] === py[0] && px[px.length - 1] === py[py.length - 1];
}

/** Telefone da conversa (55DDD9XXXXXXXX) no formato do cadastro (DDD + número, só dígitos) */
export function telefoneCadastro(wa: string): string {
  const n = wa.replace(/\D/g, "");
  return n.length >= 12 && n.startsWith("55") ? n.slice(2) : n;
}
