import { useEffect, useState } from "react";
import { supabase, msgErro } from "../../lib/supabase";
import { useCarregar, ok, Aviso, Campo } from "../ui";
import { EstadoSalvo, InserirModelo, limpar, type Ctx } from "./comum";
import { fmtGrau, numOuNulo } from "../../lib/util";

type F = Record<string, string>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Hook de formulário com "sujo/salvo" */
function useForm(inicial: F | null) {
  const [f, setF] = useState<F>({});
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { if (inicial) { setF(inicial); setSujo(false); } }, [inicial]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setF((x) => ({ ...x, [k]: e.target.value })); setSujo(true); };
  const add = (k: string, texto: string) => { setF((x) => ({ ...x, [k]: x[k] ? `${x[k]}\n${texto}` : texto })); setSujo(true); };
  async function salvar(fn: () => Promise<{ error: unknown }>) {
    setErro(""); setSalvando(true);
    const { error } = await fn();
    setSalvando(false);
    if (error) { setErro(msgErro(error)); return false; }
    setSujo(false); setSalvoEm(new Date());
    return true;
  }
  const alterar = (n: F) => { setF(n); setSujo(true); };
  return { f, setF: alterar, set, add, sujo, salvando, salvoEm, erro, salvar };
}

// ---------------------------------------------------------------- Anamnese / Conduta
export function CamposAtendimento({ ctx, campos }: { ctx: Ctx; campos: { k: string; rotulo: string; tipoModelo?: string; linhas?: number; curto?: boolean }[] }) {
  const ini = Object.fromEntries(campos.map((c) => [c.k, str((ctx.atend as unknown as Record<string, unknown>)[c.k])]));
  const [inicial] = useState<F>(ini);
  const fm = useForm(inicial);
  const d = !ctx.editaMedico;
  return (
    <div className="grade">
      <Aviso>{fm.erro}</Aviso>
      {campos.map((c) => (
        <Campo key={c.k} rotulo={c.rotulo}>
          {c.tipoModelo && !d && <span style={{ marginTop: -24, alignSelf: "flex-end" }}><InserirModelo tipo={c.tipoModelo} aoEscolher={(t) => fm.add(c.k, t)} /></span>}
          {c.curto
            ? <input disabled={d} value={fm.f[c.k] ?? ""} onChange={fm.set(c.k)} />
            : <textarea disabled={d} rows={c.linhas ?? 3} value={fm.f[c.k] ?? ""} onChange={fm.set(c.k)} />}
        </Campo>
      ))}
      {!d && (
        <div className="linha">
          <button className="primario" disabled={!fm.sujo || fm.salvando}
            onClick={() => fm.salvar(async () => supabase.from("atendimentos").update(limpar(fm.f)).eq("id", ctx.atend.id))}>Salvar</button>
          <EstadoSalvo sujo={fm.sujo} salvando={fm.salvando} salvoEm={fm.salvoEm} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Pré-consulta
const CAMPOS_TRIAGEM = [
  "pressao_sistolica", "pressao_diastolica", "frequencia_cardiaca", "glicemia", "peso_kg", "altura_cm",
  "av_longe_od_sc", "av_longe_oe_sc", "av_longe_od_cc", "av_longe_oe_cc", "av_perto_od", "av_perto_oe",
  "pio_od", "pio_oe", "pio_metodo", "pio_hora", "observacoes",
];
const NUMERICOS = new Set(["pressao_sistolica", "pressao_diastolica", "frequencia_cardiaca", "glicemia", "peso_kg", "altura_cm", "pio_od", "pio_oe"]);

export function PreConsulta({ ctx }: { ctx: Ctx }) {
  const { dados, erro } = useCarregar(async () => {
    const r = ok(await supabase.from("triagens").select("*").eq("atendimento_id", ctx.atend.id).order("criado_em").limit(1)) as Record<string, unknown>[];
    return r[0] ?? null;
  }, [ctx.atend.id]);
  const [inicial, setInicial] = useState<F | null>(null);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (dados !== null || !erro) {
      setId((dados?.id as string) ?? null);
      setInicial(Object.fromEntries(CAMPOS_TRIAGEM.map((k) => [k, str(dados?.[k])])));
    }
  }, [dados, erro]);
  const fm = useForm(inicial);
  const d = !ctx.editaClinico;

  async function salvar() {
    const v: Record<string, unknown> = {};
    for (const k of CAMPOS_TRIAGEM) v[k] = NUMERICOS.has(k) ? numOuNulo(fm.f[k]) : fm.f[k]?.trim() || null;
    await fm.salvar(async () => {
      if (id) return supabase.from("triagens").update(v).eq("id", id);
      const r = await supabase.from("triagens").insert({ ...v, atendimento_id: ctx.atend.id }).select("id").single();
      if (!r.error) setId((r.data as { id: string }).id);
      return r;
    });
  }
  const I = (k: string, ph?: string) => <input disabled={d} value={fm.f[k] ?? ""} onChange={fm.set(k)} placeholder={ph} />;

  return (
    <div className="grade">
      <Aviso>{erro || fm.erro}</Aviso>
      <div className="secao">
        <h3>Acuidade visual</h3>
        <table className="tabela-olhos">
          <thead><tr><th></th><th>Longe sem correção</th><th>Longe com correção</th><th>Perto</th></tr></thead>
          <tbody>
            <tr><td>OD</td><td>{I("av_longe_od_sc")}</td><td>{I("av_longe_od_cc")}</td><td>{I("av_perto_od")}</td></tr>
            <tr><td>OE</td><td>{I("av_longe_oe_sc")}</td><td>{I("av_longe_oe_cc")}</td><td>{I("av_perto_oe")}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="secao">
        <h3>Pressão intraocular (tonometria)</h3>
        <div className="grade g4">
          <Campo rotulo="PIO OD (mmHg)">{I("pio_od")}</Campo>
          <Campo rotulo="PIO OE (mmHg)">{I("pio_oe")}</Campo>
          <Campo rotulo="Método">
            <select disabled={d} value={fm.f.pio_metodo ?? ""} onChange={fm.set("pio_metodo")}>
              <option value="">—</option><option>Sopro (não contato)</option><option>Aplanação (Goldmann)</option><option>Icare</option><option>Tonopen</option>
            </select>
          </Campo>
          <Campo rotulo="Hora"><input disabled={d} type="time" value={fm.f.pio_hora?.slice(0, 5) ?? ""} onChange={fm.set("pio_hora")} /></Campo>
        </div>
      </div>
      <div className="secao">
        <h3>Sinais vitais</h3>
        <div className="grade g6">
          <Campo rotulo="PA sistólica">{I("pressao_sistolica")}</Campo>
          <Campo rotulo="PA diastólica">{I("pressao_diastolica")}</Campo>
          <Campo rotulo="Freq. cardíaca">{I("frequencia_cardiaca")}</Campo>
          <Campo rotulo="Glicemia">{I("glicemia")}</Campo>
          <Campo rotulo="Peso (kg)">{I("peso_kg")}</Campo>
          <Campo rotulo="Altura (cm)">{I("altura_cm")}</Campo>
        </div>
      </div>
      <Campo rotulo="Observações da pré-consulta"><textarea disabled={d} rows={2} value={fm.f.observacoes ?? ""} onChange={fm.set("observacoes")} /></Campo>
      {!d && (
        <div className="linha">
          <button className="primario" disabled={!fm.sujo || fm.salvando} onClick={salvar}>Salvar pré-consulta</button>
          <EstadoSalvo sujo={fm.sujo} salvando={fm.salvando} salvoEm={fm.salvoEm} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Refração
const TIPOS_REF: [string, string][] = [
  ["lensometria", "Lensometria (óculos atuais)"],
  ["autorrefracao", "Autorrefração"],
  ["dinamica", "Refração dinâmica"],
  ["estatica_cicloplegia", "Refração estática (cicloplegia)"],
];
interface Ref { id: string; tipo: string; olho: string; esferico: number | null; cilindrico: number | null; eixo: number | null; adicao: number | null; acuidade_visual: string | null; k1: number | null; k2: number | null; eixo_k: number | null }

export function Refracao({ ctx }: { ctx: Ctx }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("refracoes").select("*").eq("atendimento_id", ctx.atend.id)) as Ref[], [ctx.atend.id]);
  return (
    <div>
      <Aviso>{erro}</Aviso>
      {dados && TIPOS_REF.map(([t, r]) => <BlocoRefracao key={t} tipo={t} rotulo={r} linhas={dados.filter((x) => x.tipo === t)} ctx={ctx} aoSalvar={recarregar} />)}
      {dados && <BlocoRefracao tipo="ceratometria" rotulo="Ceratometria" linhas={dados.filter((x) => x.tipo === "ceratometria")} ctx={ctx} aoSalvar={recarregar} />}
    </div>
  );
}

function BlocoRefracao({ tipo, rotulo, linhas, ctx, aoSalvar }: { tipo: string; rotulo: string; linhas: Ref[]; ctx: Ctx; aoSalvar: () => void }) {
  const cer = tipo === "ceratometria";
  const cols = cer ? ["k1", "k2", "eixo_k"] : ["esferico", "cilindrico", "eixo", "adicao", "acuidade_visual"];
  const [inicial] = useState<F>(() => {
    const o: F = {};
    for (const olho of ["OD", "OE"]) {
      const l = linhas.find((x) => x.olho === olho) as unknown as Record<string, unknown> | undefined;
      for (const c of cols) {
        const v = l?.[c];
        o[`${olho}_${c}`] = ["esferico", "cilindrico", "adicao"].includes(c) && v !== null && v !== undefined ? fmtGrau(v as number).replace("Plano", "0,00") : str(v);
      }
    }
    return o;
  });
  const fm = useForm(inicial);
  const d = !ctx.editaClinico;
  const vazio = linhas.length === 0 && d;

  async function salvar() {
    await fm.salvar(async () => {
      for (const olho of ["OD", "OE"]) {
        const v: Record<string, unknown> = {};
        let algum = false;
        for (const c of cols) {
          const raw = fm.f[`${olho}_${c}`];
          v[c] = c === "acuidade_visual" ? raw?.trim() || null : numOuNulo(raw);
          if (v[c] !== null) algum = true;
        }
        if (v.eixo !== null && v.eixo !== undefined) v.eixo = Math.round(v.eixo as number);
        if (v.eixo_k !== null && v.eixo_k !== undefined) v.eixo_k = Math.round(v.eixo_k as number);
        const ex = linhas.find((x) => x.olho === olho);
        let r;
        if (ex && algum) r = await supabase.from("refracoes").update(v).eq("id", ex.id);
        else if (ex && !algum) r = await supabase.from("refracoes").delete().eq("id", ex.id);
        else if (algum) r = await supabase.from("refracoes").insert({ ...v, atendimento_id: ctx.atend.id, tipo, olho });
        if (r?.error) return r;
      }
      aoSalvar();
      return { error: null };
    });
  }

  if (vazio) return null;
  return (
    <div className="secao">
      <h3>{rotulo}</h3>
      <Aviso>{fm.erro}</Aviso>
      <table className="tabela-olhos">
        <thead><tr><th></th>{cer ? <><th>K1</th><th>K2</th><th>Eixo</th></> : <><th>Esférico</th><th>Cilíndrico</th><th>Eixo (°)</th><th>Adição</th><th>AV</th></>}</tr></thead>
        <tbody>
          {["OD", "OE"].map((olho) => (
            <tr key={olho}>
              <td>{olho}</td>
              {cols.map((c) => <td key={c}><input disabled={d} value={fm.f[`${olho}_${c}`] ?? ""} onChange={fm.set(`${olho}_${c}`)} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!d && (
        <div className="linha" style={{ marginTop: 8 }}>
          <button className="mini primario" disabled={!fm.sujo || fm.salvando} onClick={salvar}>Salvar</button>
          <EstadoSalvo sujo={fm.sujo} salvando={fm.salvando} salvoEm={fm.salvoEm} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Exame oftalmológico
const CAMPOS_EXAME: { k: string; rotulo: string; par?: string; num?: boolean; padrao?: string }[] = [
  { k: "ectoscopia", rotulo: "Ectoscopia", padrao: "Sem alterações." },
  { k: "motilidade_ocular", rotulo: "Motilidade ocular", padrao: "Movimentos oculares preservados." },
  { k: "reflexos_pupilares", rotulo: "Reflexos pupilares", padrao: "Pupilas isocóricas e fotorreagentes." },
  { k: "biomicroscopia_od", rotulo: "Biomicroscopia OD", par: "biomicroscopia_oe", padrao: "Pálpebras e cílios sem alterações, conjuntiva calma, córnea transparente, câmara anterior formada, íris sem alterações, cristalino transparente." },
  { k: "biomicroscopia_oe", rotulo: "Biomicroscopia OE" },
  { k: "gonioscopia_od", rotulo: "Gonioscopia OD", par: "gonioscopia_oe" },
  { k: "gonioscopia_oe", rotulo: "Gonioscopia OE" },
  { k: "pio_aplanacao_od", rotulo: "PIO aplanação OD (mmHg)", num: true },
  { k: "pio_aplanacao_oe", rotulo: "PIO aplanação OE (mmHg)", num: true },
  { k: "fundoscopia_od", rotulo: "Fundoscopia / mapeamento OD", par: "fundoscopia_oe", padrao: "Disco óptico de bordos nítidos, escavação fisiológica, mácula com brilho preservado, vasos de calibre normal, retina aplicada." },
  { k: "fundoscopia_oe", rotulo: "Fundoscopia / mapeamento OE" },
  { k: "outros_achados", rotulo: "Outros achados" },
];

export function ExameOftalmologico({ ctx }: { ctx: Ctx }) {
  const { dados, erro } = useCarregar(async () => {
    const r = ok(await supabase.from("exames_oftalmologicos").select("*").eq("atendimento_id", ctx.atend.id)) as Record<string, unknown>[];
    return r[0] ?? {};
  }, [ctx.atend.id]);
  const [inicial, setInicial] = useState<F | null>(null);
  useEffect(() => { if (dados) setInicial(Object.fromEntries(CAMPOS_EXAME.map((c) => [c.k, str(dados[c.k])]))); }, [dados]);
  const fm = useForm(inicial);
  const d = !ctx.editaMedico;

  async function salvar() {
    const v: Record<string, unknown> = { atendimento_id: ctx.atend.id };
    for (const c of CAMPOS_EXAME) v[c.k] = c.num ? numOuNulo(fm.f[c.k]) : fm.f[c.k]?.trim() || null;
    await fm.salvar(async () => supabase.from("exames_oftalmologicos").upsert(v, { onConflict: "atendimento_id" }));
  }
  function normal() {
    const n = { ...fm.f };
    for (const c of CAMPOS_EXAME) {
      if (c.padrao && !n[c.k]) n[c.k] = c.padrao;
      if (c.par) { const p = CAMPOS_EXAME.find((x) => x.k === c.par)!; if (c.padrao && !n[p.k]) n[p.k] = c.padrao; }
    }
    fm.setF(n);
  }

  return (
    <div className="grade">
      <Aviso>{erro || fm.erro}</Aviso>
      {!d && <div><button className="mini" onClick={normal}>✨ Preencher campos vazios com "exame normal"</button></div>}
      <div className="grade g2">
        {CAMPOS_EXAME.map((c) => (
          <Campo key={c.k} rotulo={c.rotulo} className={["ectoscopia", "motilidade_ocular", "reflexos_pupilares", "outros_achados"].includes(c.k) ? "inteiro" : ""}>
            {c.num ? <input disabled={d} value={fm.f[c.k] ?? ""} onChange={fm.set(c.k)} />
              : <textarea disabled={d} rows={c.k.startsWith("biomicro") || c.k.startsWith("fundo") ? 3 : 2} value={fm.f[c.k] ?? ""} onChange={fm.set(c.k)} />}
          </Campo>
        ))}
      </div>
      {!d && (
        <div className="linha">
          <button className="primario" disabled={!fm.sujo || fm.salvando} onClick={salvar}>Salvar exame</button>
          <EstadoSalvo sujo={fm.sujo} salvando={fm.salvando} salvoEm={fm.salvoEm} />
        </div>
      )}
    </div>
  );
}
