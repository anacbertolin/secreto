import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { TIPOS_AGENDA, fmtData, fmtTelefone, isoDia } from "../lib/util";

type Linha = Record<string, string | number | null>;
interface Coluna { k: string; rotulo: string; num?: boolean; fmt?: (v: unknown, l: Linha) => ReactNode }

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1).replace(".", ",")}%` : "—");
const n = (v: unknown) => Number(v ?? 0);

/** Soma linhas agrupando por uma chave */
function agrupar(linhas: Linha[], chave: string, somar: string[]): Linha[] {
  const m = new Map<string, Linha>();
  for (const l of linhas) {
    const k = String(l[chave] ?? "—");
    const g = m.get(k) ?? { [chave]: k, ...Object.fromEntries(somar.map((s) => [s, 0])) };
    for (const s of somar) g[s] = n(g[s]) + n(l[s]);
    m.set(k, g);
  }
  return [...m.values()];
}

function Tabela({ titulo, colunas, linhas, total, nota }: { titulo: string; colunas: Coluna[]; linhas: Linha[]; total?: boolean; nota?: string }) {
  function csv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const txt = [colunas.map((c) => esc(c.rotulo)).join(";"), ...linhas.map((l) => colunas.map((c) => esc(c.num ? String(l[c.k] ?? "").replace(".", ",") : l[c.k])).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" }));
    a.download = `${titulo.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-")}.csv`;
    a.click();
  }
  const soma = (k: string) => linhas.reduce((s, l) => s + n(l[k]), 0);
  return (
    <div className="painel rolagem">
      <div className="linha entre"><h2 style={{ margin: 0 }}>{titulo}</h2>{linhas.length > 0 && <button className="mini nao-imprimir" onClick={csv}>⬇️ Planilha</button>}</div>
      {nota && <p className="muted pequeno" style={{ margin: "6px 0 0" }}>{nota}</p>}
      <table className="tabela" style={{ marginTop: 10 }}>
        <thead><tr>{colunas.map((c) => <th key={c.k} style={c.num ? { textAlign: "right" } : undefined}>{c.rotulo}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>{colunas.map((c) => <td key={c.k} style={c.num ? { textAlign: "right", fontVariantNumeric: "tabular-nums" } : undefined}>{c.fmt ? c.fmt(l[c.k], l) : (l[c.k] ?? "—")}</td>)}</tr>
          ))}
        </tbody>
        {total && linhas.length > 1 && (
          <tfoot><tr>{colunas.map((c, i) => <th key={c.k} style={c.num ? { textAlign: "right" } : undefined}>{i === 0 ? "Total" : c.num && !c.fmt ? soma(c.k) : ""}</th>)}</tr></tfoot>
        )}
      </table>
      {linhas.length === 0 && <div className="vazio">Sem dados no período.</div>}
    </div>
  );
}

async function rpc(nome: string, args: Record<string, unknown>) {
  return ok(await supabase.rpc(nome, args)) as Linha[];
}

export default function Relatorios() {
  const { pode } = useAuth();
  const clinico = pode("medico", "enfermagem");
  const fat = pode("faturamento", "admin");
  const hoje = new Date();
  const [de, setDe] = useState(isoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [ate, setAte] = useState(isoDia(hoje));
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") ?? "agenda";
  const p = { p_de: de, p_ate: ate };

  const abas: [string, string, boolean][] = [
    ["agenda", "Agenda", true], ["espera", "Tempo de espera", true], ["faltas", "Faltas", true], ["pacientes", "Pacientes novos", true],
    ["exames", "Exames", clinico], ["clinico", "Clínico", clinico],
  ];

  const dados = useCarregar(async () => {
    switch (aba) {
      case "agenda": return { agenda: await rpc("rel_agenda", p) };
      case "espera": return { espera: await rpc("rel_espera", p) };
      case "faltas": return { faltas: await rpc("rel_faltas_pacientes", { ...p, p_limite: 200 }) };
      case "pacientes": return { novos: await rpc("rel_pacientes_novos", p) };
      case "exames": return { exames: await rpc("rel_exames", p) };
      case "clinico": return { diag: await rpc("rel_diagnosticos", { ...p, p_limite: 50 }), prod: await rpc("rel_producao_medica", p) };
    }
    return {};
  }, [aba, de, ate]);

  const somaAgenda = ["total", "atendidos", "faltas", "cancelados", "primeira_vez", "encaixes"];
  const colsAgenda = (chave: string, rotulo: string, fmt?: (v: unknown) => ReactNode): Coluna[] => [
    { k: chave, rotulo, fmt },
    { k: "total", rotulo: "Agendados", num: true }, { k: "atendidos", rotulo: "Atendidos", num: true },
    { k: "faltas", rotulo: "Faltas", num: true }, { k: "taxa", rotulo: "% falta", num: true, fmt: (_, l) => pct(n(l.faltas), n(l.total) - n(l.cancelados)) },
    { k: "cancelados", rotulo: "Cancelados", num: true }, { k: "primeira_vez", rotulo: "1ª vez", num: true }, { k: "encaixes", rotulo: "Encaixes", num: true },
  ];
  const d = dados.dados as Record<string, Linha[]> | null;

  return (
    <div>
      <div className="cabecalho">
        <div><h1>Relatórios</h1><p className="sub" style={{ margin: 0 }}>Período de {fmtData(de)} a {fmtData(ate)}</p></div>
        <div className="linha nao-imprimir">
          <label className="linha pequeno muted">de <input type="date" style={{ width: 150 }} value={de} onChange={(e) => e.target.value && setDe(e.target.value)} /></label>
          <label className="linha pequeno muted">até <input type="date" style={{ width: 150 }} value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} /></label>
          <button onClick={() => window.print()}>🖨️ Imprimir</button>
        </div>
      </div>
      <div className="abas nao-imprimir">
        {abas.filter(([, , v]) => v).map(([k, r]) => <button key={k} className={aba === k ? "ativa" : ""} onClick={() => setParams({ aba: k })}>{r}</button>)}
        {fat && <Link className="botao sutil" to="/faturamento?aba=resumo" style={{ marginLeft: "auto" }}>Faturamento por convênio e médico →</Link>}
      </div>
      <Aviso>{dados.erro}</Aviso>
      {dados.carregando && !d ? <Carregando /> : d && (
        <>
          {aba === "agenda" && d.agenda && (
            <>
              <Tabela titulo="Agenda por médico" total colunas={colsAgenda("profissional", "Médico")} linhas={agrupar(d.agenda, "profissional", somaAgenda).sort((a, b) => n(b.total) - n(a.total))} />
              <Tabela titulo="Agenda por convênio" total colunas={colsAgenda("convenio", "Convênio")} linhas={agrupar(d.agenda, "convenio", somaAgenda).sort((a, b) => n(b.total) - n(a.total))} />
              <Tabela titulo="Agenda por tipo" total colunas={colsAgenda("tipo", "Tipo", (v) => TIPOS_AGENDA[String(v)] ?? String(v))} linhas={agrupar(d.agenda, "tipo", somaAgenda)} />
            </>
          )}
          {aba === "espera" && d.espera && (
            <Tabela titulo="Tempo de espera na recepção" nota="Espera = da chegada (recepção) até o médico chamar. Atraso = quanto o médico chamou depois do horário marcado. 90% dos pacientes esperaram até o valor da coluna “90% esperou até”."
              colunas={[
                { k: "profissional", rotulo: "Médico" }, { k: "medidos", rotulo: "Atendimentos medidos", num: true },
                { k: "espera_media_min", rotulo: "Espera média (min)", num: true }, { k: "espera_p90_min", rotulo: "90% esperou até (min)", num: true },
                { k: "atraso_medio_min", rotulo: "Atraso médio (min)", num: true },
              ]} linhas={d.espera} />
          )}
          {aba === "faltas" && d.faltas && (
            <Tabela titulo="Pacientes que mais faltaram" colunas={[
              { k: "nome", rotulo: "Paciente", fmt: (v, l) => <Link to={`/pacientes/${l.paciente_id}`}>{String(v)}</Link> },
              { k: "numero_prontuario", rotulo: "Pront.", num: true }, { k: "telefone", rotulo: "Telefone", fmt: (v) => fmtTelefone(v as string) || "—" },
              { k: "faltas", rotulo: "Faltas", num: true }, { k: "agendamentos", rotulo: "Agendamentos", num: true },
            ]} linhas={d.faltas} />
          )}
          {aba === "pacientes" && d.novos && (
            <>
              <Tabela titulo="Pacientes novos por convênio" total colunas={[{ k: "convenio", rotulo: "Convênio" }, { k: "total", rotulo: "Pacientes novos", num: true }]}
                linhas={agrupar(d.novos, "convenio", ["total"]).sort((a, b) => n(b.total) - n(a.total))} />
              <Tabela titulo="Pacientes novos por cidade" total colunas={[{ k: "cidade", rotulo: "Cidade" }, { k: "total", rotulo: "Pacientes novos", num: true }]}
                linhas={agrupar(d.novos, "cidade", ["total"]).sort((a, b) => n(b.total) - n(a.total))} />
            </>
          )}
          {aba === "exames" && d.exames && (
            <Tabela titulo="Exames" total nota="Laudo: tempo médio entre a realização do exame e a assinatura do laudo."
              colunas={[
                { k: "exame", rotulo: "Exame" }, { k: "realizados", rotulo: "Realizados", num: true }, { k: "laudados", rotulo: "Laudados", num: true },
                { k: "aguardando_laudo", rotulo: "Aguardando laudo", num: true }, { k: "cancelados", rotulo: "Cancelados", num: true },
                { k: "horas_ate_laudo", rotulo: "Horas até o laudo", num: true, fmt: (v) => (v === null ? "—" : String(v).replace(".", ",")) },
              ]} linhas={[...d.exames].sort((a, b) => n(b.realizados) - n(a.realizados))} />
          )}
          {aba === "clinico" && d.prod && (
            <>
              <Tabela titulo="Produção por médico" total nota="Atendimentos finalizados no período."
                colunas={[
                  { k: "profissional", rotulo: "Médico" }, { k: "atendimentos", rotulo: "Atendimentos", num: true }, { k: "pacientes", rotulo: "Pacientes", num: true },
                  { k: "receitas_oculos", rotulo: "Receitas de óculos", num: true }, { k: "receitas_medicamentos", rotulo: "Receitas de remédio", num: true },
                  { k: "pedidos_exame", rotulo: "Pedidos de exame", num: true }, { k: "documentos", rotulo: "Atestados/docs", num: true }, { k: "laudos", rotulo: "Laudos", num: true },
                ]} linhas={d.prod.filter((l) => n(l.atendimentos) + n(l.laudos) > 0)} />
              <Tabela titulo="Diagnósticos mais frequentes" colunas={[
                { k: "cid10", rotulo: "CID-10" }, { k: "descricao", rotulo: "Diagnóstico" },
                { k: "atendimentos", rotulo: "Atendimentos", num: true }, { k: "pacientes", rotulo: "Pacientes", num: true }, { k: "como_principal", rotulo: "Como principal", num: true },
              ]} linhas={d.diag ?? []} />
            </>
          )}
        </>
      )}
    </div>
  );
}
