import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { CLINICA } from "../lib/marca";
import { TIPOS_DOC } from "../components/pep/SecoesConduta";
import { fmtCPF, fmtData, fmtGrau, idade } from "../lib/util";

interface Pac { nome: string; nome_social: string | null; numero_prontuario: number; data_nascimento: string | null; cpf: string | null; logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; uf: string | null }
interface Prof { nome: string; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null; especialidade: string | null; rqe: string | null }

const SEL_PAC = "nome, nome_social, numero_prontuario, data_nascimento, cpf, logradouro, numero, bairro, cidade, uf";
const SEL_PROF = "nome, conselho, numero_conselho, uf_conselho, especialidade, rqe";

async function viaAtendimento(atendimentoId: string) {
  const a = ok(await supabase.from("atendimentos").select(`inicio, pacientes(${SEL_PAC}), profissionais(${SEL_PROF})`).eq("id", atendimentoId).single()) as unknown as { inicio: string; pacientes: Pac; profissionais: Prof };
  return a;
}

export default function Imprimir() {
  const { tipo, id } = useParams();
  const { dados, erro, carregando } = useCarregar(async () => {
    switch (tipo) {
      case "oculos": {
        const r = ok(await supabase.from("prescricoes_oculos").select("*").eq("id", id!).single()) as Record<string, unknown>;
        return { ...(await viaAtendimento(r.atendimento_id as string)), r, data: r.criado_em as string };
      }
      case "receita": {
        const r = ok(await supabase.from("prescricoes").select("*, prescricao_itens(*)").eq("id", id!).single()) as Record<string, unknown>;
        return { ...(await viaAtendimento(r.atendimento_id as string)), r, data: r.criado_em as string };
      }
      case "pedidos": {
        const r = ok(await supabase.from("solicitacoes_exames").select("*").eq("atendimento_id", id!).neq("status", "cancelado").order("criado_em")) as Record<string, unknown>[];
        const a = await viaAtendimento(id!);
        return { ...a, r, data: a.inicio };
      }
      case "documento": {
        const r = ok(await supabase.from("documentos_clinicos").select("*").eq("id", id!).single()) as Record<string, unknown>;
        return { ...(await viaAtendimento(r.atendimento_id as string)), r, data: r.criado_em as string };
      }
      case "laudo": {
        const r = ok(await supabase.from("exames_realizados").select(`*, pacientes(${SEL_PAC})`).eq("id", id!).single()) as Record<string, unknown>;
        const prof = ok(await supabase.from("profissionais").select(SEL_PROF).eq("id", r.laudado_por as string).single()) as Prof;
        return { pacientes: r.pacientes as Pac, profissionais: prof, r, data: r.laudado_em as string, inicio: r.laudado_em as string };
      }
    }
    throw new Error("Documento desconhecido");
  }, [tipo, id]);

  useEffect(() => {
    if (dados) setTimeout(() => window.print(), 400);
  }, [dados]);

  if (carregando) return <Carregando />;
  if (!dados) return <Aviso>{erro}</Aviso>;
  const { pacientes: p, profissionais: m, r, data } = dados as unknown as { pacientes: Pac; profissionais: Prof; r: Record<string, unknown> & Record<string, unknown>[]; data: string };

  let titulo = "";
  let corpo: ReactNode = null;

  if (tipo === "oculos") {
    titulo = "RECEITA DE ÓCULOS";
    const g = (k: string) => fmtGrau(r[k] as number);
    const ex = (k: string) => (r[k] !== null && r[k] !== undefined ? `${r[k]}°` : "");
    corpo = (
      <>
        <table>
          <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>DNP</th></tr></thead>
          <tbody>
            <tr><th>OD</th><td>{g("longe_od_esferico")}</td><td>{g("longe_od_cilindrico")}</td><td>{ex("longe_od_eixo")}</td><td>{(r.dnp_od as string) ?? ""}</td></tr>
            <tr><th>OE</th><td>{g("longe_oe_esferico")}</td><td>{g("longe_oe_cilindrico")}</td><td>{ex("longe_oe_eixo")}</td><td>{(r.dnp_oe as string) ?? ""}</td></tr>
          </tbody>
        </table>
        {r.adicao !== null && <p><b>Adição para perto:</b> {g("adicao")}</p>}
        {!!r.tipo_lente && <p><b>Lente:</b> {r.tipo_lente as string}</p>}
        {!!r.observacoes && <p><b>Observações:</b> {r.observacoes as string}</p>}
        {!!r.validade && <p>Válida até {fmtData(r.validade as string)}.</p>}
      </>
    );
  } else if (tipo === "receita") {
    const tr = r.tipo_receita as string;
    titulo = tr === "controle_especial" ? "RECEITUÁRIO DE CONTROLE ESPECIAL" : tr === "antimicrobiano" ? "RECEITA — ANTIMICROBIANO" : "RECEITA";
    const itens = [...((r.prescricao_itens as Record<string, string | number | null>[]) ?? [])].sort((a, b) => Number(a.ordem) - Number(b.ordem));
    corpo = (
      <ol style={{ fontSize: 15, lineHeight: 1.6 }}>
        {itens.map((i) => (
          <li key={i.id as string} style={{ marginBottom: 14 }}>
            <b>{i.medicamento}</b>{i.apresentacao && ` — ${i.apresentacao}`}{i.quantidade && ` ........ ${i.quantidade}`}
            <div>{i.via && `Uso ${String(i.via).toLowerCase()}. `}{i.posologia}{i.olho && ` ${i.olho === "AO" ? "em ambos os olhos" : i.olho === "OD" ? "no olho direito" : "no olho esquerdo"}`}{i.duracao && `, por ${i.duracao}`}.</div>
          </li>
        ))}
      </ol>
    );
  } else if (tipo === "pedidos") {
    titulo = "SOLICITAÇÃO DE EXAMES";
    corpo = (
      <>
        <p>Solicito os seguintes exames:</p>
        <ol style={{ fontSize: 15, lineHeight: 1.7 }}>
          {(r as unknown as Record<string, string | boolean | null>[]).map((x) => (
            <li key={x.id as string}><b>{x.exame}</b>{x.olho && ` — ${x.olho}`}{x.urgente && " (URGENTE)"}{x.codigo_tuss && <span> · TUSS {x.codigo_tuss}</span>}</li>
          ))}
        </ol>
        {[...new Set((r as unknown as { justificativa: string | null }[]).map((x) => x.justificativa).filter(Boolean))].map((j) => <p key={j}><b>Indicação clínica:</b> {j}</p>)}
      </>
    );
  } else if (tipo === "documento") {
    titulo = (TIPOS_DOC[r.tipo as string] ?? "Documento").toUpperCase();
    corpo = (
      <>
        <p style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7, textAlign: "justify" }}>{r.conteudo as string}</p>
        {!!r.cid10 && <p>CID-10: {r.cid10 as string}</p>}
      </>
    );
  } else if (tipo === "laudo") {
    titulo = `LAUDO — ${(r.exame as string).toUpperCase()}`;
    corpo = (
      <>
        {!!r.olho && <p><b>Olho:</b> {r.olho as string}</p>}
        <p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{r.laudo as string}</p>
        {!!r.conclusao && <p><b>Conclusão:</b> {r.conclusao as string}</p>}
      </>
    );
  }

  const end = [p.logradouro, p.numero, p.bairro, p.cidade && `${p.cidade}/${p.uf ?? ""}`].filter(Boolean).join(", ");
  const rodape = [CLINICA.endereco, CLINICA.telefone, CLINICA.cnpj && `CNPJ ${CLINICA.cnpj}`, CLINICA.site].filter(Boolean).join(" · ");

  return (
    <div style={{ background: "#e9edf1", minHeight: "100vh", padding: "20px 0" }}>
      <div className="barra-impressao">
        <button className="primario" onClick={() => window.print()}>🖨️ Imprimir</button>
        <button onClick={() => window.close()}>Fechar</button>
      </div>
      <div className="folha">
        <div className="timbre">
          <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ height: 46 }} />
          <div style={{ textAlign: "right", fontSize: 12, color: "#444" }}>{rodape}</div>
        </div>
        <div style={{ fontSize: 14 }}>
          <b>Paciente:</b> {p.nome_social ? `${p.nome_social} (${p.nome})` : p.nome}<br />
          {p.data_nascimento && <>Nascimento: {fmtData(p.data_nascimento)} ({idade(p.data_nascimento)}) · </>}
          {p.cpf && <>CPF: {fmtCPF(p.cpf)} · </>}Prontuário: {p.numero_prontuario}
          {(tipo === "receita" && r.tipo_receita !== "simples" && end) && <><br />Endereço: {end}</>}
        </div>
        <h1>{titulo}</h1>
        {corpo}
        <div className="assinatura">
          <p>{(CLINICA.endereco.split(",").slice(-1)[0] || "").trim() || "Data"}: {fmtData(data)}</p>
          <div className="traco" />
          <b>{m.nome}</b><br />
          {m.conselho ?? "CRM"} {m.numero_conselho ?? "_______"}{m.uf_conselho && `/${m.uf_conselho}`}
          {m.especialidade && <> · {m.especialidade}</>}{m.rqe && <> · RQE {m.rqe}</>}
        </div>
      </div>
    </div>
  );
}
