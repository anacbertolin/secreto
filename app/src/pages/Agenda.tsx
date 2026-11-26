import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { NovoAgendamento, DetalheAgendamento, type ModoAgendamento } from "../components/AgendamentoModais";
import { BuscaPaciente, type PacienteResumo } from "../components/ui";
import { Lembretes } from "./WhatsApp";
import { CirurgiaVendidaAgenda } from "./VendasOrientacao";
import { whatsapp } from "../lib/whatsapp";
import { MiniCalendario, ResumoAgendamento } from "../components/AgendaTopo";
import { Modal } from "../components/ui";
import {
  listaAgendas, listaConvenios, listaLocais, nomeAgenda, ehAgendaOrientacao, colunaDoAgendamento, SELECT_AGENDA,
  type Agendamento, type Horario, type Bloqueio,
} from "../lib/dados";
import { STATUS_AGENDA, TIPOS_AGENDA, fmtData, fmtDataLonga, fmtHora, inicioDoDia, isoDia, somaDias, nomeExibicao } from "../lib/util";
import { msgErro } from "../lib/supabase";

// minutos por linha da grade: 15 (médicos); 10 quando só a agenda da Orientação Cirúrgica está na tela
const PASSO_PADRAO = 15;

// Filtro de período (pedido da dona, 23/11): manhã até 12h, tarde 12h–18h, noite depois das 18h
const PERIODOS: Record<string, { rotulo: string; de: number; ate: number }> = {
  dia: { rotulo: "Dia todo", de: 0, ate: 24 * 60 },
  manha: { rotulo: "Manhã", de: 0, ate: 12 * 60 },
  tarde: { rotulo: "Tarde", de: 12 * 60, ate: 18 * 60 },
  noite: { rotulo: "Noite", de: 18 * 60, ate: 24 * 60 },
};

function lerPreferencia(chave: string, padrao: string) {
  try { return localStorage.getItem("agenda." + chave) ?? padrao; } catch { return padrao; }
}
function gravarPreferencia(chave: string, valor: string) {
  try { localStorage.setItem("agenda." + chave, valor); } catch { /* sem armazenamento */ }
}

function minutosDoDia(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function Agenda() {
  const { eu } = useAuth();
  const [dia, setDia] = useState(() => inicioDoDia(new Date()));
  // Médico abre na própria agenda; quem atende a orientação abre na agenda da Orientação Cirúrgica
  const [filtro, setFiltro] = useState<string>(eu?.funcao === "medico" ? eu.id : ehAgendaOrientacao(eu) ? "orientacao" : "todos");
  const [novo, setNovo] = useState<null | { profissional_id?: string; inicio?: Date; duracao?: number; local_id?: string | null; encaixe?: boolean; paciente?: PacienteResumo; tipo?: string }>(null);
  const [aberto, setAberto] = useState<Agendamento | null>(null);
  const [modoAbrir, setModoAbrir] = useState<ModoAgendamento>("");
  const [visao, setVisaoBruta] = useState<"grade" | "lista">(() => (lerPreferencia("visao", "grade") === "lista" ? "lista" : "grade"));
  const setVisao = (v: "grade" | "lista") => { setVisaoBruta(v); gravarPreferencia("visao", v); };
  const [periodo, setPeriodo] = useState("dia");
  const [mostrarVagos, setMostrarVagos] = useState(false);
  const [confirmacoes, setConfirmacoes] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [busca, setBusca] = useState<{ paciente: PacienteResumo; ags: Agendamento[] } | null>(null);
  const { pode } = useAuth();
  const podeWhats = pode("recepcao", "admin");
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null);
  const [versao, setVersao] = useState(0); // força o calendário de 3 meses a recontar a ocupação
  const [editObs, setEditObs] = useState<{ profissional_id: string; nome: string; texto: string } | null>(null);

  const base = useCarregar(async () => {
    const [medicos, convenios, locais, equipe] = await Promise.all([
      listaAgendas(), listaConvenios(), listaLocais(),
      supabase.from("profissionais").select("id, nome").then((r) => ok(r) as { id: string; nome: string }[]),
    ]);
    return { medicos, convenios, locais, equipe };
  }, []);

  const doDia = useCarregar(async () => {
    const fimDia = somaDias(dia, 1);
    const [ags, hors, blqs, obs] = await Promise.all([
      supabase.from("agendamentos").select(SELECT_AGENDA).gte("inicio", dia.toISOString()).lt("inicio", fimDia.toISOString()).order("inicio"),
      supabase.from("horarios_profissional").select("*").eq("ativo", true).eq("dia_semana", dia.getDay()),
      supabase.from("bloqueios_agenda").select("*").eq("ativo", true).lt("inicio", fimDia.toISOString()).gt("fim", dia.toISOString()),
      supabase.from("agenda_obs_dia").select("profissional_id, texto").eq("dia", isoDia(dia)),
    ]);
    const d = isoDia(dia);
    const horarios = (ok(hors) as Horario[]).filter((h) => (!h.vigente_de || h.vigente_de <= d) && (!h.vigente_ate || h.vigente_ate >= d));
    const obsDia = new Map((ok(obs) as { profissional_id: string; texto: string }[]).map((o) => [o.profissional_id, o.texto]));
    return { ags: ok(ags) as Agendamento[], horarios, bloqueios: ok(blqs) as Bloqueio[], obsDia };
  }, [dia.getTime()]);

  const medicos = base.dados?.medicos ?? [];
  const colunas = filtro === "todos" ? medicos
    : filtro === "orientacao" ? medicos.filter((m) => ehAgendaOrientacao(m))
    : medicos.filter((m) => m.id === filtro);
  // agendamento de qualquer pessoa da orientação aparece na coluna única da Orientação Cirúrgica
  const colDe = (profissionalId: string) => colunaDoAgendamento(medicos, profissionalId);
  const PASSO = colunas.length > 0 && colunas.every((c) => ehAgendaOrientacao(c)) ? 10 : PASSO_PADRAO;
  // o resumo acompanha as alterações do dia (ex.: depois de marcar a chegada)
  const sel = selecionado ? (doDia.dados?.ags.find((a) => a.id === selecionado.id) ?? null) : null;
  const nomeDe = (id?: string | null) => base.dados?.equipe.find((x) => x.id === id)?.nome ?? "";
  function recarregar() {
    doDia.recarregar();
    setVersao((v) => v + 1);
  }
  async function salvarObs() {
    if (!editObs) return;
    const t = editObs.texto.trim();
    const r = t
      ? await supabase.from("agenda_obs_dia").upsert({ profissional_id: editObs.profissional_id, dia: isoDia(dia), texto: t }, { onConflict: "profissional_id,dia" })
      : await supabase.from("agenda_obs_dia").delete().eq("profissional_id", editObs.profissional_id).eq("dia", isoDia(dia));
    if (r.error) return alert(msgErro(r.error));
    setEditObs(null);
    doDia.recarregar();
  }
  const [mostrarCancelados, setMostrarCancelados] = useState(false);

  function abrir(a: Agendamento, modo: ModoAgendamento = "") {
    setModoAbrir(modo);
    setAberto(a);
  }

  // ---------- Botões rápidos (agem no paciente selecionado, sem abrir o agendamento) ----------
  async function mudar(campos: Record<string, unknown>, textoOk: string) {
    if (!sel) return;
    setAviso(null);
    setOcupado(true);
    const { error } = await supabase.from("agendamentos").update(campos).eq("id", sel.id);
    setOcupado(false);
    if (error) return setAviso({ tipo: "erro", texto: msgErro(error) });
    setAviso({ tipo: "ok", texto: textoOk });
    recarregar();
  }
  const consultaParticular = (a: Agendamento) => !a.convenio_id && a.tipo === "consulta";
  function chegada() {
    if (!sel) return;
    // consulta particular: pergunta cartão ou dinheiro/Pix antes (migração 0087)
    if (consultaParticular(sel)) return abrir(sel, "chegada");
    mudar({ status: "chegou" }, `Chegada de ${nomeExibicao(sel.pacientes!)} às ${fmtHora(new Date().toISOString())}.`);
  }
  function mudarStatus(v: string) {
    if (!sel || !v) return;
    const nome = nomeExibicao(sel.pacientes!);
    if (v === "cancelado") return abrir(sel, "cancelar");
    if (v === "chegou") return chegada();
    if (v.startsWith("confirmado:")) return mudar({ status: "confirmado", canal_confirmacao: v.split(":")[1] }, `${nome}: confirmado.`);
    if (v === "agendado") return mudar({ status: "agendado", chegada_em: null }, `${nome}: voltou para Agendado.`);
    mudar({ status: v }, `${nome}: ${STATUS_AGENDA[v]?.rotulo ?? v}.`);
  }
  function retorno() {
    if (!sel) return;
    const p = sel.pacientes!;
    setNovo({
      profissional_id: sel.profissional_id,
      inicio: new Date(sel.inicio),
      duracao: 15,
      tipo: "retorno",
      paciente: { ...p, cpf: null, plano_id: null } as unknown as PacienteResumo,
    });
  }
  async function pedirConfirmacao() {
    if (!sel) return;
    const nome = nomeExibicao(sel.pacientes!);
    if (!confirm(`Mandar pelo WhatsApp o pedido de confirmação para ${nome}?\n(${fmtData(sel.inicio)} às ${fmtHora(sel.inicio)})`)) return;
    setAviso(null);
    setOcupado(true);
    try {
      const r = await whatsapp<{ enviados: number; sem_autorizacao: number; nao_perguntado: number; sem_celular: number; falhas: string[]; total: number }>(
        "lembretes", { agendamento_id: sel.id });
      if (r.enviados) setAviso({ tipo: "ok", texto: `Pedido de confirmação enviado para ${nome}. Quando tocar em “Confirmar presença”, fica confirmado sozinho.` });
      else if (!r.total) setAviso({ tipo: "erro", texto: "Só dá para pedir confirmação de agendamento que ainda está “Agendado”." });
      else if (r.nao_perguntado) setAviso({ tipo: "erro", texto: `${nome} ainda não disse se aceita mensagens no WhatsApp. Marque no cadastro do paciente.` });
      else if (r.sem_autorizacao) setAviso({ tipo: "erro", texto: `${nome} não aceita mensagens no WhatsApp.` });
      else if (r.sem_celular) setAviso({ tipo: "erro", texto: `${nome} não tem celular válido no cadastro.` });
      else setAviso({ tipo: "erro", texto: r.falhas.join(" ") || "Não foi possível enviar." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: msgErro(e) });
    }
    setOcupado(false);
  }

  // ---------- Busca de paciente na agenda ----------
  async function buscarPaciente(p: PacienteResumo) {
    setAviso(null);
    const desde = somaDias(inicioDoDia(new Date()), -90);
    const r = await supabase.from("agendamentos").select(SELECT_AGENDA).eq("paciente_id", p.id)
      .gte("inicio", desde.toISOString()).order("inicio").limit(40);
    if (r.error) return setAviso({ tipo: "erro", texto: msgErro(r.error) });
    setBusca({ paciente: p, ags: (r.data ?? []) as Agendamento[] });
  }
  function irPara(a: Agendamento) {
    setDia(inicioDoDia(new Date(a.inicio)));
    if (!colunas.some((c) => c.id === colDe(a.profissional_id))) setFiltro("todos");
    setPeriodo("dia");
    setSelecionado(a);
    setBusca(null);
  }
  const diaConfirmacoes = isoDia(dia > inicioDoDia(new Date()) ? dia : somaDias(inicioDoDia(new Date()), 1));

  // Faixa de horas exibida: do primeiro ao último horário de atendimento (padrão 7h–19h)
  const { iniMin, fimMin } = useMemo(() => {
    const hs = (doDia.dados?.horarios ?? []).filter((h) => colunas.some((c) => c.id === h.profissional_id));
    let a = 7 * 60, b = 19 * 60;
    if (hs.length) {
      a = Math.min(...hs.map((h) => minutosDoDia(h.hora_inicio)));
      b = Math.max(...hs.map((h) => minutosDoDia(h.hora_fim)));
    }
    for (const ag of doDia.dados?.ags ?? []) {
      const i = new Date(ag.inicio);
      a = Math.min(a, i.getHours() * 60 + i.getMinutes());
      b = Math.max(b, i.getHours() * 60 + i.getMinutes() + PASSO);
    }
    return { iniMin: Math.floor(a / PASSO) * PASSO, fimMin: Math.ceil(b / PASSO) * PASSO };
  }, [doDia.dados, colunas, PASSO]);

  const per = PERIODOS[periodo];
  const linhas: number[] = [];
  for (let m = iniMin; m < fimMin; m += PASSO) if (m >= per.de && m < per.ate) linhas.push(m);
  const minDe = (iso: string) => { const i = new Date(iso); return i.getHours() * 60 + i.getMinutes(); };

  function horarioDe(profId: string, min: number) {
    return doDia.dados?.horarios.find(
      (h) => h.profissional_id === profId && min >= minutosDoDia(h.hora_inicio) && min < minutosDoDia(h.hora_fim),
    );
  }
  function bloqueado(profId: string, min: number) {
    const t = new Date(dia.getTime() + min * 60000);
    return doDia.dados?.bloqueios.find(
      (b) => (!b.profissional_id || b.profissional_id === profId) && new Date(b.inicio) <= t && new Date(b.fim) > t,
    );
  }
  function agsNaCelula(profId: string, min: number) {
    return (doDia.dados?.ags ?? []).filter((a) => {
      if (colDe(a.profissional_id) !== profId) return false;
      if (!mostrarCancelados && a.status === "cancelado") return false;
      const i = new Date(a.inicio);
      const m = i.getHours() * 60 + i.getMinutes();
      return m >= min && m < min + PASSO;
    });
  }

  const ags = (doDia.dados?.ags ?? []).filter((a) => colunas.some((c) => c.id === colDe(a.profissional_id)));
  const total = ags.filter((a) => a.status !== "cancelado").length;

  // Visão em lista (como a grade do Micrologos): agendamentos do período + horários vagos, se pedido
  type LinhaLista = { min: number; col: string; ag?: Agendamento; vago?: { duracao: number; local_id: string | null } };
  const lista: LinhaLista[] = useMemo(() => {
    const r: LinhaLista[] = ags
      .filter((a) => (mostrarCancelados || a.status !== "cancelado") && minDe(a.inicio) >= per.de && minDe(a.inicio) < per.ate)
      .map((a) => ({ min: minDe(a.inicio), col: colDe(a.profissional_id), ag: a }));
    if (mostrarVagos) {
      for (const c of colunas) {
        for (const h of (doDia.dados?.horarios ?? []).filter((x) => x.profissional_id === c.id)) {
          const passo = Math.max(5, h.duracao_min || PASSO);
          for (let m = minutosDoDia(h.hora_inicio); m + passo <= minutosDoDia(h.hora_fim); m += passo) {
            if (m < per.de || m >= per.ate || bloqueado(c.id, m)) continue;
            const ocupado = ags.some((a) => a.status !== "cancelado" && colDe(a.profissional_id) === c.id && minDe(a.inicio) >= m && minDe(a.inicio) < m + passo);
            if (!ocupado) r.push({ min: m, col: c.id, vago: { duracao: passo, local_id: h.local_id } });
          }
        }
      }
    }
    const ordemCol = (id: string) => colunas.findIndex((c) => c.id === id);
    return r.sort((a, b) => a.min - b.min || ordemCol(a.col) - ordemCol(b.col));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doDia.dados, colunas, periodo, mostrarVagos, mostrarCancelados]);
  const nomeCol = (id: string) => { const m = medicos.find((x) => x.id === id); return m ? nomeAgenda(m) : ""; };
  const nomeConv = (id?: string | null) => base.dados?.convenios.find((c) => c.id === id)?.nome ?? "";
  const ativoSel = sel && !["cancelado", "faltou", "atendido"].includes(sel.status);

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Agenda</h1>
          <p className="sub" style={{ margin: 0 }}>{fmtDataLonga(dia)} · {total} agendamento(s)</p>
        </div>
        <div className="linha">
          <button onClick={() => setDia(somaDias(dia, -1))} aria-label="Dia anterior">◀</button>
          <button onClick={() => setDia(inicioDoDia(new Date()))}>Hoje</button>
          <button onClick={() => setDia(somaDias(dia, 1))} aria-label="Próximo dia">▶</button>
          <input type="date" style={{ width: 160 }} value={isoDia(dia)} onChange={(e) => e.target.value && setDia(new Date(e.target.value + "T00:00:00"))} />
          <select style={{ width: 220 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todas as agendas</option>
            {medicos.map((m) => <option key={m.id} value={ehAgendaOrientacao(m) ? "orientacao" : m.id}>{nomeAgenda(m)}</option>)}
          </select>
          <button className="primario" onClick={() => setNovo({ profissional_id: filtro === "todos" ? undefined : filtro === "orientacao" ? colunas[0]?.id : filtro, inicio: new Date(dia.getTime() + 8 * 3600000) })}>➕ Agendar</button>
          {podeWhats && <button onClick={() => setConfirmacoes(true)} title="Manda pelo WhatsApp o pedido de confirmação para todos os agendados do dia">📲 Confirmações do dia</button>}
        </div>
      </div>
      <div className="agenda-busca">
        <BuscaPaciente aoEscolher={buscarPaciente} placeholder="🔎 Buscar paciente na agenda (nome, prontuário, CPF ou telefone)" />
      </div>
      <Aviso>{base.erro || doDia.erro}</Aviso>
      {base.dados && (
        <div className="agenda-topo">
          <div className="painel" style={{ padding: 10 }}>
            <MiniCalendario dia={dia} aoEscolher={(d) => { setDia(inicioDoDia(d)); setSelecionado(null); }} colunas={colunas.flatMap((c) => c.membros ?? [c.id])} versao={versao} />
          </div>
          <div className="painel" style={{ padding: 10 }}>
            <ResumoAgendamento
              ag={sel}
              nomeDe={nomeDe}
              convenio={(id) => base.dados!.convenios.find((c) => c.id === id)?.nome ?? ""}
              agenda={(id) => { const m = medicos.find((x) => x.id === colDe(id)); return m ? nomeAgenda(m) : ""; }}
              aoAbrir={() => sel && setAberto(sel)}
              aoSalvarNotas={async (texto) => {
                if (!sel) return "";
                const { error } = await supabase.from("agendamentos").update({ observacoes: texto || null }).eq("id", sel.id);
                if (error) return msgErro(error);
                doDia.recarregar();
                return "";
              }}
            />
          </div>
        </div>
      )}
      {base.dados && (
        <div className="painel barra-rapida">
          <span className="pequeno muted barra-rapida-quem">
            {sel ? <><b>{nomeExibicao(sel.pacientes!)}</b> · {fmtHora(sel.inicio)} · {STATUS_AGENDA[sel.status]?.rotulo}</> : "Selecione um paciente na agenda (um clique) para usar os botões"}
          </span>
          <button onClick={() => setNovo({ profissional_id: sel ? sel.profissional_id : filtro === "todos" ? undefined : filtro === "orientacao" ? colunas[0]?.id : filtro, inicio: sel ? new Date(sel.inicio) : new Date(dia.getTime() + 8 * 3600000) })}>➕ Incluir</button>
          <button disabled={!sel} title="Encaixar outro paciente no mesmo horário e médico do selecionado"
            onClick={() => sel && setNovo({ profissional_id: sel.profissional_id, inicio: new Date(sel.inicio), duracao: 15, encaixe: true })}>⤵️ Encaixar</button>
          <button disabled={ocupado || !sel || !["agendado", "confirmado"].includes(sel.status)} onClick={chegada}>🛎️ Chegada</button>
          <button disabled={ocupado || !sel || !["chegou", "em_atendimento"].includes(sel.status)} title="Precisa ter chegado antes" onClick={() => mudar({ status: "atendido" }, `${nomeExibicao(sel!.pacientes!)}: atendido.`)}>✅ Atendido</button>
          <button disabled={!sel} title="Marcar o retorno deste paciente" onClick={retorno}>🔁 Retorno</button>
          <select className="barra-status" disabled={ocupado || !sel} value="" onChange={(e) => mudarStatus(e.target.value)}>
            <option value="">Status…</option>
            <option value="agendado">Agendado</option>
            <option value="confirmado:telefone">Confirmado (telefone)</option>
            <option value="confirmado:whatsapp">Confirmado (WhatsApp)</option>
            <option value="confirmado:presencial">Confirmado (presencial)</option>
            <option value="chegou">Na espera (chegou)</option>
            <option value="atendido">Atendido</option>
            <option value="faltou">Faltou</option>
            <option value="cancelado">Cancelar…</option>
          </select>
          <button disabled={!sel} onClick={() => document.getElementById("resumo-notas")?.focus()}>📝 Nota</button>
          {podeWhats && <button disabled={ocupado || !sel || sel.status !== "agendado" || sel.tipo === "orientacao"} title="Manda pelo WhatsApp o pedido para o paciente confirmar" onClick={pedirConfirmacao}>📲 Pedir confirmação</button>}
          <button disabled={!sel} onClick={() => sel && abrir(sel, ativoSel ? "remarcar" : "")}>🔁 Remarcar</button>
          <button disabled={!sel} onClick={() => sel && abrir(sel)}>Abrir…</button>
        </div>
      )}
      {sel?.tipo === "orientacao" && sel.paciente_id && <CirurgiaVendidaAgenda pacienteId={sel.paciente_id} />}
      {aviso && <Aviso tipo={aviso.tipo === "ok" ? "ok" : undefined}>{aviso.texto}</Aviso>}
      {base.carregando || (doDia.carregando && !doDia.dados) ? <Carregando /> : medicos.length === 0 ? (
        <div className="painel vazio">
          Nenhum médico cadastrado ainda. A administração cadastra a equipe em <b>Cadastros → Equipe</b> e os horários em <b>Horários e bloqueios</b>.
        </div>
      ) : (
        <div className="painel" style={{ padding: 0 }}>
          <div className="linha pequeno muted" style={{ padding: "10px 14px", borderBottom: "1px solid var(--borda)" }}>
            <span className="grupo-botoes">
              <button className={visao === "grade" ? "primario mini" : "mini"} onClick={() => setVisao("grade")}>▦ Grade</button>
              <button className={visao === "lista" ? "primario mini" : "mini"} onClick={() => setVisao("lista")}>☰ Lista</button>
            </span>
            <span className="grupo-botoes">
              {Object.entries(PERIODOS).map(([k, v]) => (
                <button key={k} className={periodo === k ? "primario mini" : "mini"} onClick={() => setPeriodo(k)}>{v.rotulo}</button>
              ))}
            </span>
            {visao === "grade"
              ? <span>Clique num horário livre para agendar · listrado = fora do horário do médico</span>
              : <label className="check"><input type="checkbox" checked={mostrarVagos} onChange={(e) => setMostrarVagos(e.target.checked)} /> mostrar horários vagos</label>}
            <label className="check" style={{ marginLeft: "auto" }}><input type="checkbox" checked={mostrarCancelados} onChange={(e) => setMostrarCancelados(e.target.checked)} /> mostrar cancelados</label>
          </div>
          {visao === "lista" ? (
            <div className="agenda-wrap">
              <table className="tabela agenda-lista">
                <thead>
                  <tr><th>Hora</th><th>Paciente</th>{colunas.length > 1 && <th>Agenda</th>}<th>Convênio</th><th>Status / chegada</th><th>Notas</th></tr>
                </thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={6} className="muted">Nada neste período.</td></tr>}
                  {lista.map((l) => {
                    const hora = `${String(Math.floor(l.min / 60)).padStart(2, "0")}:${String(l.min % 60).padStart(2, "0")}`;
                    if (!l.ag) {
                      return (
                        <tr key={"v" + l.col + l.min} className="vago" onClick={() => setNovo({ profissional_id: l.col, inicio: new Date(dia.getTime() + l.min * 60000), duracao: l.vago!.duracao, local_id: l.vago!.local_id })}>
                          <td>{hora}</td><td className="muted">— vago (clique para agendar) —</td>{colunas.length > 1 && <td>{nomeCol(l.col)}</td>}<td /><td /><td />
                        </tr>
                      );
                    }
                    const a = l.ag;
                    const st = STATUS_AGENDA[a.status];
                    return (
                      <tr key={a.id} className={"st-" + st.cor + (sel?.id === a.id ? " sel" : "")} onClick={() => setSelecionado(a)} onDoubleClick={() => abrir(a)}>
                        <td><b>{fmtHora(a.inicio)}</b></td>
                        <td>
                          {nomeExibicao(a.pacientes!)}
                          <div className="pequeno muted">
                            {a.tipo === "orientacao" ? "Orientação" : TIPOS_AGENDA[a.tipo]}{a.primeira_vez && " · 1ª vez"}{a.encaixe && " · encaixe"} · Pront. {a.pacientes!.numero_prontuario}
                          </div>
                        </td>
                        {colunas.length > 1 && <td>{nomeCol(l.col)}{a.cirurgiao_id && <div className="pequeno">🩺 {nomeDe(a.cirurgiao_id)}</div>}</td>}
                        <td>{nomeConv(a.convenio_id) || "Particular"}</td>
                        <td><span className={"etiqueta " + st.cor}>{st.rotulo}</span>{a.chegada_em && <div className="pequeno muted">chegou {fmtHora(a.chegada_em)}</div>}</td>
                        <td className="nota-lista">{a.observacoes ? `📝 ${a.observacoes}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
          <div className="agenda-wrap">
            <div className="agenda" style={{ gridTemplateColumns: `64px repeat(${colunas.length}, minmax(200px, 1fr))` }}>
              <div className="col-cab" />
              {colunas.map((c) => (
                <div key={c.id} className="col-cab">
                  {nomeAgenda(c)}
                  {ehAgendaOrientacao(c) && <div className="pequeno muted" style={{ fontWeight: 400 }}>só registro, sem faturamento</div>}
                  <button className="obs-dia" title="Observação do dia desta agenda"
                    onClick={() => setEditObs({ profissional_id: c.id, nome: nomeAgenda(c), texto: doDia.dados?.obsDia.get(c.id) ?? "" })}>
                    {doDia.dados?.obsDia.get(c.id) ? <>📌 {doDia.dados.obsDia.get(c.id)}</> : <span className="muted">＋ obs. do dia</span>}
                  </button>
                </div>
              ))}
              {linhas.map((min) => (
                <Linha key={min} min={min}>
                  {colunas.map((c) => {
                    const h = horarioDe(c.id, min);
                    const b = bloqueado(c.id, min);
                    const itens = agsNaCelula(c.id, min);
                    const classe = b ? "bloqueado" : h ? "livre" : "fora livre";
                    return (
                      <div
                        key={c.id}
                        className={"celula " + classe}
                        title={b ? `Bloqueado: ${b.motivo}` : undefined}
                        onClick={(e) => {
                          if (e.target !== e.currentTarget) return;
                          setNovo({
                            profissional_id: c.id,
                            inicio: new Date(dia.getTime() + min * 60000),
                            duracao: h?.duracao_min ?? PASSO,
                            local_id: h?.local_id,
                            // encaixe = horário que já tem paciente (agenda cheia). Fora do expediente NÃO é encaixe.
                            encaixe: itens.some((x) => !["cancelado", "faltou", "atendido"].includes(x.status)),
                          });
                        }}
                      >
                        {b && itens.length === 0 && min === Math.max(iniMin, minutosBloqueio(b, dia, PASSO)) && <span className="pequeno muted">🚫 {b.motivo}</span>}
                        {itens.map((a) => {
                          const st = STATUS_AGENDA[a.status];
                          return (
                            <button key={a.id} className={"ag-item " + st.cor + (sel?.id === a.id ? " sel" : "")}
                              onClick={() => setSelecionado(a)} onDoubleClick={() => abrir(a)}>
                              <b>{fmtHora(a.inicio)}</b> {nomeExibicao(a.pacientes!)}
                              {a.cirurgiao_id && <div className="ag-cirurgiao">🩺 {nomeDe(a.cirurgiao_id)}</div>}
                              <div className="pequeno muted">
                                {a.tipo === "orientacao"
                                  ? <>{st.rotulo}</>
                                  : <>{TIPOS_AGENDA[a.tipo]}{a.primeira_vez && " · 1ª vez"}{a.encaixe && " · encaixe"} · {st.rotulo}</>}
                              </div>
                              {a.observacoes && <div className="ag-nota">📝 {a.observacoes}</div>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </Linha>
              ))}
            </div>
          </div>
          )}
        </div>
      )}
      {novo && base.dados && (
        <NovoAgendamento
          medicos={base.dados.medicos}
          convenios={base.dados.convenios}
          locais={base.dados.locais}
          inicial={novo}
          aoFechar={() => setNovo(null)}
          aoSalvar={() => { setNovo(null); recarregar(); }}
        />
      )}
      {aberto && base.dados && (
        <DetalheAgendamento
          ag={aberto}
          medicos={base.dados.medicos}
          convenios={base.dados.convenios}
          locais={base.dados.locais}
          modoInicial={modoAbrir}
          aoFechar={() => { setAberto(null); doDia.recarregar(); }}
          aoAlterar={() => { setAberto(null); recarregar(); }}
        />
      )}
      {confirmacoes && <Lembretes dataInicial={diaConfirmacoes} aoFechar={() => setConfirmacoes(false)} aoEnviar={recarregar} />}
      {busca && (
        <Modal titulo={`Agendamentos — ${nomeExibicao(busca.paciente)}`} aoFechar={() => setBusca(null)}
          rodape={<><button onClick={() => setBusca(null)}>Fechar</button>
            <button className="primario" onClick={() => { const p = busca.paciente; setBusca(null); setNovo({ paciente: p, inicio: new Date(dia.getTime() + 8 * 3600000), profissional_id: filtro === "todos" ? undefined : filtro === "orientacao" ? colunas[0]?.id : filtro }); }}>➕ Agendar este paciente</button></>}>
          <p className="muted pequeno" style={{ marginTop: 0 }}>Últimos 90 dias e próximos agendamentos. Clique para ir ao dia na agenda.</p>
          {busca.ags.length === 0 ? <p>Nenhum agendamento encontrado.</p> : (
            <table className="tabela">
              <tbody>
                {busca.ags.map((a) => {
                  const st = STATUS_AGENDA[a.status];
                  const futuro = new Date(a.inicio) >= inicioDoDia(new Date());
                  return (
                    <tr key={a.id} className="clicavel" onClick={() => irPara(a)} style={futuro ? undefined : { opacity: 0.7 }}>
                      <td><b>{fmtData(a.inicio)}</b> {fmtHora(a.inicio)}</td>
                      <td>{nomeCol(colDe(a.profissional_id))}</td>
                      <td>{TIPOS_AGENDA[a.tipo]}</td>
                      <td><span className={"etiqueta " + st.cor}>{st.rotulo}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Modal>
      )}
      {editObs && (
        <Modal titulo={`Observação do dia — ${editObs.nome}`} aoFechar={() => setEditObs(null)}
          rodape={<><button onClick={() => setEditObs(null)}>Cancelar</button><button className="primario" onClick={salvarObs}>Salvar</button></>}>
          <p className="muted pequeno" style={{ marginTop: 0 }}>{fmtDataLonga(dia)}. Aparece no topo da coluna para toda a equipe (ex.: “chega às 10h”, “não atende convênio X hoje”). Deixe em branco para apagar.</p>
          <textarea rows={4} autoFocus value={editObs.texto} onChange={(e) => setEditObs({ ...editObs, texto: e.target.value })} />
        </Modal>
      )}
    </div>
  );
}

function minutosBloqueio(b: Bloqueio, dia: Date, passo: number) {
  const i = new Date(b.inicio);
  if (i < dia) return 0;
  return Math.floor((i.getHours() * 60 + i.getMinutes()) / passo) * passo;
}

function Linha({ min, children }: { min: number; children: React.ReactNode }) {
  const h = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  return (
    <>
      <div className="hora">{min % 60 === 0 ? <b>{h}</b> : h}</div>
      {children}
    </>
  );
}
