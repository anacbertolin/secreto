// Evolução do paciente: pressão do olho (PIO), acuidade visual e grau, ao longo das consultas.
// Só leitura. Usa os dados já registrados (pré-consulta, exame e refração); não muda nada no banco.
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { AcompanhamentoPaciente, seguimentosAtivos } from "./Seguimento";
import { supabase } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando } from "./ui";
import { GraficoLinhas, COR_OD, COR_OE, type Serie } from "./Grafico";
import { fmtData, fmtGrau } from "../lib/util";

interface Linha {
  id: string; inicio: string;
  triagens: { pio_od: number | null; pio_oe: number | null; av_longe_od_sc: string | null; av_longe_oe_sc: string | null; av_longe_od_cc: string | null; av_longe_oe_cc: string | null }[];
  exames_oftalmologicos: { pio_aplanacao_od: number | null; pio_aplanacao_oe: number | null }[] | { pio_aplanacao_od: number | null; pio_aplanacao_oe: number | null } | null;
  refracoes: { tipo: string; olho: string; esferico: number | null; cilindrico: number | null; eixo: number | null }[];
}

/** Converte a acuidade digitada ("20/40", "0,5", "1.0", "20/20 -2") em decimal. Conta dedos, vultos etc. ficam de fora do gráfico. */
export function avDecimal(t?: string | null): number | null {
  if (!t) return null;
  const s = t.trim().replace(",", ".").toUpperCase();
  const snellen = s.match(/^(\d{1,2})\s*\/\s*(\d{1,3})/);
  if (snellen) { const v = Number(snellen[1]) / Number(snellen[2]); return v > 0 && v <= 2 ? Math.round(v * 100) / 100 : null; }
  const dec = s.match(/^(\d(?:\.\d+)?)$/);
  if (dec) { const v = Number(dec[1]); return v > 0 && v <= 2 ? v : null; }
  return null;
}

const PRIORIDADE_REFRACAO = ["dinamica", "estatica_cicloplegia", "autorrefracao", "lensometria"];
const NOME_REFRACAO: Record<string, string> = { dinamica: "dinâmica", estatica_cicloplegia: "estática", autorrefracao: "autorrefração", lensometria: "lensometria" };

export function EvolucaoPaciente({ pacienteId }: { pacienteId: string }) {
  const [verTabela, setVerTabela] = useState(false);
  const { pode } = useAuth();
  const segs = useCarregar(() => seguimentosAtivos(pacienteId), [pacienteId]);
  // PIO alvo: a menor definida nos acompanhamentos (linha tracejada no gráfico)
  const alvos = (segs.dados ?? []).flatMap((s) => [s.pio_alvo_od, s.pio_alvo_oe]).filter((v) => v != null).map(Number);
  const pioAlvo = alvos.length ? Math.min(...alvos) : null;
  const caixa = <AcompanhamentoPaciente pacienteId={pacienteId} podeEditar={pode("medico")} aoMudar={segs.recarregar} />;
  const { dados, erro, carregando } = useCarregar(async () => ok(await supabase.from("atendimentos")
    .select("id, inicio, triagens(pio_od, pio_oe, av_longe_od_sc, av_longe_oe_sc, av_longe_od_cc, av_longe_oe_cc), exames_oftalmologicos(pio_aplanacao_od, pio_aplanacao_oe), refracoes(tipo, olho, esferico, cilindrico, eixo)")
    .eq("paciente_id", pacienteId).order("inicio")) as unknown as Linha[], [pacienteId]);

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Aviso>{erro}</Aviso>;

  // Uma linha por consulta, com o melhor dado de cada medida
  const linhas = (dados ?? []).map((a) => {
    const x = new Date(a.inicio).getTime();
    const tr = a.triagens?.[a.triagens.length - 1];
    const ex = Array.isArray(a.exames_oftalmologicos) ? a.exames_oftalmologicos[0] : a.exames_oftalmologicos;
    // aplanação (Goldmann, feita pelo médico) vale mais que a da pré-consulta
    const pioOD = ex?.pio_aplanacao_od ?? tr?.pio_od ?? null;
    const pioOE = ex?.pio_aplanacao_oe ?? tr?.pio_oe ?? null;
    const avOD = tr?.av_longe_od_cc || tr?.av_longe_od_sc || null;
    const avOE = tr?.av_longe_oe_cc || tr?.av_longe_oe_sc || null;
    const ref = (olho: string) => {
      for (const t of PRIORIDADE_REFRACAO) {
        const r = a.refracoes?.find((x) => x.tipo === t && x.olho === olho && x.esferico !== null);
        if (r) return { ...r, eq: Number(r.esferico) + Number(r.cilindrico ?? 0) / 2 };
      }
      return null;
    };
    return { id: a.id, x, data: a.inicio, pioOD, pioOE, avOD, avOE, refOD: ref("OD"), refOE: ref("OE"), metodoPio: ex?.pio_aplanacao_od != null || ex?.pio_aplanacao_oe != null ? "aplanação" : tr?.pio_od != null ? "pré-consulta" : "" };
  }).filter((l) => l.pioOD != null || l.pioOE != null || l.avOD || l.avOE || l.refOD || l.refOE);

  if (linhas.length === 0) return <div>{caixa}<div className="vazio">Ainda não há medidas registradas para mostrar a evolução.<br /><span className="pequeno">Os gráficos aparecem conforme as consultas registram PIO, acuidade visual e refração.</span></div></div>;

  const serie = (nome: "OD" | "OE", f: (l: typeof linhas[number]) => { y: number; rotulo?: string } | null): Serie => ({
    nome, cor: nome === "OD" ? COR_OD : COR_OE, forma: nome === "OD" ? "circulo" : "quadrado",
    pontos: linhas.map((l) => { const v = f(l); return v ? { x: l.x, ...v } : null; }).filter(Boolean) as Serie["pontos"],
  });

  const pio = [serie("OD", (l) => l.pioOD != null ? { y: Number(l.pioOD), rotulo: `${l.pioOD} mmHg` } : null),
               serie("OE", (l) => l.pioOE != null ? { y: Number(l.pioOE), rotulo: `${l.pioOE} mmHg` } : null)];
  const av = [serie("OD", (l) => { const v = avDecimal(l.avOD); return v != null ? { y: v, rotulo: l.avOD! } : null; }),
              serie("OE", (l) => { const v = avDecimal(l.avOE); return v != null ? { y: v, rotulo: l.avOE! } : null; })];
  const ref = [serie("OD", (l) => l.refOD ? { y: l.refOD.eq, rotulo: `${fmtGrau(l.refOD.eq)} (EE)` } : null),
               serie("OE", (l) => l.refOE ? { y: l.refOE.eq, rotulo: `${fmtGrau(l.refOE.eq)} (EE)` } : null)];

  // Resumo para o médico: última PIO e variação desde a primeira
  const resumoPio = (["OD", "OE"] as const).map((o) => {
    const ps = pio[o === "OD" ? 0 : 1].pontos;
    if (ps.length === 0) return null;
    const ult = ps[ps.length - 1].y, pri = ps[0].y, maior = Math.max(...ps.map((p) => p.y));
    return `${o}: ${ult} mmHg${ps.length > 1 ? ` (1ª ${pri}, maior ${maior})` : ""}`;
  }).filter(Boolean).join(" · ");

  return (
    <div>
      {caixa}
      <div className="linha entre" style={{ marginBottom: 10 }}>
        <div className="muted pequeno">{linhas.length} consulta(s) com medidas{resumoPio && <> · <b>PIO</b> {resumoPio}</>}</div>
        <button className="mini" onClick={() => setVerTabela(!verTabela)}>{verTabela ? "📈 Ver gráficos" : "📋 Ver em tabela"}</button>
      </div>
      {verTabela ? (
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Data</th><th>PIO OD</th><th>PIO OE</th><th>AV OD</th><th>AV OE</th><th>Refração OD</th><th>Refração OE</th></tr></thead>
            <tbody>
              {[...linhas].reverse().map((l) => (
                <tr key={l.id}>
                  <td>{fmtData(l.data)}</td>
                  <td>{l.pioOD ?? "—"}</td><td>{l.pioOE ?? "—"}{l.metodoPio && <div className="muted pequeno">{l.metodoPio}</div>}</td>
                  <td>{l.avOD ?? "—"}</td><td>{l.avOE ?? "—"}</td>
                  <td>{l.refOD ? <>{fmtGrau(l.refOD.esferico)} {l.refOD.cilindrico ? `${fmtGrau(l.refOD.cilindrico)} × ${l.refOD.eixo ?? "?"}°` : ""}<div className="muted pequeno">{NOME_REFRACAO[l.refOD.tipo]}</div></> : "—"}</td>
                  <td>{l.refOE ? <>{fmtGrau(l.refOE.esferico)} {l.refOE.cilindrico ? `${fmtGrau(l.refOE.cilindrico)} × ${l.refOE.eixo ?? "?"}°` : ""}<div className="muted pequeno">{NOME_REFRACAO[l.refOE.tipo]}</div></> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="graficos">
          <GraficoLinhas titulo="Pressão intraocular (PIO)" subtitulo={`mmHg · aplanação quando houver, senão a da pré-consulta${pioAlvo != null ? " · tracejado = PIO alvo" : ""}`}
            series={pio} fmtY={(v) => String(Math.round(v))} referencia={pioAlvo != null ? { y: pioAlvo, rotulo: `alvo ${pioAlvo} mmHg` } : { y: 21, rotulo: "21 mmHg" }} />
          <GraficoLinhas titulo="Acuidade visual (melhor corrigida)" subtitulo="decimal · quanto mais alto, melhor · conta dedos/vultos só na tabela"
            series={av} fmtY={(v) => String(Number(v.toFixed(2))).replace(".", ",")} yMin={0} yMax={Math.max(1.0, ...av.flatMap((s) => s.pontos.map((p) => p.y)))} />
          <GraficoLinhas titulo="Grau (equivalente esférico)" subtitulo="dioptrias · esférico + metade do cilíndrico"
            series={ref} fmtY={(v) => fmtGrau(v).replace("Plano", "0")} />
        </div>
      )}
    </div>
  );
}
