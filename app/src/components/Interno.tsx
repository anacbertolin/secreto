// Conversa interna da equipe — lista (aba "Interno" da Central) e a conversa aberta
import { useEffect, useRef, useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Modal } from "./ui";
import { FUNCOES, fmtData, isoDia, type Funcao } from "../lib/util";
import { SELECT_INTERNA, tituloInterna, type ConversaInterna, type MensagemInterna } from "../lib/interno";
import { EMOJIS, iniciais } from "../pages/WhatsApp";

interface Pessoa { id: string; nome: string; funcao: Funcao }

function hora(d: string | null): string {
  if (!d) return "";
  const x = new Date(d);
  return isoDia(x) === isoDia(new Date()) ? x.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : fmtData(d).slice(0, 5);
}

/** Lista de conversas internas + começar conversa com um colega + novo grupo */
export function InternoLista(props: { busca: string; abertaId: string | null; naoLidas: Record<string, number>; aoAbrir: (id: string) => void }) {
  const { eu } = useAuth();
  const [novaCom, setNovaCom] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState(false);
  const [erro, setErro] = useState("");
  const lista = useCarregar(async () => ok(await supabase.from("interno_conversas").select(SELECT_INTERNA)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(200)) as unknown as ConversaInterna[], []);
  useEffect(() => {
    const canal = supabase.channel("interno-lista")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "interno_mensagens" }, () => lista.recarregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrirCom(id: string) {
    setErro("");
    const { data, error } = await supabase.rpc("interno_abrir_direta", { p_outro: id });
    if (error) return setErro(msgErro(error));
    setNovaCom(false);
    lista.recarregar();
    props.aoAbrir(data as string);
  }

  const f = props.busca.trim().toLowerCase();
  const visiveis = (lista.dados ?? []).filter((c) => !f || tituloInterna(c, eu?.id).toLowerCase().includes(f));
  return (
    <div className="ct-rolagem">
      <div className="linha" style={{ gap: 6 }}>
        <button className="ct-pegar" style={{ flex: 1, padding: 9, fontSize: "0.9rem" }} onClick={() => setNovaCom(true)}>✉️ Nova conversa</button>
        <button style={{ padding: 9 }} onClick={() => setNovoGrupo(true)}>👥 Novo grupo</button>
      </div>
      <Aviso>{erro || lista.erro}</Aviso>
      <h3 className="ct-secao">Conversas da equipe</h3>
      {lista.carregando && !lista.dados ? <Carregando /> : visiveis.length === 0 ? (
        <div className="ct-vazio">Nenhuma conversa ainda. Clique em “Nova conversa” para falar com um colega.</div>
      ) : visiveis.map((c) => {
        const titulo = tituloInterna(c, eu?.id);
        const n = props.naoLidas[c.id] ?? 0;
        return (
          <button key={c.id} className={"ct-cartao" + (c.id === props.abertaId ? " ativo" : "")} onClick={() => props.aoAbrir(c.id)}>
            <span className="ct-avatar" style={{ background: c.tipo === "grupo" ? "#6941c6" : "#175cd3" }}>{c.tipo === "grupo" ? "👥" : iniciais(titulo)}</span>
            <span className="ct-cartao-corpo">
              <span className="ct-linha"><b className="ct-nome-cartao">{titulo}</b><span className="ct-hora">{hora(c.ultima_mensagem_em)}</span></span>
              <span className="ct-linha">
                <span className="ct-previa">{c.tipo === "grupo" ? `${c.participantes.length} pessoas` : FUNCOES[(c.participantes.find((p) => p.profissional_id !== eu?.id)?.profissionais?.funcao ?? "recepcao") as Funcao]}</span>
                {n > 0 && <span className="wa-badge">{n}</span>}
              </span>
            </span>
          </button>
        );
      })}
      {novaCom && <EscolherPessoas titulo="Conversar com quem?" unica aoFechar={() => setNovaCom(false)} aoConfirmar={(ids) => void abrirCom(ids[0])} />}
      {novoGrupo && (
        <EscolherPessoas titulo="Novo grupo" comNome aoFechar={() => setNovoGrupo(false)}
          aoConfirmar={async (ids, nome) => {
            const { data, error } = await supabase.rpc("interno_criar_grupo", { p_nome: nome, p_membros: ids });
            if (error) return setErro(msgErro(error));
            setNovoGrupo(false);
            lista.recarregar();
            props.aoAbrir(data as string);
          }} />
      )}
    </div>
  );
}

/** Escolher um colega (conversa a dois) ou vários (grupo) */
function EscolherPessoas(props: { titulo: string; unica?: boolean; comNome?: boolean; jaEstao?: string[]; aoFechar: () => void; aoConfirmar: (ids: string[], nome: string) => void }) {
  const { eu } = useAuth();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [filtro, setFiltro] = useState("");
  const pessoas = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome, funcao").eq("ativo", true).order("nome")) as Pessoa[], []);
  const lista = (pessoas.dados ?? []).filter((p) => p.id !== eu?.id && !(props.jaEstao ?? []).includes(p.id)
    && (!filtro.trim() || p.nome.toLowerCase().includes(filtro.trim().toLowerCase())));
  return (
    <Modal titulo={props.titulo} aoFechar={props.aoFechar}
      rodape={props.unica ? undefined : <>
        <button onClick={props.aoFechar}>Cancelar</button>
        <button className="primario" disabled={marcados.length === 0 || (props.comNome && !nome.trim())} onClick={() => props.aoConfirmar(marcados, nome.trim())}>
          {props.comNome ? "Criar grupo" : "Acrescentar"}
        </button>
      </>}>
      {props.comNome && <input autoFocus placeholder="Nome do grupo (ex.: Recepção, Médicos)" value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />}
      <input autoFocus={!props.comNome} placeholder="🔍 Buscar pessoa" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
      {!pessoas.dados ? <Carregando /> : (
        <div className="ct-transferir">
          {lista.length === 0 && <div className="muted">Ninguém encontrado.</div>}
          {lista.map((p) => (
            <button key={p.id} className={marcados.includes(p.id) ? "primario" : ""}
              onClick={() => props.unica ? props.aoConfirmar([p.id], "") : setMarcados(marcados.includes(p.id) ? marcados.filter((x) => x !== p.id) : [...marcados, p.id])}>
              <span className="ct-avatar pequeno">{iniciais(p.nome)}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{p.nome}</span>
              <span className="pequeno">{FUNCOES[p.funcao]}{!props.unica && marcados.includes(p.id) && " ✓"}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** A conversa interna aberta */
export function InternoChat(props: { conversaId: string; aoVoltar: () => void }) {
  const { eu } = useAuth();
  const [texto, setTexto] = useState("");
  const [emojis, setEmojis] = useState(false);
  const caixaInt = useRef<HTMLTextAreaElement>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [acrescentar, setAcrescentar] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const conversa = useCarregar(async () => ok(await supabase.from("interno_conversas").select(SELECT_INTERNA).eq("id", props.conversaId).single()) as unknown as ConversaInterna, [props.conversaId]);
  const msgs = useCarregar(async () => (ok(await supabase.from("interno_mensagens").select("*").eq("conversa_id", props.conversaId)
    .order("criado_em", { ascending: false }).limit(300)) as MensagemInterna[]).reverse(), [props.conversaId]);

  // Ao vivo + marca como lida
  useEffect(() => {
    const marcar = () => { if (eu) void supabase.from("interno_participantes").update({ lida_em: new Date().toISOString() }).eq("conversa_id", props.conversaId).eq("profissional_id", eu.id); };
    marcar();
    const canal = supabase.channel("interno-conversa-" + props.conversaId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "interno_mensagens", filter: `conversa_id=eq.${props.conversaId}` },
        () => { msgs.recarregar(); marcar(); })
      .subscribe();
    const t = window.setInterval(() => msgs.recarregar(), 15000);
    return () => { window.clearInterval(t); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.conversaId, eu?.id]);
  const qtd = msgs.dados?.length ?? 0;
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [qtd]);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    setErro("");
    const { error } = await supabase.from("interno_mensagens").insert({ conversa_id: props.conversaId, texto: t });
    setEnviando(false);
    if (error) return setErro(msgErro(error));
    setTexto("");
    msgs.recarregar();
  }

  const c = conversa.dados;
  const nomeDe = (id: string) => c?.participantes.find((p) => p.profissional_id === id)?.profissionais?.nome.split(" ")[0] ?? "Colega";
  let diaAnterior = "";
  return (
    <div className="wa-chat-corpo">
      <div className="ct-cab">
        <button className="sutil wa-voltar" onClick={props.aoVoltar}>←</button>
        <div className="ct-avatar" style={{ background: c?.tipo === "grupo" ? "#6941c6" : "#175cd3" }}>{c ? (c.tipo === "grupo" ? "👥" : iniciais(tituloInterna(c, eu?.id))) : ""}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ct-nome"><span title="Conversa interna">🔒</span> <b>{c ? tituloInterna(c, eu?.id) : "…"}</b></div>
          <div className="ct-paciente">
            {c?.tipo === "grupo" ? c.participantes.map((p) => p.profissionais?.nome.split(" ")[0]).join(", ") : "Conversa interna da equipe · só vocês dois veem"}
          </div>
        </div>
        {c?.tipo === "grupo" && <button className="mini" onClick={() => setAcrescentar(true)}>+ Pessoas</button>}
      </div>
      <div className="wa-mensagens">
        {msgs.carregando && !msgs.dados && <Carregando />}
        {qtd === 0 && msgs.dados && <div className="ct-vazio" style={{ textAlign: "center", marginTop: 30 }}>Nenhuma mensagem ainda. Escreva abaixo.</div>}
        {(msgs.dados ?? []).map((m) => {
          const dia = fmtData(m.criado_em);
          const sep = dia !== diaAnterior ? ((diaAnterior = dia), <div key={"d" + m.id} className="wa-dia">{dia}</div>) : null;
          const minha = m.autor_id === eu?.id;
          return [sep, (
            <div key={m.id} className={"wa-balao " + (minha ? "enviada" : "recebida")}>
              {!minha && <div className="ct-autor">{nomeDe(m.autor_id)}</div>}
              <div className="wa-texto">{m.texto}</div>
              <div className="wa-rodape">{new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          )];
        })}
        <div ref={fim} />
      </div>
      <Aviso>{erro}</Aviso>
      <div className="wa-escrever">
        {/* Emojis e corretor em português, como no WhatsApp (pedido da dona, 25/11) */}
        <button className="mini" title="Emojis" onClick={() => setEmojis(!emojis)}>😊</button>
        {emojis && (
          <div className="wa-emojis" onMouseLeave={() => setEmojis(false)}>
            {EMOJIS.map((e) => <button key={e} onMouseDown={(ev) => {
              ev.preventDefault();
              const el = caixaInt.current;
              const ini = el?.selectionStart ?? texto.length, fimSel = el?.selectionEnd ?? texto.length;
              setTexto(texto.slice(0, ini) + e + texto.slice(fimSel));
              window.setTimeout(() => { el?.focus(); el?.setSelectionRange(ini + e.length, ini + e.length); }, 0);
            }}>{e}</button>)}
          </div>
        )}
        <textarea ref={caixaInt} spellCheck lang="pt-BR" autoCapitalize="sentences"
          value={texto} placeholder="Mensagem para a equipe… (Enter envia, Shift+Enter pula linha)"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }} />
        <button className="primario" disabled={enviando || !texto.trim()} onClick={() => void enviar()}>Enviar</button>
      </div>
      {acrescentar && c && (
        <EscolherPessoas titulo="Acrescentar pessoas ao grupo" jaEstao={c.participantes.map((p) => p.profissional_id)} aoFechar={() => setAcrescentar(false)}
          aoConfirmar={async (ids) => {
            const { error } = await supabase.rpc("interno_adicionar", { p_conversa: c.id, p_membros: ids });
            if (error) return setErro(msgErro(error));
            setAcrescentar(false);
            conversa.recarregar();
          }} />
      )}
    </div>
  );
}
