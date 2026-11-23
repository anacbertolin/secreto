import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { NovoAgendamento, DetalheAgendamento } from "../components/AgendamentoModais";
import { MiniCalendario, ResumoAgendamento } from "../components/AgendaTopo";
import { Modal } from "../components/ui";
import {
  listaAgendas, listaConvenios, listaLocais, nomeAgenda, ehAgendaOrientacao, colunaDoAgendamento, SELECT_AGENDA,
  type Agendamento, type Horario, type Bloqueio,
} from "../lib/dados";
import { STATUS_AGENDA, TIPOS_AGENDA, fmtDataLonga, fmtHora, inicioDoDia, isoDia, somaDias, nomeExibicao } from "../lib/util";
import { msgErro } from "../lib/supabase";

// minutos por linha da grade: 15 (médicos); 10 quando só a agenda da Orientação Cirúrgica está na tela
const PASSO_PADRAO = 15;

function minutosDoDia(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function Agenda() {
  const { eu } = useAuth();
  const [dia, setDia] = useState(() => inicioDoDia(new Date()));
  // Médico abre na própria agenda; quem atende a orientação abre na agenda da Orientação Cirúrgica
  const [filtro, setFiltro] = useState<string>(eu?.funcao === "medico" ? eu.id : ehAgendaOrientacao(eu) ? "orientacao" : "todos");
  const [novo, setNovo] = useState<null | { profissional_id?: string; inicio?: Date; duracao?: number; local_id?: string | null; encaixe?: boolean }>(null);
  const [aberto, setAberto] = useState<Agendamento | null>(null);
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

  const linhas: number[] = [];
  for (let m = iniMin; m < fimMin; m += PASSO) linhas.push(m);

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
        </div>
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
            />
          </div>
        </div>
      )}
      {base.carregando || (doDia.carregando && !doDia.dados) ? <Carregando /> : medicos.length === 0 ? (
        <div className="painel vazio">
          Nenhum médico cadastrado ainda. A administração cadastra a equipe em <b>Cadastros → Equipe</b> e os horários em <b>Horários e bloqueios</b>.
        </div>
      ) : (
        <div className="painel" style={{ padding: 0 }}>
          <div className="linha pequeno muted" style={{ padding: "10px 14px", borderBottom: "1px solid var(--borda)" }}>
            Clique num horário livre para agendar · áreas listradas = fora do horário do médico (dá para encaixar mesmo assim)
            <label className="check" style={{ marginLeft: "auto" }}><input type="checkbox" checked={mostrarCancelados} onChange={(e) => setMostrarCancelados(e.target.checked)} /> mostrar cancelados</label>
          </div>
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
                            encaixe: !h || itens.length > 0,
                          });
                        }}
                      >
                        {b && itens.length === 0 && min === Math.max(iniMin, minutosBloqueio(b, dia, PASSO)) && <span className="pequeno muted">🚫 {b.motivo}</span>}
                        {itens.map((a) => {
                          const st = STATUS_AGENDA[a.status];
                          return (
                            <button key={a.id} className={"ag-item " + st.cor + (sel?.id === a.id ? " sel" : "")}
                              onClick={() => setSelecionado(a)} onDoubleClick={() => setAberto(a)}>
                              <b>{fmtHora(a.inicio)}</b> {nomeExibicao(a.pacientes!)}
                              <div className="pequeno muted">
                                {a.tipo === "orientacao"
                                  ? <>{a.observacoes ? `📝 ${a.observacoes}` : "Sem notas"} · {st.rotulo}</>
                                  : <>{TIPOS_AGENDA[a.tipo]}{a.primeira_vez && " · 1ª vez"}{a.encaixe && " · encaixe"} · {st.rotulo}</>}
                              </div>
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
          aoFechar={() => setAberto(null)}
          aoAlterar={() => { setAberto(null); recarregar(); }}
        />
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
