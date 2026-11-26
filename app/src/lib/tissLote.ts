// Monta o XML TISS de um lote do sistema a partir das contas, usando o cadastro TISS do convênio (convenios.tiss,
// copiado do Micrologos): Guia de Consulta, SP/SADT e Honorários (cirurgia). Regras em docs/sistema/tiss-gerador.md.
import { supabase } from "./supabase";
import { ok } from "../components/ui";
import { gerarLote, zipar } from "./tiss";
import { montarLoteTISS, type CodigoDb, type ContaDb, type HospitalDb, type ProfDb, type TissConv } from "./tissMontar";

export interface ResultadoXML { nomeArquivo: string; bytes: Uint8Array; guias: number; avisos: string[] }

/** Gera o XML (e o .zip, se o convênio exigir) de um lote. Lança erro com a lista do que falta corrigir. */
export async function gerarXmlDoLote(loteId: string): Promise<ResultadoXML> {
  const lote = ok(await supabase.from("lotes").select("id, numero, competencia, convenio_id").eq("id", loteId).single()) as
    { id: string; numero: number; competencia: string; convenio_id: string };
  const conv = ok(await supabase.from("convenios").select("nome, registro_ans, codigo_prestador, versao_tiss, tiss").eq("id", lote.convenio_id).single()) as
    { nome: string; registro_ans: string | null; codigo_prestador: string | null; versao_tiss: string | null; tiss: TissConv | null };
  const contas = ok(await supabase.from("contas")
    .select("id, tipo_guia, numero_guia_prestador, numero_guia_operadora, senha_autorizacao, data_autorizacao, validade_senha, carteirinha, data_atendimento, profissional_id, solicitante_id, indicacao_clinica, observacoes, plano_id, hospital_id, guia_solicitacao, legado, agendamentos(primeira_vez, tipo), pacientes(nome), conta_itens(id, tabela, codigo, descricao, data_execucao, quantidade, valor_unitario, olho, profissional_id, grau_participacao, fator, numero_guia, numero_guia_operadora, legado, criado_em, procedimentos(tipo))")
    .eq("lote_id", loteId).neq("status", "cancelada").order("data_atendimento")
    .order("criado_em", { referencedTable: "conta_itens" })) as unknown as ContaDb[];
  const profs = ok(await supabase.from("profissionais").select("id, nome, conselho, numero_conselho, uf_conselho, cbo")) as ProfDb[];
  const codigos = ok(await supabase.from("profissional_convenio_codigos")
    .select("profissional_id, plano_id, hospital_id, codigo_executante, codigo_solicitante, executa_como_id, solicita_como_id, grau_participacao")
    .eq("convenio_id", lote.convenio_id)) as CodigoDb[];
  const hs = ok(await supabase.from("hospitais").select("id, nome, cnpj, cnes, hospital_convenio_codigos(convenio_id, codigo_operadora, cnes)")) as
    { id: string; nome: string; cnpj: string | null; cnes: string | null; hospital_convenio_codigos: { convenio_id: string; codigo_operadora: string | null; cnes: string | null }[] }[];
  const hospitais: HospitalDb[] = hs.map((h) => {
    const k = h.hospital_convenio_codigos.find((x) => x.convenio_id === lote.convenio_id);
    return { id: h.id, nome: h.nome, cnpj: h.cnpj, cnes: h.cnes, codigo_operadora: k?.codigo_operadora ?? null, cnes_convenio: k?.cnes ?? null };
  });

  // nome como sai na guia e CPF do médico (função só para faturamento/admin; o CPF fica nos dados pessoais)
  const dadosTiss = ok(await supabase.rpc("tiss_dados_medicos")) as
    { profissional_id: string; nome_guia: string | null; cpf: string | null }[];

  const m = montarLoteTISS({ lote, conv, contas, profs, codigos, hospitais, dadosTiss });
  if (m.erros.length) throw new Error([...new Set(m.erros)].join("\n"));
  const numeroLote = ok(await supabase.rpc("lote_numero_tiss", { p_lote: loteId })) as number;
  const arq = gerarLote({ config: m.config, numeroLote, competencia: m.competencia, dataHora: new Date(), guias: m.guias });
  if (m.exigeZip) {
    const z = await zipar(arq);
    return { nomeArquivo: z.nome, bytes: z.bytes, guias: m.guias.length, avisos: m.avisos };
  }
  return { nomeArquivo: arq.nomeArquivo, bytes: arq.bytes, guias: m.guias.length, avisos: m.avisos };
}
