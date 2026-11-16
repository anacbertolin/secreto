import { createClient } from "@supabase/supabase-js";

// Chave "publicável": pode ficar no navegador. Quem protege os dados são as
// regras de acesso (RLS) do banco. A chave secreta (service_role) NUNCA vem para cá.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "https://ogflxjolbwrzayjtxvhj.supabase.co";
export const SUPABASE_CHAVE: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_yCe68KKjOhjZ6aFknnvIrQ_fNI6W_QP";

export const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Mensagem de erro amigável a partir de um erro do Supabase */
export function msgErro(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/agenda_sem_conflito/.test(m)) return "Já existe um agendamento neste horário para este profissional.";
  if (/pacientes_cpf_key/.test(m)) return "Já existe um paciente com este CPF.";
  if (/cpf_check|pacientes_cpf_check/.test(m)) return "CPF deve ter 11 números.";
  if (/cns_check/.test(m)) return "Cartão SUS (CNS) deve ter 15 números.";
  if (/row-level security|permission denied/i.test(m)) return "Você não tem permissão para fazer isso.";
  if (/Invalid login credentials/i.test(m)) return "Usuário ou senha incorretos.";
  if (/duplicate key/.test(m)) return "Este registro já existe.";
  return m;
}
