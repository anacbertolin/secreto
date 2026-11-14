import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { fmtCPF, fmtData, idade, nomeExibicao, fmtTelefone } from "../lib/util";

export function Modal(props: {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largo?: boolean;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && props.aoFechar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [props]);
  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && props.aoFechar()}>
      <div className={"modal" + (props.largo ? " largo" : "")} role="dialog" aria-label={props.titulo}>
        <div className="modal-cab">
          <h2>{props.titulo}</h2>
          <button className="sutil" onClick={props.aoFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-corpo">{props.children}</div>
        {props.rodape && <div className="modal-rodape">{props.rodape}</div>}
      </div>
    </div>
  );
}

export function Etiqueta({ cor, children }: { cor: string; children: ReactNode }) {
  return <span className={"etiqueta " + cor}>{children}</span>;
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "ok" | "info" | "alerta"; children: ReactNode }) {
  if (!children) return null;
  return <div className={"aviso " + tipo}>{children}</div>;
}

export function Campo(props: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={"campo " + (props.className ?? "")}>
      {props.rotulo}
      {props.children}
    </label>
  );
}

export function Carregando() {
  return <div className="vazio">Carregando…</div>;
}

export interface PacienteResumo {
  id: string;
  numero_prontuario: number;
  nome: string;
  nome_social: string | null;
  data_nascimento: string | null;
  cpf: string | null;
  telefone: string | null;
  convenio_id: string | null;
}

/** Busca de paciente por nome, CPF, telefone ou nº do prontuário */
export function BuscaPaciente(props: {
  aoEscolher: (p: PacienteResumo) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState<PacienteResumo[]>([]);
  const [aberta, setAberta] = useState(false);
  const [erro, setErro] = useState("");
  const timer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    const t = texto.trim();
    if (t.length < 2) {
      setLista([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      let q = supabase
        .from("pacientes")
        .select("id, numero_prontuario, nome, nome_social, data_nascimento, cpf, telefone, convenio_id")
        .eq("ativo", true)
        .order("nome")
        .limit(15);
      const num = t.replace(/\D/g, "");
      if (num.length === 11 && /^[\d.\-\s]+$/.test(t)) q = q.eq("cpf", num);
      else if (num.length >= 8 && /^[\d()\-\s]+$/.test(t)) q = q.ilike("telefone", `%${num}%`);
      else if (/^\d{1,7}$/.test(t)) q = q.eq("numero_prontuario", Number(t));
      else q = q.or(`nome.ilike.%${t.replace(/[%,()]/g, " ")}%,nome_social.ilike.%${t.replace(/[%,()]/g, " ")}%`);
      const { data, error } = await q;
      if (error) setErro(msgErro(error));
      else {
        setErro("");
        setLista((data as PacienteResumo[]) ?? []);
        setAberta(true);
      }
    }, 250);
  }, [texto]);

  return (
    <div className="busca">
      <input
        autoFocus={props.autoFocus}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => setAberta(true)}
        onBlur={() => setTimeout(() => setAberta(false), 200)}
        placeholder={props.placeholder ?? "Buscar paciente por nome, CPF, telefone ou nº do prontuário"}
      />
      {erro && <div className="aviso erro">{erro}</div>}
      {aberta && texto.trim().length >= 2 && (
        <div className="busca-lista">
          {lista.length === 0 && <div className="vazio pequeno">Nenhum paciente encontrado.</div>}
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                props.aoEscolher(p);
                setTexto("");
                setAberta(false);
              }}
            >
              <div><b>{nomeExibicao(p)}</b></div>
              <div className="muted pequeno">
                Pront. {p.numero_prontuario}
                {p.data_nascimento && ` · ${fmtData(p.data_nascimento)} (${idade(p.data_nascimento)})`}
                {p.cpf && ` · CPF ${fmtCPF(p.cpf)}`}
                {p.telefone && ` · ${fmtTelefone(p.telefone)}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pequeno hook para carregar dados com recarga manual */
export function useCarregar<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    fn()
      .then((d) => vivo && (setDados(d), setErro("")))
      .catch((e) => vivo && setErro(msgErro(e)))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);
  return { dados, erro, carregando, recarregar: () => setVersao((v) => v + 1) };
}

/** Lança erro do Supabase para cair no catch */
export function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}
