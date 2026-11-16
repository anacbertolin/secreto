// Cálculo do repasse médico (cirurgia particular) — mesma regra do banco (migração 0060).
// Serve só para a PRÉVIA na tela; o valor oficial é sempre o calculado pelo banco.

export interface RegrasRepasse {
  imposto_pct: number;
  centro_cirurgico_pct: number;
  taxa_arredondamento: "truncar" | "arredondar";
}
export interface TaxaCartao { id: string; parcelas: number; taxa_cartao: number; taxa_antecipacao: number; taxa_total: number }

export const FORMAS_REPASSE: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", debito: "Cartão de débito", credito: "Cartão de crédito",
};

// trabalha em centavos para não errar nas casas decimais
const c = (v: number) => Math.round(v * 100);
const r = (cent: number) => cent / 100;
const trunc2 = (v: number) => Math.trunc(Math.round(v * 1e6) / 1e4) / 100; // corta centavos (com folga p/ ponto flutuante)
const round2 = (v: number) => Math.round(Math.round(v * 1e6) / 1e4) / 100;

export function taxaInternaPct(forma: string, parcelas: number, taxas: TaxaCartao[]): number | null {
  if (forma !== "credito" || parcelas < 2) return 0;
  const t = taxas.find((x) => x.parcelas === parcelas);
  return t ? Number(t.taxa_total) : null;
}

export function totaisRepasse(valorTotal: number, regras: RegrasRepasse) {
  const imposto = round2((valorTotal * regras.imposto_pct) / 100);
  const centro = round2(((valorTotal - imposto) * regras.centro_cirurgico_pct) / 100);
  return { imposto, centro };
}

/** Partes fixas de cada parcela: divisão igual, sobra de centavos na última */
export function partesPorParcela(total: number, n: number): number[] {
  const parte = Math.trunc(c(total) / n);
  return Array.from({ length: n }, (_, i) => r(i === n - 1 ? c(total) - parte * (n - 1) : parte));
}

export function calcularParcela(valorRecebido: number, imposto: number, centro: number, taxaPct: number, arred: RegrasRepasse["taxa_arredondamento"]) {
  const bruto = (valorRecebido * taxaPct) / 100;
  const taxa = arred === "arredondar" ? round2(bruto) : trunc2(bruto);
  const medico = r(c(valorRecebido) - c(imposto) - c(centro) - c(taxa));
  return { taxa, medico };
}
