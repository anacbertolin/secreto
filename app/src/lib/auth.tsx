import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Funcao } from "./util";

export interface Profissional {
  id: string;
  nome: string;
  email: string | null;
  usuario?: string | null;
  funcao: Funcao;
  conselho: string | null;
  numero_conselho: string | null;
  uf_conselho: string | null;
  especialidade: string | null;
  rqe: string | null;
  ativo: boolean;
  /** Atende o WhatsApp da Orientação Cirúrgica (migração 0052) */
  orientacao_cirurgica?: boolean;
  /** Caixa da recepção (migração 0066): confere / dá a aprovação final */
  caixa_conferir?: boolean;
  caixa_aprovar?: boolean;
  /** Pode cancelar caixa aberto por engano e reabrir caixa para correção (migração 0110 — só a dona) */
  caixa_corrigir?: boolean;
  /** Coluna de agenda de setor do Micrologos (Centro Cirúrgico, Ortóptica...), não é pessoa (migração 0152) */
  agenda_recurso?: boolean;
  /** Sem login no sistema (colunas de setor, cirurgião de fora — migração 0152) */
  sem_acesso?: boolean;
}

interface Ctx {
  session: Session | null;
  eu: Profissional | null;
  carregando: boolean;
  /** Tem verificação em duas etapas ativada e ainda não digitou o código nesta sessão (migração 0089) */
  precisaCodigo: boolean;
  pode: (...f: Funcao[]) => boolean;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [eu, setEu] = useState<Profissional | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [precisaCodigo, setPrecisaCodigo] = useState(false);

  async function carregarPerfil(s: Session | null) {
    if (!s?.user?.email) {
      setEu(null);
      setPrecisaCodigo(false);
      return;
    }
    // duas etapas: senha certa, mas falta o código do autenticador
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const falta = !!nivel && nivel.nextLevel === "aal2" && nivel.currentLevel !== "aal2";
    setPrecisaCodigo(falta);
    if (falta) {
      setEu(null);
      return;
    }
    const { data } = await supabase
      .from("profissionais")
      .select("*")
      .eq("email", s.user.email.toLowerCase())
      .eq("ativo", true)
      .maybeSingle();
    setEu((data as Profissional) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await carregarPerfil(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED" || evento === "MFA_CHALLENGE_VERIFIED") {
        // fora do callback para não travar o cliente
        setTimeout(() => carregarPerfil(s), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const valor: Ctx = {
    session,
    eu,
    carregando,
    precisaCodigo,
    pode: (...f) => !!eu && f.includes(eu.funcao),
    sair: async () => {
      await supabase.auth.signOut();
      setEu(null);
    },
    recarregar: async () => carregarPerfil((await supabase.auth.getSession()).data.session),
  };
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
