import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Modal, Campo, Etiqueta } from "../components/ui";
import { NovoAgendamento, DetalheAgendamento } from "../components/AgendamentoModais";
import { listaProfissionais, listaConvenios, listaLocais, listaPlanos, nomePor, SELECT_AGENDA, type Agendamento, type Convenio } from "../lib/dados";
import {
  STATUS_AGENDA, TIPOS_AGENDA, fmtDataLonga, fmtHora, fmtEspera, inicioDoDia, minutosDesde, somaDias, nomeExibicao, idade, soNumeros, fmtTelefone,
} from "../lib/util";

export default function Recepcao() {
  const hoje = inicioDoDia(new Date());
  const [busca, setBusca] = useState("");
  const [medico, setMedico] = useState("todos");
  const [aberto, setAberto] = useState<Agendamento | null>(null);
  const [chegada, setChegada] = useState<Agendamento | null>(null);
  const [encaixe, setEncaixe] = useState(false);
  const [, setTique] = useState(0);

  const base = useCarregar(async () => {
    const [medicos, convenios, locais] = await Promise.all([listaProfissionais(["medico"]), listaConvenios(), listaLocais()]);
    return { medicos, convenios, locais };
  }, []);
  const dia = useCarregar(async () => {
    return ok(
      await supabase.from("agendamentos").select(SELECT_AGENDA)
        .gte("inicio", hoje.toISOString()).lt("inicio", somaDias(hoje, 1).toISOString()).order("inicio"),
    ) as Agendamento[];
  }, []);

  // Atualiza sozinho a cada 30 segundos
  useEffect(() => {
    const t = setInterval(() => { dia.recarregar(); setTique((x) => x + 1); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todos = (dia.dados ?? []).filter((a) => {
    if (medico !== "todos" && a.profissional_id !== medico) return false;
    if (busca && !nomeExibicao(a.pacientes!).toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });
  const aChegar = todos.filter((a) => ["agendado", "confirmado"].includes(a.status));
  const espera = todos.filter((a) => a.status === "chegou").sort((x, y) => (x.chegada_em ?? "").localeCompare(y.chegada_em ?? ""));
  const emAtend = todos.filter((a) => a.status === "em_atendimento");
  const fim = todos.filter((a) => ["atendido", "faltou"].includes(a.status));

  async function marcarFalta(a: Agendamento) {
    if (!confirm(`Marcar falta para ${a.pacientes!.nome}?`)) return;
    const { error } = await supabase.from("agendamentos").update({ status: "faltou" }).eq("id", a.id);
    if (error) alert(msgErro(error));
    dia.recarregar();
  }

  const medicos = base.dados?.medicos ?? [];
  const Cartao = ({ a, children }: { a: Agendamento; children?: React.ReactNode }) => {
    const p = a.pacientes!;
    const atraso = ["agendado", "confirmado"].includes(a.status) && minutosDesde(a.inicio) > 15;
    return (
      <div className="fila-cartao">
        <div className="linha entre">
          <button className="sutil nome" style={{ padding: 0, color: "var(--texto)" }} onClick={() => setAberto(a)}>
            {fmtHora(a.inicio)} · {nomeExibicao(p)}
          </button>
          {a.status === "confirmado" && <Etiqueta cor="azul">Confirmado</Etiqueta>}
          {atraso && <Etiqueta cor="vermelho">Atrasado</Etiqueta>}
        </div>
        <div className="muted pequeno">
          {nomePor(medicos, a.profissional_id)} · {TIPOS_AGENDA[a.tipo]}
          {a.primeira_vez && " · 1ª vez"}{p.data_nascimento && ` · ${idade(p.data_nascimento)}`}
          {" · "}{nomePor(base.dados?.convenios, a.convenio_id) || "Particular"}
        </div>
        {children && <div className="linha" style={{ marginTop: 8 }}>{children}</div>}
      </div>
    );
  };

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Recepção</h1>
          <p className="sub" style={{ margin: 0 }}>{fmtDataLonga(hoje)} · atualiza sozinha a cada 30 segundos</p>
        </div>
        <div className="linha">
          <input placeholder="Filtrar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 200 }} />
          <select value={medico} onChange={(e) => setMedico(e.target.value)} style={{ width: 200 }}>
            <option value="todos">Todos os médicos</option>
            {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <button className="primario" onClick={() => setEncaixe(true)}>➕ Encaixe / paciente sem hora</button>
        </div>
      </div>
      <Aviso>{base.erro || dia.erro}</Aviso>
      {dia.carregando && !dia.dados ? <Carregando /> : (
        <div className="colunas-fila">
          <section>
            <h2>A chegar ({aChegar.length})</h2>
            {aChegar.length === 0 && <div className="vazio pequeno">Ninguém.</div>}
            {aChegar.map((a) => (
              <Cartao key={a.id} a={a}>
                <button className="primario mini" onClick={() => setChegada(a)}>🛎️ Chegou</button>
                {minutosDesde(a.inicio) > 0 && <button className="mini" onClick={() => marcarFalta(a)}>Faltou</button>}
              </Cartao>
            ))}
          </section>
          <section>
            <h2>Na sala de espera ({espera.length})</h2>
            {espera.length === 0 && <div className="vazio pequeno">Sala de espera vazia.</div>}
            {espera.map((a) => {
              const m = minutosDesde(a.chegada_em);
              return (
                <Cartao key={a.id} a={a}>
                  <span className={m >= 40 ? "espera-alta" : ""}>⏱️ esperando há {fmtEspera(m)}</span>
                </Cartao>
              );
            })}
          </section>
          <section>
            <h2>Em atendimento ({emAtend.length})</h2>
            {emAtend.length === 0 && <div className="vazio pequeno">—</div>}
            {emAtend.map((a) => <Cartao key={a.id} a={a}><span className="muted pequeno">desde {fmtHora(a.chamado_em)}</span></Cartao>)}
          </section>
          <section>
            <h2>Finalizados ({fim.length})</h2>
            {fim.length === 0 && <div className="vazio pequeno">—</div>}
            {fim.map((a) => <Cartao key={a.id} a={a}><Etiqueta cor={STATUS_AGENDA[a.status].cor}>{STATUS_AGENDA[a.status].rotulo}</Etiqueta></Cartao>)}
          </section>
        </div>
      )}
      {chegada && base.dados && (
        <ConfirmarChegada ag={chegada} convenios={base.dados.convenios} aoFechar={() => setChegada(null)} aoSalvar={() => { setChegada(null); dia.recarregar(); }} />
      )}
      {aberto && base.dados && (
        <DetalheAgendamento ag={aberto} {...base.dados} aoFechar={() => setAberto(null)} aoAlterar={() => { setAberto(null); dia.recarregar(); }} />
      )}
      {encaixe && base.dados && (
        <NovoAgendamento {...base.dados} inicial={{ inicio: new Date(), encaixe: true, profissional_id: medico !== "todos" ? medico : undefined }}
          aoFechar={() => setEncaixe(false)} aoSalvar={() => { setEncaixe(false); dia.recarregar(); }} />
      )}
    </div>
  );
}

/** Na chegada, a recepção confere telefone e convênio antes de mandar para a sala de espera */
function ConfirmarChegada(props: { ag: Agendamento; convenios: Convenio[]; aoFechar: () => void; aoSalvar: () => void }) {
  const a = props.ag;
  const planos = useCarregar(listaPlanos, []);
  const { dados: pac, erro: erroPac } = useCarregar(async () => ok(await supabase.from("pacientes").select("*").eq("id", a.paciente_id).single()) as Record<string, string | null>, [a.paciente_id]);
  const [f, setF] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (pac) setF({
      telefone: pac.telefone ?? "", convenio_id: a.convenio_id ?? pac.convenio_id ?? "",
      plano_id: (a.convenio_id ?? pac.convenio_id) === pac.convenio_id ? pac.plano_id ?? "" : "",
      convenio_carteirinha: pac.convenio_carteirinha ?? "", convenio_validade: pac.convenio_validade ?? "",
    });
  }, [pac, a.convenio_id]);

  const faltando = pac ? (["cpf", "data_nascimento", "nome_mae", "cep"] as const).filter((k) => !pac[k]) : [];

  async function salvar() {
    setErro("");
    const r1 = await supabase.from("pacientes").update({
      telefone: soNumeros(f.telefone) || null,
      convenio_id: f.convenio_id || null,
      plano_id: f.plano_id || null,
      convenio_carteirinha: f.convenio_carteirinha || null,
      convenio_validade: f.convenio_validade || null,
    }).eq("id", a.paciente_id);
    if (r1.error) return setErro(msgErro(r1.error));
    const r2 = await supabase.from("agendamentos").update({ status: "chegou", convenio_id: f.convenio_id || null, plano_id: f.plano_id || null }).eq("id", a.id);
    if (r2.error) return setErro(msgErro(r2.error));
    // a conta é aberta sozinha na chegada; aqui completamos a senha de autorização
    if (f.convenio_id && f.senha) {
      await supabase.from("contas").update({ senha_autorizacao: f.senha || null, data_autorizacao: f.senha ? new Date().toISOString().slice(0, 10) : null })
        .eq("agendamento_id", a.id).eq("status", "aberta");
    }
    props.aoSalvar();
  }

  const vencida = f.convenio_validade && f.convenio_validade < new Date().toISOString().slice(0, 10);
  return (
    <Modal titulo="Confirmar chegada" aoFechar={props.aoFechar}
      rodape={<><button onClick={props.aoFechar}>Cancelar</button><button className="primario" onClick={salvar} disabled={!pac}>Confirmar chegada</button></>}>
      <Aviso>{erro || erroPac}</Aviso>
      <h2 style={{ marginBottom: 2 }}>{nomeExibicao(a.pacientes!)}</h2>
      <p className="muted" style={{ marginTop: 0 }}>Pront. {a.pacientes!.numero_prontuario} · {fmtHora(a.inicio)}</p>
      {faltando.length > 0 && (
        <Aviso tipo="alerta">
          Cadastro incompleto (faltam: {faltando.map((k) => ({ cpf: "CPF", data_nascimento: "data de nascimento", nome_mae: "nome da mãe", cep: "endereço" }[k])).join(", ")}).{" "}
          <Link to={`/pacientes/${a.paciente_id}/editar`}>Completar cadastro</Link>
        </Aviso>
      )}
      <div className="grade g2">
        <Campo rotulo="Telefone"><input value={fmtTelefone(f.telefone)} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Campo>
        <Campo rotulo="Convênio deste atendimento">
          <select value={f.convenio_id ?? ""} onChange={(e) => setF({ ...f, convenio_id: e.target.value, plano_id: "" })}>
            <option value="">Particular</option>
            {props.convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        {f.convenio_id && (
          <>
            {(planos.dados ?? []).some((x) => x.convenio_id === f.convenio_id) && (
              <Campo rotulo="Plano">
                <select value={f.plano_id ?? ""} onChange={(e) => setF({ ...f, plano_id: e.target.value })}>
                  <option value="">—</option>
                  {(planos.dados ?? []).filter((x) => x.convenio_id === f.convenio_id).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </Campo>
            )}
            {props.convenios.find((c) => c.id === f.convenio_id)?.exige_senha && (
              <Campo rotulo="Senha de autorização do convênio *"><input value={f.senha ?? ""} onChange={(e) => setF({ ...f, senha: e.target.value })} /></Campo>
            )}
            <Campo rotulo="Nº da carteirinha"><input value={f.convenio_carteirinha ?? ""} onChange={(e) => setF({ ...f, convenio_carteirinha: e.target.value })} /></Campo>
            <Campo rotulo="Validade da carteirinha"><input type="date" value={f.convenio_validade ?? ""} onChange={(e) => setF({ ...f, convenio_validade: e.target.value })} /></Campo>
          </>
        )}
      </div>
      {vencida && <Aviso tipo="alerta">⚠️ A carteirinha está vencida. Confira com o paciente.</Aviso>}
    </Modal>
  );
}
