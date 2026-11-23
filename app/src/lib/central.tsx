// Central de atendimento (migração 0080): status único da atendente — vale para WhatsApp e telefone.
// Disponível / Pausa / Almoço. Fora de "Disponível": o telefone para de tocar e as conversas dela voltam para a fila.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, msgErro } from "./supabase";
import { useAuth } from "./auth";
import { useTelefone } from "./telefone";
import type { SetorWA } from "./whatsapp";

export type StatusCentral = "disponivel" | "pausa" | "almoco";

export const STATUS_CENTRAL: Record<StatusCentral, { rotulo: string; icone: string; cor: string; dica: string }> = {
  disponivel: { rotulo: "Disponível", icone: "🟢", cor: "#12b76a", dica: "Recebe ligações e conversas da fila" },
  pausa: { rotulo: "Pausa", icone: "⏸️", cor: "#f79009", dica: "Café, banheiro, tarefa rápida. Suas conversas voltam para a fila" },
  almoco: { rotulo: "Almoço", icone: "🍽️", cor: "#7a5af8", dica: "Suas conversas voltam para a fila" },
};

interface Ctx {
  /** Esta pessoa usa a Central (recepção/admin) ou a Orientação Cirúrgica */
  atende: boolean;
  setor: SetorWA;
  status: StatusCentral;
  desde: string | null;
  erro: string;
  mudar: (s: StatusCentral) => Promise<number | null>;
  pegarProximo: () => Promise<string | null>;
}

const CentralCtx = createContext<Ctx | null>(null);

export function CentralProvider({ children }: { children: ReactNode }) {
  const { eu } = useAuth();
  const tel = useTelefone();
  const setor: SetorWA = eu?.orientacao_cirurgica ? "orientacao" : "clinica";
  const atende = !!eu && (eu.orientacao_cirurgica === true || eu.funcao === "recepcao" || eu.funcao === "admin");
  const [status, setStatus] = useState<StatusCentral>("disponivel");
  const [desde, setDesde] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  // Lê o status guardado (e acompanha ao vivo, se mudar em outra aba)
  useEffect(() => {
    if (!eu || !atende) return;
    let vivo = true;
    const ler = async () => {
      const { data } = await supabase.from("central_status").select("status, desde").eq("profissional_id", eu.id).maybeSingle();
      if (!vivo) return;
      setStatus(((data?.status as StatusCentral) ?? "disponivel"));
      setDesde((data?.desde as string) ?? null);
    };
    void ler();
    const canal = supabase.channel("central-meu-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "central_status", filter: `profissional_id=eq.${eu.id}` }, () => void ler())
      .subscribe();
    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [eu, atende]);

  // Telefone acompanha o status: fora de "Disponível" não toca
  const pausarTel = tel?.pausar;
  const estadoTel = tel?.estado;
  useEffect(() => {
    if (!atende || !pausarTel) return;
    if (estadoTel !== "pronto" && estadoTel !== "pausa") return;
    const querPausa = status !== "disponivel";
    if (querPausa !== (estadoTel === "pausa")) pausarTel(querPausa);
  }, [atende, status, estadoTel, pausarTel]);

  const mudar = useCallback(async (s: StatusCentral) => {
    setErro("");
    const { data, error } = await supabase.rpc("central_mudar_status", { p_status: s });
    if (error) { setErro(msgErro(error)); return null; }
    setStatus(s);
    setDesde(new Date().toISOString());
    return (data as { devolvidas?: number })?.devolvidas ?? 0;
  }, []);

  const pegarProximo = useCallback(async () => {
    setErro("");
    const { data, error } = await supabase.rpc("central_pegar_proximo");
    if (error) { setErro(msgErro(error)); return null; }
    return (data as string | null) ?? null;
  }, []);

  return <CentralCtx.Provider value={{ atende, setor, status, desde, erro, mudar, pegarProximo }}>{children}</CentralCtx.Provider>;
}

export const useCentral = () => useContext(CentralCtx);

/** "há 7 min", "há 1 h 05" */
export function fmtEsperando(desde: string | null | undefined, agora = Date.now()): string {
  if (!desde) return "";
  const min = Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h ${String(min % 60).padStart(2, "0")}`;
}

/** Os 3 botões grandes de status, sempre no mesmo lugar */
export function BotoesStatus() {
  const c = useCentral();
  const [aviso, setAviso] = useState("");
  if (!c?.atende) return null;
  async function clicar(s: StatusCentral) {
    if (s === c!.status) return;
    const n = await c!.mudar(s);
    if (n != null && s !== "disponivel") setAviso(n > 0 ? `${n} conversa${n > 1 ? "s voltaram" : " voltou"} para a fila.` : "");
    else setAviso("");
  }
  return (
    <div className="status-central">
      <span className="status-titulo">Meu status:</span>
      {(Object.keys(STATUS_CENTRAL) as StatusCentral[]).map((s) => (
        <button key={s} title={STATUS_CENTRAL[s].dica}
          className={"status-botao" + (c.status === s ? " ativo" : "")}
          style={c.status === s ? { background: STATUS_CENTRAL[s].cor, borderColor: STATUS_CENTRAL[s].cor } : undefined}
          onClick={() => void clicar(s)}>
          {STATUS_CENTRAL[s].icone} {STATUS_CENTRAL[s].rotulo}
        </button>
      ))}
      {(c.erro || aviso) && <span className={c.erro ? "status-erro" : "muted pequeno"}>{c.erro || aviso}</span>}
    </div>
  );
}
