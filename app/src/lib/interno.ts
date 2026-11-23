// Conversa interna da equipe (migração 0092): conversas a dois e grupos, só entre quem participa.
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { tocarAviso, notificarComputador } from "./whatsapp";

export interface ConversaInterna {
  id: string;
  tipo: "direta" | "grupo";
  nome: string | null;
  ultima_mensagem_em: string | null;
  participantes: { profissional_id: string; lida_em: string; profissionais: { nome: string; funcao: string } | null }[];
}

export interface MensagemInterna {
  id: string;
  conversa_id: string;
  autor_id: string;
  texto: string;
  criado_em: string;
}

export const SELECT_INTERNA = "id, tipo, nome, ultima_mensagem_em, participantes:interno_participantes(profissional_id, lida_em, profissionais(nome, funcao))";

/** Nome que aparece na lista: o colega (conversa a dois) ou o nome do grupo */
export function tituloInterna(c: ConversaInterna, euId: string | undefined): string {
  if (c.tipo === "grupo") return c.nome ?? "Grupo";
  const outro = c.participantes.find((p) => p.profissional_id !== euId);
  return outro?.profissionais?.nome ?? "Colega";
}

/** Quantas conversas internas têm mensagem nova para mim (ao vivo, com som) */
export function useInternoNaoLidas(euId: string | undefined, som = true): { total: number; porConversa: Record<string, number> } {
  const [r, setR] = useState<{ total: number; porConversa: Record<string, number> }>({ total: 0, porConversa: {} });
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    if (!euId) return;
    let vivo = true;
    let espera: number | undefined;
    async function contar() {
      const { data: minhas } = await supabase.from("interno_participantes").select("conversa_id, lida_em").eq("profissional_id", euId!);
      const lidas = new Map(((minhas ?? []) as { conversa_id: string; lida_em: string }[]).map((x) => [x.conversa_id, x.lida_em]));
      if (lidas.size === 0) { if (vivo) setR({ total: 0, porConversa: {} }); return; }
      const desde = [...lidas.values()].sort()[0];
      const { data: msgs } = await supabase.from("interno_mensagens").select("conversa_id, autor_id, criado_em")
        .in("conversa_id", [...lidas.keys()]).gt("criado_em", desde).neq("autor_id", euId!).limit(500);
      const por: Record<string, number> = {};
      for (const m of (msgs ?? []) as { conversa_id: string; criado_em: string }[]) {
        if (m.criado_em > (lidas.get(m.conversa_id) ?? "")) por[m.conversa_id] = (por[m.conversa_id] ?? 0) + 1;
      }
      const total = Object.values(por).reduce((s, n) => s + n, 0);
      if (!vivo) return;
      if (som && anterior.current !== null && total > anterior.current) {
        tocarAviso();
        notificarComputador("Mensagem da equipe", "Nova mensagem na conversa interna.");
      }
      anterior.current = total;
      setR({ total, porConversa: por });
    }
    const agendar = () => { window.clearTimeout(espera); espera = window.setTimeout(contar, 400); };
    void contar();
    const canal = supabase.channel("interno-nao-lidas-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "interno_mensagens" }, agendar)
      .on("postgres_changes", { event: "*", schema: "public", table: "interno_participantes" }, agendar)
      .subscribe();
    const reserva = window.setInterval(contar, 60_000);
    return () => { vivo = false; window.clearTimeout(espera); window.clearInterval(reserva); supabase.removeChannel(canal); };
  }, [euId, som]);
  return r;
}
