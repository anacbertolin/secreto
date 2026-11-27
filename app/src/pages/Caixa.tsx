// Caixa da Recepção — migração 0066 (pedido da dona, 18–19/11/2026).
// Substitui a folha de papel. Funciona sozinho (nome do paciente digitado), sem depender da agenda/prontuário.
// NÃO tem relação com o Repasse médico.
// Caminho: aberto (recepção lança) → fechado (conta a gaveta) → conferido (telefone/WhatsApp) → aprovado (Luciano/Soraline).
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth, type Profissional } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta, Modal, Campo } from "../components/ui";
import { fmtData, fmtDataHora, fmtMoeda } from "../lib/util";
import { AvisoCaixaOrientacao, MensagemCaixaFechado } from "../components/AvisoCaixaOrientacao";

// ------------------------------------------------------------------ tipos e utilidades
type Setor = "recepcao" | "orientacao";
export const SETORES: Record<Setor, string> = { recepcao: "Caixa da recepção", orientacao: "Caixa da Orientação Cirúrgica" };
interface CaixaRow {
  id: string; data: string; setor: Setor; status: "aberto" | "fechado" | "dinheiro_conferido" | "conferido" | "aprovado" | "cancelado"; fundo_troco: number;
  aberto_por: string | null; aberto_em: string; fechado_por: string | null; fechado_em: string | null;
  esperado_dinheiro: number | null; contado_dinheiro: number | null; diferenca_dinheiro: number | null; obs_fechamento: string | null;
  conferido_por: string | null; conferido_em: string | null; obs_conferencia: string | null;
  aprovado_por: string | null; aprovado_em: string | null; obs_aprovacao: string | null;
  devolvido_por: string | null; devolvido_em: string | null; motivo_devolucao: string | null;
  cancelado_por?: string | null; cancelado_em?: string | null; motivo_cancelamento?: string | null;
  reaberto_por?: string | null; reaberto_em?: string | null; motivo_reabertura?: string | null;
  dinheiro_conferido_por?: string | null; dinheiro_conferido_em?: string | null; dinheiro_recebido?: number | null; obs_dinheiro?: string | null;
  check_cartoes_em?: string | null; obs_cartoes?: string | null; check_pix_em?: string | null; obs_pix?: string | null;
  check_notas_em?: string | null; obs_notas?: string | null;
}
interface Pagamento {
  id: string; caixa_id: string; atendimento_id: string; forma: Forma; parcelas: number; valor: number; pagador: string | null;
  cancelado: boolean; motivo_cancelamento: string | null; criado_por: string | null; criado_em: string;
  caixa_atendimentos?: { paciente_nome: string; caixa_id: string; descricao: string | null } | null;
}
interface Atendimento {
  id: string; caixa_id: string; paciente_nome: string; medico_id: string | null; descricao: string | null; valor: number;
  cortesia: boolean; motivo_cortesia: string | null; cortesia_autorizada_por: string | null; observacao: string | null;
  cancelado: boolean; motivo_cancelamento: string | null; criado_por: string | null; criado_em: string;
  venda_id?: string | null;
  tabela?: TabelaPreco;
  caixa_pagamentos: Pagamento[];
}
interface Saida {
  id: string; caixa_id: string; valor: number; motivo: string; autorizado_por: string | null;
  cancelado: boolean; motivo_cancelamento: string | null; criado_por: string | null; criado_em: string;
  /** despesa = dinheiro gasto; entrega_adm = subiu para o administrativo (migração 0171) */
  tipo?: "despesa" | "entrega_adm" | "entrega_fundo"; recebido_por?: string | null; recebido_em?: string | null;
}
type Forma = "dinheiro" | "pix" | "debito" | "credito_vista" | "credito_parcelado";

export const FORMAS_CAIXA: Record<Forma, string> = {
  dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito_vista: "Crédito à vista", credito_parcelado: "Crédito parcelado",
};
const ORDEM_FORMAS = Object.keys(FORMAS_CAIXA) as Forma[];
export const STATUS_CAIXA: Record<CaixaRow["status"], { rotulo: string; cor: string }> = {
  aberto: { rotulo: "Aberto", cor: "azul" },
  fechado: { rotulo: "Fechado · aguardando conferência do dinheiro", cor: "amarelo" },
  dinheiro_conferido: { rotulo: "Dinheiro conferido · conferência em andamento", cor: "amarelo" },
  conferido: { rotulo: "Conferência completa · aguardando aprovação", cor: "roxo" },
  aprovado: { rotulo: "Aprovado", cor: "verde" },
  cancelado: { rotulo: "Cancelado (aberto por engano)", cor: "cinza" },
};
/** A conferência em duas etapas é só do caixa da recepção (migração 0112): a orientação usa os rótulos simples. */
function rotuloStatus(c: Pick<CaixaRow, "status" | "setor">): string {
  if (c.setor === "orientacao" && c.status === "fechado") return "Fechado · aguardando conferência";
  if (c.setor === "orientacao" && c.status === "conferido") return "Conferido · aguardando aprovação";
  return STATUS_CAIXA[c.status].rotulo;
}
/** O que foi recebido: um ou mais tipos + itens marcados, gravados juntos em `descricao`
 *  (ex.: "Consulta (Retorno) + Exame (Tonometria, Mapeamento de retina)"). */
const TIPOS_RECEBIMENTO = ["Consulta", "Exame", "Procedimento"] as const;
type TipoRecebimento = (typeof TIPOS_RECEBIMENTO)[number];
/** Usado só se a tabela de preços particular não carregar. */
const DETALHES: Record<TipoRecebimento, string[]> = {
  Consulta: ["Primeira vez", "Retorno"],
  Exame: ["Mapeamento de retina", "Tonometria", "Campimetria", "OCT", "Topografia", "Biometria", "Paquimetria", "Retinografia", "Microscopia especular"],
  Procedimento: ["Cirurgia", "Injeção intravítrea", "Laser", "Terapia", "Lente de contato"],
};
/** Tipo do procedimento (cadastro) → botão do caixa */
const GRUPO_CAIXA: Record<string, TipoRecebimento> = {
  consulta: "Consulta", exame: "Exame", procedimento: "Procedimento", cirurgia: "Procedimento",
  // exercício ortóptico fica junto do teste ortóptico, onde a recepção procura (dona, 26/11)
  terapia: "Exame",
};
interface ItemTabela { nome: string; grupo: TipoRecebimento; valor: number }
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Tabela de preços PARTICULAR (procedimentos com preço sem convênio — migração 0086). */
/** Preços da Guia Rosa (migração 0173): nome do procedimento → valor. Sem preço aqui = usa o particular. */
function useGuiaRosa() {
  const { dados } = useCarregar(async () => {
    const r = ok(await supabase.from("precos_parceria").select("valor, procedimentos(descricao)").eq("tabela", "guia_rosa").eq("ativo", true)) as
      unknown as { valor: number; procedimentos: { descricao: string } | null }[];
    return new Map(r.filter((x) => x.procedimentos).map((x) => [x.procedimentos!.descricao, Number(x.valor)]));
  }, []);
  return dados ?? new Map<string, number>();
}
export type TabelaPreco = "particular" | "guia_rosa";

function useTabelaParticular() {
  const { dados } = useCarregar(async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const r = ok(await supabase.from("procedimentos").select("descricao, tipo, precos(valor, convenio_id, plano_id, ativo, vigente_de)").eq("ativo", true).order("descricao")) as
      { descricao: string; tipo: string; precos: { valor: number; convenio_id: string | null; plano_id: string | null; ativo: boolean; vigente_de: string }[] }[];
    const itens: ItemTabela[] = [];
    for (const p of r) {
      const grupo = GRUPO_CAIXA[p.tipo];
      const pr = (p.precos ?? []).filter((x) => x.ativo && !x.convenio_id && !x.plano_id && x.vigente_de <= hoje)
        .sort((a, b) => b.vigente_de.localeCompare(a.vigente_de))[0];
      if (grupo && pr) itens.push({ nome: p.descricao, grupo, valor: Number(pr.valor) });
    }
    return itens;
  }, []);
  return dados ?? [];
}

const num = { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };
const n2 = (v: number) => Math.round(v * 100) / 100;

/** Aceita "1.234,56", "1234,56", "1234.56", "R$ 300" */
export function lerValor(s: string): number | null {
  let t = String(s ?? "").replace(/[R$\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const v = Number(t);
  return Number.isFinite(v) ? n2(v) : null;
}
const pagoDe = (a: Atendimento) => n2(a.caixa_pagamentos.filter((p) => !p.cancelado).reduce((s, p) => s + Number(p.valor), 0));
const saldoDe = (a: Atendimento) => (a.cancelado || a.cortesia ? 0 : n2(Number(a.valor) - pagoDe(a)));

/** Quem pode o quê (o banco confere de novo — migrações 0066 e 0098).
 *  Sem setor: junta os dois (serve para o menu). Recepção e Orientação Cirúrgica são caixas separados. */
export function papelCaixa(eu: Profissional | null, setor?: Setor) {
  const f = eu?.funcao;
  const rec = papelRecepcao(eu);
  const ori = {
    lancar: !!eu?.orientacao_cirurgica || f === "admin" || f === "faturamento",
    conferir: rec.conferir,
    aprovar: rec.aprovar,
    ver: !!eu?.orientacao_cirurgica || f === "admin" || f === "faturamento" || rec.conferir || rec.aprovar,
    receber: rec.receber,
  };
  if (setor === "recepcao") return rec;
  if (setor === "orientacao") return ori;
  return { lancar: rec.lancar || ori.lancar, conferir: rec.conferir, aprovar: rec.aprovar, ver: rec.ver || ori.ver, receber: rec.receber };
}
/** setores que a pessoa enxerga */
export function setoresCaixa(eu: Profissional | null): Setor[] {
  return (["recepcao", "orientacao"] as Setor[]).filter((s) => papelCaixa(eu, s).ver);
}
function papelRecepcao(eu: Profissional | null) {
  const f = eu?.funcao;
  // recepção que atende a Orientação Cirúrgica fica só com o caixa da orientação (migração 0099)
  const rec = f === "recepcao" && !eu?.orientacao_cirurgica;
  return {
    // abre, lança e fecha: recepção, administração e faturamento (migração 0083)
    lancar: rec || f === "admin" || f === "faturamento",
    conferir: !!eu?.caixa_conferir || f === "admin",
    aprovar: !!eu?.caixa_aprovar || f === "admin",
    ver: rec || f === "admin" || f === "faturamento" || !!eu?.caixa_conferir || !!eu?.caixa_aprovar || !!eu?.caixa_recebe_entrega,
    // dá o "Recebi" no dinheiro que a recepção entrega ao administrativo (migração 0171)
    receber: !!eu?.caixa_recebe_entrega || f === "admin",
  };
}

function useNomes() {
  const { dados } = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome, funcao, ativo, atende_pacientes, agenda_recurso").order("nome")) as { id: string; nome: string; funcao: string; ativo: boolean; atende_pacientes?: boolean; agenda_recurso?: boolean }[], []);
  return useMemo(() => {
    const mapa = new Map((dados ?? []).map((p) => [p.id, p.nome]));
    return {
      nome: (id?: string | null) => (id ? mapa.get(id)?.split(" ")[0] ?? "—" : "—"),
      nomeCompleto: (id?: string | null) => (id ? mapa.get(id) ?? "—" : "—"),
      // médicos + quem atende pacientes sem ser médico (ex.: tecnóloga — migração 0167); colunas de setor da agenda ficam de fora
      medicos: (dados ?? []).filter((p) => p.ativo && !p.agenda_recurso && (p.funcao === "medico" || !!p.atende_pacientes)),
    };
  }, [dados]);
}

async function rpc(nome: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  return data;
}

// ================================================================== Lista de caixas
export default function Caixa() {
  const { eu } = useAuth();
  const setores = setoresCaixa(eu);
  const [setor, setSetor] = useState<Setor>(() => {
    const salvo = sessionStorage.getItem("caixa_setor") as Setor | null;
    return salvo && setores.includes(salvo) ? salvo : setores[0] ?? "recepcao";
  });
  const papel = papelCaixa(eu, setor);
  const nav = useNavigate();
  const nomes = useNomes();
  const { dados: todos, erro, carregando } = useCarregar(
    async () => ok(await supabase.from("caixas").select("*").order("aberto_em", { ascending: false }).limit(240)) as CaixaRow[], []);
  const [abrir, setAbrir] = useState(false);
  const podeReceber = papelCaixa(eu).receber;
  const entregas = useCarregar(async () => podeReceber
    ? ok(await supabase.from("caixa_saidas").select("*").in("tipo", ["entrega_adm", "entrega_fundo"]).eq("cancelado", false).is("recebido_em", null).order("criado_em")) as Saida[]
    : [], [podeReceber]);
  const dados = (todos ?? []).filter((c) => (c.setor ?? "recepcao") === setor);
  const aberto = dados.find((c) => c.status === "aberto");
  const aguardando = dados.filter((c) => (c.status === "fechado" && papel.conferir) || (c.status === "conferido" && papel.aprovar)
    || (c.status === "dinheiro_conferido" && (c.dinheiro_conferido_por === eu?.id || !!eu?.caixa_corrigir)));
  function trocar(s: Setor) { setSetor(s); try { sessionStorage.setItem("caixa_setor", s); } catch { /* sem armazenamento */ } }

  return (
    <div>
      <div className="cabecalho">
        <div><h1>{SETORES[setor]}</h1><p className="sub" style={{ margin: 0 }}>{setor === "orientacao"
          ? "Dinheiro recebido pela Orientação Cirúrgica (cirurgias e lentes). Separado do caixa da recepção."
          : "Recebimentos do dia, saídas e fechamento (substitui a folha de papel)"}</p></div>
        {papel.lancar && !aberto && !carregando && <button className="primario" onClick={() => setAbrir(true)}>🔓 Abrir caixa</button>}
      </div>
      <AvisoCaixaOrientacao />
      {setores.length > 1 && (
        <div className="linha" style={{ marginBottom: 14 }}>
          {setores.map((s) => <button key={s} className={s === setor ? "primario" : ""} onClick={() => trocar(s)}>{s === "recepcao" ? "🏥 Recepção" : "🩺 Orientação Cirúrgica"}</button>)}
        </div>
      )}
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <>
          {aberto ? (
            <div className="painel" style={{ marginBottom: 16 }}>
              <div className="linha entre">
                <div>
                  <b>Caixa aberto</b> desde {fmtDataHora(aberto.aberto_em)} por {nomes.nomeCompleto(aberto.aberto_por)} · fundo de troco {fmtMoeda(aberto.fundo_troco)}
                  {aberto.motivo_devolucao && <div><Etiqueta cor="vermelho">Devolvido para correção</Etiqueta> <span className="pequeno">{aberto.motivo_devolucao}</span></div>}
                  {aberto.motivo_reabertura && <div><Etiqueta cor="vermelho">Reaberto para correção</Etiqueta> <span className="pequeno">{aberto.motivo_reabertura}</span></div>}
                </div>
                <button className="primario" onClick={() => nav(`/caixa/${aberto.id}`)}>Ir para o caixa →</button>
              </div>
            </div>
          ) : (
            <Aviso tipo="info">Nenhum caixa aberto agora.{papel.lancar ? " Clique em “Abrir caixa” para começar o dia." : ""}</Aviso>
          )}

          {(entregas.dados ?? []).length > 0 && (
            <div className="painel" style={{ marginBottom: 16, borderLeft: "4px solid #b26a00" }}>
              <h3 style={{ marginTop: 0 }}>💼 Dinheiro entregue pela recepção esperando o seu check</h3>
              <ul className="lista-simples">
                {(entregas.dados ?? []).map((s) => (
                  <li key={s.id}><b>{fmtMoeda(s.valor)}</b> · entregue por {nomes.nomeCompleto(s.criado_por)} em {fmtDataHora(s.criado_em)} · <Link to={`/caixa/${s.caixa_id}`}>abrir o caixa para dar o check</Link></li>
                ))}
              </ul>
            </div>
          )}
          {aguardando.length > 0 && (
            <div className="painel" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Esperando por você (inclui caixas em conferência)</h3>
              <ul className="lista-simples">
                {aguardando.map((c) => (
                  <li key={c.id}><Link to={`/caixa/${c.id}`}>Caixa de {fmtData(c.data)}</Link> · <Etiqueta cor={STATUS_CAIXA[c.status].cor}>{rotuloStatus(c)}</Etiqueta></li>
                ))}
              </ul>
            </div>
          )}

          <div className="painel rolagem">
            <h3 style={{ marginTop: 0 }}>Histórico</h3>
            {dados.length === 0 ? <div className="vazio">Nenhum caixa ainda.</div> : (
              <table className="tabela">
                <thead><tr><th>Data</th><th>Situação</th><th>Abriu</th><th>Fechou</th><th style={num}>Diferença na gaveta</th><th>Conferiu</th><th>Aprovou</th></tr></thead>
                <tbody>
                  {dados.map((c) => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => nav(`/caixa/${c.id}`)}>
                      <td><Link to={`/caixa/${c.id}`}>{fmtData(c.data)}</Link></td>
                      <td><Etiqueta cor={STATUS_CAIXA[c.status].cor}>{rotuloStatus(c)}</Etiqueta></td>
                      <td>{nomes.nome(c.aberto_por)}</td>
                      <td>{nomes.nome(c.fechado_por)}</td>
                      <td style={num}>{c.diferenca_dinheiro === null ? "—" : <Diferenca v={c.diferenca_dinheiro} />}</td>
                      <td>{nomes.nome(c.conferido_por)}</td>
                      <td>{nomes.nome(c.aprovado_por)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {abrir && <AbrirCaixa setor={setor} aoFechar={() => setAbrir(false)} aoSalvar={(id) => nav(`/caixa/${id}`)} />}
    </div>
  );
}

function Diferenca({ v }: { v: number }) {
  const x = Number(v);
  if (Math.abs(x) < 0.005) return <span style={{ color: "var(--verde, #1a7f37)" }}>✔ bateu</span>;
  return <b style={{ color: x < 0 ? "#c62828" : "#b26a00" }}>{x < 0 ? "faltou " : "sobrou "}{fmtMoeda(Math.abs(x))}</b>;
}

function AbrirCaixa({ setor, aoFechar, aoSalvar }: { setor: Setor; aoFechar: () => void; aoSalvar: (id: string) => void }) {
  const [fundo, setFundo] = useState(setor === "orientacao" ? "0,00" : "200,00");
  const [erro, setErro] = useState("");
  async function salvar() {
    const v = lerValor(fundo);
    if (v === null || v < 0) return setErro("Informe o fundo de troco (pode ser 0).");
    try { aoSalvar((await rpc("caixa_abrir", { p_fundo: v, p_setor: setor })) as string); } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo={`Abrir ${SETORES[setor].toLowerCase()}`} aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Abrir caixa</button></>}>
      <Aviso>{erro}</Aviso>
      <p>Quem abre o caixa fica registrada(o) como responsável do dia.</p>
      <Campo rotulo="Fundo de troco (dinheiro que já está na gaveta)"><input inputMode="decimal" value={fundo} onChange={(e) => setFundo(e.target.value)} autoFocus /></Campo>
    </Modal>
  );
}

// ================================================================== Um caixa
export function CaixaDetalhe() {
  const { id } = useParams();
  const { eu } = useAuth();
  const nomes = useNomes();
  const { dados, erro, carregando, recarregar } = useCarregar(async () => {
    const [cx, ats, pags, sais] = await Promise.all([
      supabase.from("caixas").select("*").eq("id", id!).single().then((r) => ok(r) as CaixaRow),
      supabase.from("caixa_atendimentos").select("*, caixa_pagamentos(*)").eq("caixa_id", id!).order("criado_em").then((r) => ok(r) as Atendimento[]),
      supabase.from("caixa_pagamentos").select("*, caixa_atendimentos(paciente_nome, caixa_id, descricao)").eq("caixa_id", id!).order("criado_em").then((r) => ok(r) as Pagamento[]),
      supabase.from("caixa_saidas").select("*").eq("caixa_id", id!).order("criado_em").then((r) => ok(r) as Saida[]),
    ]);
    // saldos pendentes de outros dias (só interessa com o caixa aberto)
    let pendentes: Atendimento[] = [];
    if (cx.status === "aberto") {
      // só do mesmo setor: recepção e orientação não se misturam (migração 0098)
      const r = ok(await supabase.from("caixa_atendimentos").select("*, caixa_pagamentos(*), caixas!inner(setor)")
        .eq("caixas.setor", cx.setor ?? "recepcao").neq("caixa_id", id!).eq("cancelado", false).eq("cortesia", false).gt("valor", 0)
        .order("criado_em", { ascending: false }).limit(500)) as Atendimento[];
      pendentes = r.filter((a) => saldoDe(a) > 0);
    }
    return { cx, ats, pags, sais, pendentes };
  }, [id]);
  const [fechouAgora, setFechouAgora] = useState(false);
  const [modal, setModal] = useState<"" | "receber" | "cortesia" | "saida" | "entrega" | "fechar" | "dinheiro" | "conferir" | "aprovar" | "devolver">("");
  const [pagarAt, setPagarAt] = useState<Atendimento | null>(null);
  const [incluirAt, setIncluirAt] = useState<Atendimento | null>(null);
  // lista de atendimentos: ordem (hora ou nome) e busca pelo nome do paciente (pedido da recepção, 26/11)
  const [ordem, setOrdem] = useState<"hora" | "nome">("hora");
  const [busca, setBusca] = useState("");
  const [erroAcao, setErroAcao] = useState("");

  if (carregando && !dados) return <Carregando />;
  if (erro || !dados) return <Aviso>{erro || "Caixa não encontrado."}</Aviso>;
  const { cx, ats, pags, sais, pendentes } = dados;
  const papel = papelCaixa(eu, cx.setor ?? "recepcao");
  const aberto = cx.status === "aberto";
  const podeLancar = aberto && papel.lancar;
  const souConferente = !!eu && (cx.dinheiro_conferido_por === eu.id || !!eu.caixa_corrigir);

  const pagsValidos = pags.filter((p) => !p.cancelado);
  const porForma = Object.fromEntries(ORDEM_FORMAS.map((f) => [f, n2(pagsValidos.filter((p) => p.forma === f).reduce((s, p) => s + Number(p.valor), 0))])) as Record<Forma, number>;
  const totalRecebido = n2(ORDEM_FORMAS.reduce((s, f) => s + porForma[f], 0));
  const totalCartoes = n2(porForma.debito + porForma.credito_vista + porForma.credito_parcelado);
  const totalSaidas = n2(sais.filter((s) => !s.cancelado).reduce((s, x) => s + Number(x.valor), 0));
  const esperadoDinheiro = n2(Number(cx.fundo_troco) + porForma.dinheiro - totalSaidas);
  const saisValidas = sais.filter((s) => !s.cancelado);
  const ehEntrega = (x: Saida) => x.tipo === "entrega_adm" || x.tipo === "entrega_fundo";
  const somaSaidas = (f: (x: Saida) => boolean) => n2(saisValidas.filter(f).reduce((t, x) => t + Number(x.valor), 0));
  const totalEntregasDia = somaSaidas((x) => x.tipo === "entrega_adm");
  const totalEntregasFundo = somaSaidas((x) => x.tipo === "entrega_fundo");
  const totalEntregas = n2(totalEntregasDia + totalEntregasFundo);
  const totalDespesas = n2(totalSaidas - totalEntregas);
  const entregasPendentes = saisValidas.filter((x) => ehEntrega(x) && !x.recebido_em);
  // fundo de troco e dinheiro do dia separados (pedido da recepção, 27/11)
  const fundoNaGaveta = n2(Number(cx.fundo_troco) - totalEntregasFundo);
  const diaNaGaveta = n2(porForma.dinheiro - totalEntregasDia - totalDespesas);
  const atsValidos = ats.filter((a) => !a.cancelado);
  const cortesias = atsValidos.filter((a) => a.cortesia).length;
  const faltaReceber = n2(atsValidos.reduce((s, a) => s + saldoDe(a), 0));
  const atsVisiveis = ats
    .filter((a) => !busca.trim() || semAcento(a.paciente_nome).includes(semAcento(busca.trim())))
    .sort((x, y) => (ordem === "nome" ? semAcento(x.paciente_nome).localeCompare(semAcento(y.paciente_nome)) : x.criado_em.localeCompare(y.criado_em)));
  const pagsSaldoAnterior = pags.filter((p) => p.caixa_atendimentos && p.caixa_atendimentos.caixa_id !== cx.id);

  async function cancelar(tabela: "caixa_atendimentos" | "caixa_pagamentos" | "caixa_saidas", linha: string, oque: string) {
    setErroAcao("");
    const motivo = window.prompt(`Cancelar ${oque}? Escreva o motivo:`);
    if (motivo === null) return;
    if (!motivo.trim()) return setErroAcao("Para cancelar é preciso escrever o motivo.");
    const { error } = await supabase.from(tabela).update({ cancelado: true, motivo_cancelamento: motivo.trim() }).eq("id", linha);
    if (error) setErroAcao(msgErro(error)); else recarregar();
  }

  async function receberEntrega(s: Saida) {
    setErroAcao("");
    if (!window.confirm(`Confirma que você recebeu ${fmtMoeda(s.valor)} em dinheiro, entregue por ${nomes.nomeCompleto(s.criado_por)}?`)) return;
    try { await rpc("caixa_entrega_receber", { p_saida: s.id }); recarregar(); } catch (e) { setErroAcao(msgErro(e)); }
  }

  async function corrigir(acao: "caixa_cancelar" | "caixa_reabrir") {
    setErroAcao("");
    const texto = acao === "caixa_cancelar"
      ? "Cancelar este caixa (aberto por engano)? Ele não é apagado: fica no histórico como cancelado. Escreva o motivo:"
      : "Reabrir este caixa para correção? Ele volta a ficar aberto e precisa ser fechado, conferido e aprovado de novo. Escreva o motivo:";
    const motivo = window.prompt(texto);
    if (motivo === null) return;
    if (!motivo.trim()) return setErroAcao("É preciso escrever o motivo.");
    try { await rpc(acao, { p_caixa: cx.id, p_motivo: motivo.trim() }); recarregar(); } catch (e) { setErroAcao(msgErro(e)); }
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>{cx.setor === "orientacao" ? "Caixa da Orientação Cirúrgica" : "Caixa"} de {fmtData(cx.data)} <Etiqueta cor={STATUS_CAIXA[cx.status].cor}>{rotuloStatus(cx)}</Etiqueta></h1>
          <p className="sub" style={{ margin: 0 }}>
            Aberto por {nomes.nomeCompleto(cx.aberto_por)} em {fmtDataHora(cx.aberto_em)} · fundo de troco {fmtMoeda(cx.fundo_troco)}
          </p>
        </div>
        <div className="linha nao-imprimir">
          <Link to="/caixa"><button>← Caixas</button></Link>
          <button onClick={() => window.print()}>🖨️ Imprimir</button>
        </div>
      </div>
      <Aviso>{erroAcao}</Aviso>
      {fechouAgora && cx.setor === "orientacao" && cx.status !== "aberto" && <MensagemCaixaFechado data={cx.data} />}
      {cx.status === "cancelado" && (
        <Aviso tipo="info">Caixa cancelado por {nomes.nomeCompleto(cx.cancelado_por)} em {fmtDataHora(cx.cancelado_em)}: <b>{cx.motivo_cancelamento}</b>.</Aviso>
      )}
      {cx.motivo_reabertura && aberto && (
        <Aviso tipo="alerta">Reaberto para correção por {nomes.nomeCompleto(cx.reaberto_por)} em {fmtDataHora(cx.reaberto_em)}: <b>{cx.motivo_reabertura}</b>. Corrija e feche de novo.</Aviso>
      )}
      {cx.motivo_devolucao && aberto && (
        <Aviso tipo="alerta">Devolvido para correção por {nomes.nomeCompleto(cx.devolvido_por)} em {fmtDataHora(cx.devolvido_em)}: <b>{cx.motivo_devolucao}</b>. Corrija e feche de novo.</Aviso>
      )}

      {/* ---------- Ações do momento ---------- */}
      <div className="linha nao-imprimir" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {podeLancar && <>
          <button className="primario" onClick={() => setModal("receber")}>💵 Novo recebimento</button>
          <button onClick={() => setModal("cortesia")}>🎁 Cortesia (sem cobrança)</button>
          <button onClick={() => setModal("entrega")}>💼 Entregar dinheiro ao administrativo</button>
          <button onClick={() => setModal("saida")}>🧾 Despesa (dinheiro do caixa)</button>
          <button onClick={() => setModal("fechar")} style={{ marginLeft: "auto" }}>🔒 Fechar caixa</button>
        </>}
        {cx.status === "fechado" && papel.conferir && <>
          {cx.setor === "orientacao"
            ? <button className="primario" onClick={() => setModal("conferir")}>✔️ Conferir</button>
            : <button className="primario" onClick={() => setModal("dinheiro")}>💵 1º check: conferir o dinheiro</button>}
          <button onClick={() => setModal("devolver")}>↩️ Devolver para correção</button>
        </>}
        {cx.status === "dinheiro_conferido" && souConferente && <button onClick={() => setModal("devolver")}>↩️ Devolver para correção</button>}
        {cx.status === "conferido" && papel.aprovar && <>
          <button className="primario" onClick={() => setModal("aprovar")}>✅ Aprovar</button>
          <button onClick={() => setModal("devolver")}>↩️ Devolver para correção</button>
        </>}
        {eu?.caixa_corrigir && aberto && <button onClick={() => corrigir("caixa_cancelar")} title="Só para caixa aberto por engano">🚫 Cancelar caixa</button>}
        {eu?.caixa_corrigir && ["fechado", "dinheiro_conferido", "conferido", "aprovado"].includes(cx.status) && <button onClick={() => corrigir("caixa_reabrir")}>🔁 Reabrir para correção</button>}
      </div>

      {cx.status === "dinheiro_conferido" && (
        <PainelConferencia cx={cx} pode={souConferente} nomeConferente={nomes.nomeCompleto(cx.dinheiro_conferido_por)}
          aoMudar={recarregar} aoConcluir={() => setModal("conferir")} />
      )}

      {/* ---------- Totais ---------- */}
      <div className="cartoes">
        {ORDEM_FORMAS.map((f) => <div className="cartao" key={f}><div className="rot">{FORMAS_CAIXA[f]}</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(porForma[f])}</div></div>)}
      </div>
      <div className="cartoes">
        <div className="cartao"><div className="rot">Total recebido</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(totalRecebido)}</div><div className="pequeno muted">cartões {fmtMoeda(totalCartoes)}</div></div>
        <div className="cartao"><div className="rot">Entregue ao administrativo</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(totalEntregas)}</div>{totalEntregasFundo > 0 && <div className="pequeno muted">dinheiro do dia {fmtMoeda(totalEntregasDia)} · fundo {fmtMoeda(totalEntregasFundo)}</div>}{entregasPendentes.length > 0 && <div className="pequeno" style={{ color: "#b26a00" }}>⏳ {entregasPendentes.length} aguardando check</div>}</div>
        <div className="cartao"><div className="rot">Despesas</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(totalDespesas)}</div></div>
        <div className="cartao"><div className="rot">💰 Fundo de troco na gaveta</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(fundoNaGaveta)}</div><div className="pequeno muted">{totalEntregasFundo > 0 ? `fundo ${fmtMoeda(cx.fundo_troco)} − entregue ${fmtMoeda(totalEntregasFundo)}` : "troco que já estava na gaveta"}</div></div>
        <div className="cartao"><div className="rot">💵 Dinheiro do dia na gaveta</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(diaNaGaveta)}</div><div className="pequeno muted">recebido em dinheiro − entregas − despesas</div></div>
        <div className="cartao"><div className="rot">Total que deve estar na gaveta</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(aberto ? esperadoDinheiro : cx.esperado_dinheiro)}</div><div className="pequeno muted">fundo + dinheiro do dia</div></div>
        {cx.contado_dinheiro !== null && (
          <div className="cartao"><div className="rot">Contado na gaveta</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(cx.contado_dinheiro)}</div><div className="pequeno"><Diferenca v={Number(cx.diferenca_dinheiro)} /></div></div>
        )}
        {cx.dinheiro_recebido != null && (
          <div className="cartao"><div className="rot">Dinheiro recebido na conferência</div><div className="num" style={{ fontSize: "1.35rem" }}>{fmtMoeda(cx.dinheiro_recebido)}</div><div className="pequeno"><Diferenca v={n2(Number(cx.dinheiro_recebido) - Number(cx.esperado_dinheiro ?? 0))} /> <span className="muted">(vs. esperado)</span></div></div>
        )}
        <div className="cartao"><div className="rot">Atendimentos</div><div className="num" style={{ fontSize: "1.35rem" }}>{atsValidos.length}</div><div className="pequeno muted">{cortesias} cortesia(s){faltaReceber > 0 ? ` · falta receber ${fmtMoeda(faltaReceber)}` : ""}</div></div>
      </div>

      {/* ---------- Atendimentos ---------- */}
      <div className="painel rolagem" style={{ marginBottom: 16 }}>
        <div className="linha entre" style={{ flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Atendimentos do caixa</h3>
          {ats.length > 0 && (
            <div className="linha nao-imprimir" style={{ flexWrap: "wrap", gap: 6 }}>
              <input placeholder="🔎 Procurar paciente" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ minWidth: 200 }} />
              <button className={ordem === "hora" ? "primario" : ""} onClick={() => setOrdem("hora")}>🕒 Por horário</button>
              <button className={ordem === "nome" ? "primario" : ""} onClick={() => setOrdem("nome")}>🔤 De A a Z</button>
            </div>
          )}
        </div>
        {ats.length === 0 ? <div className="vazio">Nenhum atendimento lançado.</div> : atsVisiveis.length === 0 ? <div className="vazio">Nenhum paciente com “{busca}” neste caixa.</div> : (
          <table className="tabela">
            <thead><tr><th>Hora</th><th>Paciente</th><th>Médico / profissional</th><th>O que foi feito</th><th style={num}>Valor</th><th>Pagamento</th><th style={num}>Falta</th><th>Lançou</th><th className="nao-imprimir"></th></tr></thead>
            <tbody>
              {atsVisiveis.map((a) => {
                const saldo = saldoDe(a);
                return (
                  <tr key={a.id} style={{ opacity: a.cancelado ? 0.5 : 1 }}>
                    <td>{new Date(a.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td><b style={{ textDecoration: a.cancelado ? "line-through" : undefined }}>{a.paciente_nome}</b>{a.tabela === "guia_rosa" && <> <Etiqueta cor="roxo">🩷 Guia Rosa</Etiqueta></>}
                      {a.cancelado && <div className="pequeno"><Etiqueta cor="cinza">cancelado</Etiqueta> {a.motivo_cancelamento}</div>}
                      {a.observacao && <div className="pequeno muted">{a.observacao}</div>}</td>
                    <td>{a.medico_id ? nomes.nomeCompleto(a.medico_id) : "—"}</td>
                    <td>{a.descricao ?? "—"}</td>
                    <td style={num}>{a.cortesia ? <Etiqueta cor="azul">Cortesia</Etiqueta> : fmtMoeda(a.valor)}
                      {a.cortesia && <div className="pequeno muted">{a.motivo_cortesia}{a.cortesia_autorizada_por ? ` · autorizou: ${a.cortesia_autorizada_por}` : ""}</div>}</td>
                    <td>
                      {a.caixa_pagamentos.map((p) => (
                        <div key={p.id} className="pequeno" style={{ opacity: p.cancelado ? 0.5 : 1, textDecoration: p.cancelado ? "line-through" : undefined }}>
                          {FORMAS_CAIXA[p.forma]}{p.forma === "credito_parcelado" ? ` ${p.parcelas}x` : ""} {fmtMoeda(p.valor)}
                          {p.pagador ? <span className="muted"> · {p.pagador}</span> : null}
                          {p.caixa_id !== cx.id && <span className="muted"> · em outro dia</span>}
                          {podeLancar && !p.cancelado && p.caixa_id === cx.id && !a.venda_id && <button className="mini nao-imprimir" style={{ marginLeft: 6 }} onClick={() => cancelar("caixa_pagamentos", p.id, "este pagamento")}>✕</button>}
                        </div>
                      ))}
                    </td>
                    <td style={num}>{saldo > 0 ? <b style={{ color: "#c62828" }}>{fmtMoeda(saldo)}</b> : "—"}</td>
                    <td>{nomes.nome(a.criado_por)}</td>
                    <td className="nao-imprimir" style={{ whiteSpace: "nowrap" }}>
                      {a.venda_id && <span className="pequeno muted">pela tela de vendas</span>}
                      {podeLancar && !a.cancelado && !a.cortesia && !a.venda_id && <button className="mini" onClick={() => setIncluirAt(a)} title="Incluir exames ou procedimentos neste mesmo paciente">➕ Incluir</button>}
                      {podeLancar && saldo > 0 && !a.venda_id && <button className="mini" onClick={() => setPagarAt(a)}>Receber</button>}
                      {podeLancar && !a.cancelado && !a.venda_id && <button className="mini" onClick={() => cancelar("caixa_atendimentos", a.id, `o atendimento de ${a.paciente_nome}`)}>Cancelar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagsSaldoAnterior.length > 0 && (
        <div className="painel rolagem" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Recebimentos de saldos de outros dias</h3>
          <table className="tabela">
            <thead><tr><th>Paciente</th><th>Forma</th><th style={num}>Valor</th><th>Lançou</th><th className="nao-imprimir"></th></tr></thead>
            <tbody>{pagsSaldoAnterior.map((p) => (
              <tr key={p.id} style={{ opacity: p.cancelado ? 0.5 : 1 }}>
                <td>{p.caixa_atendimentos?.paciente_nome}{p.cancelado && <> <Etiqueta cor="cinza">cancelado</Etiqueta></>}</td>
                <td>{FORMAS_CAIXA[p.forma]}{p.forma === "credito_parcelado" ? ` ${p.parcelas}x` : ""}{p.pagador ? ` · ${p.pagador}` : ""}</td>
                <td style={num}>{fmtMoeda(p.valor)}</td>
                <td>{nomes.nome(p.criado_por)}</td>
                <td className="nao-imprimir">{podeLancar && !p.cancelado && <button className="mini" onClick={() => cancelar("caixa_pagamentos", p.id, "este pagamento")}>Cancelar</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ---------- Saídas ---------- */}
      <div className="painel rolagem" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Dinheiro que saiu da gaveta</h3>
        {sais.length === 0 ? <div className="vazio">Nenhuma entrega ao administrativo nem despesa.</div> : (
          <table className="tabela">
            <thead><tr><th>Hora</th><th>Tipo</th><th>Motivo / situação</th><th style={num}>Valor</th><th>Lançou</th><th className="nao-imprimir"></th></tr></thead>
            <tbody>{sais.map((s) => (
              <tr key={s.id} style={{ opacity: s.cancelado ? 0.5 : 1 }}>
                <td>{new Date(s.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>{s.tipo === "entrega_fundo" ? "💰 Fundo de troco entregue" : s.tipo === "entrega_adm" ? "💼 Dinheiro do dia entregue" : "🧾 Despesa"}</td>
                <td>
                  {ehEntrega(s)
                    ? (s.recebido_em
                        ? <span style={{ color: "var(--verde, #1a7f37)" }}>✅ Recebido por <b>{nomes.nomeCompleto(s.recebido_por)}</b> às {new Date(s.recebido_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{new Date(s.recebido_em).toDateString() !== new Date(s.criado_em).toDateString() ? ` de ${fmtData(s.recebido_em)}` : ""}</span>
                        : !s.cancelado && <b style={{ color: "#b26a00" }}>⏳ Aguardando o check do administrativo</b>)
                    : <>{s.motivo}{s.autorizado_por ? <span className="muted"> · autorizou: {s.autorizado_por}</span> : null}</>}
                  {ehEntrega(s) && s.motivo.includes(" — ") && <div className="pequeno muted">{s.motivo.split(" — ").slice(1).join(" — ")}</div>}
                  {s.cancelado && <div className="pequeno"><Etiqueta cor="cinza">cancelada</Etiqueta> {s.motivo_cancelamento}</div>}
                </td>
                <td style={num}>{fmtMoeda(s.valor)}</td>
                <td>{nomes.nome(s.criado_por)}</td>
                <td className="nao-imprimir" style={{ whiteSpace: "nowrap" }}>
                  {ehEntrega(s) && !s.cancelado && !s.recebido_em && papel.receber && <button className="mini primario" onClick={() => receberEntrega(s)}>✔️ Recebi</button>}
                  {podeLancar && !s.cancelado && !s.recebido_em && <button className="mini" onClick={() => cancelar("caixa_saidas", s.id, ehEntrega(s) ? "esta entrega" : "esta despesa")}>Cancelar</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* ---------- Saldos pendentes de outros dias ---------- */}
      {podeLancar && pendentes.length > 0 && (
        <div className="painel rolagem nao-imprimir" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Pacientes com valor a receber de outros dias</h3>
          <table className="tabela">
            <thead><tr><th>Paciente</th><th>O que foi feito</th><th style={num}>Valor</th><th style={num}>Falta</th><th></th></tr></thead>
            <tbody>{pendentes.map((a) => (
              <tr key={a.id}>
                <td>{a.paciente_nome} <span className="muted pequeno">({fmtData(a.criado_em)})</span></td>
                <td>{a.descricao ?? "—"}</td>
                <td style={num}>{fmtMoeda(a.valor)}</td>
                <td style={num}><b style={{ color: "#c62828" }}>{fmtMoeda(saldoDe(a))}</b></td>
                <td><button className="mini" onClick={() => setPagarAt(a)}>Receber</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* ---------- Caminho do caixa ---------- */}
      <div className="painel">
        <h3 style={{ marginTop: 0 }}>Caminho do caixa</h3>
        <ul className="lista-simples">
          <li>🔓 Aberto por <b>{nomes.nomeCompleto(cx.aberto_por)}</b> em {fmtDataHora(cx.aberto_em)}</li>
          {cx.fechado_em && <li>🔒 Fechado por <b>{nomes.nomeCompleto(cx.fechado_por)}</b> em {fmtDataHora(cx.fechado_em)}{cx.obs_fechamento ? ` — ${cx.obs_fechamento}` : ""}</li>}
          {cx.dinheiro_conferido_em && <li>💵 Dinheiro conferido por <b>{nomes.nomeCompleto(cx.dinheiro_conferido_por)}</b> em {fmtDataHora(cx.dinheiro_conferido_em)} — recebeu {fmtMoeda(cx.dinheiro_recebido)}{cx.obs_dinheiro ? ` — ${cx.obs_dinheiro}` : ""}</li>}
          {cx.check_cartoes_em && <li>💳 Cartões conferidos em {fmtDataHora(cx.check_cartoes_em)}{cx.obs_cartoes ? ` — ${cx.obs_cartoes}` : ""}</li>}
          {cx.check_pix_em && <li>📲 PIX conferido em {fmtDataHora(cx.check_pix_em)}{cx.obs_pix ? ` — ${cx.obs_pix}` : ""}</li>}
          {cx.check_notas_em && <li>🧾 Notas fiscais conferidas em {fmtDataHora(cx.check_notas_em)}{cx.obs_notas ? ` — ${cx.obs_notas}` : ""}</li>}
          {cx.conferido_em && <li>✔️ Conferência completa por <b>{nomes.nomeCompleto(cx.conferido_por)}</b> em {fmtDataHora(cx.conferido_em)}{cx.obs_conferencia ? ` — ${cx.obs_conferencia}` : ""}</li>}
          {cx.aprovado_em && <li>✅ Aprovado por <b>{nomes.nomeCompleto(cx.aprovado_por)}</b> em {fmtDataHora(cx.aprovado_em)}{cx.obs_aprovacao ? ` — ${cx.obs_aprovacao}` : ""}</li>}
          {cx.reaberto_em && <li>🔁 Reaberto para correção por <b>{nomes.nomeCompleto(cx.reaberto_por)}</b> em {fmtDataHora(cx.reaberto_em)} — {cx.motivo_reabertura}</li>}
          {cx.cancelado_em && <li>🚫 Cancelado por <b>{nomes.nomeCompleto(cx.cancelado_por)}</b> em {fmtDataHora(cx.cancelado_em)} — {cx.motivo_cancelamento}</li>}
          {cx.devolvido_em && <li>↩️ Última devolução: {nomes.nomeCompleto(cx.devolvido_por)} em {fmtDataHora(cx.devolvido_em)} — {cx.motivo_devolucao}</li>}
        </ul>
      </div>

      {modal === "receber" && <NovoAtendimento caixaId={cx.id} medicos={nomes.medicos} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "cortesia" && <NovoAtendimento cortesia caixaId={cx.id} medicos={nomes.medicos} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "saida" && <NovaSaida caixaId={cx.id} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "entrega" && <NovaSaida entrega fundoNaGaveta={fundoNaGaveta} diaNaGaveta={diaNaGaveta} caixaId={cx.id} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {modal === "fechar" && <FecharCaixa cx={cx} esperado={esperadoDinheiro} fundoNaGaveta={fundoNaGaveta} diaNaGaveta={diaNaGaveta} porForma={porForma} faltaReceber={faltaReceber} entregasPendentes={n2(entregasPendentes.reduce((t, x) => t + Number(x.valor), 0))} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); setFechouAgora(true); recarregar(); }} />}
      {modal === "dinheiro" && <ConferirDinheiro cx={cx} souQuemFechou={!!eu && cx.fechado_por === eu.id} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />}
      {(modal === "conferir" || modal === "aprovar" || modal === "devolver") && (
        <Decisao tipo={modal} cx={cx} souQuemFechou={!!eu && cx.fechado_por === eu.id} aoFechar={() => setModal("")} aoSalvar={() => { setModal(""); recarregar(); }} />
      )}
      {incluirAt && <IncluirNoAtendimento caixaId={cx.id} at={incluirAt} aoFechar={() => setIncluirAt(null)} aoSalvar={() => { setIncluirAt(null); recarregar(); }} />}
      {pagarAt && <ReceberSaldo caixaId={cx.id} at={pagarAt} aoFechar={() => setPagarAt(null)} aoSalvar={() => { setPagarAt(null); recarregar(); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ linhas de pagamento
interface LinhaPag { forma: Forma; valor: string; parcelas: string; pagador: string }
const linhaVazia = (valor = ""): LinhaPag => ({ forma: "pix", valor, parcelas: "2", pagador: "" });

function LinhasPagamento({ linhas, setLinhas }: { linhas: LinhaPag[]; setLinhas: (l: LinhaPag[]) => void }) {
  const muda = (i: number, k: keyof LinhaPag, v: string) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="inteiro">
      {linhas.map((l, i) => (
        <div key={i} className="grade g4" style={{ alignItems: "end", marginBottom: 6 }}>
          <Campo rotulo={i === 0 ? "Forma de pagamento" : "Outra forma"}>
            <select value={l.forma} onChange={(e) => muda(i, "forma", e.target.value)}>
              {ORDEM_FORMAS.map((f) => <option key={f} value={f}>{FORMAS_CAIXA[f]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor pago (R$)"><input inputMode="decimal" value={l.valor} onChange={(e) => muda(i, "valor", e.target.value)} /></Campo>
          {l.forma === "credito_parcelado" ? (
            <Campo rotulo="Parcelas">
              <select value={l.parcelas} onChange={(e) => muda(i, "parcelas", e.target.value)}>{Array.from({ length: 23 }, (_, k) => k + 2).map((n) => <option key={n} value={n}>{n}x</option>)}</select>
            </Campo>
          ) : l.forma === "pix" ? (
            <Campo rotulo="Quem pagou o PIX"><input value={l.pagador} onChange={(e) => muda(i, "pagador", e.target.value)} placeholder="nome no extrato" /></Campo>
          ) : <div />}
          <div>{linhas.length > 1 && <button className="mini" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>Remover</button>}</div>
        </div>
      ))}
      <button className="mini" onClick={() => setLinhas([...linhas, linhaVazia()])}>➕ Dividir em outra forma</button>
    </div>
  );
}

function validarLinhas(linhas: LinhaPag[]): { erro?: string; pags: { forma: Forma; valor: number; parcelas: number; pagador: string | null }[] } {
  const pags = [];
  for (const l of linhas) {
    if (!l.valor.trim()) continue;
    const v = lerValor(l.valor);
    if (v === null || v <= 0) return { erro: "Valor pago inválido.", pags: [] };
    pags.push({ forma: l.forma, valor: v, parcelas: l.forma === "credito_parcelado" ? Number(l.parcelas) : 1, pagador: l.forma === "pix" ? l.pagador.trim() || null : null });
  }
  return { pags };
}

async function gravarPagamentos(caixaId: string, atendimentoId: string, pags: ReturnType<typeof validarLinhas>["pags"]) {
  if (!pags.length) return;
  const { error } = await supabase.from("caixa_pagamentos").insert(pags.map((p) => ({ ...p, caixa_id: caixaId, atendimento_id: atendimentoId })));
  if (error) throw error;
}

// ------------------------------------------------------------------ modais
function NovoAtendimento({ caixaId, medicos, cortesia, aoFechar, aoSalvar }: {
  caixaId: string; medicos: { id: string; nome: string }[]; cortesia?: boolean; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [f, setF] = useState({ paciente: "", medico: "", valor: "", motivo: cortesia ? "Retorno" : "", autorizou: "", obs: "" });
  // tipos e itens marcados (pode marcar vários: ex. tonometria + mapeamento + microscopia no mesmo paciente)
  const [tipos, setTipos] = useState<TipoRecebimento[]>(["Consulta"]);
  const [itens, setItens] = useState<string[]>(cortesia ? ["Retorno"] : []);
  const [outros, setOutros] = useState("");
  const [filtro, setFiltro] = useState("");
  const [valorManual, setValorManual] = useState(false);
  const tabela = useTabelaParticular();
  const rosa = useGuiaRosa();
  // tabela de preços do recebimento: Particular ou Guia Rosa (pedido da recepção, 27/11)
  const [tabPreco, setTabPreco] = useState<TabelaPreco>("particular");
  const mapaDe = (t: TabelaPreco) => {
    const m = new Map(tabela.map((i) => [i.nome, i.valor]));
    if (t === "guia_rosa") for (const [k, v] of rosa) if (m.has(k)) m.set(k, v);
    return m;
  };
  const precoDe = useMemo(() => mapaDe(tabPreco), [tabela, rosa, tabPreco]); // eslint-disable-line react-hooks/exhaustive-deps
  const detalhes = (t: TipoRecebimento) => (tabela.length ? tabela.filter((i) => i.grupo === t).map((i) => i.nome) : DETALHES[t]);
  const somaTabela = (lista: string[], mapa = precoDe) => n2(lista.reduce((s, i) => s + (mapa.get(i) ?? 0), 0));
  function mudaTabPreco(t: TabelaPreco) {
    setTabPreco(t);
    if (!cortesia && !valorManual && tabela.length) {
      const soma = somaTabela(itens, mapaDe(t));
      mudaValor(soma ? soma.toFixed(2).replace(".", ",") : "");
    }
  }
  const descricao = [
    ...TIPOS_RECEBIMENTO.filter((t) => tipos.includes(t)).map((t) => {
      const marcados = detalhes(t).filter((d) => itens.includes(d));
      return marcados.length ? `${t} (${marcados.join(", ")})` : t;
    }),
    ...(outros.trim() ? [outros.trim()] : []),
  ].join(" + ");
  function alternaTipo(t: TipoRecebimento) {
    if (tipos.includes(t)) {
      if (tipos.length === 1) return; // pelo menos um tipo
      setTipos(tipos.filter((x) => x !== t));
      trocaItens(itens.filter((i) => !detalhes(t).includes(i)));
    } else setTipos([...tipos, t]);
  }
  // marcar/desmarcar itens soma os preços da tabela particular no valor (enquanto ninguém digitou o valor à mão)
  function trocaItens(novos: string[]) {
    setItens(novos);
    if (!cortesia && !valorManual && precoDe.size) {
      const soma = somaTabela(novos);
      mudaValor(soma ? soma.toFixed(2).replace(".", ",") : "");
    }
  }
  const alternaItem = (i: string) => {
    // achado pela busca em outro grupo: marca o grupo também
    const grupo = TIPOS_RECEBIMENTO.find((t) => detalhes(t).includes(i));
    if (grupo && !tipos.includes(grupo) && !itens.includes(i)) setTipos([...tipos, grupo]);
    trocaItens(itens.includes(i) ? itens.filter((x) => x !== i) : [...itens, i]);
  };
  // com algo digitado na busca, procura em TODOS os grupos (não só nos marcados)
  const casaBusca = (d: string) => !!filtro.trim() && semAcento(d).includes(semAcento(filtro.trim()));
  const [linhas, setLinhas] = useState<LinhaPag[]>([linhaVazia()]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const valor = lerValor(f.valor) ?? 0;
  const { pags } = validarLinhas(linhas);
  const pago = n2(pags.reduce((s, p) => s + p.valor, 0));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  // ao digitar o valor do atendimento, preenche o valor da 1ª forma (se ainda vazio ou igual ao anterior)
  function mudaValor(v: string) {
    const antigo = f.valor;
    setF({ ...f, valor: v });
    if (linhas.length === 1 && (!linhas[0].valor || linhas[0].valor === antigo)) setLinhas([{ ...linhas[0], valor: v }]);
  }

  async function salvar() {
    setErro("");
    if (f.paciente.trim().length < 2) return setErro("Informe o nome do paciente.");
    if (cortesia && !f.motivo.trim()) return setErro("Informe o motivo da cortesia.");
    if (!cortesia) {
      if (lerValor(f.valor) === null || valor <= 0) {
        // itens sem cobrança na tabela (ex.: Revisão, sessão seguinte de pacote de fotocoagulação)
        if (itens.length && itens.every((i) => precoDe.get(i) === 0))
          return setErro("Estes itens não são cobrados (R$ 0,00). Feche esta janela e use o botão “🎁 Cortesia (sem cobrança)”.");
        return setErro("Informe o valor do atendimento.");
      }
      const v = validarLinhas(linhas);
      if (v.erro) return setErro(v.erro);
      if (pago > valor) return setErro("O valor pago está maior que o valor do atendimento.");
    }
    setSalvando(true);
    try {
      const r = await supabase.from("caixa_atendimentos").insert({
        caixa_id: caixaId, paciente_nome: f.paciente.trim(), medico_id: f.medico || null, descricao, tabela: cortesia ? "particular" : tabPreco,
        valor: cortesia ? 0 : valor, cortesia: !!cortesia, motivo_cortesia: cortesia ? f.motivo.trim() : null,
        cortesia_autorizada_por: cortesia ? f.autorizou.trim() || null : null, observacao: f.obs.trim() || null,
      }).select("id").single();
      if (r.error) throw r.error;
      if (!cortesia) {
        try { await gravarPagamentos(caixaId, (r.data as { id: string }).id, pags); }
        catch (e) { setSalvando(false); return setErro("O atendimento foi lançado, mas o pagamento não: " + msgErro(e) + " — use o botão “Receber” na lista."); }
      }
      aoSalvar();
    } catch (e) { setErro(msgErro(e)); setSalvando(false); }
  }

  return (
    <Modal largo titulo={cortesia ? "Cortesia (atendimento sem cobrança)" : "Novo recebimento"} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        {!cortesia && rosa.size > 0 && (
          <div className="inteiro linha" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="pequeno muted">Tabela de preços:</span>
            <button type="button" className={tabPreco === "particular" ? "primario" : ""} onClick={() => mudaTabPreco("particular")}>Particular</button>
            <button type="button" className={tabPreco === "guia_rosa" ? "primario" : ""} onClick={() => mudaTabPreco("guia_rosa")}>🩷 Guia Rosa</button>
            {tabPreco === "guia_rosa" && <span className="pequeno muted">itens sem valor de Guia Rosa ficam com o preço particular</span>}
          </div>
        )}
        <Campo rotulo="Paciente (nome)" className="inteiro"><input value={f.paciente} onChange={set("paciente")} autoFocus /></Campo>
        <Campo rotulo="Médico / profissional">
          <select value={f.medico} onChange={set("medico")}><option value="">—</option>{medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
        </Campo>
        <Campo rotulo="O que foi feito (pode marcar mais de um)">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TIPOS_RECEBIMENTO.map((t) => (
              <button key={t} type="button" className={tipos.includes(t) ? "primario" : ""} onClick={() => alternaTipo(t)}>
                {tipos.includes(t) ? "✓ " : ""}{t}
              </button>
            ))}
          </div>
        </Campo>
        <div className="inteiro grade" style={{ gap: 8 }}>
          {tabela.length > 0 && (
            <input placeholder="🔎 Procurar na tabela (ex.: oct, blefaro, consulta cartão)" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          )}
          {TIPOS_RECEBIMENTO.filter((t) => tipos.includes(t) || detalhes(t).some(casaBusca)).map((t) => (
            <div key={t}>
              <div className="muted pequeno" style={{ marginBottom: 4 }}>
                {t === "Consulta" ? "Qual consulta?" : t === "Exame" ? "Quais exames? (marque todos que o paciente fez)" : "Quais procedimentos?"}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detalhes(t).filter((d) => itens.includes(d) || !filtro.trim() || semAcento(d).includes(semAcento(filtro.trim()))).map((d) => (
                  <button key={d} type="button" className={"mini-l" + (itens.includes(d) ? " primario" : "")} onClick={() => alternaItem(d)}>
                    {itens.includes(d) ? "✓ " : ""}{d}{precoDe.has(d) && <span style={{ opacity: 0.75 }}> · {fmtMoeda(precoDe.get(d)!)}{tabPreco === "guia_rosa" && rosa.has(d) ? " 🩷" : ""}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Campo rotulo="Outro (se não estiver na lista — opcional)"><input value={outros} onChange={(e) => setOutros(e.target.value)} placeholder="Ex.: Gonioscopia" /></Campo>
          <div className="pequeno">Vai aparecer no caixa como: <b>{descricao}</b></div>
        </div>
        {cortesia ? (
          <>
            <Campo rotulo="Motivo da cortesia"><input value={f.motivo} onChange={set("motivo")} placeholder="Ex.: retorno, funcionário, autorização do médico" /></Campo>
            <Campo rotulo="Quem autorizou"><input value={f.autorizou} onChange={set("autorizou")} /></Campo>
          </>
        ) : (
          <>
            <Campo rotulo="Valor do atendimento (R$)">
              <input inputMode="decimal" value={f.valor} onChange={(e) => { setValorManual(true); mudaValor(e.target.value); }} />
              {itens.some((i) => precoDe.has(i)) && (
                <span className="muted pequeno">
                  {tabPreco === "guia_rosa" ? "Tabela Guia Rosa" : "Tabela particular"}: {fmtMoeda(somaTabela(itens))}
                  {valorManual && somaTabela(itens) !== valor && (
                    <> · <a href="#" onClick={(e) => { e.preventDefault(); setValorManual(false); mudaValor(somaTabela(itens).toFixed(2).replace(".", ",")); }}>usar este valor</a></>
                  )}
                </span>
              )}
            </Campo>
            <LinhasPagamento linhas={linhas} setLinhas={setLinhas} />
            <div className="inteiro">
              Pago agora: <b>{fmtMoeda(pago)}</b>
              {valor > 0 && pago < valor && <> · <b style={{ color: "#c62828" }}>falta receber {fmtMoeda(n2(valor - pago))}</b> (fica pendente)</>}
              {valor > 0 && pago > valor && <> · <b style={{ color: "#c62828" }}>pago maior que o valor!</b></>}
            </div>
          </>
        )}
        <Campo rotulo="Observação (opcional)" className="inteiro"><input value={f.obs} onChange={set("obs")} /></Campo>
      </div>
    </Modal>
  );
}

function ReceberSaldo({ caixaId, at, aoFechar, aoSalvar }: { caixaId: string; at: Atendimento; aoFechar: () => void; aoSalvar: () => void }) {
  const saldo = saldoDe(at);
  const [linhas, setLinhas] = useState<LinhaPag[]>([linhaVazia(String(saldo).replace(".", ","))]);
  const [erro, setErro] = useState("");
  async function salvar() {
    setErro("");
    const v = validarLinhas(linhas);
    if (v.erro) return setErro(v.erro);
    if (!v.pags.length) return setErro("Informe o valor recebido.");
    try { await gravarPagamentos(caixaId, at.id, v.pags); aoSalvar(); } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal largo titulo={`Receber de ${at.paciente_nome}`} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Confirmar recebimento</button></>}>
      <Aviso>{erro}</Aviso>
      <p>{at.descricao ?? "Atendimento"} de {fmtData(at.criado_em)} · valor {fmtMoeda(at.valor)} · já pago {fmtMoeda(pagoDe(at))} · <b>falta {fmtMoeda(saldo)}</b></p>
      <div className="grade g2"><LinhasPagamento linhas={linhas} setLinhas={setLinhas} /></div>
    </Modal>
  );
}

/** Paciente já lançado volta do médico e vai fazer exames: inclui no MESMO atendimento (soma no valor e na descrição). */
function IncluirNoAtendimento({ caixaId, at, aoFechar, aoSalvar }: { caixaId: string; at: Atendimento; aoFechar: () => void; aoSalvar: () => void }) {
  const tabelaBase = useTabelaParticular();
  const rosa = useGuiaRosa();
  // usa a mesma tabela do recebimento original (Particular ou Guia Rosa)
  const tabela = at.tabela === "guia_rosa" ? tabelaBase.map((i) => (rosa.has(i.nome) ? { ...i, valor: rosa.get(i.nome)! } : i)) : tabelaBase;
  const lista = tabela.length ? tabela : TIPOS_RECEBIMENTO.flatMap((g) => DETALHES[g].map((nome) => ({ nome, grupo: g, valor: 0 })));
  const [itens, setItens] = useState<string[]>([]);
  const [outros, setOutros] = useState("");
  const [filtro, setFiltro] = useState("");
  const [valor, setValor] = useState("");
  const [valorManual, setValorManual] = useState(false);
  const [linhas, setLinhas] = useState<LinhaPag[]>([linhaVazia()]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const precoDe = new Map(lista.map((i) => [i.nome, i.valor]));
  const novaDescricao = [
    ...TIPOS_RECEBIMENTO.map((g) => {
      const m = lista.filter((i) => i.grupo === g && itens.includes(i.nome)).map((i) => i.nome);
      return m.length ? `${g} (${m.join(", ")})` : "";
    }).filter(Boolean),
    ...(outros.trim() ? [outros.trim()] : []),
  ].join(" + ");
  function mudaValor(v: string) {
    const antigo = valor;
    setValor(v);
    if (linhas.length === 1 && (!linhas[0].valor || linhas[0].valor === antigo)) setLinhas([{ ...linhas[0], valor: v }]);
  }
  function alterna(nome: string) {
    const novos = itens.includes(nome) ? itens.filter((x) => x !== nome) : [...itens, nome];
    setItens(novos);
    if (!valorManual) {
      const soma = n2(novos.reduce((s, i) => s + (precoDe.get(i) ?? 0), 0));
      mudaValor(soma ? soma.toFixed(2).replace(".", ",") : "");
    }
  }
  const adicional = lerValor(valor) ?? 0;
  const saldoAntes = saldoDe(at);
  const { pags } = validarLinhas(linhas);
  const pago = n2(pags.reduce((s, p) => s + p.valor, 0));

  async function salvar() {
    setErro("");
    if (!novaDescricao) return setErro("Marque o que foi incluído (ou escreva em “Outro”).");
    if (lerValor(valor) === null || adicional <= 0) return setErro("Informe o valor do que foi incluído.");
    const v = validarLinhas(linhas);
    if (v.erro) return setErro(v.erro);
    if (pago > n2(saldoAntes + adicional)) return setErro("O valor pago está maior do que falta receber.");
    setSalvando(true);
    const { error } = await supabase.from("caixa_atendimentos")
      .update({ valor: n2(Number(at.valor) + adicional), descricao: [at.descricao, novaDescricao].filter(Boolean).join(" + ") })
      .eq("id", at.id);
    if (error) { setSalvando(false); return setErro(msgErro(error)); }
    try { await gravarPagamentos(caixaId, at.id, v.pags); aoSalvar(); }
    catch (e) { setSalvando(false); setErro("Incluído, mas o pagamento não foi gravado: " + msgErro(e) + " — use o botão “Receber” na lista."); }
  }

  const visiveis = lista.filter((i) => itens.includes(i.nome) || !filtro.trim() || semAcento(i.nome).includes(semAcento(filtro.trim())));
  return (
    <Modal largo titulo={`Incluir no atendimento de ${at.paciente_nome}`} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Incluir"}</button></>}>
      <Aviso>{erro}</Aviso>
      <p className="pequeno">{at.tabela === "guia_rosa" && <><Etiqueta cor="roxo">🩷 Guia Rosa</Etiqueta> preços da Guia Rosa · </>}Já lançado: <b>{at.descricao ?? "Atendimento"}</b> · {fmtMoeda(at.valor)} · já pago {fmtMoeda(pagoDe(at))}</p>
      <div className="grade g2">
        <input className="inteiro" placeholder="🔎 Procurar (ex.: oct, mapeamento, tonometria)" value={filtro} onChange={(e) => setFiltro(e.target.value)} autoFocus />
        {(["Exame", "Procedimento", "Consulta"] as TipoRecebimento[]).map((g) => {
          const doGrupo = visiveis.filter((i) => i.grupo === g);
          if (!doGrupo.length) return null;
          return (
            <div key={g} className="inteiro">
              <div className="muted pequeno" style={{ marginBottom: 4 }}>{g === "Exame" ? "Exames" : g === "Procedimento" ? "Procedimentos" : "Consultas"}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {doGrupo.map((i) => (
                  <button key={i.nome} type="button" className={"mini-l" + (itens.includes(i.nome) ? " primario" : "")} onClick={() => alterna(i.nome)}>
                    {itens.includes(i.nome) ? "✓ " : ""}{i.nome}{i.valor > 0 && <span style={{ opacity: 0.75 }}> · {fmtMoeda(i.valor)}</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <Campo rotulo="Outro (se não estiver na lista — opcional)" className="inteiro"><input value={outros} onChange={(e) => setOutros(e.target.value)} /></Campo>
        <Campo rotulo="Valor do que está sendo incluído (R$)"><input inputMode="decimal" value={valor} onChange={(e) => { setValorManual(true); mudaValor(e.target.value); }} /></Campo>
        <div className="pequeno" style={{ alignSelf: "end" }}>Novo total do paciente: <b>{fmtMoeda(n2(Number(at.valor) + adicional))}</b></div>
        <LinhasPagamento linhas={linhas} setLinhas={setLinhas} />
        <div className="inteiro">
          Pago agora: <b>{fmtMoeda(pago)}</b>
          {n2(saldoAntes + adicional - pago) > 0 && <> · <b style={{ color: "#c62828" }}>falta receber {fmtMoeda(n2(saldoAntes + adicional - pago))}</b> (fica pendente)</>}
        </div>
      </div>
    </Modal>
  );
}

const MOTIVO_ENTREGA = "Dinheiro entregue ao administrativo";

const MOTIVO_FUNDO = "Fundo de troco entregue ao administrativo";

function NovaSaida({ caixaId, entrega, fundoNaGaveta = 0, diaNaGaveta = 0, aoFechar, aoSalvar }: {
  caixaId: string; entrega?: boolean; fundoNaGaveta?: number; diaNaGaveta?: number; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [f, setF] = useState({ valor: "", motivo: "", autorizou: "" });
  // entrega: dinheiro do dia ou fundo de troco (separados — pedido da recepção, 27/11)
  const [deQue, setDeQue] = useState<"dia" | "fundo">("dia");
  const [erro, setErro] = useState("");
  async function salvar() {
    const v = lerValor(f.valor);
    if (v === null || v <= 0) return setErro(entrega ? "Informe quanto dinheiro você está levando." : "Informe o valor da despesa.");
    if (!entrega && f.motivo.trim().length < 2) return setErro("Informe o motivo.");
    const base = deQue === "fundo" ? MOTIVO_FUNDO : MOTIVO_ENTREGA;
    if (entrega && deQue === "fundo" && v > fundoNaGaveta + 0.004) return setErro(`O fundo de troco na gaveta é ${fmtMoeda(fundoNaGaveta)}: não dá para entregar mais que isso como fundo.`);
    const motivo = entrega ? (f.motivo.trim() ? `${base} — ${f.motivo.trim()}` : base) : f.motivo.trim();
    const { error } = await supabase.from("caixa_saidas").insert({
      caixa_id: caixaId, valor: v, motivo, tipo: entrega ? (deQue === "fundo" ? "entrega_fundo" : "entrega_adm") : "despesa", autorizado_por: entrega ? null : f.autorizou.trim() || null,
    });
    if (error) setErro(msgErro(error)); else aoSalvar();
  }
  if (entrega) return (
    <Modal titulo="Entregar dinheiro ao administrativo" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Salvar e levar o dinheiro</button></>}>
      <Aviso>{erro}</Aviso>
      <p>Use quando for levar dinheiro para o administrativo. O caixa continua aberto.</p>
      <div className="linha" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" className={deQue === "dia" ? "primario" : ""} onClick={() => setDeQue("dia")}>💵 Dinheiro do dia <span className="pequeno">({fmtMoeda(diaNaGaveta)} na gaveta)</span></button>
        <button type="button" className={deQue === "fundo" ? "primario" : ""} onClick={() => { setDeQue("fundo"); if (!f.valor) setF({ ...f, valor: fundoNaGaveta.toFixed(2).replace(".", ",") }); }}>💰 Fundo de troco <span className="pequeno">({fmtMoeda(fundoNaGaveta)} na gaveta)</span></button>
      </div>
      <div className="grade g2">
        <Campo rotulo="Quanto dinheiro você vai levar (R$)"><input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} autoFocus /></Campo>
        <Campo rotulo="Observação (opcional)"><input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Ex.: pagamento do laser" /></Campo>
      </div>
      <p className="pequeno muted">Depois de salvar, suba com o dinheiro. O Luciano, a Soraline ou a Andrea conferem e clicam em “Recebi”.</p>
    </Modal>
  );
  return (
    <Modal titulo="Despesa paga com dinheiro do caixa" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Valor (R$)"><input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} autoFocus /></Campo>
        <Campo rotulo="Quem autorizou"><input value={f.autorizou} onChange={(e) => setF({ ...f, autorizou: e.target.value })} /></Campo>
        <Campo rotulo="Motivo" className="inteiro"><input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Ex.: compra de água, motoboy" /></Campo>
      </div>
    </Modal>
  );
}

function FecharCaixa({ cx, esperado, fundoNaGaveta, diaNaGaveta, porForma, faltaReceber, entregasPendentes, aoFechar, aoSalvar }: {
  cx: CaixaRow; esperado: number; fundoNaGaveta: number; diaNaGaveta: number; porForma: Record<Forma, number>; faltaReceber: number; entregasPendentes: number; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const v = lerValor(contado);
  async function salvar() {
    if (v === null || v < 0) return setErro("Digite quanto dinheiro você contou na gaveta.");
    if (!window.confirm("Fechar o caixa? Depois de fechado, ninguém consegue lançar nem alterar (só se for devolvido para correção).")) return;
    try { await rpc("caixa_fechar", { p_caixa: cx.id, p_contado: v, p_obs: obs }); aoSalvar(); } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo="Fechar o caixa" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Voltar</button><button className="primario" onClick={salvar}>🔒 Fechar caixa</button></>}>
      <Aviso>{erro}</Aviso>
      {entregasPendentes > 0 && <Aviso tipo="alerta">Atenção: {fmtMoeda(entregasPendentes)} entregue ao administrativo ainda <b>não teve o check</b> de quem recebeu. Dá para fechar mesmo assim; o check pode ser dado depois.</Aviso>}
      {faltaReceber > 0 && <Aviso tipo="alerta">Há {fmtMoeda(faltaReceber)} a receber de pacientes deste caixa. Eles continuam pendentes e podem ser recebidos em outro dia.</Aviso>}
      <table className="tabela" style={{ marginBottom: 12 }}>
        <tbody>
          {ORDEM_FORMAS.map((f) => <tr key={f}><td>{FORMAS_CAIXA[f]}</td><td style={num}>{fmtMoeda(porForma[f])}</td></tr>)}
          <tr><td>💰 Fundo de troco na gaveta</td><td style={num}>{fmtMoeda(fundoNaGaveta)}</td></tr>
          <tr><td>💵 Dinheiro do dia na gaveta<div className="pequeno muted">recebido em dinheiro − entregas − despesas</div></td><td style={num}>{fmtMoeda(diaNaGaveta)}</td></tr>
          <tr><td><b>Total que deve estar na gaveta</b></td><td style={num}><b>{fmtMoeda(esperado)}</b></td></tr>
        </tbody>
      </table>
      <Campo rotulo="Dinheiro contado na gaveta (R$)"><input inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} autoFocus /></Campo>
      {v !== null && <p>Diferença: <Diferenca v={n2(v - esperado)} /></p>}
      <Campo rotulo="Observação (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: explicação de alguma diferença" /></Campo>
      <p className="pequeno muted">Cartões: confira com o relatório da maquininha. PIX: confira com o extrato do banco.</p>
    </Modal>
  );
}

function ConferirDinheiro({ cx, souQuemFechou, aoFechar, aoSalvar }: { cx: CaixaRow; souQuemFechou: boolean; aoFechar: () => void; aoSalvar: () => void }) {
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const v = lerValor(contado);
  async function salvar() {
    if (v === null || v < 0) return setErro("Digite quanto dinheiro você recebeu (contou).");
    try { await rpc("caixa_conferir_dinheiro", { p_caixa: cx.id, p_contado: v, p_obs: obs }); aoSalvar(); } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo="1º check: conferir o dinheiro" aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Voltar</button><button className="primario" onClick={salvar}>✔️ Dinheiro OK</button></>}>
      <Aviso>{erro}</Aviso>
      {souQuemFechou && <Aviso tipo="alerta">Foi você quem fechou este caixa: outra pessoa precisa conferir.</Aviso>}
      <table className="tabela" style={{ marginBottom: 12 }}>
        <tbody>
          <tr><td>Dinheiro que deveria estar no caixa</td><td style={num}>{fmtMoeda(cx.esperado_dinheiro)}</td></tr>
          <tr><td>Quem fechou contou</td><td style={num}>{fmtMoeda(cx.contado_dinheiro)}</td></tr>
        </tbody>
      </table>
      <Campo rotulo="Dinheiro que você recebeu e contou (R$)"><input inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} autoFocus /></Campo>
      {v !== null && <p>Comparado com o que deveria ter: <Diferenca v={n2(v - Number(cx.esperado_dinheiro ?? 0))} />
        {cx.contado_dinheiro != null && Math.abs(v - Number(cx.contado_dinheiro)) >= 0.005 && <> · <b style={{ color: "#c62828" }}>diferente do que a recepção contou ({fmtMoeda(cx.contado_dinheiro)})</b></>}</p>}
      <Campo rotulo="Observação (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      <p className="pequeno muted">Depois deste check o caixa fica com você. Durante a semana você confere cartões, PIX e notas fiscais e dá o 2º check.</p>
    </Modal>
  );
}

const ITENS_CONFERENCIA = [
  { item: "cartoes", rotulo: "💳 Cartões", ajuda: "conferido com o relatório/comprovantes da maquininha", em: "check_cartoes_em", obs: "obs_cartoes" },
  { item: "pix", rotulo: "📲 PIX", ajuda: "conferido com o extrato do banco", em: "check_pix_em", obs: "obs_pix" },
  { item: "notas", rotulo: "🧾 Notas fiscais", ajuda: "todas as notas do dia conferidas", em: "check_notas_em", obs: "obs_notas" },
] as const;

function PainelConferencia({ cx, pode, nomeConferente, aoMudar, aoConcluir }: {
  cx: CaixaRow; pode: boolean; nomeConferente: string; aoMudar: () => void; aoConcluir: () => void;
}) {
  const [obs, setObs] = useState<Record<string, string>>(() => Object.fromEntries(ITENS_CONFERENCIA.map((i) => [i.item, (cx[i.obs] as string | null | undefined) ?? ""])));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState("");
  async function marcar(item: string, feito: boolean) {
    setErro(""); setSalvando(item);
    try { await rpc("caixa_conferencia_marcar", { p_caixa: cx.id, p_item: item, p_feito: feito, p_obs: obs[item] ?? "" }); aoMudar(); }
    catch (e) { setErro(msgErro(e)); }
    setSalvando("");
  }
  const tudo = ITENS_CONFERENCIA.every((i) => !!cx[i.em]);
  return (
    <div className="painel nao-imprimir" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>2º check: conferência da semana <span className="pequeno muted">(com {nomeConferente})</span></h3>
      <Aviso>{erro}</Aviso>
      {!pode && <Aviso tipo="info">Só {nomeConferente}, que conferiu o dinheiro, pode continuar esta conferência.</Aviso>}
      <table className="tabela">
        <tbody>
          {ITENS_CONFERENCIA.map((i) => {
            const feito = !!cx[i.em];
            return (
              <tr key={i.item}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <label className="check">
                    <input type="checkbox" checked={feito} disabled={!pode || salvando === i.item} onChange={(e) => marcar(i.item, e.target.checked)} />
                    <b>&nbsp;{i.rotulo}</b>
                  </label>
                  <div className="pequeno muted">{i.ajuda}</div>
                  {feito && <div className="pequeno">✔ {fmtDataHora(cx[i.em] as string)}</div>}
                </td>
                <td style={{ width: "100%" }}>
                  <input value={obs[i.item]} disabled={!pode} placeholder="Observação (ex.: falta a nota da paciente Maria)"
                    onChange={(e) => setObs({ ...obs, [i.item]: e.target.value })}
                    onBlur={() => { if (pode && (obs[i.item] ?? "") !== ((cx[i.obs] as string | null | undefined) ?? "")) marcar(i.item, feito); }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pode && (
        <div className="linha" style={{ marginTop: 10 }}>
          <button className="primario" disabled={!tudo} onClick={aoConcluir}>✔️ Conferência completa: entregar ao Luciano</button>
          {!tudo && <span className="pequeno muted">Marque os três itens para liberar.</span>}
        </div>
      )}
    </div>
  );
}

function Decisao({ tipo, cx, souQuemFechou, aoFechar, aoSalvar }: {
  tipo: "conferir" | "aprovar" | "devolver"; cx: CaixaRow; souQuemFechou: boolean; aoFechar: () => void; aoSalvar: () => void;
}) {
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const titulo = { conferir: cx.setor === "orientacao" ? "Conferir o caixa" : "Conferência completa: entregar ao Luciano", aprovar: "Aprovar o caixa", devolver: "Devolver para correção" }[tipo];
  async function salvar() {
    setErro("");
    try {
      if (tipo === "devolver") {
        if (!obs.trim()) return setErro("Escreva o que precisa ser corrigido.");
        await rpc("caixa_devolver", { p_caixa: cx.id, p_motivo: obs });
      } else await rpc(tipo === "conferir" ? "caixa_conferir" : "caixa_aprovar", { p_caixa: cx.id, p_obs: obs });
      aoSalvar();
    } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} rodape={<><button onClick={aoFechar}>Voltar</button><button className="primario" onClick={salvar}>{titulo}</button></>}>
      <Aviso>{erro}</Aviso>
      {tipo === "conferir" && souQuemFechou && <Aviso tipo="alerta">Foi você quem fechou este caixa: outra pessoa precisa conferir.</Aviso>}
      {tipo === "conferir" && (cx.setor === "orientacao"
        ? <p>Confira o dinheiro entregue, o relatório das maquininhas e o extrato do PIX com os totais desta tela.</p>
        : <p>Dinheiro, cartões, PIX e notas fiscais conferidos. O caixa vai para a aprovação final.</p>)}
      {tipo === "aprovar" && <p>Aprovação final do caixa de {fmtData(cx.data)}.</p>}
      {tipo === "devolver" && <p>O caixa volta a ficar <b>aberto</b> para a recepção corrigir e fechar de novo. Só dá para devolver se não houver outro caixa aberto.</p>}
      <Campo rotulo={tipo === "devolver" ? "O que precisa ser corrigido" : "Observação (opcional)"}><input value={obs} onChange={(e) => setObs(e.target.value)} autoFocus /></Campo>
    </Modal>
  );
}
