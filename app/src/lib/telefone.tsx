// Telefone dentro do sistema (migração 0050): o navegador vira um ramal da central (Api4Com ou outra
// que aceite ramal pelo navegador — SIP por WebSocket seguro / WebRTC).
// A senha do ramal vem do banco só para a própria pessoa (telefonia_minhas_credenciais).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { UA, WebSocketInterface } from "jssip";
import type { RTCSession } from "jssip/lib/RTCSession";
import type { RTCSessionEvent } from "jssip/lib/UA";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { notificarComputador } from "./whatsapp";

export type EstadoTelefone =
  | "carregando"
  | "sem_ramal"     // esta pessoa não tem ramal: o telefone não aparece
  | "desligado"     // a administração ainda não ligou o telefone
  | "incompleto"    // falta endereço/domínio/senha
  | "conectando"
  | "pronto"        // registrado na central: recebe e faz ligações
  | "pausa"         // a atendente pediu pausa: não recebe ligações
  | "erro";

export interface QuemLigou {
  paciente_id: string;
  nome: string;
  nome_social: string | null;
  numero_prontuario: number;
  data_nascimento: string | null;
  proximo_agendamento: string | null;
}

export interface Chamada {
  ligacaoId: string | null;
  direcao: "entrada" | "saida";
  numero: string;
  nomeNaCentral: string | null;
  fase: "tocando" | "chamando" | "em_andamento";
  atendidaEm: number | null;
  mudo: boolean;
  espera: boolean;
  pacientes: QuemLigou[];
  pacienteId: string | null;
}

interface Credenciais {
  situacao: string;
  wss_url?: string;
  dominio?: string;
  ramal?: string;
  nome?: string;
  usuario?: string;
  senha?: string;
}

interface Ctx {
  estado: EstadoTelefone;
  erro: string;
  ramal: string | null;
  chamada: Chamada | null;
  ultimaEncerrada: { ligacaoId: string; numero: string; pacienteId: string | null } | null;
  ligar: (numero: string, pacienteId?: string | null) => Promise<void>;
  atender: () => void;
  recusar: () => void;
  desligar: () => void;
  alternarMudo: () => void;
  alternarEspera: () => void;
  transferir: (destino: string) => void;
  tecla: (t: string) => void;
  pausar: (pausa: boolean) => void;
  recarregar: () => void;
  limparUltima: () => void;
}

const TelCtx = createContext<Ctx | null>(null);

/** Número como a central espera: só dígitos, sem o 55 do Brasil. */
export function numeroParaDiscar(n: string): string {
  let d = (n ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d;
}

export function fmtNumeroTel(n: string | null | undefined): string {
  const d = numeroParaDiscar(n ?? "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || "número oculto";
}

// ---------- Toque (som de chamada chegando) ----------
let ctxSom: AudioContext | null = null;
function tocarToque(): () => void {
  let parar = false;
  let timer: number | undefined;
  const tocar = () => {
    if (parar) return;
    try {
      ctxSom ??= new AudioContext();
      void ctxSom.resume();
      const t = ctxSom.currentTime;
      for (const ini of [0, 0.5]) {
        const o = ctxSom.createOscillator();
        const g = ctxSom.createGain();
        o.frequency.value = 440;
        o.type = "sine";
        g.gain.setValueAtTime(0.0001, t + ini);
        g.gain.exponentialRampToValueAtTime(0.2, t + ini + 0.03);
        g.gain.setValueAtTime(0.2, t + ini + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ini + 0.4);
        o.connect(g).connect(ctxSom.destination);
        o.start(t + ini);
        o.stop(t + ini + 0.42);
      }
    } catch {
      /* sem som */
    }
    timer = window.setTimeout(tocar, 3000);
  };
  tocar();
  return () => {
    parar = true;
    window.clearTimeout(timer);
  };
}

async function rpc<T>(nome: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) {
    console.warn("telefonia:", nome, error.message);
    return null;
  }
  return data as T;
}

export function TelefoneProvider({ children }: { children: ReactNode }) {
  const { eu } = useAuth();
  const [estado, setEstado] = useState<EstadoTelefone>("carregando");
  const [erro, setErro] = useState("");
  const [ramal, setRamal] = useState<string | null>(null);
  const [chamada, setChamada] = useState<Chamada | null>(null);
  const [ultimaEncerrada, setUltimaEncerrada] = useState<Ctx["ultimaEncerrada"]>(null);
  const [versao, setVersao] = useState(0);

  const ua = useRef<UA | null>(null);
  const dominio = useRef("");
  const sessao = useRef<RTCSession | null>(null);
  const chamadaRef = useRef<Chamada | null>(null);
  const pararToque = useRef<(() => void) | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const transferidaPara = useRef<string | null>(null);
  const pausaRef = useRef(false);

  const mudar = useCallback((f: (c: Chamada | null) => Chamada | null) => {
    chamadaRef.current = f(chamadaRef.current);
    setChamada(chamadaRef.current);
  }, []);

  // Liga o som do outro lado no alto-falante
  const prenderAudio = useCallback((s: RTCSession) => {
    audio.current ??= Object.assign(document.createElement("audio"), { autoplay: true });
    const ligarTrilha = (pc: RTCPeerConnection) => {
      pc.addEventListener("track", (ev) => {
        if (audio.current && ev.streams[0]) {
          audio.current.srcObject = ev.streams[0];
          void audio.current.play().catch(() => undefined);
        }
      });
    };
    if (s.connection) ligarTrilha(s.connection as unknown as RTCPeerConnection);
    else s.on("peerconnection", (e) => ligarTrilha(e.peerconnection as unknown as RTCPeerConnection));
  }, []);

  const encerrar = useCallback((motivo: string | null) => {
    pararToque.current?.();
    pararToque.current = null;
    const c = chamadaRef.current;
    if (c?.ligacaoId) {
      void rpc("telefonia_fim", { p_id: c.ligacaoId, p_motivo: motivo, p_transferida_para: transferidaPara.current });
      if (c.fase === "em_andamento") setUltimaEncerrada({ ligacaoId: c.ligacaoId, numero: c.numero, pacienteId: c.pacienteId });
    }
    transferidaPara.current = null;
    sessao.current = null;
    if (audio.current) audio.current.srcObject = null;
    mudar(() => null);
  }, [mudar]);

  const ligarEventos = useCallback((s: RTCSession) => {
    s.on("accepted", () => {
      pararToque.current?.();
      pararToque.current = null;
      mudar((c) => (c ? { ...c, fase: "em_andamento", atendidaEm: Date.now() } : c));
      const c = chamadaRef.current;
      if (c?.ligacaoId && c.direcao === "saida") void rpc("telefonia_atendida", { p_id: c.ligacaoId });
    });
    s.on("ended", () => encerrar(null));
    s.on("failed", (e) => {
      // "Canceled" na entrada = parou de tocar (o paciente desistiu ou outra atendente atendeu)
      const causa = e?.cause ?? "";
      const falhou = /Connection Error|Request Timeout|SIP Failure Code|Internal Error|User Denied Media Access|Bad Media Description|Incompatible SDP|Missing SDP/i.test(causa);
      if (/User Denied Media Access/i.test(causa)) setErro("O navegador não deixou usar o microfone. Libere o microfone para o sistema (cadeado ao lado do endereço).");
      encerrar(falhou ? "falhou" : causa);
    });
    s.on("hold", () => mudar((c) => (c ? { ...c, espera: true } : c)));
    s.on("unhold", () => mudar((c) => (c ? { ...c, espera: false } : c)));
    s.on("muted", () => mudar((c) => (c ? { ...c, mudo: true } : c)));
    s.on("unmuted", () => mudar((c) => (c ? { ...c, mudo: false } : c)));
  }, [encerrar, mudar]);

  // Conecta na central com o ramal desta pessoa
  useEffect(() => {
    if (!eu) return;
    let vivo = true;
    (async () => {
      setErro("");
      const cred = await rpc<Credenciais>("telefonia_minhas_credenciais");
      if (!vivo) return;
      if (!cred) return setEstado("sem_ramal");
      setRamal(cred.ramal ?? null);
      if (cred.situacao !== "pronto") return setEstado(cred.situacao as EstadoTelefone);

      setEstado("conectando");
      dominio.current = cred.dominio!;
      let agente: UA;
      try {
        agente = new UA({
          sockets: [new WebSocketInterface(cred.wss_url!)],
          uri: `sip:${cred.usuario}@${cred.dominio}`,
          authorization_user: cred.usuario,
          password: cred.senha,
          display_name: cred.nome ?? cred.ramal,
          register: !pausaRef.current,
          session_timers: false,
          user_agent: "Sistema da Clinica",
        });
      } catch (e) {
        setEstado("erro");
        setErro("Configuração do telefone inválida: " + (e as Error).message);
        return;
      }
      ua.current = agente;
      agente.on("registered", () => { if (vivo) { setEstado(pausaRef.current ? "pausa" : "pronto"); setErro(""); } });
      agente.on("unregistered", () => { if (vivo) setEstado(pausaRef.current ? "pausa" : "conectando"); });
      agente.on("registrationFailed", (e) => {
        if (!vivo) return;
        setEstado("erro");
        setErro(/Authentication|401|403/i.test(e?.cause ?? "")
          ? "A central recusou o ramal (usuário ou senha). Confira em Cadastros → Telefone."
          : "Não foi possível conectar o ramal na central (" + (e?.cause ?? "erro") + ").");
      });
      agente.on("disconnected", () => { if (vivo && !pausaRef.current) setEstado("conectando"); });
      agente.on("connected", () => { if (vivo && pausaRef.current) setEstado("pausa"); });

      agente.on("newRTCSession", (e: RTCSessionEvent) => {
        const s = e.session;
        if (s.direction !== "incoming") return;
        // Já em ligação: responde "ocupado" para a central passar para outra atendente
        if (sessao.current) {
          s.terminate({ status_code: 486, reason_phrase: "Busy Here" });
          return;
        }
        sessao.current = s;
        const numero = s.remote_identity?.uri?.user ?? "";
        const nomeCentral = s.remote_identity?.display_name || null;
        mudar(() => ({
          ligacaoId: null, direcao: "entrada", numero, nomeNaCentral: nomeCentral, fase: "tocando",
          atendidaEm: null, mudo: false, espera: false, pacientes: [], pacienteId: null,
        }));
        prenderAudio(s);
        ligarEventos(s);
        pararToque.current = tocarToque();
        notificarComputador("📞 Ligação chegando", fmtNumeroTel(numero) + (nomeCentral ? ` · ${nomeCentral}` : ""));
        const callId = (e.request as unknown as { call_id?: string })?.call_id ?? null;
        void (async () => {
          const [id, quem] = await Promise.all([
            rpc<string>("telefonia_inicio", { p_direcao: "entrada", p_numero: numero, p_sip_call_id: callId }),
            rpc<QuemLigou[]>("telefonia_quem_ligou", { p_numero: numero }),
          ]);
          mudar((c) => (c && sessao.current === s
            ? { ...c, ligacaoId: id, pacientes: quem ?? [], pacienteId: quem?.length === 1 ? quem[0].paciente_id : null }
            : c));
          // Se a chamada já tinha acabado antes do banco responder, registra o fim
          if (id && sessao.current !== s) void rpc("telefonia_fim", { p_id: id, p_motivo: "cancelada" });
        })();
      });

      agente.start();
    })();

    return () => {
      vivo = false;
      pararToque.current?.();
      try { ua.current?.stop(); } catch { /* ignora */ }
      ua.current = null;
    };
  }, [eu, versao, ligarEventos, mudar, prenderAudio]);

  // Fechar a aba no meio da ligação: avisa a central
  useEffect(() => {
    const sair = () => { try { sessao.current?.terminate(); ua.current?.stop(); } catch { /* ignora */ } };
    window.addEventListener("beforeunload", sair);
    return () => window.removeEventListener("beforeunload", sair);
  }, []);

  const ligar = useCallback(async (numeroBruto: string, pacienteId: string | null = null) => {
    setErro("");
    const agente = ua.current;
    const numero = numeroParaDiscar(numeroBruto);
    if (!agente || !agente.isConnected()) return setErro("O telefone não está conectado.");
    if (sessao.current) return setErro("Termine a ligação atual antes de fazer outra.");
    if (numero.length < 3) return setErro("Número inválido.");
    let s: RTCSession;
    try {
      s = agente.call(`sip:${numero}@${dominio.current}`, {
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      });
    } catch (e) {
      return setErro("Não foi possível ligar: " + (e as Error).message);
    }
    sessao.current = s;
    mudar(() => ({
      ligacaoId: null, direcao: "saida", numero, nomeNaCentral: null, fase: "chamando",
      atendidaEm: null, mudo: false, espera: false, pacientes: [], pacienteId,
    }));
    prenderAudio(s);
    ligarEventos(s);
    const callId = (s as unknown as { _request?: { call_id?: string } })._request?.call_id ?? null;
    const [id, quem] = await Promise.all([
      rpc<string>("telefonia_inicio", { p_direcao: "saida", p_numero: numero, p_sip_call_id: callId, p_paciente_id: pacienteId }),
      rpc<QuemLigou[]>("telefonia_quem_ligou", { p_numero: numero }),
    ]);
    if (sessao.current === s) {
      mudar((c) => (c ? { ...c, ligacaoId: id, pacientes: quem ?? [], pacienteId: c.pacienteId ?? (quem?.length === 1 ? quem[0].paciente_id : null) } : c));
      // O paciente atendeu antes do banco responder
      if (id && chamadaRef.current?.fase === "em_andamento") void rpc("telefonia_atendida", { p_id: id });
    } else if (id) {
      void rpc("telefonia_fim", { p_id: id, p_motivo: "nao_atendida" });
    }
  }, [ligarEventos, mudar, prenderAudio]);

  const atender = useCallback(() => {
    const s = sessao.current;
    if (!s || chamadaRef.current?.fase !== "tocando") return;
    pararToque.current?.();
    pararToque.current = null;
    try {
      s.answer({
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      });
    } catch (e) {
      setErro("Não foi possível atender: " + (e as Error).message);
      return;
    }
    const marcar = async (tentativas: number) => {
      const id = chamadaRef.current?.ligacaoId;
      if (!id) {
        if (tentativas > 0) window.setTimeout(() => marcar(tentativas - 1), 500);
        return;
      }
      await rpc("telefonia_atendida", { p_id: id });
    };
    void marcar(10);
  }, []);

  const recusar = useCallback(() => {
    try { sessao.current?.terminate({ status_code: 486, reason_phrase: "Busy Here" }); } catch { /* já acabou */ }
  }, []);
  const desligar = useCallback(() => {
    try { sessao.current?.terminate(); } catch { encerrar(null); }
  }, [encerrar]);
  const alternarMudo = useCallback(() => {
    const s = sessao.current;
    if (!s) return;
    if (s.isMuted().audio) s.unmute({ audio: true }); else s.mute({ audio: true });
  }, []);
  const alternarEspera = useCallback(() => {
    const s = sessao.current;
    if (!s) return;
    if (s.isOnHold().local) s.unhold(); else s.hold();
  }, []);
  const transferir = useCallback((destino: string) => {
    const s = sessao.current;
    const alvo = destino.replace(/[^0-9A-Za-z_.-]/g, "");
    if (!s || !alvo) return;
    transferidaPara.current = alvo;
    try {
      s.refer(`sip:${alvo}@${dominio.current}`, {
        // Transferência "cega": a central aceitou (202) → a atendente sai da ligação; a central cuida do resto
        eventHandlers: {
          requestSucceeded: () => { try { s.terminate(); } catch { /* a central já desligou */ } },
          requestFailed: () => {
            transferidaPara.current = null;
            setErro("A transferência não foi aceita pela central. A ligação continua com você.");
          },
          failed: () => {
            if (sessao.current !== s) return; // já tinha saído da ligação
            transferidaPara.current = null;
            setErro("A transferência não foi aceita pela central. A ligação continua com você.");
          },
        },
      });
    } catch (e) {
      transferidaPara.current = null;
      setErro("Não foi possível transferir: " + (e as Error).message);
    }
  }, []);
  const tecla = useCallback((t: string) => {
    try { sessao.current?.sendDTMF(t); } catch { /* ignora */ }
  }, []);
  const pausar = useCallback((pausa: boolean) => {
    pausaRef.current = pausa;
    const agente = ua.current;
    if (!agente) return;
    if (pausa) { agente.unregister(); setEstado("pausa"); }
    else { agente.register(); setEstado("conectando"); }
  }, []);

  const valor: Ctx = {
    estado, erro, ramal, chamada, ultimaEncerrada,
    ligar, atender, recusar, desligar, alternarMudo, alternarEspera, transferir, tecla, pausar,
    recarregar: () => setVersao((v) => v + 1),
    limparUltima: () => setUltimaEncerrada(null),
  };
  return <TelCtx.Provider value={valor}>{children}</TelCtx.Provider>;
}

/** Telefone do sistema. Fora do provedor, devolve null. */
export const useTelefone = () => useContext(TelCtx);
