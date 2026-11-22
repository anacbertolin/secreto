// Centro cirúrgico: mapa, fila de indicações, injeções intravítreas e ficha da cirurgia (migração 0022)
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Campo, Modal, Etiqueta, BuscaPaciente, type PacienteResumo } from "../components/ui";
import { NovoAgendamento } from "../components/AgendamentoModais";
import { listaConvenios, listaLocais, listaProfissionais, listaProcedimentos, nomePor } from "../lib/dados";
import { saldosDisponiveis, type Saldo } from "./Estoque";
import { fmtData, fmtDataHora, fmtHora, fmtTelefone, inicioDoDia, isoDia, numOuNulo, somaDias, fmtGrau } from "../lib/util";

export const PROCEDIMENTOS = [
  "Facoemulsificação com implante de LIO", "Vitrectomia posterior", "Trabeculectomia", "Implante de válvula (glaucoma)",
  "Exérese de pterígio com autotransplante conjuntival", "Crosslinking corneano", "Implante de anel intraestromal",
  "Transplante de córnea", "Cirurgia refrativa (PRK/LASIK)", "Blefaroplastia", "Correção de estrabismo",
  "Capsulotomia YAG laser", "Fotocoagulação a laser (panfotocoagulação)", "Iridotomia YAG laser", "Calázio / pequena cirurgia palpebral",
];
export const MEDICAMENTOS_IV = ["Aflibercepte 2 mg", "Aflibercepte 8 mg", "Ranibizumabe 0,5 mg", "Bevacizumabe 1,25 mg", "Faricimabe 6 mg", "Brolucizumabe 6 mg", "Triancinolona 4 mg", "Implante de dexametasona 0,7 mg"];
export const STATUS_CIRURGIA: Record<string, { rotulo: string; cor: string }> = {
  indicada: { rotulo: "Indicada", cor: "cinza" },
  aguardando_autorizacao: { rotulo: "Aguardando autorização", cor: "amarelo" },
  autorizada: { rotulo: "Autorizada", cor: "azul" },
  agendada: { rotulo: "Agendada", cor: "roxo" },
  realizada: { rotulo: "Realizada", cor: "verde" },
  cancelada: { rotulo: "Cancelada", cor: "vermelho" },
};
const ANESTESIAS: Record<string, string> = { topica: "Tópica", peribulbar: "Peribulbar", retrobulbar: "Retrobulbar", subtenoniana: "Subtenoniana", sedacao: "Sedação", geral: "Geral" };

// Checklist de cirurgia segura (OMS), adaptado à oftalmologia
const CHECKLIST: { momento: string; itens: [string, string][] }[] = [
  { momento: "Antes da anestesia", itens: [
    ["identidade", "Paciente confirmou nome, procedimento e olho"], ["olho_marcado", "Olho a ser operado está marcado"],
    ["consentimento", "Termo de consentimento assinado"], ["alergias", "Alergias conferidas"],
    ["anticoagulante", "Uso de anticoagulante conferido"], ["jejum", "Jejum conferido (se sedação/geral)"] ] },
  { momento: "Antes da incisão", itens: [
    ["equipe", "Equipe se apresentou"], ["lente_conferida", "Lente (modelo e dioptria) conferida com a biometria"],
    ["olho_confirmado", "Olho confirmado em voz alta"], ["material", "Material e equipamentos conferidos"] ] },
  { momento: "Antes de sair da sala", itens: [
    ["contagem", "Contagem de material conferida"], ["etiqueta_lio", "Etiqueta da lente colada no prontuário"],
    ["orientacoes", "Orientações e receita pós-operatória entregues"], ["retorno", "Retorno do dia seguinte marcado"] ] },
];

interface Cirurgia {
  id: string; paciente_id: string; cirurgiao_id: string; procedimento: string; olho: string; anestesia: string | null; status: string;
  data_prevista: string | null; sala: string | null; equipe: string | null; convenio_id: string | null; senha_autorizacao: string | null;
  prioridade: string; observacoes: string | null; comprimento_axial: number | null; k1: number | null; k2: number | null; acd: number | null;
  formula: string | null; constante_a: number | null; refracao_alvo: number | null; lio_fabricante: string | null; lio_modelo: string | null;
  lio_dioptria: number | null; lio_lote: string | null; lio_serie: string | null; lio_validade: string | null; lio_registro_anvisa: string | null;
  checklist: Record<string, string>; procedimento_id?: string | null; inicio_em: string | null; fim_em: string | null; descricao_cirurgica: string | null;
  intercorrencias: string | null; motivo_cancelamento: string | null; finalizada_em: string | null; criado_em: string;
  pacientes?: { nome: string; nome_social: string | null; numero_prontuario: number; data_nascimento: string | null; telefone: string | null };
}
const SELECT_CIR = "*, pacientes(nome, nome_social, numero_prontuario, data_nascimento, telefone)";

export default function Cirurgias() {
  const { pode } = useAuth();
  const [aba, setAba] = useState<"mapa" | "fila" | "injecoes" | "realizadas">("mapa");
  const [dia, setDia] = useState(isoDia(new Date()));
  const [nova, setNova] = useState(false);
  const [injecao, setInjecao] = useState<{ paciente_id?: string; olho?: string; medicamento?: string } | null>(null);
  const nav = useNavigate();
  const medicos = useCarregar(() => listaProfissionais(["medico"]), []);

  const lista = useCarregar(async () => {
    let q = supabase.from("cirurgias").select(SELECT_CIR);
    if (aba === "mapa") {
      const ini = new Date(dia + "T00:00:00");
      q = q.gte("data_prevista", ini.toISOString()).lt("data_prevista", somaDias(ini, 1).toISOString()).neq("status", "cancelada").order("data_prevista");
    } else if (aba === "fila") q = q.in("status", ["indicada", "aguardando_autorizacao", "autorizada"]).order("criado_em");
    else if (aba === "realizadas") q = q.eq("status", "realizada").order("finalizada_em", { ascending: false }).limit(100);
    else return [];
    return ok(await q) as Cirurgia[];
  }, [aba, dia]);
  const pend = useCarregar(async () => (aba === "injecoes" ? (ok(await supabase.rpc("injecoes_pendentes")) as Pendente[]) : []), [aba]);

  const L = lista.dados ?? [];
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Centro cirúrgico</h1>
          <p className="sub" style={{ margin: 0 }}>Mapa cirúrgico, indicações aguardando, injeções intravítreas e cirurgias realizadas.</p>
        </div>
        <div className="linha">
          <button onClick={() => setInjecao({})}>💉 Registrar injeção</button>
          {pode("medico") && <button className="primario" onClick={() => setNova(true)}>➕ Indicar cirurgia</button>}
        </div>
      </div>
      <div className="abas">
        {([["mapa", "📅 Mapa do dia"], ["fila", "Fila de indicações"], ["injecoes", "💉 Injeções"], ["realizadas", "Realizadas"]] as const).map(([k, r]) => (
          <button key={k} className={aba === k ? "ativa" : ""} onClick={() => setAba(k)}>{r}</button>
        ))}
      </div>
      <Aviso>{lista.erro || pend.erro}</Aviso>
      {aba === "mapa" && (
        <div className="linha" style={{ marginBottom: 12 }}>
          <button className="mini" onClick={() => setDia(isoDia(somaDias(new Date(dia + "T12:00"), -1)))}>◀</button>
          <input type="date" style={{ width: 170 }} value={dia} onChange={(e) => setDia(e.target.value)} />
          <button className="mini" onClick={() => setDia(isoDia(somaDias(new Date(dia + "T12:00"), 1)))}>▶</button>
          <button className="mini" onClick={() => setDia(isoDia(new Date()))}>Hoje</button>
        </div>
      )}
      {aba !== "injecoes" && (lista.carregando && !lista.dados ? <Carregando /> : (
        <div className="painel rolagem">
          {L.length === 0 ? <div className="vazio">{aba === "mapa" ? "Nenhuma cirurgia marcada para este dia." : "Nada por aqui."}</div> : (
            <table className="tabela">
              <thead><tr><th>{aba === "mapa" ? "Hora" : aba === "realizadas" ? "Realizada" : "Indicada em"}</th><th>Paciente</th><th>Procedimento</th><th>Cirurgião</th><th>Situação</th></tr></thead>
              <tbody>
                {L.map((c) => (
                  <tr key={c.id} className="clicavel" onClick={() => nav(`/cirurgias/${c.id}`)}>
                    <td><b>{aba === "mapa" ? fmtHora(c.data_prevista) : aba === "realizadas" ? fmtData(c.finalizada_em) : fmtData(c.criado_em)}</b>{aba === "mapa" && c.sala && <div className="muted pequeno">{c.sala}</div>}</td>
                    <td><b>{c.pacientes?.nome_social || c.pacientes?.nome}</b><div className="muted pequeno">Pront. {c.pacientes?.numero_prontuario}</div></td>
                    <td>{c.procedimento} · <b>{c.olho}</b>{c.lio_dioptria != null && <div className="muted pequeno">LIO {c.lio_modelo} {fmtGrau(c.lio_dioptria)}</div>}</td>
                    <td>{nomePor(medicos.dados, c.cirurgiao_id)}</td>
                    <td>
                      <Etiqueta cor={STATUS_CIRURGIA[c.status]?.cor ?? "cinza"}>{STATUS_CIRURGIA[c.status]?.rotulo ?? c.status}</Etiqueta>
                      {c.prioridade !== "eletiva" && <div><Etiqueta cor="vermelho">{c.prioridade === "urgencia" ? "Urgência" : "Prioritária"}</Etiqueta></div>}
                      {aba === "mapa" && <div className="muted pequeno">checklist {Object.keys(c.checklist ?? {}).length}/{CHECKLIST.flatMap((m) => m.itens).length}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {aba === "injecoes" && <InjecoesPendentes lista={pend.dados ?? []} carregando={pend.carregando} aoAplicar={(p) => setInjecao(p)} />}
      {nova && <NovaCirurgia aoFechar={() => setNova(false)} aoSalvar={(id) => nav(`/cirurgias/${id}`)} />}
      {injecao && <RegistrarInjecao inicial={injecao} aoFechar={() => setInjecao(null)} aoSalvar={() => { setInjecao(null); pend.recarregar(); }} />}
    </div>
  );
}

interface Pendente {
  paciente_id: string; numero_prontuario: number; nome: string; telefone: string | null; olho: string; medicamento: string;
  ultima_em: string; aplicacoes: number; proxima_prevista: string; dias_para: number; proximo_agendamento: string | null;
}

function InjecoesPendentes({ lista, carregando, aoAplicar }: { lista: Pendente[]; carregando: boolean; aoAplicar: (p: { paciente_id: string; olho: string; medicamento: string }) => void }) {
  if (carregando && lista.length === 0) return <Carregando />;
  const atrasadas = lista.filter((p) => p.dias_para < 0);
  const proximas = lista.filter((p) => p.dias_para >= 0 && p.dias_para <= 21);
  const Tabela = ({ itens }: { itens: Pendente[] }) => (
    <table className="tabela">
      <thead><tr><th>Paciente</th><th>Olho · medicamento</th><th>Aplicações</th><th>Próxima prevista</th><th>Consulta marcada</th><th></th></tr></thead>
      <tbody>
        {itens.map((p) => (
          <tr key={p.paciente_id + p.olho}>
            <td><Link to={`/pacientes/${p.paciente_id}`}><b>{p.nome}</b></Link><div className="muted pequeno">Pront. {p.numero_prontuario}{p.telefone && ` · ${fmtTelefone(p.telefone)}`}</div></td>
            <td><b>{p.olho}</b> · {p.medicamento}<div className="muted pequeno">última {fmtData(p.ultima_em)}</div></td>
            <td>{p.aplicacoes}ª</td>
            <td>{fmtData(p.proxima_prevista)} <div><Etiqueta cor={p.dias_para < 0 ? "vermelho" : p.dias_para <= 7 ? "amarelo" : "cinza"}>{p.dias_para < 0 ? `${-p.dias_para} dias de atraso` : p.dias_para === 0 ? "hoje" : `em ${p.dias_para} dias`}</Etiqueta></div></td>
            <td>{p.proximo_agendamento ? fmtDataHora(p.proximo_agendamento) : <span style={{ color: "var(--perigo)" }}>sem consulta</span>}</td>
            <td style={{ textAlign: "right" }}><button className="mini" onClick={() => aoAplicar({ paciente_id: p.paciente_id, olho: p.olho, medicamento: p.medicamento })}>💉 Aplicar</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <>
      <div className="cartoes">
        <div className="cartao"><div className="num">{atrasadas.length}</div><div className="rot">Aplicações atrasadas</div></div>
        <div className="cartao"><div className="num">{proximas.length}</div><div className="rot">Nas próximas 3 semanas</div></div>
        <div className="cartao"><div className="num">{lista.filter((p) => !p.proximo_agendamento && p.dias_para <= 21).length}</div><div className="rot">Sem consulta marcada</div></div>
      </div>
      <div className="painel rolagem"><h2>Atrasadas</h2>{atrasadas.length ? <Tabela itens={atrasadas} /> : <div className="vazio pequeno">Nenhuma. 🎉</div>}</div>
      <div className="painel rolagem"><h2>Próximas 3 semanas</h2>{proximas.length ? <Tabela itens={proximas} /> : <div className="vazio pequeno">Nenhuma.</div>}</div>
    </>
  );
}

function NovaCirurgia({ aoFechar, aoSalvar, paciente }: { aoFechar: () => void; aoSalvar: (id: string) => void; paciente?: PacienteResumo }) {
  const [pac, setPac] = useState<PacienteResumo | null>(paciente ?? null);
  const [f, setF] = useState({ procedimento: PROCEDIMENTOS[0], olho: "OD", prioridade: "eletiva", observacoes: "" });
  const [erro, setErro] = useState("");
  async function salvar() {
    if (!pac) return setErro("Escolha o paciente.");
    const { data, error } = await supabase.from("cirurgias").insert({ paciente_id: pac.id, convenio_id: pac.convenio_id, ...f, observacoes: f.observacoes || null }).select("id").single();
    if (error) return setErro(msgErro(error));
    aoSalvar((data as { id: string }).id);
  }
  return (
    <Modal titulo="Indicar cirurgia" aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Indicar</button></>}>
      <Aviso>{erro}</Aviso>
      {pac ? <p style={{ marginTop: 0 }}><b>{pac.nome_social || pac.nome}</b> · Pront. {pac.numero_prontuario} {!paciente && <button className="mini" onClick={() => setPac(null)}>trocar</button>}</p>
        : <BuscaPaciente autoFocus aoEscolher={setPac} />}
      <div className="grade g3" style={{ marginTop: 12 }}>
        <Campo rotulo="Procedimento" className="span2">
          <input list="procs-cir" value={f.procedimento} onChange={(e) => setF({ ...f, procedimento: e.target.value })} />
          <datalist id="procs-cir">{PROCEDIMENTOS.map((p) => <option key={p} value={p} />)}</datalist>
        </Campo>
        <Campo rotulo="Olho"><select value={f.olho} onChange={(e) => setF({ ...f, olho: e.target.value })}><option>OD</option><option>OE</option></select></Campo>
        <Campo rotulo="Prioridade"><select value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })}><option value="eletiva">Eletiva</option><option value="prioritaria">Prioritária</option><option value="urgencia">Urgência</option></select></Campo>
        <Campo rotulo="Observação" className="span2"><input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Campo>
      </div>
    </Modal>
  );
}
export { NovaCirurgia };

export function RegistrarInjecao({ inicial, aoFechar, aoSalvar }: { inicial: { paciente_id?: string; olho?: string; medicamento?: string }; aoFechar: () => void; aoSalvar: () => void }) {
  const [pac, setPac] = useState<{ id: string; nome: string } | null>(null);
  const [f, setF] = useState({ olho: inicial.olho ?? "OD", medicamento: inicial.medicamento ?? MEDICAMENTOS_IV[0], dose: "", lote: "", validade: "", protocolo: "tratar_e_estender", proxima_semanas: "4", indicacao_cid10: "", indicacao: "", senha_autorizacao: "", intercorrencias: "" });
  const [erro, setErro] = useState("");
  const [procId, setProcId] = useState("");
  const procs = useCarregar(async () => (await listaProcedimentos()).filter((p) => p.tipo === "procedimento"), []);
  const meds = useCarregar(() => saldosDisponiveis("medicamento").catch(() => [] as Saldo[]), []);
  useEffect(() => {
    if (inicial.paciente_id) supabase.from("pacientes").select("id, nome").eq("id", inicial.paciente_id).single().then(({ data }) => data && setPac(data as { id: string; nome: string }));
  }, [inicial.paciente_id]);
  async function salvar() {
    if (!pac) return setErro("Escolha o paciente.");
    if (!f.lote.trim()) return setErro("Informe o lote do medicamento (rastreabilidade).");
    const sem = numOuNulo(f.proxima_semanas);
    const { error } = await supabase.from("injecoes_intravitreas").insert({
      paciente_id: pac.id, olho: f.olho, medicamento: f.medicamento, dose: f.dose || null, lote: f.lote.trim(), validade: f.validade || null,
      protocolo: f.protocolo, proxima_semanas: sem, indicacao_cid10: f.indicacao_cid10 || null, indicacao: f.indicacao || null,
      senha_autorizacao: f.senha_autorizacao || null, intercorrencias: f.intercorrencias || null, procedimento_id: procId || null,
    });
    if (error) return setErro(msgErro(error));
    aoSalvar();
  }
  const vencido = f.validade && f.validade < isoDia(new Date());
  return (
    <Modal titulo="💉 Registrar injeção intravítrea" largo aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar} disabled={!!vencido}>Registrar aplicação</button></>}>
      <Aviso>{erro}</Aviso>
      {pac ? <p style={{ marginTop: 0 }}><b>{pac.nome}</b> {!inicial.paciente_id && <button className="mini" onClick={() => setPac(null)}>trocar</button>}</p>
        : <BuscaPaciente autoFocus aoEscolher={(p) => setPac({ id: p.id, nome: p.nome })} />}
      <div className="grade g4" style={{ marginTop: 12 }}>
        <Campo rotulo="Olho"><select value={f.olho} onChange={(e) => setF({ ...f, olho: e.target.value })}><option>OD</option><option>OE</option></select></Campo>
        <Campo rotulo="Medicamento" className="span2">
          <input list="meds-iv" value={f.medicamento} onChange={(e) => setF({ ...f, medicamento: e.target.value })} />
          <datalist id="meds-iv">{MEDICAMENTOS_IV.map((m) => <option key={m} value={m} />)}</datalist>
        </Campo>
        <Campo rotulo="Dose (opcional)"><input value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} /></Campo>
        <Campo rotulo="Lote *">
          <input list="lotes-iv" value={f.lote} onChange={(e) => {
            const l = (meds.dados ?? []).find((m) => m.lote === e.target.value);
            setF({ ...f, lote: e.target.value, ...(l ? { validade: l.validade ?? "" } : {}) });
          }} />
          <datalist id="lotes-iv">{(meds.dados ?? []).map((m) => <option key={m.lote_id} value={m.lote}>{m.descricao} · saldo {Number(m.saldo)} · val. {fmtData(m.validade)}</option>)}</datalist>
        </Campo>
        <Campo rotulo="Validade"><input type="date" value={f.validade} onChange={(e) => setF({ ...f, validade: e.target.value })} /></Campo>
        <Campo rotulo="Protocolo">
          <select value={f.protocolo} onChange={(e) => setF({ ...f, protocolo: e.target.value })}>
            <option value="ataque_mensal">Ataque (mensal)</option><option value="tratar_e_estender">Tratar e estender</option><option value="prn">Conforme necessidade (PRN)</option><option value="outro">Outro</option>
          </select>
        </Campo>
        <Campo rotulo="Próxima em (semanas)"><input inputMode="numeric" value={f.proxima_semanas} onChange={(e) => setF({ ...f, proxima_semanas: e.target.value.replace(/\D/g, "") })} placeholder="vazio = sem previsão" /></Campo>
        <Campo rotulo="CID da indicação"><input value={f.indicacao_cid10} onChange={(e) => setF({ ...f, indicacao_cid10: e.target.value.toUpperCase() })} placeholder="H35.3" /></Campo>
        <Campo rotulo="Indicação" className="span2"><input value={f.indicacao} onChange={(e) => setF({ ...f, indicacao: e.target.value })} placeholder="DMRI exsudativa, edema macular diabético…" /></Campo>
        <Campo rotulo="Código para faturar" className="span2">
          <select value={procId} onChange={(e) => setProcId(e.target.value)}>
            <option value="">— não lançar na conta —</option>
            {(procs.dados ?? []).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Senha do convênio"><input value={f.senha_autorizacao} onChange={(e) => setF({ ...f, senha_autorizacao: e.target.value })} /></Campo>
        <Campo rotulo="Intercorrências" className="inteiro"><input value={f.intercorrencias} onChange={(e) => setF({ ...f, intercorrencias: e.target.value })} placeholder="Sem intercorrências" /></Campo>
      </div>
      {vencido && <Aviso tipo="erro">⚠️ Medicamento com validade vencida. Não aplique.</Aviso>}
    </Modal>
  );
}

/** Ficha da cirurgia: dados, biometria/LIO, checklist OMS, ato cirúrgico e finalização */
export function CirurgiaDetalhe() {
  const { id } = useParams();
  const { eu, pode } = useAuth();
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState("");
  const [f, setF] = useState<Partial<Cirurgia>>({});
  const [retornos, setRetornos] = useState(false);
  const [agendarEm, setAgendarEm] = useState<Date | null>(null);
  const base = useCarregar(async () => {
    const [medicos, convenios, locais] = await Promise.all([listaProfissionais(["medico"]), listaConvenios(), listaLocais()]);
    return { medicos, convenios, locais };
  }, []);
  const procs = useCarregar(async () => (await listaProcedimentos()).filter((p) => ["cirurgia", "procedimento"].includes(p.tipo)), []);
  const lentes = useCarregar(() => saldosDisponiveis("lio").catch(() => [] as Saldo[]), []);
  const [escolherLente, setEscolherLente] = useState(false);
  const c = useCarregar(async () => ok(await supabase.from("cirurgias").select(SELECT_CIR).eq("id", id!).single()) as Cirurgia, [id]);
  useEffect(() => { if (c.dados) setF(c.dados); }, [c.dados]);

  if (c.carregando && !c.dados) return <Carregando />;
  if (!c.dados) return <Aviso>{c.erro || "Cirurgia não encontrada."}</Aviso>;
  const cir = c.dados;
  const travada = !!cir.finalizada_em || cir.status === "cancelada";
  const set = (k: keyof Cirurgia) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function salvar(extra: Partial<Cirurgia> = {}) {
    setErro(""); setSalvo("");
    const num = (k: keyof Cirurgia) => numOuNulo(f[k] as unknown);
    const dados = {
      status: f.status, data_prevista: f.data_prevista || null, sala: f.sala || null, equipe: f.equipe || null, anestesia: f.anestesia || null,
      senha_autorizacao: f.senha_autorizacao || null, prioridade: f.prioridade, procedimento_id: f.procedimento_id || null, observacoes: f.observacoes || null, convenio_id: f.convenio_id || null,
      comprimento_axial: num("comprimento_axial"), k1: num("k1"), k2: num("k2"), acd: num("acd"), formula: f.formula || null,
      constante_a: num("constante_a"), refracao_alvo: num("refracao_alvo"), lio_fabricante: f.lio_fabricante || null, lio_modelo: f.lio_modelo || null,
      lio_dioptria: num("lio_dioptria"), lio_lote: f.lio_lote || null, lio_serie: f.lio_serie || null, lio_validade: f.lio_validade || null,
      lio_registro_anvisa: f.lio_registro_anvisa || null, checklist: f.checklist ?? {}, inicio_em: f.inicio_em || null, fim_em: f.fim_em || null,
      descricao_cirurgica: f.descricao_cirurgica || null, intercorrencias: f.intercorrencias || null, ...extra,
    };
    const { error } = await supabase.from("cirurgias").update(dados).eq("id", cir.id);
    if (error) { setErro(msgErro(error)); return false; }
    setSalvo("Salvo ✓"); c.recarregar(); return true;
  }
  async function finalizar() {
    if (!confirm("Finalizar a cirurgia?\n\nDepois de finalizada, nada pode ser alterado.")) return;
    if (await salvar({ finalizada_em: new Date().toISOString() } as Partial<Cirurgia>)) setRetornos(true);
  }
  async function cancelar() {
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo) return;
    await salvar({ status: "cancelada", motivo_cancelamento: motivo } as Partial<Cirurgia>);
  }
  function marcar(item: string) {
    const ck = { ...(f.checklist ?? {}) };
    if (ck[item]) delete ck[item]; else ck[item] = new Date().toISOString();
    setF({ ...f, checklist: ck });
  }
  const dataLocal = (v?: string | null) => (v ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const setData = (k: keyof Cirurgia) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value ? new Date(e.target.value).toISOString() : null });
  const lioVencida = f.lio_validade && f.lio_validade < isoDia(new Date());
  const totalCk = CHECKLIST.flatMap((m) => m.itens).length;
  const feitos = Object.keys(f.checklist ?? {}).length;
  const pacResumo = { id: cir.paciente_id, numero_prontuario: cir.pacientes!.numero_prontuario, nome: cir.pacientes!.nome, nome_social: cir.pacientes!.nome_social, data_nascimento: cir.pacientes!.data_nascimento, cpf: null, telefone: cir.pacientes!.telefone, convenio_id: cir.convenio_id } as PacienteResumo;
  const finalizadaEm = cir.finalizada_em ? new Date(cir.finalizada_em) : new Date();

  return (
    <div>
      <div className="cabecalho">
        <div>
          <div className="linha">
            <h1 style={{ margin: 0 }}>{cir.procedimento} · {cir.olho}</h1>
            <Etiqueta cor={STATUS_CIRURGIA[cir.status]?.cor}>{STATUS_CIRURGIA[cir.status]?.rotulo}</Etiqueta>
          </div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            <Link to={`/pacientes/${cir.paciente_id}`}>{cir.pacientes?.nome_social || cir.pacientes?.nome}</Link> · Pront. {cir.pacientes?.numero_prontuario}
            {" · "}Cirurgião: {nomePor(base.dados?.medicos, cir.cirurgiao_id)}
            {cir.finalizada_em && ` · finalizada em ${fmtDataHora(cir.finalizada_em)}`}
          </p>
        </div>
        <div className="linha nao-imprimir">
          <button onClick={() => window.print()}>🖨️ Imprimir</button>
          {!travada && <button onClick={cancelar}>Cancelar cirurgia</button>}
          {!travada && <button className="primario" onClick={() => salvar()}>💾 Salvar</button>}
          {!travada && pode("medico") && <button className="primario" onClick={finalizar}>✅ Finalizar</button>}
          {cir.finalizada_em && <button onClick={() => setRetornos(true)}>📅 Retornos pós-operatórios</button>}
        </div>
      </div>
      <Aviso>{erro}</Aviso>
      {salvo && <Aviso tipo="ok">{salvo}</Aviso>}
      {cir.status === "cancelada" && <Aviso tipo="alerta">Cancelada: {cir.motivo_cancelamento}</Aviso>}
      <fieldset disabled={travada} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="painel">
          <h2>Dados e agendamento</h2>
          <div className="grade g4">
            <Campo rotulo="Situação">
              <select value={f.status ?? ""} onChange={set("status")}>
                {Object.entries(STATUS_CIRURGIA).filter(([k]) => !["realizada", "cancelada"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
                {f.status === "realizada" && <option value="realizada">Realizada</option>}
                {f.status === "cancelada" && <option value="cancelada">Cancelada</option>}
              </select>
            </Campo>
            <Campo rotulo="Data e hora"><input type="datetime-local" value={dataLocal(f.data_prevista)} onChange={setData("data_prevista")} /></Campo>
            <Campo rotulo="Sala"><input value={f.sala ?? ""} onChange={set("sala")} /></Campo>
            <Campo rotulo="Anestesia">
              <select value={f.anestesia ?? ""} onChange={set("anestesia")}><option value="">—</option>{Object.entries(ANESTESIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Campo>
            <Campo rotulo="Convênio">
              <select value={f.convenio_id ?? ""} onChange={set("convenio_id")}><option value="">Particular</option>{(base.dados?.convenios ?? []).map((cv) => <option key={cv.id} value={cv.id}>{cv.nome}</option>)}</select>
            </Campo>
            <Campo rotulo="Senha de autorização"><input value={f.senha_autorizacao ?? ""} onChange={set("senha_autorizacao")} /></Campo>
            <Campo rotulo="Prioridade"><select value={f.prioridade ?? "eletiva"} onChange={set("prioridade")}><option value="eletiva">Eletiva</option><option value="prioritaria">Prioritária</option><option value="urgencia">Urgência</option></select></Campo>
            <Campo rotulo="Código para faturar" className="span2">
              <select value={f.procedimento_id ?? ""} onChange={set("procedimento_id")}>
                <option value="">— não lançar na conta —</option>
                {(procs.dados ?? []).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Equipe (auxiliar, anestesista…)"><input value={f.equipe ?? ""} onChange={set("equipe")} /></Campo>
            <Campo rotulo="Observações" className="inteiro"><input value={f.observacoes ?? ""} onChange={set("observacoes")} /></Campo>
          </div>
        </div>

        <div className="painel">
          <div className="linha entre"><h2>Biometria e lente intraocular (LIO)</h2>
            {!travada && <button className="mini" onClick={() => setEscolherLente(true)}>📦 Escolher lente do estoque ({(lentes.dados ?? []).length})</button>}</div>
          <div className="grade g6">
            <Campo rotulo="Comp. axial (mm)"><input inputMode="decimal" value={f.comprimento_axial ?? ""} onChange={set("comprimento_axial")} /></Campo>
            <Campo rotulo="K1 (D)"><input inputMode="decimal" value={f.k1 ?? ""} onChange={set("k1")} /></Campo>
            <Campo rotulo="K2 (D)"><input inputMode="decimal" value={f.k2 ?? ""} onChange={set("k2")} /></Campo>
            <Campo rotulo="ACD (mm)"><input inputMode="decimal" value={f.acd ?? ""} onChange={set("acd")} /></Campo>
            <Campo rotulo="Fórmula"><input list="formulas" value={f.formula ?? ""} onChange={set("formula")} /><datalist id="formulas"><option value="Barrett Universal II" /><option value="SRK/T" /><option value="Hoffer Q" /><option value="Holladay 1" /><option value="Haigis" /><option value="Kane" /></datalist></Campo>
            <Campo rotulo="Refração alvo (D)"><input inputMode="decimal" value={f.refracao_alvo ?? ""} onChange={set("refracao_alvo")} /></Campo>
            <Campo rotulo="Fabricante"><input value={f.lio_fabricante ?? ""} onChange={set("lio_fabricante")} /></Campo>
            <Campo rotulo="Modelo"><input value={f.lio_modelo ?? ""} onChange={set("lio_modelo")} /></Campo>
            <Campo rotulo="Dioptria (D)"><input inputMode="decimal" value={f.lio_dioptria ?? ""} onChange={set("lio_dioptria")} /></Campo>
            <Campo rotulo="Constante A"><input inputMode="decimal" value={f.constante_a ?? ""} onChange={set("constante_a")} /></Campo>
            <Campo rotulo="Lote"><input value={f.lio_lote ?? ""} onChange={set("lio_lote")} /></Campo>
            <Campo rotulo="Nº de série"><input value={f.lio_serie ?? ""} onChange={set("lio_serie")} /></Campo>
            <Campo rotulo="Validade"><input type="date" value={f.lio_validade ?? ""} onChange={set("lio_validade")} /></Campo>
            <Campo rotulo="Registro ANVISA"><input value={f.lio_registro_anvisa ?? ""} onChange={set("lio_registro_anvisa")} /></Campo>
          </div>
          {lioVencida && <Aviso tipo="erro">⚠️ Lente com validade vencida.</Aviso>}
        </div>

        <div className="painel">
          <h2>Checklist de cirurgia segura <span className="muted pequeno">({feitos}/{totalCk})</span></h2>
          <div className="grade g3">
            {CHECKLIST.map((m) => (
              <div key={m.momento} className="secao" style={{ marginBottom: 0 }}>
                <b>{m.momento}</b>
                {m.itens.map(([k, r]) => (
                  <label key={k} className="check" style={{ marginTop: 8 }}>
                    <input type="checkbox" checked={!!f.checklist?.[k]} onChange={() => marcar(k)} />
                    <span>{r}{f.checklist?.[k] && <span className="muted pequeno"> · {fmtHora(f.checklist[k])}</span>}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="painel">
          <h2>Ato cirúrgico</h2>
          <div className="grade g4">
            <Campo rotulo="Início"><input type="datetime-local" value={dataLocal(f.inicio_em)} onChange={setData("inicio_em")} /></Campo>
            <Campo rotulo="Fim"><input type="datetime-local" value={dataLocal(f.fim_em)} onChange={setData("fim_em")} /></Campo>
            <Campo rotulo="Descrição cirúrgica *" className="inteiro"><textarea rows={7} value={f.descricao_cirurgica ?? ""} onChange={set("descricao_cirurgica")} /></Campo>
            <Campo rotulo="Intercorrências / complicações" className="inteiro"><textarea rows={2} value={f.intercorrencias ?? ""} onChange={set("intercorrencias")} placeholder="Sem intercorrências" /></Campo>
          </div>
        </div>
      </fieldset>
      {travada && eu?.funcao === "medico" && <p className="muted pequeno">Para corrigir algo depois de finalizada, registre um adendo no atendimento do paciente.</p>}

      {escolherLente && (
        <Modal titulo="📦 Lentes disponíveis no estoque" largo aoFechar={() => setEscolherLente(false)}>
          {(() => {
            const alvo = numOuNulo(f.lio_dioptria as unknown);
            const L = [...(lentes.dados ?? [])].sort((a, b) => (alvo == null ? 0 : Math.abs(Number(a.dioptria ?? 99) - alvo) - Math.abs(Number(b.dioptria ?? 99) - alvo)));
            if (!L.length) return <div className="vazio">Nenhuma lente com saldo no estoque.</div>;
            return (
              <table className="tabela">
                <thead><tr><th>Lente</th><th>Dioptria</th><th>Lote / série</th><th>Validade</th><th></th></tr></thead>
                <tbody>{L.map((l) => (
                  <tr key={l.lote_id}>
                    <td>{l.fabricante} {l.modelo}<div className="muted pequeno">{l.descricao}</div></td>
                    <td><b>{fmtGrau(l.dioptria)}</b></td><td>{l.lote}{l.serie && <div className="muted pequeno">série {l.serie}</div>}</td>
                    <td>{fmtData(l.validade)}</td>
                    <td><button className="mini primario" onClick={() => { setF({ ...f, lio_fabricante: l.fabricante, lio_modelo: l.modelo, lio_dioptria: l.dioptria, lio_lote: l.lote, lio_serie: l.serie, lio_validade: l.validade }); setEscolherLente(false); }}>Usar esta</button></td>
                  </tr>
                ))}</tbody>
              </table>
            );
          })()}
          <p className="muted pequeno">As mais próximas da dioptria calculada aparecem primeiro. Ao finalizar a cirurgia, a lente sai sozinha do estoque.</p>
        </Modal>
      )}
      {retornos && (
        <Modal titulo="📅 Retornos pós-operatórios" aoFechar={() => setRetornos(false)} rodape={<button onClick={() => setRetornos(false)}>Fechar</button>}>
          <p style={{ marginTop: 0 }}>Sugestão de retornos a partir da data da cirurgia. Clique para marcar na agenda.</p>
          {[[1, "1º dia"], [7, "7 dias"], [30, "30 dias"]].map(([d, r]) => {
            const dt = somaDias(inicioDoDia(finalizadaEm), d as number);
            dt.setHours(8, 0, 0, 0);
            return (
              <div key={d} className="linha entre" style={{ padding: "8px 0", borderBottom: "1px solid #f0f2f4" }}>
                <span><b>{r}</b> · {fmtData(dt)}</span>
                <button className="mini primario" onClick={() => setAgendarEm(dt)}>Agendar</button>
              </div>
            );
          })}
        </Modal>
      )}
      {agendarEm && base.dados && (
        <NovoAgendamento {...base.dados} inicial={{ paciente: pacResumo, inicio: agendarEm, tipo: "retorno", profissional_id: cir.cirurgiao_id }}
          aoFechar={() => setAgendarEm(null)} aoSalvar={() => setAgendarEm(null)} />
      )}
    </div>
  );
}

/** Cirurgias e injeções do paciente (aba na ficha) */
export function CirurgiasPaciente({ pacienteId, paciente }: { pacienteId: string; paciente: PacienteResumo }) {
  const { pode } = useAuth();
  const nav = useNavigate();
  const [nova, setNova] = useState(false);
  const [inj, setInj] = useState(false);
  const d = useCarregar(async () => {
    const [c, i] = await Promise.all([
      supabase.from("cirurgias").select("*").eq("paciente_id", pacienteId).order("criado_em", { ascending: false }),
      supabase.from("injecoes_resumo").select("*").eq("paciente_id", pacienteId).order("aplicado_em", { ascending: false }),
    ]);
    return { cir: ok(c) as Cirurgia[], inj: ok(i) as (Record<string, string | number | boolean | null>)[] };
  }, [pacienteId]);
  return (
    <div className="painel">
      <div className="linha entre">
        <h2 style={{ margin: 0 }}>Cirurgias</h2>
        <div className="linha">
          <button className="mini" onClick={() => setInj(true)}>💉 Registrar injeção</button>
          {pode("medico") && <button className="mini primario" onClick={() => setNova(true)}>➕ Indicar cirurgia</button>}
        </div>
      </div>
      <Aviso>{d.erro}</Aviso>
      {(d.dados?.cir ?? []).length === 0 ? <div className="vazio pequeno">Nenhuma cirurgia.</div> : (
        <table className="tabela"><tbody>
          {d.dados!.cir.map((c) => (
            <tr key={c.id} className="clicavel" onClick={() => nav(`/cirurgias/${c.id}`)}>
              <td>{fmtData(c.finalizada_em ?? c.data_prevista ?? c.criado_em)}</td>
              <td><b>{c.procedimento}</b> · {c.olho}{c.lio_modelo && <div className="muted pequeno">LIO {c.lio_modelo} {fmtGrau(c.lio_dioptria)} · lote {c.lio_lote ?? "—"}</div>}</td>
              <td><Etiqueta cor={STATUS_CIRURGIA[c.status]?.cor}>{STATUS_CIRURGIA[c.status]?.rotulo}</Etiqueta></td>
            </tr>
          ))}
        </tbody></table>
      )}
      <h2 style={{ marginTop: 20 }}>Injeções intravítreas</h2>
      {(d.dados?.inj ?? []).length === 0 ? <div className="vazio pequeno">Nenhuma aplicação.</div> : (
        <table className="tabela">
          <thead><tr><th>Data</th><th>Olho</th><th>Medicamento</th><th>Nº</th><th>Lote</th><th>Próxima</th></tr></thead>
          <tbody>
            {d.dados!.inj.map((i) => (
              <tr key={String(i.id)} style={i.cancelada ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                <td>{fmtData(String(i.aplicado_em))}</td><td><b>{String(i.olho)}</b></td><td>{String(i.medicamento)}</td>
                <td>{i.numero_na_serie ? `${i.numero_na_serie}ª` : "—"}</td><td>{String(i.lote ?? "—")}</td><td>{i.proxima_prevista ? fmtData(String(i.proxima_prevista)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {nova && <NovaCirurgia paciente={paciente} aoFechar={() => setNova(false)} aoSalvar={(id) => nav(`/cirurgias/${id}`)} />}
      {inj && <RegistrarInjecao inicial={{ paciente_id: pacienteId }} aoFechar={() => setInj(false)} aoSalvar={() => { setInj(false); d.recarregar(); }} />}
    </div>
  );
}
