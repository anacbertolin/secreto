// Repasse médico (área do Luciano, administrador) — migrações 0060–0062.
// Regra geral (0070): bruto − imposto − taxa do cartão − custos (sala, instrumentação, auxiliar, insumos) = honorários;
// 20% clínica e 80% médico.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo, BuscaPaciente, type PacienteResumo } from "../components/ui";
import { fmtData, fmtMoeda, isoDia, nomeExibicao, numOuNulo } from "../lib/util";
import { nomePor } from "../lib/dados";
import {
  FORMAS_REPASSE, REGRAS, TIPOS_CUSTO, calcularRepasse, custoDaClinica, partesPorParcela, taxaInternaPct, type RegrasRepasse, type TaxaCartao,
} from "../lib/repasse";

// ------------------------------------------------------------------ tipos
interface Parcela {
  id: string; repasse_id: string; numero: number; data_prevista: string; valor: number | null; valor_recebido: number | null; recebido_em: string | null;
  imposto: number; custos: number; centro_cirurgico: number; taxa_interna: number | null; medico: number | null; pago_medico_em: string | null;
}
interface Custo {
  id: string; repasse_id: string; tipo: string; descricao: string; valor: number; favorecido_profissional_id: string | null;
  favorecido_nome: string | null; pago_em: string | null; ordem: number; profissionais?: { nome: string } | null;
}
interface ProcCusto { id?: string; tipo: string; descricao: string; valor: number; favorecido_profissional_id: string | null; favorecido_nome: string | null; ordem: number }
interface Procedimento { id: string; nome: string; regra: string; profissional_id: string | null; valor_sugerido: number | null; observacoes: string | null; ativo: boolean; repasse_procedimento_custos: ProcCusto[] }
/** custo sendo digitado na tela */
interface CustoEdit { tipo: string; descricao: string; valor: string; favorecido_profissional_id: string; favorecido_nome: string }
interface Repasse {
  id: string; numero: number; conta_id: string | null; paciente_id: string | null; profissional_id: string; procedimento: string;
  data_cirurgia: string; data_pagamento: string; valor_total: number; forma_pagamento: string; parcelas: number;
  imposto_pct: number; centro_cirurgico_pct: number; taxa_interna_pct: number; taxa_arredondamento: "truncar" | "arredondar";
  imposto_total: number; centro_cirurgico_total: number; taxa_interna_total: number; medico_total: number; custos_total: number;
  procedimento_id: string | null; regra: string; status: string; motivo_cancelamento: string | null; observacoes: string | null;
  pacientes?: { nome: string; nome_social: string | null; numero_prontuario: number } | null;
  profissionais?: { nome: string } | null;
  repasse_parcelas?: Parcela[];
  repasse_custos?: Custo[];
}
interface Config extends RegrasRepasse { id: string }
interface Medico { id: string; nome: string }

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  aberto: { rotulo: "Em andamento", cor: "amarelo" },
  concluido: { rotulo: "Médico pago", cor: "verde" },
  cancelado: { rotulo: "Cancelado", cor: "cinza" },
};
const SEL = "*, pacientes(nome, nome_social, numero_prontuario), profissionais!repasses_profissional_id_fkey(nome), repasse_parcelas(*), repasse_custos(*, profissionais(nome))";
const favorecido = (c: { favorecido_nome: string | null; profissionais?: { nome: string } | null }) => c.profissionais?.nome ?? c.favorecido_nome ?? "";
const num = { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };
const pct = (v: number) => `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
const soma = (ps: Parcela[], k: keyof Parcela) => ps.reduce((s, p) => s + Number(p[k] ?? 0), 0);
function primeiroDiaMes(d = new Date()) { return isoDia(new Date(d.getFullYear(), d.getMonth(), 1)); }

async function carregarBase() {
  const [cfg, taxas, medicos, procedimentos, lentes] = await Promise.all([
    supabase.from("repasse_config").select("*").single().then((x) => ok(x) as Config),
    supabase.from("repasse_taxas_cartao").select("*").order("forma", { ascending: false }).order("parcelas").then((x) => ok(x) as TaxaCartao[]),
    supabase.from("profissionais").select("id, nome").eq("funcao", "medico").order("nome").then((x) => ok(x) as Medico[]),
    supabase.from("repasse_procedimentos").select("*, repasse_procedimento_custos(*)").order("nome").then((x) => ok(x) as Procedimento[]),
    supabase.from("lentes_catalogo").select("id, codigo, descricao, fabricante, custo_compra, preco_venda").eq("ativo", true).order("preco_venda").order("custo_compra")
      .then((x) => ok(x) as { id: string; codigo: string; descricao: string; fabricante: string; custo_compra: number | null; preco_venda: number | null }[]),
  ]);
  for (const p of procedimentos) p.repasse_procedimento_custos.sort((a, b) => a.ordem - b.ordem);
  return { cfg, taxas, medicos, procedimentos, lentes };
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
          <p className="sub" style={{ margin: 0 }}>Cirurgia particular: valor − imposto − taxa do cartão − custos (sala, instrumentação, auxiliar) = honorários → 20% clínica, 80% médico</p>
        </div>
      </div>
      <Aviso>{base.erro}</Aviso>
      <div className="abas">
        <button className={aba === "lancamentos" ? "ativa" : ""} onClick={() => setParams({ aba: "lancamentos" })}>Lançamentos</button>
        <button className={aba === "medicos" ? "ativa" : ""} onClick={() => setParams({ aba: "medicos" })}>Relatório por médico</button>
        <button className={aba === "regras" ? "ativa" : ""} onClick={() => setParams({ aba: "regras" })}>Regras e taxas</button>
        <button className={aba === "lentes" ? "ativa" : ""} onClick={() => setParams({ aba: "lentes" })}>Lentes</button>
      </div>
      {base.dados && aba === "lancamentos" && <Lancamentos base={base.dados} />}
      {base.dados && aba === "medicos" && <RelatorioMedicos medicos={base.dados.medicos} />}
      {base.dados && aba === "regras" && <Regras cfg={base.dados.cfg} taxas={base.dados.taxas} aoMudar={base.recarregar} />}
      {aba === "lentes" && <LentesCatalogo />}
      {base.dados && aba === "regras" && <Procedimentos procs={base.dados.procedimentos} medicos={base.dados.medicos} aoMudar={base.recarregar} />}
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
                const entrou = ps.filter((p) => p.recebido_em).length;
                const pagas = ps.filter((p) => p.pago_medico_em).length;
                return (
                  <tr key={r.id} className="clicavel" onClick={() => nav(`/repasse/${r.id}`)}>
                    <td>{r.numero}</td>
                    <td>{fmtData(r.data_cirurgia)}</td>
                    <td><b>{r.profissionais?.nome}</b></td>
                    <td>{r.pacientes ? nomeExibicao(r.pacientes) : <span className="muted">—</span>}<div className="muted pequeno">{r.procedimento}</div>{r.regra && r.regra !== "geral" && <Etiqueta cor="roxo">{r.regra === "cobranca" ? "médico deve" : "parceiro"}</Etiqueta>}</td>
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
  const [f, setF] = useState({ regra: "geral", profissional_id: "", procedimento_id: "", procedimento: "", data_cirurgia: hoje, data_pagamento: hoje, valor: "", forma: "pix", parcelas: "12", observacoes: "" });
  const [pac, setPac] = useState<PacienteResumo | { id: string; nome: string; nome_social: string | null; numero_prontuario: number } | null>(null);
  const [conta, setConta] = useState<string | null>(null);
  const [custos, setCustos] = useState<CustoEdit[]>([]);
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

  const cobranca = f.regra === "cobranca";
  const custosNum = custos.map((c) => numOuNulo(c.valor));
  const custosTotal = custosNum.reduce<number>((s, v) => s + (v ?? 0), 0);
  const valor = cobranca ? custosTotal : numOuNulo(f.valor) ?? 0;
  const n = !cobranca && f.forma === "credito" ? Number(f.parcelas) : 1;
  const taxaPct = cobranca ? 0 : taxaInternaPct(f.forma, n, base.taxas);
  const prev = useMemo(() => {
    if (cobranca || valor <= 0 || taxaPct === null) return null; // cobrança: não há divisão
    const t = calcularRepasse(valor, base.cfg, taxaPct, custosTotal, f.regra);
    return { ...t, medParc: partesPorParcela(t.medico, n) };
  }, [cobranca, valor, n, taxaPct, base.cfg, custosTotal, f.regra]);
  const procsDoMedico = base.procedimentos.filter((p) => p.ativo && (!p.profissional_id || !f.profissional_id || p.profissional_id === f.profissional_id));

  function escolherProcedimento(id: string) {
    const p = base.procedimentos.find((x) => x.id === id);
    setF((x) => ({
      ...x, procedimento_id: id, regra: p?.regra ?? x.regra,
      procedimento: p ? p.nome : x.procedimento,
      profissional_id: x.profissional_id || p?.profissional_id || "",
      valor: p?.valor_sugerido && !numOuNulo(x.valor) ? String(p.valor_sugerido).replace(".", ",") : x.valor,
    }));
    setCustos((p?.repasse_procedimento_custos ?? []).map((c) => ({
      tipo: c.tipo, descricao: c.descricao, valor: String(c.valor).replace(".", ","),
      favorecido_profissional_id: c.favorecido_profissional_id ?? "", favorecido_nome: c.favorecido_nome ?? "",
    })));
  }

  /** venda de lente ao paciente: valor = preço de venda; o custo da lente sai antes da divisão (regra geral) */
  function escolherLente(id: string) {
    const l = base.lentes.find((x) => x.id === id);
    if (!l) return;
    setF((x) => ({ ...x, regra: "geral", procedimento_id: "", procedimento: `Lente ${l.descricao} (${l.codigo})`,
      valor: l.preco_venda ? String(l.preco_venda).replace(".", ",") : x.valor }));
    setCustos([{ tipo: "insumo", descricao: `Lente ${l.codigo} (custo de compra)`, valor: String(l.custo_compra ?? 0).replace(".", ","), favorecido_profissional_id: "", favorecido_nome: "" }]);
  }

  async function salvar() {
    setErro("");
    if (!f.profissional_id) return setErro("Escolha o médico.");
    if (!f.procedimento.trim()) return setErro("Informe o procedimento (ex.: Refrativa AO).");
    if (valor <= 0) return setErro(cobranca ? "Informe o que o médico deve (taxa de sala, lente…)." : "Informe o valor total da cirurgia.");
    if (taxaPct === null) return setErro(`Não há taxa cadastrada para ${n}x. Cadastre na aba "Regras e taxas".`);
    for (const [i, c] of custos.entries()) {
      if (!c.descricao.trim()) return setErro(`Descreva o custo da linha ${i + 1}.`);
      if (custosNum[i] === null || custosNum[i]! < 0) return setErro(`Valor inválido no custo "${c.descricao}".`);
    }
    if (prev && prev.sobra < 0) return setErro("Imposto, taxa e custos passam do valor da cirurgia. Confira os valores.");
    setSalvando(true);
    const { data, error } = await supabase.rpc("repasse_lancar", { p: {
      conta_id: conta, paciente_id: pac?.id ?? null, profissional_id: f.profissional_id, procedimento_id: f.procedimento_id || null,
      regra: f.regra, procedimento: f.procedimento.trim(), data_cirurgia: f.data_cirurgia, data_pagamento: f.data_pagamento, valor_total: valor,
      forma_pagamento: f.forma, parcelas: n, observacoes: f.observacoes.trim() || null,
      custos: custos.map((c, i) => ({ tipo: c.tipo, descricao: c.descricao.trim(), valor: custosNum[i],
        favorecido_profissional_id: c.favorecido_profissional_id || null, favorecido_nome: c.favorecido_nome.trim() || null })),
    } });
    setSalvando(false);
    if (error) return setErro(msgErro(error));
    aoCriar(data as string);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal titulo="Novo lançamento" largo aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" disabled={salvando} onClick={salvar}>Lançar repasse</button></>}>
      <Aviso>{erro}</Aviso>
      {conta && <Aviso tipo="info">Dados puxados da conta particular. Confira antes de lançar.</Aviso>}
      <Campo rotulo="Tipo de lançamento">
        <select value={f.regra} onChange={set("regra")}>{Object.entries(REGRAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select>
      </Campo>
      <p className="muted pequeno" style={{ marginTop: -6 }}>{REGRAS[f.regra].explica}. Escolher o procedimento já ajusta o tipo.</p>
      <div className="grade g3">
        <Campo rotulo={cobranca ? "Médico que deve à clínica" : "Médico que recebe"}>
          <select value={f.profissional_id} onChange={set("profissional_id")}>
            <option value="">Escolha…</option>{base.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Procedimento (tabela)">
          <select value={f.procedimento_id} onChange={(e) => escolherProcedimento(e.target.value)}>
            <option value="">Outro / digitar…</option>
            {procsDoMedico.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data da cirurgia"><input type="date" value={f.data_cirurgia} onChange={set("data_cirurgia")} /></Campo>
      </div>
      {!cobranca && base.lentes.length > 0 && (
        <Campo rotulo="Ou: venda de lente ao paciente (catálogo)">
          <select value="" onChange={(e) => escolherLente(e.target.value)}>
            <option value="">Escolher lente…</option>
            {base.lentes.map((l) => <option key={l.id} value={l.id}>{l.descricao} · venda {fmtMoeda(l.preco_venda)} · custo {fmtMoeda(l.custo_compra)}</option>)}
          </select>
        </Campo>
      )}
      <Campo rotulo="Descrição do procedimento"><input value={f.procedimento} onChange={set("procedimento")} placeholder="ex.: Blefaroplastia superior AO" /></Campo>
      <div className="campo">
        Paciente (opcional)
        {pac ? (
          <div className="linha"><b>{nomeExibicao(pac)}</b><span className="muted pequeno">Pront. {pac.numero_prontuario}</span>
            {!conta && <button className="sutil" onClick={() => setPac(null)}>trocar</button>}</div>
        ) : <BuscaPaciente aoEscolher={setPac} />}
      </div>
      {!cobranca && <><div className="grade g3">
        <Campo rotulo="Valor total da cirurgia (R$)"><input inputMode="decimal" value={f.valor} onChange={set("valor")} placeholder="ex.: 4820,00" /></Campo>
        <Campo rotulo="Forma de pagamento">
          <select value={f.forma} onChange={set("forma")}>{Object.entries(FORMAS_REPASSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Campo>
        {f.forma === "credito" ? (
          <Campo rotulo="Parcelas">
            <select value={f.parcelas} onChange={set("parcelas")}>
              {base.taxas.filter((t) => t.forma === "credito").map((t) => <option key={t.id} value={t.parcelas}>{t.parcelas === 1 ? "1x (à vista)" : `${t.parcelas}x`} · taxa {pct(t.taxa_total)}</option>)}
            </select>
          </Campo>
        ) : <span />}
      </div>
      <Campo rotulo={f.forma === "credito" ? "Data da venda no cartão" : "Data do pagamento"}><input type="date" style={{ maxWidth: 180 }} value={f.data_pagamento} onChange={set("data_pagamento")} /></Campo>
      </>}
      <Campo rotulo="Observações (opcional)"><input value={f.observacoes} onChange={set("observacoes")} /></Campo>

      <div className="painel" style={{ marginTop: 10 }}>
        <h2 style={{ marginTop: 0 }}>{cobranca ? "O que o médico deve à clínica" : "Custos da cirurgia"}</h2>
        <p className="muted pequeno" style={{ marginTop: 0 }}>{cobranca ? "Taxa de sala, lente e o que mais ele deve. Quando ele pagar, marque no lançamento." : "Saem antes da divisão. Taxa de sala e insumos ficam para a clínica; auxiliar, anestesista e instrumentação o Luciano transfere a quem recebe."}</p>
        <EditorCustos custos={custos} medicos={base.medicos} aoMudar={setCustos} cobranca={cobranca} />
      </div>

      {cobranca && valor > 0 && <Aviso tipo="info">{nomePor(base.medicos, f.profissional_id) || "O médico"} fica devendo <b>{fmtMoeda(valor)}</b> à clínica.</Aviso>}
      {prev && !cobranca && (
        <div className="painel" style={{ marginTop: 10 }}>
          <h2 style={{ marginTop: 0 }}>Prévia do cálculo</h2>
          <table className="tabela">
            <tbody>
              <tr><td>Valor total da venda</td><td style={num}>{fmtMoeda(valor)}</td></tr>
              {f.regra === "geral" && <tr><td>Imposto ({pct(base.cfg.imposto_pct)} do total)</td><td style={num}>− {fmtMoeda(prev.imposto)}</td></tr>}
              {taxaPct! > 0 && <tr><td>Taxa do cartão ({pct(taxaPct!)} do total{f.forma === "credito" && n > 1 ? ", com antecipação" : ""})</td><td style={num}>− {fmtMoeda(prev.taxa)}</td></tr>}
              {custos.map((c, i) => <tr key={i}><td>{c.descricao || TIPOS_CUSTO[c.tipo]}{(() => { const q = custoDaClinica(c.tipo) ? "" : c.favorecido_profissional_id ? nomePor(base.medicos, c.favorecido_profissional_id) : c.favorecido_nome.trim(); return q && q !== c.descricao ? ` (${q})` : ""; })()}</td><td style={num}>− {fmtMoeda(custosNum[i] ?? 0)}</td></tr>)}
              {f.regra === "geral" ? <>
                <tr><td className="muted">Honorários (o que sobra)</td><td style={num} className="muted">{fmtMoeda(prev.sobra)}</td></tr>
                <tr><td>Clínica ({pct(base.cfg.centro_cirurgico_pct)} dos honorários)</td><td style={num}>− {fmtMoeda(prev.clinica)}</td></tr>
                <tr><td><b>Médico ({pct(100 - base.cfg.centro_cirurgico_pct)} dos honorários)</b></td><td style={num}><b>{fmtMoeda(prev.medico)}</b></td></tr>
              </> : <tr><td><b>Médico (sem imposto e sem os 20%)</b></td><td style={num}><b>{fmtMoeda(prev.medico)}</b></td></tr>}
            </tbody>
          </table>
          {n > 1 && (
            <p className="pequeno">O médico recebe <b>{fmtMoeda(prev.medParc[0])}</b> por parcela, conforme cada uma cai
              {prev.medParc[n - 1] !== prev.medParc[0] && <> (a última leva a sobra de centavos: {fmtMoeda(prev.medParc[n - 1])})</>}.</p>
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

  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Aviso>{e1}</Aviso>;
  const r = dados;
  const ps = r.repasse_parcelas ?? [];
  const ativo = r.status !== "cancelado";
  const entraram = ps.filter((p) => p.recebido_em);
  const cob = r.regra === "cobranca";
  const cs = (r.repasse_custos ?? []).sort((a, b) => a.ordem - b.ordem);
  async function pagarCusto(c: Custo, pago: string | null) {
    setErro(""); setOkMsg("");
    const { error } = await supabase.from("repasse_custos").update({ pago_em: pago }).eq("id", c.id);
    if (error) return setErro(msgErro(error));
    setOkMsg(pago ? `${c.descricao} marcado como pago.` : `Pagamento de ${c.descricao} desmarcado.`); recarregar();
  }

  async function atualizar(p: Parcela, campos: Record<string, unknown>, msg: string) {
    setErro(""); setOkMsg("");
    const { error } = await supabase.from("repasse_parcelas").update(campos).eq("id", p.id);
    if (error) return setErro(msgErro(error));
    setOkMsg(msg); recarregar();
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
          <div className="linha"><h1 style={{ margin: 0 }}>{cob ? "Cobrança" : "Repasse"} nº {r.numero}</h1>{r.regra && r.regra !== "geral" && <Etiqueta cor="roxo">{REGRAS[r.regra]?.rotulo}</Etiqueta>}<Etiqueta cor={STATUS[r.status].cor}>{STATUS[r.status].rotulo}</Etiqueta></div>
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
            {cob ? <>
              {cs.map((c) => <tr key={c.id}><td>{c.descricao}</td><td style={num}>{fmtMoeda(c.valor)}</td></tr>)}
              <tr><td><b>{r.profissionais?.nome} deve à clínica</b></td><td style={num}><b>{fmtMoeda(r.valor_total)}</b></td></tr>
              <tr><td className="muted">Situação</td><td style={num} className="muted">{ps.every((p) => p.recebido_em) ? `pago em ${fmtData(ps[0]?.recebido_em)}` : "a receber"}</td></tr>
            </> : <>
            <tr><td>Valor da cirurgia · {FORMAS_REPASSE[r.forma_pagamento]}{r.parcelas > 1 ? ` em ${r.parcelas}x` : ""}</td><td style={num}><b>{fmtMoeda(r.valor_total)}</b></td></tr>
            {(r.regra ?? "geral") === "geral" && <tr><td>Imposto ({pct(r.imposto_pct)} do total)</td><td style={num}>{fmtMoeda(r.imposto_total)}</td></tr>}
            {r.taxa_interna_pct > 0 && <tr><td>Taxa do cartão ({pct(r.taxa_interna_pct)} do total)</td><td style={num}>{fmtMoeda(r.taxa_interna_total)}</td></tr>}
            {cs.map((c) => <tr key={c.id}><td>{c.descricao}{favorecido(c) && <span className="muted"> · {favorecido(c)}</span>}</td><td style={num}>{fmtMoeda(c.valor)}</td></tr>)}
            {(r.regra ?? "geral") === "geral" && <>
              {cs.length > 0 && <tr><td className="muted">Honorários (o que sobra)</td><td style={num} className="muted">{fmtMoeda(Number(r.centro_cirurgico_total) + Number(r.medico_total))}</td></tr>}
              <tr><td>Clínica ({pct(r.centro_cirurgico_pct)} dos honorários)</td><td style={num}>{fmtMoeda(r.centro_cirurgico_total)}</td></tr>
            </>}
            <tr><td><b>Médico</b> {(r.regra ?? "geral") === "geral" ? `(${pct(100 - r.centro_cirurgico_pct)} dos honorários)` : "(sem imposto e sem os 20%)"}</td><td style={num}><b>{fmtMoeda(r.medico_total)}</b></td></tr>
            <tr><td className="muted">Parcelas que já entraram</td><td style={num} className="muted">{entraram.length} de {r.parcelas} · médico {fmtMoeda(soma(entraram, "medico"))}</td></tr>
            <tr><td className="muted">Já pago ao médico / falta pagar</td><td style={num} className="muted">
              {fmtMoeda(soma(ps.filter((p) => p.pago_medico_em), "medico"))} / {fmtMoeda(soma(ps.filter((p) => !p.pago_medico_em), "medico"))}</td></tr>
            </>}
          </tbody>
        </table>
        {r.observacoes && <p className="muted pequeno">Obs.: {r.observacoes}</p>}
      </div>

      {cob && ps[0] && (
        <div className="painel">
          <h2>Pagamento do médico à clínica</h2>
          {ps[0].recebido_em ? (
            <p className="linha">✅ {r.profissionais?.nome} pagou {fmtMoeda(r.valor_total)} em {fmtData(ps[0].recebido_em)}
              {ativo && <button className="sutil pequeno" onClick={() => confirm("Desmarcar o pagamento?") && atualizar(ps[0], { recebido_em: null }, "Pagamento desmarcado.")}>desfazer</button>}</p>
          ) : ativo ? <button className="primario" onClick={() => atualizar(ps[0], { recebido_em: isoDia(new Date()) }, "Pagamento do médico registrado.")}>Médico pagou hoje</button> : "—"}
        </div>
      )}

      {!cob && cs.some((c) => !custoDaClinica(c.tipo)) && (
        <div className="painel rolagem">
          <h2>A pagar: auxiliar, anestesista e instrumentação</h2>
          <table className="tabela">
            <thead><tr><th>Custo</th><th>Quem recebe</th><th style={num}>Valor</th><th>Pago</th></tr></thead>
            <tbody>
              {cs.filter((c) => !custoDaClinica(c.tipo)).map((c) => (
                <tr key={c.id}><td>{c.descricao}</td><td>{favorecido(c) || <span className="muted">não informado</span>}</td><td style={num}>{fmtMoeda(c.valor)}</td>
                  <td>{c.pago_em ? (
                    <span className="linha">✅ {fmtData(c.pago_em)}{ativo && <button className="sutil pequeno" onClick={() => confirm(`Desmarcar o pagamento de ${c.descricao}?`) && pagarCusto(c, null)}>desfazer</button>}</span>
                  ) : ativo ? <button className="pequeno" onClick={() => pagarCusto(c, isoDia(new Date()))}>Marcar pago hoje</button> : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!cob && <div className="painel">
        <h2>Parcelas</h2>
        {ativo && r.parcelas > 1 && (
          <p className="muted pequeno">Quando cada parcela cair na conta, clique em <b>"Entrou hoje"</b>. Depois de transferir ao médico, clique em <b>"Marcar pago hoje"</b>.</p>
        )}
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Parcela</th><th>Prevista</th><th style={num}>Valor</th><th style={num}>Imposto</th><th style={num}>Taxa cartão</th><th style={num}>Custos</th>
              <th style={num}>Clínica</th><th style={num}>Médico</th><th>Entrou</th><th>Pago ao médico</th></tr></thead>
            <tbody>
              {ps.map((p) => (
                <tr key={p.id}>
                  <td>{p.numero}/{r.parcelas}</td>
                  <td>{fmtData(p.data_prevista)}</td>
                  <td style={num}>{fmtMoeda(p.valor ?? Number(p.imposto) + Number(p.taxa_interna ?? 0) + Number(p.centro_cirurgico) + Number(p.medico ?? 0))}</td>
                  <td style={num}>{fmtMoeda(p.imposto)}</td>
                  <td style={num}>{fmtMoeda(p.taxa_interna)}</td>
                  <td style={num}>{fmtMoeda(p.custos)}</td>
                  <td style={num}>{fmtMoeda(p.centro_cirurgico)}</td>
                  <td style={num}><b>{fmtMoeda(p.medico)}</b></td>
                  <td>
                    {p.recebido_em ? (
                      <span className="linha">✅ {fmtData(p.recebido_em)}
                        {ativo && !p.pago_medico_em && <button className="sutil pequeno" onClick={() => confirm(`Desmarcar a entrada da parcela ${p.numero}?`) && atualizar(p, { recebido_em: null }, `Entrada da parcela ${p.numero} desmarcada.`)}>desfazer</button>}</span>
                    ) : ativo ? (
                      <button className="pequeno" onClick={() => atualizar(p, { recebido_em: isoDia(new Date()) }, `Parcela ${p.numero} marcada como recebida.`)}>Entrou hoje</button>
                    ) : <span className="muted pequeno">—</span>}
                  </td>
                  <td>
                    {p.pago_medico_em ? (
                      <span className="linha">✅ {fmtData(p.pago_medico_em)}
                        {ativo && <button className="sutil pequeno" onClick={() => confirm(`Desmarcar o pagamento da parcela ${p.numero}?`) && atualizar(p, { pago_medico_em: null }, `Pagamento da parcela ${p.numero} desmarcado.`)}>desfazer</button>}</span>
                    ) : ativo && p.recebido_em ? (
                      <button className="pequeno" onClick={() => atualizar(p, { pago_medico_em: isoDia(new Date()) }, `Parcela ${p.numero} marcada como paga ao médico.`)}>Marcar pago hoje</button>
                    ) : <span className="muted pequeno">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {ps.length > 1 && (
              <tfoot><tr><th colSpan={2}>Total</th><th style={num}>{fmtMoeda(soma(ps, "valor"))}</th><th style={num}>{fmtMoeda(soma(ps, "imposto"))}</th>
                <th style={num}>{fmtMoeda(soma(ps, "taxa_interna"))}</th><th style={num}>{fmtMoeda(soma(ps, "custos"))}</th><th style={num}>{fmtMoeda(soma(ps, "centro_cirurgico"))}</th>
                <th style={num}>{fmtMoeda(soma(ps, "medico"))}</th><th></th><th></th></tr></tfoot>
            )}
          </table>
        </div>
      </div>}
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
      .select("*, repasses!inner(numero, procedimento, data_cirurgia, profissional_id, forma_pagamento, parcelas, status, profissionais!repasses_profissional_id_fkey(nome), pacientes(nome, nome_social))")
      .not("recebido_em", "is", null).gte("recebido_em", f.de).lte("recebido_em", f.ate).neq("repasses.status", "cancelado").neq("repasses.regra", "cobranca")
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
    const cab = ["Medico", "Repasse", "Procedimento", "Cirurgia", "Pagamento", "Parcela", "Entrou em", "Valor", "Imposto", "Taxa cartao", "Clinica", "Medico", "Pago ao medico em"];
    const v = (x: number | null) => (x === null ? "" : Number(x).toFixed(2).replace(".", ","));
    const corpo = linhas.map((l) => [l.repasses.profissionais?.nome ?? "", l.repasses.numero, l.repasses.procedimento, l.repasses.data_cirurgia,
      FORMAS_REPASSE[l.repasses.forma_pagamento], `${l.numero}/${l.repasses.parcelas}`, l.recebido_em ?? "", v(l.valor), v(l.imposto),
      v(l.taxa_interna), v(l.centro_cirurgico), v(l.medico), l.pago_medico_em ?? ""]);
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
      <CobrancasMedicos />
      <CustosAPagar de={f.de} ate={f.ate} situacao={f.situacao} />
      {carregando && !dados ? <Carregando /> : grupos.length === 0 ? <div className="painel vazio">Nenhuma parcela entrou neste período.</div> : (
        <>
          <div className="painel rolagem">
            <h2>Resumo do período</h2>
            <table className="tabela">
              <thead><tr><th>Médico</th><th>Parcelas</th><th style={num}>Valor</th><th style={num}>Imposto</th><th style={num}>Taxa cartão</th>
                <th style={num}>Clínica</th><th style={num}>Médico</th><th style={num}>Já pago</th><th style={num}>A pagar</th></tr></thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.nome}><td><b>{g.nome}</b></td><td>{g.ls.length}</td><td style={num}>{fmtMoeda(soma(g.ls, "valor"))}</td>
                    <td style={num}>{fmtMoeda(soma(g.ls, "imposto"))}</td><td style={num}>{fmtMoeda(soma(g.ls, "taxa_interna"))}</td>
                    <td style={num}>{fmtMoeda(soma(g.ls, "centro_cirurgico"))}</td><td style={num}><b>{fmtMoeda(soma(g.ls, "medico"))}</b></td>
                    <td style={num}>{fmtMoeda(soma(g.ls.filter((l) => l.pago_medico_em), "medico"))}</td>
                    <td style={num}>{fmtMoeda(soma(g.ls.filter((l) => !l.pago_medico_em), "medico"))}</td></tr>
                ))}
              </tbody>
              {grupos.length > 1 && (
                <tfoot><tr><th>Total</th><th>{linhas.length}</th><th style={num}>{fmtMoeda(soma(linhas, "valor"))}</th><th style={num}>{fmtMoeda(soma(linhas, "imposto"))}</th>
                  <th style={num}>{fmtMoeda(soma(linhas, "taxa_interna"))}</th><th style={num}>{fmtMoeda(soma(linhas, "centro_cirurgico"))}</th>
                  <th style={num}>{fmtMoeda(soma(linhas, "medico"))}</th><th style={num}>{fmtMoeda(soma(linhas.filter((l) => l.pago_medico_em), "medico"))}</th>
                  <th style={num}>{fmtMoeda(soma(linhas.filter((l) => !l.pago_medico_em), "medico"))}</th></tr></tfoot>
              )}
            </table>
          </div>
          {grupos.map((g) => (
            <div className="painel rolagem" key={g.nome}>
              <h2>{g.nome}</h2>
              <table className="tabela">
                <thead><tr><th>Entrou em</th><th>Repasse</th><th>Paciente / procedimento</th><th>Parcela</th><th style={num}>Valor</th>
                  <th style={num}>Imposto</th><th style={num}>Taxa cartão</th><th style={num}>Clínica</th><th style={num}>Médico</th><th>Pago em</th></tr></thead>
                <tbody>
                  {g.ls.map((l) => (
                    <tr key={l.id}><td>{fmtData(l.recebido_em)}</td><td><Link to={`/repasse/${l.repasse_id}`}>nº {l.repasses.numero}</Link></td>
                      <td>{l.repasses.pacientes ? nomeExibicao(l.repasses.pacientes) : "—"}<div className="muted pequeno">{l.repasses.procedimento} · {fmtData(l.repasses.data_cirurgia)}</div></td>
                      <td>{l.numero}/{l.repasses.parcelas}<div className="muted pequeno">{FORMAS_REPASSE[l.repasses.forma_pagamento]}</div></td>
                      <td style={num}>{fmtMoeda(l.valor)}</td><td style={num}>{fmtMoeda(l.imposto)}</td><td style={num}>{fmtMoeda(l.taxa_interna)}</td>
                      <td style={num}>{fmtMoeda(l.centro_cirurgico)}</td><td style={num}><b>{fmtMoeda(l.medico)}</b></td>
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
      if (!valido(a) || !valido(b)) return setErro(`Taxa inválida em ${x.forma === "debito" ? "débito" : `${x.parcelas}x`}.`);
      if (a === Number(x.taxa_cartao) && b === Number(x.taxa_antecipacao)) continue;
      const { error } = await supabase.from("repasse_taxas_cartao").update({ taxa_cartao: a, taxa_antecipacao: b }).eq("id", x.id);
      if (error) return setErro(`${x.forma === "debito" ? "Débito" : `${x.parcelas}x`}: ${msgErro(error)}`);
    }
    setOkMsg("Taxas salvas. Valem para os repasses lançados daqui para a frente."); aoMudar();
  }
  async function incluir() {
    setErro(""); setOkMsg("");
    const n = Number(nova.parcelas), a = numOuNulo(nova.cartao), b = numOuNulo(nova.antecipacao);
    if (!(n >= 1 && n <= 24) || !valido(a) || !valido(b)) return setErro("Preencha parcelas do crédito (1 a 24) e as duas taxas.");
    const { error } = await supabase.from("repasse_taxas_cartao").insert({ forma: "credito", parcelas: n, taxa_cartao: a, taxa_antecipacao: b });
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
          <li><b>Imposto</b>: % do valor total da venda.</li>
          <li><b>Taxa do cartão</b>: % da tabela abaixo sobre o valor total da venda (débito e crédito 1x: só a taxa do cartão; parcelado: cartão + antecipação). Dinheiro e PIX: sem taxa.</li>
          <li><b>Custos da cirurgia</b>: taxa de sala e insumos (ficam para a clínica), instrumentação e auxiliar (o Luciano transfere). Valores por procedimento, na tabela abaixo.</li>
          <li><b>Honorários</b>: o que sobra (total − imposto − taxa − custos).</li>
          <li><b>Clínica</b>: % dos honorários. <b>Médico</b>: o restante dos honorários.</li>
        </ol>
        <p className="muted pequeno">Vale para todos os médicos e cirurgias (a refrativa não tem custos: a sala o paciente paga fora). Cada parte é dividida igualmente entre as parcelas (sobra de centavos na última). O médico recebe conforme cada parcela entra.</p>
        <div className="grade g3" style={{ maxWidth: 640 }}>
          <Campo rotulo="Imposto (%)"><input inputMode="decimal" value={c.imposto} onChange={(e) => setC({ ...c, imposto: e.target.value })} /></Campo>
          <Campo rotulo="Clínica (% dos honorários)"><input inputMode="decimal" value={c.centro} onChange={(e) => setC({ ...c, centro: e.target.value })} /></Campo>
          <Campo rotulo="Centavos da taxa interna">
            <select value={c.arred} onChange={(e) => setC({ ...c, arred: e.target.value as Config["taxa_arredondamento"] })}>
              <option value="truncar">Cortar (ex.: 41,187 → 41,18)</option><option value="arredondar">Arredondar (ex.: 41,187 → 41,19)</option>
            </select>
          </Campo>
        </div>
        <button className="primario" onClick={salvarRegras}>Salvar regras</button>
      </div>

      <div className="painel rolagem">
        <h2>Tabela de taxas do cartão</h2>
        <p className="muted pequeno">Taxa interna = taxa do cartão + taxa de antecipação (débito e crédito 1x não têm antecipação), sobre o valor total da venda. Mudanças valem só para repasses lançados depois.</p>
        <table className="tabela" style={{ maxWidth: 560 }}>
          <thead><tr><th>Cartão</th><th>Taxa do cartão (%)</th><th>Antecipação (%)</th><th style={num}>Taxa total</th></tr></thead>
          <tbody>
            {taxas.map((x) => {
              const a = numOuNulo(t[x.id]?.cartao) ?? 0, b = numOuNulo(t[x.id]?.antecipacao) ?? 0;
              return (
                <tr key={x.id}><td><b>{x.forma === "debito" ? "Débito" : x.parcelas === 1 ? "Crédito 1x" : `Crédito ${x.parcelas}x`}</b></td>
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

// ------------------------------------------------------------------ editor de custos (lançamento e tabela de procedimentos)
function EditorCustos({ custos, medicos, aoMudar, cobranca = false }: { custos: CustoEdit[]; medicos: Medico[]; aoMudar: (c: CustoEdit[]) => void; cobranca?: boolean }) {
  const muda = (i: number, campo: keyof CustoEdit, v: string) => aoMudar(custos.map((c, j) => (j === i ? { ...c, [campo]: v } : c)));
  return (
    <div className="rolagem">
      <table className="tabela">
        <thead><tr><th>Tipo</th><th>Descrição</th><th style={num}>Valor (R$)</th><th>Quem recebe</th><th></th></tr></thead>
        <tbody>
          {custos.map((c, i) => (
            <tr key={i}>
              <td><select value={c.tipo} onChange={(e) => muda(i, "tipo", e.target.value)} aria-label="Tipo do custo">
                {Object.entries(TIPOS_CUSTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><input value={c.descricao} onChange={(e) => muda(i, "descricao", e.target.value)} aria-label="Descrição do custo" /></td>
              <td><input style={{ width: 100, textAlign: "right" }} inputMode="decimal" value={c.valor} onChange={(e) => muda(i, "valor", e.target.value)} aria-label="Valor do custo" /></td>
              <td>{custoDaClinica(c.tipo) || cobranca ? <span className="muted pequeno">{cobranca ? "devido à clínica" : "fica para a clínica"}</span> : (
                <div className="linha" style={{ gap: 4 }}>
                  <select style={{ width: 170 }} value={c.favorecido_profissional_id} onChange={(e) => muda(i, "favorecido_profissional_id", e.target.value)} aria-label="Profissional que recebe">
                    <option value="">Outra pessoa…</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                  {!c.favorecido_profissional_id && <input style={{ width: 140 }} placeholder="nome" value={c.favorecido_nome} onChange={(e) => muda(i, "favorecido_nome", e.target.value)} aria-label="Nome de quem recebe" />}
                </div>)}</td>
              <td><button className="sutil" title="Remover" onClick={() => aoMudar(custos.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {custos.length === 0 && <p className="muted pequeno">Sem custos (ex.: refrativa, sala paga fora).</p>}
      <button className="pequeno" onClick={() => aoMudar([...custos, { tipo: "sala", descricao: "Taxa de sala", valor: "", favorecido_profissional_id: "", favorecido_nome: "" }])}>➕ Acrescentar custo</button>
    </div>
  );
}

// ------------------------------------------------------------------ tabela de procedimentos (custos padrão)
function Procedimentos({ procs, medicos, aoMudar }: { procs: Procedimento[]; medicos: Medico[]; aoMudar: () => void }) {
  const [edit, setEdit] = useState<{ id: string | null; regra: string; nome: string; profissional_id: string; valor: string; ativo: boolean; custos: CustoEdit[] } | null>(null);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  function abrir(p: Procedimento | null) {
    setErro(""); setOkMsg("");
    setEdit(p ? {
      id: p.id, regra: p.regra, nome: p.nome, profissional_id: p.profissional_id ?? "", valor: p.valor_sugerido ? String(p.valor_sugerido).replace(".", ",") : "", ativo: p.ativo,
      custos: p.repasse_procedimento_custos.map((c) => ({ tipo: c.tipo, descricao: c.descricao, valor: String(c.valor).replace(".", ","),
        favorecido_profissional_id: c.favorecido_profissional_id ?? "", favorecido_nome: c.favorecido_nome ?? "" })),
    } : { id: null, regra: "geral", nome: "", profissional_id: "", valor: "", ativo: true, custos: [] });
  }
  async function salvar() {
    if (!edit) return;
    setErro("");
    if (!edit.nome.trim()) return setErro("Informe o nome do procedimento.");
    const custos = edit.custos.map((c, i) => ({ c, v: numOuNulo(c.valor), i }));
    const ruim = custos.find((x) => !x.c.descricao.trim() || x.v === null || x.v < 0);
    if (ruim) return setErro(`Confira a descrição e o valor do custo da linha ${ruim.i + 1}.`);
    const dados = { regra: edit.regra, nome: edit.nome.trim(), profissional_id: edit.profissional_id || null, valor_sugerido: numOuNulo(edit.valor) || null, ativo: edit.ativo };
    let id = edit.id;
    if (id) {
      const r = await supabase.from("repasse_procedimentos").update(dados).eq("id", id);
      if (r.error) return setErro(msgErro(r.error));
      const d = await supabase.from("repasse_procedimento_custos").delete().eq("procedimento_id", id);
      if (d.error) return setErro(msgErro(d.error));
    } else {
      const r = await supabase.from("repasse_procedimentos").insert(dados).select("id").single();
      if (r.error) return setErro(msgErro(r.error));
      id = (r.data as { id: string }).id;
    }
    if (custos.length) {
      const r = await supabase.from("repasse_procedimento_custos").insert(custos.map(({ c, v, i }) => ({
        procedimento_id: id, tipo: c.tipo, descricao: c.descricao.trim(), valor: v, ordem: i + 1,
        favorecido_profissional_id: custoDaClinica(c.tipo) ? null : c.favorecido_profissional_id || null,
        favorecido_nome: custoDaClinica(c.tipo) || c.favorecido_profissional_id ? null : c.favorecido_nome.trim() || null,
      })));
      if (r.error) return setErro(msgErro(r.error));
    }
    setEdit(null); setOkMsg("Procedimento salvo. Vale para os próximos lançamentos."); aoMudar();
  }

  return (
    <div className="painel rolagem">
      <div className="linha"><h2 style={{ margin: 0 }}>Procedimentos e custos padrão</h2><span style={{ marginLeft: "auto" }} />
        <button onClick={() => abrir(null)}>➕ Novo procedimento</button></div>
      <p className="muted pequeno">Ao lançar um repasse e escolher o procedimento, estes custos já vêm preenchidos (dá para ajustar na hora). Mudanças aqui não alteram repasses já lançados.</p>
      <Aviso>{erro}</Aviso>
      <Aviso tipo="ok">{okMsg}</Aviso>
      <table className="tabela">
        <thead><tr><th>Procedimento</th><th>Médico</th><th style={num}>Valor sugerido</th><th>Custos</th><th style={num}>Total custos</th><th></th></tr></thead>
        <tbody>
          {procs.map((p) => (
            <tr key={p.id} style={p.ativo ? undefined : { opacity: 0.5 }}>
              <td><b>{p.nome}</b>{!p.ativo && <span className="muted pequeno"> (inativo)</span>}{p.regra && p.regra !== "geral" && <div><Etiqueta cor="roxo">{p.regra === "cobranca" ? "médico deve" : "parceiro"}</Etiqueta></div>}</td>
              <td>{p.profissional_id ? nomePor(medicos, p.profissional_id) : <span className="muted">qualquer</span>}</td>
              <td style={num}>{p.valor_sugerido ? fmtMoeda(p.valor_sugerido) : "—"}</td>
              <td className="pequeno">{p.repasse_procedimento_custos.length ? p.repasse_procedimento_custos.map((c) => `${c.descricao} ${fmtMoeda(c.valor)}`).join(" · ") : <span className="muted">sem custos</span>}</td>
              <td style={num}>{fmtMoeda(p.repasse_procedimento_custos.reduce((s, c) => s + Number(c.valor), 0))}</td>
              <td><button className="pequeno" onClick={() => abrir(p)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <Modal titulo={edit.id ? "Editar procedimento" : "Novo procedimento"} largo aoFechar={() => setEdit(null)}
          rodape={<><button onClick={() => setEdit(null)}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
          <Aviso>{erro}</Aviso>
          <div className="grade g3">
            <Campo rotulo="Nome"><input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="ex.: Blefaroplastia" /></Campo>
            <Campo rotulo="Médico"><select value={edit.profissional_id} onChange={(e) => setEdit({ ...edit, profissional_id: e.target.value })}>
              <option value="">Qualquer médico</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></Campo>
            <Campo rotulo="Valor sugerido (R$, opcional)"><input inputMode="decimal" value={edit.valor} onChange={(e) => setEdit({ ...edit, valor: e.target.value })} /></Campo>
          </div>
          <Campo rotulo="Tipo de lançamento"><select value={edit.regra} onChange={(e) => setEdit({ ...edit, regra: e.target.value })}>
            {Object.entries(REGRAS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select></Campo>
          <label className="linha pequeno"><input type="checkbox" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} /> Ativo (aparece no lançamento)</label>
          <h2>Custos padrão</h2>
          <EditorCustos custos={edit.custos} medicos={medicos} aoMudar={(c) => setEdit({ ...edit, custos: c })} cobranca={edit.regra === "cobranca"} />
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ relatório: auxiliares e instrumentação a pagar
interface CustoRel extends Custo { repasses: { numero: number; procedimento: string; data_cirurgia: string; status: string; profissionais: { nome: string } | null } }
function CustosAPagar({ de, ate, situacao }: { de: string; ate: string; situacao: string }) {
  const [erro, setErro] = useState("");
  const { dados, erro: e1, recarregar } = useCarregar(async () => ok(await supabase.from("repasse_custos")
    .select("*, profissionais(nome), repasses!inner(numero, procedimento, data_cirurgia, status, profissionais!repasses_profissional_id_fkey(nome))")
    .not("tipo", "in", "(sala,insumo)").neq("repasses.regra", "cobranca").gte("repasses.data_cirurgia", de).lte("repasses.data_cirurgia", ate).neq("repasses.status", "cancelado")
    .limit(5000)) as CustoRel[], [de, ate]);
  const linhas = (dados ?? []).filter((c) => situacao === "todas" || (situacao === "pagar" ? !c.pago_em : !!c.pago_em))
    .sort((a, b) => favorecido(a).localeCompare(favorecido(b)) || a.repasses.data_cirurgia.localeCompare(b.repasses.data_cirurgia));
  async function pagar(c: Custo, v: string | null) {
    setErro("");
    const { error } = await supabase.from("repasse_custos").update({ pago_em: v }).eq("id", c.id);
    if (error) return setErro(msgErro(error));
    recarregar();
  }
  const total = (ls: CustoRel[]) => ls.reduce((s, c) => s + Number(c.valor), 0);
  if (!linhas.length && !e1) return null;
  return (
    <div className="painel rolagem">
      <h2>Auxiliares, anestesista e instrumentação (cirurgias do período)</h2>
      <Aviso>{erro || e1}</Aviso>
      <table className="tabela">
        <thead><tr><th>Quem recebe</th><th>Cirurgia</th><th>Repasse</th><th>Custo</th><th style={num}>Valor</th><th>Pago</th></tr></thead>
        <tbody>
          {linhas.map((c) => (
            <tr key={c.id}><td><b>{favorecido(c) || <span className="muted">não informado</span>}</b></td>
              <td>{fmtData(c.repasses.data_cirurgia)}<div className="muted pequeno">{c.repasses.procedimento} · {c.repasses.profissionais?.nome}</div></td>
              <td><Link to={`/repasse/${c.repasse_id}`}>nº {c.repasses.numero}</Link></td><td>{c.descricao}</td><td style={num}>{fmtMoeda(c.valor)}</td>
              <td>{c.pago_em ? <span className="linha">✅ {fmtData(c.pago_em)}<button className="sutil pequeno" onClick={() => confirm("Desmarcar o pagamento?") && pagar(c, null)}>desfazer</button></span>
                : <button className="pequeno" onClick={() => pagar(c, isoDia(new Date()))}>Marcar pago hoje</button>}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={4}>Total · já pago {fmtMoeda(total(linhas.filter((c) => c.pago_em)))} · a pagar {fmtMoeda(total(linhas.filter((c) => !c.pago_em)))}</th>
          <th style={num}>{fmtMoeda(total(linhas))}</th><th></th></tr></tfoot>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ cobranças: o que os médicos devem à clínica
function CobrancasMedicos() {
  const nav = useNavigate();
  const { dados, erro } = useCarregar(async () => ok(await supabase.from("repasses")
    .select("id, numero, procedimento, data_cirurgia, valor_total, profissionais!repasses_profissional_id_fkey(nome), repasse_parcelas(recebido_em)")
    .eq("regra", "cobranca").eq("status", "aberto").order("data_cirurgia").limit(1000)) as unknown as
    { id: string; numero: number; procedimento: string; data_cirurgia: string; valor_total: number; profissionais: { nome: string } | null }[], []);
  if (!dados?.length && !erro) return null;
  const total = (dados ?? []).reduce((s, c) => s + Number(c.valor_total), 0);
  return (
    <div className="painel rolagem">
      <h2>A receber dos médicos (cobranças em aberto)</h2>
      <Aviso>{erro}</Aviso>
      <table className="tabela">
        <thead><tr><th>Médico</th><th>Cirurgia</th><th>Nº</th><th style={num}>Deve</th></tr></thead>
        <tbody>
          {(dados ?? []).map((c) => (
            <tr key={c.id} className="clicavel" onClick={() => nav(`/repasse/${c.id}`)}><td><b>{c.profissionais?.nome}</b></td>
              <td>{fmtData(c.data_cirurgia)}<div className="muted pequeno">{c.procedimento}</div></td><td>{c.numero}</td><td style={num}>{fmtMoeda(c.valor_total)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={3}>Total a receber</th><th style={num}>{fmtMoeda(total)}</th></tr></tfoot>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ catálogo de lentes intraoculares (migração 0072)
interface Lente {
  id: string; codigo: string; descricao: string; fabricante: string; linha: string | null; tipo_optico: string; torica: boolean;
  pre_carregada: boolean; custo_compra: number | null; preco_venda: number | null; observacoes: string | null; ativo: boolean;
}
const TIPO_OPTICO: Record<string, string> = { monofocal: "Monofocal (simples)", foco_estendido: "Foco estendido", multifocal: "Multifocal / trifocal" };
function LentesCatalogo() {
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [vals, setVals] = useState<Record<string, { custo: string; venda: string }>>({});
  const [nova, setNova] = useState<{ codigo: string; descricao: string; fabricante: string; tipo_optico: string; torica: boolean; custo: string } | null>(null);
  const { dados, erro: e1, carregando, recarregar } = useCarregar(async () =>
    ok(await supabase.from("lentes_catalogo").select("*").order("fabricante").order("custo_compra")) as Lente[], []);
  useEffect(() => {
    if (dados) setVals(Object.fromEntries(dados.map((l) => [l.id, {
      custo: l.custo_compra === null ? "" : String(l.custo_compra).replace(".", ","), venda: l.preco_venda === null ? "" : String(l.preco_venda).replace(".", ","),
    }])));
  }, [dados]);
  async function salvar() {
    setErro(""); setOkMsg("");
    for (const l of dados ?? []) {
      const c = vals[l.id]?.custo.trim() ? numOuNulo(vals[l.id].custo) : null, v = vals[l.id]?.venda.trim() ? numOuNulo(vals[l.id].venda) : null;
      if ((vals[l.id]?.custo.trim() && c === null) || (vals[l.id]?.venda.trim() && v === null)) return setErro(`Valor inválido em ${l.codigo}.`);
      if (c === (l.custo_compra === null ? null : Number(l.custo_compra)) && v === (l.preco_venda === null ? null : Number(l.preco_venda))) continue;
      const { error } = await supabase.from("lentes_catalogo").update({ custo_compra: c, preco_venda: v }).eq("id", l.id);
      if (error) return setErro(`${l.codigo}: ${msgErro(error)}`);
    }
    setOkMsg("Valores salvos."); recarregar();
  }
  async function incluir() {
    if (!nova) return;
    setErro("");
    if (!nova.codigo.trim() || !nova.descricao.trim()) return setErro("Informe o código e a descrição da lente.");
    const { error } = await supabase.from("lentes_catalogo").insert({ codigo: nova.codigo.trim(), descricao: nova.descricao.trim(), fabricante: nova.fabricante.trim() || "Alcon",
      tipo_optico: nova.tipo_optico, torica: nova.torica, custo_compra: numOuNulo(nova.custo) });
    if (error) return setErro(msgErro(error));
    setNova(null); setOkMsg("Lente incluída."); recarregar();
  }
  return (
    <div className="painel rolagem">
      <div className="linha"><h2 style={{ margin: 0 }}>Lentes intraoculares</h2><span style={{ marginLeft: "auto" }} />
        <button onClick={() => setNova({ codigo: "", descricao: "", fabricante: "Alcon", tipo_optico: "monofocal", torica: false, custo: "" })}>➕ Nova lente</button>
        <button className="primario" onClick={salvar}>Salvar valores</button></div>
      <p className="muted pequeno">Custo de compra (com IPI, da tabela do fornecedor) e preço de venda ao paciente. <b>Monofocal</b> = lente simples (um foco, em geral longe; óculos para perto).
        <b> Foco estendido</b> e <b>multifocal/trifocal</b> = lentes premium. <b>Tórica</b> corrige astigmatismo. "AutonoMe" = já vem carregada no injetor.</p>
      <Aviso>{erro || e1}</Aviso>
      <Aviso tipo="ok">{okMsg}</Aviso>
      {carregando && !dados ? <Carregando /> : (
        <table className="tabela">
          <thead><tr><th>Código</th><th>Lente</th><th>Tipo</th><th style={num}>Custo de compra (R$)</th><th style={num}>Preço de venda (R$)</th></tr></thead>
          <tbody>
            {(dados ?? []).map((l) => (
              <tr key={l.id}>
                <td><b>{l.codigo}</b><div className="muted pequeno">{l.fabricante}</div></td>
                <td>{l.descricao}{l.observacoes && <div className="muted pequeno">{l.observacoes}</div>}</td>
                <td className="pequeno">{TIPO_OPTICO[l.tipo_optico]}{l.torica && <div><Etiqueta cor="azul">tórica</Etiqueta></div>}</td>
                <td style={num}><input style={{ width: 110, textAlign: "right" }} inputMode="decimal" aria-label={`Custo de ${l.codigo}`} value={vals[l.id]?.custo ?? ""} onChange={(e) => setVals({ ...vals, [l.id]: { ...vals[l.id], custo: e.target.value } })} /></td>
                <td style={num}><input style={{ width: 110, textAlign: "right" }} inputMode="decimal" placeholder="a definir" aria-label={`Preço de venda de ${l.codigo}`} value={vals[l.id]?.venda ?? ""} onChange={(e) => setVals({ ...vals, [l.id]: { ...vals[l.id], venda: e.target.value } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {nova && (
        <Modal titulo="Nova lente" aoFechar={() => setNova(null)} rodape={<><button onClick={() => setNova(null)}>Cancelar</button><button className="primario" onClick={incluir}>Incluir</button></>}>
          <div className="grade g3">
            <Campo rotulo="Código"><input value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} /></Campo>
            <Campo rotulo="Fabricante"><input value={nova.fabricante} onChange={(e) => setNova({ ...nova, fabricante: e.target.value })} /></Campo>
            <Campo rotulo="Custo de compra (R$)"><input inputMode="decimal" value={nova.custo} onChange={(e) => setNova({ ...nova, custo: e.target.value })} /></Campo>
          </div>
          <Campo rotulo="Descrição"><input value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} /></Campo>
          <div className="grade g3">
            <Campo rotulo="Tipo"><select value={nova.tipo_optico} onChange={(e) => setNova({ ...nova, tipo_optico: e.target.value })}>
              {Object.entries(TIPO_OPTICO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            <label className="linha pequeno"><input type="checkbox" checked={nova.torica} onChange={(e) => setNova({ ...nova, torica: e.target.checked })} /> Tórica</label>
          </div>
        </Modal>
      )}
    </div>
  );
}
