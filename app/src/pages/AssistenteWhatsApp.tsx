// Assistente do WhatsApp: o que a IA tirou das conversas.
//  • Pedidos de agendamento (recepção e admin): o que foi marcado sozinho e o que falta a recepção resolver.
//  • Qualidade do atendimento (só admin): notas e tempo de resposta.
//  • Preparação do robô (recepção vê, admin aprova): perguntas frequentes e as respostas que o robô dará.
//  • Configuração (só admin): ligar/desligar e regras do agendamento automático.
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo, type PacienteResumo } from "../components/ui";
import { NovoAgendamento } from "../components/AgendamentoModais";
import { listaConvenios, listaLocais, listaProfissionais, nomePor } from "../lib/dados";
import { TIPOS_AGENDA, fmtData, fmtDataHora, isoDia } from "../lib/util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Linha = Record<string, any>;

export const CATEGORIAS_BOT: Record<string, string> = {
  agendamento: "Agendamento", convenios: "Convênios", precos_pagamento: "Preços e pagamento",
  endereco_horarios: "Endereço e horários", exames_preparo: "Exames e preparo", resultados_laudos: "Resultados e laudos",
  receitas_documentos: "Receitas e documentos", cirurgias_procedimentos: "Cirurgias e procedimentos",
  pos_operatorio: "Pós-operatório", sintomas_urgencia: "Sintomas e urgência", outros: "Outros",
};
const INTENCOES: Record<string, string> = {
  agendar: "Marcar", remarcar: "Remarcar", cancelar: "Cancelar", confirmar_presenca: "Confirmar presença",
  duvida_convenio: "Convênio", duvida_preco: "Preço", duvida_exame_preparo: "Exame/preparo", resultado_exame: "Resultado",
  receita_documento: "Receita/documento", cirurgia: "Cirurgia", pos_operatorio: "Pós-operatório",
  sintoma_urgencia: "Sintoma/urgência", endereco_horario: "Endereço/horário", reclamacao: "Reclamação", elogio: "Elogio", outro: "Outro",
};
const SITUACAO: Record<string, [string, string]> = {
  pendente: ["Falta resolver", "amarelo"], agendado_auto: ["Marcado sozinho", "verde"],
  resolvido: ["Resolvido", "azul"], descartado: ["Descartado", "cinza"],
};

const tempo = (s?: number | null) => {
  if (s == null) return "—";
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = s / 3600;
  return h < 24 ? `${h.toFixed(1).replace(".", ",")} h` : `${Math.round(h / 24)} d`;
};
const media = (l: Linha[], k: string) => {
  const v = l.map((x) => x[k]).filter((x) => x != null).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const arred = (v: number | null) => (v == null ? null : Math.round(v));
const n1 = (v: number | null) => (v == null ? "—" : v.toFixed(1).replace(".", ","));

function Cartao({ num, rot }: { num: ReactNode; rot: string }) {
  return <div className="cartao"><div className="num">{num}</div><div className="rot">{rot}</div></div>;
}

export default function AssistenteWhatsApp() {
  const { pode } = useAuth();
  const admin = pode("admin");
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") ?? "pedidos";
  const abas: [string, string, boolean][] = [
    ["pedidos", "Pedidos de agendamento", true],
    ["qualidade", "Qualidade do atendimento", admin],
    ["robo", "Preparação do robô", true],
    ["config", "Configuração", admin],
  ];
  return (
    <div>
      <div className="cabecalho">
        <h1>🤖 Assistente do WhatsApp</h1>
        <p className="sub" style={{ margin: 0 }}>O assistente lê as conversas, marca na agenda o que foi combinado, avalia o atendimento e prepara o futuro robô.</p>
      </div>
      <div className="abas">
        {abas.filter((a) => a[2]).map(([k, r]) => (
          <button key={k} className={aba === k ? "ativa" : ""} onClick={() => setParams({ aba: k })}>{r}</button>
        ))}
      </div>
      {aba === "pedidos" && <Pedidos />}
      {aba === "qualidade" && admin && <Qualidade />}
      {aba === "robo" && <Robo admin={admin} />}
      {aba === "config" && admin && <Configuracao />}
    </div>
  );
}

// =====================================================================
// Pedidos de agendamento
// =====================================================================
function Pedidos() {
  const [filtro, setFiltro] = useState("pendente");
  const [agendar, setAgendar] = useState<Linha | null>(null);
  const [erro, setErro] = useState("");
  const d = useCarregar(async () => {
    let q = supabase.from("whatsapp_pedidos_agendamento")
      .select("*, pacientes(id, numero_prontuario, nome, nome_social, data_nascimento, cpf, telefone, convenio_id, plano_id), whatsapp_conversas(nome_contato, telefone)")
      .order("criado_em", { ascending: false }).limit(200);
    if (filtro !== "todos") q = q.eq("situacao", filtro);
    const [pedidos, medicos, convenios, locais] = await Promise.all([
      q.then(ok), listaProfissionais(["medico"]), listaConvenios(), listaLocais(),
    ]);
    return { pedidos: pedidos as Linha[], medicos, convenios, locais };
  }, [filtro]);

  async function mudar(id: string, situacao: string) {
    setErro("");
    const { error } = await supabase.from("whatsapp_pedidos_agendamento").update({ situacao }).eq("id", id);
    if (error) setErro(msgErro(error));
    d.recarregar();
  }

  if (d.carregando && !d.dados) return <Carregando />;
  const { pedidos = [], medicos = [], convenios = [], locais = [] } = d.dados ?? {};
  return (
    <div className="painel rolagem">
      <div className="linha entre">
        <div className="linha">
          {[["pendente", "Falta resolver"], ["agendado_auto", "Marcados sozinhos"], ["resolvido", "Resolvidos"], ["todos", "Todos"]].map(([k, r]) => (
            <button key={k} className={"mini" + (filtro === k ? " primario" : "")} onClick={() => setFiltro(k)}>{r}</button>
          ))}
        </div>
        <button className="mini" onClick={d.recarregar}>↻ Atualizar</button>
      </div>
      <Aviso>{d.erro || erro}</Aviso>
      {pedidos.length === 0 ? (
        <div className="vazio">{filtro === "pendente" ? "Nenhum pedido esperando a recepção. 🎉" : "Nada por aqui."}</div>
      ) : (
        <table className="tabela" style={{ marginTop: 10 }}>
          <thead><tr><th>Quando</th><th>Paciente</th><th>Pedido</th><th>Combinado</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {pedidos.map((p) => {
              const [rot, cor] = SITUACAO[p.situacao] ?? [p.situacao, "cinza"];
              const nome = p.pacientes ? (p.pacientes.nome_social || p.pacientes.nome) : p.nome_informado || p.whatsapp_conversas?.nome_contato || "—";
              return (
                <tr key={p.id}>
                  <td className="pequeno">{fmtDataHora(p.criado_em)}</td>
                  <td>
                    {p.pacientes ? <Link to={`/pacientes/${p.paciente_id}`}>{nome}</Link> : nome}
                    {!p.pacientes && <div className="muted pequeno">sem cadastro ligado</div>}
                  </td>
                  <td>
                    <b>{{ agendar: "Marcar", remarcar: "Remarcar", cancelar: "Cancelar" }[p.acao as string]}</b> {TIPOS_AGENDA[p.tipo]?.toLowerCase()}
                    {p.exame_ou_procedimento && ` · ${p.exame_ou_procedimento}`}
                    <div className="muted pequeno">
                      {nomePor(medicos, p.profissional_id) || p.profissional_citado || "médico não dito"}
                      {" · "}{p.particular ? "particular" : nomePor(convenios, p.convenio_id) || p.convenio_citado || "convênio não dito"}
                    </div>
                  </td>
                  <td>
                    {p.inicio ? fmtDataHora(p.inicio) : <span className="muted">{p.preferencia || "sem data"}</span>}
                    {p.evidencia && <div className="muted pequeno" title={p.evidencia}>“{p.evidencia.slice(0, 80)}{p.evidencia.length > 80 ? "…" : ""}”</div>}
                  </td>
                  <td>
                    <Etiqueta cor={cor}>{rot}</Etiqueta>
                    <div className="muted pequeno">{p.motivo}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="botao mini" to={`/whatsapp?conversa=${p.conversa_id}`}>💬 Conversa</Link>{" "}
                    {p.situacao === "pendente" && p.acao === "agendar" && <button className="mini primario" onClick={() => setAgendar(p)}>Agendar</button>}{" "}
                    {p.situacao === "pendente" && <button className="mini" onClick={() => mudar(p.id, "resolvido")}>✓ Resolvido</button>}{" "}
                    {p.situacao === "pendente" && <button className="mini sutil" onClick={() => mudar(p.id, "descartado")}>Descartar</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="muted pequeno" style={{ marginTop: 12 }}>
        “Marcado sozinho” = a data, a hora e o médico foram combinados na conversa e o horário estava livre. Esses já estão na Agenda
        (com a observação “Marcado automaticamente pelo assistente do WhatsApp”). Pacientes novos ganham um cadastro simples, para conferir na chegada.
      </p>
      {agendar && (
        <NovoAgendamento
          medicos={medicos} convenios={convenios} locais={locais}
          inicial={{
            profissional_id: agendar.profissional_id ?? undefined,
            inicio: agendar.inicio ? new Date(agendar.inicio) : undefined,
            tipo: agendar.tipo,
            paciente: (agendar.pacientes as PacienteResumo) ?? undefined,
          }}
          aoFechar={() => setAgendar(null)}
          aoSalvar={async () => { await mudar(agendar.id, "resolvido"); setAgendar(null); }}
        />
      )}
    </div>
  );
}

// =====================================================================
// Qualidade do atendimento (admin)
// =====================================================================
function Qualidade() {
  const hoje = new Date();
  const [de, setDe] = useState(isoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [ate, setAte] = useState(isoDia(hoje));
  const [aberta, setAberta] = useState<Linha | null>(null);
  const d = useCarregar(async () => {
    const fim = new Date(`${ate}T23:59:59`).toISOString();
    const ini = new Date(`${de}T00:00:00`).toISOString();
    const [av, an, equipe] = await Promise.all([
      supabase.from("whatsapp_avaliacoes").select("*").gte("criado_em", ini).lte("criado_em", fim).order("criado_em", { ascending: false }).limit(1000).then(ok),
      supabase.from("whatsapp_analises").select("id, conversa_id, resumo, intencao_principal, bot_resolveria, whatsapp_conversas(nome_contato)")
        .gte("criado_em", ini).lte("criado_em", fim).limit(2000).then(ok),
      listaProfissionais(),
    ]);
    return { av: av as Linha[], an: an as Linha[], equipe };
  }, [de, ate]);

  if (d.carregando && !d.dados) return <Carregando />;
  const { av = [], an = [], equipe = [] } = d.dados ?? {};
  const analise = new Map(an.map((a) => [a.id, a]));
  const notas = av.filter((a) => a.nota_geral != null);

  // Por atendente (uma conversa pode ter mais de um)
  const porPessoa = new Map<string, Linha[]>();
  for (const a of notas) for (const id of a.atendentes ?? []) porPessoa.set(id, [...(porPessoa.get(id) ?? []), a]);

  return (
    <>
      <div className="painel">
        <div className="linha">
          <Campo rotulo="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Campo>
          <Campo rotulo="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo>
        </div>
        <Aviso>{d.erro}</Aviso>
        <div className="cartoes" style={{ marginTop: 14 }}>
          <Cartao num={an.length} rot="Conversas analisadas" />
          <Cartao num={n1(media(notas, "nota_geral"))} rot="Nota geral (0 a 10)" />
          <Cartao num={tempo(arred(media(av, "primeira_resposta_seg")))} rot="1ª resposta (média)" />
          <Cartao num={av.filter((a) => a.sem_resposta).length} rot="Ficaram sem resposta" />
          <Cartao num={notas.length ? `${Math.round((100 * notas.filter((a) => a.resolvido).length) / notas.length)}%` : "—"} rot="Resolvidas na conversa" />
        </div>
        <div className="cartoes">
          <Cartao num={n1(media(notas, "cordialidade"))} rot="Cordialidade" />
          <Cartao num={n1(media(notas, "clareza"))} rot="Clareza" />
          <Cartao num={n1(media(notas, "resolutividade"))} rot="Resolução" />
          <Cartao num={n1(media(notas, "informacao_correta"))} rot="Informação correta" />
        </div>
      </div>

      <div className="painel rolagem">
        <h2>Por atendente</h2>
        {porPessoa.size === 0 ? <div className="vazio">Sem avaliações no período.</div> : (
          <table className="tabela">
            <thead><tr><th>Atendente</th><th style={{ textAlign: "right" }}>Conversas</th><th style={{ textAlign: "right" }}>Nota</th><th style={{ textAlign: "right" }}>Cordialidade</th><th style={{ textAlign: "right" }}>Clareza</th><th style={{ textAlign: "right" }}>Resolução</th><th style={{ textAlign: "right" }}>1ª resposta</th></tr></thead>
            <tbody>
              {[...porPessoa.entries()].map(([id, l]) => (
                <tr key={id}>
                  <td>{nomePor(equipe, id) || "—"}</td>
                  <td style={{ textAlign: "right" }}>{l.length}</td>
                  <td style={{ textAlign: "right" }}><b>{n1(media(l, "nota_geral"))}</b></td>
                  <td style={{ textAlign: "right" }}>{n1(media(l, "cordialidade"))}</td>
                  <td style={{ textAlign: "right" }}>{n1(media(l, "clareza"))}</td>
                  <td style={{ textAlign: "right" }}>{n1(media(l, "resolutividade"))}</td>
                  <td style={{ textAlign: "right" }}>{tempo(arred(media(l, "primeira_resposta_seg")))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted pequeno">O tempo conta desde a mensagem do paciente até a resposta de alguém da equipe, inclusive à noite e no fim de semana.</p>
      </div>

      <div className="painel rolagem">
        <h2>Conversas avaliadas</h2>
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Contato</th><th>Resumo</th><th style={{ textAlign: "right" }}>Nota</th><th>Espera</th><th></th></tr></thead>
          <tbody>
            {av.map((a) => {
              const x = analise.get(a.analise_id);
              return (
                <tr key={a.id} className="clicavel" onClick={() => setAberta({ ...a, analise: x })}>
                  <td className="pequeno">{fmtDataHora(a.criado_em)}</td>
                  <td>{x?.whatsapp_conversas?.nome_contato ?? "—"}</td>
                  <td className="pequeno">{x?.resumo}</td>
                  <td style={{ textAlign: "right" }}>{a.nota_geral == null ? "—" : <b>{n1(Number(a.nota_geral))}</b>}</td>
                  <td>{a.sem_resposta ? <Etiqueta cor="vermelho">Sem resposta</Etiqueta> : tempo(a.primeira_resposta_seg)}</td>
                  <td>›</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {av.length === 0 && <div className="vazio">Sem avaliações no período.</div>}
      </div>

      {aberta && (
        <Modal titulo="Avaliação do atendimento" aoFechar={() => setAberta(null)} rodape={
          <><Link className="botao" to={`/whatsapp?conversa=${aberta.conversa_id}`}>💬 Abrir conversa</Link><button onClick={() => setAberta(null)}>Fechar</button></>
        }>
          <p>{aberta.analise?.resumo}</p>
          <div className="cartoes">
            <Cartao num={n1(aberta.nota_geral == null ? null : Number(aberta.nota_geral))} rot="Nota geral" />
            <Cartao num={tempo(aberta.primeira_resposta_seg)} rot="1ª resposta" />
            <Cartao num={tempo(aberta.maior_espera_seg)} rot="Maior espera" />
          </div>
          {aberta.pontos_positivos?.length > 0 && <><h3>👍 Pontos positivos</h3><ul>{aberta.pontos_positivos.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></>}
          {aberta.pontos_melhorar?.length > 0 && <><h3>✏️ Pode melhorar</h3><ul>{aberta.pontos_melhorar.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></>}
          {aberta.sugestao && <Aviso tipo="info"><b>Sugestão:</b> {aberta.sugestao}</Aviso>}
        </Modal>
      )}
    </>
  );
}

// =====================================================================
// Preparação do robô
// =====================================================================
function Robo({ admin }: { admin: boolean }) {
  const [cat, setCat] = useState("");
  const [editar, setEditar] = useState<Linha | null>(null);
  const d = useCarregar(async () => {
    const desde = new Date(Date.now() - 90 * 86400000).toISOString();
    const [itens, prontidao, analises] = await Promise.all([
      supabase.from("bot_conhecimento").select("*").neq("situacao", "descartada").order("vezes", { ascending: false }).limit(500).then(ok),
      supabase.from("bot_prontidao").select("*").then(ok),
      supabase.from("whatsapp_analises").select("intencao_principal, bot_resolveria").gte("criado_em", desde).limit(5000).then(ok),
    ]);
    return { itens: itens as Linha[], prontidao: prontidao as Linha[], analises: analises as Linha[] };
  }, []);

  if (d.carregando && !d.dados) return <Carregando />;
  const { itens = [], prontidao = [], analises = [] } = d.dados ?? {};
  const total = analises.length;
  const conta = (v: string) => analises.filter((a) => a.bot_resolveria === v).length;
  const pct = (x: number) => (total ? `${Math.round((100 * x) / total)}%` : "—");
  const intencoes = new Map<string, number>();
  for (const a of analises) if (a.intencao_principal) intencoes.set(a.intencao_principal, (intencoes.get(a.intencao_principal) ?? 0) + 1);
  const lista = itens.filter((i) => !cat || i.categoria === cat);
  const aprovadas = itens.filter((i) => i.situacao === "aprovada").length;
  const lacunas = itens.filter((i) => i.lacunas > 0 && i.situacao !== "aprovada");

  return (
    <>
      <div className="painel">
        <h2>O robô daria conta? <span className="muted pequeno">(últimos 90 dias)</span></h2>
        <Aviso>{d.erro}</Aviso>
        <div className="cartoes">
          <Cartao num={total} rot="Conversas analisadas" />
          <Cartao num={pct(conta("sim"))} rot="Robô resolveria sozinho" />
          <Cartao num={pct(conta("parcial"))} rot="Resolveria em parte" />
          <Cartao num={pct(conta("nao"))} rot="Precisa de pessoa" />
          <Cartao num={`${aprovadas}/${itens.length}`} rot="Respostas aprovadas" />
        </div>
        {intencoes.size > 0 && (
          <p className="pequeno"><b>Por que os pacientes escrevem:</b>{" "}
            {[...intencoes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${INTENCOES[k] ?? k} ${pct(v)}`).join(" · ")}
          </p>
        )}
        <p className="muted pequeno">
          Para o robô funcionar, cada pergunta frequente precisa de uma <b>resposta aprovada</b> pela clínica. Comece pelas que mais aparecem.
          As marcadas “precisa de pessoa” (sintomas, laudos, casos delicados) o robô deve passar para a recepção.
        </p>
      </div>

      {lacunas.length > 0 && (
        <div className="painel">
          <h2>⚠️ O que a equipe não soube responder</h2>
          <ul>{lacunas.slice(0, 10).map((i) => <li key={i.id}>{i.pergunta} <span className="muted pequeno">({i.lacunas}×)</span></li>)}</ul>
          <p className="muted pequeno">Essas informações precisam ser definidas pela clínica (ex.: preço, documentos, preparo) antes de entregar ao robô.</p>
        </div>
      )}

      <div className="painel rolagem">
        <div className="linha entre">
          <h2 style={{ margin: 0 }}>Perguntas frequentes</h2>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Todas as categorias</option>
            {prontidao.map((p) => <option key={p.categoria} value={p.categoria}>{CATEGORIAS_BOT[p.categoria] ?? p.categoria} ({p.perguntas})</option>)}
          </select>
        </div>
        {lista.length === 0 ? <div className="vazio">Ainda não há perguntas. Elas aparecem conforme o assistente lê as conversas.</div> : (
          <table className="tabela" style={{ marginTop: 10 }}>
            <thead><tr><th>Pergunta</th><th>Categoria</th><th style={{ textAlign: "right" }}>Vezes</th><th>Resposta do robô</th><th></th></tr></thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id} className={admin ? "clicavel" : ""} onClick={() => admin && setEditar(i)}>
                  <td>
                    {i.pergunta}
                    {i.precisa_humano && <> <Etiqueta cor="roxo">precisa de pessoa</Etiqueta></>}
                    {i.lacunas > 0 && <> <Etiqueta cor="vermelho">sem resposta {i.lacunas}×</Etiqueta></>}
                    {i.exemplos?.[0] && <div className="muted pequeno">ex.: “{i.exemplos[i.exemplos.length - 1]}”</div>}
                  </td>
                  <td className="pequeno">{CATEGORIAS_BOT[i.categoria] ?? i.categoria}</td>
                  <td style={{ textAlign: "right" }}>{i.vezes}</td>
                  <td className="pequeno">
                    {i.situacao === "aprovada" ? <><Etiqueta cor="verde">Aprovada</Etiqueta> {i.resposta_aprovada}</> : <span className="muted">{i.resposta_equipe ? `Equipe costuma dizer: “${i.resposta_equipe}”` : "—"}</span>}
                  </td>
                  <td>{admin ? "✏️" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editar && <EditarResposta item={editar} aoFechar={() => setEditar(null)} aoSalvar={() => { setEditar(null); d.recarregar(); }} />}
    </>
  );
}

function EditarResposta({ item, aoFechar, aoSalvar }: { item: Linha; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState({
    pergunta: item.pergunta as string, categoria: item.categoria as string,
    resposta_aprovada: (item.resposta_aprovada ?? item.resposta_equipe ?? "") as string, precisa_humano: !!item.precisa_humano,
  });
  const [erro, setErro] = useState("");
  async function salvar(situacao: string) {
    setErro("");
    if (situacao === "aprovada" && !f.precisa_humano && f.resposta_aprovada.trim().length < 3) return setErro("Escreva a resposta que o robô vai dar.");
    const { error } = await supabase.from("bot_conhecimento").update({ ...f, resposta_aprovada: f.resposta_aprovada.trim() || null, situacao }).eq("id", item.id);
    if (error) return setErro(msgErro(error));
    aoSalvar();
  }
  return (
    <Modal titulo="Resposta do robô" largo aoFechar={aoFechar} rodape={
      <>
        <button className="sutil" onClick={() => salvar("descartada")}>Descartar pergunta</button>
        <button onClick={() => salvar("sugerida")}>Salvar rascunho</button>
        <button className="primario" onClick={() => salvar("aprovada")}>Aprovar</button>
      </>
    }>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Pergunta" className="inteiro"><input value={f.pergunta} onChange={(e) => setF({ ...f, pergunta: e.target.value })} /></Campo>
        <Campo rotulo="Categoria">
          <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {Object.entries(CATEGORIAS_BOT).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
        <label className="campo"><span>&nbsp;</span>
          <span><input type="checkbox" checked={f.precisa_humano} onChange={(e) => setF({ ...f, precisa_humano: e.target.checked })} /> O robô deve passar para uma pessoa</span>
        </label>
        <Campo rotulo="Resposta que o robô vai dar" className="inteiro">
          <textarea rows={5} value={f.resposta_aprovada} onChange={(e) => setF({ ...f, resposta_aprovada: e.target.value })}
            placeholder={f.precisa_humano ? "Ex.: Vou passar sua mensagem para a nossa equipe, que já te responde." : ""} />
        </Campo>
      </div>
      {item.resposta_equipe && <p className="pequeno"><b>Como a equipe respondeu da última vez:</b> “{item.resposta_equipe}”</p>}
      {item.exemplos?.length > 0 && (
        <><p className="pequeno" style={{ marginBottom: 4 }}><b>Como os pacientes perguntam:</b></p>
          <ul className="pequeno">{item.exemplos.map((e: string, i: number) => <li key={i}>“{e}”</li>)}</ul></>
      )}
      <p className="muted pequeno">Vista {item.vezes}× · última em {fmtData(item.ultima_vez)}</p>
    </Modal>
  );
}

// =====================================================================
// Configuração (admin)
// =====================================================================
function Configuracao() {
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const d = useCarregar(async () => {
    const [cfg, erros] = await Promise.all([
      supabase.from("whatsapp_extrator_config").select("*").eq("id", 1).single().then(ok),
      supabase.from("whatsapp_extrator_estado").select("conversa_id, tentativas, ultimo_erro, whatsapp_conversas(nome_contato)").gt("tentativas", 0).limit(20).then(ok),
    ]);
    return { cfg: cfg as Linha, erros: erros as Linha[] };
  }, []);
  const [f, setF] = useState<Linha | null>(null);
  if (d.carregando && !d.dados) return <Carregando />;
  const cfg = f ?? d.dados?.cfg;
  if (!cfg) return <Aviso>{d.erro}</Aviso>;

  async function salvar(mudanca: Linha) {
    const novo = { ...cfg, ...mudanca };
    setF(novo);
    setMsg(null);
    const { error } = await supabase.from("whatsapp_extrator_config").update({
      ligado: novo.ligado, agendar_automatico: novo.agendar_automatico, criar_paciente_automatico: novo.criar_paciente_automatico,
      confianca_minima: Number(novo.confianca_minima), silencio_minutos: Number(novo.silencio_minutos),
      transcrever_audios: novo.transcrever_audios, usar_horario_padrao: novo.usar_horario_padrao, padrao_dias: novo.padrao_dias,
      padrao_inicio: novo.padrao_inicio, padrao_fim: novo.padrao_fim, padrao_duracao_min: Number(novo.padrao_duracao_min),
    }).eq("id", 1);
    setMsg(error ? { tipo: "erro", texto: msgErro(error) } : { tipo: "ok", texto: "Salvo." });
  }
  return (
    <>
      <div className="painel">
        <h2>Situação</h2>
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        <ul>
          <li>Assistente: {cfg.ligado ? <Etiqueta cor="verde">ligado</Etiqueta> : <Etiqueta cor="cinza">desligado</Etiqueta>}</li>
          <li>Quem analisa: tarefa agendada do Claude, no plano da clínica (Claude Sonnet 5.5), de hora em hora das 7h às 20h</li>
          <li>Última passagem: {cfg.ultima_execucao ? fmtDataHora(cfg.ultima_execucao) : "ainda não rodou"}
            {cfg.ultimo_resumo && <div className="muted pequeno">{cfg.ultimo_resumo}</div>}</li>
          {(d.dados?.erros ?? []).length > 0 && <li>Conversas com erro na análise: <b>{d.dados!.erros.length}</b></li>}
        </ul>
        <div className="linha">
          <button className={cfg.ligado ? "" : "primario"} onClick={() => salvar({ ligado: !cfg.ligado })}>
            {cfg.ligado ? "Desligar o assistente" : "Ligar o assistente"}
          </button>
        </div>
        <p className="muted pequeno">Ligado, a cada passagem ele analisa as conversas que estão paradas há {cfg.silencio_minutos} minutos ou mais.</p>
      </div>

      <div className="painel">
        <h2>Regras</h2>
        <div className="grade g2">
          <label className="campo"><span>Agendamento automático</span>
            <span><input type="checkbox" checked={cfg.agendar_automatico} onChange={(e) => salvar({ agendar_automatico: e.target.checked })} /> Marcar sozinho na agenda o que foi combinado</span>
          </label>
          <label className="campo"><span>Áudios dos pacientes</span>
            <span><input type="checkbox" checked={cfg.transcrever_audios} onChange={(e) => salvar({ transcrever_audios: e.target.checked })} /> Transcrever os áudios automaticamente (Whisper / OpenAI)</span>
          </label>
          <label className="campo"><span>Paciente novo</span>
            <span><input type="checkbox" checked={cfg.criar_paciente_automatico} onChange={(e) => salvar({ criar_paciente_automatico: e.target.checked })} /> Criar cadastro simples (nome e telefone) para marcar</span>
          </label>
          <Campo rotulo="Certeza mínima para marcar sozinho">
            <select value={String(cfg.confianca_minima)} onChange={(e) => salvar({ confianca_minima: e.target.value })}>
              {[["0.75", "75% (marca mais, erra mais)"], ["0.85", "85% (recomendado)"], ["0.95", "95% (só quando tiver muita certeza)"]].map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Esperar a conversa parar por">
            <select value={String(cfg.silencio_minutos)} onChange={(e) => salvar({ silencio_minutos: e.target.value })}>
              {[10, 20, 30, 60].map((v) => <option key={v} value={v}>{v} minutos</option>)}
            </select>
          </Campo>
        </div>
        <p className="muted pequeno">
          Mesmo ligado, o assistente só marca sozinho quando: o dia, a hora e o médico foram combinados na conversa; o horário está dentro
          do horário de atendimento do médico, sem bloqueio e livre. Remarcações e cancelamentos sempre ficam para a recepção.
        </p>
      </div>

      <div className="painel">
        <h2>Horário padrão da clínica</h2>
        <p className="muted pequeno" style={{ marginTop: 0 }}>
          Vale para o médico que ainda não tem horário próprio em Cadastros → Horários e bloqueios. Quem tem horário próprio
          segue o dele.
        </p>
        <label className="campo" style={{ marginBottom: 12 }}>
          <span><input type="checkbox" checked={cfg.usar_horario_padrao} onChange={(e) => salvar({ usar_horario_padrao: e.target.checked })} /> Usar o horário padrão da clínica</span>
        </label>
        {cfg.usar_horario_padrao && (
          <div className="grade g4">
            <div className="campo inteiro">Dias
              <div className="linha">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((nome, i) => {
                  const marcado = (cfg.padrao_dias ?? []).includes(i);
                  return (
                    <label key={i} className="linha" style={{ gap: 4 }}>
                      <input type="checkbox" checked={marcado} onChange={() => salvar({
                        padrao_dias: marcado ? cfg.padrao_dias.filter((d: number) => d !== i) : [...cfg.padrao_dias, i].sort(),
                      })} /> {nome}
                    </label>
                  );
                })}
              </div>
            </div>
            <Campo rotulo="Abre às"><input type="time" value={String(cfg.padrao_inicio).slice(0, 5)} onChange={(e) => e.target.value && salvar({ padrao_inicio: e.target.value })} /></Campo>
            <Campo rotulo="Fecha às"><input type="time" value={String(cfg.padrao_fim).slice(0, 5)} onChange={(e) => e.target.value && salvar({ padrao_fim: e.target.value })} /></Campo>
            <Campo rotulo="Duração de cada consulta">
              <select value={String(cfg.padrao_duracao_min)} onChange={(e) => salvar({ padrao_duracao_min: e.target.value })}>
                {[10, 15, 20, 30, 40, 60].map((v) => <option key={v} value={v}>{v} minutos</option>)}
              </select>
            </Campo>
          </div>
        )}
      </div>

      {(d.dados?.erros ?? []).length > 0 && (
        <div className="painel">
          <h2>Conversas que deram erro</h2>
          <ul className="pequeno">
            {d.dados!.erros.map((e) => (
              <li key={e.conversa_id}>
                <Link to={`/whatsapp?conversa=${e.conversa_id}`}>{e.whatsapp_conversas?.nome_contato ?? "conversa"}</Link>: {e.ultimo_erro} ({e.tentativas}×)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="painel">
        <h2>Privacidade</h2>
        <p className="pequeno">
          Para entender as conversas, o texto das mensagens é lido pelo Claude (Anthropic, empresa nos Estados Unidos), dentro do plano da clínica, e a resposta volta para o
          nosso banco, no Brasil. Antes de enviar, o sistema troca CPF, telefones, e-mails e números de carteirinha por marcadores e não manda
          a ficha nem o prontuário do paciente (só o primeiro nome). Os resultados ficam guardados só aqui no sistema. Importante: na conta do Claude usada pela clínica, deixe
          <b> desligada</b> a opção “Ajudar a melhorar o Claude” (claude.ai → Configurações → Privacidade), para que as conversas não sejam usadas
          no treino da IA. Os áudios dos pacientes são enviados ao Whisper (OpenAI, Estados Unidos) só para virar texto;
          a OpenAI não usa dados enviados pela API para treinar a IA.
        </p>
      </div>
    </>
  );
}
