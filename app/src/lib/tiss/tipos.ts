// Tipos do gerador de XML TISS (lote de guias: ENVIO_LOTE_GUIAS).
// Os nomes dos campos seguem o padrão TISS da ANS. Códigos de domínio vêm das tabelas
// de domínio TISS (ex.: conselho "06" = CRM, UF "33" = RJ, CBO "225265" = oftalmologista).

export type VersaoTISS = "4.01.00" | "4.02.00" | "4.03.00";

/** Como o prestador (ou contratado) é identificado: código na operadora, CNPJ ou CPF. */
export type IdContratado =
  | { codigoNaOperadora: string }
  | { cnpj: string }
  | { cpf: string };

export interface Profissional {
  nome: string;
  conselho: string; // dm_conselhoProfissional, ex. "06" (CRM)
  numeroConselho: string;
  uf: string; // dm_UF (código IBGE), ex. "33" (RJ)
  cbo: string; // ex. "225265"
  /** Identificação do profissional na equipe/honorários: código na operadora ou CPF. */
  codigoNaOperadora?: string;
  cpf?: string;
}

export interface MembroEquipe {
  /** dm_grauPart: "00" cirurgião, "01" 1º auxiliar, "12" clínico/executante… */
  grauParticipacao?: string;
  profissional: Profissional;
}

export interface Procedimento {
  dataExecucao: string; // AAAA-MM-DD
  horaInicial?: string;
  horaFinal?: string;
  codigoTabela: string; // "22" TUSS, "98" pacotes, "00" própria…
  codigo: string;
  descricao: string;
  quantidade: number;
  viaAcesso?: string; // "1" única
  tecnicaUtilizada?: string; // "1" convencional
  /** Fator de redução/acréscimo (ex.: 1.00; 2.00 em ambos os olhos em alguns contratos). */
  reducaoAcrescimo: number;
  valorUnitario: number;
  /** Se vazio: quantidade × valorUnitário × fator, arredondado em 2 casas. ⚠️ conferir com XML reais. */
  valorTotal?: number;
  equipe: MembroEquipe[];
}

export interface Beneficiario {
  numeroCarteira: string;
  atendimentoRN?: "S" | "N";
}

export interface GuiaHonorarios {
  tipo: "honorarios";
  numeroGuiaPrestador: string;
  guiaSolicInternacao: string;
  senha?: string;
  numeroGuiaOperadora?: string;
  beneficiario: Beneficiario;
  /** Hospital/centro cirúrgico onde a cirurgia foi feita. */
  localContratado: { id: { codigoNaOperadora: string } | { cnpj: string }; nome: string; cnes: string };
  /** A clínica que cobra o honorário. */
  executante: { codigoNaOperadora: string; cnes: string };
  dataInicioFaturamento: string;
  dataFimFaturamento: string;
  caraterAtendimento?: "1" | "2"; // 1 eletivo, 2 urgência
  procedimentos: Procedimento[];
  observacao?: string;
  dataEmissaoGuia: string;
}

export interface GuiaSPSADT {
  tipo: "sp-sadt";
  numeroGuiaPrestador: string;
  guiaPrincipal?: string;
  autorizacao?: {
    numeroGuiaOperadora?: string;
    dataAutorizacao: string;
    senha?: string;
    dataValidadeSenha?: string;
  };
  beneficiario: Beneficiario;
  solicitante: { contratado: IdContratado; nomeContratado: string; profissional: Profissional };
  dataSolicitacao?: string;
  caraterAtendimento: "1" | "2";
  indicacaoClinica?: string;
  executante: { contratado: IdContratado; cnes: string };
  tipoAtendimento: string; // dm_tipoAtendimento: "03", "04" consulta, "23" exames…
  indicacaoAcidente: string; // "9" não acidente
  tipoConsulta?: string;
  regimeAtendimento: string; // "01" ambulatorial
  procedimentos: Procedimento[];
  observacao?: string;
}

export interface GuiaConsulta {
  tipo: "consulta";
  numeroGuiaPrestador: string;
  numeroGuiaOperadora?: string;
  beneficiario: Beneficiario;
  executante: { contratado: IdContratado; cnes: string };
  profissional: Profissional;
  indicacaoAcidente: string;
  regimeAtendimento: string;
  dataAtendimento: string;
  tipoConsulta: string; // 1 primeira, 2 seguimento…
  procedimento: { codigoTabela: string; codigo: string; valor: number };
  observacao?: string;
}

export type Guia = GuiaHonorarios | GuiaSPSADT | GuiaConsulta;

/** Configuração TISS de um convênio/prestador (o que muda de operadora para operadora). */
export interface ConfigTISS {
  versao: VersaoTISS;
  registroANS: string; // da operadora (destino)
  /** Identificação da clínica (origem) nesta operadora. */
  origem: IdContratado;
  /** Dígitos do sequencialTransacao (padrão 12). */
  digitosSequencial?: number;
  /** Dígitos do numeroLote dentro de loteGuias (padrão: igual ao sequencial). ⚠️ conferir. */
  digitosNumeroLote?: number;
  /** Dígitos do lote no nome do arquivo (padrão 4). */
  digitosLoteArquivo?: number;
  maxGuiasPorLote?: number; // padrão 100 (limite do XSD)
  maxProcedimentosPorGuia?: number;
  /** Na 4.01.00, alguns convênios não recebem atendimentoRN/caraterAtendimento nos honorários. */
  omitirOpcionaisHonorarios?: boolean;
  /** Extensão do arquivo: o Micrologos grava ".XML". */
  extensao?: ".XML" | ".xml";
  prefixo?: string; // padrão "ans"
  indentar?: boolean; // padrão false
}

export interface LoteTISS {
  config: ConfigTISS;
  numeroLote: number;
  /** Competência AAAAMM usada no nome do arquivo. */
  competencia: string;
  dataHora: Date;
  guias: Guia[];
}

export interface ArquivoTISS {
  xml: string;
  bytes: Uint8Array; // ISO-8859-1
  hash: string;
  nomeArquivo: string;
}
