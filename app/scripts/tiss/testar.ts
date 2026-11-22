// Teste do gerador TISS com dados 100% FICTÍCIOS.
// Uso: npx tsx scripts/tiss/testar.ts <pasta-de-saida>
// Gera um lote de cada tipo, grava os .XML (e um .zip) e confere o MD5.
// A validação contra o XSD oficial é feita pelo validar.sh (xmllint).
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { gerarLote, zipar, md5, validarLote } from "../../src/lib/tiss";
import type { LoteTISS, Profissional } from "../../src/lib/tiss";

const saida = process.argv[2] ?? "saida-tiss";
mkdirSync(saida, { recursive: true });

// MD5: vetores oficiais da RFC 1321
const enc = (s: string) => new TextEncoder().encode(s);
const vetores: [string, string][] = [
  ["", "d41d8cd98f00b204e9800998ecf8427e"],
  ["abc", "900150983cd24fb0d6963f7d28e17f72"],
  ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
  ["12345678901234567890123456789012345678901234567890123456789012345678901234567890", "57edf4a22be3c955ac49da2e2107b67a"],
];
for (const [txt, esperado] of vetores) {
  const r = md5(enc(txt));
  if (r !== esperado) throw new Error(`MD5 errado para "${txt}": ${r}`);
}
console.log("MD5: ok (vetores da RFC 1321)");

const medico: Profissional = { nome: "MEDICO FICTICIO DE TESTE", conselho: "06", numeroConselho: "999999", uf: "33", cbo: "225265", codigoNaOperadora: "000999" };
const auxiliar: Profissional = { nome: "AUXILIAR FICTICIO", conselho: "06", numeroConselho: "888888", uf: "33", cbo: "225265", codigoNaOperadora: "000888" };
const quando = new Date(2026, 10, 22, 10, 30, 0);

const lotes: Record<string, LoteTISS> = {
  // Cirurgia — Guia de Honorários (modelo Bradesco 4.03.00)
  honorarios_bradesco: {
    config: { versao: "4.03.00", registroANS: "005711", origem: { codigoNaOperadora: "0000110502" }, maxProcedimentosPorGuia: 10 },
    numeroLote: 301, competencia: "202611", dataHora: quando,
    guias: [{
      tipo: "honorarios", numeroGuiaPrestador: "900001", guiaSolicInternacao: "SOLIC0001", senha: "SENHA001", numeroGuiaOperadora: "OPER0001",
      beneficiario: { numeroCarteira: "00000000000000001", atendimentoRN: "N" },
      localContratado: { id: { codigoNaOperadora: "193216" }, nome: "HOSPITAL FICTICIO DE TESTE", cnes: "5325722" },
      executante: { codigoNaOperadora: "0000110502", cnes: "3176479" },
      dataInicioFaturamento: "2026-11-10", dataFimFaturamento: "2026-11-10", caraterAtendimento: "1",
      procedimentos: [
        { dataExecucao: "2026-11-10", codigoTabela: "22", codigo: "30306027", descricao: "Facectomia com lente intra-ocular com facoemulsificação", quantidade: 1, viaAcesso: "1", tecnicaUtilizada: "1", reducaoAcrescimo: 2, valorUnitario: 600, equipe: [{ grauParticipacao: "00", profissional: medico }] },
        { dataExecucao: "2026-11-10", codigoTabela: "22", codigo: "30306027", descricao: "Facectomia com lente intra-ocular com facoemulsificação", quantidade: 1, viaAcesso: "1", tecnicaUtilizada: "1", reducaoAcrescimo: 1, valorUnitario: 180, equipe: [{ grauParticipacao: "01", profissional: auxiliar }] },
      ],
      observacao: "Teste – dados fictícios “sem paciente real”", dataEmissaoGuia: "2026-11-10",
    }],
  },
  // Injeção intravítrea — SP/SADT com pacote tabela 98 (modelo Unimed 4.01.00)
  sadt_pacote_unimed: {
    config: { versao: "4.01.00", registroANS: "344397", origem: { codigoNaOperadora: "1474" } },
    numeroLote: 258, competencia: "202611", dataHora: quando,
    guias: [{
      tipo: "sp-sadt", numeroGuiaPrestador: "900002",
      autorizacao: { numeroGuiaOperadora: "OPER0002", dataAutorizacao: "2026-11-05", senha: "SENHA002", dataValidadeSenha: "2026-12-05" },
      beneficiario: { numeroCarteira: "00000000000000002" },
      solicitante: { contratado: { codigoNaOperadora: "1474" }, nomeContratado: "CLINICA FICTICIA", profissional: medico },
      dataSolicitacao: "2026-11-05", caraterAtendimento: "1", indicacaoClinica: "Indicação clínica fictícia de teste",
      executante: { contratado: { codigoNaOperadora: "1474" }, cnes: "3176479" },
      tipoAtendimento: "03", indicacaoAcidente: "9", tipoConsulta: "2", regimeAtendimento: "01",
      procedimentos: [{ dataExecucao: "2026-11-12", codigoTabela: "98", codigo: "69911312", descricao: "Pacote tratamento ocular Eylia", quantidade: 1, viaAcesso: "1", tecnicaUtilizada: "1", reducaoAcrescimo: 1, valorUnitario: 4500.5, equipe: [{ grauParticipacao: "00", profissional: medico }] }],
    }],
  },
  // Exames — SP/SADT tabela 22 (tipoAtendimento 23)
  sadt_exames: {
    config: { versao: "4.03.00", registroANS: "421715", origem: { codigoNaOperadora: "0000110502" } },
    numeroLote: 12, competencia: "202611", dataHora: quando,
    guias: [{
      tipo: "sp-sadt", numeroGuiaPrestador: "900003",
      autorizacao: { dataAutorizacao: "2026-11-01" },
      beneficiario: { numeroCarteira: "00000000000000003" },
      solicitante: { contratado: { cnpj: "05.894.660/0001-87" }, nomeContratado: "CLINICA FICTICIA", profissional: medico },
      caraterAtendimento: "1", executante: { contratado: { codigoNaOperadora: "0000110502" }, cnes: "3176479" },
      tipoAtendimento: "23", indicacaoAcidente: "9", regimeAtendimento: "01",
      procedimentos: [
        { dataExecucao: "2026-11-03", codigoTabela: "22", codigo: "41301269", descricao: "Microscopia especular de córnea", quantidade: 1, reducaoAcrescimo: 2, valorUnitario: 50.25, equipe: [{ grauParticipacao: "12", profissional: medico }] },
        { dataExecucao: "2026-11-03", codigoTabela: "22", codigo: "41501144", descricao: "Tomografia de coerência óptica", quantidade: 1, reducaoAcrescimo: 1, valorUnitario: 120, equipe: [{ grauParticipacao: "12", profissional: medico }] },
      ],
    }],
  },
  // Consulta — Guia de Consulta
  consulta: {
    config: { versao: "4.03.00", registroANS: "005711", origem: { codigoNaOperadora: "0000110502" } },
    numeroLote: 302, competencia: "202611", dataHora: quando,
    guias: [{
      tipo: "consulta", numeroGuiaPrestador: "900004", beneficiario: { numeroCarteira: "00000000000000004" },
      executante: { contratado: { codigoNaOperadora: "0000110502" }, cnes: "3176479" }, profissional: medico,
      indicacaoAcidente: "9", regimeAtendimento: "01", dataAtendimento: "2026-11-04", tipoConsulta: "1",
      procedimento: { codigoTabela: "22", codigo: "10101012", valor: 150 },
    }],
  },
};

// Validações que devem barrar o lote
const ruim: LoteTISS = { ...lotes.sadt_pacote_unimed, guias: [{ ...(lotes.sadt_pacote_unimed.guias[0] as any), autorizacao: { dataAutorizacao: "2026-11-01", senha: "X", dataValidadeSenha: "2026-11-02" } }] };
const errosRuim = validarLote(ruim);
if (!errosRuim.some((e) => e.includes("senha vencida"))) throw new Error("Validação de senha vencida não funcionou");
console.log("Validação de senha vencida: ok");

for (const [nome, lote] of Object.entries(lotes)) {
  const arq = gerarLote(lote);
  writeFileSync(join(saida, `${nome}__${arq.nomeArquivo}`), arq.bytes);
  console.log(`${nome}: ${arq.nomeArquivo} (${arq.bytes.length} bytes)`);
  if (nome === "honorarios_bradesco") {
    const z = await zipar(arq);
    writeFileSync(join(saida, `${nome}__${z.nome}`), z.bytes);
    console.log(`  zip: ${z.nome}`);
  }
}
