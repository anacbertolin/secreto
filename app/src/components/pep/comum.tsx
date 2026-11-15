import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export interface AtendimentoCompleto {
  id: string; paciente_id: string; agendamento_id: string | null; profissional_id: string; inicio: string; tipo: string;
  queixa_principal: string | null; historia_doenca_atual: string | null; revisao_sistemas: string | null;
  conduta: string | null; orientacoes: string | null; retorno_em: string | null; status: string; finalizado_em: string | null;
}

export interface Ctx {
  atend: AtendimentoCompleto;
  /** pode editar a parte médica (é o médico responsável e está em andamento) */
  editaMedico: boolean;
  /** pode editar pré-consulta e refração (médico ou enfermagem, em andamento) */
  editaClinico: boolean;
  recarregar: () => void;
}

/** Botão "Inserir modelo" que busca modelos de texto do tipo indicado */
export function InserirModelo({ tipo, aoEscolher }: { tipo: string; aoEscolher: (texto: string) => void }) {
  const [lista, setLista] = useState<{ id: string; titulo: string; texto: string }[] | null>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (aberto && lista === null)
      supabase.from("modelos_texto").select("id, titulo, texto").eq("tipo", tipo).eq("ativo", true).order("titulo")
        .then(({ data }) => setLista(data ?? []));
  }, [aberto, lista, tipo]);
  return (
    <span className="busca" style={{ display: "inline-block" }}>
      <button type="button" className="sutil mini" onClick={() => setAberto(!aberto)}>📝 Modelos</button>
      {aberto && (
        <div className="busca-lista" style={{ minWidth: 260, right: 0, left: "auto" }}>
          {lista?.length === 0 && <div className="vazio pequeno">Nenhum modelo deste tipo. Crie em Cadastros → Modelos de texto.</div>}
          {lista?.map((m) => (
            <button key={m.id} type="button" onClick={() => { aoEscolher(m.texto); setAberto(false); }}>{m.titulo}</button>
          ))}
        </div>
      )}
    </span>
  );
}

/** Indicador de salvamento */
export function EstadoSalvo({ sujo, salvando, salvoEm }: { sujo: boolean; salvando: boolean; salvoEm: Date | null }) {
  if (salvando) return <span className="salvo muted">Salvando…</span>;
  if (sujo) return <span className="salvo" style={{ color: "var(--alerta)" }}>● alterações não salvas</span>;
  if (salvoEm) return <span className="salvo">✓ salvo às {salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>;
  return null;
}

/** Converte "" em null em todos os campos de texto */
export function limpar<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) r[k] = typeof v === "string" && v.trim() === "" ? null : v;
  return r as T;
}
