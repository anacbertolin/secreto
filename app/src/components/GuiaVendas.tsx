// Guia "Como funciona" do fluxo de vendas da Orientação Cirúrgica → repasse → cirurgias do dia → pagamentos.
// LEITURA OBRIGATÓRIA nas 5 primeiras vezes de cada pessoa (migração 0160; pedido do Dr. Gelson, 25/11/2026).
// Mudou o fluxo? Atualize o texto e SUBA a GUIA_VERSAO: a contagem recomeça para todos.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth, type Profissional } from "../lib/auth";
import { useCarregar, ok } from "./ui";
import { fmtDataHora } from "../lib/util";

export const GUIA = "vendas";
export const GUIA_VERSAO = 1;
const OBRIGATORIAS = 5;
const ESPERA_SEG = 8;

type Papel = "orientacao" | "faturamento" | "socio" | "outro";
function papelDe(eu: Profissional | null): Papel {
  if (eu?.orientacao_cirurgica) return "orientacao";
  if (eu?.funcao === "faturamento" || eu?.funcao === "admin") return "faturamento";
  if (eu?.funcao === "medico" && /^(max|gelson)\b/i.test(eu.nome ?? "")) return "socio";
  return "outro";
}

interface Passo { n: number; titulo: string; quem: string; papeis: Papel[]; texto: ReactNode }
const PASSOS: Passo[] = [
  { n: 1, titulo: "Venda", quem: "Alessandra", papeis: ["orientacao"],
    texto: <>Registra em <b>Vendas da orientação</b> o que o paciente pagou: paciente, médico, procedimento, lente, valor e forma de pagamento. A data da cirurgia pode ficar em branco. <b>Pagou em dinheiro?</b> Entra sozinho no caixa da Orientação (abra o caixa antes). Cartão e PIX não entram no caixa.</> },
  { n: 2, titulo: "Conferência", quem: "Luciano", papeis: ["faturamento"],
    texto: <>No <b>Repasse médico → Para conferir</b>, confere a venda e clica em <b>Conferir e lançar</b> (os custos já vêm preenchidos). Se algo estiver errado, <b>Devolver</b> com o motivo: a venda volta para a Alessandra corrigir.</> },
  { n: 3, titulo: "Data da cirurgia", quem: "Alessandra", papeis: ["orientacao"],
    texto: <>Quando o paciente volta para os exames, selecione o paciente na <b>agenda da Orientação</b>: aparece o quadro <b>“Cirurgia marcada para”</b>. Coloque a data e marque <b>☐ Fora da clínica</b> se for operar fora. Remarcou? Troque a data no mesmo lugar.</> },
  { n: 4, titulo: "Cirurgia", quem: "Médico", papeis: ["socio"],
    texto: <>A cirurgia aparece em <b>Cirurgias do dia</b> na data marcada — na clínica ou fora (etiqueta roxa).</> },
  { n: 5, titulo: "Check ✔ Realizada", quem: "Alessandra, Luciano, Dr. Gelson ou Dr. Max", papeis: ["orientacao", "faturamento", "socio"],
    texto: <>Depois da cirurgia (no mesmo dia ou no dia seguinte), abra <b>Cirurgias do dia</b> e clique em <b>✔ Realizada</b>. <b>Sem esse check ninguém recebe e não se emite nota.</b></> },
  { n: 6, titulo: "Pagamentos", quem: "Luciano", papeis: ["faturamento", "socio"],
    texto: <>Tudo automático, sem botão de “pago”: <b>PIX, dinheiro e débito</b> → médico recebe no dia da cirurgia. <b>Cartão de crédito</b> → fechamento no <b>dia 20</b>, pagamento no <b>dia 25</b>. Anestesista, instrumentação e auxiliar → no dia da cirurgia. <b>Dr. Gelson e Dr. Max</b>: a parte do médico é dividida 50% para cada. Veja em <b>Cirurgias do dia</b> (quanto cada um recebe, com WhatsApp) e em <b>Repasse médico → Relatório por médico / Previsão</b>.</> },
];
const E_SE: { p: string; r: ReactNode }[] = [
  { p: "O paciente pagou o anestesista direto?", r: <>Na venda, preencha <b>“Anestesista pago DIRETO pelo paciente”</b> e coloque no valor só o que foi pago à clínica. O repasse não desconta o anestesista de novo.</> },
  { p: "O Luciano devolveu a venda?", r: <>Ela aparece como <b>“Devolvida — corrigir”</b> em Vendas: abra, corrija e clique em <b>Salvar e reenviar</b>.</> },
  { p: "O paciente desistiu?", r: <>Antes do lançamento: a Alessandra cancela a venda (com o motivo). Depois do lançamento: o Luciano cancela o repasse escolhendo <b>“O paciente desistiu”</b> — a venda é cancelada e, se foi em dinheiro, sai do caixa.</> },
  { p: "A cirurgia foi remarcada?", r: <>Troque a data pela agenda da Orientação (ou em Vendas → coluna Cirurgia). Tudo acompanha, inclusive as datas de pagamento.</> },
  { p: "A cirurgia é fora da clínica?", r: <>Marque <b>☐ Fora da clínica</b> junto com a data. Ela aparece no mapa do dia com a etiqueta roxa e recebe o check igual.</> },
  { p: "O caixa do dia já estava fechado?", r: <>Para mudar valor, forma de pagamento ou cancelar uma venda em dinheiro, peça para quem confere o caixa clicar em <b>Devolver para correção</b>.</> },
  { p: "Quem confere o caixa (Luciano) não está na clínica?", r: <>Feche o caixa normalmente no fim do dia. Ele fica <b>“aguardando conferência”</b> até o Luciano voltar — ou outra pessoa marcada para conferir (Andrea, Soraline, Luana) confere. No dia seguinte é só abrir um caixa novo.</> },
  { p: "Esqueci de fechar o caixa ontem?", r: <>Aparece uma faixa vermelha avisando. Feche primeiro o caixa de ontem (contando a gaveta) e depois abra o de hoje — senão as vendas em dinheiro de hoje entram no caixa de ontem.</> },
  { p: "Esqueci de marcar a data ou o check?", r: <>Em <b>Cirurgias do dia → Faltam data ou check</b> aparecem as vendas sem data e as cirurgias de dias passados sem check.</> },
];

function Conteudo({ papel }: { papel: Papel }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
        {PASSOS.map((p) => {
          const meu = p.papeis.includes(papel);
          return (
            <div key={p.n} style={{ border: `2px solid ${meu ? "#1565c0" : "var(--borda, #ddd)"}`, borderRadius: 10, padding: 12,
              background: meu ? "rgba(21,101,192,.07)" : undefined, opacity: papel !== "outro" && !meu ? 0.65 : 1 }}>
              <div style={{ fontSize: "1.05rem" }}><b>{p.n}. {p.titulo}</b>{meu && <span className="etiqueta azul" style={{ marginLeft: 6 }}>você</span>}</div>
              <div className="muted pequeno" style={{ marginBottom: 6 }}>👤 {p.quem}</div>
              <div style={{ fontSize: ".95rem", lineHeight: 1.45 }}>{p.texto}</div>
            </div>
          );
        })}
      </div>
      <h3 style={{ marginTop: 18 }}>E se…?</h3>
      <ul style={{ lineHeight: 1.5, paddingLeft: 18 }}>
        {E_SE.map((e) => <li key={e.p} style={{ marginBottom: 6 }}><b>{e.p}</b> {e.r}</li>)}
      </ul>
    </div>
  );
}

function Tela({ obrigatoria, vez, aoConfirmar, aoFechar }: { obrigatoria: boolean; vez: number; aoConfirmar?: () => void; aoFechar: () => void }) {
  const { eu } = useAuth();
  const papel = papelDe(eu);
  const rolagem = useRef<HTMLDivElement>(null);
  const [chegouFim, setChegouFim] = useState(false);
  const [falta, setFalta] = useState(ESPERA_SEG);
  useEffect(() => {
    if (!obrigatoria) return;
    const t = setInterval(() => setFalta((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [obrigatoria]);
  function verFim() {
    const el = rolagem.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 30) setChegouFim(true);
  }
  useEffect(() => { verFim(); }, []);
  const pode = !obrigatoria || (chegouFim && falta === 0);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div className="painel" style={{ width: "min(980px, 100%)", maxHeight: "94vh", display: "flex", flexDirection: "column", padding: 0, margin: 0 }}>
        {obrigatoria ? (
          <div style={{ background: "#c62828", color: "#fff", padding: "14px 18px", borderRadius: "10px 10px 0 0" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>📢 LEITURA OBRIGATÓRIA — {vez} de {OBRIGATORIAS}</div>
            <div>Leia com atenção como funciona o fluxo de vendas, cirurgias e pagamentos. Role até o fim para confirmar.</div>
          </div>
        ) : (
          <div className="linha" style={{ padding: "12px 18px", borderBottom: "1px solid var(--borda, #ddd)" }}>
            <h2 style={{ margin: 0 }}>❓ Como funciona</h2><span style={{ marginLeft: "auto" }} />
            <button onClick={() => window.print()}>🖨️ Imprimir</button><button onClick={aoFechar}>Fechar</button>
          </div>
        )}
        <div ref={rolagem} onScroll={verFim} style={{ overflowY: "auto", padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Vendas da Orientação Cirúrgica → cirurgia → pagamento dos médicos</h2>
          <Conteudo papel={papel} />
          <p className="muted pequeno" style={{ marginTop: 14 }}>Este guia fica sempre no botão “❓ Como funciona” das telas de Vendas, Cirurgias do dia e Repasse médico.</p>
        </div>
        {obrigatoria && (
          <div className="linha" style={{ padding: "12px 18px", borderTop: "1px solid var(--borda, #ddd)" }}>
            <span className="muted pequeno">{!chegouFim ? "⬇️ Role o texto até o fim." : falta > 0 ? `Aguarde ${falta}s…` : "Obrigado!"}</span>
            <span style={{ marginLeft: "auto" }} />
            <button className="primario" disabled={!pode} onClick={aoConfirmar} style={{ fontSize: "1.05rem", padding: "10px 18px" }}>✅ Li e entendi</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Coloque no topo das telas: abre sozinho (obrigatório) nas 5 primeiras vezes e mostra o botão “❓ Como funciona”. */
// uma leitura por vez que a pessoa abre o sistema (aba do navegador): não reaparece ao trocar de tela
const CHAVE_SESSAO = `guia_${GUIA}_v${GUIA_VERSAO}_lido`;
function lidoNestaSessao() { try { return sessionStorage.getItem(CHAVE_SESSAO) === "1"; } catch { return false; } }

export function GuiaVendas() {
  const [vezes, setVezes] = useState<number | null>(null);
  const [aberto, setAberto] = useState(false);
  const [lido, setLido] = useState(lidoNestaSessao);
  useEffect(() => {
    void supabase.rpc("guia_vezes", { p_guia: GUIA, p_versao: GUIA_VERSAO }).then(({ data, error }) => {
      if (!error) setVezes(Number(data ?? 0));
    });
  }, []);
  async function confirmar() {
    const { data, error } = await supabase.rpc("guia_li", { p_guia: GUIA, p_versao: GUIA_VERSAO });
    setVezes(error ? OBRIGATORIAS : Number(data ?? OBRIGATORIAS));
    try { sessionStorage.setItem(CHAVE_SESSAO, "1"); } catch { /* sem armazenamento: fecha só nesta tela */ }
    setLido(true);
  }
  const obrigatoria = !lido && vezes !== null && vezes < OBRIGATORIAS;
  return (
    <>
      <button className="nao-imprimir" onClick={() => setAberto(true)}>❓ Como funciona</button>
      {obrigatoria && <Tela obrigatoria vez={(vezes ?? 0) + 1} aoConfirmar={confirmar} aoFechar={() => undefined} />}
      {!obrigatoria && aberto && <Tela obrigatoria={false} vez={0} aoFechar={() => setAberto(false)} />}
    </>
  );
}

/** Para a administração: quem já leu o guia (e quantas vezes). */
export function LeiturasGuia() {
  const { eu } = useAuth();
  const { dados } = useCarregar(async () => eu?.funcao !== "admin" ? [] : ok(await supabase.from("guia_leituras")
    .select("vezes, ultima_em, profissionais(nome)").eq("guia", GUIA).eq("versao", GUIA_VERSAO).order("ultima_em", { ascending: false })) as
    unknown as { vezes: number; ultima_em: string; profissionais: { nome: string } | null }[], [eu?.funcao]);
  if (eu?.funcao !== "admin") return null;
  return (
    <div className="painel rolagem nao-imprimir">
      <h2>Quem já leu o guia “Como funciona”</h2>
      {!dados?.length ? <div className="vazio">Ninguém confirmou a leitura ainda.</div> : (
        <table className="tabela">
          <thead><tr><th>Pessoa</th><th>Leituras</th><th>Última</th></tr></thead>
          <tbody>{dados.map((d, i) => (
            <tr key={i}><td>{d.profissionais?.nome ?? "—"}</td><td>{d.vezes >= OBRIGATORIAS ? `✅ ${d.vezes}` : `${d.vezes} de ${OBRIGATORIAS}`}</td><td>{fmtDataHora(d.ultima_em)}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
