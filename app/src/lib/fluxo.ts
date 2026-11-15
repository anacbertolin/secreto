// Fluxo do paciente dentro da clínica (migração 0020): etapas, dilatação e chamada na TV
import { supabase, msgErro } from "./supabase";
import type { Agendamento } from "./dados";

export const ETAPAS: Record<string, { rotulo: string; cor: string; icone: string }> = {
  pre_consulta: { rotulo: "Na pré-consulta", cor: "azul", icone: "🩺" },
  dilatando: { rotulo: "Dilatando", cor: "amarelo", icone: "💧" },
  pronto_medico: { rotulo: "Pronto p/ médico", cor: "verde", icone: "✅" },
  exames: { rotulo: "Fazendo exames", cor: "roxo", icone: "🔬" },
};

export const COLIRIOS_DILATACAO = [
  "Tropicamida 1% + Fenilefrina 10%",
  "Tropicamida 1%",
  "Fenilefrina 10%",
  "Ciclopentolato 1% (cicloplegia)",
  "Atropina 0,5% (cicloplegia)",
];

/** Situação do cronômetro da dilatação */
export function dilatacao(a: Pick<Agendamento, "etapa" | "dilatacao_inicio_em" | "dilatacao_minutos">) {
  if (a.etapa !== "dilatando" || !a.dilatacao_inicio_em) return null;
  const previsto = a.dilatacao_minutos ?? 30;
  const decorridos = Math.max(0, Math.floor((Date.now() - new Date(a.dilatacao_inicio_em).getTime()) / 60000));
  const restam = previsto - decorridos;
  return { previsto, decorridos, restam, pronto: restam <= 0 };
}

/** Ordem na fila do médico: prontos e dilatação concluída primeiro, depois quem espera há mais tempo */
export function prioridadeFila(a: Agendamento): number {
  const d = dilatacao(a);
  if (a.etapa === "pronto_medico" || d?.pronto) return 0;
  if (!a.etapa) return 1;
  if (a.etapa === "dilatando") return 2;
  return 3;
}

export async function mudarEtapa(id: string, campos: Partial<Agendamento>): Promise<string> {
  const { error } = await supabase.from("agendamentos").update(campos).eq("id", id);
  return error ? msgErro(error) : "";
}

/** Chama o paciente: aparece na TV da sala de espera. O horário é o do servidor. */
export async function chamarNaTV(id: string, local: string): Promise<string> {
  try { localStorage.setItem("minha_sala", local); } catch { /* sem armazenamento local */ }
  return mudarEtapa(id, { chamada_em: new Date().toISOString(), chamada_local: local || null });
}

export function minhaSala(): string {
  try { return localStorage.getItem("minha_sala") ?? ""; } catch { return ""; }
}

/** Nome como aparece na TV: primeiro nome + último sobrenome (nome social, se houver) */
export function nomeTV(p: { nome: string; nome_social?: string | null }): string {
  const partes = (p.nome_social || p.nome).trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0];
}
