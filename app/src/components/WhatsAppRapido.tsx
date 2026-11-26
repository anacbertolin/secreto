// WhatsApp direto da Agenda (pedido da Alessandra/dona, 26/11/2026): clicar no paciente da agenda e conversar com ele
// pelo WhatsApp numa janela por cima, sem sair da Agenda nem abrir a Central.
//  * Acha a conversa do paciente no número escolhido (Orientação ou clínica): pelo prontuário ou pelo telefone.
//  * Se não houver conversa, abre a "Nova conversa" já com o paciente escolhido (1ª mensagem = modelo aprovado).
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Carregando } from "./ui";
import type { PacienteResumo } from "./ui";
import { SELECT_CONVERSA, whatsapp, podeResponderSetor, type Conversa, type SetorWA } from "../lib/whatsapp";
import { Chat } from "../pages/WhatsApp";
import { NovaConversa } from "../pages/Central";

export interface PacienteWA {
  id: string; nome: string; nome_social: string | null; numero_prontuario: number;
  telefone: string | null; telefone_secundario?: string | null; data_nascimento?: string | null; convenio_id?: string | null;
}

const NOME_SETOR: Record<SetorWA, string> = { orientacao: "🩹 Orientação cirúrgica", clinica: "💬 WhatsApp da clínica" };

async function acharConversa(setor: SetorWA, p: PacienteWA): Promise<Conversa | null> {
  const { data } = await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("setor", setor).eq("paciente_id", p.id)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(1);
  if (data?.[0]) return data[0] as Conversa;
  // Sem ligação ao prontuário: procura pelo telefone do cadastro (últimos 8 dígitos)
  for (const tel of [p.telefone, p.telefone_secundario]) {
    const fim = (tel ?? "").replace(/\D/g, "").slice(-8);
    if (fim.length < 8) continue;
    const { data: d2 } = await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("setor", setor).like("telefone", `%${fim}`)
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(1);
    if (d2?.[0]) return d2[0] as Conversa;
  }
  return null;
}

export function WhatsAppRapido({ paciente, aoFechar }: { paciente: PacienteWA; aoFechar: () => void }) {
  const { eu } = useAuth();
  // Só os números que a pessoa responde E que já estão ligados ao WhatsApp oficial
  const [ligados, setLigados] = useState<Record<SetorWA, boolean>>({ orientacao: true, clinica: false });
  useEffect(() => {
    void whatsapp<{ configurado: boolean; orientacao_configurado?: boolean }>("estado")
      .then((e) => setLigados({ orientacao: e.orientacao_configurado !== false, clinica: !!e.configurado }))
      .catch(() => undefined);
  }, []);
  const setores = (["orientacao", "clinica"] as SetorWA[]).filter((s) => podeResponderSetor(eu, s) && ligados[s]);
  const [setor, setSetor] = useState<SetorWA>(podeResponderSetor(eu, "orientacao") ? "orientacao" : "clinica");
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [procurando, setProcurando] = useState(true);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    setProcurando(true);
    void acharConversa(setor, paciente).then((c) => { if (vivo) { setConversa(c); setProcurando(false); } });
    return () => { vivo = false; };
  }, [setor, paciente, versao]);

  // Mantém a conversa atualizada (janela de 24 h, responsável, encerrada…)
  useEffect(() => {
    if (!conversa) return;
    const t = window.setInterval(async () => {
      const { data } = await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("id", conversa.id).maybeSingle();
      if (data) setConversa(data as Conversa);
    }, 10000);
    return () => window.clearInterval(t);
  }, [conversa?.id]);

  async function recarregarConversa(id: string) {
    const { data } = await supabase.from("whatsapp_conversas").select(SELECT_CONVERSA).eq("id", id).maybeSingle();
    setConversa((data as Conversa) ?? null);
  }

  if (setores.length === 0) {
    return (
      <div className="wa-rapido-fundo" onClick={aoFechar}>
        <div className="wa-rapido painel" style={{ height: "auto" }} onClick={(e) => e.stopPropagation()}>
          <p>Você não responde pelo WhatsApp. Quem responde é a recepção (clínica) ou a Orientação Cirúrgica.</p>
          <button onClick={aoFechar}>Fechar</button>
        </div>
      </div>
    );
  }

  // Sem conversa ainda: começa uma (modelo aprovado), já com o paciente escolhido
  if (!procurando && !conversa) {
    return (
      <NovaConversa setor={setor} pacienteInicial={paciente as unknown as PacienteResumo} aoFechar={aoFechar}
        aoAbrir={async (id) => {
          if (eu) await supabase.from("whatsapp_conversas").update({ responsavel_id: eu.id }).eq("id", id);
          await recarregarConversa(id);
        }} />
    );
  }

  return (
    <div className="wa-rapido-fundo" onClick={aoFechar}>
      <div className="wa-rapido painel" onClick={(e) => e.stopPropagation()}>
        <div className="wa-rapido-topo">
          <b>WhatsApp · {paciente.nome_social || paciente.nome}</b>
          {setores.length > 1 && (
            <span className="ct-filtro" style={{ margin: 0 }}>
              {setores.map((s) => (
                <button key={s} className={s === setor ? "ativo" : ""} onClick={() => { setConversa(null); setSetor(s); }}>{NOME_SETOR[s]}</button>
              ))}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button className="mini" onClick={aoFechar}>✕ Fechar</button>
        </div>
        <div className="wa-rapido-corpo wa-chat">
          {procurando || !conversa ? <Carregando /> : (
            <Chat key={conversa.id} conversa={conversa} podeResponder={podeResponderSetor(eu, setor)} quemResponde=""
              aoMudar={() => void recarregarConversa(conversa.id)} aoVoltar={aoFechar} />
          )}
        </div>
        {conversa && !procurando && (
          <div className="pequeno muted" style={{ marginTop: 6 }}>
            Esta é a mesma conversa da {setor === "orientacao" ? "aba Orientação cirúrgica" : "Central de atendimento"} — tudo fica guardado lá também.
            {" "}<button className="mini" onClick={() => setVersao((v) => v + 1)}>↻ Atualizar</button>
          </div>
        )}
      </div>
    </div>
  );
}
