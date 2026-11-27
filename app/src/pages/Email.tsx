// E-mail da clínica dentro do sistema (migração 0190). Cada endereço @cmdolhos.com.br é uma caixa;
// cada pessoa vê só as caixas dela (a administração vê todas). Lê, responde, encaminha e envia com anexos.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Aviso, Carregando, Campo, Modal, Etiqueta } from "../components/ui";
import {
  email, enviarEmail, abrirAnexo, nomeContato, emailsDe,
  type CaixaEmail, type ConversaEmail, type MensagemEmail, type Contagem, type SpamEmail,
} from "../lib/email";

type Filtro = "entrada" | "sem_resposta" | "arquivadas" | "spam";
interface Pessoa { id: string; nome: string }
interface Situacao { credenciais: boolean; conectado: boolean; conta: string | null; ultima_sinc: string | null; ultimo_erro: string | null }

const fmtQuando = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s), hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: d.getFullYear() === hoje.getFullYear() ? undefined : "2-digit" });
};
const fmtCompleto = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const semResposta = (c: ConversaEmail) => !!c.ultima_recebida_em && (!c.ultima_enviada_em || c.ultima_enviada_em < c.ultima_recebida_em);
const primeiroNome = (n: string) => n.split(/\s+/)[0];

export default function Email() {
  const { eu, pode } = useAuth();
  const [caixas, setCaixas] = useState<CaixaEmail[] | null>(null);
  const [contagem, setContagem] = useState<Record<string, Contagem>>({});
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [caixaId, setCaixaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("entrada");
  const [busca, setBusca] = useState("");
  const [conversas, setConversas] = useState<ConversaEmail[] | null>(null);
  const [aberta, setAberta] = useState<ConversaEmail | null>(null);
  const [escrever, setEscrever] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);

  async function lerCaixas() {
    const [{ data: cx, error }, { data: ct }, { data: st }] = await Promise.all([
      supabase.from("email_caixas").select("*").eq("ativo", true).order("ordem").order("nome"),
      supabase.rpc("email_contagem"),
      supabase.rpc("email_situacao"),
    ]);
    if (error) return setErro(msgErro(error));
    setCaixas((cx ?? []) as CaixaEmail[]);
    setContagem(Object.fromEntries(((ct ?? []) as Contagem[]).map((c) => [c.caixa_id, c])));
    setSituacao(st as Situacao);
    if (!caixaId && cx?.length) setCaixaId(cx[0].id);
  }
  useEffect(() => {
    lerCaixas();
    supabase.from("profissionais").select("id, nome").then(({ data }) => setPessoas((data ?? []) as Pessoa[]));
    const t = setInterval(lerCaixas, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lerConversas() {
    if (!caixaId || filtro === "spam") return;
    let q = supabase.from("email_conversas").select("*").eq("caixa_id", caixaId)
      .eq("arquivada", filtro === "arquivadas").order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(300);
    const b = busca.trim().replace(/[%,()]/g, " ");
    if (b) q = q.or(`assunto.ilike.%${b}%,contato.ilike.%${b}%,previa.ilike.%${b}%`);
    const { data, error } = await q;
    if (error) return setErro(msgErro(error));
    let lista = (data ?? []) as ConversaEmail[];
    if (filtro === "sem_resposta") lista = lista.filter(semResposta);
    setConversas(lista);
  }
  useEffect(() => {
    setConversas(null);
    lerConversas();
    const t = setInterval(lerConversas, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixaId, filtro, busca]);

  async function buscarAgora() {
    setBuscando(true); setErro("");
    try { await email("sincronizar"); await Promise.all([lerCaixas(), lerConversas()]); }
    catch (e) { setErro((e as Error).message); }
    setBuscando(false);
  }

  const nomePessoa = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "";
  const caixa = caixas?.find((c) => c.id === caixaId) ?? null;

  if (!caixas) return erro ? <Aviso>{erro}</Aviso> : <Carregando />;
  if (!caixas.length) {
    return <div className="painel vazio">Você ainda não tem nenhuma caixa de e-mail. Peça à administração para liberar.</div>;
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>E-mail</h1>
          <p className="sub" style={{ margin: 0 }}>E-mails da clínica (@cmdolhos.com.br), sem precisar abrir o Gmail.</p>
        </div>
        <div className="linha">
          <button onClick={buscarAgora} disabled={buscando || !situacao?.conectado}>{buscando ? "Buscando…" : "↻ Buscar novos"}</button>
          <button className="primario" disabled={!situacao?.conectado}
            onClick={() => setEscrever({ modo: "novo", caixa_id: caixaId ?? caixas[0].id, para: "", cc: "", assunto: "", texto: "" })}>
            ✉️ Novo e-mail
          </button>
        </div>
      </div>
      <Aviso>{erro}</Aviso>
      {situacao && !situacao.conectado && (
        <Aviso tipo="alerta">
          O e-mail ainda não foi ligado ao Google.{" "}
          {pode("admin") ? <Link to="/cadastros/email">Ligar agora em Cadastros → E-mail</Link> : "A administração precisa ligar em Cadastros → E-mail."}
        </Aviso>
      )}
      {situacao?.conectado && situacao.ultimo_erro && pode("admin") && (
        <Aviso tipo="alerta">Última busca deu erro: {situacao.ultimo_erro}</Aviso>
      )}

      <div className="email-grade" style={{ display: "grid", gridTemplateColumns: "minmax(170px, 220px) minmax(240px, 360px) 1fr", gap: 12, alignItems: "start" }}>
        {/* Caixas */}
        <div className="painel" style={{ padding: 8 }}>
          {caixas.map((c) => {
            const ct = contagem[c.id];
            return (
              <button key={c.id} className={c.id === caixaId ? "primario" : "sutil"}
                style={{ display: "flex", width: "100%", justifyContent: "space-between", marginBottom: 4, textAlign: "left" }}
                onClick={() => { setCaixaId(c.id); setAberta(null); }} title={c.endereco}>
                <span>{c.tipo === "medico" ? "🩺 " : c.tipo === "geral" ? "📁 " : "📥 "}{c.nome}</span>
                {!!ct?.nao_lidas && <b>{ct.nao_lidas}</b>}
              </button>
            );
          })}
        </div>

        {/* Lista de conversas */}
        <div className="painel" style={{ padding: 8 }}>
          {caixa && <div className="muted pequeno" style={{ marginBottom: 6 }}>{caixa.endereco}{caixa.descricao ? ` · ${caixa.descricao}` : ""}</div>}
          <div className="linha" style={{ gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {(["entrada", "sem_resposta", "arquivadas", "spam"] as Filtro[]).map((f) => (
              <button key={f} className={"mini " + (filtro === f ? "primario" : "")} onClick={() => setFiltro(f)}>
                {f === "entrada" ? "Entrada" : f === "sem_resposta" ? `Sem resposta${contagem[caixaId ?? ""]?.sem_resposta ? ` (${contagem[caixaId ?? ""].sem_resposta} há +2 dias)` : ""}` : f === "arquivadas" ? "Arquivados" : "🚫 Spam"}
              </button>
            ))}
          </div>
          {filtro === "spam" ? <ListaSpam aoMudar={() => { lerCaixas(); }} /> : <>
          <input placeholder="Procurar por assunto ou pessoa…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
          {!conversas ? <Carregando /> : conversas.length === 0 ? <p className="muted">Nenhum e-mail aqui.</p> : (
            <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {conversas.map((c) => (
                <div key={c.id} onClick={() => setAberta(c)}
                  style={{ padding: "8px 6px", borderBottom: "1px solid var(--borda, #ddd)", cursor: "pointer",
                    background: aberta?.id === c.id ? "var(--selecionado, rgba(0,120,200,.08))" : undefined }}>
                  <div className="linha entre">
                    <span style={{ fontWeight: c.nao_lida ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.nao_lida && "● "}{nomeContato(c.contato)}
                    </span>
                    <span className="muted pequeno" style={{ whiteSpace: "nowrap" }}>{fmtQuando(c.ultima_mensagem_em)}</span>
                  </div>
                  <div style={{ fontWeight: c.nao_lida ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.tem_anexo && "📎 "}{c.assunto || "(sem assunto)"}{c.qtd_mensagens > 1 && <span className="muted"> ({c.qtd_mensagens})</span>}
                  </div>
                  <div className="muted pequeno" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.previa}</div>
                  <div className="linha" style={{ gap: 4, marginTop: 2 }}>
                    {c.responsavel_id && <Etiqueta cor="azul">👤 {primeiroNome(nomePessoa(c.responsavel_id))}</Etiqueta>}
                    {semResposta(c) && c.ultima_recebida_em! < new Date(Date.now() - 2 * 864e5).toISOString() && <Etiqueta cor="amarelo">sem resposta</Etiqueta>}
                    {c.alerta === "alto" && <Etiqueta cor="vermelho">🚩 possível golpe</Etiqueta>}
                    {c.alerta === "atencao" && <Etiqueta cor="amarelo">⚠️ cuidado</Etiqueta>}
                  </div>
                </div>
              ))}
            </div>
          )}
          </>}
        </div>

        {/* Conversa aberta */}
        <div className="painel">
          {!aberta ? <p className="muted">Escolha um e-mail na lista.</p> : (
            <Conversa key={aberta.id} conversa={aberta} caixa={caixa} caixas={caixas} pessoas={pessoas} euId={eu?.id ?? null}
              conectado={!!situacao?.conectado}
              aoMudar={() => { lerConversas(); lerCaixas(); }}
              aoEscrever={setEscrever} />
          )}
        </div>
      </div>

      {escrever && (
        <Escrever r={escrever} caixas={caixas}
          aoFechar={(conversaId) => {
            setEscrever(null);
            if (conversaId) { lerConversas(); lerCaixas(); }
          }} />
      )}
    </div>
  );
}

// ---------- Uma conversa ----------
function Conversa(props: {
  conversa: ConversaEmail; caixa: CaixaEmail | null; caixas: CaixaEmail[]; pessoas: Pessoa[]; euId: string | null; conectado: boolean;
  aoMudar: () => void; aoEscrever: (r: Rascunho) => void;
}) {
  const { conversa: c, caixa, pessoas, euId } = props;
  const [msgs, setMsgs] = useState<MensagemEmail[] | null>(null);
  const [leituras, setLeituras] = useState<{ profissional_id: string; lida_em: string }[]>([]);
  const [erro, setErro] = useState("");

  async function ler() {
    const [{ data, error }, { data: l }] = await Promise.all([
      supabase.from("email_mensagens").select("id, conversa_id, direcao, de, para, cc, assunto, texto, html, anexos, quando, enviado_por, alerta")
        .eq("conversa_id", c.id).order("quando"),
      supabase.from("email_leituras").select("profissional_id, lida_em").eq("conversa_id", c.id).order("lida_em", { ascending: false }),
    ]);
    if (error) return setErro(msgErro(error));
    setMsgs((data ?? []) as MensagemEmail[]);
    setLeituras((l ?? []) as { profissional_id: string; lida_em: string }[]);
  }
  useEffect(() => {
    ler();
    supabase.rpc("email_marcar_lida", { p_conversa: c.id, p_lida: true }).then(() => props.aoMudar());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "";
  const nossos = new Set(props.caixas.map((x) => x.endereco));

  async function acao(fn: string, args: Record<string, unknown>) {
    setErro("");
    const { error } = await supabase.rpc(fn, args);
    if (error) return setErro(msgErro(error));
    props.aoMudar();
  }

  function responder(m: MensagemEmail, todos: boolean) {
    const para = m.direcao === "recebida" ? emailsDe(m.de) : emailsDe(m.para);
    const cc = todos ? [...emailsDe(m.para), ...emailsDe(m.cc)].filter((e) => !nossos.has(e) && !para.includes(e)) : [];
    const assunto = /^(re|res):/i.test(m.assunto ?? "") ? m.assunto! : `Re: ${m.assunto ?? ""}`;
    props.aoEscrever({
      modo: "responder", caixa_id: caixa?.id ?? c.caixa_id, conversa_id: c.id, responde_a: m.id,
      para: para.join(", "), cc: [...new Set(cc)].join(", "), assunto,
      texto: `\n\n\nEm ${fmtCompleto(m.quando)}, ${m.de ?? ""} escreveu:\n` + (m.texto ?? "").split("\n").map((l) => "> " + l).join("\n"),
    });
  }
  function encaminhar(m: MensagemEmail) {
    const assunto = /^(enc|fwd?):/i.test(m.assunto ?? "") ? m.assunto! : `Enc: ${m.assunto ?? ""}`;
    props.aoEscrever({
      modo: "encaminhar", caixa_id: caixa?.id ?? c.caixa_id, responde_a: m.id, para: "", cc: "", assunto,
      encaminhar_anexos: m.anexos.length > 0, anexos_originais: m.anexos.map((a) => a.nome),
      texto: `\n\n\n---------- Mensagem encaminhada ----------\nDe: ${m.de ?? ""}\nData: ${fmtCompleto(m.quando)}\nAssunto: ${m.assunto ?? ""}\nPara: ${m.para ?? ""}\n\n${m.texto ?? ""}`,
    });
  }

  const ultima = msgs?.[msgs.length - 1];
  return (
    <div>
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 6 }}>
        <h2 style={{ margin: 0 }}>{c.assunto || "(sem assunto)"}</h2>
        <div className="linha" style={{ gap: 4, flexWrap: "wrap" }}>
          {c.responsavel_id === euId
            ? <button className="mini" onClick={() => acao("email_responsavel", { p_conversa: c.id, p_profissional: null })}>Deixar de cuidar</button>
            : <button className="mini" onClick={() => acao("email_responsavel", { p_conversa: c.id, p_profissional: euId })}>🙋 Eu cuido deste</button>}
          <button className="mini" onClick={() => acao("email_marcar_lida", { p_conversa: c.id, p_lida: false })}>Marcar não lido</button>
          <button className="mini" onClick={() => acao("email_arquivar", { p_conversa: c.id, p_arquivar: !c.arquivada })}>
            {c.arquivada ? "Voltar para a entrada" : "🗄️ Arquivar"}
          </button>
          {props.conectado && <button className="mini" onClick={async () => {
            if (!confirm("Mandar este e-mail para o spam? Ele sai da caixa e o Google aprende a barrar e-mails parecidos.")) return;
            setErro("");
            try { await email("marcar_spam", { conversa_id: c.id }); props.aoMudar(); } catch (e) { setErro((e as Error).message); }
          }}>🚫 É spam</button>}
        </div>
      </div>
      <div className="muted pequeno" style={{ margin: "4px 0 10px" }}>
        {c.responsavel_id && <>Quem está cuidando: <b>{nome(c.responsavel_id)}</b> · </>}
        Lido por: {leituras.length ? leituras.map((l) => `${primeiroNome(nome(l.profissional_id))} (${fmtQuando(l.lida_em)})`).join(", ") : "ninguém ainda"}
      </div>
      <Aviso>{erro}</Aviso>
      {!msgs ? <Carregando /> : msgs.map((m) => (
        <Mensagem key={m.id} m={m} enviadoPor={nome(m.enviado_por)} aberta={m.id === ultima?.id}
          conectado={props.conectado} aoResponder={responder} aoEncaminhar={encaminhar} />
      ))}
    </div>
  );
}

function Mensagem(props: {
  m: MensagemEmail; enviadoPor: string; aberta: boolean; conectado: boolean;
  aoResponder: (m: MensagemEmail, todos: boolean) => void; aoEncaminhar: (m: MensagemEmail) => void;
}) {
  const { m } = props;
  const [aberta, setAberta] = useState(props.aberta);
  const [comImagens, setComImagens] = useState(false);
  const [verTexto, setVerTexto] = useState(!m.html);
  const [erro, setErro] = useState("");
  return (
    <div style={{ border: "1px solid var(--borda, #ddd)", borderRadius: 8, padding: 10, marginBottom: 10,
      background: m.direcao === "enviada" ? "var(--fundo-suave, rgba(0,150,80,.05))" : undefined }}>
      <div className="linha entre" style={{ cursor: "pointer" }} onClick={() => setAberta(!aberta)}>
        <div>
          <b>{nomeContato(m.de)}</b>{" "}
          {m.direcao === "enviada" && <Etiqueta cor="verde">enviado{props.enviadoPor ? ` por ${primeiroNome(props.enviadoPor)}` : ""}</Etiqueta>}
          <div className="muted pequeno">de {m.de} · para {m.para}{m.cc ? ` · cc ${m.cc}` : ""}</div>
        </div>
        <span className="muted pequeno" style={{ whiteSpace: "nowrap" }}>{fmtCompleto(m.quando)}</span>
      </div>
      {aberta && (
        <>
          <Aviso>{erro}</Aviso>
          {m.alerta?.length > 0 && (
            <Aviso tipo={m.alerta.some((a) => a.nivel === "alto") ? "erro" : "alerta"}>
              <b>{m.alerta.some((a) => a.nivel === "alto") ? "🚩 Cuidado: este e-mail pode ser golpe." : "⚠️ Atenção com este e-mail."}</b>
              <ul style={{ margin: "4px 0 4px 18px", padding: 0 }}>{m.alerta.map((a, i) => <li key={i}>{a.motivo}</li>)}</ul>
              <span className="pequeno">Pedido de pagamento, boleto ou troca de conta: <b>confirme por telefone</b>, no número que vocês já têm (nunca no que veio no e-mail).</span>
            </Aviso>
          )}
          {m.html && !verTexto ? (
            <>
              <div className="linha" style={{ gap: 6, margin: "6px 0" }}>
                {!comImagens && <button className="mini" onClick={() => setComImagens(true)}>Mostrar imagens</button>}
                <button className="mini" onClick={() => setVerTexto(true)}>Ver só o texto</button>
              </div>
              <CorpoHtml html={m.html} imagens={comImagens} />
            </>
          ) : (
            <>
              {m.html && <button className="mini" style={{ margin: "6px 0" }} onClick={() => setVerTexto(false)}>Ver formatado</button>}
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 8 }}>{m.texto}</div>
            </>
          )}
          {m.anexos.length > 0 && (
            <div className="linha" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {m.anexos.map((a, i) => (
                <button key={i} className="mini" onClick={() => abrirAnexo(m.id, i, a.nome).catch((e) => setErro((e as Error).message))}>
                  📎 {a.nome} <span className="muted">({Math.max(1, Math.round(a.tamanho / 1024))} KB)</span>
                </button>
              ))}
            </div>
          )}
          {props.conectado && (
            <div className="linha" style={{ gap: 6, marginTop: 10 }}>
              <button className="mini" onClick={() => props.aoResponder(m, false)}>↩️ Responder</button>
              <button className="mini" onClick={() => props.aoResponder(m, true)}>↩️ Responder a todos</button>
              <button className="mini" onClick={() => props.aoEncaminhar(m)}>➡️ Encaminhar</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Mostra o e-mail formatado numa moldura isolada: sem scripts e, até pedir, sem imagens de fora (proteção contra rastreio e golpes). */
function CorpoHtml({ html, imagens }: { html: string; imagens: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [altura, setAltura] = useState(300);
  const doc = useMemo(() => {
    const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src data: ${imagens ? "https: http:" : ""}; font-src data:`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank"><style>body{font-family:system-ui,sans-serif;font-size:14px;margin:0;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
  }, [html, imagens]);
  return (
    <iframe ref={ref} title="Conteúdo do e-mail" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" srcDoc={doc}
      style={{ width: "100%", height: altura, border: "1px solid var(--borda, #eee)", borderRadius: 6, background: "#fff" }}
      onLoad={() => { const h = ref.current?.contentDocument?.body?.scrollHeight; if (h) setAltura(Math.min(Math.max(h + 24, 120), 2000)); }} />
  );
}

// ---------- Escrever / responder / encaminhar ----------
interface Rascunho {
  modo: "novo" | "responder" | "encaminhar"; caixa_id: string; conversa_id?: string; responde_a?: string;
  para: string; cc: string; assunto: string; texto: string; encaminhar_anexos?: boolean; anexos_originais?: string[];
}

function Escrever({ r, caixas, aoFechar }: { r: Rascunho; caixas: CaixaEmail[]; aoFechar: (conversaId?: string) => void }) {
  const [v, setV] = useState<Rascunho>(r);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const caixa = caixas.find((c) => c.id === v.caixa_id);
  const total = arquivos.reduce((s, f) => s + f.size, 0);

  async function enviar() {
    setErro("");
    if (!emailsDe(v.para).length) return setErro("Coloque pelo menos um e-mail no campo “Para”.");
    if (!v.assunto.trim()) return setErro("Escreva o assunto.");
    if (total > 18 * 1024 * 1024) return setErro("Os anexos passam de 18 MB. Mande em mais de um e-mail.");
    setEnviando(true);
    try {
      const res = await enviarEmail({
        caixa_id: v.caixa_id, modo: v.modo, para: v.para, cc: v.cc, assunto: v.assunto, texto: v.texto,
        ...(v.conversa_id ? { conversa_id: v.conversa_id } : {}), ...(v.responde_a ? { responde_a: v.responde_a } : {}),
        ...(v.encaminhar_anexos ? { encaminhar_anexos: "1" } : {}),
      }, arquivos);
      aoFechar(res.conversa_id);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  const titulo = v.modo === "responder" ? "Responder" : v.modo === "encaminhar" ? "Encaminhar" : "Novo e-mail";
  return (
    <Modal titulo={titulo} largo aoFechar={() => !enviando && aoFechar()}
      rodape={<>
        <button onClick={() => aoFechar()} disabled={enviando}>Cancelar</button>
        <button className="primario" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button>
      </>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Enviar como">
          <select value={v.caixa_id} disabled={v.modo === "responder"} onChange={(e) => setV({ ...v, caixa_id: e.target.value })}>
            {caixas.filter((c) => c.tipo !== "geral").map((c) => <option key={c.id} value={c.id}>{c.nome} &lt;{c.endereco}&gt;</option>)}
          </select>
        </Campo>
        <Campo rotulo="Para (separe vários com vírgula)"><input value={v.para} onChange={(e) => setV({ ...v, para: e.target.value })} placeholder="nome@exemplo.com" /></Campo>
        <Campo rotulo="Cópia (cc)"><input value={v.cc} onChange={(e) => setV({ ...v, cc: e.target.value })} /></Campo>
        <Campo rotulo="Assunto"><input value={v.assunto} onChange={(e) => setV({ ...v, assunto: e.target.value })} /></Campo>
      </div>
      <Campo rotulo="Mensagem">
        <textarea rows={14} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })} autoFocus />
      </Campo>
      {caixa?.assinatura && <div className="muted pequeno" style={{ whiteSpace: "pre-wrap" }}>Assinatura colocada no final:{"\n"}--{"\n"}{caixa.assinatura}</div>}
      {v.modo === "encaminhar" && !!v.anexos_originais?.length && (
        <label className="linha" style={{ gap: 6, marginTop: 8 }}>
          <input type="checkbox" checked={!!v.encaminhar_anexos} onChange={(e) => setV({ ...v, encaminhar_anexos: e.target.checked })} />
          Levar os anexos originais ({v.anexos_originais.join(", ")})
        </label>
      )}
      <div style={{ marginTop: 10 }}>
        <label className="botao mini" style={{ cursor: "pointer" }}>
          📎 Anexar arquivos
          <input type="file" multiple hidden onChange={(e) => { setArquivos([...arquivos, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
        </label>
        {arquivos.map((f, i) => (
          <span key={i} className="etiqueta" style={{ marginLeft: 6 }}>
            {f.name} ({Math.max(1, Math.round(f.size / 1024))} KB){" "}
            <button className="sutil" onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} aria-label="Tirar">✕</button>
          </span>
        ))}
      </div>
    </Modal>
  );
}

// ---------- Spam: o que o Google segurou (últimos 30 dias, só das caixas da pessoa) ----------
function ListaSpam({ aoMudar }: { aoMudar: () => void }) {
  const [itens, setItens] = useState<SpamEmail[] | null>(null);
  const [erro, setErro] = useState("");
  const [tirando, setTirando] = useState<string | null>(null);
  async function ler() {
    setErro("");
    try { setItens((await email<{ itens: SpamEmail[] }>("spam_listar")).itens); }
    catch (e) { setErro((e as Error).message); setItens([]); }
  }
  useEffect(() => { ler(); }, []);
  async function naoESpam(id: string) {
    setTirando(id); setErro("");
    try { await email("nao_e_spam", { gmail_id: id }); setItens((l) => (l ?? []).filter((x) => x.gmail_id !== id)); aoMudar(); }
    catch (e) { setErro((e as Error).message); }
    setTirando(null);
  }
  return (
    <div>
      <p className="muted pequeno" style={{ margin: "0 0 6px" }}>
        E-mails que o Google desconfiou e segurou (últimos 30 dias). Se algum for bom, clique em <b>Não é spam</b>: ele vai para a caixa certa.
        Na dúvida, não clique em links nem abra anexos.
      </p>
      <Aviso>{erro}</Aviso>
      {!itens ? <Carregando /> : itens.length === 0 ? <p className="muted">Nada no spam. 🎉</p> : (
        <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
          {itens.map((x) => (
            <div key={x.gmail_id} style={{ padding: "8px 6px", borderBottom: "1px solid var(--borda, #ddd)" }}>
              <div className="linha entre">
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeContato(x.de)}</b>
                <span className="muted pequeno">{fmtQuando(x.quando)}</span>
              </div>
              <div className="muted pequeno">{x.de}</div>
              <div>{x.assunto || "(sem assunto)"}</div>
              <div className="muted pequeno" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.previa}</div>
              <div className="linha entre" style={{ marginTop: 4 }}>
                <span className="muted pequeno">para {x.caixas.join(", ")}</span>
                <button className="mini" disabled={tirando === x.gmail_id} onClick={() => naoESpam(x.gmail_id)}>
                  {tirando === x.gmail_id ? "Trazendo…" : "✅ Não é spam"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
