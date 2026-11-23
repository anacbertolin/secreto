import { useMemo, useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Modal, Campo, Etiqueta } from "../components/ui";
import { listaConvenios, listaPlanos, nomePor, type Procedimento } from "../lib/dados";
import { fmtData, fmtMoeda, isoDia, numOuNulo } from "../lib/util";

const TIPOS: Record<string, string> = {
  consulta: "Consulta", exame: "Exame", procedimento: "Procedimento", cirurgia: "Cirurgia", terapia: "Terapia", taxa: "Taxa", material: "Material", medicamento: "Medicamento",
};
const TABELAS: Record<string, string> = { "22": "22 · Procedimentos (TUSS)", "19": "19 · Materiais", "20": "20 · Medicamentos", "18": "18 · Taxas", "98": "98 · Pacotes", "00": "00 · Tabela própria (particular / Micrologos)" };

interface Preco { id: string; procedimento_id: string; convenio_id: string | null; plano_id: string | null; valor: number; vigente_de: string; ativo: boolean }
interface ExameCat { id: string; nome: string; procedimento_id: string | null }

export default function Procedimentos() {
  const [busca, setBusca] = useState("");
  const [edit, setEdit] = useState<Partial<Procedimento> | null>(null);
  const [precosDe, setPrecosDe] = useState<Procedimento | null>(null);
  const [erro, setErro] = useState("");
  const { dados, erro: e1, carregando, recarregar } = useCarregar(async () => {
    const [p, pr, ex] = await Promise.all([
      supabase.from("procedimentos").select("*").order("ativo", { ascending: false }).order("descricao"),
      supabase.from("precos").select("procedimento_id, convenio_id").eq("ativo", true),
      supabase.from("exames_catalogo").select("id, nome, procedimento_id").eq("ativo", true).order("nome"),
    ]);
    return { procs: ok(p) as Procedimento[], precos: ok(pr) as { procedimento_id: string; convenio_id: string | null }[], exames: ok(ex) as ExameCat[] };
  }, []);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (dados?.procs ?? []).filter((p) => !t || p.descricao.toLowerCase().includes(t) || (p.codigo ?? "").includes(t));
  }, [dados, busca]);

  async function salvar() {
    setErro("");
    if (!edit?.descricao?.trim()) return setErro("Informe a descrição.");
    const v = { codigo: edit.codigo?.trim() || null, tabela: edit.tabela ?? "22", descricao: edit.descricao.trim(), tipo: edit.tipo ?? "procedimento", padrao_consulta: !!edit.padrao_consulta, ativo: edit.ativo ?? true, observacao: edit.observacao?.trim() || null };
    if (v.padrao_consulta) {
      // só um procedimento pode ser o "padrão da consulta"
      const outro = dados?.procs.find((p) => p.padrao_consulta && p.id !== edit.id);
      if (outro) { const r = await supabase.from("procedimentos").update({ padrao_consulta: false }).eq("id", outro.id); if (r.error) return setErro(msgErro(r.error)); }
    }
    const r = edit.id ? await supabase.from("procedimentos").update(v).eq("id", edit.id) : await supabase.from("procedimentos").insert(v);
    if (r.error) return setErro(msgErro(r.error));
    setEdit(null); recarregar();
  }
  async function vincularExame(exameId: string, procId: string | null) {
    setErro("");
    const r = await supabase.from("exames_catalogo").update({ procedimento_id: procId }).eq("id", exameId);
    if (r.error) setErro(msgErro(r.error));
    recarregar();
  }

  const semVinculo = (dados?.exames ?? []).filter((e) => !e.procedimento_id);
  return (
    <div>
      <div className="cabecalho">
        <div><h1>Procedimentos e preços</h1><p className="sub" style={{ margin: 0 }}>O que a clínica cobra, com o código TUSS e o preço em cada convênio</p></div>
        <button className="primario" onClick={() => setEdit({ tabela: "22", tipo: "exame", ativo: true })}>➕ Novo procedimento</button>
      </div>
      <Aviso>{erro || e1}</Aviso>
      {semVinculo.length > 0 && (
        <Aviso tipo="alerta">
          {semVinculo.length} tipo(s) de exame ainda sem procedimento de cobrança: {semVinculo.slice(0, 4).map((e) => e.nome).join(", ")}{semVinculo.length > 4 ? "…" : ""}.
          Quando esses exames forem feitos, o item entra na conta sem preço. Vincule na seção abaixo.
        </Aviso>
      )}
      {carregando ? <Carregando /> : (
        <>
          <div className="painel rolagem">
            <input placeholder="Buscar por nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 12, maxWidth: 360 }} />
            <table className="tabela">
              <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Preços</th><th></th></tr></thead>
              <tbody>
                {lista.map((p) => {
                  const n = (dados?.precos ?? []).filter((x) => x.procedimento_id === p.id).length;
                  return (
                    <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.5 }}>
                      <td>{p.codigo ?? "—"}<div className="muted pequeno">tab. {p.tabela}</div></td>
                      <td><b>{p.descricao}</b>{p.observacao && <div className="muted pequeno">{p.observacao}</div>}{p.padrao_consulta && <> <Etiqueta cor="azul">lançado na chegada da consulta</Etiqueta></>}</td>
                      <td>{TIPOS[p.tipo]}</td>
                      <td>{n === 0 ? <Etiqueta cor="amarelo">sem preço</Etiqueta> : `${n} tabela(s)`}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="mini primario" onClick={() => setPrecosDe(p)}>Preços</button>{" "}
                        <button className="mini" onClick={() => setEdit(p)}>Editar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lista.length === 0 && <div className="vazio">Nenhum procedimento.</div>}
          </div>
          <div className="painel rolagem">
            <h2>Tipos de exame → procedimento cobrado</h2>
            <p className="muted pequeno" style={{ marginTop: 0 }}>Quando um exame é realizado, ele entra sozinho na conta do paciente com este procedimento e o preço do convênio.</p>
            <table className="tabela">
              <tbody>
                {(dados?.exames ?? []).map((e) => (
                  <tr key={e.id}>
                    <td><b>{e.nome}</b></td>
                    <td style={{ width: "55%" }}>
                      <select value={e.procedimento_id ?? ""} onChange={(ev) => vincularExame(e.id, ev.target.value || null)}>
                        <option value="">— sem procedimento (entra sem preço) —</option>
                        {(dados?.procs ?? []).filter((p) => p.ativo && p.tipo !== "consulta").map((p) => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ""}{p.descricao}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {edit && (
        <Modal titulo={edit.id ? "Editar procedimento" : "Novo procedimento"} aoFechar={() => setEdit(null)} rodape={<><button onClick={() => setEdit(null)}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
          <Aviso>{erro}</Aviso>
          <div className="grade g2">
            <Campo rotulo="Código (TUSS ou próprio)"><input value={edit.codigo ?? ""} onChange={(e) => setEdit({ ...edit, codigo: e.target.value })} /></Campo>
            <Campo rotulo="Tabela"><select value={edit.tabela ?? "22"} onChange={(e) => setEdit({ ...edit, tabela: e.target.value })}>{Object.entries(TABELAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            <Campo rotulo="Descrição" className="inteiro"><input value={edit.descricao ?? ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></Campo>
            <Campo rotulo="Observação" className="inteiro"><input value={edit.observacao ?? ""} onChange={(e) => setEdit({ ...edit, observacao: e.target.value })} placeholder="Ex.: preço para cartão" /></Campo>
            <Campo rotulo="Tipo"><select value={edit.tipo ?? "procedimento"} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            <div className="grade" style={{ alignContent: "end" }}>
              <label className="check"><input type="checkbox" checked={!!edit.padrao_consulta} onChange={(e) => setEdit({ ...edit, padrao_consulta: e.target.checked })} /> Lançar sozinho na chegada de uma consulta</label>
              {edit.id && <label className="check"><input type="checkbox" checked={edit.ativo ?? true} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} /> Ativo</label>}
            </div>
          </div>
        </Modal>
      )}
      {precosDe && <PrecosProcedimento proc={precosDe} aoFechar={() => { setPrecosDe(null); recarregar(); }} />}
    </div>
  );
}

function PrecosProcedimento({ proc, aoFechar }: { proc: Procedimento; aoFechar: () => void }) {
  const base = useCarregar(async () => ({ convenios: await listaConvenios(), planos: await listaPlanos() }), []);
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("precos").select("*").eq("procedimento_id", proc.id).order("vigente_de", { ascending: false })) as Preco[], [proc.id]);
  const [f, setF] = useState({ convenio_id: "", plano_id: "", valor: "", vigente_de: isoDia(new Date()) });
  const [e2, setE2] = useState("");
  async function incluir() {
    setE2("");
    const valor = numOuNulo(f.valor);
    if (valor === null) return setE2("Informe o valor.");
    const { error } = await supabase.from("precos").insert({ procedimento_id: proc.id, convenio_id: f.convenio_id || null, plano_id: f.plano_id || null, valor, vigente_de: f.vigente_de });
    if (error) return setE2(/precos_unico|duplicate/.test(error.message) ? "Já existe preço para esse convênio/plano com essa data de início." : msgErro(error));
    setF({ ...f, valor: "" }); recarregar();
  }
  async function desativar(id: string) {
    const { error } = await supabase.from("precos").update({ ativo: false }).eq("id", id);
    if (error) setE2(msgErro(error));
    recarregar();
  }
  const planos = (base.dados?.planos ?? []).filter((p) => p.convenio_id === f.convenio_id);
  return (
    <Modal largo titulo={`Preços — ${proc.codigo ? proc.codigo + " · " : ""}${proc.descricao}`} aoFechar={aoFechar} rodape={<button onClick={aoFechar}>Fechar</button>}>
      <Aviso>{erro || e2 || base.erro}</Aviso>
      <table className="tabela">
        <thead><tr><th>Tabela</th><th style={{ textAlign: "right" }}>Valor</th><th>Vale a partir de</th><th></th></tr></thead>
        <tbody>
          {(dados ?? []).filter((p) => p.ativo).map((p) => (
            <tr key={p.id}>
              <td><b>{p.convenio_id ? nomePor(base.dados?.convenios, p.convenio_id) : "Particular"}</b>{p.plano_id && <span className="muted"> · plano {nomePor(base.dados?.planos, p.plano_id)}</span>}</td>
              <td style={{ textAlign: "right" }}>{fmtMoeda(p.valor)}</td><td>{fmtData(p.vigente_de)}</td>
              <td style={{ textAlign: "right" }}><button className="sutil mini" onClick={() => desativar(p.id)}>remover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {dados?.filter((p) => p.ativo).length === 0 && <p className="muted">Nenhum preço. Sem preço, o item entra na conta em branco para preencher à mão.</p>}
      <div className="secao grade g4" style={{ marginTop: 12 }}>
        <Campo rotulo="Convênio">
          <select value={f.convenio_id} onChange={(e) => setF({ ...f, convenio_id: e.target.value, plano_id: "" })}>
            <option value="">Particular</option>{(base.dados?.convenios ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        {planos.length > 0 ? (
          <Campo rotulo="Plano (opcional)"><select value={f.plano_id} onChange={(e) => setF({ ...f, plano_id: e.target.value })}><option value="">Todos os planos</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        ) : <div />}
        <Campo rotulo="Valor (R$)"><input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder="150,00" /></Campo>
        <Campo rotulo="Vale a partir de"><input type="date" value={f.vigente_de} onChange={(e) => setF({ ...f, vigente_de: e.target.value })} /></Campo>
        <div><button className="primario" onClick={incluir}>Incluir preço</button></div>
      </div>
      <p className="muted pequeno">Reajuste: inclua um novo preço com a data de início nova. O sistema usa sempre o preço vigente na data do atendimento.</p>
    </Modal>
  );
}
