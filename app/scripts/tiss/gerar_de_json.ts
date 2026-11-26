// Gera o XML TISS a partir de um JSON no formato DadosLote (saída de migracao/xml/dados_cobranca.sql, ensaio local).
// Uso: npx -y tsx@4.19.2 scripts/tiss/gerar_de_json.ts /tmp/cobranca.json <nº do lote no XML> /tmp/saida
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { montarLoteTISS, type DadosLote } from "../../src/lib/tissMontar";
import { gerarLote } from "../../src/lib/tiss";
const [arqJson, numero, saida] = process.argv.slice(2);
const dados = JSON.parse(readFileSync(arqJson, "utf8")) as DadosLote;
const m = montarLoteTISS(dados);
if (m.avisos.length) console.log("Avisos:\n- " + m.avisos.join("\n- "));
if (m.erros.length) { console.log("Erros:\n- " + [...new Set(m.erros)].join("\n- ")); process.exit(1); }
const arq = gerarLote({ config: m.config, numeroLote: Number(numero), competencia: m.competencia, dataHora: new Date(), guias: m.guias });
mkdirSync(saida, { recursive: true });
writeFileSync(`${saida}/${arq.nomeArquivo}`, arq.bytes);
console.log(`${m.guias.length} guia(s) → ${saida}/${arq.nomeArquivo}`);
