import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Carregando, Aviso } from "../components/ui";
import { fmtDataLonga, inicioDoDia, somaDias } from "../lib/util";

export default function Inicio() {
  const { eu, pode } = useAuth();
  const hoje = inicioDoDia(new Date());
  const { dados, erro, carregando } = useCarregar(async () => {
    const ag = ok(
      await supabase
        .from("agendamentos")
        .select("status, profissional_id")
        .gte("inicio", hoje.toISOString())
        .lt("inicio", somaDias(hoje, 1).toISOString())
        .neq("tipo", "orientacao"),
    ) as { status: string; profissional_id: string }[];
    let laudos = 0;
    let exames = 0;
    if (pode("medico", "enfermagem")) {
      const r1 = await supabase.from("exames_realizados").select("id", { count: "exact", head: true }).eq("status", "aguardando_laudo");
      const r2 = await supabase.from("exames_realizados").select("id", { count: "exact", head: true }).in("status", ["aguardando", "em_execucao"]);
      laudos = r1.count ?? 0;
      exames = r2.count ?? 0;
    }
    return { ag, laudos, exames };
  }, []);

  const ag = dados?.ag ?? [];
  const meus = eu?.funcao === "medico" ? ag.filter((a) => a.profissional_id === eu.id) : ag;
  const c = (s: string[]) => meus.filter((a) => s.includes(a.status)).length;

  return (
    <div>
      <h1>Olá, {eu?.nome.split(" ")[0]}!</h1>
      <p className="sub">{fmtDataLonga(new Date())}</p>
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <>
          <h2>{eu?.funcao === "medico" ? "Minha agenda de hoje" : "Agenda de hoje"}</h2>
          <div className="cartoes">
            <div className="cartao"><div className="num">{meus.filter((a) => a.status !== "cancelado").length}</div><div className="rot">Agendados</div></div>
            <div className="cartao"><div className="num">{c(["agendado", "confirmado"])}</div><div className="rot">A chegar</div></div>
            <div className="cartao"><div className="num">{c(["chegou"])}</div><div className="rot">Na sala de espera</div></div>
            <div className="cartao"><div className="num">{c(["em_atendimento"])}</div><div className="rot">Em atendimento</div></div>
            <div className="cartao"><div className="num">{c(["atendido"])}</div><div className="rot">Atendidos</div></div>
            <div className="cartao"><div className="num">{c(["faltou"])}</div><div className="rot">Faltas</div></div>
          </div>
          {pode("medico", "enfermagem") && (
            <div className="cartoes">
              <Link to="/exames" className="cartao"><div className="num">{dados?.exames}</div><div className="rot">Exames a realizar</div></Link>
              <Link to="/exames?aba=laudos" className="cartao"><div className="num">{dados?.laudos}</div><div className="rot">Laudos pendentes</div></Link>
            </div>
          )}
          <h2>Atalhos</h2>
          <div className="linha">
            <Link className="botao primario" to="/agenda">📅 Abrir agenda</Link>
            <Link className="botao" to="/recepcao">🛎️ Recepção</Link>
            <Link className="botao" to="/pacientes/novo">➕ Novo paciente</Link>
            {pode("medico", "enfermagem") && <Link className="botao" to="/consultorio">🩺 Meus pacientes de hoje</Link>}
          </div>
        </>
      )}
    </div>
  );
}
