// Protocolos de consulta (migração 0023): preenchem com um clique os campos VAZIOS do atendimento,
// pedem os exames de rotina e marcam o acompanhamento. Nunca apagam o que o médico já escreveu.
import { useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Modal, Campo } from "./ui";
import { CONDICOES, fmtIntervalo } from "./Seguimento";

type CamposAtend = Partial<Record<"queixa_principal" | "historia_doenca_atual" | "conduta" | "orientacoes" | "retorno_em", string>>;
type CamposExame = Partial<Record<"ectoscopia" | "motilidade_ocular" | "reflexos_pupilares" | "biomicroscopia_od" | "biomicroscopia_oe" | "gonioscopia_od" | "gonioscopia_oe" | "fundoscopia_od" | "fundoscopia_oe" | "outros_achados", string>>;
export interface ConteudoProtocolo { atendimento?: CamposAtend; exame?: CamposExame; exames?: string[]; seguimento?: { condicao: string; dias: number } }
interface Protocolo { id: string; titulo: string; descricao?: string | null; conteudo: ConteudoProtocolo; padrao?: boolean }

const BIO_NORMAL = "Pálpebras e cílios sem alterações, conjuntiva calma, córnea transparente, câmara anterior formada, íris sem alterações, cristalino transparente.";
const FO_NORMAL = "Disco óptico de bordos nítidos, escavação fisiológica, mácula com brilho preservado, vasos de calibre normal, retina aplicada.";

export const PROTOCOLOS_PADRAO: Protocolo[] = [
  { id: "p-rotina", padrao: true, titulo: "Consulta de rotina / refração", descricao: "Exame completo de rotina, sem queixas",
    conteudo: { atendimento: { queixa_principal: "Consulta de rotina.", conduta: "Prescrição de óculos conforme refração.", orientacoes: "Usar os óculos conforme orientado. Retornar se houver piora da visão, dor ou vermelhidão.", retorno_em: "1 ano" },
      exame: { ectoscopia: "Sem alterações.", motilidade_ocular: "Movimentos oculares preservados.", reflexos_pupilares: "Pupilas isocóricas e fotorreagentes.", biomicroscopia_od: BIO_NORMAL, biomicroscopia_oe: BIO_NORMAL, fundoscopia_od: FO_NORMAL, fundoscopia_oe: FO_NORMAL } } },
  { id: "p-glaucoma", padrao: true, titulo: "Retorno de glaucoma", descricao: "Controle de PIO, adesão ao colírio, campo visual e OCT",
    conteudo: { atendimento: { queixa_principal: "Retorno para controle de glaucoma.", historia_doenca_atual: "Em uso de colírio hipotensor. Refere boa adesão ao tratamento. Nega efeitos colaterais.", conduta: "Mantida medicação hipotensora. Solicitados campo visual e OCT de nervo óptico.", orientacoes: "Usar os colírios todos os dias, nos horários indicados, mesmo sem sintomas. Glaucoma não dói: não interromper o tratamento.", retorno_em: "4 meses" },
      exame: { gonioscopia_od: "Ângulo aberto.", gonioscopia_oe: "Ângulo aberto." },
      exames: ["Campo visual computadorizado", "OCT de nervo óptico (camada de fibras)", "Retinografia"], seguimento: { condicao: "glaucoma", dias: 120 } } },
  { id: "p-catarata", padrao: true, titulo: "Avaliação pré-operatória de catarata", descricao: "Indicação cirúrgica e exames pré-operatórios",
    conteudo: { atendimento: { queixa_principal: "Baixa visual progressiva.", historia_doenca_atual: "Refere piora gradual da visão, ofuscamento e dificuldade para dirigir à noite.", conduta: "Indicada facoemulsificação com implante de lente intraocular. Solicitados exames pré-operatórios.", orientacoes: "Trazer os exames pré-operatórios. Explicados riscos, benefícios e alternativas da cirurgia.", retorno_em: "Após os exames" },
      exames: ["Biometria óptica", "Microscopia especular de córnea", "Topografia de córnea", "Mapeamento de retina"] } },
  { id: "p-posop1", padrao: true, titulo: "Pós-operatório de catarata (1º dia)", descricao: "Retorno do dia seguinte",
    conteudo: { atendimento: { queixa_principal: "Pós-operatório de 1º dia de facoemulsificação.", historia_doenca_atual: "Nega dor intensa. Usando colírios conforme orientado.", conduta: "Manter colírio antibiótico + corticoide conforme receita.", orientacoes: "Não coçar nem apertar o olho. Usar o protetor para dormir por 7 dias. Evitar esforço físico, piscina e maquiagem. Procurar a clínica se houver dor forte, piora da visão ou muita vermelhidão.", retorno_em: "7 dias" },
      seguimento: { condicao: "pos_operatorio", dias: 30 } } },
  { id: "p-retino", padrao: true, titulo: "Rastreio de retinopatia diabética", descricao: "Paciente diabético: fundo de olho sob dilatação",
    conteudo: { atendimento: { queixa_principal: "Avaliação de fundo de olho em paciente diabético.", conduta: "Orientado controle rigoroso da glicemia e da pressão arterial.", orientacoes: "O controle do açúcar no sangue protege a visão. Fazer o exame de fundo de olho pelo menos 1 vez por ano.", retorno_em: "1 ano" },
      exames: ["Retinografia colorida", "OCT de mácula"], seguimento: { condicao: "diabetes_sem_retinopatia", dias: 365 } } },
  { id: "p-dmri", padrao: true, titulo: "Retorno de DMRI / injeção intravítrea", descricao: "Acompanhamento de degeneração macular",
    conteudo: { atendimento: { queixa_principal: "Retorno para acompanhamento de DMRI.", conduta: "Avaliado OCT de mácula. Programada nova aplicação intravítrea conforme protocolo.", orientacoes: "Fazer a tela de Amsler em casa toda semana, cobrindo um olho de cada vez. Procurar a clínica se as linhas ficarem tortas ou houver mancha nova.", retorno_em: "4 semanas" },
      exames: ["OCT de mácula"], seguimento: { condicao: "dmri", dias: 90 } } },
  { id: "p-olhoseco", padrao: true, titulo: "Olho seco", descricao: "Ardor, areia, vermelhidão",
    conteudo: { atendimento: { queixa_principal: "Ardor, sensação de areia e vermelhidão nos olhos.", conduta: "Prescrito lubrificante ocular. Orientadas medidas de higiene palpebral.", orientacoes: "Piscar mais vezes ao usar tela. Fazer compressa morna nas pálpebras 2 vezes ao dia. Evitar ar-condicionado e vento direto nos olhos.", retorno_em: "2 meses" } } },
  { id: "p-crianca", padrao: true, titulo: "Primeira consulta infantil", descricao: "Avaliação de criança (refração sob cicloplegia)",
    conteudo: { atendimento: { queixa_principal: "Avaliação oftalmológica infantil.", conduta: "Refração sob cicloplegia. Prescrição de óculos se necessário.", orientacoes: "Após o colírio, a visão fica embaçada e a pupila dilatada por algumas horas. Proteger do sol.", retorno_em: "1 ano" },
      exame: { motilidade_ocular: "Ortoforia, movimentos oculares preservados.", reflexos_pupilares: "Pupilas isocóricas e fotorreagentes. Reflexo vermelho presente e simétrico." } } },
];

/** Aplica um protocolo: só campos vazios; pede exames que ainda não foram pedidos; marca acompanhamento */
async function aplicar(atendId: string, pacienteId: string, c: ConteudoProtocolo, seguir: boolean): Promise<string[]> {
  const feito: string[] = [];
  if (c.atendimento) {
    const a = ok(await supabase.from("atendimentos").select("queixa_principal, historia_doenca_atual, conduta, orientacoes, retorno_em").eq("id", atendId).single()) as Record<string, string | null>;
    const upd = Object.fromEntries(Object.entries(c.atendimento).filter(([k, v]) => v && !a[k]?.trim()));
    if (Object.keys(upd).length) {
      const r = await supabase.from("atendimentos").update(upd).eq("id", atendId);
      if (r.error) throw r.error;
      feito.push(`${Object.keys(upd).length} campo(s) da anamnese/conduta`);
    }
  }
  if (c.exame) {
    const e = (ok(await supabase.from("exames_oftalmologicos").select("*").eq("atendimento_id", atendId)) as Record<string, string | null>[])[0] ?? {};
    const upd = Object.fromEntries(Object.entries(c.exame).filter(([k, v]) => v && !String(e[k] ?? "").trim()));
    if (Object.keys(upd).length) {
      const r = await supabase.from("exames_oftalmologicos").upsert({ ...upd, atendimento_id: atendId }, { onConflict: "atendimento_id" });
      if (r.error) throw r.error;
      feito.push(`${Object.keys(upd).length} campo(s) do exame`);
    }
  }
  if (c.exames?.length) {
    const ja = (ok(await supabase.from("solicitacoes_exames").select("exame").eq("atendimento_id", atendId)) as { exame: string }[]).map((x) => x.exame.toLowerCase());
    const novos = c.exames.filter((x) => !ja.includes(x.toLowerCase()));
    if (novos.length) {
      const r = await supabase.from("solicitacoes_exames").insert(novos.map((exame) => ({ atendimento_id: atendId, exame, olho: "AO" })));
      if (r.error) throw r.error;
      feito.push(`${novos.length} pedido(s) de exame`);
    }
  }
  if (c.seguimento && seguir) {
    const { count } = await supabase.from("seguimentos").select("id", { count: "exact", head: true }).eq("paciente_id", pacienteId).eq("condicao", c.seguimento.condicao).eq("ativo", true);
    if (!count) {
      const r = await supabase.from("seguimentos").insert({ paciente_id: pacienteId, condicao: c.seguimento.condicao, intervalo_dias: c.seguimento.dias });
      if (r.error) throw r.error;
      feito.push(`acompanhamento (${CONDICOES[c.seguimento.condicao]?.rotulo})`);
    }
  }
  return feito;
}

export function BotaoProtocolo({ atendId, pacienteId, aoAplicar }: { atendId: string; pacienteId: string; aoAplicar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [salvar, setSalvar] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)} title="Preenche os campos vazios com um modelo de consulta">📋 Protocolo</button>
      {aberto && <EscolherProtocolo atendId={atendId} pacienteId={pacienteId} aoFechar={() => setAberto(false)} aoSalvarNovo={() => { setAberto(false); setSalvar(true); }}
        aoAplicar={() => { setAberto(false); aoAplicar(); }} />}
      {salvar && <SalvarComoProtocolo atendId={atendId} aoFechar={() => setSalvar(false)} />}
    </>
  );
}

function EscolherProtocolo(props: { atendId: string; pacienteId: string; aoFechar: () => void; aoAplicar: () => void; aoSalvarNovo: () => void }) {
  const meus = useCarregar(async () => ok(await supabase.from("protocolos_consulta").select("*").eq("ativo", true).order("titulo")) as Protocolo[], []);
  const todos = [...(meus.dados ?? []), ...PROTOCOLOS_PADRAO];
  const [sel, setSel] = useState<Protocolo | null>(null);
  const [seguir, setSeguir] = useState(true);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<string[] | null>(null);
  async function ir() {
    if (!sel) return;
    setErro("");
    try { setFeito(await aplicar(props.atendId, props.pacienteId, sel.conteudo, seguir)); } catch (e) { setErro(msgErro(e)); }
  }
  const c = sel?.conteudo;
  return (
    <Modal titulo="📋 Protocolo de consulta" largo aoFechar={feito ? props.aoAplicar : props.aoFechar}
      rodape={feito ? <button className="primario" onClick={props.aoAplicar}>Fechar</button> : <>
        <button className="sutil" onClick={props.aoSalvarNovo}>💾 Salvar esta consulta como protocolo</button>
        <span style={{ flex: 1 }} />
        <button onClick={props.aoFechar}>Cancelar</button>
        <button className="primario" disabled={!sel} onClick={ir}>Aplicar</button></>}>
      <Aviso>{erro || meus.erro}</Aviso>
      {feito ? (
        <Aviso tipo="ok">{feito.length ? <>Preenchido: {feito.join(", ")}. Confira e ajuste o que for preciso.</> : "Nada a preencher: os campos do protocolo já estavam preenchidos."}</Aviso>
      ) : (
        <div className="grade g2">
          <div className="lista-protocolos">
            {todos.map((p) => (
              <button key={p.id} className={"wa-item" + (sel?.id === p.id ? " ativo" : "")} onClick={() => setSel(p)}>
                <b>{p.titulo}</b>{!p.padrao && <span className="etiqueta azul" style={{ marginLeft: 6 }}>salvo</span>}
                {p.descricao && <div className="muted pequeno">{p.descricao}</div>}
              </button>
            ))}
          </div>
          <div className="pequeno">
            {!c ? <div className="muted">Escolha um protocolo para ver o que ele preenche.</div> : (
              <>
                <p className="muted" style={{ marginTop: 0 }}>Só os campos <b>vazios</b> são preenchidos. O que você já escreveu não muda.</p>
                {c.atendimento && Object.entries(c.atendimento).map(([k, v]) => <div key={k} style={{ marginBottom: 6 }}><b>{ROTULOS[k] ?? k}:</b> {v}</div>)}
                {c.exame && <div style={{ marginBottom: 6 }}><b>Exame:</b> {Object.keys(c.exame).map((k) => ROTULOS[k] ?? k).join(", ")}</div>}
                {c.exames?.length ? <div style={{ marginBottom: 6 }}><b>Pedidos de exame:</b> {c.exames.join(", ")}</div> : null}
                {c.seguimento && (
                  <label className="check" style={{ marginTop: 8 }}>
                    <input type="checkbox" checked={seguir} onChange={(e) => setSeguir(e.target.checked)} />
                    Marcar acompanhamento: {CONDICOES[c.seguimento.condicao]?.rotulo}, retorno a cada {fmtIntervalo(c.seguimento.dias)}
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

const ROTULOS: Record<string, string> = {
  queixa_principal: "Queixa", historia_doenca_atual: "História", conduta: "Conduta", orientacoes: "Orientações", retorno_em: "Retorno",
  ectoscopia: "ectoscopia", motilidade_ocular: "motilidade", reflexos_pupilares: "pupilas", biomicroscopia_od: "biomicroscopia OD",
  biomicroscopia_oe: "biomicroscopia OE", gonioscopia_od: "gonioscopia OD", gonioscopia_oe: "gonioscopia OE",
  fundoscopia_od: "fundoscopia OD", fundoscopia_oe: "fundoscopia OE", outros_achados: "outros achados",
};

/** Guarda o que está escrito no atendimento como um protocolo novo (sem dados que identifiquem o paciente) */
function SalvarComoProtocolo({ atendId, aoFechar }: { atendId: string; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [compartilhado, setCompartilhado] = useState(true);
  const [erro, setErro] = useState("");
  const [ok2, setOk2] = useState(false);
  async function salvar() {
    if (!titulo.trim()) return setErro("Dê um nome ao protocolo.");
    try {
      const a = ok(await supabase.from("atendimentos").select("queixa_principal, historia_doenca_atual, conduta, orientacoes, retorno_em").eq("id", atendId).single()) as CamposAtend;
      const e = ((ok(await supabase.from("exames_oftalmologicos").select("ectoscopia, motilidade_ocular, reflexos_pupilares, biomicroscopia_od, biomicroscopia_oe, gonioscopia_od, gonioscopia_oe, fundoscopia_od, fundoscopia_oe, outros_achados").eq("atendimento_id", atendId)) as CamposExame[])[0]) ?? {};
      const ex = (ok(await supabase.from("solicitacoes_exames").select("exame").eq("atendimento_id", atendId).neq("status", "cancelado")) as { exame: string }[]).map((x) => x.exame);
      const limpa = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v && String(v).trim()));
      const conteudo: ConteudoProtocolo = { atendimento: limpa(a), exame: limpa(e), exames: [...new Set(ex)] };
      const r = await supabase.from("protocolos_consulta").insert({ titulo: titulo.trim(), conteudo, compartilhado });
      if (r.error) throw r.error;
      setOk2(true);
    } catch (e) { setErro(msgErro(e)); }
  }
  return (
    <Modal titulo="💾 Salvar consulta como protocolo" aoFechar={aoFechar}
      rodape={ok2 ? <button className="primario" onClick={aoFechar}>Fechar</button> : <><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
      <Aviso>{erro}</Aviso>
      {ok2 ? <Aviso tipo="ok">Protocolo salvo. Ele aparece na lista de protocolos.</Aviso> : (
        <>
          <Campo rotulo="Nome do protocolo"><input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Retorno de ceratocone" /></Campo>
          <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={compartilhado} onChange={(e) => setCompartilhado(e.target.checked)} /> Outros médicos também podem usar</label>
          <Aviso tipo="alerta">Guarda os textos da anamnese, do exame, da conduta e os pedidos de exame <b>desta</b> consulta. Antes de salvar, confira se não há nome ou dado pessoal do paciente nos textos.</Aviso>
        </>
      )}
    </Modal>
  );
}
