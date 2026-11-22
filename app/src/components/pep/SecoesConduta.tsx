import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../../lib/supabase";
import { useCarregar, ok, Aviso, Campo } from "../ui";
import { InserirModelo, limpar, type Ctx } from "./comum";
import { useEffect } from "react";
import { buscarCIDCompleto, buscarMedicamento, alergiaConflitante, normalizar, type ItemCID, type ItemMed } from "../../lib/listas";
import { fmtDataHora, fmtGrau, numOuNulo, isoDia, somaDias } from "../../lib/util";

async function remover(tabela: string, id: string, recarregar: () => void, msg = "Remover este item?") {
  if (!confirm(msg)) return;
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) alert(msgErro(error));
  recarregar();
}

// ---------------------------------------------------------------- Diagnóstico
interface Diag { id: string; cid10: string; descricao: string; olho: string | null; principal: boolean }

export function Diagnosticos({ ctx }: { ctx: Ctx }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("diagnosticos").select("*").eq("atendimento_id", ctx.atend.id).order("criado_em")) as Diag[], [ctx.atend.id]);
  const [busca, setBusca] = useState("");
  const [olho, setOlho] = useState("AO");
  const [manual, setManual] = useState({ cid: "", desc: "" });
  const [e2, setE2] = useState("");
  const d = !ctx.editaMedico;
  const [sugestoes, setSugestoes] = useState<ItemCID[]>([]);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => buscarCIDCompleto(busca).then((r) => vivo && setSugestoes(r)).catch(() => {}), 150);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca]);

  async function incluir(cid10: string, descricao: string) {
    setE2("");
    const { error } = await supabase.from("diagnosticos").insert({
      atendimento_id: ctx.atend.id, cid10: cid10.toUpperCase(), descricao, olho: olho || null, principal: (dados?.length ?? 0) === 0,
    });
    if (error) return setE2(msgErro(error));
    setBusca(""); setManual({ cid: "", desc: "" });
    recarregar();
  }
  async function tornarPrincipal(id: string) {
    for (const x of dados ?? []) if (x.principal !== (x.id === id)) await supabase.from("diagnosticos").update({ principal: x.id === id }).eq("id", x.id);
    recarregar();
  }

  return (
    <div className="grade">
      <Aviso>{erro || e2}</Aviso>
      <table className="tabela">
        <tbody>
          {(dados ?? []).map((x) => (
            <tr key={x.id}>
              <td style={{ width: 80 }}><b>{x.cid10}</b></td>
              <td>{x.descricao}{x.olho && <span className="muted"> · {x.olho}</span>}</td>
              <td>{x.principal ? <span className="etiqueta azul">Principal</span> : !d && <button className="sutil mini" onClick={() => tornarPrincipal(x.id)}>tornar principal</button>}</td>
              <td style={{ textAlign: "right" }}>{!d && <button className="sutil mini" onClick={() => remover("diagnosticos", x.id, recarregar)}>remover</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dados?.length === 0 && <div className="muted">Nenhum diagnóstico lançado.</div>}
      {!d && (
        <div className="secao grade">
          <div className="linha">
            <div className="busca" style={{ flex: 1, minWidth: 260 }}>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no CID-10 completo: catarata, H40.1, miopia…" />
              {sugestoes.length > 0 && (
                <div className="busca-lista">
                  {sugestoes.map(([c, dsc]) => <button key={c} onClick={() => incluir(c, dsc)}><b>{c}</b> {dsc}</button>)}
                </div>
              )}
            </div>
            <select value={olho} onChange={(e) => setOlho(e.target.value)} style={{ width: 90 }}>
              <option value="AO">AO</option><option value="OD">OD</option><option value="OE">OE</option><option value="">—</option>
            </select>
          </div>
          <details>
            <summary className="pequeno muted" style={{ cursor: "pointer" }}>Não achou? Digitar código manualmente</summary>
            <div className="linha" style={{ marginTop: 8 }}>
              <input style={{ width: 100 }} placeholder="CID" value={manual.cid} onChange={(e) => setManual({ ...manual, cid: e.target.value })} />
              <input style={{ flex: 1 }} placeholder="Descrição" value={manual.desc} onChange={(e) => setManual({ ...manual, desc: e.target.value })} />
              <button disabled={!manual.cid || !manual.desc} onClick={() => incluir(manual.cid, manual.desc)}>Incluir</button>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Receita de óculos
interface RxOculos {
  id: string; longe_od_esferico: number | null; longe_od_cilindrico: number | null; longe_od_eixo: number | null;
  longe_oe_esferico: number | null; longe_oe_cilindrico: number | null; longe_oe_eixo: number | null;
  adicao: number | null; dnp_od: number | null; dnp_oe: number | null; tipo_lente: string | null; observacoes: string | null; validade: string | null;
}

export function ReceitaOculos({ ctx }: { ctx: Ctx }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("prescricoes_oculos").select("*").eq("atendimento_id", ctx.atend.id).order("criado_em")) as RxOculos[], [ctx.atend.id]);
  const vazio = { od_e: "", od_c: "", od_x: "", oe_e: "", oe_c: "", oe_x: "", adicao: "", dnp_od: "", dnp_oe: "", tipo_lente: "", observacoes: "", validade: isoDia(somaDias(new Date(), 365)) };
  const [f, setF] = useState(vazio);
  const [abrir, setAbrir] = useState(false);
  const [e2, setE2] = useState("");
  const d = !ctx.editaMedico;
  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function copiarRefracao() {
    const { data } = await supabase.from("refracoes").select("*").eq("atendimento_id", ctx.atend.id).in("tipo", ["estatica_cicloplegia", "dinamica"]);
    const pega = (olho: string) => (data ?? []).find((r) => r.olho === olho && r.tipo === "dinamica") ?? (data ?? []).find((r) => r.olho === olho);
    const od = pega("OD"), oe = pega("OE");
    if (!od && !oe) return setE2("Nenhuma refração dinâmica ou estática salva neste atendimento.");
    const g = (v: number | null) => (v === null || v === undefined ? "" : fmtGrau(v).replace("Plano", "0,00"));
    setF({ ...f, od_e: g(od?.esferico), od_c: g(od?.cilindrico), od_x: od?.eixo?.toString() ?? "", oe_e: g(oe?.esferico), oe_c: g(oe?.cilindrico), oe_x: oe?.eixo?.toString() ?? "", adicao: g(od?.adicao ?? oe?.adicao) });
  }

  async function salvar() {
    setE2("");
    const v = limpar({
      atendimento_id: ctx.atend.id,
      longe_od_esferico: numOuNulo(f.od_e), longe_od_cilindrico: numOuNulo(f.od_c), longe_od_eixo: numOuNulo(f.od_x),
      longe_oe_esferico: numOuNulo(f.oe_e), longe_oe_cilindrico: numOuNulo(f.oe_c), longe_oe_eixo: numOuNulo(f.oe_x),
      adicao: numOuNulo(f.adicao), dnp_od: numOuNulo(f.dnp_od), dnp_oe: numOuNulo(f.dnp_oe),
      tipo_lente: f.tipo_lente, observacoes: f.observacoes, validade: f.validade,
    });
    const { error } = await supabase.from("prescricoes_oculos").insert(v);
    if (error) return setE2(msgErro(error));
    setF(vazio); setAbrir(false); recarregar();
  }

  return (
    <div className="grade">
      <Aviso>{erro || e2}</Aviso>
      {(dados ?? []).map((r) => (
        <div key={r.id} className="secao">
          <table className="tabela-olhos">
            <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th></tr></thead>
            <tbody>
              <tr><td>OD</td><td>{fmtGrau(r.longe_od_esferico)}</td><td>{fmtGrau(r.longe_od_cilindrico)}</td><td>{r.longe_od_eixo !== null && `${r.longe_od_eixo}°`}</td></tr>
              <tr><td>OE</td><td>{fmtGrau(r.longe_oe_esferico)}</td><td>{fmtGrau(r.longe_oe_cilindrico)}</td><td>{r.longe_oe_eixo !== null && `${r.longe_oe_eixo}°`}</td></tr>
            </tbody>
          </table>
          <p className="pequeno">
            {r.adicao !== null && <>Adição: <b>{fmtGrau(r.adicao)}</b> · </>}
            {(r.dnp_od || r.dnp_oe) && <>DNP: {r.dnp_od ?? "—"} / {r.dnp_oe ?? "—"} mm · </>}
            {r.tipo_lente && <>Lente: {r.tipo_lente} · </>}{r.observacoes}
          </p>
          <div className="linha">
            <Link className="botao mini" to={`/imprimir/oculos/${r.id}`} target="_blank">🖨️ Imprimir</Link>
            {!d && <button className="sutil mini" onClick={() => remover("prescricoes_oculos", r.id, recarregar, "Remover esta receita de óculos?")}>remover</button>}
          </div>
        </div>
      ))}
      {dados?.length === 0 && !abrir && <div className="muted">Nenhuma receita de óculos.</div>}
      {!d && !abrir && <div><button onClick={() => setAbrir(true)}>➕ Nova receita de óculos</button></div>}
      {abrir && (
        <div className="secao grade">
          <div className="linha entre"><h3>Nova receita de óculos</h3><button className="mini" onClick={copiarRefracao}>Copiar da refração</button></div>
          <table className="tabela-olhos">
            <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo (°)</th><th>DNP (mm)</th></tr></thead>
            <tbody>
              <tr><td>OD</td><td><input value={f.od_e} onChange={set("od_e")} /></td><td><input value={f.od_c} onChange={set("od_c")} /></td><td><input value={f.od_x} onChange={set("od_x")} /></td><td><input value={f.dnp_od} onChange={set("dnp_od")} /></td></tr>
              <tr><td>OE</td><td><input value={f.oe_e} onChange={set("oe_e")} /></td><td><input value={f.oe_c} onChange={set("oe_c")} /></td><td><input value={f.oe_x} onChange={set("oe_x")} /></td><td><input value={f.dnp_oe} onChange={set("dnp_oe")} /></td></tr>
            </tbody>
          </table>
          <div className="grade g3">
            <Campo rotulo="Adição (perto)"><input value={f.adicao} onChange={set("adicao")} /></Campo>
            <Campo rotulo="Tipo de lente">
              <select value={f.tipo_lente} onChange={set("tipo_lente")}>
                <option value="">—</option><option>Visão simples</option><option>Multifocal</option><option>Bifocal</option><option>Ocupacional</option><option>Lente de contato</option>
              </select>
            </Campo>
            <Campo rotulo="Validade"><input type="date" value={f.validade} onChange={set("validade")} /></Campo>
            <Campo rotulo="Observações" className="inteiro"><input value={f.observacoes} onChange={set("observacoes")} placeholder="Ex.: antirreflexo, filtro de luz azul, fotossensível…" /></Campo>
          </div>
          <div className="linha"><button onClick={() => setAbrir(false)}>Cancelar</button><button className="primario" onClick={salvar}>Salvar receita</button></div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Receita de medicamentos
interface Item { id: string; ordem: number; medicamento: string; apresentacao: string | null; posologia: string; olho: string | null; via: string | null; duracao: string | null; quantidade: string | null }
interface Rx { id: string; tipo_receita: string; observacoes: string | null; prescricao_itens: Item[] }

const COMUNS = [
  "Colírio lubrificante (carmelose 0,5%)", "Colírio lubrificante (hialuronato de sódio 0,15%)", "Gel lubrificante oftálmico",
  "Tobramicina + dexametasona colírio", "Moxifloxacino 0,5% colírio", "Ciprofloxacino 0,3% colírio", "Acetato de prednisolona 1% colírio",
  "Cetorolaco de trometamina 0,5% colírio", "Nepafenaco 0,1% colírio", "Timolol 0,5% colírio", "Latanoprosta 0,005% colírio",
  "Bimatoprosta 0,01% colírio", "Travoprosta 0,004% colírio", "Brimonidina 0,2% colírio", "Dorzolamida 2% colírio",
  "Dorzolamida 2% + timolol 0,5% colírio", "Olopatadina 0,1% colírio", "Cetotifeno 0,025% colírio", "Ciclopentolato 1% colírio",
  "Pomada oftálmica de tobramicina", "Acetazolamida 250 mg comprimido", "Aciclovir pomada oftálmica 3%",
];
const TIPO_RX: Record<string, string> = { simples: "Receita simples", controle_especial: "Controle especial", antimicrobiano: "Antimicrobiano" };

export function ReceitaMedicamentos({ ctx }: { ctx: Ctx }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("prescricoes").select("*, prescricao_itens(*)").eq("atendimento_id", ctx.atend.id).order("criado_em")) as Rx[], [ctx.atend.id]);
  const vazio = { medicamento: "", apresentacao: "", posologia: "", olho: "", via: "", duracao: "", quantidade: "", tipo_receita: "simples" };
  const [f, setF] = useState(vazio);
  const [principio, setPrincipio] = useState("");
  const [e2, setE2] = useState("");
  const d = !ctx.editaMedico;
  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function incluir() {
    setE2("");
    if (!f.medicamento || !f.posologia) return setE2("Informe o medicamento e como usar.");
    // Conferência de alergia × medicamento
    const { data: alergias } = await supabase.from("alergias").select("substancia").eq("paciente_id", ctx.atend.paciente_id).eq("ativa", true);
    const conflito = alergiaConflitante(f.medicamento, principio, (alergias ?? []).map((a) => a.substancia as string));
    if (conflito && !confirm(`⚠️ ATENÇÃO: o paciente tem alergia registrada a "${conflito}".\n\nO medicamento "${f.medicamento}"${principio ? ` (${principio})` : ""} parece ter relação com essa alergia.\n\nPrescrever mesmo assim?`)) return;
    let rx = (dados ?? []).find((r) => r.tipo_receita === f.tipo_receita);
    if (!rx) {
      const r = await supabase.from("prescricoes").insert({ atendimento_id: ctx.atend.id, tipo_receita: f.tipo_receita }).select("*").single();
      if (r.error) return setE2(msgErro(r.error));
      rx = { ...(r.data as Rx), prescricao_itens: [] };
    }
    const { error } = await supabase.from("prescricao_itens").insert(limpar({
      prescricao_id: rx.id, ordem: rx.prescricao_itens.length + 1, medicamento: f.medicamento, apresentacao: f.apresentacao,
      posologia: f.posologia, olho: f.olho, via: f.via, duracao: f.duracao, quantidade: f.quantidade,
    }));
    if (error) return setE2(msgErro(error));
    setF({ ...vazio, tipo_receita: f.tipo_receita }); setPrincipio(""); recarregar();
  }

  return (
    <div className="grade">
      <Aviso>{erro || e2}</Aviso>
      {(dados ?? []).filter((r) => r.prescricao_itens.length > 0 || !d).map((r) => (
        <div key={r.id} className="secao">
          <h3>{TIPO_RX[r.tipo_receita]}
            <span className="linha">
              {r.prescricao_itens.length > 0 && <Link className="botao mini" to={`/imprimir/receita/${r.id}`} target="_blank">🖨️ Imprimir</Link>}
              {r.prescricao_itens.length > 0 && <Link className="botao mini" to={`/imprimir/colirios/${ctx.atend.id}`} target="_blank" title="Tabela de horários dos colírios em letra grande, para o paciente levar">👁️ Horários (letra grande)</Link>}
              {!d && r.prescricao_itens.length === 0 && <button className="sutil mini" onClick={() => remover("prescricoes", r.id, recarregar, "Remover esta receita vazia?")}>remover</button>}
            </span>
          </h3>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {[...r.prescricao_itens].sort((a, b) => a.ordem - b.ordem).map((i) => (
              <li key={i.id} style={{ marginBottom: 6 }}>
                <b>{i.medicamento}</b>{i.apresentacao && ` — ${i.apresentacao}`}{i.quantidade && <span className="muted"> ({i.quantidade})</span>}
                <div>{i.posologia}{i.olho && ` · ${i.olho === "AO" ? "ambos os olhos" : i.olho === "OD" ? "olho direito" : "olho esquerdo"}`}{i.duracao && ` · por ${i.duracao}`}</div>
                {!d && <button className="sutil mini" onClick={() => remover("prescricao_itens", i.id, recarregar)}>remover</button>}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!d && (
        <div className="secao grade">
          <h3>Adicionar medicamento</h3>
          <div className="grade g4">
            <Campo rotulo="Medicamento * (lista ANVISA)" className="span2">
              <BuscaMedicamento valor={f.medicamento} aoMudar={(v, p) => { setF({ ...f, medicamento: v }); setPrincipio(p); }} />
            </Campo>
            <Campo rotulo="Apresentação"><input value={f.apresentacao} onChange={set("apresentacao")} placeholder="Frasco 5 mL" /></Campo>
            <Campo rotulo="Quantidade"><input value={f.quantidade} onChange={set("quantidade")} placeholder="1 frasco" /></Campo>
            <Campo rotulo="Como usar *" className="span2"><input value={f.posologia} onChange={set("posologia")} placeholder="Pingar 1 gota de 6 em 6 horas" /></Campo>
            <Campo rotulo="Olho">
              <select value={f.olho} onChange={set("olho")}><option value="">—</option><option value="AO">Ambos (AO)</option><option value="OD">Direito (OD)</option><option value="OE">Esquerdo (OE)</option></select>
            </Campo>
            <Campo rotulo="Por quanto tempo"><input value={f.duracao} onChange={set("duracao")} placeholder="7 dias / uso contínuo" /></Campo>
            <Campo rotulo="Via"><input value={f.via} onChange={set("via")} placeholder="Ocular / oral" /></Campo>
            <Campo rotulo="Tipo de receita">
              <select value={f.tipo_receita} onChange={set("tipo_receita")}>{Object.entries(TIPO_RX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Campo>
          </div>
          <div><button className="primario" onClick={incluir}>Adicionar à receita</button></div>
        </div>
      )}
      {d && dados?.every((r) => r.prescricao_itens.length === 0) && <div className="muted">Nenhum medicamento receitado.</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Pedidos de exame
interface Pedido { id: string; exame: string; codigo_tuss: string | null; olho: string | null; justificativa: string | null; urgente: boolean; status: string }

export function PedidosExame({ ctx }: { ctx: Ctx }) {
  const { dados, erro, recarregar } = useCarregar(async () => {
    const [p, c] = await Promise.all([
      supabase.from("solicitacoes_exames").select("*").eq("atendimento_id", ctx.atend.id).order("criado_em"),
      supabase.from("exames_catalogo").select("nome, codigo_tuss").eq("ativo", true).order("nome"),
    ]);
    return { pedidos: ok(p) as Pedido[], catalogo: ok(c) as { nome: string; codigo_tuss: string | null }[] };
  }, [ctx.atend.id]);
  const [f, setF] = useState({ exame: "", olho: "AO", justificativa: "", urgente: false });
  const [e2, setE2] = useState("");
  const d = !ctx.editaMedico;

  async function incluir() {
    setE2("");
    if (!f.exame) return setE2("Escolha o exame.");
    const cat = dados?.catalogo.find((c) => c.nome === f.exame);
    const { error } = await supabase.from("solicitacoes_exames").insert(limpar({
      atendimento_id: ctx.atend.id, exame: f.exame, codigo_tuss: cat?.codigo_tuss ?? "", olho: f.olho, justificativa: f.justificativa, urgente: f.urgente,
    }));
    if (error) return setE2(msgErro(error));
    setF({ exame: "", olho: "AO", justificativa: f.justificativa, urgente: false }); recarregar();
  }

  const pedidos = dados?.pedidos ?? [];
  return (
    <div className="grade">
      <Aviso>{erro || e2}</Aviso>
      {pedidos.length > 0 && (
        <>
          <table className="tabela">
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.exame}</b>{p.urgente && <span className="etiqueta vermelho" style={{ marginLeft: 6 }}>Urgente</span>}<div className="muted pequeno">{p.justificativa}</div></td>
                  <td>{p.olho}</td>
                  <td><span className="etiqueta cinza">{p.status}</span></td>
                  <td style={{ textAlign: "right" }}>{!d && <button className="sutil mini" onClick={() => remover("solicitacoes_exames", p.id, recarregar)}>remover</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div><Link className="botao" to={`/imprimir/pedidos/${ctx.atend.id}`} target="_blank">🖨️ Imprimir pedido de exames</Link></div>
        </>
      )}
      {pedidos.length === 0 && <div className="muted">Nenhum exame pedido.</div>}
      {!d && (
        <div className="secao grade g4">
          <Campo rotulo="Exame" className="span2">
            <input list="cat-exames" value={f.exame} onChange={(e) => setF({ ...f, exame: e.target.value })} placeholder="Escolha ou digite" />
            <datalist id="cat-exames">{dados?.catalogo.map((c) => <option key={c.nome} value={c.nome} />)}</datalist>
          </Campo>
          <Campo rotulo="Olho">
            <select value={f.olho} onChange={(e) => setF({ ...f, olho: e.target.value })}><option>AO</option><option>OD</option><option>OE</option></select>
          </Campo>
          <label className="check" style={{ alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={f.urgente} onChange={(e) => setF({ ...f, urgente: e.target.checked })} /> Urgente</label>
          <Campo rotulo="Justificativa / indicação clínica" className="span3"><input value={f.justificativa} onChange={(e) => setF({ ...f, justificativa: e.target.value })} placeholder="Ex.: suspeita de glaucoma (H40.0)" /></Campo>
          <div style={{ alignSelf: "end" }}><button className="primario" onClick={incluir}>Pedir exame</button></div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Documentos
interface Doc { id: string; tipo: string; conteudo: string; dias_afastamento: number | null; cid10: string | null; criado_em: string }
export const TIPOS_DOC: Record<string, string> = {
  atestado: "Atestado médico", declaracao_comparecimento: "Declaração de comparecimento", laudo: "Laudo médico",
  relatorio: "Relatório médico", encaminhamento: "Encaminhamento", termo_consentimento: "Termo de consentimento",
};
const TEXTO_PADRAO: Record<string, string> = {
  atestado: "Atesto, para os devidos fins, que o(a) paciente acima foi atendido(a) nesta data, necessitando de afastamento de suas atividades por {dias} dia(s).",
  declaracao_comparecimento: "Declaro, para os devidos fins, que o(a) paciente acima esteve presente nesta clínica na data de hoje, no período das ____ às ____ horas, para atendimento oftalmológico.",
  encaminhamento: "Encaminho o(a) paciente acima para avaliação e conduta.\n\nMotivo: ",
};

export function Documentos({ ctx }: { ctx: Ctx }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("documentos_clinicos").select("*").eq("atendimento_id", ctx.atend.id).order("criado_em")) as Doc[], [ctx.atend.id]);
  const [f, setF] = useState({ tipo: "", conteudo: "", dias_afastamento: "", cid10: "" });
  const [e2, setE2] = useState("");
  const d = !ctx.editaMedico;

  function escolherTipo(tipo: string) {
    setF({ ...f, tipo, conteudo: f.conteudo || (TEXTO_PADRAO[tipo] ?? "") });
  }
  async function salvar() {
    setE2("");
    if (!f.tipo || !f.conteudo.trim()) return setE2("Escolha o tipo e escreva o conteúdo.");
    const dias = f.dias_afastamento ? Number(f.dias_afastamento) : null;
    const { error } = await supabase.from("documentos_clinicos").insert({
      atendimento_id: ctx.atend.id, tipo: f.tipo, conteudo: f.conteudo.replace("{dias}", String(dias ?? "____")),
      dias_afastamento: dias, cid10: f.cid10 || null,
    });
    if (error) return setE2(msgErro(error));
    setF({ tipo: "", conteudo: "", dias_afastamento: "", cid10: "" }); recarregar();
  }

  return (
    <div className="grade">
      <Aviso>{erro || e2}</Aviso>
      {(dados ?? []).map((x) => (
        <div key={x.id} className="secao">
          <h3>{TIPOS_DOC[x.tipo]} <span className="muted pequeno">{fmtDataHora(x.criado_em)}</span></h3>
          <p style={{ whiteSpace: "pre-wrap", margin: "0 0 8px" }}>{x.conteudo}</p>
          <div className="linha">
            <Link className="botao mini" to={`/imprimir/documento/${x.id}`} target="_blank">🖨️ Imprimir</Link>
            {!d && <button className="sutil mini" onClick={() => remover("documentos_clinicos", x.id, recarregar, "Remover este documento?")}>remover</button>}
          </div>
        </div>
      ))}
      {dados?.length === 0 && <div className="muted">Nenhum documento emitido.</div>}
      {!d && (
        <div className="secao grade">
          <h3>Novo documento</h3>
          <div className="grade g3">
            <Campo rotulo="Tipo">
              <select value={f.tipo} onChange={(e) => escolherTipo(e.target.value)}>
                <option value="">Escolha…</option>
                {Object.entries(TIPOS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            {f.tipo === "atestado" && <Campo rotulo="Dias de afastamento"><input type="number" min={0} value={f.dias_afastamento} onChange={(e) => setF({ ...f, dias_afastamento: e.target.value })} /></Campo>}
            {f.tipo === "atestado" && <Campo rotulo="CID (só com autorização do paciente)"><input value={f.cid10} onChange={(e) => setF({ ...f, cid10: e.target.value })} /></Campo>}
          </div>
          <Campo rotulo="Texto">
            <span style={{ marginTop: -24, alignSelf: "flex-end" }}><InserirModelo tipo={f.tipo === "atestado" ? "atestado" : "documento"} aoEscolher={(t) => setF({ ...f, conteudo: t })} /></span>
            <textarea rows={6} value={f.conteudo} onChange={(e) => setF({ ...f, conteudo: e.target.value })} />
          </Campo>
          <div><button className="primario" onClick={salvar}>Emitir documento</button></div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Adendos
interface Adendo { id: string; texto: string; criado_em: string; profissionais: { nome: string } | null }

export function Adendos({ ctx, podeEscrever }: { ctx: Ctx; podeEscrever: boolean }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("adendos").select("id, texto, criado_em, profissionais(nome)").eq("atendimento_id", ctx.atend.id).order("criado_em")) as unknown as Adendo[], [ctx.atend.id]);
  const [texto, setTexto] = useState("");
  const [e2, setE2] = useState("");
  async function salvar() {
    setE2("");
    if (!texto.trim()) return;
    if (!confirm("Depois de salvo, o adendo não pode ser alterado nem apagado. Confirmar?")) return;
    const { error } = await supabase.from("adendos").insert({ atendimento_id: ctx.atend.id, texto: texto.trim() });
    if (error) return setE2(msgErro(error));
    setTexto(""); recarregar();
  }
  return (
    <div className="grade">
      <Aviso>{erro || e2}</Aviso>
      <p className="muted pequeno" style={{ margin: 0 }}>Atendimento finalizado não pode ser alterado. Correções e complementos são feitos por adendo (exigência do CFM).</p>
      {(dados ?? []).map((a) => (
        <div key={a.id} className="secao">
          <div className="muted pequeno">{fmtDataHora(a.criado_em)} · {a.profissionais?.nome}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{a.texto}</div>
        </div>
      ))}
      {podeEscrever && (
        <>
          <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva o adendo…" />
          <div><button className="primario" onClick={salvar} disabled={!texto.trim()}>Registrar adendo</button></div>
        </>
      )}
    </div>
  );
}

/** Campo de medicamento com sugestões: favoritos oftalmológicos + registro ativo da ANVISA */
function BuscaMedicamento({ valor, aoMudar }: { valor: string; aoMudar: (v: string, principio: string) => void }) {
  const [aberta, setAberta] = useState(false);
  const [res, setRes] = useState<ItemMed[]>([]);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => buscarMedicamento(valor).then((r) => vivo && setRes(r)).catch(() => {}), 200);
    return () => { vivo = false; clearTimeout(t); };
  }, [valor]);
  const q = normalizar(valor.trim());
  const favoritos = q.length >= 2 ? COMUNS.filter((c) => normalizar(c).includes(q)).slice(0, 6) : [];
  const rotulo = (m: ItemMed) => (normalizar(m[0]) === normalizar(m[1]) ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : `${m[0]} (${m[1]})`);
  return (
    <div className="busca">
      <input value={valor} placeholder="Nome comercial ou princípio ativo…" onChange={(e) => { aoMudar(e.target.value, ""); setAberta(true); }}
        onFocus={() => setAberta(true)} onBlur={() => setTimeout(() => setAberta(false), 200)} />
      {aberta && (favoritos.length > 0 || res.length > 0) && (
        <div className="busca-lista">
          {favoritos.map((c) => <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { aoMudar(c, c); setAberta(false); }}>⭐ {c}</button>)}
          {res.map((m) => (
            <button key={m[0] + m[1]} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { aoMudar(rotulo(m), m[1]); setAberta(false); }}>
              <div>{m[3] ? "👁️ " : ""}<b>{m[0]}</b> <span className="muted">— {m[1]}</span></div>
              <div className="muted pequeno">{m[2]}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
