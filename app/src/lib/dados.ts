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
  pacientes?: { id: string; nome: string; nome_social: string | null; numero_prontuario: number; data_nascimento: string | null; telefone: string | null; convenio_id: string | null };
}

export const SELECT_AGENDA =
  "*, pacientes(id, nome, nome_social, numero_prontuario, data_nascimento, telefone, convenio_id)";

export async function listaProfissionais(funcoes?: string[]): Promise<Profissional[]> {
  let q = supabase.from("profissionais").select("*").eq("ativo", true).order("nome");
  if (funcoes) q = q.in("funcao", funcoes);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Profissional[];
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

export interface Procedimento { id: string; codigo: string | null; tabela: string; descricao: string; tipo: string; padrao_consulta: boolean; ativo: boolean }

export async function listaProcedimentos(): Promise<Procedimento[]> {
  const { data, error } = await supabase.from("procedimentos").select("*").eq("ativo", true).order("descricao");
  if (error) throw error;
  return (data ?? []) as Procedimento[];
}
