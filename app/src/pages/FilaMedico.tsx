import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta } from "../components/ui";
import { listaProfissionais, nomePor, SELECT_AGENDA, type Agendamento } from "../lib/dados";
import { STATUS_AGENDA, TIPOS_AGENDA, fmtDataLonga, fmtEspera, fmtHora, idade, inicioDoDia, minutosDesde, nomeExibicao, somaDias } from "../lib/util";

export default function FilaMedico() {
  const { eu } = useAuth();
  const nav = useNavigate();
  const medico = eu?.funcao === "medico";
  const [filtro, setFiltro] = useState(medico ? eu!.id : "todos");
  const [erro, setErro] = useState("");
  const hoje = inicioDoDia(new Date());

  const medicos = useCarregar(() => listaProfissionais(["medico"]), []);
  const fila = useCarregar(async () => {
    let q = supabase.from("agendamentos").select(SELECT_AGENDA)
      .gte("inicio", hoje.toISOString()).lt("inicio", somaDias(hoje, 1).toISOString())
      .not("status", "in", "(cancelado)").order("inicio");
    if (filtro !== "todos") q = q.eq("profissional_id", filtro);
    return ok(await q) as Agendamento[];
  }, [filtro]);

  useEffect(() => {
    const t = setInterval(fila.recarregar, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrir(a: Agendamento) {
    setErro("");
    const { data, error } = await supabase.rpc("abrir_atendimento", { p_agendamento_id: a.id });
    if (error) return setErro(msgErro(error));
    nav(`/atendimento/${data}`);
  }

  const lista = fila.dados ?? [];
  const espera = lista.filter((a) => a.status === "chegou").sort((x, y) => (x.chegada_em ?? "").localeCompare(y.chegada_em ?? ""));
  const atendendo = lista.filter((a) => a.status === "em_atendimento");
  const resto = lista.filter((a) => !["chegou", "em_atendimento"].includes(a.status));

  const Linha = ({ a, destaque }: { a: Agendamento; destaque?: boolean }) => {
    const st = STATUS_AGENDA[a.status];
    const p = a.pacientes!;
    const podeAbrir = !["faltou", "cancelado"].includes(a.status);
    return (
      <tr>
        <td><b>{fmtHora(a.inicio)}</b></td>
        <td>
          <b>{nomeExibicao(p)}</b>
          <div className="muted pequeno">Pront. {p.numero_prontuario}{p.data_nascimento && ` · ${idade(p.data_nascimento)}`} · {TIPOS_AGENDA[a.tipo]}{a.primeira_vez && " · 1ª vez"}</div>
        </td>
        {filtro === "todos" && <td>{nomePor(medicos.dados, a.profissional_id)}</td>}
        <td>
          <Etiqueta cor={st.cor}>{st.rotulo}</Etiqueta>
          {a.status === "chegou" && <div className={"pequeno " + (minutosDesde(a.chegada_em) >= 40 ? "espera-alta" : "muted")}>há {fmtEspera(minutosDesde(a.chegada_em))}</div>}
        </td>
        <td style={{ textAlign: "right" }}>
          {podeAbrir && (
            <button className={destaque ? "primario" : ""} onClick={() => abrir(a)}>
              {a.status === "atendido" ? "Ver atendimento" : medico && a.profissional_id === eu!.id ? (a.status === "em_atendimento" ? "Continuar" : "Atender") : "Pré-consulta"}
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Consultório</h1>
          <p className="sub" style={{ margin: 0 }}>{fmtDataLonga(hoje)} · {espera.length} paciente(s) aguardando</p>
        </div>
        <select style={{ width: 240 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos os médicos</option>
          {(medicos.dados ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </div>
      <Aviso>{erro || fila.erro}</Aviso>
      {fila.carregando && !fila.dados ? <Carregando /> : (
        <>
          <div className="painel rolagem">
            <h2>Em atendimento e aguardando</h2>
            <table className="tabela"><tbody>
              {[...atendendo, ...espera].map((a) => <Linha key={a.id} a={a} destaque />)}
            </tbody></table>
            {atendendo.length + espera.length === 0 && <div className="vazio">Ninguém aguardando no momento.</div>}
          </div>
          <div className="painel rolagem">
            <h2>Demais pacientes do dia</h2>
            <table className="tabela"><tbody>{resto.map((a) => <Linha key={a.id} a={a} />)}</tbody></table>
            {resto.length === 0 && <div className="vazio">—</div>}
          </div>
        </>
      )}
    </div>
  );
}
