import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { CLINICA } from "../lib/marca";
import { htmlParaTexto } from "../components/Legado";
import { TIPOS_AGENDA, fmtCPF, fmtData, fmtDataHora, fmtGrau, idade } from "../lib/util";

/**
 * Cópia do prontuário completo para entregar ao paciente (pedido da dona, 24/11/2026).
 * Toda a equipe pode imprimir; cada impressão fica registrada na auditoria (registrar_leitura).
 * Período opcional (?de=AAAA-MM-DD&ate=AAAA-MM-DD).
 */
type R = Record<string, unknown>;
interface Prof { id: string; nome: string; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null; especialidade: string | null }

const t = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));
const OLHO: Record<string, string> = { OD: "olho direito", OE: "olho esquerdo", AO: "ambos os olhos" };

function Campo({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  const v = t(valor);
  if (!v) return null;
  return <p className="pp-campo"><b>{rotulo}:</b> <span style={{ whiteSpace: "pre-wrap" }}>{v}</span></p>;
}
function ODOE({ rotulo, od, oe }: { rotulo: string; od: unknown; oe: unknown }) {
  if (!t(od) && !t(oe)) return null;
  return <p className="pp-campo"><b>{rotulo}:</b> {t(od) && <>OD: {t(od)}</>}{t(od) && t(oe) && " · "}{t(oe) && <>OE: {t(oe)}</>}</p>;
}
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="pp-secao"><h3>{titulo}</h3>{children}</div>;
}

export default function ImprimirProntuario() {
  const { id } = useParams();
  const { eu } = useAuth();
  const q = new URLSearchParams(window.location.search);
  const [de, setDe] = useState(q.get("de") ?? "");
  const [ate, setAte] = useState(q.get("ate") ?? "");

  const { dados, erro, carregando } = useCarregar(async () => {
    const dentro = (d: string | null | undefined) => !!d && (!de || d.slice(0, 10) >= de) && (!ate || d.slice(0, 10) <= ate);
    const [pac, ale, med, ant, ats, leg, exs, cirs, injs, profs] = await Promise.all([
      supabase.from("pacientes").select("*").eq("id", id!).single(),
      supabase.from("alergias").select("*").eq("paciente_id", id!).eq("ativa", true),
      supabase.from("medicamentos_em_uso").select("*").eq("paciente_id", id!).eq("ativo", true),
      supabase.from("antecedentes").select("*").eq("paciente_id", id!),
      supabase.from("atendimentos").select(`*, triagens(*), exames_oftalmologicos(*), refracoes(*), diagnosticos(*),
        prescricoes(*, prescricao_itens(*)), prescricoes_oculos(*), solicitacoes_exames(*), documentos_clinicos(*), adendos(*)`)
        .eq("paciente_id", id!).order("inicio"),
      supabase.from("prontuario_legado").select("*").eq("paciente_id", id!).order("data").limit(2000),
      supabase.from("exames_realizados").select("*").eq("paciente_id", id!).not("laudado_em", "is", null).order("laudado_em"),
      supabase.from("cirurgias").select("*").eq("paciente_id", id!).not("finalizada_em", "is", null).order("finalizada_em"),
      supabase.from("injecoes_intravitreas").select("*").eq("paciente_id", id!).eq("cancelada", false).order("aplicado_em"),
      supabase.from("profissionais").select("id, nome, conselho, numero_conselho, uf_conselho, especialidade"),
    ]);
    const p = ok(pac) as R;
    // linha do tempo única, em ordem de data
    type Ev = { quando: string; tipo: "atend" | "legado" | "exame" | "cirurgia" | "injecao"; r: R };
    const ev: Ev[] = [
      ...(ok(ats) as R[]).map((r) => ({ quando: r.inicio as string, tipo: "atend" as const, r })),
      ...(ok(leg) as R[]).map((r) => ({ quando: r.data as string, tipo: "legado" as const, r })),
      ...(ok(exs) as R[]).map((r) => ({ quando: r.laudado_em as string, tipo: "exame" as const, r })),
      ...(ok(cirs) as R[]).map((r) => ({ quando: r.finalizada_em as string, tipo: "cirurgia" as const, r })),
      ...(ok(injs) as R[]).map((r) => ({ quando: r.aplicado_em as string, tipo: "injecao" as const, r })),
    ].filter((e) => dentro(e.quando)).sort((a, b) => a.quando.localeCompare(b.quando));
    return { p, ale: ok(ale) as R[], med: ok(med) as R[], ant: ok(ant) as R[], ev, profs: ok(profs) as Prof[] };
  }, [id, de, ate]);

  // registra na auditoria que o prontuário foi impresso (LGPD)
  useEffect(() => {
    if (dados) supabase.rpc("registrar_leitura", {
      p_paciente_id: id, p_detalhes: `Imprimiu o prontuário${de || ate ? ` (período ${de || "início"} a ${ate || "hoje"})` : " completo"}`,
    }).then(() => {});
  }, [dados, id, de, ate]);

  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Aviso>{erro}</Aviso>;
  const { p, ale, med, ant, ev, profs } = dados;
  const prof = (pid: unknown) => profs.find((x) => x.id === pid);
  const assinaturaProf = (pid: unknown) => {
    const m = prof(pid);
    return m ? `${m.nome} — ${m.conselho ?? "CRM"} ${m.numero_conselho ?? ""}${m.uf_conselho ? `/${m.uf_conselho}` : ""}` : "";
  };
  const contato = [CLINICA.telefone, CLINICA.cnpj && `CNPJ ${CLINICA.cnpj}`, CLINICA.site].filter(Boolean).join(" · ");
  const nome = p.nome_social ? `${p.nome_social} (${p.nome})` : t(p.nome);

  return (
    <div style={{ background: "#e9edf1", minHeight: "100vh", padding: "20px 0" }}>
      <style>{`
        .pp h2 { font-size: 1.05rem; border-bottom: 1px solid #999; padding-bottom: 3px; margin: 22px 0 8px; }
        .pp-evento { border: 1px solid #bbb; border-radius: 6px; padding: 10px 14px; margin: 12px 0; break-inside: avoid-page; }
        .pp-evento h3, .pp-secao h3 { font-size: .95rem; margin: 6px 0 4px; }
        .pp-cab { display: flex; justify-content: space-between; gap: 10px; font-weight: 600; border-bottom: 1px dashed #bbb; padding-bottom: 4px; margin-bottom: 6px; }
        .pp-campo { margin: 3px 0; font-size: 13px; line-height: 1.45; }
        .pp-ass { font-size: 12px; color: #333; margin-top: 8px; font-style: italic; }
        .pp .folha table { font-size: 12px; }
        @media print { .pp .folha { padding: 0; min-height: 0; } }
      `}</style>
      <div className="barra-impressao" style={{ flexWrap: "wrap", alignItems: "end" }}>
        <button className="primario" onClick={() => window.print()}>🖨️ Imprimir</button>
        <button onClick={() => window.close()}>Fechar</button>
        <label className="pequeno">De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label className="pequeno">Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <span className="pequeno muted">Deixe as datas em branco para o prontuário completo. Cada impressão fica registrada.</span>
      </div>
      <div className="folha pp">
        <div className="timbre">
          <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ height: 46 }} />
          <div style={{ textAlign: "right", fontSize: 12, color: "#444", maxWidth: 360 }}>{CLINICA.razaoSocial}<br />{CLINICA.endereco}<br />{contato}</div>
        </div>
        <h1>PRONTUÁRIO DO PACIENTE</h1>
        <p style={{ textAlign: "center", marginTop: -10 }} className="pequeno">
          {de || ate ? `Período: ${de ? fmtData(de) : "início"} a ${ate ? fmtData(ate) : "hoje"}` : "Cópia integral"}
        </p>

        <h2>Identificação</h2>
        <p className="pp-campo"><b>Paciente:</b> {nome}</p>
        <p className="pp-campo">
          <b>Prontuário nº</b> {t(p.numero_prontuario)}
          {!!p.data_nascimento && <> · <b>Nascimento:</b> {fmtData(p.data_nascimento as string)} ({idade(p.data_nascimento as string)})</>}
          {!!p.cpf && <> · <b>CPF:</b> {fmtCPF(p.cpf as string)}</>}
        </p>
        <Campo rotulo="Nome da mãe" valor={p.nome_mae} />

        <h2>Informações de saúde</h2>
        <p className="pp-campo"><b>Alergias:</b> {ale.length ? ale.map((a) => `${a.substancia}${a.reacao ? ` (${a.reacao})` : ""}`).join("; ") : "nenhuma registrada"}</p>
        <p className="pp-campo"><b>Medicamentos em uso:</b> {med.length ? med.map((m) => `${m.medicamento}${m.posologia ? ` — ${m.posologia}` : ""}${m.olho ? ` (${m.olho})` : ""}`).join("; ") : "nenhum registrado"}</p>
        <p className="pp-campo"><b>Antecedentes:</b> {ant.length ? ant.map((a) => `${a.descricao}${a.olho ? ` (${a.olho})` : ""}`).join("; ") : "nenhum registrado"}</p>

        <h2>Histórico ({ev.length} registro{ev.length === 1 ? "" : "s"})</h2>
        {ev.length === 0 && <p className="pp-campo">Nenhum registro no período.</p>}
        {ev.map(({ tipo, r }) => {
          if (tipo === "atend") return <Atendimento key={r.id as string} r={r} assinatura={assinaturaProf(r.profissional_id)} nomeDe={(x) => prof(x)?.nome ?? ""} />;
          if (tipo === "legado") {
            const texto = r.conteudo ? (r.formato === "html" ? htmlParaTexto(r.conteudo as string) : (r.conteudo as string)) : "";
            return (
              <div key={r.id as string} className="pp-evento">
                <div className="pp-cab"><span>{fmtData(r.data as string)} · {t(r.titulo) || t(r.tipo)}</span><span>Registro do sistema anterior</span></div>
                {texto ? <p className="pp-campo" style={{ whiteSpace: "pre-wrap" }}>{texto}</p> : <p className="pp-campo">(registro sem texto{r.arquivo_caminho ? "; há arquivo anexado no sistema" : ""})</p>}
                {assinaturaProf(r.profissional_id) && <div className="pp-ass">{assinaturaProf(r.profissional_id)}</div>}
              </div>
            );
          }
          if (tipo === "exame") return (
            <div key={r.id as string} className="pp-evento">
              <div className="pp-cab"><span>{fmtData(r.laudado_em as string)} · Exame: {t(r.exame)}{r.olho ? ` (${r.olho})` : ""}</span><span>Laudo</span></div>
              <Campo rotulo="Laudo" valor={r.laudo} />
              <Campo rotulo="Conclusão" valor={r.conclusao} />
              <div className="pp-ass">Laudado por {assinaturaProf(r.laudado_por)} em {fmtDataHora(r.laudado_em as string)}</div>
            </div>
          );
          if (tipo === "cirurgia") return (
            <div key={r.id as string} className="pp-evento">
              <div className="pp-cab"><span>{fmtData(r.finalizada_em as string)} · Cirurgia: {t(r.procedimento)} ({t(r.olho)})</span><span>Descrição cirúrgica</span></div>
              <Campo rotulo="Anestesia" valor={r.anestesia} />
              {!!r.lio_modelo && <p className="pp-campo"><b>Lente intraocular:</b> {t(r.lio_fabricante)} {t(r.lio_modelo)} {fmtGrau(r.lio_dioptria as number)} · lote {t(r.lio_lote)}</p>}
              <Campo rotulo="Descrição" valor={r.descricao_cirurgica} />
              <Campo rotulo="Intercorrências" valor={r.intercorrencias} />
              <div className="pp-ass">Cirurgião: {assinaturaProf(r.cirurgiao_id)}</div>
            </div>
          );
          return (
            <div key={r.id as string} className="pp-evento">
              <div className="pp-cab"><span>{fmtData(r.aplicado_em as string)} · Injeção intravítrea: {t(r.medicamento)} ({t(r.olho)})</span><span>Procedimento</span></div>
              <Campo rotulo="Indicação" valor={[r.indicacao_cid10, r.indicacao].filter(Boolean).join(" — ")} />
              <Campo rotulo="Dose / lote" valor={[r.dose, r.lote && `lote ${r.lote}`].filter(Boolean).join(" · ")} />
              <Campo rotulo="Intercorrências" valor={r.intercorrencias} />
              <div className="pp-ass">Aplicado por {assinaturaProf(r.aplicado_por)}</div>
            </div>
          );
        })}

        <div style={{ marginTop: 28, fontSize: 12, borderTop: "1px solid #999", paddingTop: 8 }}>
          Documento emitido pelo sistema da {CLINICA.nome} em {fmtDataHora(new Date().toISOString())}{eu ? ` por ${eu.nome}` : ""}.
          Os registros foram feitos eletronicamente pelos profissionais indicados. Contém dados pessoais sensíveis de saúde
          (LGPD, Lei 13.709/2018) — uso exclusivo do paciente ou de seu representante legal.
        </div>
        <div className="assinatura" style={{ marginTop: 50 }}>
          <p style={{ textAlign: "left" }}>Declaro que recebi a cópia do meu prontuário ({ev.length} registro{ev.length === 1 ? "" : "s"}).</p>
          <p style={{ textAlign: "left" }}>{CLINICA.cidade}, ____/____/________</p>
          <div className="traco" style={{ marginTop: 40 }} />
          Assinatura do paciente ou responsável legal · Documento: ____________________
        </div>
      </div>
    </div>
  );
}

function Atendimento({ r, assinatura, nomeDe }: { r: R; assinatura: string; nomeDe: (id: unknown) => string }) {
  const um = (k: string) => ((r[k] as R[] | null) ?? [])[0];
  const lista = (k: string) => (r[k] as R[] | null) ?? [];
  const tri = um("triagens");
  const ex = um("exames_oftalmologicos");
  const diag = lista("diagnosticos");
  const refr = lista("refracoes");
  const oc = lista("prescricoes_oculos");
  const presc = lista("prescricoes");
  const sol = lista("solicitacoes_exames").filter((s) => s.status !== "cancelado");
  const docs = lista("documentos_clinicos");
  const ads = lista("adendos");
  return (
    <div className="pp-evento">
      <div className="pp-cab">
        <span>{fmtDataHora(r.inicio as string)} · {TIPOS_AGENDA[r.tipo as string] ?? t(r.tipo)}</span>
        <span>{r.status === "finalizado" ? `Finalizado ${fmtDataHora(r.finalizado_em as string)}` : "Em andamento"}</span>
      </div>
      <Campo rotulo="Queixa principal" valor={r.queixa_principal} />
      <Campo rotulo="História da doença atual" valor={r.historia_doenca_atual} />
      <Campo rotulo="Revisão de sistemas" valor={r.revisao_sistemas} />
      {tri && (
        <Secao titulo="Pré-consulta">
          <ODOE rotulo="Acuidade visual longe s/ correção" od={tri.av_longe_od_sc} oe={tri.av_longe_oe_sc} />
          <ODOE rotulo="Acuidade visual longe c/ correção" od={tri.av_longe_od_cc} oe={tri.av_longe_oe_cc} />
          <ODOE rotulo="Acuidade visual perto" od={tri.av_perto_od} oe={tri.av_perto_oe} />
          <ODOE rotulo={`Pressão intraocular${tri.pio_metodo ? ` (${tri.pio_metodo})` : ""}`} od={tri.pio_od && `${tri.pio_od} mmHg`} oe={tri.pio_oe && `${tri.pio_oe} mmHg`} />
          {!!tri.pressao_sistolica && <p className="pp-campo"><b>Pressão arterial:</b> {t(tri.pressao_sistolica)}/{t(tri.pressao_diastolica)} mmHg</p>}
          <Campo rotulo="Observações" valor={tri.observacoes} />
        </Secao>
      )}
      {refr.length > 0 && (
        <Secao titulo="Refração">
          {refr.map((x) => (
            <p key={x.id as string} className="pp-campo">
              <b>{t(x.tipo)} {t(x.olho)}:</b> {fmtGrau(x.esferico as number)} {x.cilindrico !== null && <>{fmtGrau(x.cilindrico as number)} × {t(x.eixo)}°</>}
              {x.adicao !== null && <> · adição {fmtGrau(x.adicao as number)}</>}{x.acuidade_visual ? <> · AV {t(x.acuidade_visual)}</> : null}
            </p>
          ))}
        </Secao>
      )}
      {ex && (
        <Secao titulo="Exame oftalmológico">
          <Campo rotulo="Ectoscopia" valor={ex.ectoscopia} />
          <Campo rotulo="Motilidade ocular" valor={ex.motilidade_ocular} />
          <Campo rotulo="Reflexos pupilares" valor={ex.reflexos_pupilares} />
          <ODOE rotulo="Biomicroscopia" od={ex.biomicroscopia_od} oe={ex.biomicroscopia_oe} />
          <ODOE rotulo="Gonioscopia" od={ex.gonioscopia_od} oe={ex.gonioscopia_oe} />
          <ODOE rotulo="Tonometria de aplanação" od={ex.pio_aplanacao_od && `${ex.pio_aplanacao_od} mmHg`} oe={ex.pio_aplanacao_oe && `${ex.pio_aplanacao_oe} mmHg`} />
          <ODOE rotulo="Fundoscopia" od={ex.fundoscopia_od} oe={ex.fundoscopia_oe} />
          <Campo rotulo="Outros achados" valor={ex.outros_achados} />
        </Secao>
      )}
      {diag.length > 0 && (
        <Secao titulo="Diagnóstico">
          {diag.map((d) => <p key={d.id as string} className="pp-campo">{t(d.cid10)} — {t(d.descricao)}{d.olho ? ` (${OLHO[d.olho as string] ?? d.olho})` : ""}{d.principal ? " · principal" : ""}</p>)}
        </Secao>
      )}
      <Campo rotulo="Conduta" valor={r.conduta} />
      <Campo rotulo="Orientações" valor={r.orientacoes} />
      <Campo rotulo="Retorno" valor={r.retorno_em} />
      {presc.length > 0 && (
        <Secao titulo="Receitas">
          {presc.map((pr) => ((pr.prescricao_itens as R[]) ?? []).map((i) => (
            <p key={i.id as string} className="pp-campo">• {t(i.medicamento)}{i.apresentacao ? ` ${i.apresentacao}` : ""} — {t(i.posologia)}{i.olho ? ` (${i.olho})` : ""}{i.duracao ? `, por ${i.duracao}` : ""}</p>
          )))}
        </Secao>
      )}
      {oc.length > 0 && (
        <Secao titulo="Receita de óculos">
          {oc.map((o) => (
            <p key={o.id as string} className="pp-campo">
              OD {fmtGrau(o.longe_od_esferico as number)} {fmtGrau(o.longe_od_cilindrico as number)} × {t(o.longe_od_eixo)}° ·
              OE {fmtGrau(o.longe_oe_esferico as number)} {fmtGrau(o.longe_oe_cilindrico as number)} × {t(o.longe_oe_eixo)}°
              {o.adicao !== null && <> · adição {fmtGrau(o.adicao as number)}</>}
            </p>
          ))}
        </Secao>
      )}
      {sol.length > 0 && <Secao titulo="Exames solicitados"><p className="pp-campo">{sol.map((s) => `${s.exame}${s.olho ? ` (${s.olho})` : ""}`).join("; ")}</p></Secao>}
      {docs.length > 0 && (
        <Secao titulo="Documentos emitidos">
          {docs.map((d) => <p key={d.id as string} className="pp-campo" style={{ whiteSpace: "pre-wrap" }}><b>{t(d.tipo)}:</b> {t(d.conteudo)}</p>)}
        </Secao>
      )}
      {ads.length > 0 && (
        <Secao titulo="Adendos">
          {ads.map((a) => <p key={a.id as string} className="pp-campo">{fmtDataHora(a.criado_em as string)} — {t(a.texto)} <i>({nomeDe(a.autor_id)})</i></p>)}
        </Secao>
      )}
      {assinatura && <div className="pp-ass">Registrado eletronicamente por {assinatura}</div>}
    </div>
  );
}
