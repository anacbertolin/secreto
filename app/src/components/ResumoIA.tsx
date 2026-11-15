// "✨ Resumo (IA)": mostra o resumo preparado pela tarefa agendada (plano do Claude, migração 0029).
// O resumo fica pronto para quem tem consulta nas próximas horas; o médico pode pedir um para qualquer paciente.
import { useEffect, useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { Modal, Aviso } from "./ui";
import { fmtDataHora } from "../lib/util";

interface Resumo {
  resumo: string; problemas_ativos: { descricao: string; olho: string; desde: string }[]; tratamentos_atuais: string[];
  cirurgias_procedimentos: string[]; alertas: string[]; tendencias: string[]; pendencias: string[];
}
interface Linha { resumo: Resumo; base: { atendimentos: number; legado: number } | null; gerado_em: string }

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

export function BotaoResumoIA({ pacienteId }: { pacienteId: string }) {
  const [ligada, setLigada] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [linha, setLinha] = useState<Linha | null | undefined>(undefined);
  const [pedido, setPedido] = useState<{ pedido_em: string; erro: string | null } | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { iaLigada().then(setLigada); }, []);
  useEffect(() => {
    if (!ligada) return;
    (async () => {
      const [r, p] = await Promise.all([
        supabase.from("ia_resumos").select("resumo, base, gerado_em").eq("paciente_id", pacienteId).maybeSingle(),
        supabase.from("ia_resumos_pedidos").select("pedido_em, erro").eq("paciente_id", pacienteId).maybeSingle(),
      ]);
      setLinha((r.data as Linha) ?? null); setPedido(p.data ?? null);
    })();
  }, [ligada, pacienteId]);
  if (!ligada) return null;

  async function pedir() {
    setErro("");
    const { error } = await supabase.from("ia_resumos_pedidos").upsert({ paciente_id: pacienteId, erro: null }, { onConflict: "paciente_id" });
    if (error) return setErro(msgErro(error));
    setPedido({ pedido_em: new Date().toISOString(), erro: null });
  }
  const r = linha?.resumo;
  const Lista = ({ t, itens }: { t: string; itens?: string[] }) => itens?.length ? <><h3>{t}</h3><ul>{itens.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null;
  return (
    <>
      <button onClick={() => setAberto(true)} title="Resumo do histórico preparado por inteligência artificial">✨ Resumo (IA){linha ? "" : " · pedir"}</button>
      {aberto && (
        <Modal titulo="✨ Resumo do prontuário (IA)" largo aoFechar={() => setAberto(false)}
          rodape={<><span className="muted pequeno" style={{ flex: 1 }}>Feito por IA a partir do prontuário, sem nome nem documentos. Confira antes de decidir.</span>
            {!pedido && <button onClick={pedir}>{r ? "🔄 Pedir resumo atualizado" : "Pedir resumo"}</button>}
            <button onClick={() => setAberto(false)}>Fechar</button></>}>
          <Aviso>{erro}</Aviso>
          {pedido && !pedido.erro && <Aviso tipo="info">Resumo pedido em {fmtDataHora(pedido.pedido_em)}. Fica pronto na próxima rodada (de hora em hora, das 6h às 19h).</Aviso>}
          {pedido?.erro && <Aviso tipo="alerta">Não foi possível resumir: {pedido.erro}</Aviso>}
          {linha === undefined && <div className="vazio">Carregando…</div>}
          {linha === null && !pedido && <div className="vazio">Ainda não há resumo deste paciente.<br /><span className="pequeno">Os resumos ficam prontos sozinhos para quem tem consulta nas próximas horas. Para este paciente, clique em <b>Pedir resumo</b>.</span></div>}
          {r && (
            <div className="resumo-ia">
              <p className="muted pequeno" style={{ marginTop: 0 }}>Preparado em {fmtDataHora(linha!.gerado_em)}{linha!.base && ` · ${linha!.base.atendimentos} consulta(s)${linha!.base.legado ? ` e ${linha!.base.legado} registro(s) do sistema antigo` : ""}`}</p>
              <p style={{ fontSize: "1.02rem" }}>{r.resumo}</p>
              {r.alertas?.length > 0 && <div className="aviso alerta"><b>⚠️ Alertas</b><ul style={{ margin: "4px 0 0" }}>{r.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
              {r.problemas_ativos?.length > 0 && <><h3>Problemas ativos</h3><ul>{r.problemas_ativos.map((p, i) => <li key={i}>{p.descricao}{p.olho && ` · ${p.olho}`}{p.desde && <span className="muted"> (desde {p.desde})</span>}</li>)}</ul></>}
              <Lista t="Tratamentos atuais" itens={r.tratamentos_atuais} />
              <Lista t="Evolução" itens={r.tendencias} />
              <Lista t="Cirurgias e procedimentos" itens={r.cirurgias_procedimentos} />
              <Lista t="Pendências" itens={r.pendencias} />
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
