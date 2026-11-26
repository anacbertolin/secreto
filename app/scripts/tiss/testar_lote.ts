// Teste da montagem do XML de um lote (dados 100% fictícios). Uso: npx -y tsx@4.19.2 scripts/tiss/testar_lote.ts /tmp/tiss-lote && scripts/tiss/validar.sh /tmp/tiss-lote 4.03.00
import { montarLoteTISS } from "../../src/lib/tissMontar";
import { gerarLote } from "../../src/lib/tiss";
import { writeFileSync, mkdirSync } from "fs";
const tiss = { versao: "4.03.00", exige_zip: true, crm_completo: true, mostra_fator: true, consulta_em_sadt: false, digitos_lote: 12,
  data_autorizacao_vazia_usa_data_conta: true, prestador: { identificacao: "codigo_operadora", codigo_operadora: "0000110502", cnes: "3176479", nome: "Consumed Consultorios Medicos Ltda" } };
const conv = { nome: "Bradesco Saúde", registro_ans: "005711", codigo_prestador: "0000110502", versao_tiss: "4.03.00", tiss };
const profs = [{ id: "m1", nome: "Medico Ficticio", conselho: "CRM", numero_conselho: "52.99999-9", uf_conselho: "RJ", cbo: "225265" }];
const item = (o: object) => ({ id: "i", tabela: "22", codigo: "41301269", descricao: "Microscopia especular de córnea", data_execucao: "2026-11-03", quantidade: 1, valor_unitario: 50.25, olho: null, profissional_id: "m1", procedimentos: { tipo: "exame" }, ...o });
const conta = (o: object) => ({ id: "c", tipo_guia: "sadt", numero_guia_prestador: "00000001", numero_guia_operadora: null, senha_autorizacao: "ABC123", data_autorizacao: null, validade_senha: "2026-12-01",
  carteirinha: "99999999999999", data_atendimento: "2026-11-03", profissional_id: "m1", solicitante_id: null, indicacao_clinica: "Teste", observacoes: null, plano_id: null,
  agendamentos: { primeira_vez: false, tipo: "exame" }, pacientes: { nome: "TESTE" }, conta_itens: [item({}), item({ codigo: "41501144", descricao: "OCT", quantidade: 2, olho: "AO", valor_unitario: 120 })], ...o });
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const casos = {
  sadt: [conta({}), conta({ numero_guia_prestador: "00000002", senha_autorizacao: null })],
  consulta: [conta({ tipo_guia: "consulta", conta_itens: [item({ codigo: "10101012", descricao: "Consulta", procedimentos: { tipo: "consulta" }, valor_unitario: 100 })] })],
};
for (const [nome, contas] of Object.entries(casos)) {
  const m = montarLoteTISS({ lote: { numero: 1, competencia: "2026-11-01" }, conv, contas: contas as never, profs, codigos: [] });
  if (m.erros.length) { console.log(nome, "ERROS", m.erros); continue; }
  const arq = gerarLote({ config: m.config, numeroLote: 1677, competencia: m.competencia, dataHora: new Date(), guias: m.guias });
  writeFileSync(`${out}/${nome}_${arq.nomeArquivo}`, arq.bytes);
  console.log(nome, arq.nomeArquivo, m.avisos);
}
