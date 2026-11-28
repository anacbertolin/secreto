// Central de atendimento (pedido da dona, 23/11/2026): tela única da atendente, com a mesma organização do
// Talklogos que a equipe já usa (colunas, botões e nomes), mas feita por nós.
//   [menu] [status · equipe · Canais/Telefone · fila · meus atendimentos] [conversa] [ficha do paciente]
// O telefone entra na aba "Telefone" quando a Telecall liberar os ramais.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Modal, BuscaPaciente, type PacienteResumo } from "../components/ui";
import { NovoAgendamento } from "../components/AgendamentoModais";
import { listaConvenios, listaLocais, listaProfissionais } from "../lib/dados";
import { fmtData, isoDia } from "../lib/util";
import { SELECT_CONVERSA, whatsapp, fmtNumeroWA, podeResponderSetor, podeVerSetor, type Conversa, type SetorWA } from "../lib/whatsapp";
import { STATUS_CENTRAL, fmtEsperando, useCentral, type StatusCentral } from "../lib/central";
import { fmtNumeroTel, useTelefone } from "../lib/telefone";
import { BotaoLigar } from "../components/Telefone";
import { Chat, FichaPaciente, ForaDoHorario, Lembretes, Modelos, Pesquisa, RespostasRapidas, iniciais, nomeConversa } from "./WhatsApp";
import { InternoChat, InternoLista } from "../components/Interno";
import { useInternoNaoLidas } from "../lib/interno";
import { VigiaWhatsApp } from "../components/VigiaWhatsApp";

type Visao = "conversas" | "atendimentos" | "ferramentas";
type Aba = "canais" | "interno" | "telefone";

interface Previa { texto: string; direcao: "recebida" | "enviada"; quando: string }

function quando(d: string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return isoDia(x) === isoDia(new Date()) ? x.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : fmtData(d).slice(0, 5);
}

/**
 * setorFixo: a aba "Orientação cirúrgica" (/orientacao-cirurgica) usa esta mesma tela, sempre no número da
 * orientação (pedido da dona, 23/11/2026). Quem atende a orientação trabalha igual à Central; médicos e admin
 * acompanham as conversas só para consulta (sem pegar da fila nem responder).
 */
export default function Central({ setor: setorFixo }: { setor?: SetorWA } = {}) {
  const { eu } = useAuth();
  const central = useCentral();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const setor: SetorWA = setorFixo ?? central?.setor ?? "clinica";
  const podeResponder = podeResponderSetor(eu, setor);
  // Quem atende vê fila, WhatsApp e telefone; médicos, enfermagem e faturamento usam só a conversa interna
  const atende = !!central?.atende && central.setor === setor && podeResponder;
  // Na aba da Orientação, médicos e admin veem as conversas para consulta
  const consulta = !atende && !!setorFixo && podeVerSetor(eu, setor);
  const veCanais = atende || consulta;
  const ferramentas = setor === "orientacao" ? "/orientacao-cirurgica/ferramentas" : "/whatsapp";
  const titulo = setor === "orientacao" ? "Orientação cirúrgica" : "Agendamento telefônico e WhatsApp";
  const [visao, setVisao] = useState<Visao>("conversas");
  const [aba, setAba] = useState<Aba>(veCanais ? "canais" : "interno");
  const [abertaId, setAbertaId] = useState<string | null>(params.get("conversa"));
  const [internaId, setInternaId] = useState<string | null>(null);
  const interno = useInternoNaoLidas(eu?.id);
  const [busca, setBusca] = useState("");
  const [soNaoRespondidos, setSoNaoRespondidos] = useState(false);
  const [diaHistorico, setDiaHistorico] = useState(isoDia(new Date()));
  const [agendar, setAgendar] = useState<Conversa | null>(null);
  const [nova, setNova] = useState(false);
  // Ferramentas abertas dentro da própria tela (pedido da dona, 24/11: antes o botão saía da tela)
  const [ferr, setFerr] = useState<"" | "pesquisa" | "modelos" | "ausencia" | "lembretes" | "rapidas">("");
  const [destaque, setDestaque] = useState<string | null>(null);
  const [avulsa, setAvulsa] = useState<Conversa | null>(null);
  const [, setTique] = useState(0);

  // Conversas abertas (fila + em atendimento) do setor da pessoa
  const lista = useCarregar(async () => ok(await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA)
    .eq("setor", setor).eq("arquivada", false)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(300)) as Conversa[], [setor]);
  // Atendimentos encerrados no dia escolhido — ou, escrevendo na busca, em TODOS os dias (pedido da dona, 25/11:
  // achar a conversa de um paciente que voltou para reclamar ou perguntar)
  const buscaTodos = busca.trim().length >= 2;
  const encerradas = useCarregar(async () => {
    if (visao !== "atendimentos") return [] as Conversa[];
    let q = supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("setor", setor).eq("arquivada", true);
    if (!buscaTodos) {
      const ini = new Date(diaHistorico + "T00:00:00"), fim = new Date(ini.getTime() + 86400000);
      q = q.gte("ultima_mensagem_em", ini.toISOString()).lt("ultima_mensagem_em", fim.toISOString());
    }
    return ok(await q.order("ultima_mensagem_em", { ascending: false }).limit(buscaTodos ? 3000 : 300)) as Conversa[];
  }, [setor, visao, diaHistorico, buscaTodos]);
  const equipe = useCarregar(async () => {
    const [p, st] = await Promise.all([
      supabase.from("profissionais").select("id, nome, funcao, orientacao_cirurgica").eq("ativo", true).not("agenda_recurso", "is", true).not("sem_acesso", "is", true).order("nome"),
      supabase.from("central_status").select("profissional_id, status"),
    ]);
    const status = new Map(((st.data ?? []) as { profissional_id: string; status: StatusCentral }[]).map((x) => [x.profissional_id, x.status]));
    return ((p.data ?? []) as { id: string; nome: string; funcao: string; orientacao_cirurgica: boolean }[])
      .filter((x) => setor === "orientacao" ? x.orientacao_cirurgica : !x.orientacao_cirurgica && ["recepcao", "admin"].includes(x.funcao))
      .map((x) => ({ ...x, status: status.get(x.id) ?? null }));
  }, [setor]);
  // Vindo da ficha do paciente (?paciente=...): abre a conversa dele; se não houver, vai às Ferramentas para começar uma
  const pacienteParam = params.get("paciente");
  useEffect(() => {
    if (!pacienteParam) return;
    void supabase.from("whatsapp_conversas").select("id").eq("setor", setor).eq("paciente_id", pacienteParam)
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]) setAbertaId(data[0].id as string);
        else navegar(`${ferramentas}?paciente=${pacienteParam}`, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteParam, setor]);
  // O vigia do número da clínica só aparece quando ele estiver ligado à API oficial
  const estadoWA = useCarregar(async () => setor === "clinica"
    ? await whatsapp<{ configurado: boolean }>("estado").catch(() => ({ configurado: false }))
    : { configurado: false }, [setor]);
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
  const comEquipe = todas.filter((c) => !!c.responsavel_id);
  const comEquipeVisivel = filtra(comEquipe);
  const minhasVisiveis = filtra(minhas).filter((c) => !soNaoRespondidos || naoRespondida(c));
  const filaVisivel = filtra(fila);
  const historico = filtra(encerradas.dados ?? []);

  // Começo da última mensagem de cada conversa visível (como no cartão do Talklogos)
  const ids = useMemo(() => [...filaVisivel, ...(consulta ? comEquipeVisivel : minhasVisiveis), ...historico].map((c) => c.id).slice(0, 80).join(","),
    [filaVisivel, minhasVisiveis, comEquipeVisivel, historico, consulta]);
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

  const aberta = [...todas, ...(encerradas.dados ?? []), ...(avulsa ? [avulsa] : [])].find((c) => c.id === abertaId) ?? null;
  const nomeDe = (id: string | null) => equipe.dados?.find((x) => x.id === id)?.nome.split(" ")[0];

  async function pegarProximo() {
    const id = await central?.pegarProximo();
    if (id) { lista.recarregar(); setInternaId(null); setAbertaId(id); }
  }

  function Cartao({ c, tipo }: { c: Conversa; tipo: "fila" | "meu" | "equipe" | "historico" }) {
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
            {tipo === "equipe" && <span className="ct-tag atendendo">{nomeDe(c.responsavel_id) ?? "Atendendo"}</span>}
            {tipo === "historico" && <span className="ct-tag cinza">✅ Encerrada{c.responsavel_id && nomeDe(c.responsavel_id) ? ` · ${nomeDe(c.responsavel_id)}` : ""}</span>}
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
        {veCanais && (
          <button className={visao === "atendimentos" ? "ativo" : ""} onClick={() => setVisao("atendimentos")} title="Conversas encerradas (ficam guardadas para sempre)">
            <span className="ct-icone">📋</span>Encerradas
          </button>
        )}
        {veCanais && podeResponder && (
          <button onClick={() => setNova(true)} title="Mandar a primeira mensagem para um paciente (ou um número)">
            <span className="ct-icone">✏️</span>Nova conversa
          </button>
        )}
        {setor === "orientacao" && (eu?.orientacao_cirurgica || eu?.funcao === "admin") && (
          <Link className="botao" to="/orientacao-cirurgica/vendas" title="Registrar cirurgias e lentes pagas (vão para o Luciano conferir)">
            <span className="ct-icone">💳</span>Vendas
          </Link>
        )}
        {veCanais && (
          <button className={visao === "ferramentas" ? "ativo" : ""} onClick={() => setVisao("ferramentas")}
            title={setor === "orientacao" ? "Pesquisar mensagens, modelos, fora do horário e importar conversas" : "Lembretes de consulta, modelos, fora do horário, pesquisar e importar conversas"}>
            <span className="ct-icone">🧰</span>Ferramentas
          </button>
        )}
      </nav>

      {/* ---------- Coluna do meio ---------- */}
      <section className="ct-coluna">
        <div className="ct-topo">
          {atende && <SeletorStatus />}
          <input className="ct-busca" placeholder="🔍 Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {/* Vigia: só no número da orientação, o único ligado à API por enquanto */}
        {veCanais && (setor === "orientacao" || estadoWA.dados?.configurado) && <VigiaWhatsApp setor={setor} />}
        {visao === "conversas" ? (
          <>
            {veCanais && <Equipe pessoas={equipe.dados ?? []} euId={eu?.id} livres={livres.length} />}
            <div className="ct-abas">
              <button className={aba === "interno" ? "ativa" : ""} onClick={() => setAba("interno")}>
                Interno {interno.total > 0 && <span className="ct-bolha verde" style={{ background: "#d92d20" }}>{interno.total}</span>}
              </button>
              {veCanais && (
                <button className={aba === "canais" ? "ativa" : ""} onClick={() => setAba("canais")}>
                  Canais {fila.length + (consulta ? comEquipe.length : minhas.length) > 0 && <span className="ct-bolha verde">{fila.length + (consulta ? comEquipe.length : minhas.length)}</span>}
                </button>
              )}
              {atende && <button className={aba === "telefone" ? "ativa" : ""} onClick={() => setAba("telefone")}>Telefone</button>}
            </div>

            {aba === "interno" ? (
              <InternoLista busca={busca} abertaId={internaId} naoLidas={interno.porConversa} aoAbrir={(id) => setInternaId(id)} />
            ) : aba === "canais" && consulta ? (
              <div className="ct-rolagem">
                <div className="ct-aviso-tel">{podeResponder
                  ? <>🔑 Você é da administração: acompanha todas as conversas e pode responder, mas não entra na fila.</>
                  : <>👀 Só para consulta: quem responde por este número é a equipe da {titulo}.</>}</div>
                <h3 className="ct-secao">Fila de espera ({fila.length})</h3>
                {filaVisivel.length === 0 ? <div className="ct-vazio">Ninguém esperando.</div>
                  : filaVisivel.map((c) => <Cartao key={c.id} c={c} tipo="fila" />)}
                <h3 className="ct-secao">Em atendimento ({comEquipe.length})</h3>
                {lista.carregando && !lista.dados ? <Carregando /> : comEquipeVisivel.length === 0
                  ? <div className="ct-vazio">Nenhuma conversa em atendimento.</div>
                  : comEquipeVisivel.map((c) => <Cartao key={c.id} c={c} tipo="equipe" />)}
              </div>
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
              <PainelTelefone setor={setor} aoAbrirConversa={(id) => { setInternaId(null); setAbertaId(id); }} />
            )}
          </>
        ) : visao === "ferramentas" ? (
          <div className="ct-rolagem ct-ferramentas">
            <h3 className="ct-secao">Ferramentas</h3>
            <button onClick={() => setFerr("pesquisa")}>🔎 Pesquisar mensagens<span className="pequeno muted">O que foi dito, inclusive nos áudios</span></button>
            <button onClick={() => setFerr("rapidas")}>⚡ Respostas rápidas<span className="pequeno muted">Mensagens prontas do dia a dia (digite / na conversa)</span></button>
            <button onClick={() => setFerr("modelos")}>📝 Modelos de mensagem<span className="pequeno muted">Mensagens aprovadas pela Meta</span></button>
            {(podeResponder || eu?.funcao === "admin") && (
              <button onClick={() => setFerr("ausencia")}>🌙 Fora do horário<span className="pequeno muted">Resposta automática fora do expediente</span></button>
            )}
            {setor === "clinica" && (eu?.funcao === "recepcao" || eu?.funcao === "admin") && (
              <button onClick={() => setFerr("lembretes")}>📨 Lembretes de consulta<span className="pequeno muted">Avisar os pacientes do dia</span></button>
            )}
            {(podeResponder || eu?.funcao === "admin") && (
              <Link className="botao" to={`/whatsapp/importar?setor=${setor}`}>📥 Importar conversas antigas<span className="pequeno muted">Abre outra tela</span></Link>
            )}
            <Link className="botao" to={ferramentas}>🗂️ Ver todas as conversas (tela antiga)<span className="pequeno muted">Abre outra tela, com arquivadas</span></Link>
          </div>
        ) : (
          <div className="ct-rolagem">
            <h3 className="ct-secao">Conversas encerradas</h3>
            <div className="pequeno muted" style={{ margin: "0 0 8px" }}>
              Encerrar não apaga nada: a conversa sai da lista de atendimento e fica guardada aqui. Se o paciente escrever de
              novo, ela volta para a fila.
            </div>
            {buscaTodos ? (
              <div className="ct-aviso-tel">🔍 Procurando “{busca.trim()}” em <b>todos os dias</b> (nome ou telefone). Apague a busca para ver por dia.</div>
            ) : (
              <>
                <label className="ct-campo">Dia
                  <input type="date" value={diaHistorico} onChange={(e) => setDiaHistorico(e.target.value)} />
                </label>
                <div className="pequeno muted" style={{ margin: "0 0 8px" }}>
                  Para achar um paciente de qualquer dia, escreva o nome ou o telefone na busca (🔍 lá em cima).
                  Para achar o que foi dito, use 🧰 Ferramentas → 🔎 Pesquisar mensagens.
                </div>
              </>
            )}
            {encerradas.carregando && !encerradas.dados ? <Carregando /> : historico.length === 0
              ? <div className="ct-vazio">{buscaTodos ? "Nenhuma conversa encerrada com esse nome ou telefone." : "Nenhum atendimento encerrado neste dia."}</div>
              : historico.map((c) => <Cartao key={c.id} c={c} tipo="historico" />)}
          </div>
        )}
      </section>

      {/* ---------- Conversa ---------- */}
      <section className="ct-conversa wa-chat painel">
        {internaId ? (
          <InternoChat key={internaId} conversaId={internaId} aoVoltar={() => setInternaId(null)} />
        ) : aberta ? (
          <Chat key={aberta.id} conversa={aberta} podeResponder={podeResponder} destaque={destaque} quemResponde="" central={{ aoAgendar: () => setAgendar(aberta) }}
            aoMudar={() => { lista.recarregar(); encerradas.recarregar(); }} aoVoltar={() => setAbertaId(null)} />
        ) : (
          <div className="ct-boas-vindas">
            <div className="ct-boas-icone">💬</div>
            <h2>{titulo}</h2>
            {atende ? (
              <>
                <p>{fila.length > 0 ? `${fila.length} paciente${fila.length > 1 ? "s" : ""} esperando na fila.` : "Ninguém esperando agora."}</p>
                <p className="muted">Escolha uma conversa ao lado ou clique em <b>Pegar o próximo</b>.</p>
              </>
            ) : consulta ? (
              <p className="muted">Escolha uma conversa ao lado para acompanhar. Para pesquisar o que foi dito, use <b>🧰 Ferramentas</b>.</p>
            ) : <p className="muted">Converse com a equipe pela aba <b>Interno</b>.</p>}
          </div>
        )}
      </section>

      {aberta && !internaId && <FichaPaciente key={aberta.id} conversa={aberta} />}

      {ferr === "pesquisa" && (
        <Pesquisa setor={setor} aoFechar={() => setFerr("")}
          aoEscolher={async (conversaId, mensagemId) => {
            setFerr("");
            if (![...todas, ...(encerradas.dados ?? [])].some((c) => c.id === conversaId)) {
              const { data } = await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("id", conversaId).maybeSingle();
              setAvulsa((data as Conversa) ?? null);
            }
            setInternaId(null); setDestaque(mensagemId); setAbertaId(conversaId);
          }} />
      )}
      {ferr === "rapidas" && <RespostasRapidas setor={setor} aoFechar={() => setFerr("")} />}
      {ferr === "modelos" && <Modelos setor={setor} aoFechar={() => setFerr("")} />}
      {ferr === "ausencia" && <ForaDoHorario setor={setor} aoFechar={() => setFerr("")} />}
      {ferr === "lembretes" && <Lembretes aoFechar={() => setFerr("")} aoEnviar={() => lista.recarregar()} />}

      {nova && (
        <NovaConversa setor={setor} aoFechar={() => setNova(false)}
          aoAbrir={async (id) => {
            setNova(false);
            // Quem começou a conversa fica responsável por ela
            if (eu) await supabase.from("whatsapp_conversas").update({ responsavel_id: eu.id }).eq("id", id);
            lista.recarregar(); setInternaId(null); setAbertaId(id);
          }} />
      )}

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

/** Aba Telefone: ligações perdidas, atendidas e feitas (histórico dentro da Central) + aviso enquanto a Telecall não liga */
interface LigacaoCt {
  id: string; direcao: "entrada" | "saida"; numero: string; paciente_id: string | null; situacao: string;
  ramal: string | null; iniciada_em: string; atendida_em: string | null; encerrada_em: string | null;
  transferida_para: string | null; retornada_em: string | null; observacao: string | null;
  pacientes: { id: string; nome: string; nome_social: string | null; numero_prontuario: number } | null;
  quem: { nome: string } | null;
}
const SITUACAO_LIG: Record<string, { rotulo: string; classe: string }> = {
  tocando: { rotulo: "Tocando", classe: "espera" }, em_andamento: { rotulo: "Em ligação", classe: "atendendo" },
  atendida: { rotulo: "Atendida", classe: "atendendo" }, perdida: { rotulo: "Perdida", classe: "nao-resp" },
  nao_atendida: { rotulo: "Não atendeu", classe: "espera" }, falhou: { rotulo: "Falhou", classe: "cinza" },
};

function PainelTelefone({ setor, aoAbrirConversa }: { setor: string; aoAbrirConversa: (id: string) => void }) {
  const tel = useTelefone();
  const pronto = tel && (tel.estado === "pronto" || tel.estado === "pausa");
  const [filtro, setFiltro] = useState<"perdidas" | "hoje" | "semana">("perdidas");
  const [aviso, setAviso] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const lista = useCarregar(async () => {
    let q = supabase.from("ligacoes")
      .select("*, pacientes(id, nome, nome_social, numero_prontuario), quem:profissionais!ligacoes_profissional_id_fkey(nome)")
      .order("iniciada_em", { ascending: false }).limit(200);
    const desde = (dias: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dias); return d.toISOString(); };
    if (filtro === "perdidas") q = q.eq("situacao", "perdida").is("retornada_em", null).gte("iniciada_em", desde(30));
    else q = q.gte("iniciada_em", desde(filtro === "hoje" ? 0 : 7));
    return ok(await q) as unknown as LigacaoCt[];
  }, [filtro]);
  const perdidas = useCarregar(async () => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    const { count } = await supabase.from("ligacoes").select("id", { count: "exact", head: true }).eq("situacao", "perdida").is("retornada_em", null).gte("iniciada_em", d.toISOString());
    return count ?? 0;
  }, [filtro]);
  useEffect(() => {
    const canal = supabase.channel("central-ligacoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ligacoes" }, () => { lista.recarregar(); perdidas.recarregar(); })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolvida(id: string) {
    await supabase.rpc("telefonia_marcar_retornada", { p_id: id });
    lista.recarregar(); perdidas.recarregar();
  }
  async function abrirConversa(l: LigacaoCt) {
    setAviso("");
    const fim = l.numero.replace(/\D/g, "").slice(-8);
    let q = supabase.from("whatsapp_conversas").select("id").eq("setor", setor).order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(1);
    q = l.paciente_id ? q.or(`paciente_id.eq.${l.paciente_id},telefone.like.*${fim}`) : q.like("telefone", `%${fim}`);
    const { data } = await q;
    if (data?.[0]) aoAbrirConversa(data[0].id as string);
    else setAviso("Este paciente ainda não tem conversa pelo WhatsApp.");
  }
  const dur = (l: LigacaoCt) => {
    if (!l.atendida_em || !l.encerrada_em) return "";
    const seg = Math.max(0, Math.round((new Date(l.encerrada_em).getTime() - new Date(l.atendida_em).getTime()) / 1000));
    return `${Math.floor(seg / 60)}min ${String(seg % 60).padStart(2, "0")}s`;
  };

  return (
    <div className="ct-rolagem">
      {!pronto && (
        <div className="ct-aviso-tel">📞 O telefone começa a tocar nesta tela assim que a <b>Telecall</b> liberar os ramais. As ligações aparecem aqui embaixo.</div>
      )}
      {pronto && <div className="ct-aviso-tel ok">✅ Telefone conectado (ramal {tel!.ramal}).</div>}
      <h3 className="ct-secao">Ligações</h3>
      <div className="ct-filtro">
        <button className={filtro === "perdidas" ? "ativo" : ""} onClick={() => setFiltro("perdidas")}>Perdidas sem retorno ({perdidas.dados ?? 0})</button>
        <button className={filtro === "hoje" ? "ativo" : ""} onClick={() => setFiltro("hoje")}>Hoje</button>
        <button className={filtro === "semana" ? "ativo" : ""} onClick={() => setFiltro("semana")}>7 dias</button>
      </div>
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
      <Aviso>{lista.erro}</Aviso>
      {lista.carregando && !lista.dados ? <Carregando /> : (lista.dados ?? []).length === 0 ? (
        <div className="ct-vazio">{filtro === "perdidas" ? "Nenhuma ligação perdida esperando retorno. 👏" : "Nenhuma ligação neste período."}</div>
      ) : (lista.dados ?? []).map((l) => {
        const st = SITUACAO_LIG[l.situacao] ?? { rotulo: l.situacao, classe: "cinza" };
        const nome = l.pacientes ? (l.pacientes.nome_social || l.pacientes.nome) : fmtNumeroTel(l.numero);
        const expandida = aberta === l.id;
        return (
          <div key={l.id} className={"ct-cartao ct-lig" + (expandida ? " ativo" : "")} onClick={() => setAberta(expandida ? null : l.id)}>
            <span className="ct-avatar" style={{ background: l.situacao === "perdida" ? "#d92d20" : l.direcao === "entrada" ? "#12b76a" : "#175cd3" }}>
              {l.direcao === "entrada" ? "↙" : "↗"}
            </span>
            <span className="ct-cartao-corpo">
              <span className="ct-linha"><b className="ct-nome-cartao">{nome}</b><span className="ct-hora">{quando(l.iniciada_em)}</span></span>
              <span className="ct-origem" style={{ color: "var(--suave)" }}>
                {l.direcao === "entrada" ? "Recebida" : "Feita"}{l.pacientes ? ` · ${fmtNumeroTel(l.numero)} · Pront. ${l.pacientes.numero_prontuario}` : ""}
              </span>
              <span className="ct-linha">
                <span className="ct-previa">{l.quem?.nome ? `${l.quem.nome.split(" ")[0]}${dur(l) ? " · " + dur(l) : ""}` : dur(l)}{l.transferida_para ? ` · ↪ ${l.transferida_para}` : ""}</span>
                <span className={"ct-tag " + st.classe}>{st.rotulo}{l.retornada_em ? " · retornada" : ""}</span>
              </span>
              {l.observacao && <span className="ct-previa dele">📝 {l.observacao}</span>}
              {expandida && (
                <span className="ct-lig-acoes" onClick={(e) => e.stopPropagation()}>
                  {pronto ? <BotaoLigar numero={l.numero} pacienteId={l.paciente_id} rotulo="📞 Ligar de volta" />
                    : <span className="pequeno">📞 {fmtNumeroTel(l.numero)}</span>}
                  {l.situacao === "perdida" && !l.retornada_em && <button className="mini" onClick={() => void resolvida(l.id)}>✓ Resolvida</button>}
                  <button className="mini" onClick={() => void abrirConversa(l)}>💬 Conversa</button>
                  <button className="mini" disabled title="A gravação aparece aqui quando a Telecall estiver ligada e gravando">🎧 Ouvir</button>
                  {l.paciente_id && <Link className="botao mini-l" to={`/pacientes/${l.paciente_id}`}>Ficha</Link>}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Começar uma conversa nova (pedido da dona, 24/11/2026). Pela regra da Meta, a primeira mensagem para quem não
 * escreveu nas últimas 24 h tem de ser um modelo aprovado; depois que o paciente responde, a conversa fica livre.
 */
const MODELOS_NOVA: Record<SetorWA, { finalidade: string; rotulo: string }[]> = {
  clinica: [{ finalidade: "retomar_conversa", rotulo: "Pedir para o paciente responder" }],
  orientacao: [
    { finalidade: "retomar_orientacao", rotulo: "Acompanhamento da orientação (pede para o paciente responder)" },
    { finalidade: "aviso_novo_numero_orientacao", rotulo: "Aviso do número novo da Orientação Cirúrgica" },
  ],
};

export function NovaConversa({ setor, aoFechar, aoAbrir, pacienteInicial }: {
  setor: SetorWA; aoFechar: () => void; aoAbrir: (id: string) => void; pacienteInicial?: PacienteResumo;
}) {
  const [paciente, setPaciente] = useState<PacienteResumo | null>(pacienteInicial ?? null);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [finalidade, setFinalidade] = useState(MODELOS_NOVA[setor][0].finalidade);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const modelos = useCarregar(async () => ok(await supabase.from("whatsapp_modelos").select("finalidade, corpo, ativo")
    .in("finalidade", MODELOS_NOVA[setor].map((m) => m.finalidade))) as { finalidade: string; corpo: string; ativo: boolean }[], [setor]);
  const escolhido = modelos.dados?.find((m) => m.finalidade === finalidade);
  const primeiroNome = (paciente ? (paciente.nome_social || paciente.nome) : nome).trim().split(/\s+/)[0] ?? "";
  const nomeBonito = primeiroNome ? primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase() : "tudo bem";
  const previa = escolhido?.corpo.replace("{{1}}", nomeBonito) ?? "";
  const digitos = telefone.replace(/\D/g, "");
  const temNumero = paciente ? !!(digitos || paciente.telefone) : digitos.length >= 10;

  async function enviar() {
    setErro("");
    setEnviando(true);
    try {
      const r = await whatsapp<{ conversa_id: string }>("retomar", {
        setor, finalidade, paciente_id: paciente?.id ?? null,
        telefone: digitos || null, nome: paciente ? null : nome.trim() || null,
      });
      aoAbrir(r.conversa_id);
    } catch (e) {
      setErro(msgErro(e));
    }
    setEnviando(false);
  }

  return (
    <Modal titulo="✏️ Nova conversa" aoFechar={aoFechar}
      rodape={<>
        <button onClick={aoFechar}>Cancelar</button>
        <button className="primario" disabled={enviando || !temNumero || !escolhido?.ativo} onClick={() => void enviar()}>
          {enviando ? "Enviando…" : "Enviar a primeira mensagem"}
        </button>
      </>}>
      <p className="pequeno muted" style={{ marginTop: 0 }}>
        Pela regra do WhatsApp, a primeira mensagem tem de ser um <b>modelo aprovado pela Meta</b>. Quando o paciente
        responder, a conversa fica livre para escrever, mandar áudio, foto e documento.
      </p>
      <label>Paciente
        {paciente ? (
          <div className="linha">
            <b>{paciente.nome_social || paciente.nome}</b>
            <span className="muted pequeno">Pront. {paciente.numero_prontuario}{paciente.telefone ? ` · ${paciente.telefone}` : " · sem telefone no cadastro"}</span>
            <button className="mini" onClick={() => setPaciente(null)}>Trocar</button>
          </div>
        ) : <BuscaPaciente autoFocus aoEscolher={setPaciente} placeholder="Nome, CPF, telefone ou nº do prontuário…" />}
      </label>
      <label>{paciente ? "Outro celular (deixe vazio para usar o do cadastro)" : "…ou só o celular, com DDD"}
        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(21) 99999-9999" inputMode="tel" />
      </label>
      {!paciente && (
        <label>Nome da pessoa (opcional)
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como aparece na conversa" />
        </label>
      )}
      <label>Mensagem
        <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)}>
          {MODELOS_NOVA[setor].map((m) => {
            const ativo = modelos.dados?.find((x) => x.finalidade === m.finalidade)?.ativo;
            return <option key={m.finalidade} value={m.finalidade} disabled={!ativo}>{m.rotulo}{ativo ? "" : " (aguardando aprovação da Meta)"}</option>;
          })}
        </select>
      </label>
      {previa && <div className="aviso info" style={{ whiteSpace: "pre-wrap" }}>{previa}</div>}
      {escolhido && !escolhido.ativo && <Aviso tipo="alerta">Este modelo ainda não foi aprovado/ligado.</Aviso>}
      <p className="pequeno muted">A Meta cobra alguns centavos por esta mensagem.</p>
      {erro && <Aviso>{erro}</Aviso>}
    </Modal>
  );
}
