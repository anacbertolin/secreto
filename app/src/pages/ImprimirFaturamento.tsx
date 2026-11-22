import { useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { CLINICA } from "../lib/marca";
import { FORMAS_PAGAMENTO, TIPO_GUIA, fmtCPF, fmtCompetencia, fmtData, fmtMoeda } from "../lib/util";

interface Prof { nome: string; conselho: string | null; numero_conselho: string | null; uf_conselho: string | null; cbo: string | null }
const SEL_PROF = "nome, conselho, numero_conselho, uf_conselho, cbo";

/** Guia (consulta / SP-SADT), recibo particular e relação de guias do lote */
export default function ImprimirFaturamento() {
  const { tipo, id } = useParams();
  const { dados, erro, carregando } = useCarregar(async () => {
    if (tipo === "lote") {
      const l = ok(await supabase.from("lotes").select("*, convenios(nome, registro_ans, codigo_prestador)").eq("id", id!).single()) as Record<string, unknown>;
      const cs = ok(await supabase.from("contas").select("numero_guia_prestador, numero_guia_operadora, data_atendimento, carteirinha, senha_autorizacao, tipo_guia, valor_total, pacientes(nome)").eq("lote_id", id!).order("data_atendimento")) as unknown as Record<string, unknown>[];
      return { l, cs };
    }
    const c = ok(await supabase.from("contas").select("*, pacientes(nome, nome_social, numero_prontuario, cpf, cns), convenios(nome, registro_ans, codigo_prestador), convenio_planos(nome)").eq("id", id!).single()) as Record<string, unknown>;
    const itens = ok(await supabase.from("conta_itens").select("*").eq("conta_id", id!).order("data_execucao")) as Record<string, unknown>[];
    const ids = [c.profissional_id, c.solicitante_id].filter(Boolean) as string[];
    const profs = ids.length ? (ok(await supabase.from("profissionais").select(`id, ${SEL_PROF}`).in("id", ids)) as (Prof & { id: string })[]) : [];
    return { c, itens, exec: profs.find((p) => p.id === c.profissional_id), solic: profs.find((p) => p.id === c.solicitante_id) };
  }, [tipo, id]);

  useEffect(() => { if (dados) setTimeout(() => window.print(), 400); }, [dados]);
  if (carregando) return <Carregando />;
  if (!dados) return <Aviso>{erro}</Aviso>;

  const timbre = (
    <div className="timbre">
      <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ height: 46 }} />
      <div style={{ textAlign: "right", fontSize: 12, color: "#444", maxWidth: 360 }}>
        {CLINICA.endereco}<br />{[CLINICA.telefone, CLINICA.cnpj && `CNPJ ${CLINICA.cnpj}`].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
  const F = ({ n, r, v, span }: { n?: string; r: string; v: ReactNode; span?: number }) => (
    <td colSpan={span} style={{ textAlign: "left", verticalAlign: "top" }}>
      <div style={{ fontSize: 10, color: "#555" }}>{n && `${n} - `}{r}</div>
      <div style={{ fontSize: 13, minHeight: 16 }}>{v || " "}</div>
    </td>
  );
  let conteudo: ReactNode;

  if (tipo === "lote") {
    const { l, cs } = dados as { l: Record<string, unknown>; cs: Record<string, unknown>[] };
    const conv = l.convenios as { nome: string; registro_ans: string | null; codigo_prestador: string | null };
    const total = cs.reduce((s, c) => s + Number(c.valor_total), 0);
    conteudo = (
      <>
        <h1>RELAÇÃO DE GUIAS — LOTE {String(l.numero)}</h1>
        <p>Convênio: <b>{conv.nome}</b>{conv.registro_ans && ` · Registro ANS ${conv.registro_ans}`}{conv.codigo_prestador && ` · Código do prestador ${conv.codigo_prestador}`}<br />
          Competência: {fmtCompetencia(l.competencia as string)}{l.protocolo ? ` · Protocolo ${String(l.protocolo)}` : ""}</p>
        <table>
          <thead><tr><th>Guia prestador</th><th>Guia operadora</th><th>Data</th><th>Beneficiário</th><th>Carteirinha</th><th>Senha</th><th>Tipo</th><th>Valor</th></tr></thead>
          <tbody>
            {cs.map((c) => (
              <tr key={c.numero_guia_prestador as string}>
                <td>{c.numero_guia_prestador as string}</td><td>{(c.numero_guia_operadora as string) ?? ""}</td><td>{fmtData(c.data_atendimento as string)}</td>
                <td style={{ textAlign: "left" }}>{(c.pacientes as { nome: string }).nome}</td><td>{(c.carteirinha as string) ?? ""}</td><td>{(c.senha_autorizacao as string) ?? ""}</td>
                <td>{TIPO_GUIA[c.tipo_guia as string]}</td><td style={{ textAlign: "right" }}>{fmtMoeda(c.valor_total as number)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th colSpan={7} style={{ textAlign: "right" }}>{cs.length} guia(s) · Total</th><th style={{ textAlign: "right" }}>{fmtMoeda(total)}</th></tr></tfoot>
        </table>
      </>
    );
  } else {
    const { c, itens, exec, solic } = dados as { c: Record<string, unknown>; itens: Record<string, unknown>[]; exec?: Prof; solic?: Prof };
    const pac = c.pacientes as { nome: string; nome_social: string | null; numero_prontuario: number; cpf: string | null; cns: string | null };
    const conv = c.convenios as { nome: string; registro_ans: string | null; codigo_prestador: string | null } | null;
    const reg = (p?: Prof) => p ? `${p.conselho ?? "CRM"} ${p.numero_conselho ?? ""}${p.uf_conselho ? "/" + p.uf_conselho : ""}${p.cbo ? ` · CBO ${p.cbo}` : ""}` : "";

    if (tipo === "recibo") {
      conteudo = (
        <>
          <h1>RECIBO</h1>
          <p style={{ fontSize: 15, lineHeight: 1.8, textAlign: "justify" }}>
            Recebemos de <b>{pac.nome}</b>{pac.cpf && <>, CPF {fmtCPF(pac.cpf)}</>}, a importância de <b>{fmtMoeda(c.valor_pago as number)}</b>,
            referente aos serviços abaixo, realizados em {fmtData(c.data_atendimento as string)}
            {exec && <> pelo(a) profissional {exec.nome} ({reg(exec)})</>}.
            Forma de pagamento: {FORMAS_PAGAMENTO[c.forma_pagamento as string] ?? "—"}{Number(c.parcelas) > 1 ? ` em ${c.parcelas}x` : ""}.
          </p>
          <table>
            <thead><tr><th>Serviço</th><th>Qtd.</th><th>Valor</th></tr></thead>
            <tbody>{itens.map((i) => <tr key={i.id as string}><td style={{ textAlign: "left" }}>{i.descricao as string}</td><td>{Number(i.quantidade)}</td><td style={{ textAlign: "right" }}>{fmtMoeda(i.valor_total as number)}</td></tr>)}</tbody>
          </table>
          <div className="assinatura"><p>{CLINICA.cidade}, {fmtData(c.recebido_em as string)}</p><div className="traco" /><b>{CLINICA.nome} · {CLINICA.subtitulo}</b></div>
        </>
      );
    } else {
      const sadt = c.tipo_guia === "sadt";
      conteudo = (
        <>
          <h1 style={{ margin: "8px 0 12px" }}>{sadt ? "GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO AUXILIAR DE DIAGNÓSTICO E TERAPIA – SP/SADT" : "GUIA DE CONSULTA"}</h1>
          <table>
            <tbody>
              <tr><F n="1" r="Registro ANS" v={conv?.registro_ans} /><F n="2" r="Nº guia no prestador" v={c.numero_guia_prestador as string} /><F r="Nº guia na operadora" v={c.numero_guia_operadora as string} span={2} /></tr>
              <tr><F r="Operadora" v={conv?.nome} span={2} /><F r="Plano" v={(c.convenio_planos as { nome: string } | null)?.nome} /><F r="Senha" v={c.senha_autorizacao as string} /></tr>
              {sadt && <tr><F r="Data da autorização" v={fmtData(c.data_autorizacao as string)} span={2} /><F r="Validade da senha" v={fmtData(c.validade_senha as string)} span={2} /></tr>}
              <tr><th colSpan={4} style={{ textAlign: "left", background: "#eee" }}>Dados do beneficiário</th></tr>
              <tr><F r="Número da carteira" v={c.carteirinha as string} /><F r="Validade da carteira" v={fmtData(c.validade_carteirinha as string)} /><F r="Cartão Nacional de Saúde" v={pac.cns} span={2} /></tr>
              <tr><F r="Nome" v={pac.nome} span={4} /></tr>
              {sadt && (
                <>
                  <tr><th colSpan={4} style={{ textAlign: "left", background: "#eee" }}>Dados do solicitante</th></tr>
                  <tr><F r="Profissional solicitante" v={solic?.nome} span={2} /><F r="Conselho / CBO" v={reg(solic)} span={2} /></tr>
                  <tr><F r="Indicação clínica" v={c.indicacao_clinica as string} span={3} /><F r="CID-10" v={c.cid10 as string} /></tr>
                </>
              )}
              <tr><th colSpan={4} style={{ textAlign: "left", background: "#eee" }}>Dados do contratado executante</th></tr>
              <tr><F r="Código na operadora" v={conv?.codigo_prestador} /><F r="Nome do contratado" v={`${CLINICA.nome} · ${CLINICA.subtitulo}`} span={2} /><F r="CNPJ" v={CLINICA.cnpj} /></tr>
              <tr><F r="Profissional executante" v={exec?.nome} span={2} /><F r="Conselho / CBO" v={reg(exec)} span={2} /></tr>
            </tbody>
          </table>
          <table>
            <thead><tr><th>Data</th><th>Tabela</th><th>Código</th><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Valor total</th></tr></thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id as string}>
                  <td>{fmtData(i.data_execucao as string)}</td><td>{i.tabela as string}</td><td>{(i.codigo as string) ?? ""}</td>
                  <td style={{ textAlign: "left" }}>{i.descricao as string}{i.olho ? ` (${i.olho})` : ""}</td><td>{Number(i.quantidade)}</td>
                  <td style={{ textAlign: "right" }}>{fmtMoeda(i.valor_unitario as number)}</td><td style={{ textAlign: "right" }}>{fmtMoeda(i.valor_total as number)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={6} style={{ textAlign: "right" }}>Total geral</th><th style={{ textAlign: "right" }}>{fmtMoeda(c.valor_total as number)}</th></tr></tfoot>
          </table>
          {Boolean(c.observacoes) && <p>Observação: {c.observacoes as string}</p>}
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 60, textAlign: "center", fontSize: 12 }}>
            <div><div className="traco" style={{ borderTop: "1px solid #000", width: 240, marginBottom: 4 }} />Assinatura do profissional executante</div>
            <div><div className="traco" style={{ borderTop: "1px solid #000", width: 240, marginBottom: 4 }} />Assinatura do beneficiário ou responsável</div>
          </div>
          <p className="muted pequeno" style={{ marginTop: 24 }}>Espelho da guia para conferência e assinatura. Data do atendimento: {fmtData(c.data_atendimento as string)} · Prontuário {pac.numero_prontuario}.</p>
        </>
      );
    }
  }

  return (
    <div style={{ background: "#e9edf1", minHeight: "100vh", padding: "20px 0" }}>
      <div className="barra-impressao"><button className="primario" onClick={() => window.print()}>🖨️ Imprimir</button><button onClick={() => window.close()}>Fechar</button></div>
      <div className="folha">{timbre}{conteudo}</div>
    </div>
  );
}
