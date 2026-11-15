// Tela para a TV da sala de espera: mostra (e fala) o nome do paciente chamado.
// Abra em /painel-tv num computador ligado à TV, com o login da recepção.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { CLINICA } from "../lib/marca";
import { nomeTV } from "../lib/fluxo";
import { inicioDoDia } from "../lib/util";

interface Chamada { id: string; chamada_em: string; chamada_local: string | null; pacientes: { nome: string; nome_social: string | null } | null }

function tocarAviso() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.33);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.35);
    });
  } catch { /* navegador sem som */ }
}

function falar(texto: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* sem voz */ }
}

export default function PainelTV() {
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [somLigado, setSomLigado] = useState(false);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(new Date());
  const ultima = useRef<string>("");

  useEffect(() => {
    let vivo = true;
    async function carregar() {
      const { data, error } = await supabase.from("agendamentos")
        .select("id, chamada_em, chamada_local, pacientes(nome, nome_social)")
        .gte("chamada_em", inicioDoDia(new Date()).toISOString())
        .order("chamada_em", { ascending: false }).limit(6);
      if (!vivo) return;
      if (error) { setErro("Sem conexão com o sistema. Tentando de novo…"); return; }
      setErro("");
      const lista = (data ?? []) as unknown as Chamada[];
      setChamadas(lista);
      const chave = lista[0] ? lista[0].id + lista[0].chamada_em : "";
      if (ultima.current && chave && chave !== ultima.current && lista[0].pacientes) {
        tocarAviso();
        setTimeout(() => falar(`${nomeTV(lista[0].pacientes!)}. ${lista[0].chamada_local ?? ""}`), 800);
      }
      ultima.current = chave || ultima.current || "-";
    }
    carregar();
    const t = setInterval(carregar, 4000);
    const r = setInterval(() => setAgora(new Date()), 15000);
    return () => { vivo = false; clearInterval(t); clearInterval(r); };
  }, []);

  const [atual, ...anteriores] = chamadas;
  const recente = atual && Date.now() - new Date(atual.chamada_em).getTime() < 60000;
  return (
    <div className="tv">
      <div className="tv-topo">
        <img src="/logo-branco.png" alt={CLINICA.nome} />
        <div className="tv-relogio">{agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      {!somLigado && (
        <button className="tv-som" onClick={() => { setSomLigado(true); tocarAviso(); falar("Som ligado"); }}>
          🔊 Toque aqui uma vez para ligar o som das chamadas
        </button>
      )}
      {erro && <div className="tv-erro">{erro}</div>}
      <div className={"tv-atual" + (recente ? " recente" : "")}>
        {atual?.pacientes ? (
          <>
            <div className="tv-nome">{nomeTV(atual.pacientes)}</div>
            <div className="tv-local">{atual.chamada_local ?? ""}</div>
          </>
        ) : <div className="tv-local">Aguarde ser chamado(a). Obrigado pela paciência!</div>}
      </div>
      {anteriores.length > 0 && (
        <div className="tv-anteriores">
          <div className="tv-rot">Chamados anteriormente</div>
          {anteriores.map((c) => c.pacientes && (
            <div key={c.id + c.chamada_em} className="tv-linha">
              <span>{nomeTV(c.pacientes)}</span><span>{c.chamada_local}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
