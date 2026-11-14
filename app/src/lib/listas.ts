// Listas oficiais de apoio (CID-10 do DATASUS e medicamentos da ANVISA).
// Ficam em /dados/*.json, são carregadas só quando alguém busca e ficam em memória.
import { CID10 as CID_OFTALMO } from "./cid10";

export type ItemCID = [codigo: string, descricao: string];
export type ItemMed = [nome: string, principio: string, classe: string, oftalmico: 0 | 1];

const cache: { cid?: Promise<ItemCID[]>; med?: Promise<ItemMed[]> } = {};

function baixar<T>(arquivo: string): Promise<T[]> {
  return fetch(`/dados/${arquivo}`).then((r) => {
    if (!r.ok) throw new Error("Não foi possível carregar a lista " + arquivo);
    return r.json() as Promise<T[]>;
  });
}
export const carregarCID = () => (cache.cid ??= baixar<ItemCID>("cid10.json"));
export const carregarMedicamentos = () => (cache.med ??= baixar<ItemMed>("medicamentos.json"));

export const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Busca no CID-10 completo; códigos de oftalmologia mais usados aparecem primeiro */
export async function buscarCIDCompleto(termo: string, limite = 15): Promise<ItemCID[]> {
  const q = normalizar(termo.trim());
  if (q.length < 2) return [];
  const lista = await carregarCID();
  const qCod = q.replace(".", "").toUpperCase();
  const palavras = q.split(/\s+/).filter(Boolean);
  const favoritos = new Set(CID_OFTALMO.map(([c]) => c));
  const res: { item: ItemCID; nota: number }[] = [];
  for (const item of lista) {
    const cod = item[0].replace(".", "");
    let nota = -1;
    if (cod.startsWith(qCod)) nota = 100 - (cod.length - qCod.length);
    else {
      const d = normalizar(item[1]);
      if (palavras.every((p) => d.includes(p))) nota = 50 - Math.min(d.indexOf(palavras[0]), 40) / 10;
    }
    if (nota < 0) continue;
    if (favoritos.has(item[0])) nota += 30;
    else if (item[0].startsWith("H")) nota += 15;
    res.push({ item, nota });
  }
  return res.sort((a, b) => b.nota - a.nota || a.item[0].localeCompare(b.item[0])).slice(0, limite).map((r) => r.item);
}

/** Busca de medicamento por nome comercial ou princípio ativo; oftálmicos primeiro */
export async function buscarMedicamento(termo: string, limite = 15): Promise<ItemMed[]> {
  const q = normalizar(termo.trim());
  if (q.length < 3) return [];
  const lista = await carregarMedicamentos();
  const res: { item: ItemMed; nota: number }[] = [];
  for (const item of lista) {
    const n = normalizar(item[0]);
    const p = normalizar(item[1]);
    let nota = -1;
    const inicioPalavra = (t: string) => t.split(/[\s,+()-]+/).some((w) => w.startsWith(q));
    if (n.startsWith(q)) nota = 60;
    else if (p.startsWith(q)) nota = 55;
    else if (inicioPalavra(n) || inicioPalavra(p)) nota = 50;   // ex.: "maleato de TIMOLOL"
    else if (n.includes(q) || p.includes(q)) nota = 35;
    if (nota < 0) continue;
    if (item[3]) nota += 25;                                    // oftálmico
    if (!p.includes(",")) nota += 8;                            // um só princípio ativo
    res.push({ item, nota });
  }
  return res.sort((a, b) => b.nota - a.nota || a.item[0].localeCompare(b.item[0])).slice(0, limite).map((r) => r.item);
}

/**
 * Confere se um medicamento bate com alguma alergia registrada (por nome ou princípio ativo).
 * Retorna a alergia encontrada, ou null.
 */
export function alergiaConflitante(medicamento: string, principio: string, alergias: string[]): string | null {
  const alvo = normalizar(`${medicamento} ${principio}`);
  for (const a of alergias) {
    const termos = normalizar(a).split(/[\s,;/]+/).filter((t) => t.length >= 4);
    if (termos.some((t) => alvo.includes(t))) return a;
  }
  return null;
}
