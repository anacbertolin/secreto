// Vendas da Orientação Cirúrgica (migração 0097) — a Alessandra registra o que o paciente pagou (cirurgia ou lente);
// o Luciano confere e lança no Repasse médico. Aqui só aparece o VALOR (sem custos nem divisão).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo, BuscaPaciente } from "../components/ui";
import { fmtData, fmtMoeda, isoDia, nomeExibicao, numOuNulo } from "../lib/util";
import { FORMAS_REPASSE } from "../lib/repasse";
import { SEL_VENDA, type VendaOrientacao } from "./Repasse";

interface ProcOrientacao { id: string; nome: string; profissional_id: string | null; valor_sugerido: number | null; tem_lente: boolean }
interface LenteOrientacao { id: string; descricao: string; fabricante: string; premium: boolean; preco_venda: number }
type Pac = { id: string; nome: string; nome_social: string | null; numero_prontuario: number };

const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  aguardando: { rotulo: "Com o Luciano (conferência)", cor: "amarelo" },
  devolvida: { rotulo: "Devolvida — corrigir", cor: "vermelho" },
  lancada: { rotulo: "Conferida", cor: "verde" },
  cancelada: { rotulo: "Cancelada", cor: "cinza" },
};

export default function VendasOrientacao() {
  const [filtro, setFiltro] = useState("abertas");
  const [edit, setEdit] = useState<VendaOrientacao | "nova" | null>(null);
  const base = useCarregar(async () => {
    const [procs, lentes, medicos] = await Promise.all([
      supabase.rpc("orientacao_procedimentos").then((x) => ok(x) as ProcOrientacao[]),
      supabase.rpc("orientacao_lentes").then((x) => ok(x) as LenteOrientacao[]),
      supabase.from("profissionais").select("id, nome").eq("funcao", "medico").eq("ativo", true).order("nome").then((x) => ok(x) as { id: string; nome: string }[]),
    ]);
    return { procs, lentes, medicos };
  }, []);
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    let q = supabase.from("orientacao_vendas").select(SEL_VENDA).order("criado_em", { ascending: false }).limit(300);
    if (filtro === "abertas") q = q.in("status", ["aguardando", "devolvida"]);
    else if (filtro !== "todas") q = q.eq("status", filtro);
    return ok(await q) as VendaOrientacao[];
  }, [filtro]);
  const lista = dados ?? [];
  const devolvidas = lista.filter((v) => v.status === "devolvida").length;

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Vendas da orientação</h1>
          <p className="sub" style={{ margin: 0 }}>Registre aqui cada cirurgia ou lente que o paciente pagar. O Luciano confere e faz a divisão no Repasse.</p>
        </div>
        <div className="linha">
          <Link className="botao" to="/orientacao-cirurgica">← Orientação cirúrgica</Link>
          <button className="primario" onClick={() => setEdit("nova")}>➕ Registrar venda</button>
        </div>
      </div>
      <Aviso>{erro || base.erro}</Aviso>
      {devolvidas > 0 && <Aviso tipo="alerta">{devolvidas} venda(s) devolvida(s) pelo Luciano: abra, corrija e reenvie.</Aviso>}
      <div className="painel grade">
        <div className="linha">
          <select style={{ width: 230 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="abertas">Com o Luciano e devolvidas</option><option value="lancada">Conferidas</option>
            <option value="cancelada">Canceladas</option><option value="todas">Todas</option>
          </select>
        </div>
        {carregando && !dados ? <Carregando /> : (
          <div className="rolagem">
            <table className="tabela">
              <thead><tr><th>Nº</th><th>Pagamento</th><th>Paciente</th><th>Médico / procedimento</th><th>Forma</th><th style={{ textAlign: "right" }}>Valor</th><th>Situação</th></tr></thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id} className="clicavel" onClick={() => setEdit(v)}>
                    <td>{v.numero}</td>
                    <td>{fmtData(v.data_pagamento)}</td>
                    <td>{v.pacientes ? nomeExibicao(v.pacientes) : "—"}<div className="muted pequeno">Pront. {v.pacientes?.numero_prontuario}</div></td>
                    <td><b>{v.profissionais?.nome}</b><div className="muted pequeno">{v.procedimento}</div></td>
                    <td>{FORMAS_REPASSE[v.forma_pagamento]}{v.parcelas > 1 && ` ${v.parcelas}x`}</td>
                    <td style={{ textAlign: "right" }}>{fmtMoeda(v.valor_total)}</td>
                    <td><Etiqueta cor={SITUACAO[v.status].cor}>{SITUACAO[v.status].rotulo}</Etiqueta>{v.status === "devolvida" && <div className="muted pequeno">{v.motivo}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length === 0 && <div className="vazio">Nenhuma venda neste filtro.</div>}
          </div>
        )}
      </div>
      {edit && base.dados && <FormVenda venda={edit === "nova" ? null : edit} base={base.dados} aoFechar={() => setEdit(null)} aoSalvar={() => { setEdit(null); recarregar(); }} />}
    </div>
  );
}

function FormVenda({ venda, base, aoFechar, aoSalvar }: {
  venda: VendaOrientacao | null; base: { procs: ProcOrientacao[]; lentes: LenteOrientacao[]; medicos: { id: string; nome: string }[] };
  aoFechar: () => void; aoSalvar: () => void;
}) {
  const editavel = !venda || venda.status === "aguardando" || venda.status === "devolvida";
  const [pac, setPac] = useState<Pac | null>(venda?.pacientes ?? null);
  const [f, setF] = useState({
    tipo: venda?.tipo ?? "cirurgia", profissional_id: venda?.profissional_id ?? "", procedimento_id: venda?.procedimento_id ?? "",
    procedimento: venda?.procedimento ?? "", lente_id: venda?.lente_id ?? "", valor: venda ? String(venda.valor_total).replace(".", ",") : "",
    forma: venda?.forma_pagamento ?? "pix", parcelas: String(venda?.parcelas ?? 1), data_pagamento: venda?.data_pagamento ?? isoDia(new Date()),
    data_cirurgia: venda?.data_cirurgia ?? "", observacoes: venda?.observacoes ?? "",
  });
  const [erro, setErro] = useState("");
  const [cancelar, setCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const procs = base.procs.filter((p) => !p.profissional_id || !f.profissional_id || p.profissional_id === f.profissional_id);
  const proc = base.procs.find((p) => p.id === f.procedimento_id);
  const lentes = f.tipo === "lente" ? base.lentes : base.lentes.filter((l) => l.premium);

  // valor sugerido (procedimento + diferença da lente premium, ou preço da lente) — sempre editável
  useEffect(() => {
    if (!editavel || (venda && f.procedimento_id === venda.procedimento_id && f.lente_id === (venda.lente_id ?? ""))) return;
    const pp = f.tipo === "lente" ? null : f.procedimento_id || null;
    if (!pp && !f.lente_id) return;
    void supabase.rpc("orientacao_valor", { p_procedimento: pp, p_lente: f.lente_id || null }).then(({ data }) => {
      if (data !== null && data !== undefined) setF((x) => ({ ...x, valor: String(data).replace(".", ",") }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.tipo, f.procedimento_id, f.lente_id]);

  function descricao() {
    const l = base.lentes.find((x) => x.id === f.lente_id);
    if (f.tipo === "lente") return l ? `Lente ${l.descricao}` : "";
    return (proc?.nome ?? f.procedimento) + (l ? ` + lente ${l.descricao}` : "");
  }

  async function salvar() {
    setErro("");
    const valor = numOuNulo(f.valor);
    if (!pac) return setErro("Escolha o paciente.");
    if (!f.profissional_id) return setErro("Escolha o médico.");
    if (f.tipo === "cirurgia" && !f.procedimento_id && !f.procedimento.trim()) return setErro("Escolha o procedimento.");
    if (f.tipo === "lente" && !f.lente_id) return setErro("Escolha a lente.");
    if (!valor || valor <= 0) return setErro("Informe o valor que o paciente pagou.");
    const dados = {
      tipo: f.tipo, paciente_id: pac.id, profissional_id: f.profissional_id, procedimento_id: f.tipo === "lente" ? null : f.procedimento_id || null,
      procedimento: descricao() || f.procedimento.trim(), lente_id: f.lente_id || null, valor_total: valor, forma_pagamento: f.forma,
      parcelas: f.forma === "credito" ? Number(f.parcelas) : 1, data_pagamento: f.data_pagamento, data_cirurgia: f.data_cirurgia || null,
      observacoes: f.observacoes.trim() || null,
    };
    const r = venda
      ? await supabase.from("orientacao_vendas").update({ ...dados, status: "aguardando", motivo: null }).eq("id", venda.id)
      : await supabase.from("orientacao_vendas").insert(dados);
    if (r.error) return setErro(msgErro(r.error));
    aoSalvar();
  }
  async function confirmarCancelamento() {
    if (!venda) return;
    const { error } = await supabase.from("orientacao_vendas").update({ status: "cancelada", motivo: motivo.trim() }).eq("id", venda.id);
    if (error) return setErro(msgErro(error));
    aoSalvar();
  }

  return (
    <Modal titulo={venda ? `Venda nº ${venda.numero}` : "Registrar venda"} largo aoFechar={aoFechar}
      rodape={editavel ? <>
        {venda && <button className="perigo" onClick={() => setCancelar(true)}>Cancelar venda</button>}
        <span style={{ marginLeft: "auto" }} /><button onClick={aoFechar}>Fechar</button>
        <button className="primario" onClick={salvar}>{venda ? "Salvar e reenviar ao Luciano" : "Registrar e enviar ao Luciano"}</button>
      </> : <button onClick={aoFechar}>Fechar</button>}>
      <Aviso>{erro}</Aviso>
      {venda?.status === "devolvida" && <Aviso tipo="alerta">Devolvida pelo Luciano: {venda.motivo}</Aviso>}
      {!editavel && <Aviso tipo="info">{venda?.status === "lancada" ? "Já conferida e lançada pelo Luciano." : `Cancelada: ${venda?.motivo}`}</Aviso>}
      <fieldset disabled={!editavel} style={{ border: 0, padding: 0, margin: 0 }}>
        <Campo rotulo="O que o paciente está pagando">
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, lente_id: "", valor: "" })}>
            <option value="cirurgia">Cirurgia particular (com ou sem lente premium)</option>
            <option value="lente">Só a lente (cirurgia pelo convênio)</option>
          </select>
        </Campo>
        <div className="campo">
          Paciente
          {pac ? <div className="linha"><b>{nomeExibicao(pac)}</b><span className="muted pequeno">Pront. {pac.numero_prontuario}</span>
            {editavel && <button className="sutil" onClick={() => setPac(null)}>trocar</button>}</div>
            : <BuscaPaciente aoEscolher={(p) => setPac(p)} />}
        </div>
        <div className="grade g3">
          <Campo rotulo="Médico">
            <select value={f.profissional_id} onChange={set("profissional_id")}>
              <option value="">Escolha…</option>{base.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Campo>
          {f.tipo === "cirurgia" && (
            <Campo rotulo="Procedimento">
              <select value={f.procedimento_id} onChange={(e) => setF({ ...f, procedimento_id: e.target.value, lente_id: "" })}>
                <option value="">Escolha…</option>{procs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
          )}
          {(f.tipo === "lente" || proc?.tem_lente) && (
            <Campo rotulo={f.tipo === "lente" ? "Lente" : "Lente premium (opcional)"}>
              <select value={f.lente_id} onChange={set("lente_id")}>
                <option value="">{f.tipo === "lente" ? "Escolha…" : "Não, lente simples"}</option>
                {lentes.map((l) => <option key={l.id} value={l.id}>{l.descricao} · {fmtMoeda(l.preco_venda)}</option>)}
              </select>
            </Campo>
          )}
        </div>
        <div className="grade g3">
          <Campo rotulo="Valor que o paciente pagou (R$)"><input inputMode="decimal" value={f.valor} onChange={set("valor")} /></Campo>
          <Campo rotulo="Forma de pagamento">
            <select value={f.forma} onChange={set("forma")}>{Object.entries(FORMAS_REPASSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Campo>
          {f.forma === "credito" ? (
            <Campo rotulo="Parcelas"><select value={f.parcelas} onChange={set("parcelas")}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1 === 1 ? "1x (à vista)" : `${i + 1}x`}</option>)}</select></Campo>
          ) : <span />}
        </div>
        <div className="grade g3">
          <Campo rotulo="Data do pagamento"><input type="date" value={f.data_pagamento} onChange={set("data_pagamento")} /></Campo>
          <Campo rotulo="Data prevista da cirurgia"><input type="date" value={f.data_cirurgia} onChange={set("data_cirurgia")} /></Campo>
        </div>
        <Campo rotulo="Observações (opcional)"><input value={f.observacoes} onChange={set("observacoes")} placeholder="ex.: pagou entrada de R$ 1.000 no PIX e o resto no cartão" /></Campo>
      </fieldset>
      <p className="muted pequeno">O valor vem sugerido pela tabela (com a diferença da lente premium, quando houver). Se o paciente pagou outro valor, corrija.</p>
      {cancelar && (
        <Modal titulo="Cancelar venda" aoFechar={() => setCancelar(false)}
          rodape={<><button onClick={() => setCancelar(false)}>Voltar</button><button className="perigo" disabled={!motivo.trim()} onClick={confirmarCancelamento}>Cancelar venda</button></>}>
          <Campo rotulo="Motivo"><input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: paciente desistiu" /></Campo>
        </Modal>
      )}
    </Modal>
  );
}
