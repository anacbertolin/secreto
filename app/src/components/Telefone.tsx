// Telefone flutuante (canto da tela), em todas as telas do sistema para quem tem ramal.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtNumeroTel, numeroParaDiscar, useTelefone, type Chamada } from "../lib/telefone";
import { useCentral } from "../lib/central";
import { fmtDataHora, idade, nomeExibicao } from "../lib/util";

const ROTULO_ESTADO: Record<string, { texto: string; cor: string }> = {
  pronto: { texto: "Disponível", cor: "#12b76a" },
  pausa: { texto: "Em pausa", cor: "#f79009" },
  conectando: { texto: "Conectando…", cor: "#98a2b3" },
  erro: { texto: "Sem conexão", cor: "#d92d20" },
  desligado: { texto: "Telefone desligado", cor: "#98a2b3" },
  incompleto: { texto: "Falta configurar", cor: "#98a2b3" },
};

function useCronometro(desde: number | null): string {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!desde) return;
    const i = window.setInterval(() => setT((x) => x + 1), 1000);
    return () => window.clearInterval(i);
  }, [desde]);
  if (!desde) return "";
  const s = Math.max(0, Math.floor((Date.now() - desde) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

interface RamalColega { ramal: string; nome: string; profissionais: { nome: string } | null }

function QuemE({ c }: { c: Chamada }) {
  if (c.pacientes.length === 0) {
    return (
      <div>
        <div className="tel-nome">{c.nomeNaCentral || fmtNumeroTel(c.numero)}</div>
        <div className="tel-sub">{c.nomeNaCentral ? fmtNumeroTel(c.numero) + " · " : ""}Número não cadastrado</div>
      </div>
    );
  }
  const p = c.pacientes.find((x) => x.paciente_id === c.pacienteId) ?? c.pacientes[0];
  return (
    <div>
      <div className="tel-nome">{nomeExibicao(p)}</div>
      <div className="tel-sub">
        {fmtNumeroTel(c.numero)} · Pront. {p.numero_prontuario}
        {p.data_nascimento && <> · {idade(p.data_nascimento)}</>}
      </div>
      {p.proximo_agendamento && <div className="tel-sub">📅 Próxima consulta: {fmtDataHora(p.proximo_agendamento)}</div>}
      {c.pacientes.length > 1 && (
        <div className="tel-sub">⚠️ {c.pacientes.length} pacientes com este número: {c.pacientes.map((x) => nomeExibicao(x)).join(", ")}</div>
      )}
      <div className="linha" style={{ marginTop: 6, gap: 6 }}>
        <Link className="botao mini-l" to={`/pacientes/${p.paciente_id}`}>Abrir ficha</Link>
        <Link className="botao mini-l" to={`/whatsapp?paciente=${p.paciente_id}`}>💬 WhatsApp</Link>
      </div>
    </div>
  );
}

export default function Telefone() {
  const tel = useTelefone();
  const central = useCentral();
  const [aberto, setAberto] = useState(false);
  const [numero, setNumero] = useState("");
  const [teclado, setTeclado] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [destino, setDestino] = useState("");
  const [colegas, setColegas] = useState<RamalColega[]>([]);
  const [nota, setNota] = useState("");

  const c = tel?.chamada ?? null;
  const tempo = useCronometro(c?.fase === "em_andamento" ? c.atendidaEm : null);

  useEffect(() => {
    if (!transferindo) return;
    supabase.from("telefonia_ramais").select("ramal, nome, profissionais(nome)").eq("ativo", true).order("ramal")
      .then(({ data }) => setColegas(((data ?? []) as unknown as RamalColega[]).filter((r) => r.ramal !== tel?.ramal)));
  }, [transferindo, tel?.ramal]);

  useEffect(() => {
    if (!c) { setTeclado(false); setTransferindo(false); }
  }, [c]);
  useEffect(() => { if (tel?.ultimaEncerrada) setNota(""); }, [tel?.ultimaEncerrada]);

  if (!tel || tel.estado === "sem_ramal" || tel.estado === "carregando") return null;
  const est = ROTULO_ESTADO[tel.estado] ?? ROTULO_ESTADO.conectando;

  async function salvarNota() {
    const u = tel!.ultimaEncerrada;
    if (u && nota.trim()) await supabase.rpc("telefonia_anotar", { p_id: u.ligacaoId, p_observacao: nota.trim() });
    tel!.limparUltima();
  }

  // ---------- Chamada chegando: cartão grande ----------
  if (c && c.fase === "tocando") {
    return (
      <div className="tel tel-tocando" role="alertdialog" aria-label="Ligação chegando">
        <div className="tel-titulo">📞 Ligação chegando</div>
        <QuemE c={c} />
        <div className="linha" style={{ marginTop: 12 }}>
          <button className="tel-atender" onClick={tel.atender}>Atender</button>
          <button className="perigo" onClick={tel.recusar}>Recusar</button>
        </div>
      </div>
    );
  }

  // ---------- Em ligação ----------
  if (c) {
    return (
      <div className="tel tel-aberto">
        <div className="tel-titulo">
          {c.fase === "chamando" ? "Chamando…" : c.espera ? "⏸ Em espera" : `Em ligação · ${tempo}`}
          {c.direcao === "saida" ? " (feita)" : " (recebida)"}
        </div>
        <QuemE c={c} />
        {tel.erro && <div className="tel-erro">{tel.erro}</div>}
        {c.fase === "em_andamento" && (
          <div className="tel-botoes">
            <button className={c.mudo ? "ativo" : ""} onClick={tel.alternarMudo}>{c.mudo ? "🔇 Mudo" : "🎙️ Mudo"}</button>
            <button className={c.espera ? "ativo" : ""} onClick={tel.alternarEspera}>⏸ Espera</button>
            <button className={transferindo ? "ativo" : ""} onClick={() => setTransferindo(!transferindo)}>↪ Transferir</button>
            <button className={teclado ? "ativo" : ""} onClick={() => setTeclado(!teclado)}>⌨ Teclado</button>
          </div>
        )}
        {transferindo && (
          <div className="tel-caixa">
            <div className="tel-sub">Transferir para:</div>
            {colegas.map((r) => (
              <button key={r.ramal} className="mini" style={{ margin: "4px 4px 0 0" }} onClick={() => tel.transferir(r.ramal)}>
                {r.ramal} · {r.profissionais?.nome ?? r.nome}
              </button>
            ))}
            <div className="linha" style={{ marginTop: 6, gap: 6 }}>
              <input style={{ flex: 1, minWidth: 0 }} placeholder="Outro ramal ou número" value={destino} onChange={(e) => setDestino(e.target.value)} />
              <button className="mini" disabled={!destino.trim()} onClick={() => tel.transferir(destino.trim())}>Transferir</button>
            </div>
          </div>
        )}
        {teclado && (
          <div className="tel-teclado">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((t) => (
              <button key={t} onClick={() => tel.tecla(t)}>{t}</button>
            ))}
          </div>
        )}
        <button className="tel-desligar" onClick={tel.desligar}>Desligar</button>
      </div>
    );
  }

  // ---------- Depois da ligação: anotação rápida ----------
  if (tel.ultimaEncerrada) {
    return (
      <div className="tel tel-aberto">
        <div className="tel-titulo">Ligação encerrada · {fmtNumeroTel(tel.ultimaEncerrada.numero)}</div>
        <textarea rows={3} spellCheck lang="pt-BR" placeholder="Anotação (opcional): o que o paciente pediu" value={nota} onChange={(e) => setNota(e.target.value)} />
        <div className="linha" style={{ marginTop: 8 }}>
          <button className="primario mini" onClick={salvarNota}>{nota.trim() ? "Salvar anotação" : "Fechar"}</button>
          {tel.ultimaEncerrada.pacienteId && <Link className="botao mini-l" to={`/pacientes/${tel.ultimaEncerrada.pacienteId}`} onClick={() => void salvarNota()}>Abrir ficha</Link>}
        </div>
      </div>
    );
  }

  // ---------- Fechado: botão pequeno ----------
  if (!aberto) {
    return (
      <div className="tel tel-fechado-caixa">
        {tel.erro && <div className="tel-erro tel-erro-solto" role="alert" onClick={() => setAberto(true)}>{tel.erro}</div>}
        <button className="tel-fechado" onClick={() => setAberto(true)} title={`Telefone · ramal ${tel.ramal ?? ""}`}>
          <span className="tel-bolinha" style={{ background: est.cor }} /> 📞 {est.texto}
        </button>
      </div>
    );
  }

  // ---------- Aberto: discador ----------
  const pronto = tel.estado === "pronto" || tel.estado === "pausa";
  return (
    <div className="tel tel-aberto">
      <div className="linha entre" style={{ justifyContent: "space-between" }}>
        <div className="tel-titulo" style={{ margin: 0 }}>
          <span className="tel-bolinha" style={{ background: est.cor }} /> Ramal {tel.ramal} · {est.texto}
        </div>
        <button className="sutil" onClick={() => setAberto(false)} aria-label="Fechar">✕</button>
      </div>
      {tel.erro && <div className="tel-erro">{tel.erro}</div>}
      {tel.estado === "desligado" && <div className="tel-sub">A administração ainda não ligou o telefone do sistema (Cadastros → Telefone).</div>}
      {tel.estado === "incompleto" && <div className="tel-sub">Falta cadastrar o endereço da central ou a senha deste ramal (Cadastros → Telefone).</div>}
      {pronto && (
        <>
          <form className="linha" style={{ marginTop: 10, gap: 6 }} onSubmit={(e) => { e.preventDefault(); void tel.ligar(numero); }}>
            <input style={{ flex: 1, minWidth: 0 }} inputMode="tel" placeholder="Número com DDD" value={numero} onChange={(e) => setNumero(e.target.value)} autoFocus />
            <button className="tel-atender" type="submit" disabled={numeroParaDiscar(numero).length < 3}>Ligar</button>
          </form>
          <div className="linha" style={{ marginTop: 10, gap: 6 }}>
            {central?.atende ? (
              tel.estado === "pausa"
                ? <button className="mini" onClick={() => void central.mudar("disponivel")}>🟢 Ficar disponível</button>
                : <button className="mini" onClick={() => void central.mudar("pausa")}>⏸ Pausa</button>
            ) : tel.estado === "pausa"
              ? <button className="mini" onClick={() => tel.pausar(false)}>▶ Voltar a receber ligações</button>
              : <button className="mini" onClick={() => tel.pausar(true)}>⏸ Pausa (não receber ligações)</button>}
            <Link className="botao mini-l" to="/ligacoes" onClick={() => setAberto(false)}>Histórico</Link>
          </div>
        </>
      )}
      {(tel.estado === "erro" || tel.estado === "conectando") && (
        <button className="mini" style={{ marginTop: 10 }} onClick={tel.recarregar}>Tentar conectar de novo</button>
      )}
    </div>
  );
}

/** Botão "Ligar" para usar nas telas: liga pelo sistema quando o telefone está pronto; senão, link comum (tel:). */
export function BotaoLigar({ numero, pacienteId, rotulo = "📞 Ligar", className = "mini" }: {
  numero: string | null | undefined; pacienteId?: string | null; rotulo?: string; className?: string;
}) {
  const tel = useTelefone();
  if (!numero || numeroParaDiscar(numero).length < 8) return null;
  const pronto = tel && (tel.estado === "pronto" || tel.estado === "pausa");
  if (!pronto) return null;
  return (
    <button className={className} disabled={!!tel.chamada} title={`Ligar para ${fmtNumeroTel(numero)} pelo sistema`}
      onClick={() => void tel.ligar(numero, pacienteId ?? null)}>
      {rotulo}
    </button>
  );
}
