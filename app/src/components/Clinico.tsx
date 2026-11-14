import { useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Campo } from "./ui";

interface Alergia { id: string; substancia: string; reacao: string | null; gravidade: string | null; ativa: boolean }
interface Medicamento { id: string; medicamento: string; posologia: string | null; olho: string | null; ativo: boolean }
interface Antecedente { id: string; tipo: string; descricao: string; olho: string | null; data_aproximada: string | null }

const TIPOS_ANT: Record<string, string> = {
  pessoal: "Doenças / condições", ocular: "Oculares", cirurgico: "Cirurgias", familiar: "Familiares", habitos: "Hábitos",
};

/** Alergias, medicamentos em uso e antecedentes — visível e editável por médico e enfermagem */
export function HistoricoSaude({ pacienteId, compacto }: { pacienteId: string; compacto?: boolean }) {
  const { dados, erro, recarregar } = useCarregar(async () => {
    const [a, m, h] = await Promise.all([
      supabase.from("alergias").select("*").eq("paciente_id", pacienteId).eq("ativa", true).order("criado_em"),
      supabase.from("medicamentos_em_uso").select("*").eq("paciente_id", pacienteId).eq("ativo", true).order("criado_em"),
      supabase.from("antecedentes").select("*").eq("paciente_id", pacienteId).order("tipo"),
    ]);
    return { alergias: ok(a) as Alergia[], meds: ok(m) as Medicamento[], ants: ok(h) as Antecedente[] };
  }, [pacienteId]);
  const [form, setForm] = useState<"" | "alergia" | "med" | "ant">("");
  const [f, setF] = useState<Record<string, string>>({});
  const [e2, setE2] = useState("");

  async function incluir() {
    setE2("");
    let r;
    if (form === "alergia") {
      if (!f.substancia) return setE2("Informe a substância.");
      r = await supabase.from("alergias").insert({ paciente_id: pacienteId, substancia: f.substancia, reacao: f.reacao || null, gravidade: f.gravidade || "desconhecida" });
    } else if (form === "med") {
      if (!f.medicamento) return setE2("Informe o medicamento.");
      r = await supabase.from("medicamentos_em_uso").insert({ paciente_id: pacienteId, medicamento: f.medicamento, posologia: f.posologia || null, olho: f.olho || null });
    } else {
      if (!f.descricao) return setE2("Descreva o antecedente.");
      r = await supabase.from("antecedentes").insert({ paciente_id: pacienteId, tipo: f.tipo || "pessoal", descricao: f.descricao, olho: f.olho || null, data_aproximada: f.data_aproximada || null });
    }
    if (r.error) return setE2(msgErro(r.error));
    setForm("");
    setF({});
    recarregar();
  }

  async function desativar(tabela: "alergias" | "medicamentos_em_uso", id: string) {
    if (!confirm(tabela === "alergias" ? "Marcar esta alergia como não mais válida?" : "O paciente parou de usar este medicamento?")) return;
    const { error } = await supabase.from(tabela).update(tabela === "alergias" ? { ativa: false } : { ativo: false }).eq("id", id);
    if (error) alert(msgErro(error));
    recarregar();
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const olhoSel = (
    <Campo rotulo="Olho">
      <select value={f.olho ?? ""} onChange={set("olho")}><option value="">—</option><option>OD</option><option>OE</option><option>AO</option></select>
    </Campo>
  );

  return (
    <div>
      <Aviso>{erro}</Aviso>
      {(dados?.alergias.length ?? 0) > 0 ? (
        <div className="alerta-alergia">
          ⚠️ ALERGIAS:{" "}
          {dados!.alergias.map((a, i) => (
            <span key={a.id}>
              {i > 0 && "; "}{a.substancia}{a.reacao && ` (${a.reacao})`}
              {!compacto && <button className="sutil mini" onClick={() => desativar("alergias", a.id)} title="Remover">✕</button>}
            </span>
          ))}
        </div>
      ) : dados && <div className="muted pequeno" style={{ marginTop: 10 }}>Nenhuma alergia registrada.</div>}

      <h3 style={{ marginTop: 16 }}>Medicamentos em uso</h3>
      <ul className="lista-simples">
        {dados?.meds.map((m) => (
          <li key={m.id} className="linha entre">
            <span>{m.medicamento}{m.olho && ` · ${m.olho}`}{m.posologia && <span className="muted"> — {m.posologia}</span>}</span>
            <button className="sutil mini" onClick={() => desativar("medicamentos_em_uso", m.id)} title="Parou de usar">✕</button>
          </li>
        ))}
        {dados?.meds.length === 0 && <li className="muted">Nenhum.</li>}
      </ul>

      <h3 style={{ marginTop: 16 }}>Antecedentes</h3>
      <ul className="lista-simples">
        {dados?.ants.map((a) => (
          <li key={a.id}><span className="muted pequeno">{TIPOS_ANT[a.tipo]}:</span> {a.descricao}{a.olho && ` (${a.olho})`}{a.data_aproximada && <span className="muted"> · {a.data_aproximada}</span>}</li>
        ))}
        {dados?.ants.length === 0 && <li className="muted">Nenhum.</li>}
      </ul>

      {form === "" ? (
        <div className="linha" style={{ marginTop: 10 }}>
          <button className="mini" onClick={() => setForm("alergia")}>+ Alergia</button>
          <button className="mini" onClick={() => setForm("med")}>+ Medicamento</button>
          <button className="mini" onClick={() => setForm("ant")}>+ Antecedente</button>
        </div>
      ) : (
        <div className="secao grade" style={{ marginTop: 10 }}>
          <Aviso>{e2}</Aviso>
          {form === "alergia" && (
            <>
              <Campo rotulo="Substância / medicamento"><input autoFocus value={f.substancia ?? ""} onChange={set("substancia")} /></Campo>
              <Campo rotulo="Reação"><input value={f.reacao ?? ""} onChange={set("reacao")} /></Campo>
              <Campo rotulo="Gravidade">
                <select value={f.gravidade ?? ""} onChange={set("gravidade")}>
                  <option value="desconhecida">Não sabe</option><option value="leve">Leve</option><option value="moderada">Moderada</option><option value="grave">Grave</option>
                </select>
              </Campo>
            </>
          )}
          {form === "med" && (
            <>
              <Campo rotulo="Medicamento"><input autoFocus value={f.medicamento ?? ""} onChange={set("medicamento")} /></Campo>
              <Campo rotulo="Como usa"><input value={f.posologia ?? ""} onChange={set("posologia")} placeholder="Ex.: 1 gota 12/12h" /></Campo>
              {olhoSel}
            </>
          )}
          {form === "ant" && (
            <>
              <Campo rotulo="Tipo">
                <select value={f.tipo ?? "pessoal"} onChange={set("tipo")}>
                  {Object.entries(TIPOS_ANT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Descrição"><input autoFocus value={f.descricao ?? ""} onChange={set("descricao")} placeholder="Ex.: Diabetes tipo 2; Catarata operada; Glaucoma (mãe)" /></Campo>
              {olhoSel}
              <Campo rotulo="Quando (aproximado)"><input value={f.data_aproximada ?? ""} onChange={set("data_aproximada")} placeholder="Ex.: 2019" /></Campo>
            </>
          )}
          <div className="linha"><button className="mini" onClick={() => { setForm(""); setF({}); }}>Cancelar</button><button className="primario mini" onClick={incluir}>Incluir</button></div>
        </div>
      )}
    </div>
  );
}
