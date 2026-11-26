// Gerador do XML TISS de envio de lote de guias (ENVIO_LOTE_GUIAS).
// Estrutura conferida com o XSD oficial da ANS (4.03.00) e com o mapeamento dos XML
// que o Micrologos gera hoje (docs/micrologos/mapeamento-telas, Parte 9 = D2).
import { No, t, e, tObrig, eObrig, dec2, data, hora, soDigitos, serializar, hashEpilogo, paraLatin1 } from "./xml";
import type {
  ArquivoTISS, ConfigTISS, Guia, GuiaConsulta, GuiaHonorarios, GuiaSPSADT, IdContratado,
  LoteTISS, MembroEquipe, OutraDespesa, Procedimento, Profissional,
} from "./tipos";

const NS = "http://www.ans.gov.br/padroes/tiss/schemas";
const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function valorTotalItem(p: Procedimento): number {
  return p.valorTotal ?? arred(p.quantidade * p.valorUnitario * p.reducaoAcrescimo);
}

// ---------------------------------------------------------------- partes comuns
function contratado(id: IdContratado): No[] {
  if ("codigoNaOperadora" in id) return [tObrig("codigoPrestadorNaOperadora", id.codigoNaOperadora)];
  if ("cnpj" in id) return [tObrig("cnpjContratado", soDigitos(id.cnpj))];
  return [tObrig("cpfContratado", soDigitos(id.cpf))];
}

function codProfissional(p: Profissional): No {
  if (p.codigoNaOperadora) return eObrig("codProfissional", t("codigoPrestadorNaOperadora", p.codigoNaOperadora));
  if (p.cpf) return eObrig("codProfissional", t("cpfContratado", soDigitos(p.cpf)));
  throw new Error(`Profissional ${p.nome}: falta o código na operadora ou o CPF`);
}

function procedimentoDados(p: Procedimento): No {
  return eObrig("procedimento",
    tObrig("codigoTabela", p.codigoTabela),
    tObrig("codigoProcedimento", p.codigo),
    tObrig("descricaoProcedimento", p.descricao.slice(0, 150)),
  );
}

function valoresItem(p: Procedimento): (No | null)[] {
  return [
    tObrig("quantidadeExecutada", p.quantidade),
    t("viaAcesso", p.viaAcesso),
    t("tecnicaUtilizada", p.tecnicaUtilizada),
    tObrig("reducaoAcrescimo", dec2(p.reducaoAcrescimo)),
    tObrig("valorUnitario", dec2(p.valorUnitario)),
    tObrig("valorTotal", dec2(valorTotalItem(p))),
  ];
}

function cabecalho(lote: LoteTISS): No {
  const c = lote.config;
  const dig = c.digitosSequencial ?? 12;
  const origem = "codigoNaOperadora" in c.origem
    ? t("codigoPrestadorNaOperadora", c.origem.codigoNaOperadora)
    : "cnpj" in c.origem ? t("CNPJ", soDigitos(c.origem.cnpj)) : t("CPF", soDigitos(c.origem.cpf));
  return eObrig("cabecalho",
    eObrig("identificacaoTransacao",
      t("tipoTransacao", "ENVIO_LOTE_GUIAS"),
      t("sequencialTransacao", String(lote.numeroLote).padStart(dig, "0")),
      t("dataRegistroTransacao", data(lote.dataHora)),
      t("horaRegistroTransacao", hora(lote.dataHora)),
    ),
    eObrig("origem", eObrig("identificacaoPrestador", origem)),
    eObrig("destino", tObrig("registroANS", c.registroANS)),
    t("Padrao", c.versao),
  );
}

// ---------------------------------------------------------------- Guia de Honorários (cirurgia)
function guiaHonorarios(g: GuiaHonorarios, c: ConfigTISS, registroANS: string): No {
  const omitir = !!c.omitirOpcionaisHonorarios && c.versao === "4.01.00";
  const local = "codigoNaOperadora" in g.localContratado.id
    ? t("codigoNaOperadora", g.localContratado.id.codigoNaOperadora)
    : t("cnpjLocalExecutante", soDigitos(g.localContratado.id.cnpj));
  let seq = 0;
  const itens = g.procedimentos.flatMap((p) =>
    // Um procedimentoRealizado por profissional (cirurgião 00, auxiliar 01…), como no Micrologos:
    // cada participação vem como um Procedimento próprio, com o seu valor e 1 profissional.
    p.equipe.map((m: MembroEquipe) => eObrig("procedimentoRealizado",
      tObrig("sequencialItem", ++seq),
      tObrig("dataExecucao", data(p.dataExecucao)),
      t("horaInicial", p.horaInicial),
      t("horaFinal", p.horaFinal),
      procedimentoDados(p),
      ...valoresItem(p),
      eObrig("profissionais",
        tObrig("grauParticipacao", m.grauParticipacao ?? "00"),
        codProfissional(m.profissional),
        tObrig("nomeProfissional", m.profissional.nome.slice(0, 70)),
        tObrig("conselhoProfissional", m.profissional.conselho),
        tObrig("numeroConselhoProfissional", m.profissional.numeroConselho),
        tObrig("UF", m.profissional.uf),
        tObrig("CBO", m.profissional.cbo),
      ),
    )));
  const total = arred(g.procedimentos.reduce((s, p) => s + valorTotalItem(p), 0));
  return eObrig("guiaHonorarios",
    eObrig("cabecalhoGuia", tObrig("registroANS", registroANS), tObrig("numeroGuiaPrestador", g.numeroGuiaPrestador)),
    tObrig("guiaSolicInternacao", g.guiaSolicInternacao),
    t("senha", g.senha),
    t("numeroGuiaOperadora", g.numeroGuiaOperadora),
    eObrig("beneficiario",
      tObrig("numeroCarteira", g.beneficiario.numeroCarteira),
      omitir ? t("atendimentoRN", g.beneficiario.atendimentoRN) : tObrig("atendimentoRN", g.beneficiario.atendimentoRN ?? "N"),
    ),
    eObrig("localContratado",
      eObrig("codigoContratado", local),
      tObrig("nomeContratado", g.localContratado.nome.slice(0, 70)),
      tObrig("cnes", g.localContratado.cnes),
    ),
    eObrig("dadosContratadoExecutante",
      tObrig("codigonaOperadora", g.executante.codigoNaOperadora),
      tObrig("cnesContratadoExecutante", g.executante.cnes),
    ),
    eObrig("dadosInternacao",
      tObrig("dataInicioFaturamento", data(g.dataInicioFaturamento)),
      tObrig("dataFimFaturamento", data(g.dataFimFaturamento)),
      omitir ? t("caraterAtendimento", g.caraterAtendimento) : tObrig("caraterAtendimento", g.caraterAtendimento ?? "1"),
    ),
    eObrig("procedimentosRealizados", itens),
    t("observacao", g.observacao?.slice(0, 500)),
    tObrig("valorTotalHonorarios", dec2(total)),
    tObrig("dataEmissaoGuia", data(g.dataEmissaoGuia)),
  );
}

// ---------------------------------------------------------------- Guia SP/SADT (exames, pacotes Unimed, consulta Amil)
function equipeSadt(m: MembroEquipe): No {
  return eObrig("equipeSadt",
    t("grauPart", m.grauParticipacao),
    codProfissional(m.profissional),
    tObrig("nomeProf", m.profissional.nome.slice(0, 70)),
    tObrig("conselho", m.profissional.conselho),
    tObrig("numeroConselhoProfissional", m.profissional.numeroConselho),
    tObrig("UF", m.profissional.uf),
    tObrig("CBOS", m.profissional.cbo),
  );
}

const valorDespesa = (d: OutraDespesa) => d.valorTotal ?? arred(d.quantidade * d.valorUnitario * d.reducaoAcrescimo);
// quantidade com até 4 casas (st_decimal9-4), sem zeros à toa: 1, 2.5, 0.25
const qtd4 = (q: number) => String(Math.round(q * 10000) / 10000);

function guiaSPSADT(g: GuiaSPSADT, registroANS: string): No {
  const total = arred(g.procedimentos.reduce((s, p) => s + valorTotalItem(p), 0));
  const despesa = (cod: string) => arred((g.outrasDespesas ?? []).filter((d) => d.codigoDespesa === cod).reduce((s, d) => s + valorDespesa(d), 0));
  return eObrig("guiaSP-SADT",
    eObrig("cabecalhoGuia",
      tObrig("registroANS", registroANS),
      tObrig("numeroGuiaPrestador", g.numeroGuiaPrestador),
      t("guiaPrincipal", g.guiaPrincipal),
    ),
    g.autorizacao && e("dadosAutorizacao",
      t("numeroGuiaOperadora", g.autorizacao.numeroGuiaOperadora),
      tObrig("dataAutorizacao", data(g.autorizacao.dataAutorizacao)),
      t("senha", g.autorizacao.senha),
      t("dataValidadeSenha", data(g.autorizacao.dataValidadeSenha)),
    ),
    eObrig("dadosBeneficiario",
      tObrig("numeroCarteira", g.beneficiario.numeroCarteira),
      tObrig("atendimentoRN", g.beneficiario.atendimentoRN ?? "N"),
    ),
    eObrig("dadosSolicitante",
      eObrig("contratadoSolicitante", contratado(g.solicitante.contratado)),
      tObrig("nomeContratadoSolicitante", g.solicitante.nomeContratado.slice(0, 70)),
      eObrig("profissionalSolicitante",
        t("nomeProfissional", g.solicitante.profissional.nome.slice(0, 70)),
        tObrig("conselhoProfissional", g.solicitante.profissional.conselho),
        tObrig("numeroConselhoProfissional", g.solicitante.profissional.numeroConselho),
        tObrig("UF", g.solicitante.profissional.uf),
        tObrig("CBOS", g.solicitante.profissional.cbo),
      ),
    ),
    eObrig("dadosSolicitacao",
      t("dataSolicitacao", data(g.dataSolicitacao)),
      tObrig("caraterAtendimento", g.caraterAtendimento),
      t("indicacaoClinica", g.indicacaoClinica?.slice(0, 500)),
    ),
    eObrig("dadosExecutante",
      eObrig("contratadoExecutante", contratado(g.executante.contratado)),
      tObrig("CNES", g.executante.cnes),
    ),
    eObrig("dadosAtendimento",
      tObrig("tipoAtendimento", g.tipoAtendimento),
      tObrig("indicacaoAcidente", g.indicacaoAcidente),
      t("tipoConsulta", g.tipoConsulta),
      tObrig("regimeAtendimento", g.regimeAtendimento),
    ),
    e("procedimentosExecutados", g.procedimentos.map((p, i) => eObrig("procedimentoExecutado",
      tObrig("sequencialItem", i + 1),
      tObrig("dataExecucao", data(p.dataExecucao)),
      t("horaInicial", p.horaInicial),
      t("horaFinal", p.horaFinal),
      procedimentoDados(p),
      ...valoresItem(p),
      p.equipe.map(equipeSadt),
    ))),
    e("outrasDespesas", (g.outrasDespesas ?? []).map((d, i) => eObrig("despesa",
      tObrig("sequencialItem", i + 1),
      tObrig("codigoDespesa", d.codigoDespesa),
      eObrig("servicosExecutados",
        tObrig("dataExecucao", data(d.dataExecucao)),
        tObrig("codigoTabela", d.codigoTabela),
        tObrig("codigoProcedimento", d.codigo),
        tObrig("quantidadeExecutada", qtd4(d.quantidade)),
        tObrig("unidadeMedida", d.unidadeMedida),
        tObrig("reducaoAcrescimo", dec2(d.reducaoAcrescimo)),
        tObrig("valorUnitario", dec2(d.valorUnitario)),
        tObrig("valorTotal", dec2(valorDespesa(d))),
        tObrig("descricaoProcedimento", d.descricao.slice(0, 150)),
        t("registroANVISA", d.registroAnvisa),
      ),
    ))),
    t("observacao", g.observacao?.slice(0, 500)),
    eObrig("valorTotal",
      t("valorProcedimentos", dec2(total)),
      despesa("03") ? t("valorMateriais", dec2(despesa("03"))) : null,
      despesa("02") ? t("valorMedicamentos", dec2(despesa("02"))) : null,
      despesa("08") ? t("valorOPME", dec2(despesa("08"))) : null,
      despesa("01") ? t("valorGasesMedicinais", dec2(despesa("01"))) : null,
      tObrig("valorTotalGeral", dec2(arred(total + (g.outrasDespesas ?? []).reduce((s, d) => s + valorDespesa(d), 0)))),
    ),
  );
}

// ---------------------------------------------------------------- Guia de Consulta
function guiaConsulta(g: GuiaConsulta, registroANS: string): No {
  const p = g.profissional;
  return eObrig("guiaConsulta",
    eObrig("cabecalhoConsulta", tObrig("registroANS", registroANS), tObrig("numeroGuiaPrestador", g.numeroGuiaPrestador)),
    t("numeroGuiaOperadora", g.numeroGuiaOperadora),
    eObrig("dadosBeneficiario",
      tObrig("numeroCarteira", g.beneficiario.numeroCarteira),
      tObrig("atendimentoRN", g.beneficiario.atendimentoRN ?? "N"),
    ),
    eObrig("contratadoExecutante", contratado(g.executante.contratado), tObrig("CNES", g.executante.cnes)),
    eObrig("profissionalExecutante",
      t("nomeProfissional", p.nome.slice(0, 70)),
      tObrig("conselhoProfissional", p.conselho),
      tObrig("numeroConselhoProfissional", p.numeroConselho),
      tObrig("UF", p.uf),
      tObrig("CBOS", p.cbo),
    ),
    tObrig("indicacaoAcidente", g.indicacaoAcidente),
    eObrig("dadosAtendimento",
      tObrig("regimeAtendimento", g.regimeAtendimento),
      tObrig("dataAtendimento", data(g.dataAtendimento)),
      tObrig("tipoConsulta", g.tipoConsulta),
      eObrig("procedimento",
        tObrig("codigoTabela", g.procedimento.codigoTabela),
        tObrig("codigoProcedimento", g.procedimento.codigo),
        tObrig("valorProcedimento", dec2(g.procedimento.valor)),
      ),
    ),
    t("observacao", g.observacao?.slice(0, 500)),
  );
}

// ---------------------------------------------------------------- validações do lote
export function validarLote(lote: LoteTISS): string[] {
  const erros: string[] = [];
  const c = lote.config;
  if (!lote.guias.length) erros.push("O lote não tem guias.");
  const tipos = new Set(lote.guias.map((g) => g.tipo));
  if (tipos.size > 1) erros.push("Um lote só pode ter um tipo de guia (consulta, SP/SADT ou honorários).");
  const max = Math.min(c.maxGuiasPorLote ?? 100, 100);
  if (lote.guias.length > max) erros.push(`O lote tem ${lote.guias.length} guias; o máximo é ${max}.`);
  if (!/^\d{6}$/.test(c.registroANS)) erros.push("Registro ANS da operadora deve ter 6 dígitos.");
  if (!/^\d{6}$/.test(lote.competencia)) erros.push("Competência deve estar no formato AAAAMM.");
  const vistos = new Set<string>();
  for (const g of lote.guias) {
    const id = `Guia ${g.numeroGuiaPrestador}`;
    if (vistos.has(g.numeroGuiaPrestador)) erros.push(`${id}: número repetido no lote.`);
    vistos.add(g.numeroGuiaPrestador);
    if (g.tipo !== "consulta") {
      if (c.maxProcedimentosPorGuia && g.procedimentos.length > c.maxProcedimentosPorGuia)
        erros.push(`${id}: ${g.procedimentos.length} procedimentos; o máximo deste convênio é ${c.maxProcedimentosPorGuia}.`);
      for (const p of g.procedimentos) {
        if (!p.equipe.length) erros.push(`${id}: procedimento ${p.codigo} sem profissional.`);
        if (g.tipo === "honorarios" && p.equipe.length > 1)
          erros.push(`${id}: nos honorários, cada participação (cirurgião, auxiliar) é um item separado com 1 profissional.`);
        if (!(p.reducaoAcrescimo > 0)) erros.push(`${id}: procedimento ${p.codigo} sem fator de redução/acréscimo.`);
      }
    }
    if (g.tipo === "sp-sadt" && g.autorizacao?.senha && g.autorizacao.dataValidadeSenha) {
      for (const p of g.procedimentos)
        if (p.dataExecucao > g.autorizacao.dataValidadeSenha)
          erros.push(`${id}: senha vencida em ${g.autorizacao.dataValidadeSenha}, antes da execução (${p.dataExecucao}).`);
    }
  }
  return erros;
}

// ---------------------------------------------------------------- lote completo
function corpoGuia(g: Guia, c: ConfigTISS): No {
  if (g.tipo === "honorarios") return guiaHonorarios(g, c, c.registroANS);
  if (g.tipo === "sp-sadt") return guiaSPSADT(g, c.registroANS);
  return guiaConsulta(g, c.registroANS);
}

export function gerarLote(lote: LoteTISS): ArquivoTISS {
  const erros = validarLote(lote);
  if (erros.length) throw new Error("Lote com problemas:\n- " + erros.join("\n- "));
  const c = lote.config;
  const cab = cabecalho(lote);
  const digLote = c.digitosNumeroLote ?? c.digitosSequencial ?? 12;
  const corpo = eObrig("prestadorParaOperadora",
    eObrig("loteGuias",
      tObrig("numeroLote", String(lote.numeroLote).padStart(digLote, "0")),
      eObrig("guiasTISS", lote.guias.map((g) => corpoGuia(g, c))),
    ),
  );
  const hash = hashEpilogo(cab, corpo);
  const raiz = eObrig("mensagemTISS", cab, corpo, eObrig("epilogo", tObrig("hash", hash)));
  const op = { prefixo: c.prefixo ?? "ans", indentar: c.indentar ?? false };
  const attrs = ` xmlns:${op.prefixo}="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` xsi:schemaLocation="${NS} tissV${c.versao.replace(/\./g, "_")}.xsd"`;
  const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n` + serializar(raiz, op, attrs);
  const dLote = c.digitosLoteArquivo ?? 4;
  const nomeArquivo = `${c.registroANS}${lote.competencia}${String(lote.numeroLote).padStart(dLote, "0").slice(-dLote)}_${hash}${c.extensao ?? ".XML"}`;
  return { xml, bytes: paraLatin1(xml), hash, nomeArquivo };
}

/** Compacta o XML num .zip com o mesmo nome (Bradesco, Mediservice e Klini exigem). */
export async function zipar(arq: ArquivoTISS): Promise<{ nome: string; bytes: Uint8Array }> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file(arq.nomeArquivo, arq.bytes);
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { nome: arq.nomeArquivo.replace(/\.xml$/i, ".zip"), bytes };
}
