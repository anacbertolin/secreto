// Folha de horários dos colírios em LETRA GRANDE, para o paciente levar para casa.
// Lê a posologia da receita ("de 8/8h", "4x ao dia", "ao deitar") e monta a tabela de horários
// com quadradinhos para marcar cada aplicação por 7 dias.
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { CLINICA } from "../lib/marca";

interface Item { id: string; medicamento: string; apresentacao: string | null; posologia: string; olho: string | null; via: string | null; duracao: string | null; ordem: number }

const h = (n: number) => `${String(((n % 24) + 24) % 24).padStart(2, "0")}:00`;

/** Converte a posologia em horários do dia. Devolve [] se não der para entender (aí fica "conforme orientação"). */
export function horariosDaPosologia(pos: string): string[] {
  const t = pos.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const noite = /(deitar|noite|dormir)/.test(t);
  const intervalo = t.match(/(\d{1,2})\s*\/\s*\1\s*h/) ?? t.match(/a cada\s*(\d{1,2})\s*(h|hora)/) ?? t.match(/(\d{1,2})\s*em\s*\1\s*h/);
  if (intervalo) {
    const n = Number(intervalo[1]);
    if (n >= 24) return [noite ? "22:00" : "08:00"];
    if (n === 12) return ["08:00", "20:00"];
    if (n < 2) return [];
    const out: string[] = [];
    // intervalos curtos (de 2/2h a 4/4h) ficam só enquanto o paciente está acordado (6h às 22h)
    const fim = n < 6 ? 22 : 29;
    for (let x = 6; x <= fim && out.length < Math.floor(24 / n); x += n) out.push(h(x));
    return out;
  }
  const vezes = t.match(/(\d{1,2})\s*(x|vezes)\s*(ao|por|\/)?\s*dia/) ?? (/(uma|1) vez ao dia/.test(t) ? ["", "1"] : null);
  if (vezes) {
    const n = Number(vezes[1]);
    const tabela: Record<number, number[]> = { 1: [noite ? 22 : 8], 2: [8, 20], 3: [6, 14, 22], 4: [7, 12, 17, 22], 5: [6, 10, 14, 18, 22], 6: [6, 9, 12, 15, 18, 21], 8: [6, 8, 10, 12, 14, 16, 18, 20] };
    return (tabela[n] ?? []).map(h);
  }
  if (noite) return ["22:00"];
  return [];
}

function ehOcular(i: Item) {
  return !!i.olho || /ocular|oftalm/i.test(i.via ?? "") || /col[ií]rio|pomada oft|gel oft|gotas?/i.test(`${i.apresentacao ?? ""} ${i.posologia} ${i.medicamento}`);
}
const OLHO: Record<string, string> = { OD: "OLHO DIREITO", OE: "OLHO ESQUERDO", AO: "OS DOIS OLHOS" };

export default function ImprimirColirios() {
  const { id } = useParams();
  const { dados, erro, carregando } = useCarregar(async () => {
    const a = ok(await supabase.from("atendimentos").select("inicio, pacientes(nome, nome_social), profissionais(nome)").eq("id", id!).single()) as unknown as { inicio: string; pacientes: { nome: string; nome_social: string | null }; profissionais: { nome: string } };
    const rx = ok(await supabase.from("prescricoes").select("prescricao_itens(*)").eq("atendimento_id", id!)) as { prescricao_itens: Item[] }[];
    const itens = rx.flatMap((r) => r.prescricao_itens).sort((x, y) => x.ordem - y.ordem).filter(ehOcular);
    return { a, itens };
  }, [id]);
  if (carregando) return <Carregando />;
  if (!dados) return <Aviso>{erro}</Aviso>;
  const { a, itens } = dados;
  const nome = (a.pacientes.nome_social || a.pacientes.nome).split(" ")[0];

  return (
    <div style={{ background: "#e9edf1", minHeight: "100vh", padding: "20px 0" }}>
      <div className="barra-impressao">
        <button className="primario" onClick={() => window.print()}>🖨️ Imprimir</button>
        <button onClick={() => window.close()}>Fechar</button>
      </div>
      <div className="folha colirios">
        <div className="timbre">
          <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ height: 46 }} />
          <div style={{ textAlign: "right", fontSize: 16 }}>Dúvidas? Ligue:<br /><b style={{ fontSize: 22 }}>{CLINICA.telefone}</b></div>
        </div>
        <h1>MEUS COLÍRIOS</h1>
        <p className="col-pac">{nome}, use os colírios nos horários abaixo. Marque um ✔ no quadrinho depois de pingar.</p>
        {itens.length === 0 && <Aviso tipo="alerta">Esta consulta não tem colírios na receita.</Aviso>}
        {itens.map((i, n) => {
          const horas = horariosDaPosologia(i.posologia);
          return (
            <div key={i.id} className="col-bloco">
              <div className="col-cab">
                <span className="col-num">{n + 1}</span>
                <div>
                  <div className="col-nome">{i.medicamento}</div>
                  <div className="col-olho">👁 {OLHO[i.olho ?? ""] ?? "conforme orientação"}</div>
                </div>
              </div>
              <div className="col-pos">{i.posologia}{i.duracao && (/^(uso|at[eé]|sempre|cont[ií]nuo)/i.test(i.duracao) ? ` · ${i.duracao}` : ` · por ${i.duracao}`)}</div>
              <table className="col-tabela">
                <thead><tr><th>Horário</th>{[1, 2, 3, 4, 5, 6, 7].map((d) => <th key={d}>{d}º dia</th>)}</tr></thead>
                <tbody>
                  {(horas.length ? horas : ["____:____", "____:____"]).map((hr) => (
                    <tr key={hr}><td className="col-hora">{hr}</td>{[1, 2, 3, 4, 5, 6, 7].map((d) => <td key={d}><span className="col-quad" /></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <div className="col-dicas">
          <b>Como pingar:</b>
          <ul>
            <li>Lave as mãos antes.</li>
            <li>Não encoste o bico do frasco no olho.</li>
            <li>Depois de pingar, feche os olhos por 1 minuto.</li>
            <li>Se usar mais de um colírio, espere <b>5 minutos</b> entre um e outro.</li>
            <li>Não pare o tratamento sem falar com o médico.</li>
          </ul>
        </div>
        <p style={{ fontSize: 14, color: "#444" }}>Receitado por {a.profissionais.nome} · {new Date(a.inicio).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      </div>
    </div>
  );
}
