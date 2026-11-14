import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { Modal, Campo, Aviso, BuscaPaciente, Etiqueta, type PacienteResumo } from "./ui";
import type { Profissional } from "../lib/auth";
import type { Agendamento, Convenio, Local } from "../lib/dados";
import { nomePor } from "../lib/dados";
import {
  STATUS_AGENDA, TIPOS_AGENDA, fmtData, fmtHora, fmtTelefone, idade, isoDia, nomeExibicao, soNumeros, cpfValido,
} from "../lib/util";

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Cadastro rápido de paciente (dados mínimos para marcar) */
export function CadastroRapido(props: { aoCriar: (p: PacienteResumo) => void; convenios: Convenio[]; nomeInicial?: string }) {
  const [f, setF] = useState({ nome: props.nomeInicial ?? "", telefone: "", data_nascimento: "", cpf: "", convenio_id: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setErro("");
    if (f.nome.trim().length < 3) return setErro("Informe o nome completo.");
    if (soNumeros(f.telefone).length < 10) return setErro("Informe um telefone com DDD.");
    if (f.cpf && !cpfValido(f.cpf)) return setErro("CPF inválido.");
    setSalvando(true);
    const { data, error } = await supabase
      .from("pacientes")
      .insert({
        nome: f.nome.trim().toUpperCase(),
        telefone: soNumeros(f.telefone),
        data_nascimento: f.data_nascimento || null,
        cpf: f.cpf ? soNumeros(f.cpf) : null,
        convenio_id: f.convenio_id || null,
      })
      .select("id, numero_prontuario, nome, nome_social, data_nascimento, cpf, telefone, convenio_id")
      .single();
    setSalvando(false);
    if (error) return setErro(msgErro(error));
    props.aoCriar(data as PacienteResumo);
  }
  return (
    <div className="secao">
      <h3>Cadastro rápido de paciente</h3>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Nome completo *" className="inteiro"><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo rotulo="Telefone (com DDD) *"><input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} inputMode="tel" /></Campo>
        <Campo rotulo="Data de nascimento"><input type="date" value={f.data_nascimento} onChange={(e) => setF({ ...f, data_nascimento: e.target.value })} /></Campo>
        <Campo rotulo="CPF"><input value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} inputMode="numeric" /></Campo>
        <Campo rotulo="Convênio">
          <select value={f.convenio_id} onChange={(e) => setF({ ...f, convenio_id: e.target.value })}>
            <option value="">Particular</option>
            {props.convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
      </div>
      <p className="muted pequeno">O cadastro completo pode ser feito depois, na chegada do paciente.</p>
      <button className="primario" onClick={salvar} disabled={salvando}>Cadastrar e usar este paciente</button>
    </div>
  );
}

export function NovoAgendamento(props: {
  aoFechar: () => void;
  aoSalvar: () => void;
  medicos: Profissional[];
  convenios: Convenio[];
  locais: Local[];
  inicial?: { profissional_id?: string; inicio?: Date; duracao?: number; local_id?: string | null; encaixe?: boolean; paciente?: PacienteResumo; tipo?: string };
}) {
  const ini = props.inicial ?? {};
  const [paciente, setPaciente] = useState<PacienteResumo | null>(ini.paciente ?? null);
  const [cadastrar, setCadastrar] = useState(false);
  const [f, setF] = useState({
    profissional_id: ini.profissional_id ?? props.medicos[0]?.id ?? "",
    data: isoDia(ini.inicio ?? new Date()),
    hora: ini.inicio ? hhmm(ini.inicio) : hhmm(new Date(Math.ceil(Date.now() / 900000) * 900000)),
    duracao: ini.duracao ?? 15,
    tipo: ini.tipo ?? "consulta",
    convenio_id: ini.paciente?.convenio_id ?? "",
    local_id: ini.local_id ?? "",
    primeira_vez: false,
    encaixe: !!ini.encaixe,
    observacoes: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (paciente) setF((x) => ({ ...x, convenio_id: paciente.convenio_id ?? "" }));
  }, [paciente]);

  async function salvar() {
    setErro("");
    if (!paciente) return setErro("Escolha o paciente.");
    if (!f.profissional_id) return setErro("Escolha o profissional.");
    const inicio = new Date(`${f.data}T${f.hora}:00`);
    const fim = new Date(inicio.getTime() + Number(f.duracao) * 60000);
    setSalvando(true);
    const { error } = await supabase.from("agendamentos").insert({
      paciente_id: paciente.id,
      profissional_id: f.profissional_id,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      tipo: f.tipo,
      convenio_id: f.convenio_id || null,
      plano_id: f.convenio_id && f.convenio_id === paciente.convenio_id ? paciente.plano_id ?? null : null,
      local_id: f.local_id || null,
      primeira_vez: f.primeira_vez,
      encaixe: f.encaixe,
      observacoes: f.observacoes || null,
    });
    setSalvando(false);
    if (error) return setErro(msgErro(error));
    props.aoSalvar();
  }

  return (
    <Modal
      titulo={f.encaixe ? "Encaixe" : "Novo agendamento"}
      aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={salvar} disabled={salvando}>Agendar</button></>}
    >
      <Aviso>{erro}</Aviso>
      <div className="grade">
        {paciente ? (
          <div className="secao linha entre">
            <div>
              <b>{nomeExibicao(paciente)}</b>
              <div className="muted pequeno">
                Pront. {paciente.numero_prontuario}
                {paciente.data_nascimento && ` · ${idade(paciente.data_nascimento)}`}
                {paciente.telefone && ` · ${fmtTelefone(paciente.telefone)}`}
              </div>
            </div>
            <button className="sutil" onClick={() => setPaciente(null)}>Trocar</button>
          </div>
        ) : cadastrar ? (
          <>
            <CadastroRapido convenios={props.convenios} aoCriar={(p) => { setPaciente(p); setCadastrar(false); }} />
            <button className="sutil" onClick={() => setCadastrar(false)}>← Voltar para a busca</button>
          </>
        ) : (
          <div className="grade">
            <Campo rotulo="Paciente"><BuscaPaciente autoFocus aoEscolher={setPaciente} /></Campo>
            <button className="sutil" style={{ justifySelf: "start" }} onClick={() => setCadastrar(true)}>➕ Paciente novo? Cadastrar rápido</button>
          </div>
        )}
        <div className="grade g3">
          <Campo rotulo="Profissional" className="span2">
            <select value={f.profissional_id} onChange={(e) => setF({ ...f, profissional_id: e.target.value })}>
              {props.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tipo">
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {Object.entries(TIPOS_AGENDA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Data"><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Hora"><input type="time" step={300} value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Campo>
          <Campo rotulo="Duração (min)">
            <select value={f.duracao} onChange={(e) => setF({ ...f, duracao: Number(e.target.value) })}>
              {[5, 10, 15, 20, 30, 40, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Convênio">
            <select value={f.convenio_id} onChange={(e) => setF({ ...f, convenio_id: e.target.value })}>
              <option value="">Particular</option>
              {props.convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Sala / consultório">
            <select value={f.local_id} onChange={(e) => setF({ ...f, local_id: e.target.value })}>
              <option value="">—</option>
              {props.locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </Campo>
          <div className="grade" style={{ alignContent: "end" }}>
            <label className="check"><input type="checkbox" checked={f.primeira_vez} onChange={(e) => setF({ ...f, primeira_vez: e.target.checked })} /> Primeira consulta</label>
            <label className="check"><input type="checkbox" checked={f.encaixe} onChange={(e) => setF({ ...f, encaixe: e.target.checked })} /> Encaixe</label>
          </div>
          <Campo rotulo="Observações" className="inteiro">
            <input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} placeholder="Ex.: trazer exames anteriores, dilatar pupila…" />
          </Campo>
        </div>
      </div>
    </Modal>
  );
}

export function DetalheAgendamento(props: {
  ag: Agendamento;
  aoFechar: () => void;
  aoAlterar: () => void;
  medicos: Profissional[];
  convenios: Convenio[];
  locais: Local[];
}) {
  const a = props.ag;
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState<"" | "cancelar" | "remarcar" | "confirmar">("");
  const [motivo, setMotivo] = useState("");
  const [canal, setCanal] = useState("telefone");
  const ini = new Date(a.inicio);
  const dur = Math.round((new Date(a.fim).getTime() - ini.getTime()) / 60000);
  const [rem, setRem] = useState({ profissional_id: a.profissional_id, data: isoDia(ini), hora: hhmm(ini), duracao: dur });
  const st = STATUS_AGENDA[a.status];

  async function atualizar(campos: Record<string, unknown>) {
    setErro("");
    const { error } = await supabase.from("agendamentos").update(campos).eq("id", a.id);
    if (error) return setErro(msgErro(error));
    props.aoAlterar();
  }

  async function remarcar() {
    const inicio = new Date(`${rem.data}T${rem.hora}:00`);
    await atualizar({
      profissional_id: rem.profissional_id,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + rem.duracao * 60000).toISOString(),
    });
  }

  const ativo = !["cancelado", "faltou", "atendido"].includes(a.status);
  const p = a.pacientes!;

  return (
    <Modal titulo="Agendamento" aoFechar={props.aoFechar} rodape={<button onClick={props.aoFechar}>Fechar</button>}>
      <Aviso>{erro}</Aviso>
      <div className="linha entre" style={{ alignItems: "flex-start" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{nomeExibicao(p)}</h2>
          <div className="muted pequeno">
            Pront. {p.numero_prontuario}
            {p.data_nascimento && ` · ${fmtData(p.data_nascimento)} (${idade(p.data_nascimento)})`}
            {p.telefone && ` · ${fmtTelefone(p.telefone)}`}
          </div>
        </div>
        <Etiqueta cor={st.cor}>{st.rotulo}</Etiqueta>
      </div>
      <dl className="grade g2" style={{ margin: "16px 0" }}>
        <div><dt className="muted pequeno">Quando</dt><dd style={{ margin: 0 }}>{fmtData(a.inicio)} às {fmtHora(a.inicio)} ({dur} min)</dd></div>
        <div><dt className="muted pequeno">Profissional</dt><dd style={{ margin: 0 }}>{nomePor(props.medicos, a.profissional_id)}</dd></div>
        <div><dt className="muted pequeno">Tipo</dt><dd style={{ margin: 0 }}>{TIPOS_AGENDA[a.tipo]}{a.primeira_vez && " · 1ª vez"}{a.encaixe && " · encaixe"}</dd></div>
        <div><dt className="muted pequeno">Convênio</dt><dd style={{ margin: 0 }}>{nomePor(props.convenios, a.convenio_id) || "Particular"}</dd></div>
        {a.local_id && <div><dt className="muted pequeno">Sala</dt><dd style={{ margin: 0 }}>{nomePor(props.locais, a.local_id)}</dd></div>}
        {a.confirmado_em && <div><dt className="muted pequeno">Confirmado</dt><dd style={{ margin: 0 }}>{fmtData(a.confirmado_em)} {fmtHora(a.confirmado_em)} {a.canal_confirmacao && `(${a.canal_confirmacao})`}</dd></div>}
        {a.chegada_em && <div><dt className="muted pequeno">Chegou às</dt><dd style={{ margin: 0 }}>{fmtHora(a.chegada_em)}</dd></div>}
        {a.observacoes && <div className="inteiro"><dt className="muted pequeno">Observações</dt><dd style={{ margin: 0 }}>{a.observacoes}</dd></div>}
        {a.motivo_cancelamento && <div className="inteiro"><dt className="muted pequeno">Motivo do cancelamento</dt><dd style={{ margin: 0 }}>{a.motivo_cancelamento}</dd></div>}
      </dl>

      {ativo && modo === "" && (
        <div className="linha">
          {a.status === "agendado" && <button onClick={() => setModo("confirmar")}>✅ Confirmar</button>}
          {["agendado", "confirmado"].includes(a.status) && <button className="primario" onClick={() => atualizar({ status: "chegou" })}>🛎️ Paciente chegou</button>}
          {a.status === "chegou" && <button onClick={() => atualizar({ status: "confirmado", chegada_em: null })}>↩️ Desfazer chegada</button>}
          <button onClick={() => setModo("remarcar")}>🔁 Remarcar</button>
          {["agendado", "confirmado"].includes(a.status) && <button onClick={() => atualizar({ status: "faltou" })}>Faltou</button>}
          <button className="perigo" onClick={() => setModo("cancelar")}>Cancelar</button>
        </div>
      )}
      {a.status === "faltou" && <button onClick={() => atualizar({ status: "agendado" })}>↩️ Desfazer falta</button>}

      {modo === "confirmar" && (
        <div className="secao grade">
          <Campo rotulo="Como o paciente confirmou?">
            <select value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="telefone">Telefone</option><option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option><option value="email">E-mail</option><option value="presencial">Presencial</option>
            </select>
          </Campo>
          <div className="linha"><button onClick={() => setModo("")}>Voltar</button><button className="primario" onClick={() => atualizar({ status: "confirmado", canal_confirmacao: canal })}>Confirmar</button></div>
        </div>
      )}
      {modo === "cancelar" && (
        <div className="secao grade">
          <Campo rotulo="Motivo do cancelamento *">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Escolha…</option>
              <option>Cancelado pelo paciente</option><option>Cancelado pelo médico</option>
              <option>Paciente desistiu</option><option>Remarcação</option><option>Emergência</option><option>Outro</option>
            </select>
          </Campo>
          <div className="linha"><button onClick={() => setModo("")}>Voltar</button><button className="perigo" disabled={!motivo} onClick={() => atualizar({ status: "cancelado", motivo_cancelamento: motivo })}>Cancelar agendamento</button></div>
        </div>
      )}
      {modo === "remarcar" && (
        <div className="secao grade g2">
          <Campo rotulo="Profissional" className="inteiro">
            <select value={rem.profissional_id} onChange={(e) => setRem({ ...rem, profissional_id: e.target.value })}>
              {props.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Nova data"><input type="date" value={rem.data} onChange={(e) => setRem({ ...rem, data: e.target.value })} /></Campo>
          <Campo rotulo="Nova hora"><input type="time" step={300} value={rem.hora} onChange={(e) => setRem({ ...rem, hora: e.target.value })} /></Campo>
          <div className="linha inteiro"><button onClick={() => setModo("")}>Voltar</button><button className="primario" onClick={remarcar}>Salvar nova data</button></div>
        </div>
      )}
      <p style={{ marginTop: 18 }}><Link to={`/pacientes/${p.id}`}>Abrir ficha do paciente →</Link></p>
    </Modal>
  );
}
