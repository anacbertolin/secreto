// Botão "✨ Resumo (IA)" (migração 0027 + função Edge prontuario-resumo). Só aparece se a administração ligou.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Modal, Aviso } from "./ui";

interface Resumo {
  resumo: string; problemas_ativos: { descricao: string; olho: string; desde: string }[]; tratamentos_atuais: string[];
  cirurgias_procedimentos: string[]; alertas: string[]; tendencias: string[]; pendencias: string[];
  base: { atendimentos: number; legado: number };
}

let estadoCache: Promise<boolean> | null = null;
function iaLigada(): Promise<boolean> {
  if (!estadoCache) {
    estadoCache = (async () => {
      const { data } = await supabase.from("ia_prontuario_config").select("ligado").eq("id", 1).maybeSingle();
      return !!data?.ligado;
    })().catch(() => false);
  }
  return estadoCache;
}

async function erroDaFuncao(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  try { const j = await ctx?.json(); if (j?.erro) return j.erro; } catch { /* sem corpo */ }
  return "Não foi possível gerar o resumo agora.";
}

export function BotaoResumoIA({ pacienteId }: { pacienteId: string }) {
  const [ligada, setLigada] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { iaLigada().then(setLigada); }, []);
  if (!ligada) return null;

  async function gerar() {
    setAberto(true); setErro(""); setR(null); setCarregando(true);
    const { data, error } = await supabase.functions.invoke("prontuario-resumo", { body: { paciente_id: pacienteId } });
    setCarregando(false);
    if (error) return setErro(await erroDaFuncao(error));
    setR(data as Resumo);
  }
  const Lista = ({ t, itens }: { t: string; itens: string[] }) => itens?.length ? <><h3>{t}</h3><ul>{itens.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null;
  return (
    <>
      <button onClick={gerar} title="Resumo do histórico feito por inteligência artificial">✨ Resumo (IA)</button>
      {aberto && (
        <Modal titulo="✨ Resumo do prontuário (IA)" largo aoFechar={() => setAberto(false)}
          rodape={<><span className="muted pequeno" style={{ flex: 1 }}>Gerado por IA a partir do prontuário. Confira antes de decidir. Não fica guardado.</span><button onClick={() => setAberto(false)}>Fechar</button></>}>
          <Aviso>{erro}</Aviso>
          {carregando && <div className="vazio">Lendo o histórico e preparando o resumo… (pode levar até 1 minuto)</div>}
          {r && (
            <div className="resumo-ia">
              <p style={{ fontSize: "1.02rem", marginTop: 0 }}>{r.resumo}</p>
              {r.alertas?.length > 0 && <div className="aviso alerta"><b>⚠️ Alertas</b><ul style={{ margin: "4px 0 0" }}>{r.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
              {r.problemas_ativos?.length > 0 && <><h3>Problemas ativos</h3><ul>{r.problemas_ativos.map((p, i) => <li key={i}>{p.descricao}{p.olho && ` · ${p.olho}`}{p.desde && <span className="muted"> (desde {p.desde})</span>}</li>)}</ul></>}
              <Lista t="Tratamentos atuais" itens={r.tratamentos_atuais} />
              <Lista t="Evolução" itens={r.tendencias} />
              <Lista t="Cirurgias e procedimentos" itens={r.cirurgias_procedimentos} />
              <Lista t="Pendências" itens={r.pendencias} />
              <p className="muted pequeno">Baseado em {r.base.atendimentos} consulta(s) recente(s){r.base.legado ? ` e ${r.base.legado} registro(s) do sistema antigo` : ""}.</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
