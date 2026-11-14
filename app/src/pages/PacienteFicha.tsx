import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta } from "../components/ui";
import { HistoricoSaude } from "../components/Clinico";
import { NovoAgendamento } from "../components/AgendamentoModais";
import { listaProfissionais, listaConvenios, listaLocais, nomePor, type Agendamento } from "../lib/dados";
import {
  STATUS_AGENDA, STATUS_EXAME, TIPOS_AGENDA, fmtCPF, fmtData, fmtDataHora, fmtHora, fmtTelefone, idade, nomeExibicao,
} from "../lib/util";

type Pac = Record<string, string | number | boolean | null>;

export default function PacienteFicha() {
  const { id } = useParams();
  const { pode, eu } = useAuth();
  const nav = useNavigate();
  const clinico = pode("medico", "enfermagem");
  const [aba, setAba] = useState(clinico ? "prontuario" : "dados");
  const [agendar, setAgendar] = useState(false);
  const [erro, setErro] = useState("");

  const base = useCarregar(async () => {
    const [medicos, convenios, locais] = await Promise.all([listaProfissionais(["medico"]), listaConvenios(), listaLocais()]);
    return { medicos, convenios, locais };
  }, []);
  const pac = useCarregar(async () => ok(await supabase.from("pacientes").select("*").eq("id", id!).single()) as Pac, [id]);
  const ags = useCarregar(async () => ok(await supabase.from("agendamentos").select("*").eq("paciente_id", id!).order("inicio", { ascending: false }).limit(100)) as Agendamento[], [id]);

  // Registro de acesso ao prontuário (LGPD / auditoria)
  useEffect(() => {
    if (clinico && id) supabase.rpc("registrar_leitura", { p_paciente_id: id, p_detalhes: "Abriu a ficha do paciente" }).then(() => {});
  }, [clinico, id]);

  async function novoAtendimentoSemAgenda() {
    setErro("");
    const { data, error } = await supabase.from("atendimentos").insert({ paciente_id: id, tipo: "consulta" }).select("id").single();
    if (error) return setErro(msgErro(error));
    nav(`/atendimento/${(data as { id: string }).id}`);
  }

  if (pac.carregando) return <Carregando />;
  if (!pac.dados) return <Aviso>{pac.erro || "Paciente não encontrado."}</Aviso>;
  const p = pac.dados;
  const proximos = (ags.dados ?? []).filter((a) => new Date(a.inicio) >= new Date(new Date().setHours(0, 0, 0, 0)) && !["cancelado", "faltou"].includes(a.status));

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>{nomeExibicao(p as { nome: string; nome_social: string | null })}</h1>
          <p className="sub" style={{ margin: 0 }}>
            Prontuário nº <b>{p.numero_prontuario}</b>
            {p.data_nascimento && ` · ${fmtData(p.data_nascimento as string)} (${idade(p.data_nascimento as string)})`}
            {p.telefone && ` · ${fmtTelefone(p.telefone as string)}`}
            {" · "}{nomePor(base.dados?.convenios, p.convenio_id as string) || "Particular"}
          </p>
        </div>
        <div className="linha">
          <Link className="botao" to={`/pacientes/${id}/editar`}>✏️ Editar cadastro</Link>
          <button className="primario" onClick={() => setAgendar(true)}>📅 Agendar</button>
          {eu?.funcao === "medico" && <button onClick={novoAtendimentoSemAgenda}>🩺 Atender sem agendamento</button>}
        </div>
      </div>
      <Aviso>{erro}</Aviso>
      {proximos.length > 0 && (
        <Aviso tipo="info">
          Próximo agendamento: {fmtData(proximos[proximos.length - 1].inicio)} às {fmtHora(proximos[proximos.length - 1].inicio)} com {nomePor(base.dados?.medicos, proximos[proximos.length - 1].profissional_id)}
        </Aviso>
      )}

      <div className="abas">
        {clinico && <button className={aba === "prontuario" ? "ativa" : ""} onClick={() => setAba("prontuario")}>Prontuário</button>}
        {clinico && <button className={aba === "exames" ? "ativa" : ""} onClick={() => setAba("exames")}>Exames</button>}
        <button className={aba === "agenda" ? "ativa" : ""} onClick={() => setAba("agenda")}>Agendamentos</button>
        <button className={aba === "dados" ? "ativa" : ""} onClick={() => setAba("dados")}>Dados cadastrais</button>
      </div>

      {aba === "prontuario" && clinico && (
        <div className="pep">
          <div className="painel"><h2>Saúde</h2><HistoricoSaude pacienteId={id!} /></div>
          <LinhaDoTempo pacienteId={id!} medicos={base.dados?.medicos ?? []} />
        </div>
      )}
      {aba === "exames" && clinico && <ExamesPaciente pacienteId={id!} />}
      {aba === "agenda" && (
        <div className="painel rolagem">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Profissional</th><th>Tipo</th><th>Convênio</th><th>Situação</th></tr></thead>
            <tbody>
              {(ags.dados ?? []).map((a) => (
                <tr key={a.id}>
                  <td>{fmtDataHora(a.inicio)}</td>
                  <td>{nomePor(base.dados?.medicos, a.profissional_id)}</td>
                  <td>{TIPOS_AGENDA[a.tipo]}</td>
                  <td>{nomePor(base.dados?.convenios, a.convenio_id) || "Particular"}</td>
                  <td><Etiqueta cor={STATUS_AGENDA[a.status].cor}>{STATUS_AGENDA[a.status].rotulo}</Etiqueta> {a.motivo_cancelamento && <span className="muted pequeno">{a.motivo_cancelamento}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ags.dados?.length === 0 && <div className="vazio">Nenhum agendamento.</div>}
        </div>
      )}
      {aba === "dados" && <DadosCadastrais p={p} convenio={nomePor(base.dados?.convenios, p.convenio_id as string)} />}

      {agendar && base.dados && (
        <NovoAgendamento {...base.dados}
          inicial={{ paciente: { id: id!, numero_prontuario: p.numero_prontuario as number, nome: p.nome as string, nome_social: p.nome_social as string | null, data_nascimento: p.data_nascimento as string | null, cpf: p.cpf as string | null, telefone: p.telefone as string | null, convenio_id: p.convenio_id as string | null } }}
          aoFechar={() => setAgendar(false)} aoSalvar={() => { setAgendar(false); ags.recarregar(); }} />
      )}
    </div>
  );
}

function DadosCadastrais({ p, convenio }: { p: Pac; convenio: string }) {
  const L = ({ r, v }: { r: string; v: unknown }) => <div><div className="muted pequeno">{r}</div><div>{(v as string) || "—"}</div></div>;
  const end = [p.logradouro, p.numero, p.complemento, p.bairro, p.cidade && `${p.cidade}/${p.uf ?? ""}`, p.cep].filter(Boolean).join(", ");
  return (
    <div className="painel grade g4">
      <L r="CPF" v={fmtCPF(p.cpf as string)} />
      <L r="RG" v={p.rg} />
      <L r="Cartão SUS" v={p.cns} />
      <L r="Sexo" v={{ feminino: "Feminino", masculino: "Masculino", intersexo: "Intersexo", nao_informado: "Não informado" }[p.sexo as string]} />
      <L r="Nome da mãe" v={p.nome_mae} />
      <L r="Profissão" v={p.profissao} />
      <L r="Telefone" v={fmtTelefone(p.telefone as string)} />
      <L r="Outro telefone" v={fmtTelefone(p.telefone_secundario as string)} />
      <L r="E-mail" v={p.email} />
      <div className="span3"><L r="Endereço" v={end} /></div>
      <L r="Convênio" v={convenio || "Particular"} />
      <L r="Carteirinha" v={p.convenio_carteirinha} />
      <L r="Validade" v={fmtData(p.convenio_validade as string)} />
      <L r="Responsável" v={p.responsavel_nome && `${p.responsavel_nome} (${p.responsavel_parentesco ?? ""}) ${fmtTelefone(p.responsavel_telefone as string)}`} />
      <div className="inteiro"><L r="Observações" v={p.observacoes} /></div>
    </div>
  );
}

interface AtendLinha {
  id: string; inicio: string; tipo: string; status: string; profissional_id: string; queixa_principal: string | null; conduta: string | null;
  diagnosticos: { cid10: string; descricao: string; olho: string | null }[];
}

function LinhaDoTempo({ pacienteId, medicos }: { pacienteId: string; medicos: { id: string; nome: string }[] }) {
  const { dados, erro, carregando } = useCarregar(async () => ok(
    await supabase.from("atendimentos")
      .select("id, inicio, tipo, status, profissional_id, queixa_principal, conduta, diagnosticos(cid10, descricao, olho)")
      .eq("paciente_id", pacienteId).order("inicio", { ascending: false }),
  ) as AtendLinha[], [pacienteId]);
  return (
    <div className="painel">
      <h2>Histórico de atendimentos</h2>
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : dados?.length === 0 ? <div className="vazio">Nenhum atendimento registrado ainda.</div> : (
        <div className="linha-tempo">
          {dados!.map((a) => (
            <div key={a.id} className="evento">
              <div className="linha entre">
                <Link to={`/atendimento/${a.id}`}><b>{fmtData(a.inicio)}</b> · {TIPOS_AGENDA[a.tipo]} · {nomePor(medicos, a.profissional_id)}</Link>
                {a.status === "em_andamento" ? <Etiqueta cor="amarelo">Em andamento</Etiqueta> : <Etiqueta cor="verde">Finalizado</Etiqueta>}
              </div>
              {a.queixa_principal && <div className="pequeno"><span className="muted">Queixa:</span> {a.queixa_principal}</div>}
              {a.diagnosticos.length > 0 && <div className="pequeno"><span className="muted">Diagnóstico:</span> {a.diagnosticos.map((d) => `${d.cid10} ${d.descricao}${d.olho ? ` (${d.olho})` : ""}`).join("; ")}</div>}
              {a.conduta && <div className="pequeno"><span className="muted">Conduta:</span> {a.conduta}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamesPaciente({ pacienteId }: { pacienteId: string }) {
  const { dados, erro } = useCarregar(async () => ok(
    await supabase.from("exames_realizados").select("id, exame, olho, status, criado_em, laudado_em, conclusao").eq("paciente_id", pacienteId).order("criado_em", { ascending: false }),
  ) as { id: string; exame: string; olho: string | null; status: string; criado_em: string; laudado_em: string | null; conclusao: string | null }[], [pacienteId]);
  const nav = useNavigate();
  return (
    <div className="painel rolagem">
      <Aviso>{erro}</Aviso>
      <table className="tabela">
        <thead><tr><th>Data</th><th>Exame</th><th>Olho</th><th>Situação</th><th>Conclusão</th></tr></thead>
        <tbody>
          {(dados ?? []).map((e) => (
            <tr key={e.id} className="clicavel" onClick={() => nav(`/exames/${e.id}`)}>
              <td>{fmtData(e.criado_em)}</td><td>{e.exame}</td><td>{e.olho ?? "—"}</td>
              <td><Etiqueta cor={STATUS_EXAME[e.status].cor}>{STATUS_EXAME[e.status].rotulo}</Etiqueta></td>
              <td className="pequeno">{e.conclusao ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dados?.length === 0 && <div className="vazio">Nenhum exame.</div>}
    </div>
  );
}
