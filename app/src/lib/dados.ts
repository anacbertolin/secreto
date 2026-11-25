import { supabase } from "./supabase";
import type { Profissional } from "./auth";

export interface Convenio {
  id: string; nome: string; registro_ans: string | null; ativo: boolean;
  codigo_prestador?: string | null; exige_senha?: boolean; dias_retorno?: number; observacoes_faturamento?: string | null;
}
export interface Local { id: string; nome: string; tipo: string; ativo: boolean }
export interface Horario {
  id: string; profissional_id: string; dia_semana: number; hora_inicio: string; hora_fim: string;
  duracao_min: number; local_id: string | null; vigente_de: string | null; vigente_ate: string | null; ativo: boolean;
}
export interface Bloqueio { id: string; profissional_id: string | null; inicio: string; fim: string; motivo: string; ativo: boolean }

export interface Agendamento {
  id: string; paciente_id: string; profissional_id: string; inicio: string; fim: string; tipo: string; status: string;
  convenio_id: string | null; local_id: string | null; sala: string | null; observacoes: string | null;
  motivo_cancelamento: string | null; primeira_vez: boolean; encaixe: boolean; canal_confirmacao: string | null;
  confirmado_em: string | null; chegada_em: string | null; chamado_em: string | null; concluido_em: string | null;
  // fluxo dentro da clínica (migração 0020)
  etapa?: string | null; etapa_em?: string | null; dilatacao_inicio_em?: string | null; dilatacao_minutos?: number | null;
  dilatacao_colirio?: string | null; dilatacao_olho?: string | null; chamada_em?: string | null; chamada_local?: string | null;
  pacientes?: { id: string; nome: string; nome_social: string | null; numero_prontuario: number; data_nascimento: string | null; telefone: string | null; telefone_secundario?: string | null; convenio_id: string | null };
  // quem incluiu / quem alterou por último (quadro de resumo da agenda; migração 0095)
  criado_por?: string | null; criado_em?: string; atualizado_por?: string | null; atualizado_em?: string;
}

export const SELECT_AGENDA =
  "*, pacientes(id, nome, nome_social, numero_prontuario, data_nascimento, telefone, telefone_secundario, convenio_id)";

export async function listaProfissionais(funcoes?: string[]): Promise<Profissional[]> {
  let q = supabase.from("profissionais").select("*").eq("ativo", true).order("nome");
  if (funcoes) q = q.in("funcao", funcoes);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Profissional[];
}

/** Profissional mostrado como coluna da agenda. Na Orientação Cirúrgica, `membros` são todos que atendem a orientação. */
export type AgendaColuna = Profissional & { membros?: string[] };

/**
 * Colunas da Agenda: os médicos e UMA coluna "Orientação Cirúrgica" (todos que atendem a orientação e não são médicos
 * aparecem juntos nela). A coluna usa como "dona" quem tem horários cadastrados (senão, o primeiro pelo nome).
 */
export async function listaAgendas(): Promise<AgendaColuna[]> {
  const [{ data, error }, { data: hs }] = await Promise.all([
    supabase.from("profissionais").select("*").eq("ativo", true).order("nome"),
    supabase.from("horarios_profissional").select("profissional_id").eq("ativo", true),
  ]);
  if (error) throw error;
  const todos = (data ?? []) as Profissional[];
  const orient = todos.filter((p) => ehAgendaOrientacao(p));
  const comHorario = new Set((hs ?? []).map((h: { profissional_id: string }) => h.profissional_id));
  const dona = orient.find((p) => comHorario.has(p.id)) ?? orient[0];
  // Como no Micrologos: médicos, setores (agenda_recurso) e a Orientação Cirúrgica, tudo em ordem alfabética
  const colunas: AgendaColuna[] = [
    ...todos.filter((p) => p.funcao === "medico" || p.agenda_recurso),
    ...(dona ? [{ ...dona, membros: orient.map((p) => p.id) }] : []),
  ];
  return colunas.sort((a, b) => nomeAgenda(a).localeCompare(nomeAgenda(b), "pt-BR", { sensitivity: "base" }));
}

/** Id da coluna onde o agendamento aparece (agendamentos de qualquer pessoa da orientação vão para a coluna dela) */
export function colunaDoAgendamento(colunas: AgendaColuna[], profissionalId: string): string {
  return colunas.find((c) => c.id === profissionalId || c.membros?.includes(profissionalId))?.id ?? profissionalId;
}

/** Esta "agenda" é a da Orientação Cirúrgica? (só registro: não fatura, não entra na recepção nem na fila do médico) */
export function ehAgendaOrientacao(p: Pick<Profissional, "funcao" | "orientacao_cirurgica"> | null | undefined): boolean {
  return !!p && p.funcao !== "medico" && p.orientacao_cirurgica === true;
}

/** Nome da coluna na agenda */
export function nomeAgenda(p: Profissional): string {
  return ehAgendaOrientacao(p) ? "Orientação Cirúrgica" : p.nome;
}

export async function listaConvenios(): Promise<Convenio[]> {
  const { data, error } = await supabase.from("convenios").select("*").eq("ativo", true).order("nome");
  if (error) throw error;
  return (data ?? []) as Convenio[];
}

export async function listaLocais(): Promise<Local[]> {
  const { data, error } = await supabase.from("locais").select("*").eq("ativo", true).order("nome");
  if (error) throw error;
  return (data ?? []) as Local[];
}

export function nomePor<T extends { id: string; nome: string }>(lista: T[] | null | undefined, id?: string | null) {
  return lista?.find((x) => x.id === id)?.nome ?? "";
}

export interface Plano { id: string; convenio_id: string; nome: string; codigo: string | null; ativo: boolean }

export async function listaPlanos(): Promise<Plano[]> {
  const { data, error } = await supabase.from("convenio_planos").select("*").eq("ativo", true).order("nome");
  if (error) throw error;
  return (data ?? []) as Plano[];
}

/**
 * Filtro de busca de paciente: nome / nome social (e nome da mãe), CPF, telefone,
 * nº do prontuário novo ou nº do prontuário antigo (Micrologos).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filtroBuscaPaciente<Q extends { or: (f: string) => Q; eq: (c: string, v: unknown) => Q; ilike: (c: string, v: string) => Q }>(q: Q, termo: string, comMae = false): Q {
  const t = termo.trim();
  const n = t.replace(/\D/g, "");
  const limpo = t.replace(/[%,()"]/g, " ");
  if (n.length === 11 && /^[\d.\-\s]+$/.test(t)) return q.or(`cpf.eq.${n},prontuario_anterior.eq.${n}`);
  if (/^\d{1,7}$/.test(t)) return q.or(`numero_prontuario.eq.${Number(t)},prontuario_anterior.eq.${t}`);
  if (n.length >= 8 && /^[\d()\-\s]+$/.test(t)) return q.or(`telefone.ilike.%${n}%,prontuario_anterior.eq.${n}`);
  return q.or(`nome.ilike.%${limpo}%,nome_social.ilike.%${limpo}%,prontuario_anterior.eq.${limpo.trim()}${comMae ? `,nome_mae.ilike.%${limpo}%` : ""}`);
}

export interface Procedimento { id: string; codigo: string | null; tabela: string; descricao: string; tipo: string; padrao_consulta: boolean; ativo: boolean; observacao?: string | null }

export async function listaProcedimentos(): Promise<Procedimento[]> {
  const { data, error } = await supabase.from("procedimentos").select("*").eq("ativo", true).order("descricao");
  if (error) throw error;
  return (data ?? []) as Procedimento[];
}
