import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Funcao } from "./util";

export interface Profissional {
  id: string;
  nome: string;
  email: string;
  funcao: Funcao;
  conselho: string | null;
  numero_conselho: string | null;
  uf_conselho: string | null;
  especialidade: string | null;
  rqe: string | null;
  ativo: boolean;
}

interface Ctx {
  session: Session | null;
  eu: Profissional | null;
  carregando: boolean;
  pode: (...f: Funcao[]) => boolean;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
}

const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [eu, setEu] = useState<Profissional | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregarPerfil(s: Session | null) {
    if (!s?.user?.email) {
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
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
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
    pode: (...f) => !!eu && f.includes(eu.funcao),
    sair: async () => {
      await supabase.auth.signOut();
      setEu(null);
    },
    recarregar: () => carregarPerfil(session),
  };
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
