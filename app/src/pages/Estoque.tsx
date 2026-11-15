// Estoque de lentes intraoculares, medicamentos e materiais (migração 0024)
import { useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Campo, Modal, Etiqueta } from "../components/ui";
import { listaProcedimentos, type Procedimento } from "../lib/dados";
import { fmtData, fmtDataHora, fmtGrau, isoDia, numOuNulo, somaDias } from "../lib/util";

export interface Saldo {
  lote_id: string; item_id: string; tipo: string; descricao: string; fabricante: string | null; modelo: string | null;
  dioptria: number | null; estoque_minimo: number; lote: string; serie: string | null; validade: string | null; consignado: boolean; saldo: number;
}
interface Item { id: string; tipo: string; descricao: string; fabricante: string | null; modelo: string | null; dioptria: number | null; registro_anvisa: string | null; procedimento_id: string | null; estoque_minimo: number; ativo: boolean }

export const TIPOS_ESTOQUE: Record<string, string> = { lio: "Lente intraocular", medicamento: "Medicamento", material: "Material" };

export async function saldosDisponiveis(tipo?: string): Promise<Saldo[]> {
  let q = supabase.from("estoque_saldos").select("*").gt("saldo", 0).order("descricao");
  if (tipo) q = q.eq("tipo", tipo);
  return ok(await q) as Saldo[];
}

const nomeItem = (s: { descricao: string; modelo: string | null; dioptria: number | null }) =>
  [s.descricao, s.modelo, s.dioptria != null ? fmtGrau(s.dioptria) : null].filter(Boolean).join(" · ");

export default function Estoque() {
  const { pode } = useAuth();
  const cadastra = pode("enfermagem", "admin");
  const movimenta = pode("medico", "enfermagem", "admin");
  const [aba, setAba] = useState<"saldos" | "itens" | "movimentos">("saldos");
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [entrada, setEntrada] = useState(false);
  const [item, setItem] = useState<Partial<Item> | null>(null);
  const [ajuste, setAjuste] = useState<Saldo | null>(null);

  const procs = useCarregar(listaProcedimentos, []);
  const saldos = useCarregar(async () => ok(await supabase.from("estoque_saldos").select("*").order("descricao").order("validade")) as Saldo[], []);
  const itens = useCarregar(async () => ok(await supabase.from("estoque_itens").select("*").eq("ativo", true).order("tipo").order("descricao").order("dioptria")) as Item[], []);
  const movs = useCarregar(async () => aba !== "movimentos" ? [] : ok(await supabase.from("estoque_movimentos")
    .select("*, estoque_lotes(lote, serie, estoque_itens(descricao, modelo, dioptria)), pacientes(nome, numero_prontuario), profissionais:registrado_por(nome)")
    .order("criado_em", { ascending: false }).limit(200)) as unknown as Record<string, unknown>[], [aba]);

  const hoje = isoDia(new Date());
  const em60 = isoDia(somaDias(new Date(), 60));
  const S = (saldos.dados ?? []).filter((s) => (!tipo || s.tipo === tipo) && (!busca || nomeItem(s).toLowerCase().includes(busca.toLowerCase()) || s.lote.toLowerCase().includes(busca.toLowerCase())));
  const comSaldo = S.filter((s) => Number(s.saldo) > 0);
  const vencidos = comSaldo.filter((s) => s.validade && s.validade < hoje);
  const vencendo = comSaldo.filter((s) => s.validade && s.validade >= hoje && s.validade <= em60);
  // abaixo do mínimo: soma dos lotes por item
  const porItem = new Map<string, { nome: string; total: number; minimo: number }>();
  for (const s of saldos.dados ?? []) {
    const x = porItem.get(s.item_id) ?? { nome: nomeItem(s), total: 0, minimo: s.estoque_minimo };
    if (!s.validade || s.validade >= hoje) x.total += Number(s.saldo);
    porItem.set(s.item_id, x);
  }
  for (const i of itens.dados ?? []) if (!porItem.has(i.id)) porItem.set(i.id, { nome: nomeItem(i), total: 0, minimo: i.estoque_minimo });
  const baixo = [...porItem.values()].filter((x) => x.minimo > 0 && x.total < x.minimo);

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Estoque</h1>
          <p className="sub" style={{ margin: 0 }}>Lentes intraoculares, medicamentos e materiais por lote. A saída é automática quando a lente é usada na cirurgia ou o medicamento na injeção.</p>
        </div>
        <div className="linha">
          {cadastra && <button onClick={() => setItem({ tipo: "lio", estoque_minimo: 0 })}>➕ Novo item</button>}
          {cadastra && <button className="primario" onClick={() => setEntrada(true)}>📥 Entrada de lote</button>}
        </div>
      </div>
      <div className="cartoes">
        <div className="cartao"><div className="num">{comSaldo.reduce((a, s) => a + Number(s.saldo), 0)}</div><div className="rot">Unidades em estoque</div></div>
        <div className="cartao"><div className="num" style={{ color: vencendo.length ? "var(--alerta)" : undefined }}>{vencendo.length}</div><div className="rot">Lotes vencendo em 60 dias</div></div>
        <div className="cartao"><div className="num" style={{ color: vencidos.length ? "var(--perigo)" : undefined }}>{vencidos.length}</div><div className="rot">Lotes vencidos com saldo</div></div>
        <div className="cartao"><div className="num" style={{ color: baixo.length ? "var(--perigo)" : undefined }}>{baixo.length}</div><div className="rot">Itens abaixo do mínimo</div></div>
      </div>
      {baixo.length > 0 && <Aviso tipo="alerta">Abaixo do mínimo: {baixo.map((b) => `${b.nome} (${b.total}/${b.minimo})`).join(" · ")}</Aviso>}
      <div className="abas">
        {([["saldos", "Saldos por lote"], ["itens", "Itens cadastrados"], ["movimentos", "Movimentos"]] as const).map(([k, r]) => (
          <button key={k} className={aba === k ? "ativa" : ""} onClick={() => setAba(k)}>{r}</button>
        ))}
      </div>
      <Aviso>{saldos.erro || itens.erro || movs.erro}</Aviso>
      {aba === "saldos" && (
        <div className="painel rolagem">
          <div className="linha" style={{ marginBottom: 10 }}>
            <input placeholder="Buscar item ou lote…" style={{ width: 240 }} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <select style={{ width: 200 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos os tipos</option>{Object.entries(TIPOS_ESTOQUE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {saldos.carregando && !saldos.dados ? <Carregando /> : S.length === 0 ? <div className="vazio">Nada no estoque ainda. Cadastre os itens e registre as entradas.</div> : (
            <table className="tabela">
              <thead><tr><th>Item</th><th>Lote / série</th><th>Validade</th><th style={{ textAlign: "right" }}>Saldo</th><th></th></tr></thead>
              <tbody>
                {S.map((s) => (
                  <tr key={s.lote_id} style={Number(s.saldo) <= 0 ? { opacity: 0.5 } : undefined}>
                    <td><b>{nomeItem(s)}</b><div className="muted pequeno">{TIPOS_ESTOQUE[s.tipo]}{s.fabricante && ` · ${s.fabricante}`}{s.consignado && " · consignado"}</div></td>
                    <td>{s.lote}{s.serie && <div className="muted pequeno">série {s.serie}</div>}</td>
                    <td>{fmtData(s.validade) || "—"} {s.validade && s.validade < hoje && Number(s.saldo) > 0 && <Etiqueta cor="vermelho">vencido</Etiqueta>}
                      {s.validade && s.validade >= hoje && s.validade <= em60 && Number(s.saldo) > 0 && <Etiqueta cor="amarelo">vence logo</Etiqueta>}</td>
                    <td style={{ textAlign: "right" }}><b>{Number(s.saldo)}</b></td>
                    <td style={{ textAlign: "right" }}>{movimenta && <button className="mini" onClick={() => setAjuste(s)}>Ajuste / perda</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {aba === "itens" && (
        <div className="painel rolagem">
          <table className="tabela">
            <thead><tr><th>Item</th><th>Tipo</th><th>Código p/ faturar</th><th>Mínimo</th><th></th></tr></thead>
            <tbody>
              {(itens.dados ?? []).map((i) => (
                <tr key={i.id}>
                  <td><b>{nomeItem(i)}</b><div className="muted pequeno">{i.fabricante}{i.registro_anvisa && ` · ANVISA ${i.registro_anvisa}`}</div></td>
                  <td>{TIPOS_ESTOQUE[i.tipo]}</td>
                  <td>{(procs.dados ?? []).find((p) => p.id === i.procedimento_id)?.codigo ?? <span className="muted">não fatura</span>}</td>
                  <td>{i.estoque_minimo || "—"}</td>
                  <td style={{ textAlign: "right" }}>{(cadastra || pode("faturamento")) && <button className="mini" onClick={() => setItem(i)}>Editar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(itens.dados ?? []).length === 0 && <div className="vazio">Nenhum item cadastrado.</div>}
        </div>
      )}
      {aba === "movimentos" && (
        <div className="painel rolagem">
          {movs.carregando && !movs.dados ? <Carregando /> : (
            <table className="tabela">
              <thead><tr><th>Quando</th><th>Item / lote</th><th>Tipo</th><th style={{ textAlign: "right" }}>Qtd.</th><th>Paciente / motivo</th><th>Quem</th></tr></thead>
              <tbody>
                {(movs.dados ?? []).map((m) => {
                  const l = m.estoque_lotes as { lote: string; serie: string | null; estoque_itens: { descricao: string; modelo: string | null; dioptria: number | null } };
                  const p = m.pacientes as { nome: string; numero_prontuario: number } | null;
                  return (
                    <tr key={String(m.id)}>
                      <td>{fmtDataHora(String(m.criado_em))}</td>
                      <td>{nomeItem(l.estoque_itens)}<div className="muted pequeno">lote {l.lote}{l.serie && ` · série ${l.serie}`}</div></td>
                      <td><Etiqueta cor={Number(m.quantidade) > 0 ? "verde" : "cinza"}>{String(m.tipo)}</Etiqueta></td>
                      <td style={{ textAlign: "right" }}>{Number(m.quantidade) > 0 ? "+" : ""}{Number(m.quantidade)}</td>
                      <td>{p ? `${p.nome} (${p.numero_prontuario})` : ""}{m.motivo ? <div className="muted pequeno">{String(m.motivo)}</div> : null}</td>
                      <td>{(m.profissionais as { nome: string } | null)?.nome}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {entrada && <EntradaLote itens={itens.dados ?? []} aoFechar={() => setEntrada(false)} aoSalvar={() => { setEntrada(false); saldos.recarregar(); }} />}
      {item && <EditarItem item={item} procs={procs.dados ?? []} soCodigo={!cadastra} aoFechar={() => setItem(null)} aoSalvar={() => { setItem(null); itens.recarregar(); saldos.recarregar(); }} />}
      {ajuste && <Ajuste s={ajuste} aoFechar={() => setAjuste(null)} aoSalvar={() => { setAjuste(null); saldos.recarregar(); }} />}
    </div>
  );
}

function EditarItem(props: { item: Partial<Item>; procs: Procedimento[]; soCodigo: boolean; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState<Record<string, string>>({
    tipo: props.item.tipo ?? "lio", descricao: props.item.descricao ?? (props.item.tipo === "lio" || !props.item.tipo ? "Lente intraocular" : ""),
    fabricante: props.item.fabricante ?? "", modelo: props.item.modelo ?? "", dioptria: props.item.dioptria?.toString() ?? "",
    registro_anvisa: props.item.registro_anvisa ?? "", procedimento_id: props.item.procedimento_id ?? "", estoque_minimo: String(props.item.estoque_minimo ?? 0),
  });
  const [erro, setErro] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function salvar() {
    if (!f.descricao.trim()) return setErro("Informe a descrição.");
    const v = props.soCodigo ? { procedimento_id: f.procedimento_id || null } : {
      tipo: f.tipo, descricao: f.descricao.trim(), fabricante: f.fabricante || null, modelo: f.modelo || null,
      dioptria: numOuNulo(f.dioptria), registro_anvisa: f.registro_anvisa || null, procedimento_id: f.procedimento_id || null,
      estoque_minimo: Number(f.estoque_minimo) || 0,
    };
    const r = props.item.id ? await supabase.from("estoque_itens").update(v).eq("id", props.item.id) : await supabase.from("estoque_itens").insert(v);
    if (r.error) return setErro(msgErro(r.error));
    props.aoSalvar();
  }
  const d = props.soCodigo;
  return (
    <Modal titulo={props.item.id ? "Editar item" : "Novo item do estoque"} aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g3">
        <Campo rotulo="Tipo"><select disabled={d} value={f.tipo} onChange={set("tipo")}>{Object.entries(TIPOS_ESTOQUE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo rotulo="Descrição" className="span2"><input disabled={d} value={f.descricao} onChange={set("descricao")} /></Campo>
        <Campo rotulo="Fabricante"><input disabled={d} value={f.fabricante} onChange={set("fabricante")} /></Campo>
        <Campo rotulo="Modelo"><input disabled={d} value={f.modelo} onChange={set("modelo")} /></Campo>
        {f.tipo === "lio" && <Campo rotulo="Dioptria"><input disabled={d} inputMode="decimal" value={f.dioptria} onChange={set("dioptria")} /></Campo>}
        <Campo rotulo="Registro ANVISA"><input disabled={d} value={f.registro_anvisa} onChange={set("registro_anvisa")} /></Campo>
        <Campo rotulo="Estoque mínimo"><input disabled={d} inputMode="numeric" value={f.estoque_minimo} onChange={set("estoque_minimo")} /></Campo>
        <Campo rotulo="Código para faturar (procedimento)" className="inteiro">
          <select value={f.procedimento_id} onChange={set("procedimento_id")}>
            <option value="">Não fatura (só controle de estoque)</option>
            {props.procs.filter((p) => ["material", "medicamento", "taxa"].includes(p.tipo) || p.tabela === "19" || p.tabela === "20").map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}
          </select>
        </Campo>
      </div>
      <p className="muted pequeno">Lentes: cadastre um item por modelo e dioptria. Quando a lente for usada na cirurgia, sai sozinha do estoque e, se tiver código, entra na conta do convênio.</p>
    </Modal>
  );
}

function EntradaLote(props: { itens: Item[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ item_id: "", lote: "", series: "", quantidade: "1", validade: "", fornecedor: "", nota_fiscal: "", custo_unitario: "", consignado: "" });
  const [erro, setErro] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const item = props.itens.find((i) => i.id === f.item_id);
  async function salvar() {
    if (!item) return setErro("Escolha o item.");
    if (!f.lote.trim()) return setErro("Informe o lote.");
    if (f.validade && f.validade < isoDia(new Date())) return setErro("Este lote já está vencido.");
    const base = { item_id: item.id, lote: f.lote.trim(), validade: f.validade || null, fornecedor: f.fornecedor || null, nota_fiscal: f.nota_fiscal || null, custo_unitario: numOuNulo(f.custo_unitario), consignado: !!f.consignado };
    // lentes: uma linha por nº de série (cada lente é única)
    const series = f.series.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    try {
      if (item.tipo === "lio" && series.length) {
        for (const serie of series) {
          const l = ok(await supabase.from("estoque_lotes").insert({ ...base, serie }).select("id").single()) as { id: string };
          ok(await supabase.from("estoque_movimentos").insert({ lote_id: l.id, tipo: "entrada", quantidade: 1, motivo: f.nota_fiscal ? `NF ${f.nota_fiscal}` : null }));
        }
      } else {
        const q = Number(f.quantidade);
        if (!(q > 0)) return setErro("Quantidade inválida.");
        const l = ok(await supabase.from("estoque_lotes").insert(base).select("id").single()) as { id: string };
        ok(await supabase.from("estoque_movimentos").insert({ lote_id: l.id, tipo: "entrada", quantidade: q, motivo: f.nota_fiscal ? `NF ${f.nota_fiscal}` : null }));
      }
      props.aoSalvar();
    } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo="📥 Entrada de lote" aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Registrar entrada</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Item" className="inteiro">
          <select value={f.item_id} onChange={set("item_id")}><option value="">— escolha —</option>
            {props.itens.map((i) => <option key={i.id} value={i.id}>{TIPOS_ESTOQUE[i.tipo]}: {nomeItem(i)}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Lote"><input value={f.lote} onChange={set("lote")} /></Campo>
        <Campo rotulo="Validade"><input type="date" value={f.validade} onChange={set("validade")} /></Campo>
        {item?.tipo === "lio"
          ? <Campo rotulo="Números de série (um por lente, separados por espaço ou vírgula)" className="inteiro"><textarea rows={2} value={f.series} onChange={set("series")} /></Campo>
          : <Campo rotulo="Quantidade"><input inputMode="numeric" value={f.quantidade} onChange={set("quantidade")} /></Campo>}
        <Campo rotulo="Fornecedor"><input value={f.fornecedor} onChange={set("fornecedor")} /></Campo>
        <Campo rotulo="Nota fiscal"><input value={f.nota_fiscal} onChange={set("nota_fiscal")} /></Campo>
        <Campo rotulo="Custo unitário (R$)"><input inputMode="decimal" value={f.custo_unitario} onChange={set("custo_unitario")} /></Campo>
        <label className="check"><input type="checkbox" checked={!!f.consignado} onChange={(e) => setF({ ...f, consignado: e.target.checked ? "1" : "" })} /> Lente/material em consignação</label>
      </div>
      {item?.tipo === "lio" && !f.series.trim() && <Aviso tipo="info">Sem nº de série, a entrada vale pela quantidade. Com série, cada lente fica rastreável até o paciente.</Aviso>}
      {item?.tipo === "lio" && !f.series.trim() && <Campo rotulo="Quantidade"><input inputMode="numeric" value={f.quantidade} onChange={set("quantidade")} /></Campo>}
    </Modal>
  );
}

function Ajuste({ s, aoFechar, aoSalvar }: { s: Saldo; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState({ tipo: "perda", quantidade: "1", motivo: "" });
  const [erro, setErro] = useState("");
  async function salvar() {
    const q = Number(f.quantidade);
    if (!q) return setErro("Quantidade inválida.");
    if (!f.motivo.trim()) return setErro("Informe o motivo.");
    const quantidade = f.tipo === "perda" ? -Math.abs(q) : f.tipo === "devolucao" ? Math.abs(q) : q;
    const { error } = await supabase.from("estoque_movimentos").insert({ lote_id: s.lote_id, tipo: f.tipo, quantidade, motivo: f.motivo.trim() });
    if (error) return setErro(msgErro(error));
    aoSalvar();
  }
  return (
    <Modal titulo={`Ajuste · ${nomeItem(s)} · lote ${s.lote}`} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Registrar</button></>}>
      <Aviso>{erro}</Aviso>
      <p style={{ marginTop: 0 }}>Saldo atual: <b>{Number(s.saldo)}</b></p>
      <div className="grade g2">
        <Campo rotulo="Tipo">
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="perda">Perda / vencido / quebrado (sai)</option><option value="devolucao">Devolução ao estoque (entra)</option><option value="ajuste">Ajuste de contagem (+ ou −)</option>
          </select>
        </Campo>
        <Campo rotulo={f.tipo === "ajuste" ? "Quantidade (use − para tirar)" : "Quantidade"}><input value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></Campo>
        <Campo rotulo="Motivo" className="inteiro"><input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} /></Campo>
      </div>
    </Modal>
  );
}
