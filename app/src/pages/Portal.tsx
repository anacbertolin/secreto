// Portal do paciente (sem login): abre com o link enviado pela clínica + data de nascimento (migração 0028)
import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CLINICA } from "../lib/marca";
import { fmtData, fmtGrau, fmtHora } from "../lib/util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const OLHO: Record<string, string> = { OD: "olho direito", OE: "olho esquerdo", AO: "os dois olhos" };
const DOC: Record<string, string> = { atestado: "Atestado", declaracao_comparecimento: "Declaração de comparecimento", laudo: "Laudo", relatorio: "Relatório", encaminhamento: "Encaminhamento" };

function Imprimivel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={"portal-doc" + (aberto ? " aberto" : "")}>
      <div className="linha entre">
        <button className="sutil portal-doc-tit" onClick={() => setAberto(!aberto)}>{aberto ? "▾" : "▸"} {titulo}</button>
        {aberto && <button className="mini nao-imprimir" onClick={() => window.print()}>🖨️ Imprimir</button>}
      </div>
      {aberto && <div className="portal-doc-corpo">{children}</div>}
    </div>
  );
}

export default function Portal() {
  const { token } = useParams();
  const [nasc, setNasc] = useState("");
  const [dados, setDados] = useState<J>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const m = nasc.match(/^(\d{2})\/?(\d{2})\/?(\d{4})$/);
    if (!m) return setErro("Digite a data de nascimento assim: 02/03/1950");
    setCarregando(true); setErro("");
    const { data, error } = await supabase.rpc("portal_abrir", { p_token: token, p_nascimento: `${m[3]}-${m[2]}-${m[1]}` });
    setCarregando(false);
    if (error) return setErro("Não foi possível abrir agora. Tente de novo.");
    if (data?.erro) return setErro(data.erro + (data.restam != null ? ` Restam ${data.restam} tentativa(s).` : ""));
    setDados(data);
  }

  if (!dados) {
    return (
      <div className="tela-login">
        <form className="caixa-login" onSubmit={entrar} style={{ fontSize: 18 }}>
          <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ height: 40, marginBottom: 12 }} />
          <h2 style={{ marginTop: 0 }}>Seus documentos</h2>
          <p>Para sua segurança, digite a sua <b>data de nascimento</b>:</p>
          <input autoFocus inputMode="numeric" placeholder="dd/mm/aaaa" value={nasc} style={{ fontSize: 22, textAlign: "center" }}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 8); setNasc(d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} />
          {erro && <div className="aviso erro" style={{ marginTop: 12 }}>{erro}</div>}
          <button className="primario" type="submit" disabled={carregando} style={{ width: "100%", marginTop: 14, fontSize: 18, padding: 12 }}>{carregando ? "Abrindo…" : "Ver meus documentos"}</button>
          <p className="muted pequeno" style={{ marginTop: 16 }}>Dúvidas? {CLINICA.telefone}</p>
        </form>
      </div>
    );
  }

  const d = dados;
  const nada = !d.consultas.length && !d.oculos.length && !d.receitas.length && !d.documentos.length && !d.pedidos.length && !d.laudos.length;
  return (
    <div className="portal">
      <div className="portal-topo nao-imprimir">
        <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ height: 36 }} />
        <div className="muted pequeno">Link válido até {fmtData(d.expira_em)}</div>
      </div>
      <h1 className="nao-imprimir">Olá, {d.paciente}!</h1>
      {nada && <p>Não há documentos dos últimos 6 meses nem consultas marcadas.</p>}
      {d.consultas.length > 0 && (
        <section className="nao-imprimir"><h2>📅 Próximas consultas</h2>
          {d.consultas.map((c: J, i: number) => <div key={i} className="portal-consulta"><b>{fmtData(c.inicio)} às {fmtHora(c.inicio)}</b> · {c.medico}</div>)}
          <p className="muted pequeno">{CLINICA.endereco}</p>
        </section>
      )}
      {d.oculos.length > 0 && <section><h2 className="nao-imprimir">👓 Receitas de óculos</h2>
        {d.oculos.map((o: J) => (
          <Imprimivel key={o.id} titulo={`Óculos · ${fmtData(o.data)} · ${o.medico}`}>
            <table className="portal-tabela"><thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>DNP</th></tr></thead><tbody>
              <tr><th>OD</th><td>{fmtGrau(o.od.esf)}</td><td>{fmtGrau(o.od.cil)}</td><td>{o.od.eixo != null ? `${o.od.eixo}°` : ""}</td><td>{o.dnp_od ?? ""}</td></tr>
              <tr><th>OE</th><td>{fmtGrau(o.oe.esf)}</td><td>{fmtGrau(o.oe.cil)}</td><td>{o.oe.eixo != null ? `${o.oe.eixo}°` : ""}</td><td>{o.dnp_oe ?? ""}</td></tr>
            </tbody></table>
            {o.adicao != null && <p>Adição para perto: {fmtGrau(o.adicao)}</p>}
            {o.tipo_lente && <p>Lente: {o.tipo_lente}</p>}
            <p className="pequeno">{o.medico} · {o.crm}{o.validade && ` · válida até ${fmtData(o.validade)}`}{o.codigo && ` · código ${o.codigo} (confira em ${window.location.host}/verificar)`}</p>
          </Imprimivel>
        ))}</section>}
      {d.receitas.length > 0 && <section><h2 className="nao-imprimir">💊 Receitas</h2>
        {d.receitas.map((r: J) => (
          <Imprimivel key={r.id} titulo={`Receita · ${fmtData(r.data)} · ${r.medico}`}>
            <ol className="portal-lista">{r.itens.map((i: J, n: number) => <li key={n}><b>{i.medicamento}</b>{i.apresentacao && ` (${i.apresentacao})`}<br />{i.posologia}{i.olho && ` no ${OLHO[i.olho] ?? i.olho}`}{i.duracao && `, por ${i.duracao}`}.</li>)}</ol>
            <p className="pequeno">{r.medico} · {r.crm}{r.codigo && ` · código ${r.codigo} (confira em ${window.location.host}/verificar)`}</p>
          </Imprimivel>
        ))}</section>}
      {d.documentos.length > 0 && <section><h2 className="nao-imprimir">📄 Atestados e declarações</h2>
        {d.documentos.map((x: J) => (
          <Imprimivel key={x.id} titulo={`${DOC[x.tipo] ?? x.tipo} · ${fmtData(x.data)}`}>
            <p style={{ whiteSpace: "pre-wrap" }}>{x.conteudo}</p>
            <p className="pequeno">{x.medico} · {x.crm}{x.codigo && ` · código ${x.codigo} (confira em ${window.location.host}/verificar)`}</p>
          </Imprimivel>
        ))}</section>}
      {d.pedidos.length > 0 && <section><h2 className="nao-imprimir">🔬 Exames pedidos</h2>
        {d.pedidos.map((p: J, i: number) => (
          <Imprimivel key={i} titulo={`Pedido de exames · ${fmtData(p.data)} · ${p.medico}`}><ul className="portal-lista">{p.exames.map((e: string) => <li key={e}>{e}</li>)}</ul></Imprimivel>
        ))}</section>}
      {d.laudos.length > 0 && <section><h2 className="nao-imprimir">📋 Resultados de exames</h2>
        {d.laudos.map((l: J, i: number) => (
          <Imprimivel key={i} titulo={`${l.exame}${l.olho ? ` ${l.olho}` : ""} · ${fmtData(l.data)}`}>
            <p style={{ whiteSpace: "pre-wrap" }}>{l.laudo}</p>{l.conclusao && <p><b>Conclusão:</b> {l.conclusao}</p>}<p className="pequeno">{l.medico}</p>
          </Imprimivel>
        ))}</section>}
      <p className="muted pequeno nao-imprimir" style={{ marginTop: 24 }}>Receitas de remédio controlado e antibiótico são entregues em papel na clínica. Dúvidas? {CLINICA.telefone}</p>
    </div>
  );
}
