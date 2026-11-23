// Parte de cima da Agenda, no estilo do Micrologos (pedido da dona, 23/11/2026):
//  * MiniCalendario: 3 meses, cada dia colorido pela ocupação das agendas mostradas (100%, 51–99%, 1–50%, 0%, não atende).
//  * ResumoAgendamento: telefones, nascimento/idade, convênio, notas, chegada, quem incluiu e quem alterou.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCarregar, ok, Etiqueta } from "./ui";
import type { Agendamento, Horario } from "../lib/dados";
import { MOTIVOS_ORIENTACAO } from "./AgendamentoModais";

/** Avisos mais comuns nas notas da agenda (pedido da dona, 23/11): um toque acrescenta à nota */
export const NOTAS_RAPIDAS = [
  "Entregar laudo", "Jejum", "Indicação", "Trazer exames anteriores", "Dilatar", "Acompanhante", "Prioridade", "Pendência no cadastro",
];
import { STATUS_AGENDA, TIPOS_AGENDA, fmtData, fmtDataHora, fmtHora, fmtTelefone, idade, isoDia, nomeExibicao } from "../lib/util";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function minutos(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Classe de cor do dia pela ocupação */
function faixa(ocupados: number, vagas: number): string {
  if (vagas <= 0) return ocupados > 0 ? "oc-1" : "oc-nao";
  const p = ocupados / vagas;
  if (p >= 1) return "oc-100";
  if (p > 0.5) return "oc-51";
  if (p > 0) return "oc-1";
  return "oc-0";
}

export function MiniCalendario(props: { dia: Date; aoEscolher: (d: Date) => void; colunas: string[]; versao: number }) {
  const inicio = new Date(props.dia.getFullYear(), props.dia.getMonth(), 1);
  const fim = new Date(props.dia.getFullYear(), props.dia.getMonth() + 3, 1);
  const chave = `${inicio.getTime()}|${props.colunas.join(",")}|${props.versao}`;

  const dados = useCarregar(async () => {
    if (!props.colunas.length) return { hs: [] as Horario[], ags: [] as { inicio: string; profissional_id: string }[] };
    const [h, a] = await Promise.all([
      supabase.from("horarios_profissional").select("*").eq("ativo", true).in("profissional_id", props.colunas),
      supabase.from("agendamentos").select("inicio, profissional_id")
        .in("profissional_id", props.colunas).not("status", "in", "(cancelado,faltou)")
        .gte("inicio", inicio.toISOString()).lt("inicio", fim.toISOString()).limit(20000),
    ]);
    return { hs: ok(h) as Horario[], ags: ok(a) as { inicio: string; profissional_id: string }[] };
  }, [chave]);

  // vagas e ocupados por dia
  const porDia = useMemo(() => {
    const ocup = new Map<string, number>();
    for (const a of dados.dados?.ags ?? []) {
      const k = isoDia(new Date(a.inicio));
      ocup.set(k, (ocup.get(k) ?? 0) + 1);
    }
    return (d: Date) => {
      const k = isoDia(d);
      let vagas = 0;
      for (const h of dados.dados?.hs ?? []) {
        if (h.dia_semana !== d.getDay()) continue;
        if ((h.vigente_de && h.vigente_de > k) || (h.vigente_ate && h.vigente_ate < k)) continue;
        vagas += Math.max(0, Math.floor((minutos(h.hora_fim) - minutos(h.hora_inicio)) / Math.max(5, h.duracao_min || 15)));
      }
      return { vagas, ocupados: ocup.get(k) ?? 0 };
    };
  }, [dados.dados]);

  const hoje = isoDia(new Date());
  const selecionado = isoDia(props.dia);
  const meses = [0, 1, 2].map((i) => new Date(inicio.getFullYear(), inicio.getMonth() + i, 1));

  return (
    <div className="minical">
      <div className="minical-legenda pequeno">
        <span className="oc-100">100%</span><span className="oc-51">51 a 99%</span><span className="oc-1">1 a 50%</span>
        <span className="oc-0">0%</span><span className="oc-nao">não atende</span>
        {dados.carregando && <span className="muted">atualizando…</span>}
      </div>
      <div className="minical-meses">
        {meses.map((m) => {
          const primeiro = m.getDay();
          const qtd = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          const celulas: (Date | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: qtd }, (_, i) => new Date(m.getFullYear(), m.getMonth(), i + 1))];
          return (
            <div key={m.getTime()} className="minical-mes">
              <div className="minical-titulo">{MESES[m.getMonth()]} {m.getFullYear()}</div>
              <div className="minical-grade">
                {DIAS.map((d) => <div key={d} className="minical-cab">{d}</div>)}
                {celulas.map((d, i) => {
                  if (!d) return <div key={"v" + i} />;
                  const { vagas, ocupados } = porDia(d);
                  const k = isoDia(d);
                  return (
                    <button
                      key={k}
                      className={"minical-dia " + faixa(ocupados, vagas) + (k === selecionado ? " sel" : "") + (k === hoje ? " hoje" : "")}
                      title={vagas ? `${ocupados} de ${vagas} horários ocupados` : ocupados ? `${ocupados} agendamento(s) (fora do horário)` : "Não atende"}
                      onClick={() => props.aoEscolher(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResumoAgendamento(props: {
  ag: Agendamento | null;
  nomeDe: (id?: string | null) => string;
  convenio: (id?: string | null) => string;
  agenda: (id: string) => string;
  aoAbrir: () => void;
  /** Grava as notas do agendamento; devolve a mensagem de erro (ou "" se deu certo) */
  aoSalvarNotas: (texto: string) => Promise<string>;
}) {
  const a = props.ag;
  const [notas, setNotas] = useState(a?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvoAgora, setSalvoAgora] = useState(false);
  useEffect(() => { setNotas(a?.observacoes ?? ""); setErro(""); }, [a?.id, a?.observacoes]);
  useEffect(() => { setSalvoAgora(false); }, [a?.id]);
  async function salvar(texto: string) {
    const t = texto.trim();
    if (!a || t === (a.observacoes ?? "")) return;
    setSalvando(true);
    const e = await props.aoSalvarNotas(t);
    setErro(e);
    setSalvoAgora(!e);
    setSalvando(false);
  }
  if (!a) {
    return (
      <div className="resumo-ag vazio pequeno">
        Clique num paciente da agenda para ver o resumo aqui (telefones, idade, notas, quem marcou).
        Dois cliques abrem o agendamento.
      </div>
    );
  }
  const p = a.pacientes!;
  const st = STATUS_AGENDA[a.status];
  return (
    <div className="resumo-ag">
      <div className="linha entre" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <b>{nomeExibicao(p)}</b>
          <div className="muted pequeno">Pront. {p.numero_prontuario} · {props.agenda(a.profissional_id)} · {fmtHora(a.inicio)}</div>
        </div>
        <Etiqueta cor={st.cor}>{st.rotulo}</Etiqueta>
      </div>
      <dl className="resumo-ag-dados">
        <dt>Telefones</dt>
        <dd>{[p.telefone, p.telefone_secundario].filter(Boolean).map((t) => fmtTelefone(t)).join(" · ") || "—"}</dd>
        <dt>Nascimento</dt>
        <dd>{p.data_nascimento ? `${fmtData(p.data_nascimento)} (${idade(p.data_nascimento)})` : "—"}</dd>
        <dt>Convênio</dt>
        <dd>{props.convenio(a.convenio_id) || "Particular"}{a.tipo !== "orientacao" && ` · ${TIPOS_AGENDA[a.tipo] ?? a.tipo}`}</dd>
        <dt>Notas</dt>
        <dd>
          <div className="notas-rapidas">
            {(a.tipo === "orientacao" ? MOTIVOS_ORIENTACAO : NOTAS_RAPIDAS).map((m) => (
              <button key={m} type="button" className="mini" title="Acrescentar à nota e salvar"
                onClick={() => {
                  const t = notas.trim() ? `${notas.trim()}; ${m.toLowerCase()}` : m;
                  setNotas(t);
                  salvar(t);
                }}>{m}</button>
            ))}
          </div>
          <textarea id="resumo-notas" className="resumo-notas" rows={2} value={notas}
            placeholder="Escreva aqui a nota (ex.: entregar laudo, jejum, paciente indicado por…). Salva sozinha ao sair do campo."
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() => salvar(notas)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvar(notas); } }} />
          <div className="pequeno muted" style={{ minHeight: 16 }}>
            {salvando ? "Salvando…" : erro ? <span style={{ color: "var(--perigo)" }}>{erro}</span>
              : notas.trim() !== (a.observacoes ?? "") ? "Não salvo ainda (Ctrl+Enter salva)" : salvoAgora ? "✓ Nota salva" : ""}
          </div>
        </dd>
        {a.chegada_em && (<><dt>Chegada</dt><dd>{fmtHora(a.chegada_em)}</dd></>)}
        <dt>Inclusão</dt>
        <dd>{props.nomeDe(a.criado_por) || "—"}{a.criado_em && ` · ${fmtDataHora(a.criado_em)}`}</dd>
        {a.atualizado_por && (<><dt>Alteração</dt><dd>{props.nomeDe(a.atualizado_por)}{a.atualizado_em && ` · ${fmtDataHora(a.atualizado_em)}`}</dd></>)}
      </dl>
      <button className="primario mini" onClick={props.aoAbrir}>Abrir agendamento (chegada, remarcar…)</button>
    </div>
  );
}
