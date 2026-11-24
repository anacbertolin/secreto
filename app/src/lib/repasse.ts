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

/** Regra geral (migrações 0062, 0070): bruto − imposto − taxa do cartão − custos = honorários; clínica % e médico o resto */
export function calcularRepasse(valorTotal: number, regras: RegrasRepasse, taxaPct: number, custos = 0, regra = "geral") {
  if (regra === "direto") regras = { ...regras, imposto_pct: 0, centro_cirurgico_pct: 0 }; // sem imposto e sem os 20%
  const imposto = round2((valorTotal * regras.imposto_pct) / 100);
  const bruto = (valorTotal * taxaPct) / 100;
  const taxa = regras.taxa_arredondamento === "arredondar" ? round2(bruto) : trunc2(bruto);
  const sobra = r(c(valorTotal) - c(imposto) - c(taxa) - c(custos));
  const clinica = round2((sobra * regras.centro_cirurgico_pct) / 100);
  const medico = r(c(sobra) - c(clinica));
  return { imposto, taxa, sobra, clinica, medico };
}

/** Partes fixas de cada parcela: divisão igual, sobra de centavos na última */
export function partesPorParcela(total: number, n: number): number[] {
  const parte = Math.trunc(c(total) / n);
  return Array.from({ length: n }, (_, i) => r(i === n - 1 ? c(total) - parte * (n - 1) : parte));
}

export const TIPOS_CUSTO: Record<string, string> = {
  sala: "Taxa de sala (fica para a clínica)", instrumentacao: "Instrumentação", auxiliar: "Auxiliar", anestesista: "Anestesista", insumo: "Insumo / material (fica para a clínica)", outro: "Outro",
};
/** sala e insumo ficam para a clínica: não têm a quem pagar */
export const custoDaClinica = (tipo: string) => tipo === "sala" || tipo === "insumo";

/** tipos de lançamento (migração 0071) */
export const REGRAS: Record<string, { rotulo: string; explica: string }> = {
  geral: { rotulo: "Cirurgia particular", explica: "valor − imposto − taxa do cartão − custos; da sobra, 20% clínica e 80% médico" },
  direto: { rotulo: "Parceiro (sem imposto e sem os 20%)", explica: "valor − custos = médico (ex.: Clínica Vital)" },
  cobranca: { rotulo: "Cobrança ao médico", explica: "o paciente pagou ao médico lá fora; o médico deve os custos à clínica (ex.: Campo Grande)" },
};

/** Procedimento + médico → a versão certa (decisão do Dr. Gelson, 24/11): cada procedimento aparece UMA vez;
 *  se o médico tem exceção cadastrada (mesmo nome, com o médico), vale a dele; senão a padrão (sem médico);
 *  se só existe a de um médico (ex.: pálpebra da Dra. Gisele), vale essa. */
export function varianteProcedimento<T extends { nome: string; profissional_id: string | null }>(procs: T[], nome: string, medico: string): T | undefined {
  const mesmos = procs.filter((p) => p.nome.toLowerCase() === nome.toLowerCase());
  return mesmos.find((p) => !!medico && p.profissional_id === medico) ?? mesmos.find((p) => !p.profissional_id) ?? mesmos[0];
}
/** nomes únicos, em ordem alfabética */
export function nomesProcedimentos(procs: { nome: string }[]): string[] {
  const vistos = new Map<string, string>();
  for (const p of procs) if (!vistos.has(p.nome.toLowerCase())) vistos.set(p.nome.toLowerCase(), p.nome);
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
