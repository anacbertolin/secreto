// Central de atendimento (pedido da dona, 23/11/2026): tela única da atendente, com a mesma organização do
// Talklogos que a equipe já usa (colunas, botões e nomes), mas feita por nós.
//   [menu] [status · equipe · Canais/Telefone · fila · meus atendimentos] [conversa] [ficha do paciente]
// O telefone entra na aba "Telefone" quando a Telecall liberar os ramais.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, type PacienteResumo } from "../components/ui";
import { NovoAgendamento } from "../components/AgendamentoModais";
import { listaConvenios, listaLocais, listaProfissionais } from "../lib/dados";
import { fmtData, isoDia } from "../lib/util";
import { SELECT_CONVERSA, fmtNumeroWA, podeResponderSetor, type Conversa } from "../lib/whatsapp";
import { STATUS_CENTRAL, fmtEsperando, useCentral, type StatusCentral } from "../lib/central";
import { useTelefone } from "../lib/telefone";
import { Chat, FichaPaciente, iniciais, nomeConversa } from "./WhatsApp";
import { InternoChat, InternoLista } from "../components/Interno";
import { useInternoNaoLidas } from "../lib/interno";

type Visao = "conversas" | "atendimentos";
type Aba = "canais" | "interno" | "telefone";

interface Previa { texto: string; direcao: "recebida" | "enviada"; quando: string }

function quando(d: string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return isoDia(x) === isoDia(new Date()) ? x.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : fmtData(d).slice(0, 5);
}

export default function Central() {
  const { eu } = useAuth();
  const central = useCentral();
  const setor = central?.setor ?? "clinica";
  const podeResponder = podeResponderSetor(eu, setor);
  // Quem atende vê fila, WhatsApp e telefone; médicos, enfermagem e faturamento usam só a conversa interna
  const atende = !!central?.atende && podeResponder;
  const [visao, setVisao] = useState<Visao>("conversas");
  const [aba, setAba] = useState<Aba>(atende ? "canais" : "interno");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [internaId, setInternaId] = useState<string | null>(null);
  const interno = useInternoNaoLidas(eu?.id);
  const [busca, setBusca] = useState("");
  const [soNaoRespondidos, setSoNaoRespondidos] = useState(false);
  const [diaHistorico, setDiaHistorico] = useState(isoDia(new Date()));
  const [agendar, setAgendar] = useState<Conversa | null>(null);
  const [, setTique] = useState(0);

  // Conversas abertas (fila + em atendimento) do setor da pessoa
  const lista = useCarregar(async () => ok(await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA)
    .eq("setor", setor).eq("arquivada", false)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(300)) as Conversa[], [setor]);
  // Atendimentos encerrados no dia escolhido
  const encerradas = useCarregar(async () => {
    if (visao !== "atendimentos") return [] as Conversa[];
    const ini = new Date(diaHistorico + "T00:00:00"), fim = new Date(ini.getTime() + 86400000);
    return ok(await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("setor", setor).eq("arquivada", true)
      .gte("ultima_mensagem_em", ini.toISOString()).lt("ultima_mensagem_em", fim.toISOString())
      .order("ultima_mensagem_em", { ascending: false }).limit(300)) as Conversa[];
  }, [setor, visao, diaHistorico]);
  const equipe = useCarregar(async () => {
    const [p, st] = await Promise.all([
      supabase.from("profissionais").select("id, nome, funcao, orientacao_cirurgica").eq("ativo", true).order("nome"),
      supabase.from("central_status").select("profissional_id, status"),
    ]);
    const status = new Map(((st.data ?? []) as { profissional_id: string; status: StatusCentral }[]).map((x) => [x.profissional_id, x.status]));
    return ((p.data ?? []) as { id: string; nome: string; funcao: string; orientacao_cirurgica: boolean }[])
      .filter((x) => setor === "orientacao" ? x.orientacao_cirurgica : !x.orientacao_cirurgica && ["recepcao", "admin"].includes(x.funcao))
      .map((x) => ({ ...x, status: status.get(x.id) ?? null }));
  }, [setor]);
  const base = useCarregar(async () => {
    const [medicos, convenios, locais] = await Promise.all([listaProfissionais(["medico"]), listaConvenios(), listaLocais()]);
    return { medicos, convenios, locais };
  }, []);

  // Ao vivo + reserva a cada 10 s; relógio para o "esperando há"
  useEffect(() => {
    let espera: number | undefined;
    const agendarRecarga = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => { lista.recarregar(); encerradas.recarregar(); }, 300);
    };
    const canal = supabase.channel("central-conversas-" + setor)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversas" }, agendarRecarga)
      .on("postgres_changes", { event: "*", schema: "public", table: "central_status" }, () => equipe.recarregar())
      .subscribe();
    const t = window.setInterval(() => { lista.recarregar(); setTique((x) => x + 1); }, 15000);
    return () => { window.clearTimeout(espera); window.clearInterval(t); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setor]);

  const todas = lista.dados ?? [];
  const fila = todas.filter((c) => !c.responsavel_id && c.fila_desde).sort((a, b) => (a.fila_desde! < b.fila_desde! ? -1 : 1));
  const minhas = todas.filter((c) => c.responsavel_id === eu?.id);
  const naoRespondida = (c: Conversa) => !!c.ultima_recebida_em && c.ultima_recebida_em >= (c.ultima_mensagem_em ?? c.ultima_recebida_em);
  const f = busca.trim().toLowerCase();
  const filtra = (l: Conversa[]) => l.filter((c) => !f || nomeConversa(c).toLowerCase().includes(f) || c.telefone.includes(f.replace(/\D/g, "") || "§"));
  const minhasVisiveis = filtra(minhas).filter((c) => !soNaoRespondidos || naoRespondida(c));
  const filaVisivel = filtra(fila);
  const historico = filtra(encerradas.dados ?? []);

  // Começo da última mensagem de cada conversa visível (como no cartão do Talklogos)
  const ids = useMemo(() => [...filaVisivel, ...minhasVisiveis, ...historico].map((c) => c.id).slice(0, 80).join(","),
    [filaVisivel, minhasVisiveis, historico]);
  const [previas, setPrevias] = useState<Record<string, Previa>>({});
  useEffect(() => {
    if (!ids) return;
    const lista = ids.split(",");
    supabase.from("whatsapp_mensagens").select("conversa_id, texto, tipo, direcao, quando").in("conversa_id", lista)
      .order("quando", { ascending: false }).limit(400)
      .then(({ data }) => {
        const r: Record<string, Previa> = {};
        for (const m of (data ?? []) as { conversa_id: string; texto: string | null; tipo: string; direcao: "recebida" | "enviada"; quando: string }[]) {
          if (r[m.conversa_id]) continue;
          r[m.conversa_id] = { texto: m.texto || ({ imagem: "📷 Foto", audio: "🎤 Áudio", documento: "📄 Documento", video: "🎬 Vídeo" } as Record<string, string>)[m.tipo] || "Mensagem", direcao: m.direcao, quando: m.quando };
        }
        setPrevias(r);
      });
  }, [ids]);

  const aberta = [...todas, ...(encerradas.dados ?? [])].find((c) => c.id === abertaId) ?? null;
  const nomeDe = (id: string | null) => equipe.dados?.find((x) => x.id === id)?.nome.split(" ")[0];

  async function pegarProximo() {
    const id = await central?.pegarProximo();
    if (id) { lista.recarregar(); setInternaId(null); setAbertaId(id); }
  }

  function Cartao({ c, tipo }: { c: Conversa; tipo: "fila" | "meu" | "historico" }) {
    const pv = previas[c.id];
    return (
      <button className={"ct-cartao" + (c.id === abertaId && !internaId ? " ativo" : "")} onClick={() => { setInternaId(null); setAbertaId(c.id); }}>
        <span className="ct-avatar">{iniciais(nomeConversa(c))}</span>
        <span className="ct-cartao-corpo">
          <span className="ct-linha">
            <b className="ct-nome-cartao">{nomeConversa(c)}</b>
            <span className="ct-hora">{quando(c.ultima_mensagem_em)}</span>
          </span>
          <span className="ct-origem">💬 WhatsApp oficial · {setor === "orientacao" ? "Orientação" : "Central"}{c.pacientes ? ` · Pront. ${c.pacientes.numero_prontuario}` : ` · ${fmtNumeroWA(c.telefone)}`}</span>
          <span className="ct-linha">
            <span className={"ct-previa" + (pv?.direcao === "recebida" ? " dele" : "")}>{pv ? (pv.direcao === "enviada" ? "Você: " : "") + pv.texto : ""}</span>
            {tipo === "fila" && <span className="ct-tag espera">⏳ {fmtEsperando(c.fila_desde)}</span>}
            {tipo === "meu" && (naoRespondida(c) ? <span className="ct-tag nao-resp">Não respondido</span> : <span className="ct-tag atendendo">Atendendo</span>)}
            {tipo === "historico" && <span className="ct-tag cinza">{c.responsavel_id ? nomeDe(c.responsavel_id) ?? "Encerrada" : "Encerrada"}</span>}
            {c.nao_lidas > 0 && tipo !== "historico" && <span className="wa-badge">{c.nao_lidas}</span>}
          </span>
        </span>
      </button>
    );
  }

  const livres = (equipe.dados ?? []).filter((x) => (x.status ?? "disponivel") === "disponivel");
  return (
    <div className={"ct" + (aberta && !internaId ? " com-conversa" : "") + (internaId ? " com-interna" : "")}>
      {/* ---------- Menu da esquerda ---------- */}
      <nav className="ct-menu-lateral">
        <button className={visao === "conversas" ? "ativo" : ""} onClick={() => setVisao("conversas")} title="Conversas">
          <span className="ct-icone">💬{fila.length > 0 && <span className="ct-bolha">{fila.length}</span>}</span>Conversas
        </button>
        {atende && (
          <button className={visao === "atendimentos" ? "ativo" : ""} onClick={() => setVisao("atendimentos")} title="Atendimentos encerrados">
            <span className="ct-icone">📋</span>Atendimentos
          </button>
        )}
        {atende && <Link to={setor === "orientacao" ? "/orientacao-cirurgica" : "/whatsapp"} title="Lembretes de consulta, modelos, fora do horário, pesquisar e importar conversas"><span className="ct-icone">🧰</span>Ferramentas</Link>}
        <span style={{ flex: 1 }} />
        <Link to="/" title="Voltar para o sistema"><span className="ct-icone">↩</span>Sistema</Link>
      </nav>

      {/* ---------- Coluna do meio ---------- */}
      <section className="ct-coluna">
        <div className="ct-topo">
          {atende && <SeletorStatus />}
          <input className="ct-busca" placeholder="🔍 Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {visao === "conversas" ? (
          <>
            {atende && <Equipe pessoas={equipe.dados ?? []} euId={eu?.id} livres={livres.length} />}
            <div className="ct-abas">
              {atende && (
                <button className={aba === "canais" ? "ativa" : ""} onClick={() => setAba("canais")}>
                  Canais {fila.length + minhas.length > 0 && <span className="ct-bolha verde">{fila.length + minhas.length}</span>}
                </button>
              )}
              <button className={aba === "interno" ? "ativa" : ""} onClick={() => setAba("interno")}>
                Interno {interno.total > 0 && <span className="ct-bolha verde" style={{ background: "#d92d20" }}>{interno.total}</span>}
              </button>
              {atende && <button className={aba === "telefone" ? "ativa" : ""} onClick={() => setAba("telefone")}>Telefone</button>}
            </div>

            {aba === "interno" ? (
              <InternoLista busca={busca} abertaId={internaId} naoLidas={interno.porConversa} aoAbrir={(id) => setInternaId(id)} />
            ) : aba === "canais" && atende ? (
              <div className="ct-rolagem">
                <button className="ct-pegar" disabled={fila.length === 0 || central.status !== "disponivel"} onClick={() => void pegarProximo()}>
                  {fila.length === 0 ? "Fila vazia 👍" : central.status !== "disponivel" ? "Você está em pausa" : `👉 Pegar o próximo (${fila.length} na fila)`}
                </button>
                {central.erro && <Aviso>{central.erro}</Aviso>}

                <h3 className="ct-secao">Fila de espera ({fila.length})</h3>
                {filaVisivel.length === 0 ? <div className="ct-vazio">Ninguém esperando.</div>
                  : filaVisivel.map((c) => <Cartao key={c.id} c={c} tipo="fila" />)}

                <h3 className="ct-secao">Meus atendimentos ({minhas.length})</h3>
                <div className="ct-filtro">
                  <button className={!soNaoRespondidos ? "ativo" : ""} onClick={() => setSoNaoRespondidos(false)}>Todos</button>
                  <button className={soNaoRespondidos ? "ativo" : ""} onClick={() => setSoNaoRespondidos(true)}>
                    Não respondidos ({minhas.filter(naoRespondida).length})
                  </button>
                </div>
                {lista.carregando && !lista.dados ? <Carregando /> : minhasVisiveis.length === 0
                  ? <div className="ct-vazio">{soNaoRespondidos ? "Tudo respondido. 👏" : "Nenhum atendimento com você. Clique em “Pegar o próximo”."}</div>
                  : minhasVisiveis.map((c) => <Cartao key={c.id} c={c} tipo="meu" />)}
              </div>
            ) : (
              <PainelTelefone />
            )}
          </>
        ) : (
          <div className="ct-rolagem">
            <h3 className="ct-secao">Atendimentos encerrados</h3>
            <label className="ct-campo">Dia
              <input type="date" value={diaHistorico} onChange={(e) => setDiaHistorico(e.target.value)} />
            </label>
            {encerradas.carregando && !encerradas.dados ? <Carregando /> : historico.length === 0
              ? <div className="ct-vazio">Nenhum atendimento encerrado neste dia.</div>
              : historico.map((c) => <Cartao key={c.id} c={c} tipo="historico" />)}
          </div>
        )}
      </section>

      {/* ---------- Conversa ---------- */}
      <section className="ct-conversa wa-chat painel">
        {internaId ? (
          <InternoChat key={internaId} conversaId={internaId} aoVoltar={() => setInternaId(null)} />
        ) : aberta ? (
          <Chat key={aberta.id} conversa={aberta} podeResponder={podeResponder} quemResponde="" central={{ aoAgendar: () => setAgendar(aberta) }}
            aoMudar={() => { lista.recarregar(); encerradas.recarregar(); }} aoVoltar={() => setAbertaId(null)} />
        ) : (
          <div className="ct-boas-vindas">
            <div className="ct-boas-icone">💬</div>
            <h2>Central de atendimento</h2>
            {atende ? (
              <>
                <p>{fila.length > 0 ? `${fila.length} paciente${fila.length > 1 ? "s" : ""} esperando na fila.` : "Ninguém esperando agora."}</p>
                <p className="muted">Escolha uma conversa ao lado ou clique em <b>Pegar o próximo</b>.</p>
              </>
            ) : <p className="muted">Converse com a equipe pela aba <b>Interno</b>.</p>}
          </div>
        )}
      </section>

      {aberta && !internaId && <FichaPaciente key={aberta.id} conversa={aberta} />}

      {agendar && base.dados && (
        <NovoAgendamento {...base.dados}
          inicial={agendar.pacientes ? { paciente: { id: agendar.pacientes.id, numero_prontuario: agendar.pacientes.numero_prontuario, nome: agendar.pacientes.nome, nome_social: agendar.pacientes.nome_social, data_nascimento: null, cpf: null, telefone: agendar.telefone, convenio_id: null } as PacienteResumo } : undefined}
          aoFechar={() => setAgendar(null)} aoSalvar={() => setAgendar(null)} />
      )}
    </div>
  );
}

/** Status no topo, igual ao "Online ▾" do Talklogos: bolinha colorida + menu */
function SeletorStatus() {
  const c = useCentral();
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState("");
  if (!c) return null;
  const atual = STATUS_CENTRAL[c.status];
  return (
    <div className="ct-status">
      <button className="ct-status-botao" style={{ borderColor: atual.cor }} onClick={() => setAberto(!aberto)}>
        <span className="tel-bolinha" style={{ background: atual.cor }} /> {atual.rotulo} ▾
      </button>
      {aberto && (
        <div className="ct-menu" onMouseLeave={() => setAberto(false)}>
          {(Object.keys(STATUS_CENTRAL) as StatusCentral[]).map((s) => (
            <button key={s} onClick={async () => {
              setAberto(false);
              const n = await c.mudar(s);
              setAviso(n && s !== "disponivel" ? `${n} conversa${n > 1 ? "s voltaram" : " voltou"} para a fila` : "");
              window.setTimeout(() => setAviso(""), 6000);
            }}>
              <span className="tel-bolinha" style={{ background: STATUS_CENTRAL[s].cor }} /> {STATUS_CENTRAL[s].rotulo}
              {s === c.status && " ✓"}
              <span className="ct-dica">{STATUS_CENTRAL[s].dica}</span>
            </button>
          ))}
        </div>
      )}
      {aviso && <span className="ct-aviso-status">{aviso}</span>}
    </div>
  );
}

/** Fotos/iniciais da equipe com o status, com Todos / Livres / Ocupados */
function Equipe({ pessoas, euId, livres }: { pessoas: { id: string; nome: string; status: StatusCentral | null }[]; euId?: string; livres: number }) {
  const [filtro, setFiltro] = useState<"todos" | "livres" | "ocupados">("todos");
  const visiveis = pessoas.filter((p) => {
    const st = p.status ?? "disponivel";
    return filtro === "todos" || (filtro === "livres" ? st === "disponivel" : st !== "disponivel");
  });
  return (
    <div className="ct-equipe">
      <div className="ct-filtro">
        <button className={filtro === "todos" ? "ativo" : ""} onClick={() => setFiltro("todos")}>Todos</button>
        <button className={filtro === "livres" ? "ativo" : ""} onClick={() => setFiltro("livres")}>Livres ({livres})</button>
        <button className={filtro === "ocupados" ? "ativo" : ""} onClick={() => setFiltro("ocupados")}>Em pausa ({pessoas.length - livres})</button>
      </div>
      <div className="ct-equipe-fotos">
        {visiveis.length === 0 && <span className="ct-vazio">Ninguém aqui.</span>}
        {visiveis.map((p) => {
          const st = STATUS_CENTRAL[p.status ?? "disponivel"];
          return (
            <span key={p.id} className="ct-pessoa" title={`${p.nome} · ${st.rotulo}`}>
              <span className="ct-avatar grande" style={{ boxShadow: `0 0 0 3px ${st.cor}` }}>{iniciais(p.nome)}</span>
              <span className="ct-pessoa-nome">{p.id === euId ? "Você" : p.nome.split(" ")[0]}</span>
              <span className="ct-pessoa-status" style={{ color: st.cor }}>● {st.rotulo}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Aba Telefone: fica pronta; passa a funcionar quando a Telecall liberar os ramais */
function PainelTelefone() {
  const tel = useTelefone();
  const pronto = tel && (tel.estado === "pronto" || tel.estado === "pausa");
  return (
    <div className="ct-rolagem">
      <h3 className="ct-secao">Telefone</h3>
      {pronto ? (
        <div className="ct-vazio" style={{ textAlign: "left" }}>
          ✅ Telefone conectado (ramal {tel!.ramal}). As ligações aparecem no canto da tela, com o nome do paciente.
          Para ligar, use o botão 📞 da conversa ou o telefone do canto.
        </div>
      ) : (
        <div className="ct-vazio" style={{ textAlign: "left" }}>
          📞 O telefone vai aparecer aqui, junto com o WhatsApp, assim que a <b>Telecall</b> liberar os ramais.
          <br /><br />
          Quando estiver ligado: as ligações tocam nesta tela, com o nome e o prontuário do paciente, e você atende, transfere,
          põe em espera e agenda sem trocar de tela.
        </div>
      )}
    </div>
  );
}
