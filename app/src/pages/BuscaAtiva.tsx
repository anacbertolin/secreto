// Busca ativa: pacientes em acompanhamento que passaram do prazo e não têm consulta marcada (migração 0021)
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Campo, Modal, Etiqueta, type PacienteResumo } from "../components/ui";
import { NovoAgendamento } from "../components/AgendamentoModais";
import { BotaoLigar } from "../components/Telefone";
import { CONDICOES, EditarSeguimento, rotuloCondicoes } from "../components/Seguimento";
import { listaConvenios, listaLocais, listaProfissionais } from "../lib/dados";
import { fmtData, fmtDataHora, fmtTelefone, nomeExibicao } from "../lib/util";

interface Atrasado {
  paciente_id: string; numero_prontuario: number; nome: string; nome_social: string | null; telefone: string | null;
  whatsapp_autorizado: boolean | null; condicoes: string; ultima_consulta: string | null; previsto_em: string | null;
  dias_atraso: number | null; tentativas: number; ultimo_contato_em: string | null; ultimo_resultado: string | null;
}
interface Sugestao { paciente_id: string; numero_prontuario: number; nome: string; condicao: string; cid10: string; descricao: string; ultima_consulta: string | null }

export const RESULTADOS: Record<string, string> = {
  agendou: "Agendou", vai_ligar: "Vai ligar de volta", nao_atendeu: "Não atendeu", numero_errado: "Número errado",
  recusou: "Não quer voltar", faz_em_outro_lugar: "Acompanha em outro lugar", mudou_cidade: "Mudou de cidade",
  faleceu: "Faleceu", outro: "Outro",
};
// Estes resultados tiram o paciente da lista (não adianta ligar de novo)
const ENCERRAM = ["recusou", "faz_em_outro_lugar", "mudou_cidade", "faleceu"];

export default function BuscaAtiva() {
  const { pode } = useAuth();
  const clinico = pode("medico", "enfermagem");
  const [aba, setAba] = useState<"atrasados" | "sugestoes">("atrasados");
  const [tolerancia, setTolerancia] = useState(15);
  const [contato, setContato] = useState<Atrasado | null>(null);
  const [agendar, setAgendar] = useState<PacienteResumo | null>(null);
  const [acompanhar, setAcompanhar] = useState<Sugestao | null>(null);

  const base = useCarregar(async () => {
    const [medicos, convenios, locais] = await Promise.all([listaProfissionais(["medico"]), listaConvenios(), listaLocais()]);
    return { medicos, convenios, locais };
  }, []);
  const lista = useCarregar(async () => ok(await supabase.rpc("busca_ativa", { p_tolerancia_dias: tolerancia })) as Atrasado[], [tolerancia]);
  const sugestoes = useCarregar(async () => (clinico ? (ok(await supabase.rpc("busca_ativa_sugestoes")) as Sugestao[]) : []), [clinico]);

  async function abrirAgendar(a: Atrasado) {
    const { data, error } = await supabase.from("pacientes")
      .select("id, numero_prontuario, nome, nome_social, data_nascimento, cpf, telefone, convenio_id, plano_id").eq("id", a.paciente_id).single();
    if (error) return alert(msgErro(error));
    setAgendar(data as PacienteResumo);
  }

  const atrasados = lista.dados ?? [];
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Busca ativa</h1>
          <p className="sub" style={{ margin: 0 }}>Pacientes em acompanhamento que passaram do prazo de retorno e não têm consulta marcada.</p>
        </div>
        <label className="linha pequeno muted">
          Mostrar quem passou do prazo há mais de
          <select style={{ width: 110 }} value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))}>
            <option value={0}>0 dias</option><option value={15}>15 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
          </select>
        </label>
      </div>
      <div className="cartoes">
        <div className="cartao"><div className="num">{atrasados.length}</div><div className="rot">Atrasados sem consulta</div></div>
        <div className="cartao"><div className="num">{atrasados.filter((a) => a.tentativas === 0).length}</div><div className="rot">Ainda sem nenhum contato</div></div>
        <div className="cartao"><div className="num">{atrasados.filter((a) => (a.dias_atraso ?? 0) > 180).length}</div><div className="rot">Mais de 6 meses de atraso</div></div>
      </div>
      {clinico && (
        <div className="abas">
          <button className={aba === "atrasados" ? "ativa" : ""} onClick={() => setAba("atrasados")}>Atrasados ({atrasados.length})</button>
          <button className={aba === "sugestoes" ? "ativa" : ""} onClick={() => setAba("sugestoes")}>Sugestões de acompanhamento ({sugestoes.dados?.length ?? 0})</button>
        </div>
      )}
      <Aviso>{lista.erro || base.erro || sugestoes.erro}</Aviso>

      {aba === "atrasados" && (lista.carregando && !lista.dados ? <Carregando /> : (
        <div className="painel rolagem">
          {atrasados.length === 0 ? <div className="vazio">Nenhum paciente atrasado. 🎉</div> : (
            <table className="tabela">
              <thead><tr><th>Paciente</th>{clinico && <th>Acompanha</th>}<th>Última consulta</th><th>Deveria voltar</th><th>Contatos</th><th></th></tr></thead>
              <tbody>
                {atrasados.map((a) => (
                  <tr key={a.paciente_id}>
                    <td>
                      <Link to={`/pacientes/${a.paciente_id}`}><b>{nomeExibicao(a)}</b></Link>
                      <div className="muted pequeno">Pront. {a.numero_prontuario}{a.telefone && <> · <a href={`tel:${a.telefone}`}>{fmtTelefone(a.telefone)}</a> <BotaoLigar numero={a.telefone} pacienteId={a.paciente_id} rotulo="📞" /></>}</div>
                    </td>
                    {clinico && <td>{rotuloCondicoes(a.condicoes)}</td>}
                    <td>{fmtData(a.ultima_consulta) || "—"}</td>
                    <td>
                      {fmtData(a.previsto_em)}
                      {a.dias_atraso != null && <div><Etiqueta cor={a.dias_atraso > 180 ? "vermelho" : "amarelo"}>{a.dias_atraso} dias de atraso</Etiqueta></div>}
                    </td>
                    <td>
                      {a.tentativas === 0 ? <span className="muted">nenhum</span> : (
                        <>{a.tentativas}× · <b>{RESULTADOS[a.ultimo_resultado ?? ""] ?? a.ultimo_resultado}</b><div className="muted pequeno">{fmtDataHora(a.ultimo_contato_em)}</div></>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="mini" onClick={() => setContato(a)}>📞 Registrar contato</button>{" "}
                      {a.whatsapp_autorizado !== false && <Link className="botao mini" to={`/whatsapp?paciente=${a.paciente_id}`}>💬</Link>}{" "}
                      <button className="mini primario" onClick={() => abrirAgendar(a)}>📅 Agendar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {aba === "sugestoes" && clinico && (
        <div className="painel rolagem">
          <p className="muted pequeno" style={{ marginTop: 0 }}>Pacientes com diagnóstico de doença crônica que ainda não estão em acompanhamento. Só o médico marca o acompanhamento.</p>
          {(sugestoes.dados ?? []).length === 0 ? <div className="vazio">Nenhuma sugestão.</div> : (
            <table className="tabela">
              <thead><tr><th>Paciente</th><th>Diagnóstico</th><th>Última consulta</th><th></th></tr></thead>
              <tbody>
                {(sugestoes.dados ?? []).map((s) => (
                  <tr key={s.paciente_id + s.condicao}>
                    <td><Link to={`/pacientes/${s.paciente_id}`}><b>{s.nome}</b></Link><div className="muted pequeno">Pront. {s.numero_prontuario}</div></td>
                    <td>{s.cid10} · {s.descricao}<div className="muted pequeno">{CONDICOES[s.condicao]?.rotulo}</div></td>
                    <td>{fmtData(s.ultima_consulta)}</td>
                    <td style={{ textAlign: "right" }}>{pode("medico") && <button className="mini primario" onClick={() => setAcompanhar(s)}>➕ Acompanhar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {contato && <RegistrarContato a={contato} aoFechar={() => setContato(null)} aoSalvar={() => { setContato(null); lista.recarregar(); }} />}
      {agendar && base.dados && (
        <NovoAgendamento {...base.dados} inicial={{ paciente: agendar, tipo: "retorno" }}
          aoFechar={() => setAgendar(null)}
          aoSalvar={async () => {
            await supabase.from("busca_ativa_contatos").insert({ paciente_id: agendar.id, canal: "telefone", resultado: "agendou" });
            setAgendar(null); lista.recarregar();
          }} />
      )}
      {acompanhar && (
        <EditarSeguimento pacienteId={acompanhar.paciente_id} s={{ condicao: acompanhar.condicao, intervalo_dias: CONDICOES[acompanhar.condicao]?.dias ?? 180 }}
          aoFechar={() => setAcompanhar(null)} aoSalvar={() => { setAcompanhar(null); sugestoes.recarregar(); lista.recarregar(); }} />
      )}
    </div>
  );
}

function RegistrarContato({ a, aoFechar, aoSalvar }: { a: Atrasado; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState({ canal: "telefone", resultado: "nao_atendeu", observacao: "" });
  const [erro, setErro] = useState("");
  async function salvar() {
    const { error } = await supabase.from("busca_ativa_contatos").insert({ paciente_id: a.paciente_id, ...f, observacao: f.observacao || null });
    if (error) return setErro(msgErro(error));
    aoSalvar();
  }
  return (
    <Modal titulo={`Contato com ${a.nome_social || a.nome}`} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Registrar</button></>}>
      <Aviso>{erro}</Aviso>
      {a.telefone && <p style={{ marginTop: 0 }}>📞 <a href={`tel:${a.telefone}`}><b>{fmtTelefone(a.telefone)}</b></a> <BotaoLigar numero={a.telefone} pacienteId={a.paciente_id} rotulo="Ligar pelo sistema" /></p>}
      <div className="grade g2">
        <Campo rotulo="Como foi o contato">
          <select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>
            <option value="telefone">Ligação</option><option value="whatsapp">WhatsApp</option><option value="presencial">Pessoalmente</option><option value="outro">Outro</option>
          </select>
        </Campo>
        <Campo rotulo="Resultado">
          <select value={f.resultado} onChange={(e) => setF({ ...f, resultado: e.target.value })}>
            {Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observação" className="inteiro"><textarea rows={2} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></Campo>
      </div>
      {ENCERRAM.includes(f.resultado) && <Aviso tipo="alerta">Com este resultado, o paciente sai da lista da busca ativa.</Aviso>}
      {f.resultado === "agendou" && <Aviso tipo="info">Dica: use o botão <b>📅 Agendar</b> da lista. Ele marca a consulta e registra o contato de uma vez.</Aviso>}
    </Modal>
  );
}
