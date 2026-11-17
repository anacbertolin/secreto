// Cálculo do repasse médico (cirurgia particular) — mesma regra do banco (migrações 0060–0062).
// Serve só para a PRÉVIA na tela; o valor oficial é sempre o calculado pelo banco.

export interface RegrasRepasse {
  imposto_pct: number;
  centro_cirurgico_pct: number;
  taxa_arredondamento: "truncar" | "arredondar";
}
export interface TaxaCartao { id: string; forma: "credito" | "debito"; parcelas: number; taxa_cartao: number; taxa_antecipacao: number; taxa_total: number }

export const FORMAS_REPASSE: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", debito: "Cartão de débito", credito: "Cartão de crédito",
};

// trabalha em centavos para não errar nas casas decimais
const c = (v: number) => Math.round(v * 100);
const r = (cent: number) => cent / 100;
const trunc2 = (v: number) => Math.trunc(Math.round(v * 1e6) / 1e4) / 100; // corta centavos (com folga p/ ponto flutuante)
const round2 = (v: number) => Math.round(Math.round(v * 1e6) / 1e4) / 100;

export function taxaInternaPct(forma: string, parcelas: number, taxas: TaxaCartao[]): number | null {
  if (forma !== "credito" && forma !== "debito") return 0; // dinheiro e PIX: sem taxa interna
  const t = taxas.find((x) => x.forma === forma && x.parcelas === (forma === "debito" ? 1 : parcelas));
  return t ? Number(t.taxa_total) : null;
}

/** Regra da refrativa (migração 0062): imposto e taxa do cartão sobre o VALOR TOTAL; da sobra, clínica % e médico o resto */
export function calcularRepasse(valorTotal: number, regras: RegrasRepasse, taxaPct: number) {
  const imposto = round2((valorTotal * regras.imposto_pct) / 100);
  const bruto = (valorTotal * taxaPct) / 100;
  const taxa = regras.taxa_arredondamento === "arredondar" ? round2(bruto) : trunc2(bruto);
  const sobra = r(c(valorTotal) - c(imposto) - c(taxa));
  const clinica = round2((sobra * regras.centro_cirurgico_pct) / 100);
  const medico = r(c(sobra) - c(clinica));
  return { imposto, taxa, sobra, clinica, medico };
}

/** Partes fixas de cada parcela: divisão igual, sobra de centavos na última */
export function partesPorParcela(total: number, n: number): number[] {
  const parte = Math.trunc(c(total) / n);
  return Array.from({ length: n }, (_, i) => r(i === n - 1 ? c(total) - parte * (n - 1) : parte));
}
