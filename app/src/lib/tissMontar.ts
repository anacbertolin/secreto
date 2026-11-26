// Parte pura do XML TISS de um lote (sem banco): contas do sistema -> guias TISS, seguindo o cadastro TISS do convênio.
// Separada de tissLote.ts para poder ser testada fora do navegador (app/scripts/tiss/testar_lote.ts).
import { validarLote, type ConfigTISS, type Guia, type IdContratado, type Procedimento, type Profissional, type VersaoTISS } from "./tiss";

export interface TissConv {
  versao?: string; exige_zip?: boolean; crm_completo?: boolean; mostra_fator?: boolean; consulta_em_sadt?: boolean;
  digitos_lote?: number | null; digitos_lote_arquivo?: number | null; max_guias_lote?: number | null; max_procedimentos_guia?: number | null;
  data_autorizacao_vazia_usa_data_conta?: boolean; guia_operadora_igual_prestador?: boolean;
  honorarios_se_cirurgia?: boolean; honorarios_somente_cirurgicos?: boolean; omitir_opcionais_honorarios?: boolean;
  uma_guia_toda_equipe?: boolean; nao_preenche_guia_principal?: boolean;
  /** Micrologos (Bradesco): itens da SP/SADT do maior para o menor valor total */
  ordenar_itens_por_valor?: boolean;
  /** configuração crua do Micrologos (CONVENIOS_MESTRE/INFO) */
  micrologos?: Record<string, unknown> & { info?: Record<string, unknown> };
  prestador?: { identificacao?: string; codigo_operadora?: string; cnpj?: string; nome?: string; cnes?: string };
}
export interface ProfDb { id: string; nome: string; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null; cbo: string | null }
export interface ItemDb {
  id: string; tabela: string; codigo: string | null; descricao: string; data_execucao: string; quantidade: number;
  valor_unitario: number | null; olho: string | null; profissional_id: string | null; procedimentos: { tipo: string } | null;
  grau_participacao?: string | null; fator?: number | null; numero_guia?: string | null; numero_guia_operadora?: string | null;
  /** v1/v2: valor unitário do 1º e do 2º (olho) no Micrologos */
  legado?: { v1?: number | null; v2?: number | null; id_cobranca?: string; hora_ini?: string; hora_fim?: string } | null;
}
export interface ContaDb {
  id: string; tipo_guia: string; numero_guia_prestador: string; numero_guia_operadora: string | null; senha_autorizacao: string | null;
  data_autorizacao: string | null; validade_senha: string | null; carteirinha: string | null; data_atendimento: string;
  profissional_id: string | null; solicitante_id: string | null; indicacao_clinica: string | null; observacoes: string | null; plano_id: string | null;
  hospital_id?: string | null; guia_solicitacao?: string | null;
  legado?: { id_conta?: string; tipo_consulta?: string; guia_micrologos?: string; tipo_atendimento?: string; data_solicitacao?: string } | null;
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
  executa_como_id?: string | null; solicita_como_id?: string | null; grau_participacao?: string | null;
}
export interface HospitalDb { id: string; nome: string; cnpj: string | null; cnes: string | null; codigo_operadora?: string | null; cnes_convenio?: string | null }
export interface DadosLote {
  lote: { numero: number; competencia: string; legado?: { id_cobranca?: string } | null };
  conv: { nome: string; registro_ans: string | null; codigo_prestador: string | null; versao_tiss: string | null; tiss: TissConv | null };
  contas: ContaDb[]; profs: ProfDb[];
  codigos: CodigoDb[];
  hospitais?: HospitalDb[];
  /** códigos dos médicos em TODOS os convênios (Unimed por médico: código de cooperado do solicitante) */
  codigosTodos?: CodigoDb[];
  /** profissional_dados_tiss: nome como sai na guia e CPF */
  dadosTiss?: { profissional_id: string; nome_guia: string | null; cpf: string | null }[];
}

/** Parte pura (sem banco): transforma contas em guias TISS seguindo o cadastro do convênio. */
export function montarLoteTISS({ conv, contas, profs, codigos, lote, hospitais = [], dadosTiss = [], codigosTodos = [] }: DadosLote) {
  const tiss = conv.tiss ?? {};
  const erros: string[] = [];
  const avisos: string[] = [];
  const versao = (tiss.versao ?? conv.versao_tiss ?? "4.03.00") as VersaoTISS;
  const codClinica = tiss.prestador?.codigo_operadora ?? conv.codigo_prestador ?? "";
  const cnes = tiss.prestador?.cnes ?? "3176479";
  // Hapvida: identificação da clínica pelo CNPJ ("cnpj_cpf" no cadastro; XML reais de 26/11)
  const origem: IdContratado = ["cnpj", "cnpj_cpf"].includes(tiss.prestador?.identificacao ?? "")
    ? { cnpj: tiss.prestador?.cnpj ?? "05894660000187" } : { codigoNaOperadora: codClinica };
  const mic = (k: string) => String((tiss.micrologos?.[k] ?? tiss.micrologos?.info?.[k]) ?? "");
  // Geap: item com quantidade 2 vira 2 linhas (via de acesso 1 e 3), cada uma com o seu valor
  const desmembra = mic("tiss_se_desmembra_via_diversas") === "1";
  // Unimed: guia principal em branco e pacote (tabela 98) sem via de acesso/técnica
  const semGuiaPrincipal = !!tiss.nao_preenche_guia_principal || mic("tiss_guiasadt_solic_embranco") === "1";
  const pacoteSadt = mic("tiss_usa_pacote_sadt") === "1";
  // contratado solicitante: o "nome do prestador" do convênio (Mediservice: "... Ltda Me"); se não for a razão social
  // (Unimed: "Consumed Olhos"), vai a razão social
  const nomePrest = texto(mic("nome_prestador")).toUpperCase();
  // (Unimed Gisele/Max: o prestador é o próprio médico, ex.: "GISELE MOURA BRASIL")
  // (Klini: "CONSUMED CLINICA DE OLHOS"; só o "Consumed Olhos" da Unimed Cirurgia vira a razão social)
  const razaoSocial = nomePrest && nomePrest !== "CONSUMED OLHOS" ? nomePrest : "CONSUMED CONSULTORIOS MEDICOS LTDA";
  // Unimed por médico (Unimed Gisele, Max…): o prestador é o próprio médico, e o contratado solicitante é o médico
  // solicitante, com o código de cooperado dele (XML reais de 26/11)
  const prestadorPessoa = !razaoSocial.includes("CONSUMED");
  const codCooperado = (profId: string | null | undefined) =>
    [...codigos, ...codigosTodos].find((x) => x.profissional_id === profId && (x.codigo_solicitante || x.codigo_executante));
  // hospital identificado pelo CNPJ quando o convênio identifica por CNPJ (Mediservice); senão pelo código (Unimed)
  const hospCnpj = mic("tiss_cpfcnpj_codoper") === "C";
  const semVia = mic("tiss_sem_via_acesso") === "1";            // Unimed Gelson, Fundação Itaú
  const cidNaObs = mic("tiss_cid_na_obs") === "1";              // Porto, Fundação Itaú: observação da conta + "Conta nº"
  const comHorario = mic("tiss_xmlcom_horario_produto") === "1";
  const hora = (h?: string) => (h && /^\d{1,2}:\d{2}/.test(h) ? (h.length === 5 ? `${h}:00` : h.slice(0, 8)) : undefined);
  // itens que foram enviados em OUTRA cobrança (Unimed por médico) não entram neste XML
  const cobLote = lote.legado?.id_cobranca;
  const daCobranca = (i: ItemDb) => !cobLote || !i.legado?.id_cobranca || i.legado.id_cobranca === cobLote;
  if (!conv.registro_ans) erros.push(`Convênio ${conv.nome}: falta o registro ANS (Cadastros → Convênios).`);
  if ("codigoNaOperadora" in origem && !codClinica) erros.push(`Convênio ${conv.nome}: falta o código da clínica na operadora.`);

  const regra = (profId: string | null | undefined, planoId: string | null, hospId?: string | null) => {
    const ds = codigos.filter((c) => c.profissional_id === profId);
    return ds.find((c) => c.plano_id === planoId && hospId && c.hospital_id === hospId) ?? ds.find((c) => !c.plano_id && hospId && c.hospital_id === hospId)
      ?? ds.find((c) => c.plano_id === planoId && !c.hospital_id) ?? ds.find((c) => !c.plano_id && !c.hospital_id)
      // Unimed: o código do cooperado está cadastrado só para a unidade (hospital) da clínica
      ?? ds.find((c) => !c.plano_id || c.plano_id === planoId);
  };
  const profissional = (id: string | null, planoId: string | null, papel: string, guia: string, hospId?: string | null): Profissional | null => {
    // Micrologos: o médico pode sair na guia "como" outro (ex.: sem credenciamento no convênio)
    const r0 = regra(id, planoId, hospId);
    const troca = papel === "solicitante" ? r0?.solicita_como_id : r0?.executa_como_id;
    if (troca) id = troca;
    const p = profs.find((x) => x.id === id);
    if (!p) { erros.push(`Guia ${guia}: falta o ${papel}.`); return null; }
    let numero = dig(p.numero_conselho);
    // todos os XML reais (Bradesco, Amil, Geap, Hapvida) levam o CRM completo, com o 52 do RJ na frente
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

  // Micrologos escreve na observação "Conta <nº>"; com tiss_cid_na_obs vai antes a observação da conta (ex.: "Glaucoma")
  const obsConta = (c: ContaDb) => {
    if (!c.legado?.id_conta) return c.observacoes ?? undefined;
    // (o Micrologos tira as vírgulas da observação)
    return [cidNaObs ? texto((c.observacoes ?? "").replace(/,/g, " ")) : "", `Conta ${c.legado.id_conta}`].filter(Boolean).join(" ");
  };
  const operadora = (c: ContaDb) => c.numero_guia_operadora ?? (tiss.guia_operadora_igual_prestador ? c.numero_guia_prestador : undefined);
  const guias: Guia[] = [];
  for (const c of contas) {
    // conta do Micrologos cujo nº de guia se repetia: no XML vai o nº original (o sistema guardou "ML<conta>")
    let n = c.legado?.guia_micrologos ?? c.numero_guia_prestador;
    const todos = c.conta_itens ?? [];
    const itens = todos.filter(daCobranca);
    if (todos.length && !itens.length) continue;  // conta só com itens de outra cobrança
    // Unimed por médico: na cobrança do auxiliar vai só a participação dele, com o nº de guia próprio dela
    const guiaItem = itens.every((i) => i.numero_guia) && new Set(itens.map((i) => i.numero_guia)).size === 1 && c.tipo_guia !== "honorarios"
      ? itens[0] : null;
    if (!c.carteirinha) erros.push(`Guia ${n} (${c.pacientes?.nome ?? ""}): falta a carteirinha.`);
    if (!itens.length) { erros.push(`Guia ${n}: sem itens.`); continue; }
    const temCirurgia = itens.some((i) => i.procedimentos?.tipo === "cirurgia");
    if (c.tipo_guia === "honorarios" || (temCirurgia && tiss.honorarios_se_cirurgia)) {
      // ---------- Guia de Honorários (cirurgia): 1 item por participação (cirurgião 00, auxiliar 01…)
      const hosp = hospitais.find((h) => h.id === c.hospital_id);
      if (!hosp) erros.push(`Guia ${n}: falta o hospital/centro cirúrgico (Dados da guia).`);
      const codOp = hosp?.codigo_operadora ?? undefined;
      // Mediservice/Hapvida usam o CNPJ do hospital como código: vai em cnpjLocalExecutante
      const hospPorCnpj = !!codOp && hospCnpj && /^\d{14}$/.test(codOp);
      const codHosp = hospPorCnpj ? undefined : codOp;
      if (hosp && !codOp && !hosp.cnpj) erros.push(`Guia ${n}: o hospital ${hosp.nome} não tem código neste convênio nem CNPJ.`);
      const cnesHosp = hosp?.cnes_convenio ?? hosp?.cnes ?? "";
      if (hosp && !cnesHosp) erros.push(`Guia ${n}: falta o CNES do hospital ${hosp.nome}.`);
      const guiaSolic = c.guia_solicitacao ?? c.numero_guia_operadora;
      if (!guiaSolic) erros.push(`Guia ${n}: falta o nº da guia de solicitação/internação.`);
      const usar = tiss.honorarios_somente_cirurgicos ? itens.filter((i) => i.procedimentos?.tipo === "cirurgia" || i.grau_participacao) : itens;
      if (usar.length < itens.length) avisos.push(`Guia ${n}: ${itens.length - usar.length} item(ns) que não são cirurgia ficaram fora da guia de honorários.`);
      const obsH = obsConta(c);
      const itemH = (i: ItemDb): Procedimento => {
        const prof = profissional(i.profissional_id ?? c.profissional_id, c.plano_id, "cirurgião", n, c.hospital_id);
        if (!i.codigo) erros.push(`Guia ${n}: item "${i.descricao}" sem código.`);
        if (i.valor_unitario === null) erros.push(`Guia ${n}: item "${i.descricao}" sem preço.`);
        const q = Number(i.quantidade), u = Number(i.valor_unitario ?? 0);
        const visita = i.procedimentos?.tipo === "consulta" || (i.codigo ?? "").startsWith("101");
        return {
          dataExecucao: i.data_execucao, codigoTabela: i.tabela, codigo: i.codigo ?? "", descricao: texto(i.descricao),
          horaInicial: comHorario || visita ? hora(i.legado?.hora_ini) : undefined,
          horaFinal: comHorario || visita ? hora(i.legado?.hora_fim) : undefined,
          // cirurgia dos 2 olhos (qtd 2): via 3 (vias diferentes) e fator 2,00; com 1 olho o fator é valor ÷ tabela
          // (Micrologos: 2.382,54 = 1.191,27 × 2,00, unitário já com o fator)
          quantidade: q, viaAcesso: semVia || visita ? undefined : q > 1 ? "3" : "1", tecnicaUtilizada: "1",
          reducaoAcrescimo: q > 1 ? q : Number(i.fator ?? 1), valorUnitario: u, valorTotal: arred(q * u),
          // nos honorários o Micrologos escreve o nome do médico em maiúsculas
          equipe: prof ? [{ grauParticipacao: i.grau_participacao ?? "00", profissional: { ...prof, nome: prof.nome.toUpperCase() } }] : [],
        };
      };
      const base = {
        tipo: "honorarios" as const, guiaSolicInternacao: guiaSolic ?? "",
        senha: c.senha_autorizacao ?? undefined, numeroGuiaOperadora: operadora(c) ?? undefined,
        beneficiario: { numeroCarteira: c.carteirinha ?? "", atendimentoRN: "N" as const },
        localContratado: { id: codHosp ? { codigoNaOperadora: codHosp } : { cnpj: hospPorCnpj ? codOp! : hosp?.cnpj ?? "" }, nome: texto(hosp?.nome).toUpperCase(), cnes: cnesHosp },
        executante: { codigoNaOperadora: codClinica, cnes },
        // na 4.01.00 (Amil) o Micrologos não escreve o caráter do atendimento nos honorários
        dataInicioFaturamento: c.data_atendimento, dataFimFaturamento: c.data_atendimento,
        caraterAtendimento: versao === "4.01.00" ? undefined : ("1" as const),
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
    if (guiaItem) n = guiaItem.numero_guia!;
    const exec = profissional(c.profissional_id ?? itens[0].profissional_id, c.plano_id, "médico executante", n);
    if (!exec) continue;
    const tipoConsulta = c.legado?.tipo_consulta ?? (c.agendamentos?.tipo === "retorno" || c.agendamentos?.primeira_vez === false ? "2" : "1");
    const obs = obsConta(c);
    const operadoraC = guiaItem ? guiaItem.numero_guia_operadora ?? undefined : operadora(c);

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
    // exames: tipoAtendimento 23 e grau 12; procedimento (ex.: fotocoagulação): 03 e grau 00 (XML reais do Bradesco).
    // Conta do Micrologos: vale o tipo de atendimento gravado nela (Unimed: 02 pequena cirurgia, 03…)
    const soExames = itens.every((i) => i.procedimentos?.tipo === "exame");
    // (Klini: consulta na SP/SADT com tipo 23 gravado na conta)
    const tipoAtend = c.legado?.tipo_atendimento ?? (consultaNaSadt ? "04" : soExames ? "23" : "03");
    const ehExame = tipoAtend === "23" || tipoAtend === "04";
    const procs: Procedimento[] = itens.flatMap((i): Procedimento[] => {
      const idProf = i.profissional_id ?? c.profissional_id;
      const prof = profissional(idProf, c.plano_id, "médico executante", n) ?? exec;
      const q = Number(i.quantidade), u = Number(i.valor_unitario ?? 0);
      if (!i.codigo) erros.push(`Guia ${n}: item "${i.descricao}" sem código.`);
      if (i.valor_unitario === null) erros.push(`Guia ${n}: item "${i.descricao}" sem preço.`);
      // grau do médico no convênio (Geap = 11); senão 12 em exame/consulta e 00 em procedimento
      // procedimento/cirurgia = 00; exame/consulta = grau do médico no convênio (Geap = 11) ou 12
      const grau = i.grau_participacao ?? (ehExame ? regra(idProf, c.plano_id)?.grau_participacao ?? "12" : "00");
      const v1 = Number(i.legado?.v1 ?? 0), v2 = Number(i.legado?.v2 ?? 0);
      const pacote = pacoteSadt && i.tabela === "98";
      const base = { dataExecucao: i.data_execucao, codigoTabela: i.tabela, codigo: i.codigo ?? "", descricao: texto(i.descricao),
        tecnicaUtilizada: pacote ? undefined : "1", equipe: [{ grauParticipacao: grau, profissional: prof }] };
      // Geap: só desmembra quando o 2º olho tem valor diferente (ex.: OCT 78,93 + 55,25); valores iguais ficam qtd 2
      if (desmembra && q === 2 && v1 > 0 && v2 > 0 && Math.abs(v1 - v2) > 0.005) {
        return [
          { ...base, quantidade: 1, viaAcesso: semVia ? undefined : "1", reducaoAcrescimo: 1, valorUnitario: v1, valorTotal: v1 },
          { ...base, quantidade: 1, viaAcesso: semVia ? undefined : "3", reducaoAcrescimo: 1, valorUnitario: v2, valorTotal: v2 },
        ];
      }
      // fator informado = valor dos olhos somados ÷ valor do 1º (2 olhos sem desconto = 2,00; Hapvida 2º a 70% = 1,70);
      // o total continua quantidade × unitário
      // Geap (que desmembra os olhos) informa sempre 1,00
      const fator = q > 1 && !desmembra ? (v1 > 0 && v2 > 0 ? arred((v1 + (q - 1) * v2) / v1) : q) : 1;
      return [{ ...base, quantidade: q, viaAcesso: pacote || semVia ? undefined : "1", reducaoAcrescimo: fator, valorUnitario: u, valorTotal: arred(q * u) }];
    });
    // ordem dos itens: Bradesco e Geap do maior para o menor valor unitário; nos outros o de maior valor (principal) vai primeiro
    // (no Micrologos isso acompanha a opção "SADT sem equipe na guia principal": Bradesco e Geap ordenam por valor)
    if (tiss.ordenar_itens_por_valor || mic("tiss_sadt_semequipe_guia_princ") === "1") procs.sort((x, y) => y.valorUnitario - x.valorUnitario);
    else if (procs.length > 1) {
      const iMax = procs.reduce((m, p, k) => ((p.valorTotal ?? 0) > (procs[m].valorTotal ?? 0) ? k : m), 0);
      procs.unshift(...procs.splice(iMax, 1));
    }
    const dataAut = c.data_autorizacao ?? (tiss.data_autorizacao_vazia_usa_data_conta ? c.data_atendimento : null);
    guias.push({
      tipo: "sp-sadt", numeroGuiaPrestador: n, guiaPrincipal: semGuiaPrincipal ? undefined : n,
      autorizacao: c.senha_autorizacao || operadoraC
        ? { numeroGuiaOperadora: operadoraC ?? undefined, dataAutorizacao: dataAut ?? c.data_atendimento, senha: c.senha_autorizacao ?? undefined, dataValidadeSenha: c.validade_senha ?? undefined }
        : undefined,
      beneficiario: { numeroCarteira: c.carteirinha ?? "", atendimentoRN: "N" },
      solicitante: prestadorPessoa
        ? (() => {
            const idSol = c.solicitante_id ?? c.profissional_id;
            const k = codCooperado(idSol);
            const cod = k?.codigo_solicitante || k?.codigo_executante;
            return { contratado: cod ? { codigoNaOperadora: cod } : origem, nomeContratado: solic.nome.toUpperCase(), profissional: solic };
          })()
        : { contratado: origem, nomeContratado: razaoSocial, profissional: solic },
      dataSolicitacao: c.legado?.data_solicitacao ?? dataAut ?? c.data_atendimento, caraterAtendimento: "1", indicacaoClinica: c.indicacao_clinica ?? undefined,
      executante: { contratado: origem, cnes },
      tipoAtendimento: tipoAtend, indicacaoAcidente: "9", tipoConsulta,
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
    extensao: ".XML", omitirOpcionaisHonorarios: !!tiss.omitir_opcionais_honorarios || versao === "4.01.00",
  };
  const competencia = lote.competencia.slice(0, 7).replace("-", "");
  if (!erros.length) erros.push(...validarLote({ config, numeroLote: 1, competencia, dataHora: new Date(), guias }));
  return { config, guias, competencia, erros, avisos, exigeZip: !!tiss.exige_zip };

}
