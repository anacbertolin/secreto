// Parte pura do XML TISS de um lote (sem banco): contas do sistema -> guias TISS, seguindo o cadastro TISS do convênio.
// Separada de tissLote.ts para poder ser testada fora do navegador (app/scripts/tiss/testar_lote.ts).
import { validarLote, type ConfigTISS, type Guia, type IdContratado, type Procedimento, type Profissional, type VersaoTISS } from "./tiss";

export interface TissConv {
  versao?: string; exige_zip?: boolean; crm_completo?: boolean; mostra_fator?: boolean; consulta_em_sadt?: boolean;
  digitos_lote?: number | null; digitos_lote_arquivo?: number | null; max_guias_lote?: number | null; max_procedimentos_guia?: number | null;
  data_autorizacao_vazia_usa_data_conta?: boolean; guia_operadora_igual_prestador?: boolean;
  prestador?: { identificacao?: string; codigo_operadora?: string; cnpj?: string; nome?: string; cnes?: string };
}
export interface ProfDb { id: string; nome: string; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null; cbo: string | null }
export interface ItemDb {
  id: string; tabela: string; codigo: string | null; descricao: string; data_execucao: string; quantidade: number;
  valor_unitario: number | null; olho: string | null; profissional_id: string | null; procedimentos: { tipo: string } | null;
}
export interface ContaDb {
  id: string; tipo_guia: string; numero_guia_prestador: string; numero_guia_operadora: string | null; senha_autorizacao: string | null;
  data_autorizacao: string | null; validade_senha: string | null; carteirinha: string | null; data_atendimento: string;
  profissional_id: string | null; solicitante_id: string | null; indicacao_clinica: string | null; observacoes: string | null; plano_id: string | null;
  agendamentos: { primeira_vez: boolean | null; tipo: string | null } | null;
  pacientes: { nome: string } | null;
  conta_itens: ItemDb[];
}

const CONSELHO: Record<string, string> = { CRAS: "01", COREN: "02", CRF: "03", CRFA: "04", CREFITO: "05", CRM: "06", CRN: "07", CRO: "08", CRP: "09" };
const UF_IBGE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17", MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};
const dig = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");


export interface DadosLote {
  lote: { numero: number; competencia: string };
  conv: { nome: string; registro_ans: string | null; codigo_prestador: string | null; versao_tiss: string | null; tiss: TissConv | null };
  contas: ContaDb[]; profs: ProfDb[];
  codigos: { profissional_id: string; plano_id: string | null; codigo_executante: string | null; codigo_solicitante: string | null }[];
}

/** Parte pura (sem banco): transforma contas em guias TISS seguindo o cadastro do convênio. */
export function montarLoteTISS({ conv, contas, profs, codigos, lote }: DadosLote) {
  const tiss = conv.tiss ?? {};
  const erros: string[] = [];
  const avisos: string[] = [];
  const versao = (tiss.versao ?? conv.versao_tiss ?? "4.03.00") as VersaoTISS;
  const codClinica = tiss.prestador?.codigo_operadora ?? conv.codigo_prestador ?? "";
  const cnes = tiss.prestador?.cnes ?? "3176479";
  const nomeClinica = tiss.prestador?.nome ?? "Consumed Consultorios Medicos Ltda";
  const origem: IdContratado = tiss.prestador?.identificacao === "cnpj" ? { cnpj: tiss.prestador?.cnpj ?? "05894660000187" } : { codigoNaOperadora: codClinica };
  if (!conv.registro_ans) erros.push(`Convênio ${conv.nome}: falta o registro ANS (Cadastros → Convênios).`);
  if ("codigoNaOperadora" in origem && !codClinica) erros.push(`Convênio ${conv.nome}: falta o código da clínica na operadora.`);

  const profissional = (id: string | null, planoId: string | null, papel: string, guia: string): Profissional | null => {
    const p = profs.find((x) => x.id === id);
    if (!p) { erros.push(`Guia ${guia}: falta o ${papel}.`); return null; }
    let numero = dig(p.numero_conselho);
    if (!tiss.crm_completo && numero.startsWith("52") && numero.length >= 8) numero = numero.slice(2); // sem o prefixo do RJ
    if (!numero) erros.push(`${p.nome}: falta o nº do conselho (Cadastros → Equipe).`);
    const cod = codigos.find((c) => c.profissional_id === p.id && c.plano_id === planoId) ?? codigos.find((c) => c.profissional_id === p.id && !c.plano_id);
    return {
      nome: p.nome.toUpperCase(),
      conselho: CONSELHO[(p.conselho ?? "CRM").toUpperCase()] ?? "06",
      numeroConselho: numero,
      uf: UF_IBGE[(p.uf_conselho ?? "RJ").toUpperCase()] ?? "33",
      cbo: p.cbo || "225265",
      // sem código próprio do médico no convênio, o Micrologos usa o código da clínica (arquivo J)
      codigoNaOperadora: (papel === "solicitante" ? cod?.codigo_solicitante : cod?.codigo_executante) || codClinica || undefined,
    };
  };

  const guias: Guia[] = [];
  for (const c of contas) {
    const n = c.numero_guia_prestador;
    if (!c.carteirinha) erros.push(`Guia ${n} (${c.pacientes?.nome ?? ""}): falta a carteirinha.`);
    const itens = c.conta_itens ?? [];
    if (!itens.length) { erros.push(`Guia ${n}: sem itens.`); continue; }
    if (itens.some((i) => i.procedimentos?.tipo === "cirurgia")) {
      erros.push(`Guia ${n}: tem cirurgia — a guia de honorários ainda não está pronta no sistema novo.`);
      continue;
    }
    const exec = profissional(c.profissional_id ?? itens[0].profissional_id, c.plano_id, "médico executante", n);
    if (!exec) continue;
    const tipoConsulta = c.agendamentos?.tipo === "retorno" || c.agendamentos?.primeira_vez === false ? "2" : "1";
    const operadora = c.numero_guia_operadora ?? (tiss.guia_operadora_igual_prestador ? n : undefined);

    if (c.tipo_guia === "consulta" && !tiss.consulta_em_sadt) {
      const i = itens[0];
      if (itens.length > 1) avisos.push(`Guia ${n}: consulta com ${itens.length} itens — só o primeiro vai na Guia de Consulta.`);
      guias.push({
        tipo: "consulta", numeroGuiaPrestador: n, numeroGuiaOperadora: operadora ?? undefined,
        beneficiario: { numeroCarteira: c.carteirinha ?? "", atendimentoRN: "N" },
        executante: { contratado: origem, cnes }, profissional: exec,
        indicacaoAcidente: "9", regimeAtendimento: "01", dataAtendimento: c.data_atendimento, tipoConsulta,
        procedimento: { codigoTabela: i.tabela, codigo: i.codigo ?? "", valor: Number(i.quantidade) * Number(i.valor_unitario ?? 0) },
        observacao: c.observacoes ?? undefined,
      });
      continue;
    }

    const consultaNaSadt = c.tipo_guia === "consulta" || itens.every((i) => i.procedimentos?.tipo === "consulta");
    const solic = profissional(c.solicitante_id ?? c.profissional_id, c.plano_id, "solicitante", n) ?? exec;
    const procs: Procedimento[] = itens.map((i) => {
      const prof = profissional(i.profissional_id ?? c.profissional_id, c.plano_id, "médico executante", n) ?? exec;
      // "ambos os olhos" lançado como quantidade 2 → o Micrologos manda quantidade 1 com fator 2,00 (mesmo total)
      const doisOlhos = !!tiss.mostra_fator && Number(i.quantidade) === 2 && i.olho === "AO";
      if (!i.codigo) erros.push(`Guia ${n}: item "${i.descricao}" sem código.`);
      if (i.valor_unitario === null) erros.push(`Guia ${n}: item "${i.descricao}" sem preço.`);
      return {
        dataExecucao: i.data_execucao, codigoTabela: i.tabela, codigo: i.codigo ?? "", descricao: i.descricao,
        quantidade: doisOlhos ? 1 : Number(i.quantidade), viaAcesso: "1", tecnicaUtilizada: "1",
        reducaoAcrescimo: doisOlhos ? 2 : 1, valorUnitario: Number(i.valor_unitario ?? 0),
        equipe: [{ grauParticipacao: "12", profissional: prof }],
      };
    });
    const dataAut = c.data_autorizacao ?? (tiss.data_autorizacao_vazia_usa_data_conta ? c.data_atendimento : null);
    guias.push({
      tipo: "sp-sadt", numeroGuiaPrestador: n,
      autorizacao: c.senha_autorizacao || operadora
        ? { numeroGuiaOperadora: operadora ?? undefined, dataAutorizacao: dataAut ?? c.data_atendimento, senha: c.senha_autorizacao ?? undefined, dataValidadeSenha: c.validade_senha ?? undefined }
        : undefined,
      beneficiario: { numeroCarteira: c.carteirinha ?? "", atendimentoRN: "N" },
      solicitante: { contratado: origem, nomeContratado: nomeClinica.toUpperCase(), profissional: solic },
      dataSolicitacao: c.data_atendimento, caraterAtendimento: "1", indicacaoClinica: c.indicacao_clinica ?? undefined,
      executante: { contratado: origem, cnes },
      tipoAtendimento: consultaNaSadt ? "04" : "23", indicacaoAcidente: "9", tipoConsulta: consultaNaSadt ? tipoConsulta : undefined,
      regimeAtendimento: "01", procedimentos: procs, observacao: c.observacoes ?? undefined,
    });
  }
  if (!guias.length && !erros.length) erros.push("O lote não tem guias.");
  const tipos = new Set(guias.map((g) => g.tipo));
  if (tipos.size > 1) erros.push("Este lote mistura Guias de Consulta e SP/SADT. No XML vai um tipo só: faça um lote para as consultas e outro para os exames.");

  const config: ConfigTISS = {
    versao, registroANS: dig(conv.registro_ans).padStart(6, "0"), origem,
    digitosSequencial: tiss.digitos_lote ?? 12, digitosLoteArquivo: tiss.digitos_lote_arquivo ?? 4,
    maxGuiasPorLote: tiss.max_guias_lote ?? undefined, maxProcedimentosPorGuia: tiss.max_procedimentos_guia ?? undefined,
    extensao: ".XML",
  };
  const competencia = lote.competencia.slice(0, 7).replace("-", "");
  if (!erros.length) erros.push(...validarLote({ config, numeroLote: 1, competencia, dataHora: new Date(), guias }));
  return { config, guias, competencia, erros, avisos, exigeZip: !!tiss.exige_zip };

}
