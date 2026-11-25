// Administração: telefone do sistema (migração 0050) — central, ramais e senhas
import { useEffect, useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Campo, Modal, Etiqueta } from "../components/ui";
import { useTelefone } from "../lib/telefone";

interface Cfg { ligado: boolean; provedor: string; wss_url: string | null; sip_dominio: string | null }
interface Ramal {
  id: string; nome: string; ramal: string; sip_usuario: string | null; profissional_id: string | null;
  senha_cadastrada: boolean; ativo: boolean;
}
interface Pessoa { id: string; nome: string; funcao: string }

export default function ConfigTelefone() {
  const tel = useTelefone();
  const cfg = useCarregar(async () => ok(await supabase.from("telefonia_config").select("ligado, provedor, wss_url, sip_dominio").eq("id", 1).single()) as Cfg, []);
  const ramais = useCarregar(async () => ok(await supabase.from("telefonia_ramais").select("*").order("ramal")) as Ramal[], []);
  const equipe = useCarregar(async () => ok(await supabase.from("profissionais").select("id, nome, funcao").eq("ativo", true).not("agenda_recurso", "is", true).not("sem_acesso", "is", true).order("nome")) as Pessoa[], []);
  const [f, setF] = useState<Cfg | null>(null);
  const [editar, setEditar] = useState<Partial<Ramal> | null>(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (cfg.dados) setF(cfg.dados); }, [cfg.dados]);
  if (!f) return cfg.erro ? <Aviso>{cfg.erro}</Aviso> : <Carregando />;

  async function salvar(extra: Partial<Cfg> = {}) {
    setErro(""); setMsg("");
    const v = { ...f!, ...extra, wss_url: (f!.wss_url ?? "").trim() || null, sip_dominio: (f!.sip_dominio ?? "").trim() || null };
    if (v.wss_url && !/^wss:\/\//.test(v.wss_url)) return setErro("O endereço da central precisa começar com wss:// (conexão segura).");
    if (v.ligado && (!v.wss_url || !v.sip_dominio)) return setErro("Para ligar, preencha o endereço WSS e o domínio SIP que a central informou.");
    const { error } = await supabase.from("telefonia_config").update(v).eq("id", 1);
    if (error) return setErro(msgErro(error));
    setMsg("Salvo ✓"); cfg.recarregar(); tel?.recarregar();
  }

  const nomePessoa = (id: string | null) => equipe.dados?.find((p) => p.id === id)?.nome ?? "—";
  const lista = ramais.dados ?? [];
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Telefone</h1>
          <p className="sub" style={{ margin: 0 }}>As atendentes atendem e fazem ligações pelo próprio sistema, com fone e microfone no computador.</p>
        </div>
      </div>
      <Aviso>{erro || ramais.erro}</Aviso>
      {msg && <Aviso tipo="ok">{msg}</Aviso>}

      <div className="painel">
        <div className="linha entre">
          <h2 style={{ margin: 0 }}>Situação: {f.ligado ? "LIGADO" : "desligado"}</h2>
          {f.ligado ? <button onClick={() => salvar({ ligado: false })}>Desligar</button> : <button className="primario" onClick={() => salvar({ ligado: true })}>Ligar</button>}
        </div>
        <div className="grade g3" style={{ marginTop: 12 }}>
          <Campo rotulo="Empresa de telefonia"><input value={f.provedor} onChange={(e) => setF({ ...f, provedor: e.target.value })} /></Campo>
          <Campo rotulo="Endereço da central (WSS)"><input value={f.wss_url ?? ""} onChange={(e) => setF({ ...f, wss_url: e.target.value })} placeholder="wss://suaempresa.api4com.com:6443" /></Campo>
          <Campo rotulo="Domínio SIP"><input value={f.sip_dominio ?? ""} onChange={(e) => setF({ ...f, sip_dominio: e.target.value })} placeholder="suaempresa.api4com.com" /></Campo>
        </div>
        <button className="primario" style={{ marginTop: 10 }} onClick={() => salvar()}>Salvar</button>
      </div>

      <div className="painel">
        <div className="linha entre">
          <h2 style={{ margin: 0 }}>Ramais</h2>
          <button className="primario" onClick={() => setEditar({ ativo: true })}>+ Novo ramal</button>
        </div>
        {!ramais.dados ? <Carregando /> : lista.length === 0 ? (
          <p className="muted">Nenhum ramal cadastrado. Crie os ramais na central (ex.: na Api4Com) e cadastre aqui, um para cada atendente.</p>
        ) : (
          <table className="tabela" style={{ marginTop: 10 }}>
            <thead><tr><th>Ramal</th><th>Nome</th><th>Quem usa</th><th>Senha</th><th></th></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} style={{ opacity: r.ativo ? 1 : 0.5 }}>
                  <td><b>{r.ramal}</b>{r.sip_usuario && <div className="muted pequeno">usuário {r.sip_usuario}</div>}</td>
                  <td>{r.nome}{!r.ativo && " (inativo)"}</td>
                  <td>{nomePessoa(r.profissional_id)}</td>
                  <td>{r.senha_cadastrada ? <Etiqueta cor="verde">cadastrada</Etiqueta> : <Etiqueta cor="amarelo">falta</Etiqueta>}</td>
                  <td><button className="mini" onClick={() => setEditar(r)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="painel">
        <h3 style={{ marginTop: 0 }}>Como ligar (teste com a Api4Com)</h3>
        <ol className="pequeno">
          <li>Na Api4Com, crie um ramal para cada atendente e anote o <b>número do ramal</b> e a <b>senha</b> de cada um.</li>
          <li>Peça ao suporte da Api4Com o <b>endereço WebSocket (WSS)</b> e o <b>domínio SIP</b> para ramais pelo navegador (WebRTC). Preencha acima.</li>
          <li>Cadastre cada ramal aqui, escolha quem usa e digite a senha. A senha fica guardada no banco e <b>só a própria atendente recebe a dela</b>; nem esta tela mostra de novo.</li>
          <li>Na central, coloque os ramais na <b>fila de atendimento</b> do número da clínica (toca para todas ao mesmo tempo, ou uma de cada vez).</li>
          <li>Clique em <b>Ligar</b>. Cada atendente vê o botão “📞” no canto da tela; na primeira ligação o navegador pede para usar o microfone: clique em <b>Permitir</b>.</li>
        </ol>
        <p className="pequeno muted">Funciona com qualquer central que aceite ramal pelo navegador (WebRTC): Api4Com, Nvoip e outras.</p>
      </div>

      {editar && (
        <EditarRamal r={editar} equipe={equipe.dados ?? []} ocupados={lista.filter((x) => x.id !== editar.id && x.profissional_id).map((x) => x.profissional_id!)}
          aoFechar={(mudou) => { setEditar(null); if (mudou) { ramais.recarregar(); tel?.recarregar(); } }} />
      )}
    </div>
  );
}

function EditarRamal({ r, equipe, ocupados, aoFechar }: { r: Partial<Ramal>; equipe: Pessoa[]; ocupados: string[]; aoFechar: (mudou: boolean) => void }) {
  const [v, setV] = useState<Partial<Ramal>>(r);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro("");
    const dados = {
      nome: (v.nome ?? "").trim(), ramal: (v.ramal ?? "").trim(), sip_usuario: (v.sip_usuario ?? "").trim() || null,
      profissional_id: v.profissional_id || null, ativo: v.ativo ?? true,
    };
    if (!dados.ramal || !dados.nome) return setErro("Preencha o número do ramal e um nome (ex.: Recepção 1).");
    if (!r.id && !senha) return setErro("Digite a senha do ramal (a mesma cadastrada na central).");
    setSalvando(true);
    let id = r.id;
    if (id) {
      const { error } = await supabase.from("telefonia_ramais").update(dados).eq("id", id);
      if (error) { setSalvando(false); return setErro(msgErro(error)); }
    } else {
      const { data, error } = await supabase.from("telefonia_ramais").insert(dados).select("id").single();
      if (error) { setSalvando(false); return setErro(msgErro(error)); }
      id = data.id as string;
    }
    if (senha) {
      const { error } = await supabase.rpc("telefonia_definir_senha", { p_ramal_id: id, p_senha: senha });
      if (error) { setSalvando(false); return setErro(msgErro(error)); }
    }
    setSalvando(false);
    aoFechar(true);
  }

  async function apagar() {
    if (!r.id || !confirm(`Apagar o ramal ${r.ramal}? O histórico de ligações continua guardado.`)) return;
    const { error } = await supabase.from("telefonia_ramais").delete().eq("id", r.id);
    if (error) return setErro(msgErro(error));
    aoFechar(true);
  }

  return (
    <Modal titulo={r.id ? `Ramal ${r.ramal}` : "Novo ramal"} aoFechar={() => aoFechar(false)}
      rodape={<>
        {r.id && <button className="perigo" style={{ marginRight: "auto" }} onClick={apagar}>Apagar</button>}
        <button onClick={() => aoFechar(false)}>Cancelar</button>
        <button className="primario" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
      </>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Número do ramal"><input value={v.ramal ?? ""} onChange={(e) => setV({ ...v, ramal: e.target.value })} placeholder="1001" /></Campo>
        <Campo rotulo="Nome"><input value={v.nome ?? ""} onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Recepção 1" /></Campo>
        <Campo rotulo="Quem usa">
          <select value={v.profissional_id ?? ""} onChange={(e) => setV({ ...v, profissional_id: e.target.value || null })}>
            <option value="">— ninguém (ramal livre) —</option>
            {equipe.filter((p) => !ocupados.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo={r.senha_cadastrada ? "Nova senha (deixe vazio para manter)" : "Senha do ramal"}>
          <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Campo rotulo="Usuário SIP (só se for diferente do ramal)"><input value={v.sip_usuario ?? ""} onChange={(e) => setV({ ...v, sip_usuario: e.target.value })} /></Campo>
        <Campo rotulo="Situação">
          <select value={v.ativo === false ? "0" : "1"} onChange={(e) => setV({ ...v, ativo: e.target.value === "1" })}>
            <option value="1">Ativo</option><option value="0">Inativo</option>
          </select>
        </Campo>
      </div>
    </Modal>
  );
}
