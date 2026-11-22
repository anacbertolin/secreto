// Desenho do olho (migração 0026): diagrama do fundo de olho / segmento anterior com as cores padrão.
// Funciona com mouse, dedo (tablet) e caneta. Traços guardados em coordenadas 0–100.
import { useEffect, useRef, useState } from "react";
import { supabase, msgErro } from "../../lib/supabase";
import { useCarregar, ok, Aviso } from "../ui";
import type { Ctx } from "./comum";

interface Traco { cor: string; largura: number; pontos: [number, number][] }
interface DesenhoRow { id: string; olho: string; tipo: string; tracos: Traco[]; legenda: string | null }

export const CORES_DESENHO: { cor: string; rotulo: string }[] = [
  { cor: "#d92d20", rotulo: "Vermelho · retina aplicada, hemorragia, vasos" },
  { cor: "#1d4ed8", rotulo: "Azul · retina descolada, veias" },
  { cor: "#16a34a", rotulo: "Verde · vítreo, opacidades" },
  { cor: "#111111", rotulo: "Preto · pigmento, cicatriz" },
  { cor: "#ca8a04", rotulo: "Amarelo · exsudato, drusas" },
  { cor: "#9333ea", rotulo: "Roxo · laser / marcação" },
];

/** Fundo do desenho: fundo de olho (com disco do lado certo de cada olho) ou segmento anterior */
function Modelo({ tipo, olho }: { tipo: string; olho: string }) {
  if (tipo === "segmento_anterior") {
    return (
      <g fill="none" stroke="#98a2b3" strokeWidth={0.5}>
        <path d="M5 50 Q50 12 95 50" /><path d="M5 50 Q50 88 95 50" />
        <circle cx={50} cy={50} r={22} /><circle cx={50} cy={50} r={8} strokeDasharray="1.5 1.5" />
        <text x={50} y={8} fontSize={4} textAnchor="middle" fill="#98a2b3" stroke="none">superior</text>
      </g>
    );
  }
  // fundo de olho visto pelo examinador: disco óptico do lado nasal (OD à direita, OE à esquerda)
  const disco = olho === "OD" ? 64 : 36;
  const macula = olho === "OD" ? 42 : 58;
  return (
    <g fill="none" stroke="#98a2b3" strokeWidth={0.5}>
      <circle cx={50} cy={50} r={47} />
      <circle cx={50} cy={50} r={33} strokeDasharray="1.5 1.5" />
      <circle cx={50} cy={50} r={17} strokeDasharray="0.8 1.2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return <line key={i} x1={50 + 47 * Math.sin(a)} y1={50 - 47 * Math.cos(a)} x2={50 + 33 * Math.sin(a)} y2={50 - 33 * Math.cos(a)} strokeWidth={0.3} />;
      })}
      <circle cx={disco} cy={50} r={4} strokeWidth={0.8} />
      <circle cx={macula} cy={50} r={1.2} />
      {[12, 3, 6, 9].map((h) => {
        const a = (h % 12) * (Math.PI / 6);
        return <text key={h} x={50 + 49.5 * Math.sin(a)} y={50 - 49.5 * Math.cos(a) + 1.2} fontSize={3} textAnchor="middle" fill="#98a2b3" stroke="none">{h}</text>;
      })}
    </g>
  );
}

function suavizar(p: [number, number][]) {
  return p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
}

export function TelaDesenho(props: { tipo: string; olho: string; tracos: Traco[]; editavel: boolean; aoMudar?: (t: Traco[]) => void; cor?: string; largura?: number; tamanho?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [atual, setAtual] = useState<Traco | null>(null);
  function ponto(e: React.PointerEvent): [number, number] {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100];
  }
  return (
    <svg ref={ref} viewBox="0 0 100 100" className="desenho-tela" style={{ width: props.tamanho ?? "100%", touchAction: props.editavel ? "none" : "auto", cursor: props.editavel ? "crosshair" : "default" }}
      onPointerDown={(e) => { if (!props.editavel) return; (e.target as Element).setPointerCapture?.(e.pointerId); setAtual({ cor: props.cor ?? "#d92d20", largura: props.largura ?? 0.8, pontos: [ponto(e)] }); }}
      onPointerMove={(e) => { if (atual) setAtual({ ...atual, pontos: [...atual.pontos, ponto(e)] }); }}
      onPointerUp={() => { if (atual && atual.pontos.length > 0) props.aoMudar?.([...props.tracos, atual.pontos.length === 1 ? { ...atual, pontos: [atual.pontos[0], [atual.pontos[0][0] + 0.2, atual.pontos[0][1] + 0.2]] } : atual]); setAtual(null); }}
      onPointerLeave={() => { if (atual) { props.aoMudar?.([...props.tracos, atual]); setAtual(null); } }}>
      <rect x={0} y={0} width={100} height={100} fill="white" />
      <Modelo tipo={props.tipo} olho={props.olho} />
      {[...props.tracos, ...(atual ? [atual] : [])].map((t, i) => (
        <path key={i} d={suavizar(t.pontos)} fill="none" stroke={t.cor} strokeWidth={t.largura} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <text x={3} y={6} fontSize={5} fontWeight={700} fill="#344054">{props.olho}</text>
    </svg>
  );
}

/** Aba "Desenho" do atendimento: OD e OE lado a lado */
export function DesenhoOlhos({ ctx }: { ctx: Ctx }) {
  const [tipo, setTipo] = useState<"fundo" | "segmento_anterior">("fundo");
  const [cor, setCor] = useState(CORES_DESENHO[0].cor);
  const [largura, setLargura] = useState(0.8);
  const [tracos, setTracos] = useState<Record<string, Traco[]>>({ OD: [], OE: [] });
  const [legenda, setLegenda] = useState<Record<string, string>>({ OD: "", OE: "" });
  const [mudou, setMudou] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const editavel = ctx.editaMedico;
  const { dados, erro: e1, recarregar } = useCarregar(async () =>
    ok(await supabase.from("desenhos_oculares").select("*").eq("atendimento_id", ctx.atend.id).eq("tipo", tipo)) as DesenhoRow[], [ctx.atend.id, tipo]);
  useEffect(() => {
    if (!dados) return;
    const t: Record<string, Traco[]> = { OD: [], OE: [] }, l: Record<string, string> = { OD: "", OE: "" };
    for (const d of dados) { t[d.olho] = d.tracos ?? []; l[d.olho] = d.legenda ?? ""; }
    setTracos(t); setLegenda(l); setMudou(false);
  }, [dados]);

  async function salvar() {
    setErro(""); setMsg("");
    const linhas = (["OD", "OE"] as const).filter((o) => tracos[o].length || legenda[o] || dados?.some((d) => d.olho === o))
      .map((o) => ({ atendimento_id: ctx.atend.id, olho: o, tipo, tracos: tracos[o], legenda: legenda[o] || null }));
    if (!linhas.length) return;
    const { error } = await supabase.from("desenhos_oculares").upsert(linhas, { onConflict: "atendimento_id,olho,tipo" });
    if (error) return setErro(msgErro(error));
    setMsg("Salvo ✓"); setMudou(false); recarregar();
  }
  const desfazer = (o: string) => { setTracos({ ...tracos, [o]: tracos[o].slice(0, -1) }); setMudou(true); };
  const limpar = (o: string) => { if (confirm(`Apagar o desenho do ${o}?`)) { setTracos({ ...tracos, [o]: [] }); setMudou(true); } };

  return (
    <div>
      <Aviso>{erro || e1}</Aviso>
      <div className="linha entre" style={{ marginBottom: 10 }}>
        <div className="abas" style={{ marginBottom: 0, borderBottom: 0 }}>
          <button className={tipo === "fundo" ? "ativa" : ""} onClick={() => setTipo("fundo")}>Fundo de olho</button>
          <button className={tipo === "segmento_anterior" ? "ativa" : ""} onClick={() => setTipo("segmento_anterior")}>Segmento anterior</button>
        </div>
        {editavel && <div className="linha">{msg && <span className="salvo">{msg}</span>}<button className="primario" disabled={!mudou} onClick={salvar}>Salvar desenho</button></div>}
      </div>
      {editavel && (
        <div className="linha desenho-paleta">
          {CORES_DESENHO.map((c) => (
            <button key={c.cor} title={c.rotulo} aria-label={c.rotulo} className={"cor" + (cor === c.cor ? " ativa" : "")} style={{ background: c.cor }} onClick={() => setCor(c.cor)} />
          ))}
          <span className="muted pequeno" style={{ marginLeft: 6 }}>{CORES_DESENHO.find((c) => c.cor === cor)?.rotulo}</span>
          <span style={{ flex: 1 }} />
          <label className="pequeno muted">Traço
            <select style={{ width: 90, marginLeft: 6 }} value={largura} onChange={(e) => setLargura(Number(e.target.value))}>
              <option value={0.5}>fino</option><option value={0.8}>médio</option><option value={1.6}>grosso</option><option value={3}>pintar</option>
            </select>
          </label>
        </div>
      )}
      <div className="grade g2">
        {(["OD", "OE"] as const).map((o) => (
          <div key={o} className="secao">
            <TelaDesenho tipo={tipo} olho={o} tracos={tracos[o]} editavel={editavel} cor={cor} largura={largura} aoMudar={(t) => { setTracos({ ...tracos, [o]: t }); setMudou(true); }} />
            {editavel && <div className="linha" style={{ marginTop: 6 }}><button className="mini" onClick={() => desfazer(o)} disabled={!tracos[o].length}>↶ Desfazer</button><button className="mini" onClick={() => limpar(o)} disabled={!tracos[o].length}>Limpar</button></div>}
            <input style={{ marginTop: 6 }} disabled={!editavel} placeholder={`Observação ${o} (opcional)`} value={legenda[o]} onChange={(e) => { setLegenda({ ...legenda, [o]: e.target.value }); setMudou(true); }} />
          </div>
        ))}
      </div>
      {!editavel && !dados?.length && <div className="muted">Nenhum desenho neste atendimento.</div>}
    </div>
  );
}
