// Cirurgias do dia (migração 0158, decisões do Dr. Gelson, 25/11/2026).
// Mapa de cada dia com TODAS as cirurgias vendidas (na clínica ou "fora da clínica"). Alessandra, Luciano/administração
// ou os sócios (Dr. Gelson, Dr. Max) dão o check "Realizada" — no mesmo dia ou no seguinte. Sem check ninguém recebe e
// não se emite nota. Quem pode ver valores (faturamento/administração e sócios) vê quanto cada um recebe.
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Etiqueta } from "../components/ui";
import { fmtData, fmtDataHora, fmtMoeda, isoDia, somaDias } from "../lib/util";
import { FORMAS_REPASSE } from "../lib/repasse";
import { MarcarDataCirurgia } from "./VendasOrientacao";
import { GuiaVendas, LeiturasGuia } from "../components/GuiaVendas";

interface Linha {
  venda_id: string | null; repasse_id: string | null; venda_numero: number | null; repasse_numero: number | null;
  data_cirurgia: string | null; fora_clinica: boolean; paciente: string | null; prontuario: number | null; medico: string;
  procedimento: string; tipo: string; forma_pagamento: string; parcelas: number; valor_total: number;
  situacao_venda: string | null; realizada_em: string | null; realizada_por: string | null;
}
interface Valor { pessoa: string; papel: "medico" | "terceiro"; paga_no_dia: number; vai_dia_25: number }

const num = { textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };
const deData = (iso: string) => new Date(`${iso}T12:00:00`);

export default function CirurgiasDia() {
  const [params, setParams] = useSearchParams();
  const dia = params.get("dia") ?? isoDia(new Date());
  const irPara = (d: string) => setParams({ dia: d });
  const acesso = useCarregar(async () => ok(await supabase.rpc("cirurgias_acesso")) as { lista: boolean; valores: boolean; datas: boolean }, []);
  const lista = useCarregar(async () => ok(await supabase.rpc("cirurgias_lista", { p_data: dia, p_pendentes: false })) as Linha[], [dia]);
  const valores = useCarregar(async () => ok(await supabase.rpc("cirurgias_valores", { p_data: dia })) as Valor[], [dia]);
  const pend = useCarregar(async () => ok(await supabase.rpc("cirurgias_lista", { p_data: null, p_pendentes: true })) as Linha[], []);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  if (acesso.carregando && !acesso.dados) return <Carregando />;
  if (acesso.dados && !acesso.dados.lista) return <div className="painel vazio">Você não tem acesso a esta área.</div>;

  async function marcar(l: Linha, realizada: boolean) {
    setErro("");
    const { error } = await supabase.rpc("cirurgia_realizada", { p_venda: l.venda_id, p_repasse: l.venda_id ? null : l.repasse_id, p_realizada: realizada });
    if (error) return setErro(msgErro(error));
    lista.recarregar(); valores.recarregar(); pend.recarregar();
  }

  const ls = lista.dados ?? [];
  const vs = valores.dados ?? [];
  const realizadas = ls.filter((l) => l.realizada_em);
  const semRepasse = realizadas.filter((l) => l.venda_id && l.situacao_venda !== "lancada");
  const totalDia = vs.reduce((s, v) => s + Number(v.paga_no_dia), 0);
  const total25 = vs.reduce((s, v) => s + Number(v.vai_dia_25), 0);
  const primeiro = (n: string) => n.split(" ").slice(0, 2).join(" ");

  function textoWhats() {
    const linhas = [`*Cirurgias de ${fmtData(dia)}* — ${realizadas.length} realizada(s)`, ""];
    for (const l of realizadas) linhas.push(`• ${l.paciente ?? "—"} — ${l.procedimento} (${primeiro(l.medico)})${l.fora_clinica ? " · fora da clínica" : ""}`);
    if (vs.length) {
      linhas.push("", "*A pagar (PIX, dinheiro, débito e terceiros):*");
      for (const v of vs.filter((x) => Number(x.paga_no_dia) > 0)) linhas.push(`• ${primeiro(v.pessoa)}: ${fmtMoeda(v.paga_no_dia)}`);
      if (total25 > 0) {
        linhas.push("", "*Cartão de crédito (entra nos fechamentos do dia 25):*");
        for (const v of vs.filter((x) => Number(x.vai_dia_25) > 0)) linhas.push(`• ${primeiro(v.pessoa)}: ${fmtMoeda(v.vai_dia_25)}`);
      }
    }
    return linhas.join("\n");
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(textoWhats()); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { setErro("Não consegui copiar: use o botão do WhatsApp."); }
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Cirurgias do dia</h1>
          <p className="sub" style={{ margin: 0 }}>Todas as cirurgias vendidas (na clínica e fora). Dê o ✔ quando forem realizadas: só depois disso os médicos recebem e a nota pode ser emitida.</p>
        </div>
        <div className="linha nao-imprimir">
          <GuiaVendas />
          <button onClick={() => irPara(isoDia(somaDias(deData(dia), -1)))}>←</button>
          <input type="date" value={dia} onChange={(e) => e.target.value && irPara(e.target.value)} style={{ width: 160 }} />
          <button onClick={() => irPara(isoDia(somaDias(deData(dia), 1)))}>→</button>
          <button onClick={() => irPara(isoDia(new Date()))}>Hoje</button>
          <button onClick={() => irPara(isoDia(somaDias(new Date(), -1)))}>Ontem</button>
        </div>
      </div>
      <Aviso>{erro || lista.erro || valores.erro || pend.erro}</Aviso>

      <div className="painel rolagem">
        <h2>{fmtData(dia)} — {ls.length} cirurgia(s) · {realizadas.length} realizada(s)</h2>
        {lista.carregando && !lista.dados ? <Carregando /> : ls.length === 0 ? <div className="vazio">Nenhuma cirurgia marcada para este dia.</div> : (
          <table className="tabela">
            <thead><tr><th>Paciente</th><th>Médico</th><th>Procedimento</th><th>Pagamento</th><th style={num}>Valor</th><th>Situação</th><th className="nao-imprimir"></th></tr></thead>
            <tbody>
              {ls.map((l) => (
                <tr key={l.venda_id ?? l.repasse_id}>
                  <td><b>{l.paciente ?? "—"}</b>{l.prontuario ? <div className="muted pequeno">Pront. {l.prontuario}</div> : null}</td>
                  <td>{l.medico}</td>
                  <td>{l.procedimento}{l.fora_clinica && <> <Etiqueta cor="roxo">fora da clínica</Etiqueta></>}
                    <div className="muted pequeno">{l.venda_numero ? `venda nº ${l.venda_numero}` : ""}{l.repasse_numero ? `${l.venda_numero ? " · " : ""}repasse nº ${l.repasse_numero}` : ""}</div></td>
                  <td>{FORMAS_REPASSE[l.forma_pagamento] ?? l.forma_pagamento}{l.forma_pagamento === "credito" && l.parcelas > 1 ? ` ${l.parcelas}x` : ""}</td>
                  <td style={num}>{fmtMoeda(l.valor_total)}</td>
                  <td>{l.realizada_em
                    ? <><Etiqueta cor="verde">✔ realizada</Etiqueta><div className="muted pequeno">{l.realizada_por?.split(" ")[0]} · {fmtDataHora(l.realizada_em)}</div></>
                    : <Etiqueta cor="amarelo">aguardando</Etiqueta>}
                    {l.venda_id && l.situacao_venda !== "lancada" && <div className="pequeno" style={{ color: "#b26a00" }}>Luciano ainda não lançou o repasse</div>}</td>
                  <td className="nao-imprimir" style={{ whiteSpace: "nowrap" }}>
                    {l.realizada_em
                      ? <button className="sutil pequeno" onClick={() => confirm("Desfazer o check de realizada?") && marcar(l, false)}>desfazer</button>
                      : <button className="primario pequeno" disabled={dia > isoDia(new Date())} title={dia > isoDia(new Date()) ? "Só a partir do dia da cirurgia" : ""} onClick={() => marcar(l, true)}>✔ Realizada</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {acesso.dados?.valores && (
        <div className="painel rolagem">
          <div className="linha"><h2 style={{ margin: 0 }}>Quanto cada um recebe (cirurgias realizadas)</h2><span style={{ marginLeft: "auto" }} />
            <span className="nao-imprimir linha">
              <button disabled={!realizadas.length} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(textoWhats())}`, "_blank")}>📲 WhatsApp</button>
              <button disabled={!realizadas.length} onClick={copiar}>{copiado ? "✔ Copiado" : "📋 Copiar"}</button>
              <button onClick={() => window.print()}>🖨️ Imprimir</button>
            </span></div>
          {semRepasse.length > 0 && <Aviso tipo="alerta">{semRepasse.length} cirurgia(s) realizada(s) ainda sem repasse lançado: os valores delas só aparecem depois que o Luciano conferir e lançar (<Link to="/repasse?aba=conferir">Para conferir</Link>).</Aviso>}
          {vs.length === 0 ? <div className="vazio">Nenhuma cirurgia realizada (com repasse lançado) neste dia.</div> : (
            <table className="tabela">
              <thead><tr><th>Quem</th><th style={num}>Paga no dia<div className="muted pequeno">PIX, dinheiro, débito e terceiros</div></th><th style={num}>Vai para o dia 25<div className="muted pequeno">cartão de crédito (todas as parcelas)</div></th></tr></thead>
              <tbody>
                {vs.map((v) => (
                  <tr key={`${v.papel}-${v.pessoa}`}><td><b>{v.pessoa}</b>{v.papel === "terceiro" && <span className="muted pequeno"> · anestesista/instrumentação/auxiliar</span>}</td>
                    <td style={num}>{Number(v.paga_no_dia) ? <b>{fmtMoeda(v.paga_no_dia)}</b> : <span className="muted">—</span>}</td>
                    <td style={num}>{Number(v.vai_dia_25) ? fmtMoeda(v.vai_dia_25) : <span className="muted">—</span>}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><th>Total</th><th style={num}>{fmtMoeda(totalDia)}</th><th style={num}>{fmtMoeda(total25)}</th></tr></tfoot>
            </table>
          )}
          <p className="muted pequeno">Dr. Gelson e Dr. Max: a parte do médico já aparece dividida 50% para cada. O cartão de crédito segue o fechamento do dia 20 / pagamento no dia 25 (veja a Previsão no Repasse médico).</p>
        </div>
      )}

      <div className="painel rolagem nao-imprimir">
        <h2>Faltam data ou check</h2>
        {pend.carregando && !pend.dados ? <Carregando /> : (pend.dados ?? []).length === 0 ? <div className="vazio">Nada pendente. 👍</div> : (
          <table className="tabela">
            <thead><tr><th>Cirurgia</th><th>Paciente</th><th>Médico / procedimento</th><th style={num}>Valor</th><th></th></tr></thead>
            <tbody>
              {(pend.dados ?? []).map((l) => (
                <tr key={l.venda_id ?? l.repasse_id}>
                  <td>{l.data_cirurgia ? <><Link to={`/cirurgias-do-dia?dia=${l.data_cirurgia}`} onClick={() => irPara(l.data_cirurgia!)}>{fmtData(l.data_cirurgia)}</Link><div className="pequeno" style={{ color: "#c62828" }}>sem check</div></> : <Etiqueta cor="vermelho">sem data</Etiqueta>}</td>
                  <td>{l.paciente ?? "—"}</td>
                  <td>{l.medico}<div className="muted pequeno">{l.procedimento}{l.venda_numero ? ` · venda nº ${l.venda_numero}` : ""}</div></td>
                  <td style={num}>{fmtMoeda(l.valor_total)}</td>
                  <td>{!l.data_cirurgia && acesso.dados?.datas && (
                    <MarcarDataCirurgia vendaId={l.venda_id} repasseId={l.venda_id ? null : l.repasse_id} data={l.data_cirurgia} fora={l.fora_clinica}
                      aoSalvar={() => { pend.recarregar(); lista.recarregar(); }} />)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <LeiturasGuia />
    </div>
  );
}
