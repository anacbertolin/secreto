import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo, BuscaPaciente, type PacienteResumo } from "../components/ui";
import { InserirModelo } from "../components/pep/comum";
import { SELECT_AGENDA, type Agendamento } from "../lib/dados";
import { STATUS_EXAME, fmtData, fmtDataHora, fmtEspera, fmtHora, idade, inicioDoDia, minutosDesde, nomeExibicao, somaDias } from "../lib/util";

interface ExameLinha {
  id: string; paciente_id: string; agendamento_id: string | null; solicitacao_id: string | null; exame: string; olho: string | null; status: string;
  criado_em: string; executado_em: string | null; laudado_em: string | null;
  pacientes: { nome: string; nome_social: string | null; numero_prontuario: number; data_nascimento: string | null };
}
interface Catalogo { id: string; nome: string; requer_laudo: boolean }

export default function Exames() {
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") ?? "fila";
  const [novo, setNovo] = useState<null | { paciente?: PacienteResumo; agendamento_id?: string }>(null);
  const nav = useNavigate();
  const hoje = inicioDoDia(new Date());

  const { dados, erro, carregando } = useCarregar(async () => {
    const sel = "id, paciente_id, agendamento_id, solicitacao_id, exame, olho, status, criado_em, executado_em, laudado_em, pacientes(nome, nome_social, numero_prontuario, data_nascimento)";
    const [fila, laudos, feitos, ags, cat] = await Promise.all([
      supabase.from("exames_realizados").select(sel).in("status", ["aguardando", "em_execucao"]).order("criado_em"),
      supabase.from("exames_realizados").select(sel).eq("status", "aguardando_laudo").order("executado_em"),
      supabase.from("exames_realizados").select(sel).in("status", ["laudado", "cancelado"]).order("atualizado_em", { ascending: false }).limit(50),
      supabase.from("agendamentos").select(SELECT_AGENDA).eq("tipo", "exame").in("status", ["chegou", "em_atendimento", "confirmado", "agendado"])
        .gte("inicio", hoje.toISOString()).lt("inicio", somaDias(hoje, 1).toISOString()).order("inicio"),
      supabase.from("exames_catalogo").select("id, nome, requer_laudo").eq("ativo", true).order("nome"),
    ]);
    const filaL = ok(fila) as unknown as ExameLinha[];
    const comExame = new Set(filaL.map((e) => e.agendamento_id));
    const agsSemExame = (ok(ags) as Agendamento[]).filter((a) => !comExame.has(a.id));
    return { fila: filaL, laudos: ok(laudos) as unknown as ExameLinha[], feitos: ok(feitos) as unknown as ExameLinha[], ags: agsSemExame, catalogo: ok(cat) as Catalogo[] };
  }, []);

  const Tabela = ({ lista, tempo }: { lista: ExameLinha[]; tempo: "criado" | "executado" | "laudado" }) => (
    <div className="rolagem">
      <table className="tabela">
        <thead><tr><th>Paciente</th><th>Exame</th><th>Olho</th><th>{tempo === "laudado" ? "Data" : "Esperando"}</th><th>Situação</th></tr></thead>
        <tbody>
          {lista.map((e) => (
            <tr key={e.id} className="clicavel" onClick={() => nav(`/exames/${e.id}`)}>
              <td><b>{nomeExibicao(e.pacientes)}</b><div className="muted pequeno">Pront. {e.pacientes.numero_prontuario}{e.pacientes.data_nascimento && ` · ${idade(e.pacientes.data_nascimento)}`}</div></td>
              <td>{e.exame}</td>
              <td>{e.olho ?? "—"}</td>
              <td>{tempo === "laudado" ? fmtData(e.laudado_em ?? e.criado_em) : fmtEspera(minutosDesde(tempo === "executado" ? e.executado_em : e.criado_em))}</td>
              <td><Etiqueta cor={STATUS_EXAME[e.status].cor}>{STATUS_EXAME[e.status].rotulo}</Etiqueta></td>
            </tr>
          ))}
        </tbody>
      </table>
      {lista.length === 0 && <div className="vazio">Nada por aqui.</div>}
    </div>
  );

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Exames e laudos</h1>
          <p className="sub" style={{ margin: 0 }}>Fila de exames → execução (anexar imagens) → fila de laudos → laudo assinado</p>
        </div>
        <button className="primario" onClick={() => setNovo({})}>➕ Registrar exame</button>
      </div>
      <Aviso>{erro}</Aviso>
      <div className="abas">
        <button className={aba === "fila" ? "ativa" : ""} onClick={() => setParams({ aba: "fila" })}>Fila de exames ({(dados?.fila.length ?? 0) + (dados?.ags.length ?? 0)})</button>
        <button className={aba === "laudos" ? "ativa" : ""} onClick={() => setParams({ aba: "laudos" })}>Fila de laudos ({dados?.laudos.length ?? 0})</button>
        <button className={aba === "feitos" ? "ativa" : ""} onClick={() => setParams({ aba: "feitos" })}>Laudados recentemente</button>
      </div>
      {carregando && !dados ? <Carregando /> : dados && (
        <div className="painel">
          {aba === "fila" && (
            <>
              {dados.ags.length > 0 && (
                <div className="secao">
                  <h3>Agendados para exame hoje (ainda não registrados)</h3>
                  <table className="tabela"><tbody>
                    {dados.ags.map((a) => (
                      <tr key={a.id}>
                        <td>{fmtHora(a.inicio)}</td>
                        <td><b>{nomeExibicao(a.pacientes!)}</b>{a.observacoes && <div className="muted pequeno">{a.observacoes}</div>}</td>
                        <td>{a.status === "chegou" ? <Etiqueta cor="amarelo">Chegou</Etiqueta> : <Etiqueta cor="cinza">Ainda não chegou</Etiqueta>}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="mini primario" onClick={() => setNovo({
                            agendamento_id: a.id,
                            paciente: { id: a.paciente_id, nome: a.pacientes!.nome, nome_social: a.pacientes!.nome_social, numero_prontuario: a.pacientes!.numero_prontuario, data_nascimento: a.pacientes!.data_nascimento, cpf: null, telefone: a.pacientes!.telefone, convenio_id: a.pacientes!.convenio_id },
                          })}>Registrar exame</button>
                        </td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
              <Tabela lista={dados.fila} tempo="criado" />
            </>
          )}
          {aba === "laudos" && <Tabela lista={dados.laudos} tempo="executado" />}
          {aba === "feitos" && <Tabela lista={dados.feitos} tempo="laudado" />}
        </div>
      )}
      {novo && dados && <NovoExame {...novo} catalogo={dados.catalogo} aoFechar={() => setNovo(null)} aoCriar={(id) => nav(`/exames/${id}`)} />}
    </div>
  );
}

function NovoExame(props: { paciente?: PacienteResumo; agendamento_id?: string; catalogo: Catalogo[]; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [pac, setPac] = useState<PacienteResumo | null>(props.paciente ?? null);
  const [sel, setSel] = useState<string[]>([]);
  const [olho, setOlho] = useState("AO");
  const [erro, setErro] = useState("");
  const pedidos = useCarregar(async () => {
    if (!pac) return [];
    return ok(await supabase.from("solicitacoes_exames").select("id, exame, olho, criado_em, atendimentos!inner(paciente_id)").eq("atendimentos.paciente_id", pac.id).eq("status", "solicitado").order("criado_em", { ascending: false })) as unknown as { id: string; exame: string; olho: string | null; criado_em: string }[];
  }, [pac?.id]);

  async function criar(itens: { exame: string; olho: string | null; solicitacao_id?: string }[]) {
    setErro("");
    if (!pac) return setErro("Escolha o paciente.");
    if (itens.length === 0) return setErro("Escolha pelo menos um exame.");
    const linhas = itens.map((i) => ({
      paciente_id: pac.id, agendamento_id: props.agendamento_id ?? null, solicitacao_id: i.solicitacao_id ?? null,
      exame: i.exame, exame_catalogo_id: props.catalogo.find((c) => c.nome === i.exame)?.id ?? null, olho: i.olho,
    }));
    const { data, error } = await supabase.from("exames_realizados").insert(linhas).select("id");
    if (error) return setErro(msgErro(error));
    props.aoCriar((data as { id: string }[])[0].id);
  }

  return (
    <Modal titulo="Registrar exame" aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={() => criar(sel.map((e) => ({ exame: e, olho })))}>Registrar {sel.length > 1 ? `${sel.length} exames` : ""}</button></>}>
      <Aviso>{erro}</Aviso>
      {pac ? (
        <div className="secao linha entre"><b>{nomeExibicao(pac)}</b>{!props.paciente && <button className="sutil" onClick={() => setPac(null)}>Trocar</button>}</div>
      ) : <Campo rotulo="Paciente"><BuscaPaciente autoFocus aoEscolher={setPac} /></Campo>}
      {(pedidos.dados?.length ?? 0) > 0 && (
        <div className="secao">
          <h3>Pedidos médicos em aberto deste paciente</h3>
          {pedidos.dados!.map((p) => (
            <div key={p.id} className="linha entre" style={{ padding: "4px 0" }}>
              <span>{p.exame} {p.olho && `(${p.olho})`} <span className="muted pequeno">pedido em {fmtData(p.criado_em)}</span></span>
              <button className="mini primario" onClick={() => criar([{ exame: p.exame, olho: p.olho, solicitacao_id: p.id }])}>Realizar este</button>
            </div>
          ))}
        </div>
      )}
      <h3 style={{ marginTop: 14 }}>Ou escolha o(s) exame(s)</h3>
      <div className="grade g2" style={{ maxHeight: 280, overflowY: "auto" }}>
        {props.catalogo.map((c) => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={sel.includes(c.nome)} onChange={(e) => setSel(e.target.checked ? [...sel, c.nome] : sel.filter((x) => x !== c.nome))} /> {c.nome}
          </label>
        ))}
      </div>
      <Campo rotulo="Olho" className="" >
        <select value={olho} onChange={(e) => setOlho(e.target.value)} style={{ width: 140 }}><option>AO</option><option>OD</option><option>OE</option></select>
      </Campo>
    </Modal>
  );
}

interface ExameCompleto extends ExameLinha {
  observacoes_execucao: string | null; laudo: string | null; conclusao: string | null; motivo_cancelamento: string | null;
  executado_por: string | null; laudado_por: string | null;
}
interface Arquivo { id: string; caminho: string; nome_arquivo: string; tipo_mime: string | null; tamanho_bytes: number | null; criado_em: string }

export function ExameDetalhe() {
  const { id } = useParams();
  const { eu } = useAuth();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [f, setF] = useState<{ obs?: string; laudo?: string; conclusao?: string }>({});
  const medico = eu?.funcao === "medico";

  const { dados, erro: e1, carregando, recarregar } = useCarregar(async () => {
    const e = ok(await supabase.from("exames_realizados").select("*, pacientes(nome, nome_social, numero_prontuario, data_nascimento)").eq("id", id!).single()) as unknown as ExameCompleto;
    const arqs = ok(await supabase.from("exame_arquivos").select("*").eq("exame_realizado_id", id!).order("criado_em")) as Arquivo[];
    const ids = [e.executado_por, e.laudado_por].filter(Boolean) as string[];
    const profs = ids.length ? (ok(await supabase.from("profissionais").select("id, nome").in("id", ids)) as { id: string; nome: string }[]) : [];
    setF({ obs: e.observacoes_execucao ?? "", laudo: e.laudo ?? "", conclusao: e.conclusao ?? "" });
    return { e, arqs, profs };
  }, [id]);

  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Aviso>{e1}</Aviso>;
  const { e, arqs, profs } = dados;
  const fechado = ["laudado", "cancelado"].includes(e.status);
  const nomeProf = (pid: string | null) => profs.find((p) => p.id === pid)?.nome ?? "";

  async function atualizar(campos: Record<string, unknown>, msgConfirma?: string) {
    if (msgConfirma && !confirm(msgConfirma)) return;
    setErro("");
    const { error } = await supabase.from("exames_realizados").update(campos).eq("id", e.id);
    if (error) return setErro(msgErro(error));
    recarregar();
  }

  async function enviar(files: FileList | null) {
    if (!files?.length) return;
    setErro(""); setEnviando(true);
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) { setErro(`"${file.name}" passa de 50 MB.`); continue; }
      const seguro = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
      const caminho = `${e.paciente_id}/${e.id}/${crypto.randomUUID()}-${seguro}`;
      const up = await supabase.storage.from("exames").upload(caminho, file, { contentType: file.type || undefined });
      if (up.error) { setErro(msgErro(up.error)); continue; }
      const r = await supabase.from("exame_arquivos").insert({ exame_realizado_id: e.id, caminho, nome_arquivo: file.name, tipo_mime: file.type || null, tamanho_bytes: file.size });
      if (r.error) setErro(msgErro(r.error));
    }
    setEnviando(false);
    recarregar();
  }

  async function abrirArquivo(a: Arquivo) {
    const { data, error } = await supabase.storage.from("exames").createSignedUrl(a.caminho, 300);
    if (error) return setErro(msgErro(error));
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <div className="linha"><h1 style={{ margin: 0 }}>{e.exame}{e.olho && ` · ${e.olho}`}</h1><Etiqueta cor={STATUS_EXAME[e.status].cor}>{STATUS_EXAME[e.status].rotulo}</Etiqueta></div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            <Link to={`/pacientes/${e.paciente_id}`}>{nomeExibicao(e.pacientes)}</Link> · Pront. {e.pacientes.numero_prontuario}
            {e.pacientes.data_nascimento && ` · ${idade(e.pacientes.data_nascimento)}`} · registrado em {fmtDataHora(e.criado_em)}
          </p>
        </div>
        <div className="linha">
          {e.status === "laudado" && <Link className="botao primario" to={`/imprimir/laudo/${e.id}`} target="_blank">🖨️ Imprimir laudo</Link>}
          {!fechado && <button className="perigo" onClick={() => { const m = prompt("Motivo do cancelamento:"); if (m) atualizar({ status: "cancelado", motivo_cancelamento: m }); }}>Cancelar exame</button>}
        </div>
      </div>
      <Aviso>{erro}</Aviso>
      {e.status === "cancelado" && <Aviso tipo="alerta">Exame cancelado: {e.motivo_cancelamento}</Aviso>}

      <div className="painel">
        <h2>1. Execução</h2>
        {e.executado_em && <p className="muted pequeno">Realizado em {fmtDataHora(e.executado_em)} por {nomeProf(e.executado_por)}</p>}
        <h3>Arquivos (imagens, PDF do aparelho)</h3>
        <ul className="lista-simples">
          {arqs.map((a) => (
            <li key={a.id} className="linha entre">
              <button className="sutil" onClick={() => abrirArquivo(a)}>📎 {a.nome_arquivo}</button>
              <span className="muted pequeno">{a.tamanho_bytes ? (a.tamanho_bytes < 1048576 ? `${Math.max(1, Math.round(a.tamanho_bytes / 1024))} KB · ` : `${(a.tamanho_bytes / 1048576).toFixed(1)} MB · `) : ""}{fmtDataHora(a.criado_em)}</span>
            </li>
          ))}
          {arqs.length === 0 && <li className="muted">Nenhum arquivo anexado.</li>}
        </ul>
        {!fechado && (
          <label className="botao" style={{ marginTop: 10 }}>
            {enviando ? "Enviando…" : "⬆️ Anexar arquivos"}
            <input type="file" multiple hidden accept="image/*,application/pdf,.dcm,.xml" disabled={enviando} onChange={(ev) => enviar(ev.target.files)} />
          </label>
        )}
        <Campo rotulo="Observações da execução">
          <textarea rows={2} disabled={fechado || e.status === "aguardando_laudo"} value={f.obs ?? ""} onChange={(ev) => setF({ ...f, obs: ev.target.value })} placeholder="Ex.: paciente colaborativo; pupila dilatada; baixa confiabilidade…" />
        </Campo>
        <div className="linha" style={{ marginTop: 10 }}>
          {e.status === "aguardando" && <button onClick={() => atualizar({ status: "em_execucao" })}>▶️ Iniciar exame</button>}
          {["aguardando", "em_execucao"].includes(e.status) && (
            <button className="primario" onClick={() => atualizar({ status: "aguardando_laudo", observacoes_execucao: f.obs || null }, arqs.length === 0 ? "Nenhum arquivo foi anexado. Concluir mesmo assim?" : undefined)}>✅ Concluir e enviar para laudo</button>
          )}
        </div>
      </div>

      {["aguardando_laudo", "laudado"].includes(e.status) && (
        <div className="painel">
          <h2>2. Laudo</h2>
          {e.status === "laudado" && <p className="muted pequeno">Assinado em {fmtDataHora(e.laudado_em)} por {nomeProf(e.laudado_por)}</p>}
          {e.status === "aguardando_laudo" && !medico && <Aviso tipo="info">Aguardando o médico laudar.</Aviso>}
          {(medico || e.status === "laudado") && (
            <div className="grade">
              <Campo rotulo="Laudo">
                {e.status === "aguardando_laudo" && <span style={{ marginTop: -24, alignSelf: "flex-end" }}><InserirModelo tipo="laudo" aoEscolher={(t) => setF({ ...f, laudo: f.laudo ? `${f.laudo}\n${t}` : t })} /></span>}
                <textarea rows={10} disabled={e.status === "laudado"} value={f.laudo ?? ""} onChange={(ev) => setF({ ...f, laudo: ev.target.value })} />
              </Campo>
              <Campo rotulo="Conclusão / impressão diagnóstica">
                <textarea rows={2} disabled={e.status === "laudado"} value={f.conclusao ?? ""} onChange={(ev) => setF({ ...f, conclusao: ev.target.value })} />
              </Campo>
              {e.status === "aguardando_laudo" && (
                <div className="linha">
                  <button onClick={() => atualizar({ laudo: f.laudo || null, conclusao: f.conclusao || null })}>Salvar rascunho</button>
                  <button className="primario" disabled={!f.laudo?.trim()} onClick={() => atualizar({ laudo: f.laudo, conclusao: f.conclusao || null, status: "laudado" }, "Assinar o laudo? Depois de assinado ele não pode mais ser alterado.")}>✍️ Assinar laudo</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
