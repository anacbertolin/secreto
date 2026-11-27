// Correção automática enquanto digita (pedido da dona, 27/11/2026): o navegador só SUBLINHA a palavra errada;
// o celular troca sozinho. Aqui trocamos sozinho as palavras mais comuns escritas sem acento ou com erro de digitação,
// no momento em que a pessoa aperta espaço ou pontuação. Só entram palavras SEM ambiguidade
// (ex.: "nao" → "não"); palavras que existem dos dois jeitos ("esta/está", "e/é", "ate/até", "pais/país") ficam de fora.

const TROCAS: Record<string, string> = {
  // sem acento
  nao: "não", voce: "você", voces: "vocês", tambem: "também", entao: "então", amanha: "amanhã", ja: "já",
  so: "só", la: "lá", tem: "tem", horario: "horário", horarios: "horários", orcamento: "orçamento",
  orcamentos: "orçamentos", documentacao: "documentação", informacao: "informação", informacoes: "informações",
  orientacao: "orientação", orientacoes: "orientações", cirurgica: "cirúrgica", cirurgico: "cirúrgico",
  medico: "médico", medica: "médica", medicos: "médicos", obrigatorio: "obrigatório", proximo: "próximo",
  proxima: "próxima", ola: "olá", otimo: "ótimo", otima: "ótima", possivel: "possível", disponivel: "disponível",
  clinica: "clínica", endereco: "endereço", sabado: "sábado", sabados: "sábados", agendamento: "agendamento",
  revisao: "revisão", injecao: "injeção", lentes: "lentes", catarata: "catarata", cartao: "cartão", cartoes: "cartões",
  credito: "crédito", debito: "débito", dinheiro: "dinheiro", parcelamento: "parcelamento", unico: "único", unica: "única",
  numero: "número", numeros: "números", telefone: "telefone", ligacao: "ligação", duvidas: "dúvidas",
  relogio: "relógio", relogios: "relógios", oculos: "óculos", exames: "exames", sera: "será", estao: "estão",
  sao: "são", vao: "vão", pre: "pré", operatorio: "operatório", periodo: "período", rapido: "rápido",
  necessario: "necessário", necessaria: "necessária", conteudo: "conteúdo", familia: "família", agua: "água",
  acompanhante: "acompanhante", reuniao: "reunião", atencao: "atenção", confirmacao: "confirmação",
  // erros de digitação comuns
  cirugia: "cirurgia", cirurgias: "cirurgias", cirugias: "cirurgias", cirujia: "cirurgia", oftamologista: "oftalmologista",
  oftamologia: "oftalmologia", exame: "exame", examis: "exames", concerteza: "com certeza", derrepente: "de repente",
  vc: "você", vcs: "vocês", tb: "também", tbm: "também", pq: "porque", q: "que",
  td: "tudo", hj: "hoje", amanhan: "amanhã", aki: "aqui",
};

function comMaiuscula(original: string, troca: string): string {
  if (original === original.toUpperCase() && original.length > 1) return troca.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return troca.charAt(0).toUpperCase() + troca.slice(1);
  return troca;
}

/**
 * Recebe o texto novo da caixa. Se a última tecla foi espaço/pontuação/Enter, corrige a palavra anterior.
 * Devolve o texto (igual, se não houve troca).
 */
export function autocorrigir(texto: string): string {
  if (texto.startsWith("/")) return texto;                     // atalho de resposta rápida
  const m = texto.match(/(^|[\s(“"'])([A-Za-zÀ-ÿ]+)([\s.,!?;:)”"'])$/);
  if (!m) return texto;
  const palavra = m[2];
  const troca = TROCAS[palavra.toLowerCase()];
  if (!troca || troca === palavra.toLowerCase()) return texto;
  const ini = texto.length - palavra.length - m[3].length;
  return texto.slice(0, ini) + comMaiuscula(palavra, troca) + m[3];
}
