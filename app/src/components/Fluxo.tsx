// Etapa do paciente, cronômetro da dilatação e botões do fluxo (recepção, consultório e atendimento)
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Aviso, Campo, Etiqueta, Modal } from "./ui";
import type { Agendamento } from "../lib/dados";
import { COLIRIOS_DILATACAO, ETAPAS, chamarNaTV, dilatacao, minhaSala, mudarEtapa } from "../lib/fluxo";
import { fmtHora } from "../lib/util";

/** Etiqueta da etapa + cronômetro da dilatação */
export function EtapaPaciente({ a }: { a: Agendamento }) {
  if (!a.etapa) return null;
  const e = ETAPAS[a.etapa];
  const d = dilatacao(a);
  if (d) {
    return d.pronto ? (
      <span className="etiqueta verde pisca" title={a.dilatacao_colirio ?? ""}>💧 Dilatado · pronto há {Math.abs(d.restam)} min</span>
    ) : (
      <span className="etiqueta amarelo" title={a.dilatacao_colirio ?? ""}>
        💧 Dilatando · faltam {d.restam} min
        <span className="barra-dilatacao"><span style={{ width: `${Math.min(100, (d.decorridos / d.previsto) * 100)}%` }} /></span>
      </span>
    );
  }
  return <Etiqueta cor={e?.cor ?? "cinza"}>{e?.icone} {e?.rotulo ?? a.etapa}</Etiqueta>;
}

/** Botões para mudar a etapa e chamar o paciente. `compacto` mostra só o essencial. */
export function AcoesFluxo(props: { a: Agendamento; aoMudar: () => void; podeChamar?: boolean; compacto?: boolean }) {
  const { a } = props;
  const [dilatar, setDilatar] = useState(false);
  const [chamar, setChamar] = useState(false);
  const [erro, setErro] = useState("");
  if (a.status !== "chegou" && a.status !== "em_atendimento") return null;

  async function etapa(nova: string | null) {
    setErro("");
    const campos: Partial<Agendamento> = { etapa: nova };
    const e = await mudarEtapa(a.id, campos);
    if (e) setErro(e); else props.aoMudar();
  }

  return (
    <>
      {erro && <span className="pequeno" style={{ color: "var(--perigo)" }}>{erro}</span>}
      {a.etapa !== "dilatando" && <button className="mini" onClick={() => setDilatar(true)} title="Pingou colírio para dilatar a pupila">💧 Dilatar</button>}
      {a.status === "chegou" && a.etapa !== "pronto_medico" && <button className="mini" onClick={() => etapa("pronto_medico")}>✅ Pronto p/ médico</button>}
      {!props.compacto && a.status === "chegou" && a.etapa !== "pre_consulta" && <button className="mini" onClick={() => etapa("pre_consulta")}>🩺 Pré-consulta</button>}
      {!props.compacto && a.etapa !== "exames" && <button className="mini" onClick={() => etapa("exames")}>🔬 Exames</button>}
      {props.podeChamar && <button className="mini" onClick={() => setChamar(true)} title="Mostra o nome na TV da sala de espera">📢 Chamar</button>}
      {a.chamada_em && <span className="muted pequeno">chamado às {fmtHora(a.chamada_em)}{a.chamada_local && ` (${a.chamada_local})`}</span>}
      {dilatar && <ModalDilatar a={a} aoFechar={() => setDilatar(false)} aoSalvar={() => { setDilatar(false); props.aoMudar(); }} />}
      {chamar && <ModalChamar a={a} aoFechar={() => setChamar(false)} aoSalvar={() => { setChamar(false); props.aoMudar(); }} />}
    </>
  );
}

function ModalDilatar(props: { a: Agendamento; aoFechar: () => void; aoSalvar: () => void }) {
  const [colirio, setColirio] = useState(props.a.dilatacao_colirio ?? COLIRIOS_DILATACAO[0]);
  const [olho, setOlho] = useState(props.a.dilatacao_olho ?? "AO");
  const [minutos, setMinutos] = useState(String(props.a.dilatacao_minutos ?? 30));
  const [erro, setErro] = useState("");
  async function salvar() {
    const m = Number(minutos);
    if (!(m >= 5 && m <= 120)) return setErro("O tempo deve ficar entre 5 e 120 minutos.");
    const e = await mudarEtapa(props.a.id, {
      etapa: "dilatando", dilatacao_colirio: colirio || null, dilatacao_olho: olho, dilatacao_minutos: m,
      dilatacao_inicio_em: new Date().toISOString(),
    });
    if (e) setErro(e); else props.aoSalvar();
  }
  return (
    <Modal titulo="💧 Iniciar dilatação" aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Começar a contar</button></>}>
      <Aviso>{erro}</Aviso>
      <p className="muted" style={{ marginTop: 0 }}>O cronômetro começa agora. Quando o tempo acabar, o paciente aparece como <b>pronto</b> para o médico.</p>
      <div className="grade g3">
        <Campo rotulo="Colírio" className="span2">
          <input list="colirios-dilatacao" value={colirio} onChange={(e) => setColirio(e.target.value)} />
          <datalist id="colirios-dilatacao">{COLIRIOS_DILATACAO.map((c) => <option key={c} value={c} />)}</datalist>
        </Campo>
        <Campo rotulo="Olho">
          <select value={olho} onChange={(e) => setOlho(e.target.value)}>
            <option value="AO">Ambos (AO)</option><option value="OD">Direito (OD)</option><option value="OE">Esquerdo (OE)</option>
          </select>
        </Campo>
        <Campo rotulo="Tempo (minutos)">
          <div className="linha">
            {[20, 30, 40].map((m) => (
              <button key={m} type="button" className={"mini" + (minutos === String(m) ? " primario" : "")} onClick={() => setMinutos(String(m))}>{m}</button>
            ))}
            <input style={{ width: 70 }} inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ""))} />
          </div>
        </Campo>
      </div>
    </Modal>
  );
}

function ModalChamar(props: { a: Agendamento; aoFechar: () => void; aoSalvar: () => void }) {
  const [local, setLocal] = useState(minhaSala() || props.a.sala || "");
  const [erro, setErro] = useState("");
  async function salvar() {
    const e = await chamarNaTV(props.a.id, local.trim());
    if (e) setErro(e); else props.aoSalvar();
  }
  return (
    <Modal titulo="📢 Chamar paciente na TV" aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Chamar</button></>}>
      <Aviso>{erro}</Aviso>
      <Campo rotulo="Para onde o paciente deve ir? (ex.: Consultório 2, Sala de exames)">
        <input autoFocus value={local} onChange={(e) => setLocal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvar()} />
      </Campo>
      <p className="muted pequeno">A sala fica guardada neste computador para as próximas chamadas. A TV mostra só o primeiro e o último nome.</p>
    </Modal>
  );
}

/** Barra do fluxo dentro da tela do atendimento (pré-consulta → dilatação → médico) */
export function BarraFluxoAtendimento({ agendamentoId }: { agendamentoId: string }) {
  const [a, setA] = useState<Agendamento | null>(null);
  const [, setTique] = useState(0);
  async function carregar() {
    const { data } = await supabase.from("agendamentos").select("*").eq("id", agendamentoId).maybeSingle();
    setA((data as Agendamento) ?? null);
  }
  useEffect(() => {
    carregar();
    const t = setInterval(() => { setTique((x) => x + 1); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentoId]);
  if (!a || (a.status !== "chegou" && a.status !== "em_atendimento")) return null;
  return (
    <div className="painel linha" style={{ padding: "10px 14px", marginBottom: 14, gap: 8 }}>
      <b className="pequeno">Etapa do paciente:</b>
      {a.etapa ? <EtapaPaciente a={a} /> : <span className="muted pequeno">—</span>}
      <AcoesFluxo a={a} podeChamar aoMudar={carregar} />
    </div>
  );
}
