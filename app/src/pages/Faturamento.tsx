import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo, BuscaPaciente, type PacienteResumo } from "../components/ui";
import { listaConvenios, listaPlanos, listaProcedimentos, nomePor, type Convenio, type Plano, type Procedimento } from "../lib/dados";
import {
  STATUS_CONTA, STATUS_LOTE, TIPO_GUIA, FORMAS_PAGAMENTO, fmtData, fmtMoeda, fmtCompetencia, isoDia, nomeExibicao, numOuNulo,
} from "../lib/util";

// ------------------------------------------------------------------ tipos
interface Item {
  id: string; conta_id: string; procedimento_id: string | null; exame_realizado_id: string | null; tabela: string; codigo: string | null;
  descricao: string; data_execucao: string; quantidade: number; valor_unitario: number | null; valor_total: number; olho: string | null;
  glosa_valor: number; glosa_codigo: string | null; glosa_motivo: string | null; recurso_texto: string | null;
  recurso_enviado_em: string | null; recurso_valor_recuperado: number | null;
}
export interface Conta {
  id: string; paciente_id: string; agendamento_id: string | null; data_atendimento: string; convenio_id: string | null; plano_id: string | null;
  tipo_guia: string; numero_guia_prestador: string; numero_guia_operadora: string | null; senha_autorizacao: string | null;
  data_autorizacao: string | null; validade_senha: string | null; carteirinha: string | null; validade_carteirinha: string | null;
  profissional_id: string | null; solicitante_id: string | null; indicacao_clinica: string | null; cid10: string | null;
  status: string; lote_id: string | null; valor_total: number; valor_glosado: number; valor_pago: number | null;
  forma_pagamento: string | null; parcelas: number | null; recebido_em: string | null; motivo_cancelamento: string | null; observacoes: string | null;
  arquivada?: boolean; legado?: Record<string, unknown> | null;
  pacientes?: { nome: string; nome_social: string | null; numero_prontuario: number };
  conta_itens?: { valor_unitario: number | null }[];
}
interface Lote {
  id: string; numero: number; convenio_id: string; competencia: string; status: string; enviado_em: string | null; protocolo: string | null;
  previsao_pagamento: string | null; pago_em: string | null; valor_pago: number | null; observacoes: string | null; criado_em: string;
  arquivado?: boolean; numero_tiss?: number | null;
}

const SEL_CONTA = "*, pacientes(nome, nome_social, numero_prontuario), conta_itens(valor_unitario)";

/** Pendências que impedem marcar a conta como pronta */
export function pendencias(c: Conta, conv?: Convenio) {
  const p: string[] = [];
  const itens = c.conta_itens ?? [];
  if (itens.length === 0) p.push("sem itens");
  if (itens.some((i) => i.valor_unitario === null)) p.push("item sem preço");
  if (c.convenio_id) {
    if (!c.carteirinha) p.push("sem carteirinha");
    if (conv?.exige_senha && !c.senha_autorizacao) p.push("sem senha");
    if (c.validade_carteirinha && c.validade_carteirinha < c.data_atendimento) p.push("carteirinha vencida");
  }
  return p;
}

function primeiroDiaMes(d = new Date()) { return isoDia(new Date(d.getFullYear(), d.getMonth(), 1)); }

// ================================================================== tela principal
export default function Faturamento() {
  const { pode } = useAuth();
  const fat = pode("faturamento", "admin");
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") ?? "contas";
  const base = useCarregar(async () => {
    const [convenios, profs] = await Promise.all([
      listaConvenios(),
      supabase.from("profissionais").select("id, nome").then((r) => ok(r) as { id: string; nome: string }[]),
    ]);
    return { convenios, profs };
  }, []);

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Faturamento</h1>
          <p className="sub" style={{ margin: 0 }}>Contas dos atendimentos → conferência → lote por convênio → envio → pagamento e glosas</p>
        </div>
      </div>
      <Aviso>{base.erro}</Aviso>
      <div className="abas">
        <button className={aba === "contas" ? "ativa" : ""} onClick={() => setParams({ aba: "contas" })}>Contas</button>
        {fat && <button className={aba === "lotes" ? "ativa" : ""} onClick={() => setParams({ aba: "lotes" })}>Lotes</button>}
        {fat && <button className={aba === "glosas" ? "ativa" : ""} onClick={() => setParams({ aba: "glosas" })}>Glosas e recursos</button>}
        {fat && <button className={aba === "resumo" ? "ativa" : ""} onClick={() => setParams({ aba: "resumo" })}>Produção</button>}
      </div>
      {base.dados && aba === "contas" && <ListaContas convenios={base.dados.convenios} podeLote={fat} />}
      {base.dados && aba === "lotes" && fat && <ListaLotes convenios={base.dados.convenios} />}
      {base.dados && aba === "glosas" && fat && <ListaGlosas convenios={base.dados.convenios} />}
      {base.dados && aba === "resumo" && fat && <Producao convenios={base.dados.convenios} profs={base.dados.profs} />}
    </div>
  );
}

// ------------------------------------------------------------------ contas
function ListaContas({ convenios, podeLote }: { convenios: Convenio[]; podeLote: boolean }) {
  const nav = useNavigate();
  const [f, setF] = useState({ status: "abertas", convenio: "todos", de: primeiroDiaMes(), ate: isoDia(new Date()) });
  const [sel, setSel] = useState<string[]>([]);
  const [nova, setNova] = useState(false);
  const [erro, setErro] = useState("");

  const { dados, erro: e1, carregando, recarregar } = useCarregar(async () => {
    let q = supabase.from("contas").select(SEL_CONTA).gte("data_atendimento", f.de).lte("data_atendimento", f.ate)
      .order("data_atendimento", { ascending: false }).limit(500);
    if (f.status === "abertas") q = q.in("status", ["aberta", "pronta"]);
    else if (f.status !== "todas") q = q.eq("status", f.status);
    if (f.convenio === "particular") q = q.is("convenio_id", null);
    else if (f.convenio !== "todos") q = q.eq("convenio_id", f.convenio);
    return ok(await q) as Conta[];
  }, [f.status, f.convenio, f.de, f.ate]);

  const lista = dados ?? [];
  const total = lista.reduce((s, c) => s + Number(c.valor_total), 0);
  const selecionadas = lista.filter((c) => sel.includes(c.id));
  const convSel = [...new Set(selecionadas.map((c) => c.convenio_id))];

  async function criarLote() {
    setErro("");
    if (convSel.length !== 1 || !convSel[0]) return setErro("Escolha contas prontas de um único convênio.");
    if (selecionadas.some((c) => c.status !== "pronta" || c.lote_id)) return setErro("Só contas \"Pronta p/ lote\" e sem lote podem entrar num lote.");
    const competencia = primeiroDiaMes(new Date(selecionadas.map((c) => c.data_atendimento).sort()[0] + "T12:00:00"));
    const { data, error } = await supabase.from("lotes").insert({ convenio_id: convSel[0], competencia }).select("id").single();
    if (error) return setErro(msgErro(error));
    const r = await supabase.from("contas").update({ lote_id: (data as { id: string }).id }).in("id", sel);
    if (r.error) return setErro(msgErro(r.error));
    nav(`/faturamento/lote/${(data as { id: string }).id}`);
  }

  return (
    <div className="painel grade">
      <div className="linha">
        <select style={{ width: 190 }} value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setSel([]); }}>
          <option value="abertas">Em conferência e prontas</option>
          {Object.entries(STATUS_CONTA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          <option value="todas">Todas</option>
        </select>
        <select style={{ width: 200 }} value={f.convenio} onChange={(e) => { setF({ ...f, convenio: e.target.value }); setSel([]); }}>
          <option value="todos">Todos os convênios</option>
          <option value="particular">Particular</option>
          {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label className="linha pequeno muted">de <input type="date" style={{ width: 150 }} value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></label>
        <label className="linha pequeno muted">até <input type="date" style={{ width: 150 }} value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></label>
        <span style={{ marginLeft: "auto" }} />
        <button onClick={() => setNova(true)}>➕ Conta avulsa</button>
        {podeLote && <button className="primario" disabled={sel.length === 0} onClick={criarLote}>📦 Criar lote com {sel.length || ""} selecionada(s)</button>}
      </div>
      <Aviso>{erro || e1}</Aviso>
      {carregando && !dados ? <Carregando /> : (
        <div className="rolagem">
          <table className="tabela">
            <thead><tr>{podeLote && <th></th>}<th>Data</th><th>Paciente</th><th>Convênio</th><th>Guia</th><th>Pendências</th><th style={{ textAlign: "right" }}>Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {lista.map((c) => {
                const conv = convenios.find((x) => x.id === c.convenio_id);
                const pend = c.status === "aberta" ? pendencias(c, conv) : [];
                const podeSel = c.status === "pronta" && !c.lote_id && !!c.convenio_id;
                return (
                  <tr key={c.id} className="clicavel" onClick={() => nav(`/faturamento/conta/${c.id}`)}>
                    {podeLote && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" disabled={!podeSel} checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} aria-label="Selecionar para lote" />
                      </td>
                    )}
                    <td>{fmtData(c.data_atendimento)}</td>
                    <td><b>{nomeExibicao(c.pacientes!)}</b><div className="muted pequeno">Pront. {c.pacientes!.numero_prontuario}</div></td>
                    <td>{conv?.nome ?? "Particular"}</td>
                    <td>{TIPO_GUIA[c.tipo_guia]}<div className="muted pequeno">nº {c.numero_guia_prestador}{c.lote_id && " · em lote"}</div></td>
                    <td>{pend.map((p) => <Etiqueta key={p} cor="amarelo">{p}</Etiqueta>)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMoeda(c.valor_total)}</td>
                    <td><Etiqueta cor={STATUS_CONTA[c.status].cor}>{STATUS_CONTA[c.status].rotulo}</Etiqueta></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length === 0 && <div className="vazio">Nenhuma conta neste filtro. As contas aparecem sozinhas quando o paciente chega ou faz um exame.</div>}
          {lista.length > 0 && <p className="muted pequeno" style={{ textAlign: "right" }}>{lista.length} conta(s) · total {fmtMoeda(total)}</p>}
        </div>
      )}
      {nova && <NovaConta convenios={convenios} aoFechar={() => setNova(false)} aoCriar={(id) => { setNova(false); recarregar(); nav(`/faturamento/conta/${id}`); }} />}
    </div>
  );
}

function NovaConta({ convenios, aoFechar, aoCriar }: { convenios: Convenio[]; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [pac, setPac] = useState<PacienteResumo | null>(null);
  const [f, setF] = useState({ convenio_id: "", tipo_guia: "sadt", data_atendimento: isoDia(new Date()) });
  const [erro, setErro] = useState("");
  useEffect(() => { if (pac) setF((x) => ({ ...x, convenio_id: pac.convenio_id ?? "" })); }, [pac]);
  async function criar() {
    setErro("");
    if (!pac) return setErro("Escolha o paciente.");
    const { data: p } = await supabase.from("pacientes").select("convenio_id, plano_id, convenio_carteirinha, convenio_validade").eq("id", pac.id).single();
    const mesmo = p && f.convenio_id && p.convenio_id === f.convenio_id;
    const { data, error } = await supabase.from("contas").insert({
      paciente_id: pac.id, convenio_id: f.convenio_id || null, tipo_guia: f.convenio_id ? f.tipo_guia : "particular",
      data_atendimento: f.data_atendimento, plano_id: mesmo ? p!.plano_id : null,
      carteirinha: mesmo ? p!.convenio_carteirinha : null, validade_carteirinha: mesmo ? p!.convenio_validade : null,
    }).select("id").single();
    if (error) return setErro(msgErro(error));
    aoCriar((data as { id: string }).id);
  }
  return (
    <Modal titulo="Nova conta avulsa" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={criar}>Criar conta</button></>}>
      <Aviso>{erro}</Aviso>
      <p className="muted pequeno" style={{ marginTop: 0 }}>Use para procedimentos e cobranças que não vieram da agenda nem de um exame.</p>
      <div className="grade">
        {pac ? <div className="secao linha entre"><b>{nomeExibicao(pac)}</b><button className="sutil" onClick={() => setPac(null)}>Trocar</button></div>
          : <Campo rotulo="Paciente"><BuscaPaciente autoFocus aoEscolher={setPac} /></Campo>}
        <div className="grade g3">
          <Campo rotulo="Convênio">
            <select value={f.convenio_id} onChange={(e) => setF({ ...f, convenio_id: e.target.value })}>
              <option value="">Particular</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          {f.convenio_id && (
            <Campo rotulo="Tipo de guia">
              <select value={f.tipo_guia} onChange={(e) => setF({ ...f, tipo_guia: e.target.value })}>
                <option value="consulta">Guia de Consulta</option><option value="sadt">Guia SP/SADT</option>
              </select>
            </Campo>
          )}
          <Campo rotulo="Data do atendimento"><input type="date" value={f.data_atendimento} onChange={(e) => setF({ ...f, data_atendimento: e.target.value })} /></Campo>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ detalhe da conta
export function ContaDetalhe() {
  const { id } = useParams();
  const { pode } = useAuth();
  const fat = pode("faturamento", "admin");
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [modal, setModal] = useState<"" | "item" | "receber" | "cancelar">("");
  const [cab, setCab] = useState<Record<string, string>>({});

  const base = useCarregar(async () => {
    const [convenios, planos, procs, profs] = await Promise.all([
      listaConvenios(), listaPlanos(), listaProcedimentos(),
      supabase.from("profissionais").select("id, nome, funcao, ativo").then((r) => ok(r) as { id: string; nome: string; funcao: string; ativo: boolean }[]),
    ]);
    return { convenios, planos, procs, profs };
  }, []);
  const { dados, erro: e1, carregando, recarregar } = useCarregar(async () => {
    const c = ok(await supabase.from("contas").select(SEL_CONTA).eq("id", id!).single()) as Conta;
    const itens = ok(await supabase.from("conta_itens").select("*").eq("conta_id", id!).order("criado_em")) as Item[];
    // repasse ao médico já lançado para esta conta (só faturamento/admin enxergam)
    const repasse = !c.convenio_id && c.status === "paga"
      ? ((await supabase.from("repasses").select("id, numero").eq("conta_id", c.id).neq("status", "cancelado").maybeSingle()).data as { id: string; numero: number } | null)
      : null;
    const lote = c.lote_id ? (ok(await supabase.from("lotes").select("id, numero, status").eq("id", c.lote_id).single()) as { id: string; numero: number; status: string }) : null;
    return { c, itens, lote, repasse };
  }, [id]);

  const CAMPOS_CAB = ["convenio_id", "plano_id", "tipo_guia", "data_atendimento", "carteirinha", "validade_carteirinha", "senha_autorizacao",
    "data_autorizacao", "validade_senha", "numero_guia_operadora", "profissional_id", "solicitante_id", "indicacao_clinica", "cid10", "observacoes"] as const;
  useEffect(() => {
    if (dados) setCab(Object.fromEntries(CAMPOS_CAB.map((k) => [k, (dados.c[k] as string | null) ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  if (carregando && !dados) return <Carregando />;
  if (!dados || !base.dados) return <Aviso>{e1 || base.erro}</Aviso>;
  const { c, itens, lote, repasse } = dados;
  const { convenios, planos, procs, profs } = base.dados;
  const conv = convenios.find((x) => x.id === c.convenio_id);
  const arquivada = !!c.arquivada;
  const editavel = ["aberta", "pronta"].includes(c.status) && !c.lote_id && !arquivada;
  // particular já paga também pode ser cancelada (estorno/erro de lançamento), desde que não tenha repasse ativo
  const pagaParticular = c.status === "paga" && !c.convenio_id && !c.lote_id && !arquivada;
  const podeCancelar = editavel || pagaParticular;
  const pend = pendencias({ ...c, conta_itens: itens }, conv);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setCab({ ...cab, [k]: e.target.value });

  async function salvarCab() {
    setErro(""); setOkMsg("");
    const v: Record<string, unknown> = {};
    for (const k of CAMPOS_CAB) v[k] = cab[k]?.trim() ? cab[k].trim() : null;
    if (!v.convenio_id) v.plano_id = null;
    const { error } = await supabase.from("contas").update(v).eq("id", c.id);
    if (error) return setErro(msgErro(error));
    setOkMsg("Dados da guia salvos."); recarregar();
  }
  async function mudarStatus(status: string, extra: Record<string, unknown> = {}) {
    setErro(""); setOkMsg("");
    const { error } = await supabase.from("contas").update({ status, ...extra }).eq("id", c.id);
    if (error) return setErro(msgErro(error));
    recarregar();
  }
  async function removerItem(i: Item) {
    if (!confirm(`Remover "${i.descricao}" da conta?`)) return;
    const { error } = await supabase.from("conta_itens").delete().eq("id", i.id);
    if (error) setErro(msgErro(error));
    recarregar();
  }
  async function salvarItem(i: Item, campos: Record<string, unknown>) {
    const { error } = await supabase.from("conta_itens").update(campos).eq("id", i.id);
    if (error) setErro(msgErro(error));
    recarregar();
  }

  const medicos = profs.filter((p) => p.funcao === "medico");
  const planosConv = planos.filter((p) => p.convenio_id === cab.convenio_id);
  const comGlosa = ["faturada", "paga", "glosada"].includes(c.status);
  async function desarquivar() {
    if (!confirm("Desarquivar esta conta antiga do Micrologos para poder alterá-la?")) return;
    setErro(""); setOkMsg("");
    const { error } = await supabase.from("contas").update({ arquivada: false }).eq("id", c.id);
    if (error) return setErro(msgErro(error));
    setOkMsg("Conta desarquivada."); recarregar();
  }
  const leg = (c.legado ?? {}) as Record<string, unknown>;

  return (
    <div>
      <div className="cabecalho">
        <div>
          <div className="linha"><h1 style={{ margin: 0 }}>{TIPO_GUIA[c.tipo_guia]} nº {c.numero_guia_prestador}</h1><Etiqueta cor={STATUS_CONTA[c.status].cor}>{STATUS_CONTA[c.status].rotulo}</Etiqueta></div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            <Link to={`/pacientes/${c.paciente_id}`}>{nomeExibicao(c.pacientes!)}</Link> · Pront. {c.pacientes!.numero_prontuario} · {fmtData(c.data_atendimento)} · {conv?.nome ?? "Particular"}
            {lote && <> · <Link to={`/faturamento/lote/${lote.id}`}>Lote {lote.numero}</Link></>}
          </p>
        </div>
        <div className="linha">
          {c.convenio_id && <Link className="botao" to={`/imprimir/guia/${c.id}`} target="_blank">🖨️ Imprimir guia</Link>}
          {!c.convenio_id && c.status === "paga" && <Link className="botao" to={`/imprimir/recibo/${c.id}`} target="_blank">🖨️ Recibo</Link>}
          {!c.convenio_id && c.status === "paga" && fat && (repasse
            ? <Link className="botao" to={`/repasse/${repasse.id}`}>💰 Repasse nº {repasse.numero}</Link>
            : <Link className="botao" to={`/repasse?conta=${c.id}`}>💰 Calcular repasse ao médico</Link>)}
          {c.status === "aberta" && c.convenio_id && <button className="primario" disabled={pend.length > 0} title={pend.join(", ")} onClick={() => mudarStatus("pronta")}>✅ Conferida (pronta p/ lote)</button>}
          {c.status === "pronta" && !c.lote_id && <button onClick={() => mudarStatus("aberta")}>↩️ Voltar para conferência</button>}
          {c.status === "aberta" && !c.convenio_id && <button className="primario" disabled={itens.length === 0} onClick={() => setModal("receber")}>💵 Receber</button>}
          {podeCancelar && (
            <button className="perigo" disabled={pagaParticular && !!repasse}
              title={pagaParticular && repasse ? `Cancele antes o repasse nº ${repasse.numero}` : undefined}
              onClick={() => setModal("cancelar")}>Cancelar conta</button>
          )}
        </div>
      </div>
      <Aviso>{erro || e1}</Aviso>
      <Aviso tipo="ok">{okMsg}</Aviso>
      {arquivada && (
        <Aviso tipo="info">
          Conta arquivada: histórico do Micrologos (antes de 2021), só para consulta e relatórios.
          {fat && <> <button className="mini" onClick={desarquivar}>Desarquivar para alterar</button></>}
        </Aviso>
      )}
      {leg.origem === "Micrologos" && (
        <p className="muted pequeno" style={{ margin: "0 0 10px" }}>
          Veio do Micrologos: conta nº {String(leg.id_conta)}{leg.id_cobranca ? ` · cobrança nº ${String(leg.id_cobranca)}` : " · sem cobrança"}
          {leg.guia_micrologos ? ` · guia no Micrologos ${String(leg.guia_micrologos)}` : ""}
          {leg.pagamento === "presumido" ? " · pagamento presumido (o Micrologos não registra quando o convênio pagou)" : ""}
        </p>
      )}
      {c.status === "aberta" && pend.length > 0 && <Aviso tipo="alerta">Falta para liberar: {pend.join(", ")}.</Aviso>}
      {c.status === "cancelada" && <Aviso tipo="alerta">Conta cancelada: {c.motivo_cancelamento}</Aviso>}
      {pagaParticular && repasse && <Aviso tipo="info">Para cancelar esta conta, cancele antes o repasse nº {repasse.numero} ao médico.</Aviso>}
      {lote && c.status !== "cancelada" && (
        <Aviso tipo="info">
          Esta conta está no lote {lote.numero}. Para cancelar ou mexer nela, abra o lote e use “Desfazer lote” (só enquanto o
          lote ainda não foi enviado ao convênio). Depois de enviado, ajustes são feitos como glosa/recurso.
        </Aviso>
      )}
      {c.status === "paga" && !c.convenio_id && <Aviso tipo="ok">Recebido {fmtMoeda(c.valor_pago)} em {fmtData(c.recebido_em)} · {FORMAS_PAGAMENTO[c.forma_pagamento ?? ""] ?? ""}{c.parcelas && c.parcelas > 1 ? ` em ${c.parcelas}x` : ""}</Aviso>}

      <div className="painel">
        <h2>Itens</h2>
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Código</th><th>Descrição</th><th>Data</th><th>Qtd.</th><th style={{ textAlign: "right" }}>Valor unit.</th><th style={{ textAlign: "right" }}>Total</th>{comGlosa && <th>Glosa</th>}<th></th></tr></thead>
            <tbody>
              {itens.map((i) => (
                <LinhaItem key={i.id} i={i} editavel={editavel} mostrarGlosa={comGlosa} glosa={comGlosa && fat && !arquivada} aoSalvar={(campos) => salvarItem(i, campos)} aoRemover={() => removerItem(i)} />
              ))}
            </tbody>
          </table>
        </div>
        {itens.length === 0 && <div className="vazio">Nenhum item.</div>}
        <div className="linha entre" style={{ marginTop: 10 }}>
          {editavel ? <button onClick={() => setModal("item")}>➕ Adicionar item</button> : <span />}
          <div style={{ textAlign: "right" }}>
            <div>Total: <b>{fmtMoeda(c.valor_total)}</b></div>
            {Number(c.valor_glosado) > 0 && <div style={{ color: "var(--perigo)" }}>Glosado: {fmtMoeda(c.valor_glosado)}</div>}
            {c.valor_pago !== null && c.convenio_id && <div>Pago: {fmtMoeda(c.valor_pago)}</div>}
          </div>
        </div>
      </div>

      <div className="painel">
        <h2>Dados da guia</h2>
        <fieldset disabled={!editavel} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="grade g4">
            <Campo rotulo="Convênio">
              <select value={cab.convenio_id ?? ""} onChange={(e) => setCab({ ...cab, convenio_id: e.target.value, plano_id: "" })}>
                <option value="">Particular</option>
                {convenios.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </Campo>
            {planosConv.length > 0 && (
              <Campo rotulo="Plano">
                <select value={cab.plano_id ?? ""} onChange={set("plano_id")}><option value="">—</option>{planosConv.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
              </Campo>
            )}
            {cab.convenio_id && (
              <Campo rotulo="Tipo de guia">
                <select value={cab.tipo_guia} onChange={set("tipo_guia")}><option value="consulta">Consulta</option><option value="sadt">SP/SADT</option></select>
              </Campo>
            )}
            <Campo rotulo="Data do atendimento"><input type="date" value={cab.data_atendimento ?? ""} onChange={set("data_atendimento")} /></Campo>
            {cab.convenio_id && (
              <>
                <Campo rotulo="Nº da carteirinha"><input value={cab.carteirinha ?? ""} onChange={set("carteirinha")} /></Campo>
                <Campo rotulo="Validade da carteirinha"><input type="date" value={cab.validade_carteirinha ?? ""} onChange={set("validade_carteirinha")} /></Campo>
                <Campo rotulo={`Senha de autorização${conv?.exige_senha ? " *" : ""}`}><input value={cab.senha_autorizacao ?? ""} onChange={set("senha_autorizacao")} /></Campo>
                <Campo rotulo="Data da autorização"><input type="date" value={cab.data_autorizacao ?? ""} onChange={set("data_autorizacao")} /></Campo>
                <Campo rotulo="Validade da senha"><input type="date" value={cab.validade_senha ?? ""} onChange={set("validade_senha")} /></Campo>
                <Campo rotulo="Nº da guia na operadora"><input value={cab.numero_guia_operadora ?? ""} onChange={set("numero_guia_operadora")} /></Campo>
              </>
            )}
            <Campo rotulo="Médico executante">
              <select value={cab.profissional_id ?? ""} onChange={set("profissional_id")}><option value="">—</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}{!m.ativo && " (inativo)"}</option>)}</select>
            </Campo>
            {cab.tipo_guia === "sadt" && (
              <>
                <Campo rotulo="Médico solicitante">
                  <select value={cab.solicitante_id ?? ""} onChange={set("solicitante_id")}><option value="">—</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
                </Campo>
                <Campo rotulo="CID-10"><input value={cab.cid10 ?? ""} onChange={set("cid10")} /></Campo>
                <Campo rotulo="Indicação clínica" className="span2"><input value={cab.indicacao_clinica ?? ""} onChange={set("indicacao_clinica")} /></Campo>
              </>
            )}
            <Campo rotulo="Observações" className="inteiro"><input value={cab.observacoes ?? ""} onChange={set("observacoes")} /></Campo>
          </div>
          {editavel && <div style={{ marginTop: 12 }}><button className="primario" onClick={salvarCab}>Salvar dados da guia</button></div>}
        </fieldset>
        {conv?.observacoes_faturamento && <Aviso tipo="info">Regras deste convênio: {conv.observacoes_faturamento}</Aviso>}
      </div>

      {modal === "item" && <NovoItem conta={c} procs={procs} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "receber" && <Receber conta={c} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "cancelar" && (
        <Modal titulo="Cancelar conta" aoFechar={() => setModal("")}>
          {pagaParticular && (
            <Aviso tipo="alerta">
              Esta conta já foi <b>recebida</b>. Cancelar aqui não devolve o dinheiro sozinho: se houver devolução ao paciente,
              lance como saída no Caixa.
            </Aviso>
          )}
          <CancelarForm aoConfirmar={(m) => { setModal(""); mudarStatus("cancelada", { motivo_cancelamento: m }); }} />
        </Modal>
      )}
    </div>
  );
}

function CancelarForm({ aoConfirmar }: { aoConfirmar: (motivo: string) => void }) {
  const [m, setM] = useState("");
  return (
    <div className="grade">
      <Campo rotulo="Motivo do cancelamento"><input autoFocus value={m} onChange={(e) => setM(e.target.value)} placeholder="Ex.: atendimento não realizado; cobrança em duplicidade" /></Campo>
      <div><button className="perigo" disabled={!m.trim()} onClick={() => aoConfirmar(m.trim())}>Cancelar conta</button></div>
    </div>
  );
}

function LinhaItem({ i, editavel, mostrarGlosa, glosa, aoSalvar, aoRemover }: { i: Item; editavel: boolean; mostrarGlosa: boolean; glosa: boolean; aoSalvar: (c: Record<string, unknown>) => void; aoRemover: () => void }) {
  const [q, setQ] = useState(String(i.quantidade));
  const [v, setV] = useState(i.valor_unitario === null ? "" : String(i.valor_unitario).replace(".", ","));
  const [g, setG] = useState(false);
  const sujo = q !== String(i.quantidade) || v !== (i.valor_unitario === null ? "" : String(i.valor_unitario).replace(".", ","));
  return (
    <>
      <tr>
        <td className="pequeno">{i.codigo ?? "—"}</td>
        <td>{i.descricao}{i.olho && <span className="muted"> · {i.olho}</span>}{i.exame_realizado_id && <div className="muted pequeno">exame realizado</div>}</td>
        <td>{fmtData(i.data_execucao)}</td>
        <td style={{ width: 80 }}>{editavel ? <input value={q} onChange={(e) => setQ(e.target.value)} /> : Number(i.quantidade)}</td>
        <td style={{ width: 130, textAlign: "right" }}>
          {editavel ? <input value={v} onChange={(e) => setV(e.target.value)} placeholder="sem preço" style={i.valor_unitario === null ? { borderColor: "var(--alerta)" } : undefined} /> : fmtMoeda(i.valor_unitario)}
        </td>
        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMoeda(i.valor_total)}</td>
        {mostrarGlosa && (
          <td>{Number(i.glosa_valor) > 0 ? <span style={{ color: "var(--perigo)" }}>{fmtMoeda(i.glosa_valor)}{i.recurso_valor_recuperado ? ` (recuperado ${fmtMoeda(i.recurso_valor_recuperado)})` : ""}</span> : <span className="muted">—</span>}</td>
        )}
        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {editavel && sujo && <button className="mini primario" onClick={() => aoSalvar({ quantidade: numOuNulo(q) ?? 1, valor_unitario: numOuNulo(v) })}>Salvar</button>}
          {editavel && !i.exame_realizado_id && <button className="sutil mini" onClick={aoRemover}>remover</button>}
          {glosa && <button className="mini" onClick={() => setG(!g)}>{g ? "Fechar" : "Glosa"}</button>}
        </td>
      </tr>
      {g && <tr><td colSpan={8}><EditorGlosa i={i} aoSalvar={(c) => { aoSalvar(c); setG(false); }} /></td></tr>}
    </>
  );
}

function EditorGlosa({ i, aoSalvar }: { i: Item; aoSalvar: (c: Record<string, unknown>) => void }) {
  const [f, setF] = useState({
    glosa_valor: i.glosa_valor ? String(i.glosa_valor).replace(".", ",") : "", glosa_codigo: i.glosa_codigo ?? "", glosa_motivo: i.glosa_motivo ?? "",
    recurso_texto: i.recurso_texto ?? "", recurso_enviado_em: i.recurso_enviado_em ?? "",
    recurso_valor_recuperado: i.recurso_valor_recuperado !== null ? String(i.recurso_valor_recuperado).replace(".", ",") : "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="secao grade g4" style={{ margin: 0 }}>
      <Campo rotulo="Valor glosado"><input value={f.glosa_valor} onChange={set("glosa_valor")} /></Campo>
      <Campo rotulo="Código da glosa (TISS)"><input value={f.glosa_codigo} onChange={set("glosa_codigo")} /></Campo>
      <Campo rotulo="Motivo" className="span2"><input value={f.glosa_motivo} onChange={set("glosa_motivo")} /></Campo>
      <Campo rotulo="Recurso (justificativa)" className="span2"><textarea rows={2} value={f.recurso_texto} onChange={set("recurso_texto")} /></Campo>
      <Campo rotulo="Recurso enviado em"><input type="date" value={f.recurso_enviado_em} onChange={set("recurso_enviado_em")} /></Campo>
      <Campo rotulo="Valor recuperado no recurso"><input value={f.recurso_valor_recuperado} onChange={set("recurso_valor_recuperado")} /></Campo>
      <div><button className="primario mini" onClick={() => aoSalvar({
        glosa_valor: numOuNulo(f.glosa_valor) ?? 0, glosa_codigo: f.glosa_codigo || null, glosa_motivo: f.glosa_motivo || null,
        recurso_texto: f.recurso_texto || null, recurso_enviado_em: f.recurso_enviado_em || null, recurso_valor_recuperado: numOuNulo(f.recurso_valor_recuperado),
      })}>Salvar glosa</button></div>
    </div>
  );
}

function NovoItem({ conta, procs, aoFechar, aoSalvar }: { conta: Conta; procs: Procedimento[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [busca, setBusca] = useState("");
  const [p, setP] = useState<Procedimento | null>(null);
  const [f, setF] = useState({ quantidade: "1", valor: "", data: conta.data_atendimento, olho: "", descricao: "", codigo: "" });
  const [erro, setErro] = useState("");
  const achados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return procs.slice(0, 12);
    return procs.filter((x) => x.descricao.toLowerCase().includes(t) || (x.codigo ?? "").startsWith(t)).slice(0, 12);
  }, [busca, procs]);
  async function salvar() {
    setErro("");
    if (!p && !f.descricao.trim()) return setErro("Escolha um procedimento ou descreva o item.");
    const { error } = await supabase.from("conta_itens").insert({
      conta_id: conta.id, procedimento_id: p?.id ?? null, descricao: p ? null : f.descricao.trim(), codigo: p ? null : f.codigo || null,
      tabela: p ? undefined : "00", quantidade: numOuNulo(f.quantidade) ?? 1, valor_unitario: numOuNulo(f.valor), data_execucao: f.data, olho: f.olho || null,
    });
    if (error) return setErro(msgErro(error));
    aoSalvar();
  }
  return (
    <Modal titulo="Adicionar item" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Adicionar</button></>}>
      <Aviso>{erro}</Aviso>
      {p ? (
        <div className="secao linha entre"><span><b>{p.codigo}</b> {p.descricao}</span><button className="sutil" onClick={() => setP(null)}>Trocar</button></div>
      ) : (
        <div className="grade">
          <input autoFocus placeholder="Buscar procedimento por nome ou código TUSS" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {achados.map((x) => <button key={x.id} className="sutil" style={{ display: "block", width: "100%", textAlign: "left" }} onClick={() => setP(x)}><b>{x.codigo}</b> {x.descricao}</button>)}
            {achados.length === 0 && <div className="muted pequeno">Nada encontrado. Cadastre em Procedimentos e preços, ou descreva abaixo.</div>}
          </div>
          <details><summary className="pequeno muted" style={{ cursor: "pointer" }}>Item sem cadastro (taxa, material avulso)</summary>
            <div className="grade g3" style={{ marginTop: 8 }}>
              <Campo rotulo="Código"><input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></Campo>
              <Campo rotulo="Descrição" className="span2"><input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
            </div>
          </details>
        </div>
      )}
      <div className="grade g4" style={{ marginTop: 12 }}>
        <Campo rotulo="Quantidade"><input value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></Campo>
        <Campo rotulo="Valor unitário"><input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="da tabela" /></Campo>
        <Campo rotulo="Data"><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
        <Campo rotulo="Olho"><select value={f.olho} onChange={(e) => setF({ ...f, olho: e.target.value })}><option value="">—</option><option>OD</option><option>OE</option><option>AO</option></select></Campo>
      </div>
      <p className="muted pequeno">Deixe o valor em branco para usar o preço da tabela do convênio.</p>
    </Modal>
  );
}

function Receber({ conta, aoFechar, aoSalvar }: { conta: Conta; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState({ forma: "pix", parcelas: "1", valor: String(conta.valor_total).replace(".", ",") });
  const [erro, setErro] = useState("");
  async function salvar() {
    setErro("");
    const valor = numOuNulo(f.valor);
    if (valor === null) return setErro("Informe o valor recebido.");
    const { error } = await supabase.from("contas").update({
      status: "paga", forma_pagamento: f.forma, parcelas: f.forma === "credito" ? Number(f.parcelas) : 1, valor_pago: valor, recebido_em: new Date().toISOString(),
    }).eq("id", conta.id);
    if (error) return setErro(msgErro(error));
    aoSalvar();
  }
  return (
    <Modal titulo="Receber pagamento" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Confirmar recebimento</button></>}>
      <Aviso>{erro}</Aviso>
      <p>Total da conta: <b>{fmtMoeda(conta.valor_total)}</b></p>
      <div className="grade g3">
        <Campo rotulo="Forma de pagamento">
          <select value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>{Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Campo>
        {f.forma === "credito" && <Campo rotulo="Parcelas"><select value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: e.target.value })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></Campo>}
        <Campo rotulo="Valor recebido"><input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Campo>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ lotes
function ListaLotes({ convenios }: { convenios: Convenio[] }) {
  const nav = useNavigate();
  const { dados, erro, carregando } = useCarregar(async () => {
    const l = ok(await supabase.from("lotes").select("*").order("numero", { ascending: false }).limit(200)) as Lote[];
    const ids = l.map((x) => x.id);
    const cs = ids.length ? (ok(await supabase.from("contas").select("lote_id, valor_total, valor_glosado").in("lote_id", ids)) as { lote_id: string; valor_total: number; valor_glosado: number }[]) : [];
    return l.map((x) => {
      const doLote = cs.filter((c) => c.lote_id === x.id);
      return { ...x, guias: doLote.length, total: doLote.reduce((s, c) => s + Number(c.valor_total), 0), glosado: doLote.reduce((s, c) => s + Number(c.valor_glosado), 0) };
    });
  }, []);
  return (
    <div className="painel rolagem">
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <table className="tabela">
          <thead><tr><th>Lote</th><th>Convênio</th><th>Competência</th><th>Guias</th><th style={{ textAlign: "right" }}>Valor</th><th>Envio</th><th>Situação</th></tr></thead>
          <tbody>
            {(dados ?? []).map((l) => (
              <tr key={l.id} className="clicavel" onClick={() => nav(`/faturamento/lote/${l.id}`)}>
                <td><b>{l.numero}</b></td><td>{nomePor(convenios, l.convenio_id)}</td><td>{fmtCompetencia(l.competencia)}</td><td>{l.guias}</td>
                <td style={{ textAlign: "right" }}>{fmtMoeda(l.total)}{l.glosado > 0 && <div className="pequeno" style={{ color: "var(--perigo)" }}>glosa {fmtMoeda(l.glosado)}</div>}</td>
                <td>{l.enviado_em ? `${fmtData(l.enviado_em)}${l.protocolo ? ` · prot. ${l.protocolo}` : ""}` : "—"}</td>
                <td><Etiqueta cor={STATUS_LOTE[l.status].cor}>{STATUS_LOTE[l.status].rotulo}</Etiqueta></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {dados?.length === 0 && <div className="vazio">Nenhum lote. Na aba Contas, selecione contas prontas de um convênio e clique em "Criar lote".</div>}
    </div>
  );
}

export function LoteDetalhe() {
  const { id } = useParams();
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState<"" | "enviar" | "pagar">("");
  const convs = useCarregar(listaConvenios, []);
  const { dados, erro: e1, carregando, recarregar } = useCarregar(async () => {
    const l = ok(await supabase.from("lotes").select("*").eq("id", id!).single()) as Lote;
    const cs = ok(await supabase.from("contas").select(SEL_CONTA).eq("lote_id", id!).order("data_atendimento")) as Conta[];
    return { l, cs };
  }, [id]);
  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Aviso>{e1}</Aviso>;
  const { l, cs } = dados;
  const conv = convs.dados?.find((c) => c.id === l.convenio_id);
  const total = cs.reduce((s, c) => s + Number(c.valor_total), 0);
  const glosado = cs.reduce((s, c) => s + Number(c.valor_glosado), 0);

  async function tirar(c: Conta) {
    const { error } = await supabase.from("contas").update({ lote_id: null }).eq("id", c.id);
    if (error) setErro(msgErro(error));
    recarregar();
  }
  async function cancelarLote() {
    if (!confirm("Desfazer este lote? As contas voltam para \"Pronta p/ lote\".")) return;
    const r1 = await supabase.from("contas").update({ lote_id: null }).eq("lote_id", l.id);
    if (r1.error) return setErro(msgErro(r1.error));
    const r2 = await supabase.from("lotes").update({ status: "cancelado" }).eq("id", l.id);
    if (r2.error) return setErro(msgErro(r2.error));
    recarregar();
  }
  const [gerando, setGerando] = useState(false);
  const [avisoXml, setAvisoXml] = useState("");
  async function baixarXml() {
    setErro(""); setAvisoXml(""); setGerando(true);
    try {
      const { gerarXmlDoLote } = await import("../lib/tissLote");
      const r = await gerarXmlDoLote(l.id);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([r.bytes as BlobPart], { type: r.nomeArquivo.endsWith(".zip") ? "application/zip" : "application/xml" }));
      a.download = r.nomeArquivo;
      a.click();
      setAvisoXml(`XML gerado: ${r.nomeArquivo} (${r.guias} guia(s)).` + (r.avisos.length ? "\n" + r.avisos.join("\n") : ""));
      recarregar();
    } catch (e) {
      setErro("Não deu para gerar o XML. Corrija e tente de novo:\n" + (e instanceof Error ? e.message : String(e)));
    } finally { setGerando(false); }
  }
  const temPagamento = cs.some((c) => ["paga", "glosada"].includes(c.status) || Number(c.valor_glosado) > 0);
  async function reabrirLote() {
    if (!confirm("Reabrir esta cobrança para corrigir?\n\nAs guias voltam para \"Pronta p/ lote\". Você pode tirar o paciente com erro, " +
      "e depois marca a cobrança como enviada de novo (o XML deve ser gerado de novo).")) return;
    setErro("");
    const r1 = await supabase.from("contas").update({ status: "pronta" }).eq("lote_id", l.id).eq("status", "faturada");
    if (r1.error) return setErro(msgErro(r1.error));
    const obs = [l.observacoes, `Reaberta para correção em ${fmtData(isoDia(new Date()))}${l.enviado_em ? ` (enviada antes em ${fmtData(l.enviado_em)})` : ""}.`].filter(Boolean).join("\n");
    const r2 = await supabase.from("lotes").update({ status: "aberto", observacoes: obs }).eq("id", l.id);
    if (r2.error) return setErro(msgErro(r2.error));
    recarregar();
  }
  function exportarCSV() {
    const linhas = [["Guia prestador", "Guia operadora", "Data", "Paciente", "Prontuário", "Carteirinha", "Senha", "Tipo", "Valor", "Glosado"].join(";")];
    for (const c of cs) linhas.push([c.numero_guia_prestador, c.numero_guia_operadora ?? "", fmtData(c.data_atendimento), c.pacientes!.nome, c.pacientes!.numero_prontuario,
      c.carteirinha ?? "", c.senha_autorizacao ?? "", TIPO_GUIA[c.tipo_guia], String(c.valor_total).replace(".", ","), String(c.valor_glosado).replace(".", ",")].join(";"));
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lote-${l.numero}-${(conv?.nome ?? "convenio").replace(/\W+/g, "_")}.csv`;
    a.click();
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <div className="linha"><h1 style={{ margin: 0 }}>Lote {l.numero} · {conv?.nome}</h1><Etiqueta cor={STATUS_LOTE[l.status].cor}>{STATUS_LOTE[l.status].rotulo}</Etiqueta></div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            Competência {fmtCompetencia(l.competencia)} · {cs.length} guia(s) · {fmtMoeda(total)}
            {l.numero_tiss && ` · lote no XML nº ${l.numero_tiss}`}
            {l.enviado_em && ` · enviado em ${fmtData(l.enviado_em)}`}{l.protocolo && ` · protocolo ${l.protocolo}`}
            {l.pago_em && ` · pago ${fmtMoeda(l.valor_pago)} em ${fmtData(l.pago_em)}`}
          </p>
        </div>
        <div className="linha">
          <Link className="botao" to={`/imprimir/lote/${l.id}`} target="_blank">🖨️ Relação de guias</Link>
          <button onClick={exportarCSV}>⬇️ Planilha (CSV)</button>
          {l.status !== "cancelado" && !l.arquivado && <button className="primario" disabled={gerando || cs.length === 0} onClick={baixarXml}>{gerando ? "Gerando…" : "📄 Gerar XML"}</button>}
          {l.status === "aberto" && <button className="primario" disabled={cs.length === 0} onClick={() => setModal("enviar")}>📤 Marcar como enviado</button>}
          {l.status === "enviado" && !l.arquivado && <button className="primario" onClick={() => setModal("pagar")}>💰 Registrar pagamento</button>}
          {l.status === "enviado" && !l.arquivado && !temPagamento && <button onClick={reabrirLote} title="Para tirar um paciente com erro e gerar o XML de novo">🔓 Reabrir cobrança</button>}
          {l.status === "aberto" && <button className="perigo" onClick={cancelarLote}>Desfazer lote</button>}
        </div>
      </div>
      {(erro || e1) && <Aviso><span style={{ whiteSpace: "pre-line" }}>{erro || e1}</span></Aviso>}
      {l.arquivado && <Aviso tipo="info">Cobrança antiga do Micrologos (antes de 2021): só para consulta.</Aviso>}
      {avisoXml && <Aviso tipo="ok"><span style={{ whiteSpace: "pre-line" }}>{avisoXml}</span></Aviso>}
      {l.observacoes && <p className="muted pequeno" style={{ whiteSpace: "pre-line", margin: "0 0 10px" }}>{l.observacoes}</p>}
      {!conv?.codigo_prestador && <Aviso tipo="alerta">O código da clínica neste convênio não está cadastrado (Cadastros → Convênios). Ele aparece nas guias.</Aviso>}
      <div className="painel rolagem">
        <table className="tabela">
          <thead><tr><th>Guia</th><th>Data</th><th>Paciente</th><th>Senha</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Glosa</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {cs.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/faturamento/conta/${c.id}`}>{c.numero_guia_prestador}</Link><div className="muted pequeno">{TIPO_GUIA[c.tipo_guia]}</div></td>
                <td>{fmtData(c.data_atendimento)}</td><td>{nomeExibicao(c.pacientes!)}</td><td>{c.senha_autorizacao ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{fmtMoeda(c.valor_total)}</td>
                <td style={{ textAlign: "right", color: Number(c.valor_glosado) > 0 ? "var(--perigo)" : undefined }}>{Number(c.valor_glosado) > 0 ? fmtMoeda(c.valor_glosado) : "—"}</td>
                <td><Etiqueta cor={STATUS_CONTA[c.status].cor}>{STATUS_CONTA[c.status].rotulo}</Etiqueta></td>
                <td>{l.status === "aberto" && <button className="sutil mini" onClick={() => tirar(c)}>tirar do lote</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {glosado > 0 && <p style={{ textAlign: "right", color: "var(--perigo)" }}>Total glosado: {fmtMoeda(glosado)}</p>}
        {l.status === "enviado" && <p className="muted pequeno">Glosas: abra cada guia e use o botão "Glosa" no item recusado. Depois registre o pagamento do lote.</p>}
      </div>
      {modal === "enviar" && <EnviarLote lote={l} contas={cs} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "pagar" && <PagarLote lote={l} contas={cs} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
    </div>
  );
}

function EnviarLote({ lote, contas, aoFechar, aoSalvar }: { lote: Lote; contas: Conta[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState({ enviado_em: isoDia(new Date()), protocolo: "", previsao_pagamento: "" });
  const [erro, setErro] = useState("");
  async function salvar() {
    setErro("");
    const r1 = await supabase.from("contas").update({ status: "faturada" }).in("id", contas.map((c) => c.id));
    if (r1.error) return setErro(msgErro(r1.error));
    const r2 = await supabase.from("lotes").update({ status: "enviado", enviado_em: f.enviado_em, protocolo: f.protocolo || null, previsao_pagamento: f.previsao_pagamento || null }).eq("id", lote.id);
    if (r2.error) return setErro(msgErro(r2.error));
    aoSalvar();
  }
  return (
    <Modal titulo={`Enviar lote ${lote.numero}`} aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Confirmar envio</button></>}>
      <Aviso>{erro}</Aviso>
      <p>Depois de enviado, os itens das guias ficam travados (só glosas podem ser lançadas).</p>
      <div className="grade g3">
        <Campo rotulo="Data do envio"><input type="date" value={f.enviado_em} onChange={(e) => setF({ ...f, enviado_em: e.target.value })} /></Campo>
        <Campo rotulo="Protocolo do convênio"><input value={f.protocolo} onChange={(e) => setF({ ...f, protocolo: e.target.value })} /></Campo>
        <Campo rotulo="Previsão de pagamento"><input type="date" value={f.previsao_pagamento} onChange={(e) => setF({ ...f, previsao_pagamento: e.target.value })} /></Campo>
      </div>
    </Modal>
  );
}

function PagarLote({ lote, contas, aoFechar, aoSalvar }: { lote: Lote; contas: Conta[]; aoFechar: () => void; aoSalvar: () => void }) {
  const total = contas.reduce((s, c) => s + Number(c.valor_total), 0);
  const glosado = contas.reduce((s, c) => s + Number(c.valor_glosado), 0);
  const [f, setF] = useState({ pago_em: isoDia(new Date()), valor: (total - glosado).toFixed(2).replace(".", ",") });
  const [erro, setErro] = useState("");
  async function salvar() {
    setErro("");
    const valor = numOuNulo(f.valor);
    if (valor === null) return setErro("Informe o valor pago.");
    for (const c of contas) {
      const g = Number(c.valor_glosado);
      const r = await supabase.from("contas").update({ status: g > 0 ? "glosada" : "paga", valor_pago: Number(c.valor_total) - g }).eq("id", c.id);
      if (r.error) return setErro(msgErro(r.error));
    }
    const r2 = await supabase.from("lotes").update({ status: glosado > 0 ? "pago_parcial" : "pago", pago_em: f.pago_em, valor_pago: valor }).eq("id", lote.id);
    if (r2.error) return setErro(msgErro(r2.error));
    aoSalvar();
  }
  return (
    <Modal titulo={`Pagamento do lote ${lote.numero}`} aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Registrar pagamento</button></>}>
      <Aviso>{erro}</Aviso>
      <p>Faturado: <b>{fmtMoeda(total)}</b> · Glosas lançadas: <b style={{ color: "var(--perigo)" }}>{fmtMoeda(glosado)}</b> · Esperado: <b>{fmtMoeda(total - glosado)}</b></p>
      <p className="muted pequeno">Lance as glosas item a item (em cada guia) antes de registrar o pagamento.</p>
      <div className="grade g2">
        <Campo rotulo="Data do pagamento"><input type="date" value={f.pago_em} onChange={(e) => setF({ ...f, pago_em: e.target.value })} /></Campo>
        <Campo rotulo="Valor recebido do convênio"><input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Campo>
      </div>
      {Math.abs((numOuNulo(f.valor) ?? 0) - (total - glosado)) > 0.009 && <Aviso tipo="alerta">O valor recebido é diferente do esperado. Confira se falta lançar alguma glosa.</Aviso>}
    </Modal>
  );
}

// ------------------------------------------------------------------ glosas
function ListaGlosas({ convenios }: { convenios: Convenio[] }) {
  const nav = useNavigate();
  const { dados, erro, carregando } = useCarregar(async () => ok(
    await supabase.from("conta_itens").select("id, conta_id, codigo, descricao, valor_total, glosa_valor, glosa_codigo, glosa_motivo, recurso_texto, recurso_enviado_em, recurso_valor_recuperado, contas(numero_guia_prestador, convenio_id, data_atendimento, pacientes(nome))")
      .gt("glosa_valor", 0).order("atualizado_em", { ascending: false }).limit(300),
  ) as unknown as (Item & { contas: { numero_guia_prestador: string; convenio_id: string; data_atendimento: string; pacientes: { nome: string } } })[], []);
  const lista = dados ?? [];
  const tot = lista.reduce((s, i) => s + Number(i.glosa_valor), 0);
  const rec = lista.reduce((s, i) => s + Number(i.recurso_valor_recuperado ?? 0), 0);
  return (
    <div className="painel rolagem">
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <>
          <div className="cartoes">
            <div className="cartao"><div className="num">{fmtMoeda(tot)}</div><div className="rot">Glosado</div></div>
            <div className="cartao"><div className="num">{fmtMoeda(rec)}</div><div className="rot">Recuperado em recurso</div></div>
            <div className="cartao"><div className="num">{lista.filter((i) => !i.recurso_enviado_em).length}</div><div className="rot">Glosas sem recurso</div></div>
          </div>
          <table className="tabela">
            <thead><tr><th>Guia</th><th>Paciente</th><th>Convênio</th><th>Item</th><th style={{ textAlign: "right" }}>Glosa</th><th>Motivo</th><th>Recurso</th></tr></thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id} className="clicavel" onClick={() => nav(`/faturamento/conta/${i.conta_id}`)}>
                  <td>{i.contas.numero_guia_prestador}<div className="muted pequeno">{fmtData(i.contas.data_atendimento)}</div></td>
                  <td>{i.contas.pacientes.nome}</td><td>{nomePor(convenios, i.contas.convenio_id)}</td>
                  <td className="pequeno">{i.codigo} {i.descricao}</td>
                  <td style={{ textAlign: "right", color: "var(--perigo)" }}>{fmtMoeda(i.glosa_valor)}</td>
                  <td className="pequeno">{i.glosa_codigo && <b>{i.glosa_codigo} </b>}{i.glosa_motivo}</td>
                  <td>{i.recurso_valor_recuperado ? <Etiqueta cor="verde">recuperado {fmtMoeda(i.recurso_valor_recuperado)}</Etiqueta> : i.recurso_enviado_em ? <Etiqueta cor="roxo">enviado {fmtData(i.recurso_enviado_em)}</Etiqueta> : <Etiqueta cor="amarelo">pendente</Etiqueta>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <div className="vazio">Nenhuma glosa registrada.</div>}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ produção
// Relatório de produção (substitui "Atendimentos por Médico", "Faturamento por Médico" e "Valores resumidos por plano"
// do Micrologos). Soma os itens das contas, inclusive o histórico arquivado do Micrologos, e compara com outro período.
interface LinhaRel {
  profissional_id: string | null; profissional: string; convenio_id: string | null; convenio: string; tipo: string;
  codigo: string | null; procedimento: string; quantidade: number; itens: number; contas: number; pacientes: number; valor: number; glosado: number;
}
const TIPOS_PROD: Record<string, string> = {
  consulta: "Consulta", exame: "Exame", cirurgia: "Cirurgia", procedimento: "Procedimento", medicamento: "Medicamento",
  material: "Material", taxa: "Taxa", honorario: "Honorários de equipe", outro: "Outro",
};
const DIMENSOES: Record<string, { rotulo: string; chave: (l: LinhaRel) => string; nome: (l: LinhaRel) => string }> = {
  medico: { rotulo: "Médico", chave: (l) => l.profissional_id ?? "-", nome: (l) => l.profissional },
  convenio: { rotulo: "Convênio", chave: (l) => l.convenio_id ?? "-", nome: (l) => l.convenio },
  tipo: { rotulo: "Tipo", chave: (l) => l.tipo, nome: (l) => TIPOS_PROD[l.tipo] ?? l.tipo },
  procedimento: { rotulo: "Procedimento", chave: (l) => `${l.codigo ?? ""}|${l.procedimento}`, nome: (l) => (l.codigo ? `${l.codigo} · ` : "") + l.procedimento },
};
function deslocar(iso: string, meses: number, anos = 0) {
  const d = new Date(iso + "T12:00:00");
  const alvo = new Date(d.getFullYear() + anos, d.getMonth() + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return isoDia(new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(d.getDate(), ultimo)));
}
function fimDoMes(iso: string) { const d = new Date(iso + "T12:00:00"); return isoDia(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

function Producao({ convenios, profs }: { convenios: Convenio[]; profs: { id: string; nome: string }[] }) {
  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(isoDia(new Date()));
  const [comparar, setComparar] = useState<"nada" | "mes" | "ano">("ano");
  const [nivel1, setNivel1] = useState("medico");
  const [nivel2, setNivel2] = useState("convenio");
  const [fMed, setFMed] = useState("");
  const [fConv, setFConv] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [aberto, setAberto] = useState<string[]>([]);

  const cmp = comparar === "mes" ? { de: deslocar(de, -1), ate: ate === fimDoMes(ate) ? fimDoMes(deslocar(ate, -1)) : deslocar(ate, -1) }
    : comparar === "ano" ? { de: deslocar(de, 0, -1), ate: ate === fimDoMes(ate) ? fimDoMes(deslocar(ate, 0, -1)) : deslocar(ate, 0, -1) } : null;

  const { dados, erro, carregando } = useCarregar(async () => {
    const [atual, antes] = await Promise.all([
      supabase.rpc("rel_faturamento", { p_de: de, p_ate: ate }).then((r) => ok(r) as LinhaRel[]),
      cmp ? supabase.rpc("rel_faturamento", { p_de: cmp.de, p_ate: cmp.ate }).then((r) => ok(r) as LinhaRel[]) : Promise.resolve([] as LinhaRel[]),
    ]);
    return { atual, antes };
  }, [de, ate, comparar]);

  const filtrar = (ls: LinhaRel[]) => ls.filter((l) => (!fMed || (l.profissional_id ?? "-") === fMed) && (!fConv || (l.convenio_id ?? "-") === fConv) && (!fTipo || l.tipo === fTipo));
  type Grupo = { k: string; nome: string; qtd: number; contas: number; valor: number; glosado: number; valorCmp: number; qtdCmp: number; filhos?: Grupo[] };
  function agrupar(atual: LinhaRel[], antes: LinhaRel[], dim: string, sub?: string): Grupo[] {
    const D = DIMENSOES[dim];
    const m = new Map<string, Grupo & { la: LinhaRel[]; lb: LinhaRel[] }>();
    const pega = (l: LinhaRel) => {
      const k = D.chave(l);
      const g = m.get(k) ?? { k, nome: D.nome(l), qtd: 0, contas: 0, valor: 0, glosado: 0, valorCmp: 0, qtdCmp: 0, la: [], lb: [] };
      m.set(k, g); return g;
    };
    for (const l of atual) { const g = pega(l); g.qtd += Number(l.quantidade); g.contas += Number(l.contas); g.valor += Number(l.valor); g.glosado += Number(l.glosado); g.la.push(l); }
    for (const l of antes) { const g = pega(l); g.qtdCmp += Number(l.quantidade); g.valorCmp += Number(l.valor); g.lb.push(l); }
    return [...m.values()].map(({ la, lb, ...g }) => ({ ...g, filhos: sub ? agrupar(la, lb, sub) : undefined })).sort((a, b) => b.valor - a.valor || b.valorCmp - a.valorCmp);
  }
  const atual = filtrar(dados?.atual ?? []);
  const antes = filtrar(dados?.antes ?? []);
  const grupos = agrupar(atual, antes, nivel1, nivel2 && nivel2 !== nivel1 ? nivel2 : undefined);
  const tot = grupos.reduce((t, g) => ({ qtd: t.qtd + g.qtd, contas: t.contas + g.contas, valor: t.valor + g.valor, glosado: t.glosado + g.glosado, valorCmp: t.valorCmp + g.valorCmp, qtdCmp: t.qtdCmp + g.qtdCmp }),
    { qtd: 0, contas: 0, valor: 0, glosado: 0, valorCmp: 0, qtdCmp: 0 });
  const varPct = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(1).replace(".", ",")}%` : a ? "novo" : "—");
  const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const periodo = (a: string, b: string) => `${fmtData(a)} a ${fmtData(b)}`;
  const N1 = DIMENSOES[nivel1].rotulo;
  const N2 = nivel2 && nivel2 !== nivel1 ? DIMENSOES[nivel2].rotulo : "";

  function atalho(tipo: "mes" | "passado" | "ano") {
    const h = new Date();
    if (tipo === "mes") { setDe(primeiroDiaMes(h)); setAte(isoDia(h)); }
    if (tipo === "passado") { const p = new Date(h.getFullYear(), h.getMonth() - 1, 1); setDe(isoDia(p)); setAte(fimDoMes(isoDia(p))); }
    if (tipo === "ano") { setDe(`${h.getFullYear()}-01-01`); setAte(isoDia(h)); }
  }
  function planilha() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const dec = (v: number) => v.toFixed(2).replace(".", ",");
    const cab = [N1, N2, "Quantidade", "Contas", "Faturado", "Glosado", ...(cmp ? ["Quantidade (comparação)", "Faturado (comparação)", "Variação"] : [])].filter((x) => x !== "");
    const linhas: string[] = [cab.map(esc).join(";")];
    for (const g of grupos) for (const f of g.filhos ?? [g]) {
      const col = [g.nome, ...(N2 ? [f.nome] : []), num(f.qtd), f.contas, dec(f.valor), dec(f.glosado), ...(cmp ? [num(f.qtdCmp), dec(f.valorCmp), varPct(f.valor, f.valorCmp)] : [])];
      linhas.push(col.map(esc).join(";"));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `producao-${de}-a-${ate}.csv`;
    a.click();
  }

  const Linha = ({ g, filho }: { g: Grupo; filho?: boolean }) => (
    <tr style={filho ? { background: "var(--fundo-suave, transparent)" } : undefined}>
      <td style={filho ? { paddingLeft: 28 } : undefined}>
        {!filho && g.filhos && g.filhos.length > 0 && (
          <button className="mini" style={{ marginRight: 6 }} onClick={() => setAberto(aberto.includes(g.k) ? aberto.filter((x) => x !== g.k) : [...aberto, g.k])}>{aberto.includes(g.k) ? "−" : "+"}</button>
        )}
        {filho ? g.nome : <b>{g.nome}</b>}
      </td>
      <td style={{ textAlign: "right" }}>{num(g.qtd)}</td>
      <td style={{ textAlign: "right" }}>{g.contas}</td>
      <td style={{ textAlign: "right" }}>{fmtMoeda(g.valor)}</td>
      <td style={{ textAlign: "right", color: g.glosado > 0 ? "var(--perigo)" : undefined }}>{g.glosado ? fmtMoeda(g.glosado) : "—"}</td>
      {cmp && <><td style={{ textAlign: "right" }} className="muted">{num(g.qtdCmp)}</td><td style={{ textAlign: "right" }} className="muted">{fmtMoeda(g.valorCmp)}</td>
        <td style={{ textAlign: "right", color: g.valor < g.valorCmp ? "var(--perigo)" : undefined }}>{varPct(g.valor, g.valorCmp)}</td></>}
    </tr>
  );

  return (
    <div>
      <div className="painel">
        <div className="linha" style={{ flexWrap: "wrap", gap: 10 }}>
          <label className="linha pequeno muted">de <input type="date" style={{ width: 150 }} value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label className="linha pequeno muted">até <input type="date" style={{ width: 150 }} value={ate} onChange={(e) => setAte(e.target.value)} /></label>
          <button className="mini" onClick={() => atalho("mes")}>Este mês</button>
          <button className="mini" onClick={() => atalho("passado")}>Mês passado</button>
          <button className="mini" onClick={() => atalho("ano")}>Este ano</button>
          <label className="linha pequeno muted">comparar com
            <select style={{ width: 210 }} value={comparar} onChange={(e) => setComparar(e.target.value as typeof comparar)}>
              <option value="ano">mesmo período do ano anterior</option>
              <option value="mes">período do mês anterior</option>
              <option value="nada">não comparar</option>
            </select>
          </label>
        </div>
        <div className="linha" style={{ flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          <label className="linha pequeno muted">agrupar por
            <select style={{ width: 150 }} value={nivel1} onChange={(e) => { setNivel1(e.target.value); setAberto([]); }}>
              {Object.entries(DIMENSOES).map(([k, d]) => <option key={k} value={k}>{d.rotulo}</option>)}
            </select>
          </label>
          <label className="linha pequeno muted">e depois por
            <select style={{ width: 150 }} value={nivel2} onChange={(e) => setNivel2(e.target.value)}>
              <option value="">—</option>
              {Object.entries(DIMENSOES).filter(([k]) => k !== nivel1).map(([k, d]) => <option key={k} value={k}>{d.rotulo}</option>)}
            </select>
          </label>
          <select style={{ width: 200 }} value={fMed} onChange={(e) => setFMed(e.target.value)}>
            <option value="">Todos os médicos</option>
            {profs.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select style={{ width: 200 }} value={fConv} onChange={(e) => setFConv(e.target.value)}>
            <option value="">Todos os convênios</option>
            <option value="-">Particular</option>
            {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select style={{ width: 170 }} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS_PROD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {grupos.length > 0 && <button className="mini nao-imprimir" style={{ marginLeft: "auto" }} onClick={planilha}>⬇️ Planilha</button>}
          <button className="mini nao-imprimir" onClick={() => window.print()}>🖨️ Imprimir</button>
        </div>
      </div>
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <div className="painel rolagem">
          <h2 style={{ marginTop: 0 }}>Produção {periodo(de, ate)}{cmp && <span className="muted pequeno"> · comparando com {periodo(cmp.de, cmp.ate)}</span>}</h2>
          <p className="muted pequeno" style={{ margin: "0 0 8px" }}>
            Soma dos itens das contas pela data do atendimento (contas canceladas ficam de fora). Inclui o histórico do Micrologos.
            {N2 && " Clique em + para ver o detalhe."}
          </p>
          <table className="tabela">
            <thead><tr>
              <th>{N1}{N2 && ` / ${N2}`}</th><th style={{ textAlign: "right" }}>Qtd.</th><th style={{ textAlign: "right" }}>Contas</th>
              <th style={{ textAlign: "right" }}>Faturado</th><th style={{ textAlign: "right" }}>Glosado</th>
              {cmp && <><th style={{ textAlign: "right" }}>Qtd. antes</th><th style={{ textAlign: "right" }}>Faturado antes</th><th style={{ textAlign: "right" }}>Variação</th></>}
            </tr></thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.k}>
                  <Linha g={g} />
                  {aberto.includes(g.k) && g.filhos?.map((f) => <Linha key={g.k + f.k} g={f} filho />)}
                </Fragment>
              ))}
            </tbody>
            {grupos.length > 1 && (
              <tfoot><tr>
                <th>Total</th><th style={{ textAlign: "right" }}>{num(tot.qtd)}</th><th style={{ textAlign: "right" }}>{tot.contas}</th>
                <th style={{ textAlign: "right" }}>{fmtMoeda(tot.valor)}</th><th style={{ textAlign: "right" }}>{fmtMoeda(tot.glosado)}</th>
                {cmp && <><th style={{ textAlign: "right" }}>{num(tot.qtdCmp)}</th><th style={{ textAlign: "right" }}>{fmtMoeda(tot.valorCmp)}</th><th style={{ textAlign: "right" }}>{varPct(tot.valor, tot.valorCmp)}</th></>}
              </tr></tfoot>
            )}
          </table>
          {grupos.length === 0 && <div className="vazio">Sem movimento no período.</div>}
          <p className="muted pequeno" style={{ marginTop: 8 }}>“Contas” conta cada conta uma vez por linha; no total pode somar a mesma conta em mais de uma linha (ex.: consulta e exame na mesma conta).</p>
        </div>
      )}
    </div>
  );
}

export type { Plano };
