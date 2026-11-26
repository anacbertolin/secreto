// Mais de uma forma de pagamento (migração 0187, pedido do Dr. Gelson, 26/11/2026).
// A primeira forma continua nos campos de sempre; aqui entram as outras (ex.: R$ 1.300 dinheiro + R$ 900 PIX).
import { FORMAS_REPASSE } from "../lib/repasse";
import { fmtMoeda, numOuNulo } from "../lib/util";

export interface LinhaPagamento { forma: string; parcelas: string; valor: string }
export interface PagamentoJson { forma: string; parcelas: number; valor: number }

/** Junta a forma principal com as outras: uma forma só = como antes; mais de uma = "misto" com a lista. */
export function montarPagamento(principal: LinhaPagamento, extras: LinhaPagamento[]):
  { erro: string } | { forma_pagamento: string; parcelas: number; valor_total: number; pagamentos: PagamentoJson[] | null } {
  const todas = [principal, ...extras];
  const lista: PagamentoJson[] = [];
  for (const l of todas) {
    const v = numOuNulo(l.valor);
    if (!v || v <= 0) return { erro: "Informe o valor de cada forma de pagamento." };
    lista.push({ forma: l.forma, parcelas: l.forma === "credito" ? Number(l.parcelas) || 1 : 1, valor: v });
  }
  if (lista.length === 1) return { forma_pagamento: lista[0].forma, parcelas: lista[0].parcelas, valor_total: lista[0].valor, pagamentos: null };
  return {
    forma_pagamento: "misto",
    parcelas: Math.max(1, ...lista.filter((p) => p.forma === "credito").map((p) => p.parcelas)),
    valor_total: Math.round(lista.reduce((s, p) => s + p.valor, 0) * 100) / 100,
    pagamentos: lista,
  };
}

/** Texto curto da forma de pagamento (ex.: "Dinheiro R$ 1.300,00 + PIX R$ 900,00"). */
export function descreverForma(forma: string, parcelas: number, pagamentos?: PagamentoJson[] | null): string {
  if (forma === "misto" && pagamentos?.length) {
    return pagamentos.map((p) => `${FORMAS_REPASSE[p.forma] ?? p.forma}${p.forma === "credito" && p.parcelas > 1 ? ` ${p.parcelas}x` : ""} ${fmtMoeda(p.valor)}`).join(" + ");
  }
  if (forma === "misto") return "Mais de uma forma";
  return `${FORMAS_REPASSE[forma] ?? forma}${forma === "credito" && parcelas > 1 ? ` ${parcelas}x` : ""}`;
}

/** Separa uma lista salva em "principal" + "outras" (para editar). */
export function separarPagamentos(forma: string, parcelas: number, valor: number, pagamentos?: PagamentoJson[] | null) {
  const txt = (v: number) => String(v).replace(".", ",");
  if (forma === "misto" && pagamentos?.length) {
    const [p, ...resto] = pagamentos;
    return { principal: { forma: p.forma, parcelas: String(p.parcelas ?? 1), valor: txt(p.valor) },
             extras: resto.map((x) => ({ forma: x.forma, parcelas: String(x.parcelas ?? 1), valor: txt(x.valor) })) };
  }
  return { principal: { forma, parcelas: String(parcelas || 1), valor: valor ? txt(valor) : "" }, extras: [] as LinhaPagamento[] };
}

export function OutrasFormas({ extras, setExtras, valorPrincipal }: {
  extras: LinhaPagamento[]; setExtras: (l: LinhaPagamento[]) => void; valorPrincipal: string;
}) {
  const muda = (i: number, k: keyof LinhaPagamento, v: string) => setExtras(extras.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = [valorPrincipal, ...extras.map((e) => e.valor)].reduce((s, v) => s + (numOuNulo(v) ?? 0), 0);
  return (
    <div className="inteiro" style={{ marginBottom: 8 }}>
      {extras.map((l, i) => (
        <div key={i} className="linha" style={{ gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span className="pequeno muted">+ outra forma:</span>
          <select style={{ width: 170 }} value={l.forma} onChange={(e) => muda(i, "forma", e.target.value)} aria-label="Outra forma de pagamento">
            {Object.entries(FORMAS_REPASSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {l.forma === "credito" && (
            <select style={{ width: 110 }} value={l.parcelas} onChange={(e) => muda(i, "parcelas", e.target.value)} aria-label="Parcelas">
              {Array.from({ length: 12 }, (_, k) => <option key={k + 1} value={k + 1}>{k + 1 === 1 ? "1x (à vista)" : `${k + 1}x`}</option>)}
            </select>
          )}
          <input style={{ width: 130 }} inputMode="decimal" placeholder="valor (R$)" value={l.valor} onChange={(e) => muda(i, "valor", e.target.value)} aria-label="Valor desta forma" />
          <button className="sutil" title="Tirar esta forma" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="linha" style={{ gap: 10 }}>
        <button className="pequeno" onClick={() => setExtras([...extras, { forma: "pix", parcelas: "1", valor: "" }])}>➕ Pagou com mais de uma forma</button>
        {extras.length > 0 && <b>Total pago: {fmtMoeda(total)}</b>}
      </div>
      {extras.length > 0 && <p className="muted pequeno" style={{ margin: "4px 0 0" }}>No campo do valor de cima coloque só a parte da primeira forma. Só a parte em <b>dinheiro</b> entra no caixa.</p>}
    </div>
  );
}
