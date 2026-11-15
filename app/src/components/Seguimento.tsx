// Acompanhamento de doença crônica (migração 0021): intervalo de retorno e PIO alvo
import { useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Campo, Modal, Etiqueta } from "./ui";
import { numOuNulo } from "../lib/util";

export const CONDICOES: Record<string, { rotulo: string; dias: number }> = {
  glaucoma: { rotulo: "Glaucoma", dias: 120 },
  suspeita_glaucoma: { rotulo: "Suspeita de glaucoma", dias: 180 },
  retinopatia_diabetica: { rotulo: "Retinopatia diabética", dias: 120 },
  diabetes_sem_retinopatia: { rotulo: "Diabetes (sem retinopatia)", dias: 365 },
  dmri: { rotulo: "DMRI", dias: 90 },
  ceratocone: { rotulo: "Ceratocone", dias: 180 },
  uveite: { rotulo: "Uveíte", dias: 90 },
  pos_operatorio: { rotulo: "Pós-operatório", dias: 30 },
  catarata: { rotulo: "Catarata (acompanhar)", dias: 365 },
  outro: { rotulo: "Outro", dias: 180 },
};

export function rotuloCondicoes(s?: string | null): string {
  if (!s) return "";
  return s.split(", ").map((c) => CONDICOES[c]?.rotulo ?? c).join(", ");
}

export function fmtIntervalo(d: number): string {
  if (d % 365 === 0) return d === 365 ? "1 ano" : `${d / 365} anos`;
  if (d % 30 === 0) return d === 30 ? "1 mês" : `${d / 30} meses`;
  return `${d} dias`;
}

export interface Seguimento {
  id: string; paciente_id: string; condicao: string; descricao: string | null; intervalo_dias: number;
  pio_alvo_od: number | null; pio_alvo_oe: number | null; ativo: boolean; encerrado_motivo: string | null; criado_em: string;
}

export async function seguimentosAtivos(pacienteId: string): Promise<Seguimento[]> {
  return ok(await supabase.from("seguimentos").select("*").eq("paciente_id", pacienteId).eq("ativo", true).order("criado_em")) as Seguimento[];
}

/** Caixa "Acompanhamento" (na aba Evolução). Médico cria/edita; enfermagem só vê. */
export function AcompanhamentoPaciente({ pacienteId, podeEditar, aoMudar }: { pacienteId: string; podeEditar: boolean; aoMudar?: () => void }) {
  const lista = useCarregar(() => seguimentosAtivos(pacienteId), [pacienteId]);
  const [editar, setEditar] = useState<Partial<Seguimento> | null>(null);
  const mudou = () => { setEditar(null); lista.recarregar(); aoMudar?.(); };
  return (
    <div className="secao" style={{ marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 8px" }}>
        <span>🔔 Acompanhamento</span>
        {podeEditar && <button className="mini" onClick={() => setEditar({ condicao: "glaucoma", intervalo_dias: 120 })}>➕ Acompanhar</button>}
      </h3>
      <Aviso>{lista.erro}</Aviso>
      {(lista.dados ?? []).length === 0 && (
        <div className="muted pequeno">Sem acompanhamento marcado. {podeEditar && "Marque para o paciente entrar na busca ativa se não voltar no prazo."}</div>
      )}
      {(lista.dados ?? []).map((s) => (
        <div key={s.id} className="linha entre" style={{ padding: "6px 0", borderTop: "1px solid #f0f2f4" }}>
          <div>
            <b>{CONDICOES[s.condicao]?.rotulo ?? s.condicao}</b>
            <span className="muted"> · retorno a cada {fmtIntervalo(s.intervalo_dias)}</span>
            {(s.pio_alvo_od != null || s.pio_alvo_oe != null) && <> · <Etiqueta cor="azul">PIO alvo {s.pio_alvo_od ?? "—"} / {s.pio_alvo_oe ?? "—"}</Etiqueta></>}
            {s.descricao && <div className="muted pequeno">{s.descricao}</div>}
          </div>
          {podeEditar && <button className="mini" onClick={() => setEditar(s)}>Editar</button>}
        </div>
      ))}
      {editar && <EditarSeguimento pacienteId={pacienteId} s={editar} aoFechar={() => setEditar(null)} aoSalvar={mudou} />}
    </div>
  );
}

export function EditarSeguimento(props: { pacienteId: string; s: Partial<Seguimento>; aoFechar: () => void; aoSalvar: () => void }) {
  const novo = !props.s.id;
  const [f, setF] = useState({
    condicao: props.s.condicao ?? "glaucoma", intervalo_dias: String(props.s.intervalo_dias ?? 120),
    pio_alvo_od: props.s.pio_alvo_od?.toString() ?? "", pio_alvo_oe: props.s.pio_alvo_oe?.toString() ?? "", descricao: props.s.descricao ?? "",
  });
  const [encerrar, setEncerrar] = useState("");
  const [erro, setErro] = useState("");
  async function salvar() {
    const dias = Number(f.intervalo_dias);
    if (!(dias >= 7 && dias <= 730)) return setErro("O intervalo deve ficar entre 7 e 730 dias.");
    const dados = {
      condicao: f.condicao, intervalo_dias: dias, descricao: f.descricao || null,
      pio_alvo_od: numOuNulo(f.pio_alvo_od), pio_alvo_oe: numOuNulo(f.pio_alvo_oe),
    };
    const r = novo
      ? await supabase.from("seguimentos").insert({ ...dados, paciente_id: props.pacienteId })
      : await supabase.from("seguimentos").update(dados).eq("id", props.s.id!);
    if (r.error) return setErro(/seguimentos_um_ativo/.test(r.error.message) ? "Este paciente já é acompanhado por essa condição." : msgErro(r.error));
    props.aoSalvar();
  }
  async function encerrarSeg() {
    if (!encerrar.trim()) return setErro("Diga o motivo para encerrar (ex.: alta, operado, acompanha em outro serviço).");
    const r = await supabase.from("seguimentos").update({ ativo: false, encerrado_motivo: encerrar.trim() }).eq("id", props.s.id!);
    if (r.error) return setErro(msgErro(r.error));
    props.aoSalvar();
  }
  const glaucoma = f.condicao === "glaucoma" || f.condicao === "suspeita_glaucoma";
  return (
    <Modal titulo={novo ? "Acompanhar paciente" : "Editar acompanhamento"} aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Condição">
          <select value={f.condicao} onChange={(e) => setF({ ...f, condicao: e.target.value, intervalo_dias: String(CONDICOES[e.target.value].dias) })}>
            {Object.entries(CONDICOES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Retorno a cada (dias)">
          <div className="linha" style={{ gap: 4 }}>
            {[[90, "3m"], [120, "4m"], [180, "6m"], [365, "1a"]].map(([d, r]) => (
              <button key={d} type="button" className={"mini" + (f.intervalo_dias === String(d) ? " primario" : "")} onClick={() => setF({ ...f, intervalo_dias: String(d) })}>{r}</button>
            ))}
            <input style={{ width: 70 }} inputMode="numeric" value={f.intervalo_dias} onChange={(e) => setF({ ...f, intervalo_dias: e.target.value.replace(/\D/g, "") })} />
          </div>
        </Campo>
        {glaucoma && (
          <>
            <Campo rotulo="PIO alvo OD (mmHg)"><input inputMode="decimal" value={f.pio_alvo_od} onChange={(e) => setF({ ...f, pio_alvo_od: e.target.value })} /></Campo>
            <Campo rotulo="PIO alvo OE (mmHg)"><input inputMode="decimal" value={f.pio_alvo_oe} onChange={(e) => setF({ ...f, pio_alvo_oe: e.target.value })} /></Campo>
          </>
        )}
        <Campo rotulo="Observação (opcional)" className="inteiro"><input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: campo visual a cada 6 meses" /></Campo>
      </div>
      <p className="muted pequeno">Se o paciente passar do prazo sem consulta marcada, ele aparece na <b>Busca ativa</b> para a recepção ligar.</p>
      {!novo && (
        <div className="secao" style={{ marginTop: 14 }}>
          <b className="pequeno">Encerrar acompanhamento</b>
          <div className="linha" style={{ marginTop: 6 }}>
            <input style={{ flex: 1 }} placeholder="Motivo (alta, operado, outro serviço…)" value={encerrar} onChange={(e) => setEncerrar(e.target.value)} />
            <button className="mini" onClick={encerrarSeg}>Encerrar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
