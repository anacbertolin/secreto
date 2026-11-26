// Monta o XML TISS de um lote do sistema a partir das contas, usando o cadastro TISS do convênio (convenios.tiss,
// copiado do Micrologos). Primeira versão (26/11/2026): Guia de Consulta e SP/SADT (consultas e exames).
// Honorários (cirurgia) ainda não: a cirurgia precisa do hospital e da equipe (ver docs/sistema/tiss-gerador.md).
import { supabase } from "./supabase";
import { ok } from "../components/ui";
import { gerarLote, zipar } from "./tiss";
import { montarLoteTISS, type ContaDb, type ProfDb, type TissConv } from "./tissMontar";

export interface ResultadoXML { nomeArquivo: string; bytes: Uint8Array; guias: number; avisos: string[] }

/** Gera o XML (e o .zip, se o convênio exigir) de um lote. Lança erro com a lista do que falta corrigir. */
export async function gerarXmlDoLote(loteId: string): Promise<ResultadoXML> {
  const lote = ok(await supabase.from("lotes").select("id, numero, competencia, convenio_id").eq("id", loteId).single()) as
    { id: string; numero: number; competencia: string; convenio_id: string };
  const conv = ok(await supabase.from("convenios").select("nome, registro_ans, codigo_prestador, versao_tiss, tiss").eq("id", lote.convenio_id).single()) as
    { nome: string; registro_ans: string | null; codigo_prestador: string | null; versao_tiss: string | null; tiss: TissConv | null };
  const contas = ok(await supabase.from("contas")
    .select("id, tipo_guia, numero_guia_prestador, numero_guia_operadora, senha_autorizacao, data_autorizacao, validade_senha, carteirinha, data_atendimento, profissional_id, solicitante_id, indicacao_clinica, observacoes, plano_id, agendamentos(primeira_vez, tipo), pacientes(nome), conta_itens(id, tabela, codigo, descricao, data_execucao, quantidade, valor_unitario, olho, profissional_id, procedimentos(tipo))")
    .eq("lote_id", loteId).neq("status", "cancelada").order("data_atendimento")) as unknown as ContaDb[];
  const profs = ok(await supabase.from("profissionais").select("id, nome, conselho, numero_conselho, uf_conselho, cbo")) as ProfDb[];
  const codigos = ok(await supabase.from("profissional_convenio_codigos").select("profissional_id, plano_id, codigo_executante, codigo_solicitante")
    .eq("convenio_id", lote.convenio_id)) as { profissional_id: string; plano_id: string | null; codigo_executante: string | null; codigo_solicitante: string | null }[];

  const m = montarLoteTISS({ lote, conv, contas, profs, codigos });
  if (m.erros.length) throw new Error([...new Set(m.erros)].join("\n"));
  const numeroLote = ok(await supabase.rpc("lote_numero_tiss", { p_lote: loteId })) as number;
  const arq = gerarLote({ config: m.config, numeroLote, competencia: m.competencia, dataHora: new Date(), guias: m.guias });
  if (m.exigeZip) {
    const z = await zipar(arq);
    return { nomeArquivo: z.nome, bytes: z.bytes, guias: m.guias.length, avisos: m.avisos };
  }
  return { nomeArquivo: arq.nomeArquivo, bytes: arq.bytes, guias: m.guias.length, avisos: m.avisos };
}
