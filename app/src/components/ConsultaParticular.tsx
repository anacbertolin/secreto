import { supabase } from "../lib/supabase";
import { useCarregar, ok } from "./ui";
import { fmtMoeda } from "../lib/util";

/** Consultas da tabela particular (migração 0086) com o preço atual. */
interface ConsultaPart { id: string; codigo: string | null; descricao: string; valor: number | null }

// códigos da Micrologos (tabela própria '00') das consultas de cartão e de dinheiro/Pix
const COD_CARTAO = "184";
const COD_PIX = "63";

function useConsultasParticulares() {
  const { dados } = useCarregar(async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const r = ok(await supabase.from("procedimentos").select("id, codigo, descricao, precos(valor, convenio_id, plano_id, ativo, vigente_de)")
      .eq("tipo", "consulta").eq("tabela", "00").eq("ativo", true).order("descricao")) as
      { id: string; codigo: string | null; descricao: string; precos: { valor: number; convenio_id: string | null; plano_id: string | null; ativo: boolean; vigente_de: string }[] }[];
    return r.map((p): ConsultaPart => {
      const pr = (p.precos ?? []).filter((x) => x.ativo && !x.convenio_id && !x.plano_id && x.vigente_de <= hoje)
        .sort((a, b) => b.vigente_de.localeCompare(a.vigente_de))[0];
      return { id: p.id, codigo: p.codigo, descricao: p.descricao, valor: pr ? Number(pr.valor) : null };
    });
  }, []);
  return dados ?? [];
}

/** Chegada de paciente particular: "Cartão ou Dinheiro/Pix?" (ou outra consulta da tabela). */
export function EscolhaConsultaParticular({ valor, aoMudar }: { valor: string; aoMudar: (id: string) => void }) {
  const lista = useConsultasParticulares();
  if (!lista.length) return null;
  const cartao = lista.find((c) => c.codigo === COD_CARTAO);
  const pix = lista.find((c) => c.codigo === COD_PIX);
  const outras = lista.filter((c) => c !== cartao && c !== pix);
  const botao = (c: ConsultaPart | undefined, rotulo: string) => c && (
    <button type="button" className={valor === c.id ? "primario" : ""} onClick={() => aoMudar(c.id)}>
      {valor === c.id ? "✓ " : ""}{rotulo}{c.valor !== null && ` · ${fmtMoeda(c.valor)}`}
    </button>
  );
  return (
    <div className="secao grade" style={{ gap: 8 }}>
      <b>Particular: como o paciente vai pagar a consulta? *</b>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {botao(cartao, "💳 Cartão")}
        {botao(pix, "💵 Dinheiro / Pix")}
      </div>
      <select value={outras.some((c) => c.id === valor) ? valor : ""} onChange={(e) => e.target.value && aoMudar(e.target.value)}>
        <option value="">Ou outra consulta da tabela…</option>
        {outras.map((c) => <option key={c.id} value={c.id}>{c.descricao}{c.valor !== null ? ` — ${fmtMoeda(c.valor)}` : ""}</option>)}
      </select>
    </div>
  );
}
