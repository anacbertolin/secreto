import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { Modal, Campo, Aviso, BuscaPaciente, Etiqueta, type PacienteResumo } from "./ui";
import { EscolhaConsultaParticular } from "./ConsultaParticular";
import type { Profissional } from "../lib/auth";
import type { Agendamento, Convenio, Local } from "../lib/dados";
import { nomePor, nomeAgenda, ehAgendaOrientacao, ehCentroCirurgico } from "../lib/dados";
import { useAuth } from "../lib/auth";
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
    cirurgiao_id: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Agenda da Orientação Cirúrgica: só registro (sem tipo, sala, 1ª consulta; Notas em destaque)
  const orientacao = ehAgendaOrientacao(props.medicos.find((m) => m.id === f.profissional_id));
  // Centro Cirúrgico: o paciente fica na coluna do centro e o médico que opera vai em "Cirurgião" (só na agenda)
  const centro = ehCentroCirurgico(props.medicos.find((m) => m.id === f.profissional_id));
  const { eu } = useAuth();

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
      // Orientação Cirúrgica: quem atende a orientação lança no próprio nome (a coluna da agenda é uma só)
      profissional_id: orientacao && ehAgendaOrientacao(eu) ? eu!.id : f.profissional_id,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      tipo: orientacao ? "orientacao" : f.tipo,
      convenio_id: f.convenio_id || null,
      plano_id: f.convenio_id && f.convenio_id === paciente.convenio_id ? paciente.plano_id ?? null : null,
      local_id: f.local_id || null,
      primeira_vez: f.primeira_vez,
      encaixe: f.encaixe,
      observacoes: f.observacoes || null,
      cirurgiao_id: centro ? f.cirurgiao_id || null : null,
    });
    setSalvando(false);
    if (error) return setErro(msgErro(error));
    props.aoSalvar();
  }

  return (
    <Modal
      titulo={orientacao ? "Orientação Cirúrgica — registrar paciente" : f.encaixe ? "Encaixe" : "Novo agendamento"}
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
              {props.medicos.map((m) => <option key={m.id} value={m.id}>{nomeAgenda(m)}</option>)}
            </select>
          </Campo>
          {!orientacao && (
            <Campo rotulo="Tipo">
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                {Object.entries(TIPOS_AGENDA).filter(([k]) => k !== "orientacao").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
          )}
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
          {!orientacao && (
            <>
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
            </>
          )}
          {centro && (
            <Campo rotulo="Cirurgião (só aparece na agenda)" className="inteiro">
              <SelectCirurgiao medicos={props.medicos} valor={f.cirurgiao_id} aoMudar={(v) => setF({ ...f, cirurgiao_id: v })} />
            </Campo>
          )}
          {orientacao ? (
            <div className="inteiro">
              <NotasOrientacao valor={f.observacoes} aoMudar={(v) => setF({ ...f, observacoes: v })} />
              <p className="muted pequeno" style={{ margin: "4px 0 0" }}>Só registro: não gera conta de faturamento nem entra na recepção.</p>
            </div>
          ) : (
            <Campo rotulo="Observações" className="inteiro">
              <input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} placeholder="Ex.: trazer exames anteriores, dilatar pupila…" />
            </Campo>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Médicos que podem ser escolhidos como cirurgião (Centro Cirúrgico) */
function SelectCirurgiao(props: { medicos: Profissional[]; valor: string; aoMudar: (v: string) => void }) {
  return (
    <select value={props.valor} onChange={(e) => props.aoMudar(e.target.value)}>
      <option value="">— escolha o médico que vai operar —</option>
      {props.medicos.filter((m) => m.funcao === "medico").map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
    </select>
  );
}

export type ModoAgendamento = "" | "cancelar" | "remarcar" | "confirmar" | "excluir" | "chegada";

export function DetalheAgendamento(props: {
  ag: Agendamento;
  aoFechar: () => void;
  aoAlterar: () => void;
  medicos: Profissional[];
  convenios: Convenio[];
  locais: Local[];
  /** Abre já numa ação (botões rápidos da Agenda) */
  modoInicial?: ModoAgendamento;
}) {
  const a = props.ag;
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState<ModoAgendamento>(props.modoInicial ?? "");
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

  async function excluir() {
    setErro("");
    const { error } = await supabase.rpc("agendamento_excluir", { p_id: a.id, p_motivo: motivo });
    if (error) return setErro(msgErro(error));
    props.aoAlterar();
  }

  const ativo = !["cancelado", "faltou", "atendido"].includes(a.status);
  const orientacao = a.tipo === "orientacao";
  const [notas, setNotas] = useState(a.observacoes ?? "");
  // Centro Cirúrgico: cirurgião editável na hora (sem fechar a janela)
  const centro = ehCentroCirurgico(props.medicos.find((m) => m.id === a.profissional_id));
  const [cirurgiao, setCirurgiao] = useState(a.cirurgiao_id ?? "");
  async function atualizarCirurgiao(v: string) {
    setErro("");
    const { error } = await supabase.from("agendamentos").update({ cirurgiao_id: v || null }).eq("id", a.id);
    if (error) setErro(msgErro(error));
  }
  // consulta particular: na chegada pergunta cartão ou dinheiro/Pix (migração 0087)
  const consultaParticular = !a.convenio_id && a.tipo === "consulta" && !orientacao;
  const [consultaEscolhida, setConsultaEscolhida] = useState("");
  // excluir de vez (lançado por engano / desistência): antes da chegada; o banco confere as travas (migração 0084)
  const podeExcluir = ["agendado", "confirmado", "cancelado", "faltou"].includes(a.status);
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
        <div><dt className="muted pequeno">{orientacao ? "Agenda" : "Profissional"}</dt><dd style={{ margin: 0 }}>{orientacao ? "Orientação Cirúrgica" : nomePor(props.medicos, a.profissional_id)}</dd></div>
        {centro && (
          <div>
            <dt className="muted pequeno">Cirurgião (só na agenda)</dt>
            <dd style={{ margin: 0 }}>
              <SelectCirurgiao medicos={props.medicos} valor={cirurgiao}
                aoMudar={(v) => { setCirurgiao(v); atualizarCirurgiao(v); }} />
            </dd>
          </div>
        )}
        <div><dt className="muted pequeno">Tipo</dt><dd style={{ margin: 0 }}>{TIPOS_AGENDA[a.tipo]}{a.primeira_vez && " · 1ª vez"}{a.encaixe && " · encaixe"}</dd></div>
        <div><dt className="muted pequeno">Convênio</dt><dd style={{ margin: 0 }}>{nomePor(props.convenios, a.convenio_id) || "Particular"}</dd></div>
        {a.local_id && <div><dt className="muted pequeno">Sala</dt><dd style={{ margin: 0 }}>{nomePor(props.locais, a.local_id)}</dd></div>}
        {a.confirmado_em && <div><dt className="muted pequeno">Confirmado</dt><dd style={{ margin: 0 }}>{fmtData(a.confirmado_em)} {fmtHora(a.confirmado_em)} {a.canal_confirmacao && `(${a.canal_confirmacao})`}</dd></div>}
        {a.chegada_em && <div><dt className="muted pequeno">Chegou às</dt><dd style={{ margin: 0 }}>{fmtHora(a.chegada_em)}</dd></div>}
        {!orientacao && a.observacoes && <div className="inteiro"><dt className="muted pequeno">Observações</dt><dd style={{ margin: 0 }}>{a.observacoes}</dd></div>}
        {a.motivo_cancelamento && <div className="inteiro"><dt className="muted pequeno">Motivo do cancelamento</dt><dd style={{ margin: 0 }}>{a.motivo_cancelamento}</dd></div>}
      </dl>

      {orientacao && (
        <div className="secao" style={{ marginBottom: 12 }}>
          <NotasOrientacao valor={notas} aoMudar={setNotas} />
          {notas !== (a.observacoes ?? "") && (
            <button className="primario mini" style={{ marginTop: 6 }} onClick={() => atualizar({ observacoes: notas.trim() || null })}>Salvar notas</button>
          )}
        </div>
      )}
      {orientacao && a.status === "chegou" && modo === "" && (
        <div className="linha" style={{ marginBottom: 8 }}>
          <button className="primario" onClick={() => atualizar({ status: "atendido" })}>✅ Atendido</button>
        </div>
      )}
      {ativo && modo === "" && (
        <div className="linha">
          {a.status === "agendado" && <button onClick={() => setModo("confirmar")}>✅ Confirmar</button>}
          {["agendado", "confirmado"].includes(a.status) && <button className="primario" onClick={() => (consultaParticular ? setModo("chegada") : atualizar({ status: "chegou" }))}>🛎️ Paciente chegou</button>}
          {a.status === "chegou" && <button onClick={() => atualizar({ status: "confirmado", chegada_em: null })}>↩️ Desfazer chegada</button>}
          <button onClick={() => setModo("remarcar")}>🔁 Remarcar</button>
          {["agendado", "confirmado"].includes(a.status) && <button onClick={() => atualizar({ status: "faltou" })}>Faltou</button>}
          <button className="perigo" onClick={() => { setMotivo(""); setModo("cancelar"); }}>Cancelar</button>
          {podeExcluir && <button className="perigo" onClick={() => { setMotivo(""); setModo("excluir"); }}>🗑️ Excluir</button>}
        </div>
      )}
      {!ativo && modo === "" && (
        <div className="linha">
          {a.status === "faltou" && <button onClick={() => atualizar({ status: "agendado" })}>↩️ Desfazer falta</button>}
          {podeExcluir && <button className="perigo" onClick={() => { setMotivo(""); setModo("excluir"); }}>🗑️ Excluir da agenda</button>}
        </div>
      )}
      {modo === "chegada" && (
        <div className="grade">
          <EscolhaConsultaParticular valor={consultaEscolhida} aoMudar={setConsultaEscolhida} />
          <div className="linha">
            <button onClick={() => setModo("")}>Voltar</button>
            <button className="primario" disabled={!consultaEscolhida} onClick={() => atualizar({ status: "chegou", consulta_procedimento_id: consultaEscolhida })}>🛎️ Confirmar chegada</button>
          </div>
        </div>
      )}
      {modo === "excluir" && (
        <div className="secao grade">
          <p style={{ margin: 0 }}>
            O agendamento <b>some da agenda</b> (diferente de "Cancelar", que deixa o paciente riscado). Use quando foi
            lançado por engano ou o paciente desistiu. Fica registrado quem excluiu e por quê.
          </p>
          <Campo rotulo="Motivo da exclusão *">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Escolha…</option>
              <option>Lançado por engano</option><option>Paciente errado</option><option>Horário/médico errado</option>
              <option>Paciente desistiu</option><option>Duplicado</option><option>Outro</option>
            </select>
          </Campo>
          <div className="linha"><button onClick={() => setModo("")}>Voltar</button><button className="perigo" disabled={!motivo} onClick={excluir}>Excluir de vez</button></div>
        </div>
      )}

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
              {props.medicos.filter((m) => ehAgendaOrientacao(m) === orientacao).map((m) => <option key={m.id} value={m.id}>{nomeAgenda(m)}</option>)}
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

/** Motivos mais comuns da Orientação Cirúrgica (botões rápidos que completam as Notas) */
export const MOTIVOS_ORIENTACAO = [
  "Pagar cirurgia", "Orçamento", "Trazer risco cirúrgico", "Pegar documentação", "Orientação para a cirurgia",
  "Retirar nota fiscal", "Encaminhamento", "Marcar cirurgia", "Acompanhante",
];

function NotasOrientacao({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <Campo rotulo="Notas — o que o paciente veio fazer">
      <div className="linha" style={{ gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
        {MOTIVOS_ORIENTACAO.map((m) => (
          <button key={m} type="button" className="mini" onClick={() => aoMudar(valor.trim() ? `${valor.trim()}; ${m.toLowerCase()}` : m)}>{m}</button>
        ))}
      </div>
      <textarea rows={3} value={valor} onChange={(e) => aoMudar(e.target.value)}
        placeholder="Ex.: veio pagar a cirurgia; trouxe o risco cirúrgico; orientações para a cirurgia do dia 26…" />
    </Campo>
  );
}
