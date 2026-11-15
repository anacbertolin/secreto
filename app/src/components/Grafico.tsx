// Gráfico de linhas simples (SVG), com régua e balão ao passar o mouse/dedo.
// Cores validadas para daltonismo (OD azul, OE laranja) e formas diferentes nos pontos (círculo × quadrado).
import { useEffect, useRef, useState } from "react";

export interface Ponto { x: number; y: number; rotulo?: string }
export interface Serie { nome: string; cor: string; forma: "circulo" | "quadrado"; pontos: Ponto[] }

export const COR_OD = "#2a78d6";
export const COR_OE = "#eb6834";

const ALT = 220;
const M = { t: 14, r: 44, b: 28, l: 44 };

function fmtDataCurta(t: number) {
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ticks(min: number, max: number, n = 4): number[] {
  const passo0 = (max - min) / n || 1;
  const pot = 10 ** Math.floor(Math.log10(passo0));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= passo0) ?? passo0;
  const out: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + 1e-9; v += passo) out.push(Number(v.toFixed(6)));
  return out;
}

export function GraficoLinhas(props: {
  titulo: string; subtitulo?: string; series: Serie[]; fmtY: (v: number) => string;
  yMin?: number; yMax?: number; referencia?: { y: number; rotulo: string };
}) {
  const caixa = useRef<HTMLDivElement>(null); // mede a área do desenho (não o svg), para não crescer sozinho
  const [larg, setLarg] = useState(600);
  const [foco, setFoco] = useState<number | null>(null);

  useEffect(() => {
    if (!caixa.current) return;
    const ro = new ResizeObserver(([e]) => setLarg(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(caixa.current);
    return () => ro.disconnect();
  }, []);

  const todos = props.series.flatMap((s) => s.pontos);
  if (todos.length === 0) {
    return (
      <div className="grafico">
        <div className="grafico-tit">{props.titulo}</div>
        <div className="vazio pequeno" style={{ padding: 20 }}>Sem registros ainda.</div>
      </div>
    );
  }
  const xs = [...new Set(todos.map((p) => p.x))].sort((a, b) => a - b);
  let x0 = xs[0], x1 = xs[xs.length - 1];
  if (x0 === x1) { x0 -= 86400000 * 15; x1 += 86400000 * 15; }
  const ys = todos.map((p) => p.y).concat(props.referencia ? [props.referencia.y] : []);
  let y0 = props.yMin ?? Math.min(...ys), y1 = props.yMax ?? Math.max(...ys);
  if (props.yMin === undefined || props.yMax === undefined) {
    const folga = (Math.max(...ys) - Math.min(...ys)) * 0.15 || 1;
    if (props.yMin === undefined) y0 = Math.min(...ys) - folga;
    if (props.yMax === undefined) y1 = Math.max(...ys) + folga;
  }
  const W = larg, H = ALT;
  const sx = (x: number) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y: number) => M.t + (1 - (y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const yt = ticks(y0, y1);
  // quantas datas cabem no eixo sem encostar uma na outra (~80 px cada)
  const cabem = Math.max(2, Math.floor((W - M.l - M.r) / 80));
  const xt = xs.length <= cabem ? xs : Array.from({ length: cabem }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (cabem - 1))]);

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let melhor = xs[0];
    for (const x of xs) if (Math.abs(sx(x) - px) < Math.abs(sx(melhor) - px)) melhor = x;
    setFoco(melhor);
  }

  const noFoco = foco === null ? [] : props.series.map((s) => ({ s, p: s.pontos.find((p) => p.x === foco) }));
  const balaoEsq = foco !== null && sx(foco) > W * 0.6;

  return (
    <div className="grafico">
      <div className="linha entre">
        <div>
          <div className="grafico-tit">{props.titulo}</div>
          {props.subtitulo && <div className="muted pequeno">{props.subtitulo}</div>}
        </div>
        <div className="grafico-legenda">
          {props.series.map((s) => (
            <span key={s.nome}><Marcador forma={s.forma} cor={s.cor} x={6} y={6} solto /> {s.nome}</span>
          ))}
        </div>
      </div>
      <div className="grafico-area" ref={caixa}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.titulo}
          onPointerMove={mover} onPointerLeave={() => setFoco(null)} style={{ display: "block", touchAction: "pan-y", width: "100%", height: H }}>
          {yt.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="#eef1f4" />
              <text x={M.l - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="eixo">{props.fmtY(v)}</text>
            </g>
          ))}
          {xt.map((x) => <text key={x} x={sx(x)} y={H - 8} textAnchor="middle" className="eixo">{fmtDataCurta(x)}</text>)}
          {props.referencia && (
            <g>
              <line x1={M.l} x2={W - M.r} y1={sy(props.referencia.y)} y2={sy(props.referencia.y)} stroke="#98a2b3" strokeDasharray="4 4" />
              <text x={W - M.r - 4} y={sy(props.referencia.y) - 5} textAnchor="end" className="eixo">{props.referencia.rotulo}</text>
            </g>
          )}
          {foco !== null && <line x1={sx(foco)} x2={sx(foco)} y1={M.t} y2={H - M.b} stroke="#98a2b3" />}
          {props.series.map((s) => {
            const pts = [...s.pontos].sort((a, b) => a.x - b.x);
            const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x)},${sy(p.y)}`).join("");
            const ult = pts[pts.length - 1];
            return (
              <g key={s.nome}>
                <path d={d} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" />
                {pts.map((p) => <Marcador key={p.x} forma={s.forma} cor={s.cor} x={sx(p.x)} y={sy(p.y)} grande={p.x === foco} />)}
                {ult && <text x={sx(ult.x) + 8} y={sy(ult.y)} dy="0.32em" className="rotulo-serie">{s.nome}</text>}
              </g>
            );
          })}
        </svg>
        {foco !== null && (
          <div className="balao" style={balaoEsq ? { right: W - sx(foco) + 10 } : { left: sx(foco) + 10 }}>
            <div className="muted pequeno">{new Date(foco).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
            {noFoco.map(({ s, p }) => (
              <div key={s.nome} className="linha" style={{ gap: 6 }}>
                <Marcador forma={s.forma} cor={s.cor} x={6} y={6} solto />
                <b>{p ? p.rotulo ?? props.fmtY(p.y) : "—"}</b><span className="muted">{s.nome}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Marcador({ forma, cor, x, y, grande, solto }: { forma: string; cor: string; x: number; y: number; grande?: boolean; solto?: boolean }) {
  const r = grande ? 6 : 4.5;
  const el = forma === "quadrado"
    ? <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5} fill={cor} stroke="white" strokeWidth={2} />
    : <circle cx={x} cy={y} r={r} fill={cor} stroke="white" strokeWidth={2} />;
  return solto ? <svg width={12} height={12} style={{ verticalAlign: "middle" }}>{el}</svg> : el;
}
