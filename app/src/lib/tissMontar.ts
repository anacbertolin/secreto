// Parte pura do XML TISS de um lote (sem banco): contas do sistema -> guias TISS, seguindo o cadastro TISS do convênio.
// Separada de tissLote.ts para poder ser testada fora do navegador (app/scripts/tiss/testar_lote.ts).
import { validarLote, type ConfigTISS, type Guia, type IdContratado, type Procedimento, type Profissional, type VersaoTISS } from "./tiss";

export interface TissConv {
  versao?: string; exige_zip?: boolean; crm_completo?: boolean; mostra_fator?: boolean; consulta_em_sadt?: boolean;
  digitos_lote?: number | null; digitos_lote_arquivo?: number | null; max_guias_lote?: number | null; max_procedimentos_guia?: number | null;
  data_autorizacao_vazia_usa_data_conta?: boolean; guia_operadora_igual_prestador?: boolean;
  honorarios_se_cirurgia?: boolean; honorarios_somente_cirurgicos?: boolean; omitir_opcionais_honorarios?: boolean;
  uma_guia_toda_equipe?: boolean; nao_preenche_guia_principal?: boolean;
  prestador?: { identificacao?: string; codigo_operadora?: string; cnpj?: string; nome?: string; cnes?: string };
}
export interface ProfDb { id: string; nome: string; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null; cbo: string | null }
export interface ItemDb {
  id: string; tabela: string; codigo: string | null; descricao: string; data_execucao: string; quantidade: number;
  valor_unitario: number | null; olho: string | null; profissional_id: string | null; procedimentos: { tipo: string } | null;
  grau_participacao?: string | null; fator?: number | null; numero_guia?: string | null; numero_guia_operadora?: string | null;
}
export interface ContaDb {
  id: string; tipo_guia: string; numero_guia_prestador: string; numero_guia_operadora: string | null; senha_autorizacao: string | null;
  data_autorizacao: string | null; validade_senha: string | null; carteirinha: string | null; data_atendimento: string;
  profissional_id: string | null; solicitante_id: string | null; indicacao_clinica: string | null; observacoes: string | null; plano_id: string | null;
  hospital_id?: string | null; guia_solicitacao?: string | null;
  legado?: { id_conta?: string; tipo_consulta?: string; guia_micrologos?: string } | null;
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
/** Como o Micrologos escreve os textos no XML: sem acento, sem barra e sem hífen (ex.: S/C vira S C, Fotocoagulação vira Fotocoagulacao). */
export const texto = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[/\\-]/g, " ").replace(/\s+/g, " ").trim();
const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;


export interface CodigoDb {
  profissional_id: string; plano_id: string | null; hospital_id?: string | null; codigo_executante: string | null; codigo_solicitante: string | null;
  executa_como_id?: string | null; solicita_como_id?: string | null;
}
export interface HospitalDb { id: string; nome: string; cnpj: string | null; cnes: string | null; codigo_operadora?: string | null; cnes_convenio?: string | null }
export interface DadosLote {
  lote: { numero: number; competencia: string };
  conv: { nome: string; registro_ans: string | null; codigo_prestador: string | null; versao_tiss: string | null; tiss: TissConv | null };
  contas: ContaDb[]; profs: ProfDb[];
  codigos: CodigoDb[];
  hospitais?: HospitalDb[];
  /** profissional_dados_tiss: nome como sai na guia e CPF */
  dadosTiss?: { profissional_id: string; nome_guia: string | null; cpf: string | null }[];
}

/** Parte pura (sem banco): transforma contas em guias TISS seguindo o cadastro do convênio. */
export function montarLoteTISS({ conv, contas, profs, codigos, lote, hospitais = [], dadosTiss = [] }: DadosLote) {
  const tiss = conv.tiss ?? {};
  const erros: string[] = [];
  const avisos: string[] = [];
  const versao = (tiss.versao ?? conv.versao_tiss ?? "4.03.00") as VersaoTISS;
  const codClinica = tiss.prestador?.codigo_operadora ?? conv.codigo_prestador ?? "";
  const cnes = tiss.prestador?.cnes ?? "3176479";
  const nomeClinica = texto(tiss.prestador?.nome ?? "Consumed Consultorios Medicos Ltda");
  const origem: IdContratado = tiss.prestador?.identificacao === "cnpj" ? { cnpj: tiss.prestador?.cnpj ?? "05894660000187" } : { codigoNaOperadora: codClinica };
  if (!conv.registro_ans) erros.push(`Convênio ${conv.nome}: falta o registro ANS (Cadastros → Convênios).`);
  if ("codigoNaOperadora" in origem && !codClinica) erros.push(`Convênio ${conv.nome}: falta o código da clínica na operadora.`);

  const regra = (profId: string | null | undefined, planoId: string | null, hospId?: string | null) => {
    const ds = codigos.filter((c) => c.profissional_id === profId);
    return ds.find((c) => c.plano_id === planoId && hospId && c.hospital_id === hospId) ?? ds.find((c) => !c.plano_id && hospId && c.hospital_id === hospId)
      ?? ds.find((c) => c.plano_id === planoId && !c.hospital_id) ?? ds.find((c) => !c.plano_id && !c.hospital_id);
  };
  const profissional = (id: string | null, planoId: string | null, papel: string, guia: string, hospId?: string | null): Profissional | null => {
    // Micrologos: o médico pode sair na guia "como" outro (ex.: sem credenciamento no convênio)
    const r0 = regra(id, planoId, hospId);
    const troca = papel === "solicitante" ? r0?.solicita_como_id : r0?.executa_como_id;
    if (troca) id = troca;
    const p = profs.find((x) => x.id === id);
    if (!p) { erros.push(`Guia ${guia}: falta o ${papel}.`); return null; }
    let numero = dig(p.numero_conselho);
    if (!tiss.crm_completo && numero.startsWith("52") && numero.length >= 8) numero = numero.slice(2); // sem o prefixo do RJ
    if (!numero) erros.push(`${p.nome}: falta o nº do conselho (Cadastros → Equipe).`);
    const cod = regra(p.id, planoId, hospId);
    const dt = dadosTiss.find((d) => d.profissional_id === p.id);
    const codProprio = (papel === "solicitante" ? cod?.codigo_solicitante : cod?.codigo_executante) || undefined;
    return {
      nome: texto(dt?.nome_guia || p.nome),
      conselho: CONSELHO[(p.conselho ?? "CRM").toUpperCase()] ?? "06",
      numeroConselho: numero,
      uf: UF_IBGE[(p.uf_conselho ?? "RJ").toUpperCase()] ?? "33",
      cbo: p.cbo || "225265",
      // sem código próprio do médico no convênio, o Micrologos identifica o médico pelo CPF (XML reais do Bradesco, 26/11)
      codigoNaOperadora: codProprio ?? (dt?.cpf ? undefined : codClinica || undefined),
      cpf: codProprio ? undefined : dt?.cpf ?? undefined,
    };
  };

  const operadora = (c: ContaDb) => c.numero_guia_operadora ?? (tiss.guia_operadora_igual_prestador ? c.numero_guia_prestador : undefined);
  const guias: Guia[] = [];
  for (const c of contas) {
    // conta do Micrologos cujo nº de guia se repetia: no XML vai o nº original (o sistema guardou "ML<conta>")
    const n = c.legado?.guia_micrologos ?? c.numero_guia_prestador;
    if (!c.carteirinha) erros.push(`Guia ${n} (${c.pacientes?.nome ?? ""}): falta a carteirinha.`);
    const itens = c.conta_itens ?? [];
    if (!itens.length) { erros.push(`Guia ${n}: sem itens.`); continue; }
    const temCirurgia = itens.some((i) => i.procedimentos?.tipo === "cirurgia");
    if (c.tipo_guia === "honorarios" || (temCirurgia && tiss.honorarios_se_cirurgia)) {
      // ---------- Guia de Honorários (cirurgia): 1 item por participação (cirurgião 00, auxiliar 01…)
      const hosp = hospitais.find((h) => h.id === c.hospital_id);
      if (!hosp) erros.push(`Guia ${n}: falta o hospital/centro cirúrgico (Dados da guia).`);
      const codHosp = hosp?.codigo_operadora ?? undefined;
      if (hosp && !codHosp && !hosp.cnpj) erros.push(`Guia ${n}: o hospital ${hosp.nome} não tem código neste convênio nem CNPJ.`);
      const cnesHosp = hosp?.cnes_convenio ?? hosp?.cnes ?? "";
      if (hosp && !cnesHosp) erros.push(`Guia ${n}: falta o CNES do hospital ${hosp.nome}.`);
      const guiaSolic = c.guia_solicitacao ?? c.numero_guia_operadora;
      if (!guiaSolic) erros.push(`Guia ${n}: falta o nº da guia de solicitação/internação.`);
      const usar = tiss.honorarios_somente_cirurgicos ? itens.filter((i) => i.procedimentos?.tipo === "cirurgia" || i.grau_participacao) : itens;
      if (usar.length < itens.length) avisos.push(`Guia ${n}: ${itens.length - usar.length} item(ns) que não são cirurgia ficaram fora da guia de honorários.`);
      const obsH = c.legado?.id_conta ? `Conta ${c.legado.id_conta}` : c.observacoes ?? undefined;
      const itemH = (i: ItemDb): Procedimento => {
        const prof = profissional(i.profissional_id ?? c.profissional_id, c.plano_id, "cirurgião", n, c.hospital_id);
        if (!i.codigo) erros.push(`Guia ${n}: item "${i.descricao}" sem código.`);
        if (i.valor_unitario === null) erros.push(`Guia ${n}: item "${i.descricao}" sem preço.`);
        const q = Number(i.quantidade), u = Number(i.valor_unitario ?? 0);
        return {
          dataExecucao: i.data_execucao, codigoTabela: i.tabela, codigo: i.codigo ?? "", descricao: texto(i.descricao),
          quantidade: q, viaAcesso: "1", tecnicaUtilizada: "1",
          // o valor unitário já vem com o fator (Micrologos: valor 2.382,54 = tabela 1.191,27 × 2,00)
          reducaoAcrescimo: Number(i.fator ?? 1), valorUnitario: u, valorTotal: arred(q * u),
          // nos honorários o Micrologos escreve o nome do médico em maiúsculas
          equipe: prof ? [{ grauParticipacao: i.grau_participacao ?? "00", profissional: { ...prof, nome: prof.nome.toUpperCase() } }] : [],
        };
      };
      const base = {
        tipo: "honorarios" as const, guiaSolicInternacao: guiaSolic ?? "",
        senha: c.senha_autorizacao ?? undefined, numeroGuiaOperadora: operadora(c) ?? undefined,
        beneficiario: { numeroCarteira: c.carteirinha ?? "", atendimentoRN: "N" as const },
        localContratado: { id: codHosp ? { codigoNaOperadora: codHosp } : { cnpj: hosp?.cnpj ?? "" }, nome: texto(hosp?.nome).toUpperCase(), cnes: cnesHosp },
        executante: { codigoNaOperadora: codClinica, cnes },
        dataInicioFaturamento: c.data_atendimento, dataFimFaturamento: c.data_atendimento, caraterAtendimento: "1" as const,
        observacao: obsH, dataEmissaoGuia: c.data_atendimento,
      };
      if (tiss.uma_guia_toda_equipe) {
        guias.push({ ...base, numeroGuiaPrestador: n, procedimentos: usar.map(itemH) });
      } else {
        // Micrologos: uma Guia de Honorários por participante; o auxiliar/instrumentador tem nº de guia próprio
        const principais = usar.filter((i) => !i.numero_guia);
        if (principais.length) guias.push({ ...base, numeroGuiaPrestador: n, procedimentos: principais.map(itemH) });
        for (const i of usar.filter((x) => x.numero_guia))
          guias.push({ ...base, numeroGuiaPrestador: i.numero_guia!, numeroGuiaOperadora: i.numero_guia_operadora ?? base.numeroGuiaOperadora, procedimentos: [itemH(i)] });
      }
      continue;
    }
    const exec = profissional(c.profissional_id ?? itens[0].profissional_id, c.plano_id, "médico executante", n);
    if (!exec) continue;
    const tipoConsulta = c.legado?.tipo_consulta ?? (c.agendamentos?.tipo === "retorno" || c.agendamentos?.primeira_vez === false ? "2" : "1");
    // Micrologos escreve na observação: Conta <nº da conta>
    const obs = c.legado?.id_conta ? `Conta ${c.legado.id_conta}` : c.observacoes ?? undefined;
    const operadoraC = operadora(c);

    if (c.tipo_guia === "consulta" && !tiss.consulta_em_sadt) {
      const i = itens[0];
      if (itens.length > 1) avisos.push(`Guia ${n}: consulta com ${itens.length} itens — só o primeiro vai na Guia de Consulta.`);
      guias.push({
        tipo: "consulta", numeroGuiaPrestador: n, numeroGuiaOperadora: operadoraC ?? undefined,
        beneficiario: { numeroCarteira: c.carteirinha ?? "", atendimentoRN: "N" },
        executante: { contratado: origem, cnes }, profissional: exec,
        indicacaoAcidente: "9", regimeAtendimento: "01", dataAtendimento: c.data_atendimento, tipoConsulta,
        procedimento: { codigoTabela: i.tabela, codigo: i.codigo ?? "", valor: arred(Number(i.quantidade) * Number(i.valor_unitario ?? 0)) },
        observacao: obs,
      });
      continue;
    }

    const consultaNaSadt = c.tipo_guia === "consulta" || itens.every((i) => i.procedimentos?.tipo === "consulta");
    const solic = profissional(c.solicitante_id ?? c.profissional_id, c.plano_id, "solicitante", n) ?? exec;
    // exames: tipoAtendimento 23 e grau 12; procedimento (ex.: fotocoagulação): 03 e grau 00 (XML reais do Bradesco)
    const soExames = itens.every((i) => i.procedimentos?.tipo === "exame");
    const procs: Procedimento[] = itens.map((i) => {
      const prof = profissional(i.profissional_id ?? c.profissional_id, c.plano_id, "médico executante", n) ?? exec;
      const q = Number(i.quantidade), u = Number(i.valor_unitario ?? 0);
      if (!i.codigo) erros.push(`Guia ${n}: item "${i.descricao}" sem código.`);
      if (i.valor_unitario === null) erros.push(`Guia ${n}: item "${i.descricao}" sem preço.`);
      return {
        dataExecucao: i.data_execucao, codigoTabela: i.tabela, codigo: i.codigo ?? "", descricao: texto(i.descricao),
        quantidade: q, viaAcesso: "1", tecnicaUtilizada: "1",
        // Micrologos com mostra_fator: o fator informado é a quantidade (2 olhos = 2,00); total = qtd × unitário
        reducaoAcrescimo: tiss.mostra_fator && q > 1 ? q : 1, valorUnitario: u, valorTotal: arred(q * u),
        equipe: [{ grauParticipacao: consultaNaSadt || soExames ? "12" : "00", profissional: prof }],
      };
    });
    // Micrologos: itens da SP/SADT do maior para o menor valor total
    procs.sort((x, y) => (y.valorTotal ?? 0) - (x.valorTotal ?? 0));
    const dataAut = c.data_autorizacao ?? (tiss.data_autorizacao_vazia_usa_data_conta ? c.data_atendimento : null);
    guias.push({
      tipo: "sp-sadt", numeroGuiaPrestador: n, guiaPrincipal: tiss.nao_preenche_guia_principal ? undefined : n,
      autorizacao: c.senha_autorizacao || operadoraC
        ? { numeroGuiaOperadora: operadoraC ?? undefined, dataAutorizacao: dataAut ?? c.data_atendimento, senha: c.senha_autorizacao ?? undefined, dataValidadeSenha: c.validade_senha ?? undefined }
        : undefined,
      beneficiario: { numeroCarteira: c.carteirinha ?? "", atendimentoRN: "N" },
      solicitante: { contratado: origem, nomeContratado: nomeClinica.toUpperCase(), profissional: solic },
      dataSolicitacao: dataAut ?? c.data_atendimento, caraterAtendimento: "1", indicacaoClinica: c.indicacao_clinica ?? undefined,
      executante: { contratado: origem, cnes },
      tipoAtendimento: consultaNaSadt ? "04" : soExames ? "23" : "03", indicacaoAcidente: "9", tipoConsulta,
      regimeAtendimento: "01", procedimentos: procs, observacao: obs,
    });
  }
  if (!guias.length && !erros.length) erros.push("O lote não tem guias.");
  const tipos = new Set(guias.map((g) => g.tipo));
  if (tipos.size > 1) erros.push("Esta cobrança mistura tipos de guia (consulta, SP/SADT, honorários). No XML vai um tipo só: faça uma cobrança para cada tipo.");

  const config: ConfigTISS = {
    versao, registroANS: dig(conv.registro_ans).padStart(6, "0"), origem,
    // Micrologos: sequencialTransacao com 12 dígitos, mas numeroLote sem zeros à esquerda (XML reais do Bradesco)
    digitosSequencial: tiss.digitos_lote ?? 12, digitosNumeroLote: 0, digitosLoteArquivo: tiss.digitos_lote_arquivo ?? 4,
    maxGuiasPorLote: tiss.max_guias_lote ?? undefined, maxProcedimentosPorGuia: tiss.max_procedimentos_guia ?? undefined,
    extensao: ".XML", omitirOpcionaisHonorarios: !!tiss.omitir_opcionais_honorarios,
  };
  const competencia = lote.competencia.slice(0, 7).replace("-", "");
  if (!erros.length) erros.push(...validarLote({ config, numeroLote: 1, competencia, dataHora: new Date(), guias }));
  return { config, guias, competencia, erros, avisos, exigeZip: !!tiss.exige_zip };

}
