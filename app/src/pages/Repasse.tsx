// Repasse médico (área do Luciano, administrador) — migração 0060.
// Cirurgia particular: imposto → centro cirúrgico → taxa interna (só crédito parcelado) → médico.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo, BuscaPaciente, type PacienteResumo } from "../components/ui";
import { fmtData, fmtMoeda, isoDia, nomeExibicao, numOuNulo } from "../lib/util";
import {
  FORMAS_REPASSE, calcularParcela, partesPorParcela, taxaInternaPct, totaisRepasse, type RegrasRepasse, type TaxaCartao,
} from "../lib/repasse";

// ------------------------------------------------------------------ tipos
interface Parcela {
  id: string; repasse_id: string; numero: number; data_prevista: string; valor_recebido: number | null; recebido_em: string | null;
  imposto: number; centro_cirurgico: number; taxa_interna: number | null; medico: number | null; pago_medico_em: string | null;
}
interface Repasse {
  id: string; numero: number; conta_id: string | null; paciente_id: string | null; profissional_id: string; procedimento: string;
  data_cirurgia: string; data_pagamento: string; valor_total: number; forma_pagamento: string; parcelas: number;
  imposto_pct: number; centro_cirurgico_pct: number; taxa_interna_pct: number; taxa_arredondamento: "truncar" | "arredondar";
  imposto_total: number; centro_cirurgico_total: number; status: string; motivo_cancelamento: string | null; observacoes: string | null;
  pacientes?: { nome: string; nome_social: string | null; numero_prontuario: number } | null;
  profissionais?: { nome: string } | null;
  repasse_parcelas?: Parcela[];
}
interface Config extends RegrasRepasse { id: string }
interface Medico { id: string; nome: string }

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  aberto: { rotulo: "Em andamento", cor: "amarelo" },
  concluido: { rotulo: "Médico pago", cor: "verde" },
  cancelado: { rotulo: "Cancelado", cor: "cinza" },
};
const SEL = "*, pacientes(nome, nome_social, numero_prontuario), profissionais(nome), repasse_parcelas(*)";
const num = { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };
const pct = (v: number) => `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
const soma = (ps: Parcela[], k: keyof Parcela) => ps.reduce((s, p) => s + Number(p[k] ?? 0), 0);
function primeiroDiaMes(d = new Date()) { return isoDia(new Date(d.getFullYear(), d.getMonth(), 1)); }

async function carregarBase() {
  const [cfg, taxas, medicos] = await Promise.all([
    supabase.from("repasse_config").select("*").single().then((x) => ok(x) as Config),
    supabase.from("repasse_taxas_cartao").select("*").order("parcelas").then((x) => ok(x) as TaxaCartao[]),
    supabase.from("profissionais").select("id, nome").eq("funcao", "medico").order("nome").then((x) => ok(x) as Medico[]),
  ]);
  return { cfg, taxas, medicos };
}

// ================================================================== tela principal
export default function RepasseMedico() {
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") ?? "lancamentos";
  const base = useCarregar(carregarBase, []);
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Repasse médico</h1>
          <p className="sub" style={{ margin: 0 }}>Cirurgia particular: imposto → centro cirúrgico → taxa interna (crédito parcelado) → médico</p>
        </div>
      </div>
      <Aviso>{base.erro}</Aviso>
      <div className="abas">
        <button className={aba === "lancamentos" ? "ativa" : ""} onClick={() => setParams({ aba: "lancamentos" })}>Lançamentos</button>
        <button className={aba === "medicos" ? "ativa" : ""} onClick={() => setParams({ aba: "medicos" })}>Relatório por médico</button>
        <button className={aba === "regras" ? "ativa" : ""} onClick={() => setParams({ aba: "regras" })}>Regras e taxas</button>
      </div>
      {base.dados && aba === "lancamentos" && <Lancamentos base={base.dados} />}
      {base.dados && aba === "medicos" && <RelatorioMedicos medicos={base.dados.medicos} />}
      {base.dados && aba === "regras" && <Regras cfg={base.dados.cfg} taxas={base.dados.taxas} aoMudar={base.recarregar} />}
    </div>
  );
}

// ------------------------------------------------------------------ lançamentos
function Lancamentos({ base }: { base: Awaited<ReturnType<typeof carregarBase>> }) {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const contaParam = params.get("conta");
  const [f, setF] = useState({ status: "aberto", medico: "todos", de: isoDia(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)), ate: isoDia(new Date()) });
  const [nova, setNova] = useState(!!contaParam);

  const { dados, erro, carregando } = useCarregar(async () => {
    let q = supabase.from("repasses").select(SEL).gte("data_cirurgia", f.de).lte("data_cirurgia", f.ate)
      .order("data_cirurgia", { ascending: false }).limit(500);
    if (f.status !== "todos") q = q.eq("status", f.status);
    if (f.medico !== "todos") q = q.eq("profissional_id", f.medico);
    return ok(await q) as Repasse[];
  }, [f.status, f.medico, f.de, f.ate]);
  const lista = dados ?? [];

  return (
    <div className="painel grade">
      <div className="linha">
        <select style={{ width: 170 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="aberto">Em andamento</option><option value="concluido">Médico pago</option>
          <option value="cancelado">Cancelados</option><option value="todos">Todos</option>
        </select>
        <select style={{ width: 200 }} value={f.medico} onChange={(e) => setF({ ...f, medico: e.target.value })}>
          <option value="todos">Todos os médicos</option>
          {base.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <label className="linha pequeno muted">cirurgia de <input type="date" style={{ width: 150 }} value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></label>
        <label className="linha pequeno muted">até <input type="date" style={{ width: 150 }} value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></label>
        <span style={{ marginLeft: "auto" }} />
        <button className="primario" onClick={() => setNova(true)}>➕ Novo repasse</button>
      </div>
      <Aviso>{erro}</Aviso>
      {carregando && !dados ? <Carregando /> : (
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Nº</th><th>Cirurgia</th><th>Médico</th><th>Paciente / procedimento</th><th>Pagamento</th>
              <th style={num}>Valor</th><th style={num}>Médico (até agora)</th><th>Parcelas</th><th>Situação</th></tr></thead>
            <tbody>
              {lista.map((r) => {
                const ps = r.repasse_parcelas ?? [];
                const entrou = ps.filter((p) => p.valor_recebido !== null).length;
                const pagas = ps.filter((p) => p.pago_medico_em).length;
                return (
                  <tr key={r.id} className="clicavel" onClick={() => nav(`/repasse/${r.id}`)}>
                    <td>{r.numero}</td>
                    <td>{fmtData(r.data_cirurgia)}</td>
                    <td><b>{r.profissionais?.nome}</b></td>
                    <td>{r.pacientes ? nomeExibicao(r.pacientes) : <span className="muted">—</span>}<div className="muted pequeno">{r.procedimento}</div></td>
                    <td>{FORMAS_REPASSE[r.forma_pagamento]}{r.parcelas > 1 && ` ${r.parcelas}x`}</td>
                    <td style={num}>{fmtMoeda(r.valor_total)}</td>
                    <td style={num}>{fmtMoeda(soma(ps, "medico"))}</td>
                    <td className="pequeno">{entrou}/{r.parcelas} entraram<div className="muted">{pagas}/{r.parcelas} pagas ao médico</div></td>
                    <td><Etiqueta cor={STATUS[r.status].cor}>{STATUS[r.status].rotulo}</Etiqueta></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length === 0 && <div className="vazio">Nenhum repasse neste filtro. Clique em "Novo repasse" para lançar uma cirurgia.</div>}
        </div>
      )}
      {nova && <NovoRepasse base={base} contaId={contaParam} aoFechar={() => { setNova(false); if (contaParam) setParams({ aba: "lancamentos" }); }}
        aoCriar={(id) => nav(`/repasse/${id}`)} />}
    </div>
  );
}

// ------------------------------------------------------------------ novo repasse (com prévia do cálculo)
function NovoRepasse({ base, contaId, aoFechar, aoCriar }: {
  base: Awaited<ReturnType<typeof carregarBase>>; contaId: string | null; aoFechar: () => void; aoCriar: (id: string) => void;
}) {
  const hoje = isoDia(new Date());
  const [f, setF] = useState({ profissional_id: "", procedimento: "", data_cirurgia: hoje, data_pagamento: hoje, valor: "", forma: "pix", parcelas: "12", observacoes: "" });
  const [pac, setPac] = useState<PacienteResumo | { id: string; nome: string; nome_social: string | null; numero_prontuario: number } | null>(null);
  const [conta, setConta] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Vindo de uma conta particular paga: preenche os dados
  useEffect(() => {
    if (!contaId) return;
    (async () => {
      const { data, error } = await supabase.from("contas")
        .select("id, convenio_id, status, data_atendimento, profissional_id, valor_total, valor_pago, forma_pagamento, parcelas, recebido_em, pacientes(id, nome, nome_social, numero_prontuario), conta_itens(descricao)")
        .eq("id", contaId).single();
      if (error) return setErro(msgErro(error));
      const c = data as unknown as {
        id: string; convenio_id: string | null; data_atendimento: string; profissional_id: string | null; valor_total: number; valor_pago: number | null;
        forma_pagamento: string | null; parcelas: number | null; recebido_em: string | null;
        pacientes: { id: string; nome: string; nome_social: string | null; numero_prontuario: number }; conta_itens: { descricao: string }[];
      };
      if (c.convenio_id) return setErro("Esta conta é de convênio. O repasse desta versão é só para cirurgia particular.");
      setConta(c.id);
      setPac(c.pacientes);
      setF((x) => ({
        ...x,
        profissional_id: base.medicos.some((m) => m.id === c.profissional_id) ? c.profissional_id! : "",
        procedimento: c.conta_itens.map((i) => i.descricao).join(" + ").slice(0, 200),
        data_cirurgia: c.data_atendimento,
        data_pagamento: c.recebido_em ? isoDia(new Date(c.recebido_em)) : x.data_pagamento,
        valor: String(c.valor_pago ?? c.valor_total).replace(".", ","),
        forma: c.forma_pagamento && FORMAS_REPASSE[c.forma_pagamento] ? c.forma_pagamento : x.forma,
        parcelas: String(c.parcelas && c.parcelas > 1 ? c.parcelas : x.parcelas),
      }));
    })();
  }, [contaId, base.medicos]);

  const valor = numOuNulo(f.valor) ?? 0;
  const n = f.forma === "credito" ? Number(f.parcelas) : 1;
  const taxaPct = taxaInternaPct(f.forma, n, base.taxas);
  const prev = useMemo(() => {
    if (valor <= 0) return null;
    const { imposto, centro } = totaisRepasse(valor, base.cfg);
    const imps = partesPorParcela(imposto, n), ccs = partesPorParcela(centro, n);
    // simulação: parcela que entra = valor ÷ parcelas (a maquininha desconta a taxa dela; o valor real o Luciano digita depois)
    const bruta = partesPorParcela(valor, n)[0];
    const sim = taxaPct === null ? null : calcularParcela(bruta, imps[0], ccs[0], taxaPct, base.cfg.taxa_arredondamento);
    return { imposto, centro, imps, ccs, bruta, sim };
  }, [valor, n, taxaPct, base.cfg]);

  async function salvar() {
    setErro("");
    if (!f.profissional_id) return setErro("Escolha o médico.");
    if (!f.procedimento.trim()) return setErro("Informe o procedimento (ex.: Refrativa AO).");
    if (valor <= 0) return setErro("Informe o valor total da cirurgia.");
    if (taxaPct === null) return setErro(`Não há taxa cadastrada para ${n}x. Cadastre na aba "Regras e taxas".`);
    setSalvando(true);
    const { data, error } = await supabase.from("repasses").insert({
      conta_id: conta, paciente_id: pac?.id ?? null, profissional_id: f.profissional_id, procedimento: f.procedimento.trim(),
      data_cirurgia: f.data_cirurgia, data_pagamento: f.data_pagamento, valor_total: valor, forma_pagamento: f.forma, parcelas: n,
      observacoes: f.observacoes.trim() || null,
    }).select("id").single();
    setSalvando(false);
    if (error) return setErro(msgErro(error));
    aoCriar((data as { id: string }).id);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal titulo="Novo repasse de cirurgia particular" largo aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" disabled={salvando} onClick={salvar}>Lançar repasse</button></>}>
      <Aviso>{erro}</Aviso>
      {conta && <Aviso tipo="info">Dados puxados da conta particular. Confira antes de lançar.</Aviso>}
      <div className="grade g3">
        <Campo rotulo="Médico que recebe">
          <select value={f.profissional_id} onChange={set("profissional_id")}>
            <option value="">Escolha…</option>{base.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Procedimento"><input value={f.procedimento} onChange={set("procedimento")} placeholder="ex.: Refrativa AO" /></Campo>
        <Campo rotulo="Data da cirurgia"><input type="date" value={f.data_cirurgia} onChange={set("data_cirurgia")} /></Campo>
      </div>
      <div className="campo">
        Paciente (opcional)
        {pac ? (
          <div className="linha"><b>{nomeExibicao(pac)}</b><span className="muted pequeno">Pront. {pac.numero_prontuario}</span>
            {!conta && <button className="sutil" onClick={() => setPac(null)}>trocar</button>}</div>
        ) : <BuscaPaciente aoEscolher={setPac} />}
      </div>
      <div className="grade g3">
        <Campo rotulo="Valor total da cirurgia (R$)"><input inputMode="decimal" value={f.valor} onChange={set("valor")} placeholder="ex.: 4820,00" /></Campo>
        <Campo rotulo="Forma de pagamento">
          <select value={f.forma} onChange={set("forma")}>{Object.entries(FORMAS_REPASSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Campo>
        {f.forma === "credito" ? (
          <Campo rotulo="Parcelas">
            <select value={f.parcelas} onChange={set("parcelas")}>
              <option value="1">1x (à vista)</option>
              {base.taxas.map((t) => <option key={t.id} value={t.parcelas}>{t.parcelas}x · taxa {pct(t.taxa_total)}</option>)}
            </select>
          </Campo>
        ) : <span />}
      </div>
      <Campo rotulo={f.forma === "credito" ? "Data da venda no cartão" : "Data do pagamento"}><input type="date" style={{ maxWidth: 180 }} value={f.data_pagamento} onChange={set("data_pagamento")} /></Campo>
      <Campo rotulo="Observações (opcional)"><input value={f.observacoes} onChange={set("observacoes")} /></Campo>

      {prev && (
        <div className="painel" style={{ marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>Prévia do cálculo</h2>
          <table className="tabela">
            <tbody>
              <tr><td>Valor da cirurgia</td><td style={num}>{fmtMoeda(valor)}</td></tr>
              <tr><td>1. Imposto ({pct(base.cfg.imposto_pct)} do total)</td><td style={num}>− {fmtMoeda(prev.imposto)}</td></tr>
              <tr><td>2. Centro cirúrgico ({pct(base.cfg.centro_cirurgico_pct)} do que sobra: {fmtMoeda(valor - prev.imposto)})</td><td style={num}>− {fmtMoeda(prev.centro)}</td></tr>
              {n === 1 && (f.forma === "dinheiro" || f.forma === "pix") && (
                <tr><td><b>3. Médico</b></td><td style={num}><b>{fmtMoeda(valor - prev.imposto - prev.centro)}</b></td></tr>
              )}
            </tbody>
          </table>
          {n === 1 && (f.forma === "debito" || f.forma === "credito") && (
            <p className="muted pequeno">No {f.forma === "debito" ? "débito" : "crédito à vista"} não há taxa interna. O médico recebe o que a maquininha depositar, menos imposto e centro cirúrgico.
              Depois de lançar, digite o valor que entrou.</p>
          )}
          {n > 1 && prev.sim && (
            <>
              <p className="pequeno">Em cada uma das {n} parcelas: imposto <b>{fmtMoeda(prev.imps[0])}</b> · centro cirúrgico <b>{fmtMoeda(prev.ccs[0])}</b>
                {prev.imps[n - 1] !== prev.imps[0] || prev.ccs[n - 1] !== prev.ccs[0] ? <> (a última parcela leva a sobra de centavos: {fmtMoeda(prev.imps[n - 1])} e {fmtMoeda(prev.ccs[n - 1])})</> : null}
                {" "}· taxa interna <b>{pct(taxaPct!)}</b> do valor que entrar (centavos {base.cfg.taxa_arredondamento === "truncar" ? "cortados" : "arredondados"}).</p>
              <p className="muted pequeno">Só para ter uma ideia: se cada parcela entrasse inteira ({fmtMoeda(prev.bruta)}), o médico receberia cerca de {fmtMoeda(prev.sim.medico)} por parcela.
                Na prática entra um pouco menos, porque a maquininha desconta a taxa dela. O valor certo sai quando você digitar quanto entrou em cada parcela.</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ detalhe
export function RepasseDetalhe() {
  const { id } = useParams();
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [cancelar, setCancelar] = useState(false);
  const { dados, erro: e1, carregando, recarregar } = useCarregar(async () => {
    const r = ok(await supabase.from("repasses").select(SEL).eq("id", id!).single()) as Repasse;
    r.repasse_parcelas = (r.repasse_parcelas ?? []).sort((a, b) => a.numero - b.numero);
    return r;
  }, [id]);
  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    if (dados) setValores(Object.fromEntries((dados.repasse_parcelas ?? []).map((p) => [p.id, p.valor_recebido === null ? "" : String(p.valor_recebido).replace(".", ",")])));
  }, [dados]);

  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Aviso>{e1}</Aviso>;
  const r = dados;
  const ps = r.repasse_parcelas ?? [];
  const ativo = r.status !== "cancelado";
  const recebido = soma(ps, "valor_recebido");
  const todasEntraram = ps.every((p) => p.valor_recebido !== null);
  // previsão das parcelas que ainda não entraram: mesmo valor da última que entrou
  const previsao = [...ps].reverse().find((p) => p.valor_recebido !== null)?.valor_recebido ?? null;

  async function atualizar(p: Parcela, campos: Record<string, unknown>, msg: string) {
    setErro(""); setOkMsg("");
    const { error } = await supabase.from("repasse_parcelas").update(campos).eq("id", p.id);
    if (error) return setErro(msgErro(error));
    setOkMsg(msg); recarregar();
  }
  async function salvarValor(p: Parcela) {
    const t = valores[p.id]?.trim() ?? "";
    const v = t === "" ? null : numOuNulo(t);
    if (t !== "" && (v === null || v < 0)) return setErro(`Valor inválido na parcela ${p.numero}.`);
    if (v === (p.valor_recebido === null ? null : Number(p.valor_recebido))) return;
    await atualizar(p, { valor_recebido: v, recebido_em: v === null ? null : p.recebido_em ?? isoDia(new Date()) }, `Parcela ${p.numero} atualizada.`);
  }
  async function cancelarRepasse(motivo: string) {
    setErro(""); setOkMsg("");
    const { error } = await supabase.from("repasses").update({ status: "cancelado", motivo_cancelamento: motivo }).eq("id", r.id);
    setCancelar(false);
    if (error) return setErro(msgErro(error));
    recarregar();
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <div className="linha"><h1 style={{ margin: 0 }}>Repasse nº {r.numero}</h1><Etiqueta cor={STATUS[r.status].cor}>{STATUS[r.status].rotulo}</Etiqueta></div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            <b>{r.profissionais?.nome}</b> · {r.procedimento} · cirurgia em {fmtData(r.data_cirurgia)}
            {r.pacientes && <> · {r.paciente_id ? <Link to={`/pacientes/${r.paciente_id}`}>{nomeExibicao(r.pacientes)}</Link> : nomeExibicao(r.pacientes)} (pront. {r.pacientes.numero_prontuario})</>}
            {r.conta_id && <> · <Link to={`/faturamento/conta/${r.conta_id}`}>ver conta</Link></>}
          </p>
        </div>
        <div className="linha">
          <Link className="botao" to="/repasse">← Lista</Link>
          <button onClick={() => window.print()}>🖨️ Imprimir</button>
          {ativo && <button className="perigo" onClick={() => setCancelar(true)}>Cancelar repasse</button>}
        </div>
      </div>
      <Aviso>{erro || e1}</Aviso>
      <Aviso tipo="ok">{okMsg}</Aviso>
      {r.status === "cancelado" && <Aviso tipo="alerta">Repasse cancelado: {r.motivo_cancelamento}</Aviso>}

      <div className="painel">
        <h2>Resumo</h2>
        <table className="tabela" style={{ maxWidth: 640 }}>
          <tbody>
            <tr><td>Valor da cirurgia · {FORMAS_REPASSE[r.forma_pagamento]}{r.parcelas > 1 ? ` em ${r.parcelas}x` : ""}</td><td style={num}><b>{fmtMoeda(r.valor_total)}</b></td></tr>
            <tr><td>Imposto ({pct(r.imposto_pct)} do total)</td><td style={num}>{fmtMoeda(r.imposto_total)}</td></tr>
            <tr><td>Centro cirúrgico ({pct(r.centro_cirurgico_pct)} do que sobra)</td><td style={num}>{fmtMoeda(r.centro_cirurgico_total)}</td></tr>
            {r.taxa_interna_pct > 0 && <tr><td>Taxa interna retida ({pct(r.taxa_interna_pct)} de cada parcela que entra)</td><td style={num}>{fmtMoeda(soma(ps, "taxa_interna"))}{!todasEntraram && " até agora"}</td></tr>}
            {r.forma_pagamento !== "dinheiro" && r.forma_pagamento !== "pix" && todasEntraram && (
              <tr><td>Taxa já descontada pela maquininha</td><td style={num}>{fmtMoeda(r.valor_total - recebido)}</td></tr>
            )}
            <tr><td><b>Médico</b>{!todasEntraram && " (das parcelas que já entraram)"}</td><td style={num}><b>{fmtMoeda(soma(ps, "medico"))}</b></td></tr>
            <tr><td className="muted">Já pago ao médico / falta pagar</td><td style={num} className="muted">
              {fmtMoeda(soma(ps.filter((p) => p.pago_medico_em), "medico"))} / {fmtMoeda(soma(ps.filter((p) => !p.pago_medico_em), "medico"))}</td></tr>
          </tbody>
        </table>
        {r.observacoes && <p className="muted pequeno">Obs.: {r.observacoes}</p>}
      </div>

      <div className="painel">
        <h2>Parcelas</h2>
        {ativo && r.forma_pagamento !== "dinheiro" && r.forma_pagamento !== "pix" && (
          <p className="muted pequeno">Digite quanto <b>realmente entrou</b> em cada parcela (o valor que a maquininha depositou) e saia do campo: o sistema calcula a parte do médico.</p>
        )}
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Parcela</th><th>Prevista</th><th style={num}>Entrou</th><th style={num}>Imposto</th><th style={num}>Centro cir.</th>
              <th style={num}>Taxa interna</th><th style={num}>Médico</th><th>Pago ao médico</th></tr></thead>
            <tbody>
              {ps.map((p) => {
                const editavel = ativo && !p.pago_medico_em;
                return (
                  <tr key={p.id}>
                    <td>{p.numero}/{r.parcelas}</td>
                    <td>{fmtData(p.data_prevista)}</td>
                    <td style={num}>
                      {editavel ? (
                        <div className="linha" style={{ justifyContent: "flex-end", gap: 4 }}>
                          <input style={{ width: 110, textAlign: "right" }} inputMode="decimal" aria-label={`Valor que entrou na parcela ${p.numero}`}
                            value={valores[p.id] ?? ""} onChange={(e) => setValores({ ...valores, [p.id]: e.target.value })} onBlur={() => salvarValor(p)}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="0,00" />
                        </div>
                      ) : fmtMoeda(p.valor_recebido)}
                      {p.recebido_em && <div className="muted pequeno">em {fmtData(p.recebido_em)}</div>}
                    </td>
                    <td style={num}>{fmtMoeda(p.imposto)}</td>
                    <td style={num}>{fmtMoeda(p.centro_cirurgico)}</td>
                    <td style={num}>{p.valor_recebido === null ? "—" : fmtMoeda(p.taxa_interna)}</td>
                    <td style={num}>{p.valor_recebido === null
                      ? <><span className="muted">aguardando</span>{previsao && <div className="muted pequeno" title="Se entrar o mesmo valor da última parcela recebida">previsão {fmtMoeda(calcularParcela(previsao, p.imposto, p.centro_cirurgico, r.taxa_interna_pct, r.taxa_arredondamento).medico)}</div>}</>
                      : <b>{fmtMoeda(p.medico)}</b>}</td>
                    <td>
                      {p.pago_medico_em ? (
                        <span className="linha">✅ {fmtData(p.pago_medico_em)}
                          {ativo && <button className="sutil pequeno" onClick={() => confirm(`Desmarcar o pagamento da parcela ${p.numero}?`) && atualizar(p, { pago_medico_em: null }, `Pagamento da parcela ${p.numero} desmarcado.`)}>desfazer</button>}</span>
                      ) : ativo && p.valor_recebido !== null ? (
                        <button className="pequeno" onClick={() => atualizar(p, { pago_medico_em: isoDia(new Date()) }, `Parcela ${p.numero} marcada como paga ao médico.`)}>Marcar pago hoje</button>
                      ) : <span className="muted pequeno">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {ps.length > 1 && (
              <tfoot><tr><th colSpan={2}>Total</th><th style={num}>{fmtMoeda(recebido)}</th><th style={num}>{fmtMoeda(soma(ps, "imposto"))}</th>
                <th style={num}>{fmtMoeda(soma(ps, "centro_cirurgico"))}</th><th style={num}>{fmtMoeda(soma(ps, "taxa_interna"))}</th>
                <th style={num}>{fmtMoeda(soma(ps, "medico"))}</th><th></th></tr></tfoot>
            )}
          </table>
        </div>
      </div>
      {cancelar && <CancelarRepasse aoFechar={() => setCancelar(false)} aoConfirmar={cancelarRepasse} />}
    </div>
  );
}

function CancelarRepasse({ aoFechar, aoConfirmar }: { aoFechar: () => void; aoConfirmar: (m: string) => void }) {
  const [m, setM] = useState("");
  return (
    <Modal titulo="Cancelar repasse" aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Voltar</button><button className="perigo" disabled={!m.trim()} onClick={() => aoConfirmar(m.trim())}>Cancelar repasse</button></>}>
      <p>O repasse fica guardado como cancelado (não é apagado). Para corrigir valor, forma de pagamento ou médico, cancele e lance de novo.</p>
      <Campo rotulo="Motivo"><input autoFocus value={m} onChange={(e) => setM(e.target.value)} placeholder="ex.: lançado com valor errado" /></Campo>
    </Modal>
  );
}

// ------------------------------------------------------------------ relatório por médico
interface LinhaRel extends Parcela { repasses: Pick<Repasse, "numero" | "procedimento" | "data_cirurgia" | "profissional_id" | "forma_pagamento" | "parcelas" | "status"> & { profissionais: { nome: string } | null; pacientes: { nome: string; nome_social: string | null } | null } }

function RelatorioMedicos({ medicos }: { medicos: Medico[] }) {
  const [f, setF] = useState({ de: primeiroDiaMes(), ate: isoDia(new Date()), medico: "todos", situacao: "todas" });
  const { dados, erro, carregando } = useCarregar(async () => {
    const q = supabase.from("repasse_parcelas")
      .select("*, repasses!inner(numero, procedimento, data_cirurgia, profissional_id, forma_pagamento, parcelas, status, profissionais(nome), pacientes(nome, nome_social))")
      .not("valor_recebido", "is", null).gte("recebido_em", f.de).lte("recebido_em", f.ate).neq("repasses.status", "cancelado")
      .order("recebido_em").limit(5000);
    return ok(await (f.medico === "todos" ? q : q.eq("repasses.profissional_id", f.medico))) as LinhaRel[];
  }, [f.de, f.ate, f.medico]);

  const linhas = (dados ?? []).filter((l) => f.situacao === "todas" || (f.situacao === "pagar" ? !l.pago_medico_em : !!l.pago_medico_em));
  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; ls: LinhaRel[] }>();
    for (const l of linhas) {
      const k = l.repasses.profissional_id;
      const g = m.get(k) ?? { nome: l.repasses.profissionais?.nome ?? "", ls: [] };
      g.ls.push(l); m.set(k, g);
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [linhas]);

  function exportarCSV() {
    const cab = ["Medico", "Repasse", "Procedimento", "Cirurgia", "Pagamento", "Parcela", "Entrou em", "Entrou", "Imposto", "Centro cirurgico", "Taxa interna", "Medico", "Pago ao medico em"];
    const v = (x: number | null) => (x === null ? "" : Number(x).toFixed(2).replace(".", ","));
    const corpo = linhas.map((l) => [l.repasses.profissionais?.nome ?? "", l.repasses.numero, l.repasses.procedimento, l.repasses.data_cirurgia,
      FORMAS_REPASSE[l.repasses.forma_pagamento], `${l.numero}/${l.repasses.parcelas}`, l.recebido_em ?? "", v(l.valor_recebido), v(l.imposto),
      v(l.centro_cirurgico), v(l.taxa_interna), v(l.medico), l.pago_medico_em ?? ""]);
    const csv = [cab, ...corpo].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `repasse_${f.de}_a_${f.ate}.csv`; a.click();
  }

  return (
    <div>
      <div className="painel linha">
        <label className="linha pequeno muted">parcelas que entraram de <input type="date" style={{ width: 150 }} value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></label>
        <label className="linha pequeno muted">até <input type="date" style={{ width: 150 }} value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></label>
        <select style={{ width: 200 }} value={f.medico} onChange={(e) => setF({ ...f, medico: e.target.value })}>
          <option value="todos">Todos os médicos</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <select style={{ width: 170 }} value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value })}>
          <option value="todas">Pagas e a pagar</option><option value="pagar">Só a pagar</option><option value="pagas">Só já pagas</option>
        </select>
        <span style={{ marginLeft: "auto" }} />
        <button disabled={!linhas.length} onClick={exportarCSV}>⬇️ Planilha</button>
        <button onClick={() => window.print()}>🖨️ Imprimir</button>
      </div>
      <Aviso>{erro}</Aviso>
      {carregando && !dados ? <Carregando /> : grupos.length === 0 ? <div className="painel vazio">Nenhuma parcela entrou neste período.</div> : (
        <>
          <div className="painel rolagem">
            <h2>Resumo do período</h2>
            <table className="tabela">
              <thead><tr><th>Médico</th><th>Parcelas</th><th style={num}>Entrou</th><th style={num}>Imposto</th><th style={num}>Centro cir.</th>
                <th style={num}>Taxa interna</th><th style={num}>Médico</th><th style={num}>Já pago</th><th style={num}>A pagar</th></tr></thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.nome}><td><b>{g.nome}</b></td><td>{g.ls.length}</td><td style={num}>{fmtMoeda(soma(g.ls, "valor_recebido"))}</td>
                    <td style={num}>{fmtMoeda(soma(g.ls, "imposto"))}</td><td style={num}>{fmtMoeda(soma(g.ls, "centro_cirurgico"))}</td>
                    <td style={num}>{fmtMoeda(soma(g.ls, "taxa_interna"))}</td><td style={num}><b>{fmtMoeda(soma(g.ls, "medico"))}</b></td>
                    <td style={num}>{fmtMoeda(soma(g.ls.filter((l) => l.pago_medico_em), "medico"))}</td>
                    <td style={num}>{fmtMoeda(soma(g.ls.filter((l) => !l.pago_medico_em), "medico"))}</td></tr>
                ))}
              </tbody>
              {grupos.length > 1 && (
                <tfoot><tr><th>Total</th><th>{linhas.length}</th><th style={num}>{fmtMoeda(soma(linhas, "valor_recebido"))}</th><th style={num}>{fmtMoeda(soma(linhas, "imposto"))}</th>
                  <th style={num}>{fmtMoeda(soma(linhas, "centro_cirurgico"))}</th><th style={num}>{fmtMoeda(soma(linhas, "taxa_interna"))}</th>
                  <th style={num}>{fmtMoeda(soma(linhas, "medico"))}</th><th style={num}>{fmtMoeda(soma(linhas.filter((l) => l.pago_medico_em), "medico"))}</th>
                  <th style={num}>{fmtMoeda(soma(linhas.filter((l) => !l.pago_medico_em), "medico"))}</th></tr></tfoot>
              )}
            </table>
          </div>
          {grupos.map((g) => (
            <div className="painel rolagem" key={g.nome}>
              <h2>{g.nome}</h2>
              <table className="tabela">
                <thead><tr><th>Entrou em</th><th>Repasse</th><th>Paciente / procedimento</th><th>Parcela</th><th style={num}>Entrou</th>
                  <th style={num}>Imposto</th><th style={num}>Centro cir.</th><th style={num}>Taxa</th><th style={num}>Médico</th><th>Pago em</th></tr></thead>
                <tbody>
                  {g.ls.map((l) => (
                    <tr key={l.id}><td>{fmtData(l.recebido_em)}</td><td><Link to={`/repasse/${l.repasse_id}`}>nº {l.repasses.numero}</Link></td>
                      <td>{l.repasses.pacientes ? nomeExibicao(l.repasses.pacientes) : "—"}<div className="muted pequeno">{l.repasses.procedimento} · {fmtData(l.repasses.data_cirurgia)}</div></td>
                      <td>{l.numero}/{l.repasses.parcelas}<div className="muted pequeno">{FORMAS_REPASSE[l.repasses.forma_pagamento]}</div></td>
                      <td style={num}>{fmtMoeda(l.valor_recebido)}</td><td style={num}>{fmtMoeda(l.imposto)}</td><td style={num}>{fmtMoeda(l.centro_cirurgico)}</td>
                      <td style={num}>{fmtMoeda(l.taxa_interna)}</td><td style={num}><b>{fmtMoeda(l.medico)}</b></td>
                      <td>{l.pago_medico_em ? fmtData(l.pago_medico_em) : <Etiqueta cor="amarelo">a pagar</Etiqueta>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ regras e taxas
function Regras({ cfg, taxas, aoMudar }: { cfg: Config; taxas: TaxaCartao[]; aoMudar: () => void }) {
  const [c, setC] = useState({ imposto: String(cfg.imposto_pct).replace(".", ","), centro: String(cfg.centro_cirurgico_pct).replace(".", ","), arred: cfg.taxa_arredondamento });
  const [t, setT] = useState<Record<string, { cartao: string; antecipacao: string }>>(
    Object.fromEntries(taxas.map((x) => [x.id, { cartao: String(x.taxa_cartao).replace(".", ","), antecipacao: String(x.taxa_antecipacao).replace(".", ",") }])),
  );
  const [nova, setNova] = useState({ parcelas: "", cartao: "", antecipacao: "" });
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const valido = (v: number | null) => v !== null && v >= 0 && v <= 100;

  async function salvarRegras() {
    setErro(""); setOkMsg("");
    const imp = numOuNulo(c.imposto), cc = numOuNulo(c.centro);
    if (!valido(imp) || !valido(cc)) return setErro("Porcentagens devem ficar entre 0 e 100.");
    if (!confirm("As novas porcentagens valem só para os repasses lançados daqui para a frente. Os já lançados não mudam. Confirmar?")) return;
    const { error } = await supabase.from("repasse_config").update({ imposto_pct: imp, centro_cirurgico_pct: cc, taxa_arredondamento: c.arred }).eq("id", cfg.id);
    if (error) return setErro(msgErro(error));
    setOkMsg("Regras salvas."); aoMudar();
  }
  async function salvarTaxas() {
    setErro(""); setOkMsg("");
    for (const x of taxas) {
      const a = numOuNulo(t[x.id]?.cartao), b = numOuNulo(t[x.id]?.antecipacao);
      if (!valido(a) || !valido(b)) return setErro(`Taxa inválida em ${x.parcelas}x.`);
      if (a === Number(x.taxa_cartao) && b === Number(x.taxa_antecipacao)) continue;
      const { error } = await supabase.from("repasse_taxas_cartao").update({ taxa_cartao: a, taxa_antecipacao: b }).eq("id", x.id);
      if (error) return setErro(`${x.parcelas}x: ${msgErro(error)}`);
    }
    setOkMsg("Taxas salvas. Valem para os repasses lançados daqui para a frente."); aoMudar();
  }
  async function incluir() {
    setErro(""); setOkMsg("");
    const n = Number(nova.parcelas), a = numOuNulo(nova.cartao), b = numOuNulo(nova.antecipacao);
    if (!(n >= 2 && n <= 24) || !valido(a) || !valido(b)) return setErro("Preencha parcelas (2 a 24) e as duas taxas.");
    const { error } = await supabase.from("repasse_taxas_cartao").insert({ parcelas: n, taxa_cartao: a, taxa_antecipacao: b });
    if (error) return setErro(msgErro(error));
    setNova({ parcelas: "", cartao: "", antecipacao: "" }); aoMudar();
  }

  return (
    <div>
      <Aviso>{erro}</Aviso>
      <Aviso tipo="ok">{okMsg}</Aviso>
      <div className="painel">
        <h2>Regras da divisão</h2>
        <ol className="pequeno">
          <li><b>Imposto</b>: % do valor total da cirurgia.</li>
          <li><b>Centro cirúrgico</b>: % do que sobra depois do imposto.</li>
          <li><b>Taxa interna</b>: só no crédito parcelado (2x ou mais), pela tabela abaixo, sobre o valor que entrou em cada parcela. Dinheiro, PIX, débito e crédito 1x: sem taxa interna.</li>
          <li><b>Médico</b>: o que realmente entrou − imposto − centro cirúrgico − taxa interna. (No cartão, a taxa da maquininha fica com o médico.)</li>
        </ol>
        <p className="muted pequeno">Imposto e centro cirúrgico são divididos igualmente entre as parcelas; a sobra de centavos fica na última. O médico recebe conforme cada parcela entra.</p>
        <div className="grade g3" style={{ maxWidth: 640 }}>
          <Campo rotulo="Imposto (%)"><input inputMode="decimal" value={c.imposto} onChange={(e) => setC({ ...c, imposto: e.target.value })} /></Campo>
          <Campo rotulo="Centro cirúrgico (%)"><input inputMode="decimal" value={c.centro} onChange={(e) => setC({ ...c, centro: e.target.value })} /></Campo>
          <Campo rotulo="Centavos da taxa interna">
            <select value={c.arred} onChange={(e) => setC({ ...c, arred: e.target.value as Config["taxa_arredondamento"] })}>
              <option value="truncar">Cortar (ex.: 41,187 → 41,18)</option><option value="arredondar">Arredondar (ex.: 41,187 → 41,19)</option>
            </select>
          </Campo>
        </div>
        <button className="primario" onClick={salvarRegras}>Salvar regras</button>
      </div>

      <div className="painel rolagem">
        <h2>Tabela de taxas do crédito parcelado</h2>
        <p className="muted pequeno">Taxa interna = taxa do cartão + taxa de antecipação. Mudanças valem só para repasses lançados depois.</p>
        <table className="tabela" style={{ maxWidth: 560 }}>
          <thead><tr><th>Parcelas</th><th>Taxa do cartão (%)</th><th>Antecipação (%)</th><th style={num}>Taxa total</th></tr></thead>
          <tbody>
            {taxas.map((x) => {
              const a = numOuNulo(t[x.id]?.cartao) ?? 0, b = numOuNulo(t[x.id]?.antecipacao) ?? 0;
              return (
                <tr key={x.id}><td><b>{x.parcelas}x</b></td>
                  <td><input style={{ width: 90 }} inputMode="decimal" value={t[x.id]?.cartao ?? ""} onChange={(e) => setT({ ...t, [x.id]: { ...t[x.id], cartao: e.target.value } })} /></td>
                  <td><input style={{ width: 90 }} inputMode="decimal" value={t[x.id]?.antecipacao ?? ""} onChange={(e) => setT({ ...t, [x.id]: { ...t[x.id], antecipacao: e.target.value } })} /></td>
                  <td style={num}><b>{pct(Math.round((a + b) * 100) / 100)}</b></td></tr>
              );
            })}
            <tr><td><input style={{ width: 60 }} inputMode="numeric" placeholder="13" value={nova.parcelas} onChange={(e) => setNova({ ...nova, parcelas: e.target.value })} aria-label="Parcelas da nova taxa" /></td>
              <td><input style={{ width: 90 }} inputMode="decimal" value={nova.cartao} onChange={(e) => setNova({ ...nova, cartao: e.target.value })} aria-label="Taxa do cartão da nova linha" /></td>
              <td><input style={{ width: 90 }} inputMode="decimal" value={nova.antecipacao} onChange={(e) => setNova({ ...nova, antecipacao: e.target.value })} aria-label="Antecipação da nova linha" /></td>
              <td><button className="pequeno" onClick={incluir}>➕ Incluir</button></td></tr>
          </tbody>
        </table>
        <button className="primario" onClick={salvarTaxas}>Salvar taxas</button>
      </div>
    </div>
  );
}
