import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Campo, Etiqueta } from "../components/ui";
import { FUNCOES, fmtDataHora, isoDia, type Funcao } from "../lib/util";

/**
 * Quem abriu / imprimiu / alterou o prontuário (log_auditoria; só a administração lê).
 * Usado na tela geral (/acessos) e na aba "Acessos" da ficha do paciente.
 */
interface Linha {
  id: number; ocorrido_em: string; email: string | null; profissional_id: string | null; acao: string;
  tabela: string | null; paciente_id: string | null; detalhes: string | null;
}

// tabelas do prontuário: alterações nelas também aparecem (não só as aberturas)
const CLINICAS: Record<string, string> = {
  atendimentos: "atendimento", triagens: "pré-consulta", exames_oftalmologicos: "exame oftalmológico", refracoes: "refração",
  diagnosticos: "diagnóstico", prescricoes: "receita", prescricao_itens: "receita", prescricoes_oculos: "receita de óculos",
  solicitacoes_exames: "pedido de exame", documentos_clinicos: "documento", adendos: "adendo", exames_realizados: "exame/laudo",
  cirurgias: "cirurgia", injecoes_intravitreas: "injeção", alergias: "alergia", medicamentos_em_uso: "medicamento em uso",
  antecedentes: "antecedente", paciente_documentos: "documento anexado", desenhos_oculares: "desenho",
};
const VERBO: Record<string, string> = { INSERT: "Registrou", UPDATE: "Alterou", DELETE: "Apagou" };

function descrever(l: Linha) {
  if (l.acao === "LEITURA") return l.detalhes ?? "Abriu o prontuário";
  const o = CLINICAS[l.tabela ?? ""] ?? l.tabela ?? "";
  return `${VERBO[l.acao] ?? l.acao} ${o}`;
}
const ehImpressao = (l: Linha) => l.acao === "LEITURA" && /imprimiu/i.test(l.detalhes ?? "");

export function ListaAcessos({ pacienteId }: { pacienteId?: string }) {
  const hoje = isoDia(new Date());
  const [de, setDe] = useState(pacienteId ? "" : isoDia(new Date(Date.now() - 6 * 864e5)));
  const [ate, setAte] = useState(pacienteId ? "" : hoje);
  const [pessoa, setPessoa] = useState("");
  const [tipo, setTipo] = useState<"todos" | "aberturas" | "impressoes" | "alteracoes">("todos");

  const profs = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome, funcao").order("nome")) as { id: string; nome: string; funcao: Funcao }[], []);
  const { dados, erro, carregando } = useCarregar(async () => {
    let q = supabase.from("log_auditoria").select("id, ocorrido_em, email, profissional_id, acao, tabela, paciente_id, detalhes")
      .not("paciente_id", "is", null).order("ocorrido_em", { ascending: false }).limit(1000);
    if (pacienteId) q = q.eq("paciente_id", pacienteId);
    if (de) q = q.gte("ocorrido_em", `${de}T00:00:00-03:00`);
    if (ate) q = q.lte("ocorrido_em", `${ate}T23:59:59-03:00`);
    if (pessoa) q = q.eq("profissional_id", pessoa);
    const linhas = (ok(await q) as Linha[]).filter((l) => l.acao === "LEITURA" || CLINICAS[l.tabela ?? ""]);
    // nomes dos pacientes (tela geral)
    const ids = pacienteId ? [] : [...new Set(linhas.map((l) => l.paciente_id!))].slice(0, 500);
    const pacs = ids.length ? (ok(await supabase.from("pacientes").select("id, nome, numero_prontuario").in("id", ids)) as { id: string; nome: string; numero_prontuario: number }[]) : [];
    return { linhas, pacs };
  }, [pacienteId, de, ate, pessoa]);

  const lista = useMemo(() => (dados?.linhas ?? []).filter((l) =>
    tipo === "todos" ? true : tipo === "aberturas" ? l.acao === "LEITURA" && !ehImpressao(l) : tipo === "impressoes" ? ehImpressao(l) : l.acao !== "LEITURA"), [dados, tipo]);
  const prof = (id: string | null) => profs.dados?.find((p) => p.id === id);
  const pac = (id: string | null) => dados?.pacs.find((p) => p.id === id);

  return (
    <div className="grade">
      <div className="grade g4">
        {!pacienteId && <Campo rotulo="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Campo>}
        {!pacienteId && <Campo rotulo="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo>}
        <Campo rotulo="Pessoa">
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
            <option value="">Todas</option>
            {(profs.dados ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome} ({FUNCOES[p.funcao]})</option>)}
          </select>
        </Campo>
        <Campo rotulo="Mostrar">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="todos">Tudo</option><option value="aberturas">Só quem abriu</option>
            <option value="impressoes">Só impressões</option><option value="alteracoes">Só alterações</option>
          </select>
        </Campo>
      </div>
      <Aviso>{erro}</Aviso>
      {carregando && !dados ? <Carregando /> : (
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Quando</th><th>Quem</th>{!pacienteId && <th>Paciente</th>}<th>O que fez</th></tr></thead>
            <tbody>
              {lista.map((l) => {
                const p = prof(l.profissional_id);
                const pa = pac(l.paciente_id);
                return (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDataHora(l.ocorrido_em)}</td>
                    <td>{p ? <><b>{p.nome}</b> <span className="muted pequeno">{FUNCOES[p.funcao]}</span></> : <span className="muted">{l.email ?? "sistema"}</span>}</td>
                    {!pacienteId && <td>{pa ? <Link to={`/pacientes/${pa.id}`}>{pa.nome}</Link> : "—"}{pa && <span className="muted pequeno"> · {pa.numero_prontuario}</span>}</td>}
                    <td>
                      {ehImpressao(l) ? <Etiqueta cor="amarelo">🖨️ impressão</Etiqueta> : l.acao === "LEITURA" ? <Etiqueta cor="azul">👁️ abriu</Etiqueta> : <Etiqueta cor="verde">✏️ registro</Etiqueta>}{" "}
                      {descrever(l)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length === 0 && <div className="vazio">Nenhum acesso no período.</div>}
          {(dados?.linhas.length ?? 0) >= 1000 && <p className="muted pequeno">Mostrando os 1.000 mais recentes. Use os filtros para ver menos.</p>}
        </div>
      )}
    </div>
  );
}

export default function Acessos() {
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Acessos ao prontuário</h1>
          <p className="sub" style={{ margin: 0 }}>Quem abriu, imprimiu ou registrou algo no prontuário de cada paciente. Só a administração vê esta tela.</p>
        </div>
      </div>
      <div className="painel"><ListaAcessos /></div>
    </div>
  );
}
