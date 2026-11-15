// Página pública (sem login): confere se um documento impresso pela clínica é verdadeiro (migração 0025)
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CLINICA } from "../lib/marca";
import { fmtData, fmtGrau } from "../lib/util";

interface Resultado {
  tipo: string; emitido_em: string; cancelado: boolean; motivo_cancelamento: string | null;
  paciente: string; data: string; medico: string; crm: string; conteudo: Record<string, unknown>;
}
const TIPOS: Record<string, string> = { oculos: "Receita de óculos", receita: "Receita de medicamentos", documento: "Documento médico", laudo: "Laudo de exame", pedidos: "Pedido de exames" };
const DOCS: Record<string, string> = { atestado: "Atestado", declaracao_comparecimento: "Declaração de comparecimento", laudo: "Laudo", relatorio: "Relatório", encaminhamento: "Encaminhamento", termo_consentimento: "Termo de consentimento" };

export default function Verificar() {
  const { codigo } = useParams();
  const nav = useNavigate();
  const [texto, setTexto] = useState(codigo ?? "");
  const [res, setRes] = useState<Resultado | null | undefined>(undefined);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!codigo) { setRes(undefined); return; }
    setCarregando(true);
    supabase.rpc("verificar_documento", { p_codigo: codigo }).then(({ data, error }) => {
      setRes(error ? null : (data as Resultado | null));
      setCarregando(false);
    });
  }, [codigo]);

  const c = res?.conteudo ?? {};
  const olho = (o: { esf?: number; cil?: number; eixo?: number } | undefined) => o ? `${fmtGrau(o.esf) || "—"} ${o.cil ? `${fmtGrau(o.cil)} × ${o.eixo ?? "?"}°` : ""}` : "—";
  return (
    <div className="tela-login">
      <div className="caixa-login" style={{ maxWidth: 520 }}>
        <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ height: 40, marginBottom: 12 }} />
        <h2 style={{ marginTop: 0 }}>Conferir documento</h2>
        <form className="linha" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) nav(`/verificar/${texto.trim().toUpperCase()}`); }}>
          <input style={{ flex: 1, textTransform: "uppercase" }} placeholder="Código impresso no documento" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button className="primario" type="submit">Conferir</button>
        </form>
        {carregando && <p className="muted">Conferindo…</p>}
        {codigo && !carregando && res === null && (
          <div className="aviso erro" style={{ marginTop: 14 }}>❌ <b>Código não encontrado.</b> Confira se digitou certo. Se o código estiver correto, este documento <b>não foi emitido</b> pela clínica.</div>
        )}
        {res && (
          <div style={{ marginTop: 14 }}>
            {res.cancelado
              ? <div className="aviso erro">⚠️ <b>Documento cancelado</b> pela clínica.{res.motivo_cancelamento && ` Motivo: ${res.motivo_cancelamento}`}</div>
              : <div className="aviso ok">✅ <b>Documento autêntico</b>, emitido pela {CLINICA.nome}.</div>}
            <dl className="verif">
              <dt>Tipo</dt><dd>{TIPOS[res.tipo] ?? res.tipo}{res.tipo === "documento" && c.tipo_documento ? ` · ${DOCS[String(c.tipo_documento)] ?? c.tipo_documento}` : ""}</dd>
              <dt>Data</dt><dd>{fmtData(res.data)}</dd>
              <dt>Paciente</dt><dd>{res.paciente}</dd>
              <dt>Médico(a)</dt><dd>{res.medico} · {res.crm}</dd>
              {res.tipo === "oculos" && <>
                <dt>OD</dt><dd>{olho(c.od as never)}</dd>
                <dt>OE</dt><dd>{olho(c.oe as never)}</dd>
                {c.adicao != null && <><dt>Adição</dt><dd>{fmtGrau(c.adicao as number)}</dd></>}
                {!!c.validade && <><dt>Validade</dt><dd>{fmtData(String(c.validade))}</dd></>}
              </>}
              {res.tipo === "receita" && <><dt>Medicamentos</dt><dd>{((c.itens as { medicamento: string; quantidade: string | null }[]) ?? []).map((i, n) => <div key={n}>{i.medicamento}{i.quantidade && ` · ${i.quantidade}`}</div>)}</dd></>}
              {res.tipo === "documento" && c.dias_afastamento != null && <><dt>Afastamento</dt><dd>{String(c.dias_afastamento)} dia(s)</dd></>}
              {res.tipo === "laudo" && <><dt>Exame</dt><dd>{String(c.exame)}{c.olho ? ` · ${c.olho}` : ""}</dd></>}
              {res.tipo === "pedidos" && <><dt>Exames</dt><dd>{((c.exames as string[]) ?? []).join(", ")}</dd></>}
            </dl>
            <p className="muted pequeno">Por privacidade, o nome do paciente aparece abreviado e não mostramos diagnósticos. Compare estes dados com o papel.</p>
          </div>
        )}
        <p className="muted pequeno" style={{ marginTop: 18 }}>{CLINICA.nome} · {CLINICA.telefone}</p>
      </div>
    </div>
  );
}
