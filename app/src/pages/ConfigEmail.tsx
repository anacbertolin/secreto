// Administração: e-mail da clínica (migração 0190) — conexão com o Google, caixas e quem acessa cada uma
import { useEffect, useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Campo, Modal, Etiqueta } from "../components/ui";
import { email, type CaixaEmail } from "../lib/email";

interface Situacao { credenciais: boolean; conectado: boolean; conta: string | null; ultima_sinc: string | null; ultimo_erro: string | null }
interface Pessoa { id: string; nome: string; funcao: string }
interface Acesso { caixa_id: string; profissional_id: string }

const FUNCOES: Record<string, string> = { recepcao: "Toda a recepção", faturamento: "Todo o faturamento", medico: "Todos os médicos", enfermagem: "Toda a enfermagem" };

export default function ConfigEmail() {
  const sit = useCarregar(async () => ok(await supabase.rpc("email_situacao")) as Situacao, []);
  const caixas = useCarregar(async () => ok(await supabase.from("email_caixas").select("*").order("ordem").order("nome")) as CaixaEmail[], []);
  const acessos = useCarregar(async () => ok(await supabase.from("email_caixa_acesso").select("caixa_id, profissional_id")) as Acesso[], []);
  const equipe = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome, funcao").eq("ativo", true).not("agenda_recurso", "is", true).not("sem_acesso", "is", true).order("nome")) as Pessoa[], []);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editar, setEditar] = useState<CaixaEmail | null>(null);

  if (!sit.dados) return sit.erro ? <Aviso>{sit.erro}</Aviso> : <Carregando />;
  const s = sit.dados;
  const nome = (id: string | null) => equipe.dados?.find((p) => p.id === id)?.nome ?? "";

  async function salvarCredenciais() {
    setErro(""); setMsg("");
    if (!clientId.trim() && !clientSecret.trim()) return setErro("Cole o Client ID e o Client Secret.");
    const { error } = await supabase.rpc("email_definir_credenciais", { p_client_id: clientId, p_client_secret: clientSecret });
    if (error) return setErro(msgErro(error));
    setClientId(""); setClientSecret(""); setMsg("Guardado ✓"); sit.recarregar();
  }
  async function conectar() {
    setErro(""); setOcupado(true);
    try { const { url } = await email<{ url: string }>("conectar"); window.location.href = url; }
    catch (e) { setErro((e as Error).message); setOcupado(false); }
  }
  async function desconectar() {
    if (!confirm("Desligar o e-mail do sistema? Os e-mails já guardados continuam aqui, mas não chegam novos até conectar de novo.")) return;
    try { await email("desconectar"); sit.recarregar(); } catch (e) { setErro((e as Error).message); }
  }
  async function buscar() {
    setErro(""); setMsg(""); setOcupado(true);
    try { const r = await email<{ novas: number }>("sincronizar"); setMsg(`Busca feita ✓ (${r.novas} e-mail(s) novo(s))`); sit.recarregar(); }
    catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>E-mail da clínica</h1>
          <p className="sub" style={{ margin: 0 }}>Ligação com o Google e quem vê cada caixa (@cmdolhos.com.br). A administração vê todas.</p>
        </div>
      </div>
      <Aviso>{erro || caixas.erro || acessos.erro}</Aviso>
      {msg && <Aviso tipo="ok">{msg}</Aviso>}

      <div className="painel">
        <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Situação: {s.conectado ? <>LIGADO <span className="muted pequeno">({s.conta})</span></> : "desligado"}</h2>
          <div className="linha" style={{ gap: 6 }}>
            {s.conectado && <button onClick={buscar} disabled={ocupado}>↻ Buscar agora</button>}
            {s.conectado
              ? <button onClick={desconectar}>Desligar</button>
              : <button className="primario" disabled={!s.credenciais || ocupado} onClick={conectar}>Conectar com o Google</button>}
          </div>
        </div>
        {s.ultima_sinc && <p className="muted pequeno">Última busca: {new Date(s.ultima_sinc).toLocaleString("pt-BR")} (busca sozinho a cada 2 minutos)</p>}
        {s.ultimo_erro && <Aviso tipo="alerta">Último erro: {s.ultimo_erro}</Aviso>}
        <div className="grade g2" style={{ marginTop: 10 }}>
          <Campo rotulo={s.credenciais ? "Client ID (já guardado — só preencha para trocar)" : "Client ID do Google"}>
            <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="….apps.googleusercontent.com" />
          </Campo>
          <Campo rotulo={s.credenciais ? "Client Secret (já guardado — só preencha para trocar)" : "Client Secret do Google"}>
            <input type="password" autoComplete="new-password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          </Campo>
        </div>
        <button style={{ marginTop: 8 }} onClick={salvarCredenciais}>Guardar</button>
        <p className="muted pequeno">O Client ID e o Client Secret ficam guardados no banco e nunca voltam para esta tela.</p>
      </div>

      <div className="painel">
        <h2 style={{ marginTop: 0 }}>Caixas e quem acessa</h2>
        {!caixas.dados || !acessos.dados || !equipe.dados ? <Carregando /> : (
          <table className="tabela">
            <thead><tr><th>Caixa</th><th>Quem vê e responde</th><th></th></tr></thead>
            <tbody>
              {caixas.dados.map((c) => {
                const quem = [
                  ...(c.profissional_id ? [nome(c.profissional_id)] : []),
                  ...c.funcoes.map((f) => FUNCOES[f] ?? f),
                  ...acessos.dados!.filter((a) => a.caixa_id === c.id).map((a) => nome(a.profissional_id)),
                ].filter(Boolean);
                return (
                  <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.5 }}>
                    <td><b>{c.nome}</b><div className="muted pequeno">{c.endereco}</div></td>
                    <td>{quem.length ? quem.join(", ") : <Etiqueta cor="amarelo">só a administração</Etiqueta>}</td>
                    <td><button className="mini" onClick={() => setEditar(c)}>Editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="painel">
        <h3 style={{ marginTop: 0 }}>Como ligar (uma vez só)</h3>
        <ol className="pequeno">
          <li>Entre em <b>console.cloud.google.com</b> com a conta <b>diretoria@cmdolhos.com.br</b> e crie um projeto chamado <b>Sistema da clínica</b>.</li>
          <li>Em <b>APIs e serviços → Biblioteca</b>, ative a <b>Gmail API</b>.</li>
          <li>Em <b>APIs e serviços → Tela de consentimento OAuth</b> (ou "Google Auth Platform"), escolha o tipo <b>Interno</b>, nome do app <b>Sistema da clínica</b>, e-mail de suporte diretoria@.</li>
          <li>Em <b>Credenciais → Criar credenciais → ID do cliente OAuth</b>: tipo <b>Aplicativo da Web</b>; em <b>URIs de redirecionamento autorizados</b> coloque exatamente:<br />
            <code>https://ogflxjolbwrzayjtxvhj.supabase.co/functions/v1/email</code></li>
          <li>Copie o <b>Client ID</b> e o <b>Client Secret</b>, cole acima e clique em <b>Guardar</b>.</li>
          <li>Clique em <b>Conectar com o Google</b> e entre com a conta <b>clinica@cmdolhos.com.br</b> (não a diretoria@). Aceite o acesso.</li>
          <li>Para os e-mails saírem com o endereço de cada caixa (e não como clinica@): no Gmail da clinica@ → ⚙️ <b>Ver todas as configurações → Contas → Enviar e-mail como → Adicionar outro endereço</b>, um para cada endereço da lista acima (pode deixar marcado “Tratar como alias”).</li>
        </ol>
      </div>

      {editar && equipe.dados && acessos.dados && (
        <EditarCaixa c={editar} equipe={equipe.dados} acessos={acessos.dados.filter((a) => a.caixa_id === editar.id).map((a) => a.profissional_id)}
          aoFechar={(mudou) => { setEditar(null); if (mudou) { caixas.recarregar(); acessos.recarregar(); } }} />
      )}
    </div>
  );
}

function EditarCaixa({ c, equipe, acessos, aoFechar }: { c: CaixaEmail; equipe: Pessoa[]; acessos: string[]; aoFechar: (mudou: boolean) => void }) {
  const [v, setV] = useState<CaixaEmail>(c);
  const [quem, setQuem] = useState<string[]>(acessos);
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setQuem(acessos), [acessos]);

  async function salvar() {
    setErro(""); setSalvando(true);
    const { error } = await supabase.from("email_caixas").update({
      nome: v.nome.trim(), descricao: (v.descricao ?? "").trim() || null, assinatura: (v.assinatura ?? "").trim() || null,
      funcoes: v.funcoes, profissional_id: v.profissional_id || null, ativo: v.ativo,
    }).eq("id", c.id);
    if (error) { setSalvando(false); return setErro(msgErro(error)); }
    const tirar = acessos.filter((id) => !quem.includes(id)), por = quem.filter((id) => !acessos.includes(id));
    if (tirar.length) {
      const { error: e } = await supabase.from("email_caixa_acesso").delete().eq("caixa_id", c.id).in("profissional_id", tirar);
      if (e) { setSalvando(false); return setErro(msgErro(e)); }
    }
    if (por.length) {
      const { error: e } = await supabase.from("email_caixa_acesso").insert(por.map((id) => ({ caixa_id: c.id, profissional_id: id })));
      if (e) { setSalvando(false); return setErro(msgErro(e)); }
    }
    aoFechar(true);
  }

  const lista = equipe.filter((p) => !filtro || p.nome.toLowerCase().includes(filtro.toLowerCase()));
  return (
    <Modal titulo={`Caixa ${c.endereco}`} largo aoFechar={() => aoFechar(false)}
      rodape={<>
        <button onClick={() => aoFechar(false)}>Cancelar</button>
        <button className="primario" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
      </>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Nome da caixa"><input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></Campo>
        <Campo rotulo="Para que serve"><input value={v.descricao ?? ""} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></Campo>
        {v.tipo === "medico" && (
          <Campo rotulo="Médico dono da caixa">
            <select value={v.profissional_id ?? ""} onChange={(e) => setV({ ...v, profissional_id: e.target.value || null })}>
              <option value="">—</option>
              {equipe.filter((p) => p.funcao === "medico").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
        )}
        <Campo rotulo="Situação">
          <select value={v.ativo ? "1" : "0"} onChange={(e) => setV({ ...v, ativo: e.target.value === "1" })}>
            <option value="1">Ativa</option><option value="0">Desativada</option>
          </select>
        </Campo>
      </div>
      <Campo rotulo="Assinatura (vai no fim de todo e-mail enviado por esta caixa)">
        <textarea rows={3} value={v.assinatura ?? ""} onChange={(e) => setV({ ...v, assinatura: e.target.value })} placeholder={"Faturamento\nConsumed Clínica de Olhos · (21) 0000-0000"} />
      </Campo>
      <h3>Quem vê e responde</h3>
      <div className="linha" style={{ gap: 12, flexWrap: "wrap" }}>
        {Object.entries(FUNCOES).map(([f, rot]) => (
          <label key={f} className="linha" style={{ gap: 4 }}>
            <input type="checkbox" checked={v.funcoes.includes(f)}
              onChange={(e) => setV({ ...v, funcoes: e.target.checked ? [...v.funcoes, f] : v.funcoes.filter((x) => x !== f) })} />
            {rot}
          </label>
        ))}
      </div>
      <input placeholder="Procurar pessoa…" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ margin: "8px 0", width: "100%" }} />
      <div style={{ maxHeight: 260, overflowY: "auto", columns: 2 }}>
        {lista.map((p) => (
          <label key={p.id} className="linha" style={{ gap: 4, breakInside: "avoid" }}>
            <input type="checkbox" checked={quem.includes(p.id)}
              onChange={(e) => setQuem(e.target.checked ? [...quem, p.id] : quem.filter((x) => x !== p.id))} />
            {p.nome} <span className="muted pequeno">({p.funcao})</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
