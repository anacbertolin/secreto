// Caixa da Recepção — migração 0066 (pedido da dona, 18–19/11/2026).
// Substitui a folha de papel. Funciona sozinho (nome do paciente digitado), sem depender da agenda/prontuário.
// NÃO tem relação com o Repasse médico.
// Caminho: aberto (recepção lança) → fechado (conta a gaveta) → conferido (telefone/WhatsApp) → aprovado (Luciano/Soraline).
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth, type Profissional } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo } from "../components/ui";
import { fmtData, fmtDataHora, fmtMoeda } from "../lib/util";

// ------------------------------------------------------------------ tipos e utilidades
interface CaixaRow {
  id: string; data: string; status: "aberto" | "fechado" | "conferido" | "aprovado"; fundo_troco: number;
  aberto_por: string | null; aberto_em: string; fechado_por: string | null; fechado_em: string | null;
  esperado_dinheiro: number | null; contado_dinheiro: number | null; diferenca_dinheiro: number | null; obs_fechamento: string | null;
  conferido_por: string | null; conferido_em: string | null; obs_conferencia: string | null;
  aprovado_por: string | null; aprovado_em: string | null; obs_aprovacao: string | null;
  devolvido_por: string | null; devolvido_em: string | null; motivo_devolucao: string | null;
}
interface Pagamento {
  id: string; caixa_id: string; atendimento_id: string; forma: Forma; parcelas: number; valor: number; pagador: string | null;
  cancelado: boolean; motivo_cancelamento: string | null; criado_por: string | null; criado_em: string;
  caixa_atendimentos?: { paciente_nome: string; caixa_id: string; descricao: string | null } | null;
}
interface Atendimento {
  id: string; caixa_id: string; paciente_nome: string; medico_id: string | null; descricao: string | null; valor: number;
  cortesia: boolean; motivo_cortesia: string | null; cortesia_autorizada_por: string | null; observacao: string | null;
  cancelado: boolean; motivo_cancelamento: string | null; criado_por: string | null; criado_em: string;
  caixa_pagamentos: Pagamento[];
}
interface Saida {
  id: string; caixa_id: string; valor: number; motivo: string; autorizado_por: string | null;
  cancelado: boolean; motivo_cancelamento: string | null; criado_por: string | null; criado_em: string;
}
type Forma = "dinheiro" | "pix" | "debito" | "credito_vista" | "credito_parcelado";

export const FORMAS_CAIXA: Record<Forma, string> = {
  dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito_vista: "Crédito à vista", credito_parcelado: "Crédito parcelado",
};
const ORDEM_FORMAS = Object.keys(FORMAS_CAIXA) as Forma[];
export const STATUS_CAIXA: Record<CaixaRow["status"], { rotulo: string; cor: string }> = {
  aberto: { rotulo: "Aberto", cor: "azul" },
  fechado: { rotulo: "Fechado · aguardando conferência", cor: "amarelo" },
  conferido: { rotulo: "Conferido · aguardando aprovação", cor: "roxo" },
  aprovado: { rotulo: "Aprovado", cor: "verde" },
};
/** O que foi recebido: um ou mais tipos + itens marcados, gravados juntos em `descricao`
 *  (ex.: "Consulta (Retorno) + Exame (Tonometria, Mapeamento de retina)"). */
const TIPOS_RECEBIMENTO = ["Consulta", "Exame", "Procedimento"] as const;
type TipoRecebimento = (typeof TIPOS_RECEBIMENTO)[number];
const DETALHES: Record<TipoRecebimento, string[]> = {
  Consulta: ["Primeira vez", "Retorno"],
  Exame: ["Mapeamento de retina", "Tonometria", "Campimetria", "OCT", "Topografia", "Biometria", "Paquimetria", "Retinografia", "Microscopia especular"],
  Procedimento: ["Cirurgia", "Injeção intravítrea", "Laser", "Terapia", "Lente de contato"],
};
const num = { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };
const n2 = (v: number) => Math.round(v * 100) / 100;

/** Aceita "1.234,56", "1234,56", "1234.56", "R$ 300" */
export function lerValor(s: string): number | null {
  let t = String(s ?? "").replace(/[R$\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const v = Number(t);
  return Number.isFinite(v) ? n2(v) : null;
}
const pagoDe = (a: Atendimento) => n2(a.caixa_pagamentos.filter((p) => !p.cancelado).reduce((s, p) => s + Number(p.valor), 0));
const saldoDe = (a: Atendimento) => (a.cancelado || a.cortesia ? 0 : n2(Number(a.valor) - pagoDe(a)));

/** Quem pode o quê (o banco confere de novo — migração 0066) */
export function papelCaixa(eu: Profissional | null) {
  const f = eu?.funcao;
  return {
    // abre, lança e fecha: recepção, administração e faturamento (migração 0083)
    lancar: f === "recepcao" || f === "admin" || f === "faturamento",
    conferir: !!eu?.caixa_conferir || f === "admin",
    aprovar: !!eu?.caixa_aprovar || f === "admin",
    ver: f === "recepcao" || f === "admin" || f === "faturamento" || !!eu?.caixa_conferir || !!eu?.caixa_aprovar,
  };
}

function useNomes() {
  const { dados } = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome, funcao, ativo").order("nome")) as { id: string; nome: string; funcao: string; ativo: boolean }[], []);
  return useMemo(() => {
    const mapa = new Map((dados ?? []).map((p) => [p.id, p.nome]));
    return {
      nome: (id?: string | null) => (id ? mapa.get(id)?.split(" ")[0] ?? "—" : "—"),
      nomeCompleto: (id?: string | null) => (id ? mapa.get(id) ?? "—" : "—"),
      medicos: (dados ?? []).filter((p) => p.funcao === "medico" && p.ativo),
    };
  }, [dados]);
}

async function rpc(nome: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  return data;
}

// ================================================================== Lista de caixas
export default function Caixa() {
  const { eu } = useAuth();
  const papel = papelCaixa(eu);
  const nav = useNavigate();
  const nomes = useNomes();
  const { dados, erro, carregando } = useCarregar(
    async () => ok(await supabase.from("caixas").select("*").order("aberto_em", { ascending: false }).limit(120)) as CaixaRow[], []);
  const [abrir, setAbrir] = useState(false);
  const aberto = (dados ?? []).find((c) => c.status === "aberto");
  const aguardando = (dados ?? []).filter((c) => (c.status === "fechado" && papel.conferir) || (c.status === "conferido" && papel.aprovar));

  return (
    <div>
      <div className="cabecalho">
        <div><h1>Caixa da recepção</h1><p className="sub" style={{ margin: 0 }}>Recebimentos do dia, saídas e fechamento (substitui a folha de papel)</p></div>
        {papel.lancar && !aberto && !carregando && <button className="primario" onClick={() => setAbrir(true)}>🔓 Abrir caixa</button>}
      </div>
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <>
          {aberto ? (
            <div className="painel" style={{ marginBottom: 16 }}>
              <div className="linha entre">
                <div>
                  <b>Caixa aberto</b> desde {fmtDataHora(aberto.aberto_em)} por {nomes.nomeCompleto(aberto.aberto_por)} · fundo de troco {fmtMoeda(aberto.fundo_troco)}
                  {aberto.motivo_devolucao && <div><Etiqueta cor="vermelho">Devolvido para correção</Etiqueta> <span className="pequeno">{aberto.motivo_devolucao}</span></div>}
                </div>
                <button className="primario" onClick={() => nav(`/caixa/${aberto.id}`)}>Ir para o caixa →</button>
              </div>
            </div>
          ) : (
            <Aviso tipo="info">Nenhum caixa aberto agora.{papel.lancar ? " Clique em “Abrir caixa” para começar o dia." : ""}</Aviso>
          )}

          {aguardando.length > 0 && (
            <div className="painel" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Esperando por você</h3>
              <ul className="lista-simples">
                {aguardando.map((c) => (
                  <li key={c.id}><Link to={`/caixa/${c.id}`}>Caixa de {fmtData(c.data)}</Link> · <Etiqueta cor={STATUS_CAIXA[c.status].cor}>{STATUS_CAIXA[c.status].rotulo}</Etiqueta></li>
                ))}
              </ul>
            </div>
          )}

          <div className="painel rolagem">
            <h3 style={{ marginTop: 0 }}>Histórico</h3>
            {(dados ?? []).length === 0 ? <div className="vazio">Nenhum caixa ainda.</div> : (
              <table className="tabela">
                <thead><tr><th>Data</th><th>Situação</th><th>Abriu</th><th>Fechou</th><th style={num}>Diferença na gaveta</th><th>Conferiu</th><th>Aprovou</th></tr></thead>
                <tbody>
                  {(dados ?? []).map((c) => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => nav(`/caixa/${c.id}`)}>
                      <td><Link to={`/caixa/${c.id}`}>{fmtData(c.data)}</Link></td>
                      <td><Etiqueta cor={STATUS_CAIXA[c.status].cor}>{STATUS_CAIXA[c.status].rotulo}</Etiqueta></td>
                      <td>{nomes.nome(c.aberto_por)}</td>
                      <td>{nomes.nome(c.fechado_por)}</td>
                      <td style={num}>{c.diferenca_dinheiro === null ? "—" : <Diferenca v={c.diferenca_dinheiro} />}</td>
                      <td>{nomes.nome(c.conferido_por)}</td>
                      <td>{nomes.nome(c.aprovado_por)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {abrir && <AbrirCaixa aoFechar={() => setAbrir(false)} aoSalvar={(id) => nav(`/caixa/${id}`)} />}
    </div>
  );
}

function Diferenca({ v }: { v: number }) {
  const x = Number(v);
  if (Math.abs(x) < 0.005) return <span style={{ color: "var(--verde, #1a7f37)" }}>✔ bateu</span>;
  return <b style={{ color: x < 0 ? "#c62828" : "#b26a00" }}>{x < 0 ? "faltou " : "sobrou "}{fmtMoeda(Math.abs(x))}</b>;
}

function AbrirCaixa({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: (id: string) => void }) {
  const [fundo, setFundo] = useState("200,00");
  const [erro, setErro] = useState("");
  async function salvar() {
    const v = lerValor(fundo);
    if (v === null || v < 0) return setErro("Informe o fundo de troco (pode ser 0).");
    try { aoSalvar((await rpc("caixa_abrir", { p_fundo: v })) as string); } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo="Abrir caixa" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Abrir caixa</button></>}>
      <Aviso>{erro}</Aviso>
      <p>Quem abre o caixa fica registrada(o) como responsável do dia.</p>
      <Campo rotulo="Fundo de troco (dinheiro que já está na gaveta)"><input inputMode="decimal" value={fundo} onChange={(e) => setFundo(e.target.value)} autoFocus /></Campo>
    </Modal>
  );
}

// ================================================================== Um caixa
export function CaixaDetalhe() {
  const { id } = useParams();
  const { eu } = useAuth();
  const papel = papelCaixa(eu);
  const nomes = useNomes();
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [cx, ats, pags, sais] = await Promise.all([
      supabase.from("caixas").select("*").eq("id", id!).single().then((r) => ok(r) as CaixaRow),
      supabase.from("caixa_atendimentos").select("*, caixa_pagamentos(*)").eq("caixa_id", id!).order("criado_em").then((r) => ok(r) as Atendimento[]),
      supabase.from("caixa_pagamentos").select("*, caixa_atendimentos(paciente_nome, caixa_id, descricao)").eq("caixa_id", id!).order("criado_em").then((r) => ok(r) as Pagamento[]),
      supabase.from("caixa_saidas").select("*").eq("caixa_id", id!).order("criado_em").then((r) => ok(r) as Saida[]),
    ]);
    // saldos pendentes de outros dias (só interessa com o caixa aberto)
    let pendentes: Atendimento[] = [];
    if (cx.status === "aberto") {
      const r = ok(await supabase.from("caixa_atendimentos").select("*, caixa_pagamentos(*)")
        .neq("caixa_id", id!).eq("cancelado", false).eq("cortesia", false).gt("valor", 0)
        .order("criado_em", { ascending: false }).limit(500)) as Atendimento[];
      pendentes = r.filter((a) => saldoDe(a) > 0);
    }
    return { cx, ats, pags, sais, pendentes };
  }, [id]);
  const [modal, setModal] = useState<"" | "receber" | "cortesia" | "saida" | "fechar" | "conferir" | "aprovar" | "devolver">("");
  const [pagarAt, setPagarAt] = useState<Atendimento | null>(null);
  const [erroAcao, setErroAcao] = useState("");

  if (carregando && !dados) return <Carregando />;
  if (erro || !dados) return <Aviso>{erro || "Caixa não encontrado."}</Aviso>;
  const { cx, ats, pags, sais, pendentes } = dados;
  const aberto = cx.status === "aberto";
  const podeLancar = aberto && papel.lancar;

  const pagsValidos = pags.filter((p) => !p.cancelado);
  const porForma = Object.fromEntries(ORDEM_FORMAS.map((f) => [f, n2(pagsValidos.filter((p) => p.forma === f).reduce((s, p) => s + Number(p.valor), 0))])) as Record<Forma, number>;
  const totalRecebido = n2(ORDEM_FORMAS.reduce((s, f) => s + porForma[f], 0));
  const totalCartoes = n2(porForma.debito + porForma.credito_vista + porForma.credito_parcelado);
  const totalSaidas = n2(sais.filter((s) => !s.cancelado).reduce((s, x) => s + Number(x.valor), 0));
  const esperadoDinheiro = n2(Number(cx.fundo_troco) + porForma.dinheiro - totalSaidas);
  const atsValidos = ats.filter((a) => !a.cancelado);
  const cortesias = atsValidos.filter((a) => a.cortesia).length;
  const faltaReceber = n2(atsValidos.reduce((s, a) => s + saldoDe(a), 0));
  const pagsSaldoAnterior = pags.filter((p) => p.caixa_atendimentos && p.caixa_atendimentos.caixa_id !== cx.id);

  async function cancelar(tabela: "caixa_atendimentos" | "caixa_pagamentos" | "caixa_saidas", linha: string, oque: string) {
    setErroAcao("");
    const motivo = window.prompt(`Cancelar ${oque}? Escreva o motivo:`);
    if (motivo === null) return;
    if (!motivo.trim()) return setErroAcao("Para cancelar é preciso escrever o motivo.");
    const { error } = await supabase.from(tabela).update({ cancelado: true, motivo_cancelamento: motivo.trim() }).eq("id", linha);
    if (error) setErroAcao(msgErro(error)); else recarregar();
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Caixa de {fmtData(cx.data)} <Etiqueta cor={STATUS_CAIXA[cx.status].cor}>{STATUS_CAIXA[cx.status].rotulo}</Etiqueta></h1>
          <p className="sub" style={{ margin: 0 }}>
            Aberto por {nomes.nomeCompleto(cx.aberto_por)} em {fmtDataHora(cx.aberto_em)} · fundo de troco {fmtMoeda(cx.fundo_troco)}
          </p>
        </div>
        <div className="linha nao-imprimir">
          <Link to="/caixa"><button>← Caixas</button></Link>
          <button onClick={() => window.print()}>🖨️ Imprimir</button>
        </div>
      </div>
      <Aviso>{erroAcao}</Aviso>
      {cx.motivo_devolucao && aberto && (
        <Aviso tipo="alerta">Devolvido para correção por {nomes.nomeCompleto(cx.devolvido_por)} em {fmtDataHora(cx.devolvido_em)}: <b>{cx.motivo_devolucao}</b>. Corrija e feche de novo.</Aviso>
      )}

      {/* ---------- Ações do momento ---------- */}
      <div className="linha nao-imprimir" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {podeLancar && <>
          <button className="primario" onClick={() => setModal("receber")}>💵 Novo recebimento</button>
          <button onClick={() => setModal("cortesia")}>🎁 Cortesia (sem cobrança)</button>
          <button onClick={() => setModal("saida")}>↗️ Saída / sangria</button>
          <button onClick={() => setModal("fechar")} style={{ marginLeft: "auto" }}>🔒 Fechar caixa</button>
        </>}
        {cx.status === "fechado" && papel.conferir && <>
          <button className="primario" onClick={() => setModal("conferir")}>✔️ Conferir</button>
          <button onClick={() => setModal("devolver")}>↩️ Devolver para correção</button>
        </>}
        {cx.status === "conferido" && papel.aprovar && <>
          <button className="primario" onClick={() => setModal("aprovar")}>✅ Aprovar</button>
          <button onClick={() => setModal("devolver")}>↩️ Devolver para correção</button>
        </>}
      </div>

      {/* ---------- Totais ---------- */}
      <div className="cartoes">
        {ORDEM_FORMAS.map((f) => <div className="cartao" key={f}><div className="rot">{FORMAS_CAIXA[f]}</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(porForma[f])}</div></div>)}
      </div>
      <div className="cartoes">
        <div className="cartao"><div className="rot">Total recebido</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(totalRecebido)}</div><div className="pequeno muted">cartões {fmtMoeda(totalCartoes)}</div></div>
        <div className="cartao"><div className="rot">Saídas / sangrias</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(totalSaidas)}</div></div>
        <div className="cartao"><div className="rot">Dinheiro que deve estar na gaveta</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(aberto ? esperadoDinheiro : cx.esperado_dinheiro)}</div><div className="pequeno muted">fundo + dinheiro − saídas</div></div>
        {cx.contado_dinheiro !== null && (
          <div className="cartao"><div className="rot">Contado na gaveta</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(cx.contado_dinheiro)}</div><div className="pequeno"><Diferenca v={Number(cx.diferenca_dinheiro)} /></div></div>
        )}
        <div className="cartao"><div className="rot">Atendimentos</div><div className="num" style={{ fontSize: "1.35rem" }}>{atsValidos.length}</div><div className="pequeno muted">{cortesias} cortesia(s){faltaReceber > 0 ? ` · falta receber ${fmtMoeda(faltaReceber)}` : ""}</div></div>
      </div>

      {/* ---------- Atendimentos ---------- */}
      <div className="painel rolagem" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Atendimentos do caixa</h3>
        {ats.length === 0 ? <div className="vazio">Nenhum atendimento lançado.</div> : (
          <table className="tabela">
            <thead><tr><th>Hora</th><th>Paciente</th><th>Médico</th><th>O que foi feito</th><th style={num}>Valor</th><th>Pagamento</th><th style={num}>Falta</th><th>Lançou</th><th className="nao-imprimir"></th></tr></thead>
            <tbody>
              {ats.map((a) => {
                const saldo = saldoDe(a);
                return (
                  <tr key={a.id} style={{ opacity: a.cancelado ? 0.5 : 1 }}>
                    <td>{new Date(a.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td><b style={{ textDecoration: a.cancelado ? "line-through" : undefined }}>{a.paciente_nome}</b>
                      {a.cancelado && <div className="pequeno"><Etiqueta cor="cinza">cancelado</Etiqueta> {a.motivo_cancelamento}</div>}
                      {a.observacao && <div className="pequeno muted">{a.observacao}</div>}</td>
                    <td>{a.medico_id ? nomes.nomeCompleto(a.medico_id) : "—"}</td>
                    <td>{a.descricao ?? "—"}</td>
                    <td style={num}>{a.cortesia ? <Etiqueta cor="azul">Cortesia</Etiqueta> : fmtMoeda(a.valor)}
                      {a.cortesia && <div className="pequeno muted">{a.motivo_cortesia}{a.cortesia_autorizada_por ? ` · autorizou: ${a.cortesia_autorizada_por}` : ""}</div>}</td>
                    <td>
                      {a.caixa_pagamentos.map((p) => (
                        <div key={p.id} className="pequeno" style={{ opacity: p.cancelado ? 0.5 : 1, textDecoration: p.cancelado ? "line-through" : undefined }}>
                          {FORMAS_CAIXA[p.forma]}{p.forma === "credito_parcelado" ? ` ${p.parcelas}x` : ""} {fmtMoeda(p.valor)}
                          {p.pagador ? <span className="muted"> · {p.pagador}</span> : null}
                          {p.caixa_id !== cx.id && <span className="muted"> · em outro dia</span>}
                          {podeLancar && !p.cancelado && p.caixa_id === cx.id && <button className="mini nao-imprimir" style={{ marginLeft: 6 }} onClick={() => cancelar("caixa_pagamentos", p.id, "este pagamento")}>✕</button>}
                        </div>
                      ))}
                    </td>
                    <td style={num}>{saldo > 0 ? <b style={{ color: "#c62828" }}>{fmtMoeda(saldo)}</b> : "—"}</td>
                    <td>{nomes.nome(a.criado_por)}</td>
                    <td className="nao-imprimir" style={{ whiteSpace: "nowrap" }}>
                      {podeLancar && saldo > 0 && <button className="mini" onClick={() => setPagarAt(a)}>Receber</button>}
                      {podeLancar && !a.cancelado && <button className="mini" onClick={() => cancelar("caixa_atendimentos", a.id, `o atendimento de ${a.paciente_nome}`)}>Cancelar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagsSaldoAnterior.length > 0 && (
        <div className="painel rolagem" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Recebimentos de saldos de outros dias</h3>
          <table className="tabela">
            <thead><tr><th>Paciente</th><th>Forma</th><th style={num}>Valor</th><th>Lançou</th><th className="nao-imprimir"></th></tr></thead>
            <tbody>{pagsSaldoAnterior.map((p) => (
              <tr key={p.id} style={{ opacity: p.cancelado ? 0.5 : 1 }}>
                <td>{p.caixa_atendimentos?.paciente_nome}{p.cancelado && <> <Etiqueta cor="cinza">cancelado</Etiqueta></>}</td>
                <td>{FORMAS_CAIXA[p.forma]}{p.forma === "credito_parcelado" ? ` ${p.parcelas}x` : ""}{p.pagador ? ` · ${p.pagador}` : ""}</td>
                <td style={num}>{fmtMoeda(p.valor)}</td>
                <td>{nomes.nome(p.criado_por)}</td>
                <td className="nao-imprimir">{podeLancar && !p.cancelado && <button className="mini" onClick={() => cancelar("caixa_pagamentos", p.id, "este pagamento")}>Cancelar</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ---------- Saídas ---------- */}
      <div className="painel rolagem" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Saídas / sangrias</h3>
        {sais.length === 0 ? <div className="vazio">Nenhuma saída.</div> : (
          <table className="tabela">
            <thead><tr><th>Hora</th><th>Motivo</th><th>Autorizou</th><th style={num}>Valor</th><th>Lançou</th><th className="nao-imprimir"></th></tr></thead>
            <tbody>{sais.map((s) => (
              <tr key={s.id} style={{ opacity: s.cancelado ? 0.5 : 1 }}>
                <td>{new Date(s.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>{s.motivo}{s.cancelado && <div className="pequeno"><Etiqueta cor="cinza">cancelada</Etiqueta> {s.motivo_cancelamento}</div>}</td>
                <td>{s.autorizado_por ?? "—"}</td>
                <td style={num}>{fmtMoeda(s.valor)}</td>
                <td>{nomes.nome(s.criado_por)}</td>
                <td className="nao-imprimir">{podeLancar && !s.cancelado && <button className="mini" onClick={() => cancelar("caixa_saidas", s.id, "esta saída")}>Cancelar</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* ---------- Saldos pendentes de outros dias ---------- */}
      {podeLancar && pendentes.length > 0 && (
        <div className="painel rolagem nao-imprimir" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Pacientes com valor a receber de outros dias</h3>
          <table className="tabela">
            <thead><tr><th>Paciente</th><th>O que foi feito</th><th style={num}>Valor</th><th style={num}>Falta</th><th></th></tr></thead>
            <tbody>{pendentes.map((a) => (
              <tr key={a.id}>
                <td>{a.paciente_nome} <span className="muted pequeno">({fmtData(a.criado_em)})</span></td>
                <td>{a.descricao ?? "—"}</td>
                <td style={num}>{fmtMoeda(a.valor)}</td>
                <td style={num}><b style={{ color: "#c62828" }}>{fmtMoeda(saldoDe(a))}</b></td>
                <td><button className="mini" onClick={() => setPagarAt(a)}>Receber</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ---------- Caminho do caixa ---------- */}
      <div className="painel">
        <h3 style={{ marginTop: 0 }}>Caminho do caixa</h3>
        <ul className="lista-simples">
          <li>🔓 Aberto por <b>{nomes.nomeCompleto(cx.aberto_por)}</b> em {fmtDataHora(cx.aberto_em)}</li>
          {cx.fechado_em && <li>🔒 Fechado por <b>{nomes.nomeCompleto(cx.fechado_por)}</b> em {fmtDataHora(cx.fechado_em)}{cx.obs_fechamento ? ` — ${cx.obs_fechamento}` : ""}</li>}
          {cx.conferido_em && <li>✔️ Conferido por <b>{nomes.nomeCompleto(cx.conferido_por)}</b> em {fmtDataHora(cx.conferido_em)}{cx.obs_conferencia ? ` — ${cx.obs_conferencia}` : ""}</li>}
          {cx.aprovado_em && <li>✅ Aprovado por <b>{nomes.nomeCompleto(cx.aprovado_por)}</b> em {fmtDataHora(cx.aprovado_em)}{cx.obs_aprovacao ? ` — ${cx.obs_aprovacao}` : ""}</li>}
          {cx.devolvido_em && <li>↩️ Última devolução: {nomes.nomeCompleto(cx.devolvido_por)} em {fmtDataHora(cx.devolvido_em)} — {cx.motivo_devolucao}</li>}
        </ul>
      </div>

      {modal === "receber" && <NovoAtendimento caixaId={cx.id} medicos={nomes.medicos} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "cortesia" && <NovoAtendimento cortesia caixaId={cx.id} medicos={nomes.medicos} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "saida" && <NovaSaida caixaId={cx.id} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "fechar" && <FecharCaixa cx={cx} esperado={esperadoDinheiro} porForma={porForma} faltaReceber={faltaReceber} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {(modal === "conferir" || modal === "aprovar" || modal === "devolver") && (
        <Decisao tipo={modal} cx={cx} souQuemFechou={!!eu && cx.fechado_por === eu.id} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />
      )}
      {pagarAt && <ReceberSaldo caixaId={cx.id} at={pagarAt} aoFechar={() => setPagarAt(null)} aoSalvar={() => { setPagarAt(null); recarregar(); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ linhas de pagamento
interface LinhaPag { forma: Forma; valor: string; parcelas: string; pagador: string }
const linhaVazia = (valor = ""): LinhaPag => ({ forma: "pix", valor, parcelas: "2", pagador: "" });

function LinhasPagamento({ linhas, setLinhas }: { linhas: LinhaPag[]; setLinhas: (l: LinhaPag[]) => void }) {
  const muda = (i: number, k: keyof LinhaPag, v: string) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="inteiro">
      {linhas.map((l, i) => (
        <div key={i} className="grade g4" style={{ alignItems: "end", marginBottom: 6 }}>
          <Campo rotulo={i === 0 ? "Forma de pagamento" : "Outra forma"}>
            <select value={l.forma} onChange={(e) => muda(i, "forma", e.target.value)}>
              {ORDEM_FORMAS.map((f) => <option key={f} value={f}>{FORMAS_CAIXA[f]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor pago (R$)"><input inputMode="decimal" value={l.valor} onChange={(e) => muda(i, "valor", e.target.value)} /></Campo>
          {l.forma === "credito_parcelado" ? (
            <Campo rotulo="Parcelas">
              <select value={l.parcelas} onChange={(e) => muda(i, "parcelas", e.target.value)}>{Array.from({ length: 23 }, (_, k) => k + 2).map((n) => <option key={n} value={n}>{n}x</option>)}</select>
            </Campo>
          ) : l.forma === "pix" ? (
            <Campo rotulo="Quem pagou o PIX"><input value={l.pagador} onChange={(e) => muda(i, "pagador", e.target.value)} placeholder="nome no extrato" /></Campo>
          ) : <div />}
          <div>{linhas.length > 1 && <button className="mini" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>Remover</button>}</div>
        </div>
      ))}
      <button className="mini" onClick={() => setLinhas([...linhas, linhaVazia()])}>➕ Dividir em outra forma</button>
    </div>
  );
}

function validarLinhas(linhas: LinhaPag[]): { erro?: string; pags: { forma: Forma; valor: number; parcelas: number; pagador: string | null }[] } {
  const pags = [];
  for (const l of linhas) {
    if (!l.valor.trim()) continue;
    const v = lerValor(l.valor);
    if (v === null || v <= 0) return { erro: "Valor pago inválido.", pags: [] };
    pags.push({ forma: l.forma, valor: v, parcelas: l.forma === "credito_parcelado" ? Number(l.parcelas) : 1, pagador: l.forma === "pix" ? l.pagador.trim() || null : null });
  }
  return { pags };
}

async function gravarPagamentos(caixaId: string, atendimentoId: string, pags: ReturnType<typeof validarLinhas>["pags"]) {
  if (!pags.length) return;
  const { error } = await supabase.from("caixa_pagamentos").insert(pags.map((p) => ({ ...p, caixa_id: caixaId, atendimento_id: atendimentoId })));
  if (error) throw error;
}

// ------------------------------------------------------------------ modais
function NovoAtendimento({ caixaId, medicos, cortesia, aoFechar, aoSalvar }: {
  caixaId: string; medicos: { id: string; nome: string }[]; cortesia?: boolean; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [f, setF] = useState({ paciente: "", medico: "", valor: "", motivo: cortesia ? "Retorno" : "", autorizou: "", obs: "" });
  // tipos e itens marcados (pode marcar vários: ex. tonometria + mapeamento + microscopia no mesmo paciente)
  const [tipos, setTipos] = useState<TipoRecebimento[]>(["Consulta"]);
  const [itens, setItens] = useState<string[]>(cortesia ? ["Retorno"] : []);
  const [outros, setOutros] = useState("");
  const descricao = [
    ...TIPOS_RECEBIMENTO.filter((t) => tipos.includes(t)).map((t) => {
      const marcados = DETALHES[t].filter((d) => itens.includes(d));
      return marcados.length ? `${t} (${marcados.join(", ")})` : t;
    }),
    ...(outros.trim() ? [outros.trim()] : []),
  ].join(" + ");
  function alternaTipo(t: TipoRecebimento) {
    if (tipos.includes(t)) {
      if (tipos.length === 1) return; // pelo menos um tipo
      setTipos(tipos.filter((x) => x !== t));
      setItens(itens.filter((i) => !DETALHES[t].includes(i)));
    } else setTipos([...tipos, t]);
  }
  const alternaItem = (i: string) => setItens(itens.includes(i) ? itens.filter((x) => x !== i) : [...itens, i]);
  const [linhas, setLinhas] = useState<LinhaPag[]>([linhaVazia()]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const valor = lerValor(f.valor) ?? 0;
  const { pags } = validarLinhas(linhas);
  const pago = n2(pags.reduce((s, p) => s + p.valor, 0));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  // ao digitar o valor do atendimento, preenche o valor da 1ª forma (se ainda vazio ou igual ao anterior)
  function mudaValor(v: string) {
    const antigo = f.valor;
    setF({ ...f, valor: v });
    if (linhas.length === 1 && (!linhas[0].valor || linhas[0].valor === antigo)) setLinhas([{ ...linhas[0], valor: v }]);
  }

  async function salvar() {
    setErro("");
    if (f.paciente.trim().length < 2) return setErro("Informe o nome do paciente.");
    if (cortesia && !f.motivo.trim()) return setErro("Informe o motivo da cortesia.");
    if (!cortesia) {
      if (lerValor(f.valor) === null || valor <= 0) return setErro("Informe o valor do atendimento.");
      const v = validarLinhas(linhas);
      if (v.erro) return setErro(v.erro);
      if (pago > valor) return setErro("O valor pago está maior que o valor do atendimento.");
    }
    setSalvando(true);
    try {
      const r = await supabase.from("caixa_atendimentos").insert({
        caixa_id: caixaId, paciente_nome: f.paciente.trim(), medico_id: f.medico || null, descricao,
        valor: cortesia ? 0 : valor, cortesia: !!cortesia, motivo_cortesia: cortesia ? f.motivo.trim() : null,
        cortesia_autorizada_por: cortesia ? f.autorizou.trim() || null : null, observacao: f.obs.trim() || null,
      }).select("id").single();
      if (r.error) throw r.error;
      if (!cortesia) {
        try { await gravarPagamentos(caixaId, (r.data as { id: string }).id, pags); }
        catch (e) { setSalvando(false); return setErro("O atendimento foi lançado, mas o pagamento não: " + msgErro(e) + " — use o botão “Receber” na lista."); }
      }
      aoSalvar();
    } catch (e) { setErro(msgErro(e)); setSalvando(false); }
  }

  return (
    <Modal largo titulo={cortesia ? "Cortesia (atendimento sem cobrança)" : "Novo recebimento"} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Paciente (nome)" className="inteiro"><input value={f.paciente} onChange={set("paciente")} autoFocus /></Campo>
        <Campo rotulo="Médico">
          <select value={f.medico} onChange={set("medico")}><option value="">—</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
        </Campo>
        <Campo rotulo="O que foi feito (pode marcar mais de um)">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TIPOS_RECEBIMENTO.map((t) => (
              <button key={t} type="button" className={tipos.includes(t) ? "primario" : ""} onClick={() => alternaTipo(t)}>
                {tipos.includes(t) ? "✓ " : ""}{t}
              </button>
            ))}
          </div>
        </Campo>
        <div className="inteiro grade" style={{ gap: 8 }}>
          {TIPOS_RECEBIMENTO.filter((t) => tipos.includes(t)).map((t) => (
            <div key={t}>
              <div className="muted pequeno" style={{ marginBottom: 4 }}>
                {t === "Consulta" ? "Qual consulta?" : t === "Exame" ? "Quais exames? (marque todos que o paciente fez)" : "Quais procedimentos?"}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DETALHES[t].map((d) => (
                  <button key={d} type="button" className={"mini-l" + (itens.includes(d) ? " primario" : "")} onClick={() => alternaItem(d)}>
                    {itens.includes(d) ? "✓ " : ""}{d}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Campo rotulo="Outro (se não estiver na lista — opcional)"><input value={outros} onChange={(e) => setOutros(e.target.value)} placeholder="Ex.: Gonioscopia" /></Campo>
          <div className="pequeno">Vai aparecer no caixa como: <b>{descricao}</b></div>
        </div>
        {cortesia ? (
          <>
            <Campo rotulo="Motivo da cortesia"><input value={f.motivo} onChange={set("motivo")} placeholder="Ex.: retorno, funcionário, autorização do médico" /></Campo>
            <Campo rotulo="Quem autorizou"><input value={f.autorizou} onChange={set("autorizou")} /></Campo>
          </>
        ) : (
          <>
            <Campo rotulo="Valor do atendimento (R$)"><input inputMode="decimal" value={f.valor} onChange={(e) => mudaValor(e.target.value)} /></Campo>
            <LinhasPagamento linhas={linhas} setLinhas={setLinhas} />
            <div className="inteiro">
              Pago agora: <b>{fmtMoeda(pago)}</b>
              {valor > 0 && pago < valor && <> · <b style={{ color: "#c62828" }}>falta receber {fmtMoeda(n2(valor - pago))}</b> (fica pendente)</>}
              {valor > 0 && pago > valor && <> · <b style={{ color: "#c62828" }}>pago maior que o valor!</b></>}
            </div>
          </>
        )}
        <Campo rotulo="Observação (opcional)" className="inteiro"><input value={f.obs} onChange={set("obs")} /></Campo>
      </div>
    </Modal>
  );
}

function ReceberSaldo({ caixaId, at, aoFechar, aoSalvar }: { caixaId: string; at: Atendimento; aoFechar: () => void; aoSalvar: () => void }) {
  const saldo = saldoDe(at);
  const [linhas, setLinhas] = useState<LinhaPag[]>([linhaVazia(String(saldo).replace(".", ","))]);
  const [erro, setErro] = useState("");
  async function salvar() {
    setErro("");
    const v = validarLinhas(linhas);
    if (v.erro) return setErro(v.erro);
    if (!v.pags.length) return setErro("Informe o valor recebido.");
    try { await gravarPagamentos(caixaId, at.id, v.pags); aoSalvar(); } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal largo titulo={`Receber de ${at.paciente_nome}`} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Confirmar recebimento</button></>}>
      <Aviso>{erro}</Aviso>
      <p>{at.descricao ?? "Atendimento"} de {fmtData(at.criado_em)} · valor {fmtMoeda(at.valor)} · já pago {fmtMoeda(pagoDe(at))} · <b>falta {fmtMoeda(saldo)}</b></p>
      <div className="grade g2"><LinhasPagamento linhas={linhas} setLinhas={setLinhas} /></div>
    </Modal>
  );
}

function NovaSaida({ caixaId, aoFechar, aoSalvar }: { caixaId: string; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState({ valor: "", motivo: "", autorizou: "" });
  const [erro, setErro] = useState("");
  async function salvar() {
    const v = lerValor(f.valor);
    if (v === null || v <= 0) return setErro("Informe o valor da saída.");
    if (f.motivo.trim().length < 2) return setErro("Informe o motivo.");
    const { error } = await supabase.from("caixa_saidas").insert({ caixa_id: caixaId, valor: v, motivo: f.motivo.trim(), autorizado_por: f.autorizou.trim() || null });
    if (error) setErro(msgErro(error)); else aoSalvar();
  }
  return (
    <Modal titulo="Saída / sangria do caixa" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Valor (R$)"><input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} autoFocus /></Campo>
        <Campo rotulo="Quem autorizou"><input value={f.autorizou} onChange={(e) => setF({ ...f, autorizou: e.target.value })} /></Campo>
        <Campo rotulo="Motivo" className="inteiro"><input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Ex.: compra de material, sangria para o cofre" /></Campo>
      </div>
    </Modal>
  );
}

function FecharCaixa({ cx, esperado, porForma, faltaReceber, aoFechar, aoSalvar }: {
  cx: CaixaRow; esperado: number; porForma: Record<Forma, number>; faltaReceber: number; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const v = lerValor(contado);
  async function salvar() {
    if (v === null || v < 0) return setErro("Digite quanto dinheiro você contou na gaveta.");
    if (!window.confirm("Fechar o caixa? Depois de fechado, ninguém consegue lançar nem alterar (só se for devolvido para correção).")) return;
    try { await rpc("caixa_fechar", { p_caixa: cx.id, p_contado: v, p_obs: obs }); aoSalvar(); } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo="Fechar o caixa" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Voltar</button><button className="primario" onClick={salvar}>🔒 Fechar caixa</button></>}>
      <Aviso>{erro}</Aviso>
      {faltaReceber > 0 && <Aviso tipo="alerta">Há {fmtMoeda(faltaReceber)} a receber de pacientes deste caixa. Eles continuam pendentes e podem ser recebidos em outro dia.</Aviso>}
      <table className="tabela" style={{ marginBottom: 12 }}>
        <tbody>
          {ORDEM_FORMAS.map((f) => <tr key={f}><td>{FORMAS_CAIXA[f]}</td><td style={num}>{fmtMoeda(porForma[f])}</td></tr>)}
          <tr><td><b>Dinheiro que deve estar na gaveta</b><div className="pequeno muted">fundo {fmtMoeda(cx.fundo_troco)} + dinheiro − saídas</div></td><td style={num}><b>{fmtMoeda(esperado)}</b></td></tr>
        </tbody>
      </table>
      <Campo rotulo="Dinheiro contado na gaveta (R$)"><input inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} autoFocus /></Campo>
      {v !== null && <p>Diferença: <Diferenca v={n2(v - esperado)} /></p>}
      <Campo rotulo="Observação (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: explicação de alguma diferença" /></Campo>
      <p className="pequeno muted">Cartões: confira com o relatório da maquininha. PIX: confira com o extrato do banco.</p>
    </Modal>
  );
}

function Decisao({ tipo, cx, souQuemFechou, aoFechar, aoSalvar }: {
  tipo: "conferir" | "aprovar" | "devolver"; cx: CaixaRow; souQuemFechou: boolean; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const titulo = { conferir: "Conferir o caixa", aprovar: "Aprovar o caixa", devolver: "Devolver para correção" }[tipo];
  async function salvar() {
    setErro("");
    try {
      if (tipo === "devolver") {
        if (!obs.trim()) return setErro("Escreva o que precisa ser corrigido.");
        await rpc("caixa_devolver", { p_caixa: cx.id, p_motivo: obs });
      } else await rpc(tipo === "conferir" ? "caixa_conferir" : "caixa_aprovar", { p_caixa: cx.id, p_obs: obs });
      aoSalvar();
    } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Voltar</button><button className="primario" onClick={salvar}>{titulo}</button></>}>
      <Aviso>{erro}</Aviso>
      {tipo === "conferir" && souQuemFechou && <Aviso tipo="alerta">Foi você quem fechou este caixa: outra pessoa precisa conferir.</Aviso>}
      {tipo === "conferir" && <p>Confira o dinheiro entregue, o relatório das maquininhas e o extrato do PIX com os totais desta tela.</p>}
      {tipo === "aprovar" && <p>Aprovação final do caixa de {fmtData(cx.data)}.</p>}
      {tipo === "devolver" && <p>O caixa volta a ficar <b>aberto</b> para a recepção corrigir e fechar de novo. Só dá para devolver se não houver outro caixa aberto.</p>}
      <Campo rotulo={tipo === "devolver" ? "O que precisa ser corrigido" : "Observação (opcional)"}><input value={obs} onChange={(e) => setObs(e.target.value)} autoFocus /></Campo>
    </Modal>
  );
}
