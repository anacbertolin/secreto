// Histórico de ligações do telefone do sistema (migração 0050)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Etiqueta } from "../components/ui";
import { BotaoLigar } from "../components/Telefone";
import { fmtNumeroTel, useTelefone } from "../lib/telefone";
import { fmtDataHora, isoDia, nomeExibicao, somaDias } from "../lib/util";

interface Ligacao {
  id: string;
  direcao: "entrada" | "saida";
  numero: string;
  paciente_id: string | null;
  situacao: string;
  ramal: string | null;
  iniciada_em: string;
  atendida_em: string | null;
  encerrada_em: string | null;
  transferida_para: string | null;
  retornada_em: string | null;
  observacao: string | null;
  pacientes: { id: string; nome: string; nome_social: string | null; numero_prontuario: number } | null;
  quem: { nome: string } | null;
  retornou: { nome: string } | null;
}

const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  tocando: { rotulo: "Tocando", cor: "azul" },
  em_andamento: { rotulo: "Em ligação", cor: "azul" },
  atendida: { rotulo: "Atendida", cor: "verde" },
  perdida: { rotulo: "Perdida", cor: "vermelho" },
  nao_atendida: { rotulo: "Não atendeu", cor: "amarelo" },
  falhou: { rotulo: "Falhou", cor: "cinza" },
};

function duracao(l: Ligacao): string {
  if (!l.atendida_em || !l.encerrada_em) return "";
  const s = Math.max(0, Math.round((new Date(l.encerrada_em).getTime() - new Date(l.atendida_em).getTime()) / 1000));
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
}

export default function Ligacoes() {
  const tel = useTelefone();
  const [filtro, setFiltro] = useState<"perdidas" | "hoje" | "7dias" | "30dias">("hoje");
  const [erro, setErro] = useState("");

  const lista = useCarregar(async () => {
    const desde = filtro === "hoje" ? isoDia(new Date()) : isoDia(somaDias(new Date(), filtro === "7dias" ? -7 : -30));
    let q = supabase.from("ligacoes")
      .select("*, pacientes(id, nome, nome_social, numero_prontuario), quem:profissionais!ligacoes_profissional_id_fkey(nome), retornou:profissionais!ligacoes_retornada_por_fkey(nome)")
      .order("iniciada_em", { ascending: false }).limit(300);
    if (filtro === "perdidas") q = q.eq("situacao", "perdida").is("retornada_em", null).gte("iniciada_em", isoDia(somaDias(new Date(), -30)));
    else q = q.gte("iniciada_em", desde + "T00:00:00");
    return ok(await q) as unknown as Ligacao[];
  }, [filtro]);

  // Ao vivo
  useEffect(() => {
    let espera: number | undefined;
    const canal = supabase.channel("ligacoes-lista")
      .on("postgres_changes", { event: "*", schema: "public", table: "ligacoes" }, () => {
        window.clearTimeout(espera);
        espera = window.setTimeout(() => lista.recarregar(), 400);
      })
      .subscribe();
    return () => { window.clearTimeout(espera); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function resolvida(id: string) {
    setErro("");
    const { error } = await supabase.rpc("telefonia_marcar_retornada", { p_id: id });
    if (error) setErro(msgErro(error)); else lista.recarregar();
  }

  const dados = lista.dados ?? [];
  const temRamal = tel && tel.estado !== "sem_ramal" && tel.estado !== "carregando";
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Ligações</h1>
          <p className="sub" style={{ margin: 0 }}>Ligações recebidas e feitas pelo telefone do sistema</p>
        </div>
      </div>
      <Aviso>{erro || lista.erro}</Aviso>
      <div className="abas">
        {([["hoje", "Hoje"], ["perdidas", "Perdidas sem retorno"], ["7dias", "Últimos 7 dias"], ["30dias", "Últimos 30 dias"]] as const).map(([k, r]) => (
          <button key={k} className={"aba" + (filtro === k ? " ativa" : "")} onClick={() => setFiltro(k)}>{r}</button>
        ))}
      </div>
      {!lista.dados ? <Carregando /> : dados.length === 0 ? (
        <div className="painel vazio">{filtro === "perdidas" ? "Nenhuma ligação perdida esperando retorno. 👏" : "Nenhuma ligação neste período."}</div>
      ) : (
        <div className="painel" style={{ padding: 0, overflowX: "auto" }}>
          <table className="tabela">
            <thead>
              <tr><th>Quando</th><th></th><th>Quem</th><th>Situação</th><th>Atendente</th><th>Anotação</th><th></th></tr>
            </thead>
            <tbody>
              {dados.map((l) => {
                const s = SITUACAO[l.situacao] ?? { rotulo: l.situacao, cor: "cinza" };
                return (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDataHora(l.iniciada_em)}</td>
                    <td title={l.direcao === "entrada" ? "Recebida" : "Feita"}>{l.direcao === "entrada" ? "↙️" : "↗️"}</td>
                    <td>
                      {l.pacientes
                        ? <Link to={`/pacientes/${l.pacientes.id}`}><b>{nomeExibicao(l.pacientes)}</b></Link>
                        : <b>{fmtNumeroTel(l.numero)}</b>}
                      {l.pacientes && <div className="muted pequeno">{fmtNumeroTel(l.numero)} · Pront. {l.pacientes.numero_prontuario}</div>}
                    </td>
                    <td>
                      <Etiqueta cor={s.cor}>{s.rotulo}</Etiqueta>
                      {duracao(l) && <div className="muted pequeno">{duracao(l)}</div>}
                      {l.transferida_para && <div className="muted pequeno">↪ transferida para {l.transferida_para}</div>}
                      {l.retornada_em && <div className="muted pequeno">✓ retornada{l.retornou ? ` por ${l.retornou.nome}` : ""}</div>}
                    </td>
                    <td>{l.quem?.nome ?? "—"}{l.ramal && <div className="muted pequeno">ramal {l.ramal}</div>}</td>
                    <td className="pequeno" style={{ maxWidth: 260 }}>{l.observacao}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {l.situacao === "perdida" && !l.retornada_em && (
                        <div className="linha" style={{ gap: 4 }}>
                          {temRamal && <BotaoLigar numero={l.numero} pacienteId={l.paciente_id} rotulo="📞 Ligar de volta" />}
                          <button className="mini" onClick={() => resolvida(l.id)} title="Já foi resolvido de outro jeito (ex.: WhatsApp)">Resolvida</button>
                        </div>
                      )}
                      {l.situacao !== "perdida" && temRamal && <BotaoLigar numero={l.numero} pacienteId={l.paciente_id} rotulo="📞" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
