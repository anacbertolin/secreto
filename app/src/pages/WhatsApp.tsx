import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Modal, Campo, Etiqueta, BuscaPaciente } from "../components/ui";
import { STATUS_AGENDA, TIPOS_AGENDA, fmtData, fmtDataHora, fmtHora, idade, isoDia, nomeExibicao, somaDias } from "../lib/util";
import {
  SELECT_CONVERSA, baixarMidia, fmtNumeroWA, janelaAberta, whatsapp, tocarAviso, type Conversa, type Mensagem, type ModeloWA,
} from "../lib/whatsapp";

const ICONE_SITUACAO: Record<string, string> = { enviada: "✓", entregue: "✓✓", lida: "✓✓", falhou: "⚠️" };
const ICONE_TIPO: Record<string, string> = {
  imagem: "📷 Foto", audio: "🎤 Áudio", video: "🎬 Vídeo", documento: "📄 Documento", figurinha: "🙂 Figurinha",
  localizacao: "📍 Localização", contato: "👤 Contato",
};

function nomeConversa(c: Conversa): string {
  if (c.pacientes) return nomeExibicao(c.pacientes);
  return c.nome_contato || fmtNumeroWA(c.telefone);
}

export default function WhatsApp() {
  const { pode, eu } = useAuth();
  const [params, setParams] = useSearchParams();
  const [quem, setQuem] = useState<"todas" | "minhas" | "livres">("todas");
  const [abertaId, setAbertaId] = useState<string | null>(params.get("conversa"));
  const [filtro, setFiltro] = useState("");
  const [arquivadas, setArquivadas] = useState(false);
  const [lembretes, setLembretes] = useState(false);
  const [modelos, setModelos] = useState(false);
  const [erro, setErro] = useState("");

  const equipe = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome")) as { id: string; nome: string }[], []);
  const estado = useCarregar(() => whatsapp<{ configurado: boolean; recebimento: boolean }>("estado"), []);
  const lista = useCarregar(async () => {
    return ok(await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("arquivada", arquivadas)
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(300)) as Conversa[];
  }, [arquivadas]);

  // Atualiza ao vivo (Realtime) e, por garantia, a cada 10 segundos
  useEffect(() => {
    let espera: number | undefined;
    const agendar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => lista.recarregar(), 300);
    };
    const canal = supabase
      .channel("wa-lista")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversas" }, agendar)
      .subscribe();
    const t = setInterval(() => lista.recarregar(), 10000);
    return () => {
      clearInterval(t);
      window.clearTimeout(espera);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivadas]);

  // Vindo da ficha do paciente (?paciente=...): abre a conversa dele ou oferece começar uma
  const pacienteParam = params.get("paciente");
  const [semConversa, setSemConversa] = useState<string | null>(null);
  useEffect(() => {
    if (!pacienteParam) return;
    supabase.from("whatsapp_conversas").select("id").eq("paciente_id", pacienteParam)
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]) setAbertaId(data[0].id);
        else setSemConversa(pacienteParam);
      });
  }, [pacienteParam]);

  const todas = lista.dados ?? [];
  const f = filtro.trim().toLowerCase();
  const visiveis = todas
    .filter((c) => quem === "todas" || (quem === "minhas" ? c.responsavel_id === eu?.id : !c.responsavel_id))
    .filter((c) => !f || nomeConversa(c).toLowerCase().includes(f) || c.telefone.includes(f.replace(/\D/g, "") || "§"));
  const naoLidasDe = (lista: Conversa[]) => lista.filter((c) => c.nao_lidas > 0).length;
  const contagem = {
    todas: naoLidasDe(todas),
    minhas: naoLidasDe(todas.filter((c) => c.responsavel_id === eu?.id)),
    livres: todas.filter((c) => !c.responsavel_id).length,
  };
  const aberta = todas.find((c) => c.id === abertaId) ?? null;

  function abrir(id: string) {
    setAbertaId(id);
    setSemConversa(null);
    setParams({}, { replace: true });
  }

  async function comecarComPaciente(pacienteId: string) {
    setErro("");
    try {
      const r = await whatsapp<{ conversa_id: string }>("retomar", { paciente_id: pacienteId });
      lista.recarregar();
      abrir(r.conversa_id);
    } catch (e) {
      setErro(msgErro(e));
    }
  }

  const configurado = estado.dados?.configurado;
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>WhatsApp</h1>
          <p className="sub" style={{ margin: 0 }}>Mensagens do número oficial da clínica</p>
        </div>
        <div className="linha">
          <AvisosComputador />
          {pode("recepcao", "admin") && <button className="primario" onClick={() => setLembretes(true)}>📨 Lembretes de consulta</button>}
          <button onClick={() => setModelos(true)}>📝 Modelos</button>
        </div>
      </div>
      <Aviso>{erro || lista.erro}</Aviso>
      {estado.dados && !configurado && (
        <Aviso tipo="alerta">
          O WhatsApp ainda não está ligado. Falta cadastrar os dados da conta da Meta (token e número) no Supabase.
          Enquanto isso, esta tela fica vazia e nada é enviado.
        </Aviso>
      )}
      {estado.dados && configurado && !estado.dados.recebimento && (
        <Aviso tipo="alerta">O envio está ligado, mas o recebimento ainda não: falta a chave secreta do aplicativo da Meta.</Aviso>
      )}
      {semConversa && pode("recepcao", "admin") && (
        <Aviso tipo="info">
          Este paciente ainda não tem conversa pelo WhatsApp.{" "}
          <button className="mini primario" onClick={() => comecarComPaciente(semConversa)}>Enviar a primeira mensagem</button>{" "}
          <span className="pequeno">(usa o modelo “retomar conversa”, aprovado pela Meta)</span>
        </Aviso>
      )}

      <div className={"wa" + (aberta ? " com-conversa" : "")}>
        <div className="wa-lista painel">
          <input placeholder="Buscar por nome ou número" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <div className="wa-filtros">
            {([["todas", "Todas"], ["minhas", "Minhas"], ["livres", "Sem responsável"]] as const).map(([k, rot]) => (
              <button key={k} className={quem === k ? "ativo" : ""} onClick={() => setQuem(k)}>
                {rot}{contagem[k] > 0 && <span className="wa-badge" style={{ marginLeft: 5 }}>{contagem[k]}</span>}
              </button>
            ))}
          </div>
          <label className="check pequeno" style={{ margin: "8px 0" }}>
            <input type="checkbox" checked={arquivadas} onChange={(e) => setArquivadas(e.target.checked)} /> Ver arquivadas
          </label>
          {lista.carregando && !lista.dados ? <Carregando /> : visiveis.length === 0 ? (
            <div className="vazio pequeno">{todas.length > 0 ? "Nenhuma conversa neste filtro." : arquivadas ? "Nenhuma conversa arquivada." : "Nenhuma conversa ainda."}</div>
          ) : visiveis.map((c) => (
            <button key={c.id} className={"wa-item" + (c.id === abertaId ? " ativo" : "")} onClick={() => abrir(c.id)}>
              <div className="linha entre" style={{ flexWrap: "nowrap" }}>
                <b className="wa-nome">{nomeConversa(c)}</b>
                <span className="muted pequeno">{c.ultima_mensagem_em ? quandoCurto(c.ultima_mensagem_em) : ""}</span>
              </div>
              <div className="linha entre" style={{ flexWrap: "nowrap" }}>
                <span className="muted pequeno">{c.pacientes ? `Pront. ${c.pacientes.numero_prontuario}` : fmtNumeroWA(c.telefone)}</span>
                {c.nao_lidas > 0 && <span className="wa-badge">{c.nao_lidas}</span>}
              </div>
              <div className="muted pequeno wa-nome">
                {c.responsavel_id ? `👤 ${c.responsavel_id === eu?.id ? "Você" : nomeCurto(equipe.dados, c.responsavel_id)}` : "Ninguém assumiu"}
              </div>
            </button>
          ))}
        </div>
        <div className="wa-chat painel">
          {aberta ? (
            <Chat key={aberta.id} conversa={aberta} aoMudar={lista.recarregar} aoVoltar={() => setAbertaId(null)} />
          ) : (
            <div className="vazio">Escolha uma conversa ao lado.</div>
          )}
        </div>
        {aberta && <FichaPaciente key={aberta.id} conversa={aberta} />}
      </div>

      {lembretes && <Lembretes aoFechar={() => setLembretes(false)} aoEnviar={lista.recarregar} />}
      {modelos && <Modelos aoFechar={() => setModelos(false)} />}
    </div>
  );
}

function nomeCurto(lista: { id: string; nome: string }[] | null, id: string | null): string {
  return lista?.find((x) => x.id === id)?.nome.split(" ")[0] ?? "outra pessoa";
}

/** Botão para ligar o aviso na tela do computador quando chega mensagem */
function AvisosComputador() {
  const suportado = typeof Notification !== "undefined";
  const [perm, setPerm] = useState(suportado ? Notification.permission : "denied");
  if (!suportado || perm !== "default") return null;
  return (
    <button onClick={async () => { setPerm(await Notification.requestPermission()); tocarAviso(); }}>
      🔔 Avisar quando chegar mensagem
    </button>
  );
}

function quandoCurto(d: string): string {
  const dt = new Date(d);
  return dt.toDateString() === new Date().toDateString() ? fmtHora(dt) : fmtData(dt).slice(0, 5);
}

// ---------------------------------------------------------------------------
function Chat(props: { conversa: Conversa; aoMudar: () => void; aoVoltar: () => void }) {
  const c = props.conversa;
  const { eu, pode } = useAuth();
  // Decisão da dona (15/11): todos da equipe veem as conversas; só a recepção e a administração respondem.
  const podeResponder = pode("recepcao", "admin");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ligar, setLigar] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const msgs = useCarregar(async () =>
    ok(await supabase.from("whatsapp_mensagens").select("*").eq("conversa_id", c.id).order("quando").limit(500)) as Mensagem[],
  [c.id]);
  const equipe = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome")) as { id: string; nome: string }[], []);

  useEffect(() => {
    const canal = supabase
      .channel("wa-conversa-" + c.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensagens", filter: `conversa_id=eq.${c.id}` },
        () => msgs.recarregar())
      .subscribe();
    const t = setInterval(() => msgs.recarregar(), 10000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  // Marca como lida ao abrir / quando chegam novas (só quem responde; médico/enfermagem olhando não "some" com o aviso)
  useEffect(() => {
    if (c.nao_lidas > 0 && podeResponder) {
      supabase.from("whatsapp_conversas").update({ nao_lidas: 0 }).eq("id", c.id).then(() => props.aoMudar());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.nao_lidas]);

  const qtd = msgs.dados?.length ?? 0;
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [qtd]);

  const aberta = janelaAberta(c);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    setErro("");
    try {
      await whatsapp("texto", { conversa_id: c.id, texto: t });
      setTexto("");
      if (!c.responsavel_id && eu) mudar({ responsavel_id: eu.id }); // quem responde assume a conversa
    } catch (e) {
      setErro(msgErro(e));
    }
    setEnviando(false);
    msgs.recarregar();
    props.aoMudar();
  }

  async function retomar() {
    if (!confirm("Enviar ao paciente a mensagem-modelo pedindo para ele responder? (A Meta cobra alguns centavos por ela.)")) return;
    setEnviando(true);
    setErro("");
    try {
      await whatsapp("retomar", { conversa_id: c.id });
      if (!c.responsavel_id && eu) mudar({ responsavel_id: eu.id });
    } catch (e) {
      setErro(msgErro(e));
    }
    setEnviando(false);
    msgs.recarregar();
    props.aoMudar();
  }

  async function mudar(dados: Partial<Conversa>) {
    const { error } = await supabase.from("whatsapp_conversas").update(dados).eq("id", c.id);
    if (error) setErro(msgErro(error));
    props.aoMudar();
  }

  const nomeEquipe = (id: string | null) => equipe.dados?.find((x) => x.id === id)?.nome.split(" ")[0];
  let diaAnterior = "";

  return (
    <div className="wa-chat-corpo">
      <div className="wa-cab">
        <button className="sutil wa-voltar" onClick={props.aoVoltar}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{nomeConversa(c)}</b>
          <div className="muted pequeno">
            {fmtNumeroWA(c.telefone)}
            {c.nome_contato && c.pacientes && ` · no WhatsApp: ${c.nome_contato}`}
            {c.pacientes && <> · <Link to={`/pacientes/${c.pacientes.id}`}>ficha nº {c.pacientes.numero_prontuario}</Link></>}
            {c.pacientes?.whatsapp_autorizado === false && <> · <Etiqueta cor="vermelho">não quer mensagens</Etiqueta></>}
          </div>
        </div>
        <div className="linha">
          {!podeResponder ? null : c.responsavel_id === eu?.id ? (
            <button className="mini" title="Deixar a conversa livre para outra pessoa" onClick={() => mudar({ responsavel_id: null })}>👤 Com você · soltar</button>
          ) : (
            <button className="mini" onClick={() => eu && mudar({ responsavel_id: eu.id })}>
              {c.responsavel_id ? `👤 Com ${nomeEquipe(c.responsavel_id) ?? "outra pessoa"} · assumir` : "✋ Assumir"}
            </button>
          )}
          {podeResponder && <button className="mini" onClick={() => setLigar(true)}>{c.paciente_id ? "Trocar paciente" : "🔗 Ligar a um paciente"}</button>}
          {podeResponder && <button className="mini" onClick={() => mudar({ arquivada: !c.arquivada })}>{c.arquivada ? "Desarquivar" : "Arquivar"}</button>}
        </div>
      </div>

      {!c.paciente_id && (
        <Aviso tipo="info">Este número não foi reconhecido no cadastro (ou é de mais de um paciente). Use “Ligar a um paciente”.</Aviso>
      )}

      <div className="wa-mensagens">
        {msgs.carregando && !msgs.dados && <Carregando />}
        {(msgs.dados ?? []).map((m) => {
          const dia = fmtData(m.quando);
          const sep = dia !== diaAnterior ? ((diaAnterior = dia), <div key={"d" + m.id} className="wa-dia">{dia}</div>) : null;
          return [sep, <Balao key={m.id} m={m} quem={nomeEquipe(m.enviado_por)} />];
        })}
        <div ref={fim} />
      </div>

      <Aviso>{erro}</Aviso>
      {!podeResponder ? (
        <div className="aviso info">Só a recepção responde pelo WhatsApp. Se precisar falar com este paciente, peça à recepção.</div>
      ) : aberta ? (
        <div className="wa-escrever">
          <textarea
            value={texto}
            placeholder="Escreva a resposta… (Enter envia, Shift+Enter pula linha)"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <button className="primario" disabled={enviando || !texto.trim()} onClick={enviar}>{enviando ? "Enviando…" : "Enviar"}</button>
        </div>
      ) : (
        <div className="aviso alerta">
          Passaram mais de 24 horas desde a última mensagem do paciente. Pela regra da Meta, agora só dá para mandar
          uma mensagem-modelo aprovada. Quando o paciente responder, a conversa volta a ficar livre.{" "}
          <button className="mini" disabled={enviando || c.pacientes?.whatsapp_autorizado === false} onClick={retomar}>
            Chamar o paciente de novo
          </button>
        </div>
      )}

      {ligar && (
        <Modal titulo="Ligar a um paciente" aoFechar={() => setLigar(false)}>
          <p className="muted pequeno">Escolha de quem é este WhatsApp ({fmtNumeroWA(c.telefone)}).</p>
          <BuscaPaciente autoFocus aoEscolher={async (p) => { await mudar({ paciente_id: p.id }); setLigar(false); }} />
          {c.paciente_id && (
            <p style={{ marginTop: 16 }}>
              <button className="perigo mini" onClick={async () => { await mudar({ paciente_id: null }); setLigar(false); }}>
                Desligar do paciente atual
              </button>
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
interface PacienteFichaWA {
  id: string; nome: string; nome_social: string | null; numero_prontuario: number; data_nascimento: string | null;
  telefone: string | null; whatsapp_autorizado: boolean | null; convenios: { nome: string } | null;
}
interface ProximoAg { id: string; inicio: string; tipo: string; status: string; profissionais: { nome: string } | null }

/** Ficha resumida do paciente ao lado da conversa, com os próximos agendamentos */
function FichaPaciente({ conversa: c }: { conversa: Conversa }) {
  const dados = useCarregar(async () => {
    if (!c.paciente_id) return null;
    const p = ok(await supabase.from("pacientes")
      .select("id, nome, nome_social, numero_prontuario, data_nascimento, telefone, whatsapp_autorizado, convenios(nome)")
      .eq("id", c.paciente_id).maybeSingle()) as unknown as PacienteFichaWA | null;
    const ags = ok(await supabase.from("agendamentos")
      .select("id, inicio, tipo, status, profissionais(nome)")
      .eq("paciente_id", c.paciente_id)
      .gte("inicio", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
      .not("status", "in", "(cancelado,faltou)")
      .order("inicio").limit(4)) as unknown as ProximoAg[];
    return { p, ags };
  }, [c.paciente_id]);

  const p = dados.dados?.p;
  return (
    <aside className="wa-ficha painel">
      <div className="muted pequeno">Paciente</div>
      {!c.paciente_id ? (
        <p className="pequeno">Conversa ainda não ligada a um paciente. Use “Ligar a um paciente” acima ou <Link to="/pacientes/novo">cadastre um novo</Link>.</p>
      ) : dados.carregando && !p ? <Carregando /> : p ? (
        <>
          <h3 style={{ margin: "2px 0 8px" }}>{nomeExibicao(p)}</h3>
          <dl>
            <dt>Prontuário</dt><dd>{p.numero_prontuario}</dd>
            {p.data_nascimento && (<><dt>Nascimento</dt><dd>{fmtData(p.data_nascimento)} ({idade(p.data_nascimento)})</dd></>)}
            <dt>Convênio</dt><dd>{p.convenios?.nome ?? "Particular"}</dd>
            <dt>WhatsApp</dt>
            <dd>
              {p.whatsapp_autorizado === true && <Etiqueta cor="verde">Aceita mensagens</Etiqueta>}
              {p.whatsapp_autorizado === false && <Etiqueta cor="vermelho">Não quer</Etiqueta>}
              {p.whatsapp_autorizado == null && <Etiqueta cor="cinza">Não perguntado</Etiqueta>}
            </dd>
          </dl>
          <h4 style={{ margin: "16px 0 6px" }}>Próximos agendamentos</h4>
          {dados.dados?.ags.length === 0 && <div className="muted pequeno">Nenhum agendamento futuro.</div>}
          {dados.dados?.ags.map((a) => (
            <div key={a.id} className="wa-ag">
              <b>{fmtDataHora(a.inicio)}</b>
              <span className="pequeno">{TIPOS_AGENDA[a.tipo] ?? a.tipo}{a.profissionais && ` · ${a.profissionais.nome}`}</span>
              <Etiqueta cor={STATUS_AGENDA[a.status]?.cor ?? "cinza"}>{STATUS_AGENDA[a.status]?.rotulo ?? a.status}</Etiqueta>
            </div>
          ))}
          <div className="linha" style={{ gap: 6, marginTop: 14 }}>
            <Link className="botao mini" to={`/pacientes/${p.id}`}>Abrir ficha</Link>
            <Link className="botao mini" to="/agenda">📅 Agenda</Link>
          </div>
        </>
      ) : <Aviso>{dados.erro}</Aviso>}
    </aside>
  );
}

function Balao({ m, quem }: { m: Mensagem; quem?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(false);

  async function ver() {
    setAbrindo(true);
    setErro("");
    try {
      const u = await baixarMidia(m.id);
      if (m.midia_tipo?.startsWith("image/") || m.midia_tipo?.startsWith("audio/") || m.midia_tipo?.startsWith("video/")) setUrl(u);
      else window.open(u, "_blank");
    } catch (e) {
      setErro(msgErro(e));
    }
    setAbrindo(false);
  }

  const enviada = m.direcao === "enviada";
  return (
    <div className={"wa-balao " + (enviada ? "enviada" : "recebida") + (m.situacao === "falhou" ? " falhou" : "")}>
      {m.tipo === "modelo" && <div className="wa-rotulo">Mensagem-modelo{m.agendamento_id ? " · lembrete" : ""}</div>}
      {m.tipo === "botao" && <div className="wa-rotulo">Tocou no botão</div>}
      {m.midia_id && (
        <div style={{ marginBottom: 4 }}>
          {url ? (
            m.midia_tipo?.startsWith("image/") ? <img src={url} alt="Imagem enviada pelo paciente" className="wa-midia" />
              : m.midia_tipo?.startsWith("audio/") ? <audio controls src={url} />
              : <video controls src={url} className="wa-midia" />
          ) : (
            <button className="mini" disabled={abrindo} onClick={ver}>
              {ICONE_TIPO[m.tipo] ?? "Arquivo"}{m.midia_nome ? `: ${m.midia_nome}` : ""} — {abrindo ? "abrindo…" : "ver"}
            </button>
          )}
          {erro && <div className="pequeno" style={{ color: "var(--perigo)" }}>{erro}</div>}
        </div>
      )}
      {!m.midia_id && ICONE_TIPO[m.tipo] && <div className="wa-rotulo">{ICONE_TIPO[m.tipo]}</div>}
      {m.texto && <div className="wa-texto">{m.texto}</div>}
      <div className="wa-rodape">
        {enviada && quem && <span>{quem} · </span>}
        {fmtHora(m.quando)}
        {enviada && <span className={"wa-sit " + m.situacao} title={m.situacao}> {ICONE_SITUACAO[m.situacao] ?? ""}</span>}
      </div>
      {m.situacao === "falhou" && m.erro && <div className="pequeno" style={{ color: "var(--perigo)" }}>Não enviada: {m.erro}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
interface ResumoLembretes {
  total: number; enviados: number; ja_enviados: number; sem_autorizacao: number; nao_perguntado: number;
  sem_celular: number; falhas: string[]; a_enviar?: number;
}

function Lembretes(props: { aoFechar: () => void; aoEnviar: () => void }) {
  const [data, setData] = useState(isoDia(somaDias(new Date(), 1)));
  const [previa, setPrevia] = useState<ResumoLembretes | null>(null);
  const [resultado, setResultado] = useState<ResumoLembretes | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setPrevia(null);
    setResultado(null);
    setErro("");
    whatsapp<ResumoLembretes>("lembretes", { data, simular: true }).then(setPrevia).catch((e) => setErro(msgErro(e)));
  }, [data]);

  async function enviar() {
    setOcupado(true);
    setErro("");
    try {
      setResultado(await whatsapp<ResumoLembretes>("lembretes", { data }));
      props.aoEnviar();
    } catch (e) {
      setErro(msgErro(e));
    }
    setOcupado(false);
  }

  return (
    <Modal titulo="Lembretes de consulta pelo WhatsApp" aoFechar={props.aoFechar} rodape={<button onClick={props.aoFechar}>Fechar</button>}>
      <p className="muted pequeno" style={{ marginTop: 0 }}>
        Envia a mensagem-modelo de lembrete, com os botões “Confirmar” e “Preciso remarcar”, para os pacientes
        <b> agendados (ainda não confirmados)</b> no dia escolhido. Quem tocar em “Confirmar” fica confirmado na agenda
        sozinho. Quem pedir para remarcar aparece aqui no WhatsApp para a recepção responder.
      </p>
      <Campo rotulo="Consultas do dia">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <Aviso>{erro}</Aviso>
      {!previa && !erro && <Carregando />}
      {previa && !resultado && (
        <div className="secao" style={{ marginTop: 14 }}>
          <ul className="lista-simples">
            <li><b>{previa.a_enviar}</b> vão receber o lembrete agora</li>
            <li>{previa.total} agendamentos ainda não confirmados neste dia</li>
            {previa.ja_enviados > 0 && <li>{previa.ja_enviados} já receberam o lembrete antes</li>}
            {previa.nao_perguntado > 0 && <li>{previa.nao_perguntado} ainda não disseram se aceitam WhatsApp (marque no cadastro do paciente)</li>}
            {previa.sem_autorizacao > 0 && <li>{previa.sem_autorizacao} não aceitam mensagens</li>}
            {previa.sem_celular > 0 && <li>{previa.sem_celular} sem celular válido no cadastro</li>}
          </ul>
          <p className="muted pequeno">Cada lembrete custa alguns centavos, cobrados pela Meta.</p>
          <button className="primario" disabled={ocupado || !previa.a_enviar} onClick={enviar}>
            {ocupado ? "Enviando…" : `Enviar ${previa.a_enviar} lembrete(s)`}
          </button>
        </div>
      )}
      {resultado && (
        <div className="secao" style={{ marginTop: 14 }}>
          <Aviso tipo="ok">{resultado.enviados} lembrete(s) enviado(s).</Aviso>
          {resultado.falhas.length > 0 && (
            <>
              <b>Não foi possível enviar para:</b>
              <ul className="lista-simples">{resultado.falhas.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
const FINALIDADES: Record<string, string> = {
  lembrete_consulta: "Lembrete de consulta (com botões Confirmar / Preciso remarcar)",
  retomar_conversa: "Retomar conversa (para escrever depois de 24 h)",
};
const PARAMETROS: Record<string, string> = { paciente: "primeiro nome do paciente", data: "dia da semana e data", hora: "horário", medico: "nome do médico", dia_semana: "dia da semana" };

function Modelos(props: { aoFechar: () => void }) {
  const { pode } = useAuth();
  const admin = pode("admin");
  const lista = useCarregar(async () => ok(await supabase.from("whatsapp_modelos").select("*").order("finalidade")) as ModeloWA[], []);
  const [erro, setErro] = useState("");

  async function salvar(m: ModeloWA, dados: Partial<ModeloWA>) {
    setErro("");
    const { error } = await supabase.from("whatsapp_modelos").update(dados).eq("id", m.id);
    if (error) setErro(msgErro(error));
    lista.recarregar();
  }

  return (
    <Modal largo titulo="Mensagens-modelo (aprovadas pela Meta)" aoFechar={props.aoFechar} rodape={<button onClick={props.aoFechar}>Fechar</button>}>
      <p className="muted pequeno" style={{ marginTop: 0 }}>
        Para a clínica <b>começar</b> uma conversa (ou escrever depois de 24 h), a Meta exige uma mensagem-modelo aprovada.
        Cadastre cada texto abaixo no WhatsApp Manager da Meta (categoria <b>Utilidade</b>, idioma Português (BR)), com o
        <b> mesmo nome</b>. Quando a Meta aprovar, {admin ? "ligue o modelo aqui" : "peça à administração para ligar o modelo aqui"}.
      </p>
      <Aviso>{erro || lista.erro}</Aviso>
      {lista.carregando && <Carregando />}
      {(lista.dados ?? []).map((m) => (
        <div key={m.id} className="secao">
          <h3>
            <span>{FINALIDADES[m.finalidade] ?? m.finalidade}</span>
            {m.ativo ? <Etiqueta cor="verde">Ligado</Etiqueta> : <Etiqueta cor="cinza">Desligado</Etiqueta>}
          </h3>
          <div className="grade g2">
            <Campo rotulo="Nome do modelo na Meta">
              <input defaultValue={m.nome} disabled={!admin} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== m.nome && salvar(m, { nome: e.target.value.trim() })} />
            </Campo>
            <Campo rotulo="Idioma"><input value={m.idioma} disabled /></Campo>
          </div>
          <p style={{ whiteSpace: "pre-wrap", background: "#f5f7f9", padding: 10, borderRadius: 8 }}>{m.corpo}</p>
          <p className="muted pequeno">
            Variáveis: {m.parametros.map((p, i) => `{{${i + 1}}} = ${PARAMETROS[p] ?? p}`).join(" · ") || "nenhuma"}
            {m.botoes && " · Botões de resposta rápida, nesta ordem: “Confirmar presença” e “Preciso remarcar”"}
          </p>
          {admin && (
            <label className="check">
              <input type="checkbox" checked={m.ativo} onChange={(e) => salvar(m, { ativo: e.target.checked })} />
              A Meta já aprovou este modelo (ligar)
            </label>
          )}
        </div>
      ))}
    </Modal>
  );
}
