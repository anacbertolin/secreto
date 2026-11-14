import { supabase } from "./supabase";
import type { Profissional } from "./auth";

export interface Convenio { id: string; nome: string; registro_ans: string | null; ativo: boolean }
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
