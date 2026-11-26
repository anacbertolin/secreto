import { useEffect, useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth, type Profissional } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Modal, Campo, Etiqueta } from "../components/ui";
import { listaAgendas, nomeAgenda, listaLocais, nomePor, type Horario, type Bloqueio } from "../lib/dados";
import { DIAS_SEMANA, FUNCOES, fmtDataHora, senhaAleatoria, cpfValido, loginExibicao, sugerirUsuario, USUARIO_VALIDO, type Funcao } from "../lib/util";

// ====================================================================== Equipe
export function Equipe() {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => ok(await supabase.from("profissionais").select("*").order("ativo", { ascending: false }).order("nome")) as Profissional[], []);
  const [edit, setEdit] = useState<Partial<Profissional> | null>(null);
  const [acesso, setAcesso] = useState<Profissional | null>(null);

  return (
    <div>
      <div className="cabecalho">
        <div><h1>Equipe</h1><p className="sub" style={{ margin: 0 }}>Quem usa o sistema e o que cada um pode fazer</p></div>
        <button className="primario" onClick={() => setEdit({ funcao: "recepcao", ativo: true })}>➕ Nova pessoa</button>
      </div>
      <Aviso tipo="info">
        <b>Recepção:</b> cadastro, agenda e convênios (não vê prontuário). <b>Enfermagem/Técnico:</b> pré-consulta, refração, exames e leitura do prontuário.
        <b> Médico:</b> tudo do prontuário, laudos e receitas. <b>Faturamento:</b> contas, guias, lotes e glosas (não vê prontuário). <b>Administração:</b> equipe e cadastros (não vê prontuário).
      </Aviso>
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <>
          <TabelaEquipe lista={(dados ?? []).filter((p) => !p.agenda_recurso)} aoEditar={setEdit} aoAcesso={setAcesso} />
          {(dados ?? []).some((p) => p.agenda_recurso) && <>
            <h2 style={{ marginTop: 24 }}>Colunas de agenda de setor</h2>
            <p className="sub">Não são pessoas: são colunas da Agenda (como no Micrologos) e não entram no sistema. Aparecem só na Agenda e nos horários.</p>
            <TabelaEquipe lista={(dados ?? []).filter((p) => p.agenda_recurso)} aoEditar={setEdit} aoAcesso={setAcesso} />
          </>}
        </>
      )}
      {edit && <EditarProfissional p={edit} aoFechar={() => setEdit(null)} aoSalvar={() => { setEdit(null); recarregar(); }} />}
      {acesso && <SenhaAcesso p={acesso} aoFechar={() => setAcesso(null)} />}
    </div>
  );
}

function TabelaEquipe({ lista, aoEditar, aoAcesso }: { lista: Profissional[]; aoEditar: (p: Profissional) => void; aoAcesso: (p: Profissional) => void }) {
  return (
    <div className="painel rolagem">
      <table className="tabela">
        <thead><tr><th>Nome</th><th>Login</th><th>Função</th><th>Registro</th><th></th></tr></thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id} style={{ opacity: p.ativo ? 1 : 0.5 }}>
              <td><b>{p.nome}</b>{!p.ativo && <> <Etiqueta cor="cinza">inativo</Etiqueta></>}
                {p.agenda_recurso && <> <Etiqueta cor="cinza">coluna de agenda (sem login)</Etiqueta></>}
                {!p.agenda_recurso && p.sem_acesso && <> <Etiqueta cor="cinza">sem login</Etiqueta></>}
                {p.especialidade && <div className="muted pequeno">{p.especialidade}</div>}</td>
              <td>{p.usuario ? <>👤 {p.usuario}</> : p.email ?? <span className="muted">— (sem login)</span>}</td>
              <td>{p.agenda_recurso ? <span className="muted">—</span> : FUNCOES[p.funcao]}{p.orientacao_cirurgica && <div><Etiqueta cor="azul">Orientação cirúrgica</Etiqueta></div>}{p.caixa_conferir && <div><Etiqueta cor="amarelo">Confere o caixa</Etiqueta></div>}{p.caixa_aprovar && <div><Etiqueta cor="verde">Aprova o caixa</Etiqueta></div>}{p.atende_pacientes && p.funcao !== "medico" && <div><Etiqueta cor="roxo">Atende pacientes</Etiqueta></div>}</td>
              <td>{p.conselho && `${p.conselho} ${p.numero_conselho ?? ""}/${p.uf_conselho ?? ""}`}</td>
              <td style={{ textAlign: "right" }}>
                <div className="linha" style={{ justifyContent: "flex-end" }}>
                  <button className="mini" onClick={() => aoEditar(p)}>Editar</button>
                  {p.ativo && p.email && !p.sem_acesso && !p.agenda_recurso && <button className="mini" onClick={() => aoAcesso(p)}>🔑 Senha de acesso</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditarProfissional({ p, aoFechar, aoSalvar }: { p: Partial<Profissional>; aoFechar: () => void; aoSalvar: () => void }) {
  const [f, setF] = useState<Record<string, string | boolean>>({
    nome: p.nome ?? "", email: p.usuario ? "" : p.email ?? "", usuario: p.usuario ?? "", funcao: p.funcao ?? "recepcao", conselho: p.conselho ?? "", numero_conselho: p.numero_conselho ?? "",
    uf_conselho: p.uf_conselho ?? "", especialidade: p.especialidade ?? "", rqe: p.rqe ?? "", cbo: (p as { cbo?: string | null }).cbo ?? "", ativo: p.ativo ?? true,
    orientacao_cirurgica: p.orientacao_cirurgica ?? false,
    caixa_conferir: p.caixa_conferir ?? false, caixa_aprovar: p.caixa_aprovar ?? false, atende_pacientes: p.atende_pacientes ?? false,
  });
  // Médicos e funcionários entram com usuário; a administração com e-mail (decisão da dona, 16/11)
  const [modo, setModo] = useState<"usuario" | "email">(p.usuario ? "usuario" : p.email ? "email" : p.funcao === "admin" ? "email" : "usuario");
  const [erro, setErro] = useState("");
  // CPF e nascimento do médico (Memed) ficam em tabela separada: só a administração e o próprio veem
  const [dp, setDp] = useState({ cpf: "", data_nascimento: "", sexo: "" });
  // nome do médico como sai nas guias/XML do convênio (ex.: "Gisele Moura Brasil")
  const [nomeGuia, setNomeGuia] = useState("");
  useEffect(() => {
    if (!p.id) return;
    supabase.from("profissional_dados_tiss").select("nome_guia").eq("profissional_id", p.id).maybeSingle()
      .then(({ data }) => data && setNomeGuia(data.nome_guia ?? ""));
    supabase.from("profissionais_dados_pessoais").select("cpf, data_nascimento, sexo").eq("profissional_id", p.id).maybeSingle()
      .then(({ data }) => data && setDp({ cpf: data.cpf ?? "", data_nascimento: data.data_nascimento ?? "", sexo: data.sexo ?? "" }));
  }, [p.id]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function salvar() {
    setErro("");
    const cpf = dp.cpf.replace(/\D/g, "");
    if (cpf && !cpfValido(cpf)) return setErro("CPF inválido.");
    const email = String(f.email ?? "").trim().toLowerCase();
    const usuario = String(f.usuario ?? "").trim().toLowerCase();
    if (!String(f.nome).trim()) return setErro("Informe o nome.");
    if (modo === "usuario") {
      if (usuario && !USUARIO_VALIDO.test(usuario)) return setErro("Usuário: de 3 a 40 letras minúsculas sem acento, números, ponto, hífen ou _ (sem espaço). Ex.: gelson.brasil");
      if (f.ativo && !usuario) return setErro("Quem está ativo precisa de um usuário (é o login no sistema).");
    } else if (f.ativo && !email.includes("@")) return setErro("Quem está ativo precisa de e-mail (é o login no sistema).");
    const v: Record<string, unknown> = { ...f, nome: String(f.nome).trim() };
    if (modo === "usuario") { v.usuario = usuario || null; delete v.email; if (!usuario) v.email = null; }
    else { v.usuario = null; v.email = email || null; }
    for (const k of ["conselho", "numero_conselho", "uf_conselho", "especialidade", "rqe", "cbo"]) v[k] = String(v[k] ?? "").trim() || null;
    if (f.funcao === "medico" && !v.cbo) v.cbo = "225265";
    if (v.uf_conselho) v.uf_conselho = String(v.uf_conselho).toUpperCase().slice(0, 2);
    if (f.funcao === "medico" && !v.conselho) v.conselho = "CRM";
    const r = p.id ? await supabase.from("profissionais").update(v).eq("id", p.id).select("id").single() : await supabase.from("profissionais").insert(v).select("id").single();
    if (r.error) return setErro(msgErro(r.error));
    if (f.funcao === "medico" && (cpf || dp.data_nascimento || dp.sexo)) {
      const r2 = await supabase.from("profissionais_dados_pessoais").upsert({
        profissional_id: (r.data as { id: string }).id, cpf: cpf || null, data_nascimento: dp.data_nascimento || null, sexo: dp.sexo || null,
      }, { onConflict: "profissional_id" });
      if (r2.error) return setErro("Salvo, mas o CPF/nascimento não: " + msgErro(r2.error));
    }
    if (f.funcao === "medico" && nomeGuia.trim()) {
      const r3 = await supabase.from("profissional_dados_tiss").upsert({ profissional_id: (r.data as { id: string }).id, nome_guia: nomeGuia.trim() }, { onConflict: "profissional_id" });
      if (r3.error) return setErro("Salvo, mas o nome na guia não: " + msgErro(r3.error));
    }
    aoSalvar();
  }
  const clinico = f.funcao === "medico" || f.funcao === "enfermagem";
  return (
    <Modal titulo={p.id ? "Editar pessoa" : "Nova pessoa na equipe"} aoFechar={aoFechar}
      rodape={<><button onClick={aoFechar}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
      <Aviso>{erro}</Aviso>
      <div className="grade g2">
        <Campo rotulo="Nome completo" className="inteiro"><input value={f.nome as string} onChange={set("nome")} /></Campo>
        <Campo rotulo="Entra no sistema com">
          <select value={modo} onChange={(e) => {
            const m = e.target.value as "usuario" | "email";
            setModo(m);
            if (m === "usuario" && !f.usuario) setF({ ...f, usuario: sugerirUsuario(String(f.nome)) });
          }}>
            <option value="usuario">Usuário e senha</option>
            <option value="email">E-mail e senha (administração)</option>
          </select>
        </Campo>
        {modo === "usuario" ? (
          <Campo rotulo="Usuário (login)">
            <input value={f.usuario as string} autoCapitalize="none" spellCheck={false} placeholder="ex.: gelson.brasil"
              onFocus={() => { if (!f.usuario && f.nome) setF({ ...f, usuario: sugerirUsuario(String(f.nome)) }); }}
              onChange={(e) => setF({ ...f, usuario: e.target.value.toLowerCase().replace(/\s/g, "") })} />
          </Campo>
        ) : (
          <Campo rotulo="E-mail (será o login)"><input type="email" value={f.email as string} onChange={set("email")} /></Campo>
        )}
        {p.id && p.usuario && modo === "usuario" && f.usuario !== p.usuario && (
          <div className="inteiro"><Aviso tipo="info">Ao trocar o usuário, crie de novo a senha de acesso (botão 🔑) — o login antigo deixa de valer.</Aviso></div>
        )}
        <Campo rotulo="Função">
          <select value={f.funcao as string} onChange={set("funcao")}>
            {(Object.keys(FUNCOES) as Funcao[]).map((k) => <option key={k} value={k}>{FUNCOES[k]}</option>)}
          </select>
        </Campo>
        {clinico && (
          <>
            <Campo rotulo="Conselho"><input value={f.conselho as string} onChange={set("conselho")} placeholder={f.funcao === "medico" ? "CRM" : "COREN"} /></Campo>
            <Campo rotulo="Número"><input value={f.numero_conselho as string} onChange={set("numero_conselho")} /></Campo>
            <Campo rotulo="UF do conselho"><input value={f.uf_conselho as string} onChange={set("uf_conselho")} maxLength={2} placeholder="RJ" /></Campo>
            {f.funcao === "medico" && <Campo rotulo="RQE"><input value={f.rqe as string} onChange={set("rqe")} /></Campo>}
            {f.funcao === "medico" && <Campo rotulo="CBO (para as guias)"><input value={f.cbo as string} onChange={set("cbo")} placeholder="225265 (oftalmologista)" /></Campo>}
            {f.funcao === "medico" && <Campo rotulo="Nome nas guias / XML do convênio"><input value={nomeGuia} onChange={(e) => setNomeGuia(e.target.value)} placeholder="ex.: Gisele Moura Brasil" /></Campo>}
            <Campo rotulo="Especialidade / área" className="inteiro"><input value={f.especialidade as string} onChange={set("especialidade")} placeholder="Ex.: Oftalmologia — Retina" /></Campo>
            {f.funcao === "medico" && (
              <>
                <div className="inteiro muted pequeno" style={{ marginTop: 4 }}>Para a <b>receita digital (Memed)</b> e o <b>XML dos convênios</b> (o CPF identifica o médico na guia): só a administração e o próprio médico veem estes dados.</div>
                <Campo rotulo="CPF do médico"><input inputMode="numeric" value={dp.cpf} onChange={(e) => setDp({ ...dp, cpf: e.target.value })} /></Campo>
                <Campo rotulo="Data de nascimento"><input type="date" value={dp.data_nascimento} onChange={(e) => setDp({ ...dp, data_nascimento: e.target.value })} /></Campo>
                <Campo rotulo="Sexo"><select value={dp.sexo} onChange={(e) => setDp({ ...dp, sexo: e.target.value })}><option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option></select></Campo>
              </>
            )}
          </>
        )}
        <label className="check inteiro">
          <input type="checkbox" checked={f.orientacao_cirurgica as boolean} onChange={(e) => setF({ ...f, orientacao_cirurgica: e.target.checked })} />
          Atende a <b>&nbsp;Orientação cirúrgica&nbsp;</b> (vê e responde o WhatsApp da orientação)
        </label>
        {f.funcao !== "medico" && (
          <label className="check inteiro">
            <input type="checkbox" checked={f.atende_pacientes as boolean} onChange={(e) => setF({ ...f, atende_pacientes: e.target.checked })} />
            <b>&nbsp;Atende pacientes&nbsp;</b> sem ser médico (ex.: tecnóloga) — aparece no caixa como profissional
          </label>
        )}
        <label className="check inteiro">
          <input type="checkbox" checked={f.caixa_conferir as boolean} onChange={(e) => setF({ ...f, caixa_conferir: e.target.checked })} />
          <b>&nbsp;Confere o caixa&nbsp;</b> da recepção depois de fechado (telefone/WhatsApp)
        </label>
        <label className="check inteiro">
          <input type="checkbox" checked={f.caixa_aprovar as boolean} onChange={(e) => setF({ ...f, caixa_aprovar: e.target.checked })} />
          <b>&nbsp;Aprova o caixa&nbsp;</b> (aprovação final — supervisão)
        </label>
        {p.id && <label className="check inteiro"><input type="checkbox" checked={f.ativo as boolean} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo (desmarque quando a pessoa sair da clínica: ela perde o acesso)</label>}
      </div>
    </Modal>
  );
}

function SenhaAcesso({ p, aoFechar }: { p: Profissional; aoFechar: () => void }) {
  const [senha] = useState(senhaAleatoria());
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function criar() {
    setErro(""); setEnviando(true);
    const { data, error } = await supabase.functions.invoke("equipe-acesso", { body: { email: p.email, senha } });
    setEnviando(false);
    if (error) {
      let m = error.message;
      try { m = (await (error as { context?: Response }).context?.json())?.erro ?? m; } catch { /* mantém */ }
      return setErro(m);
    }
    setFeito((data as { acao: string }).acao === "acesso_criado" ? "Acesso criado." : "Senha redefinida.");
  }
  return (
    <Modal titulo={`Senha de acesso — ${p.nome}`} aoFechar={aoFechar} rodape={<button onClick={aoFechar}>Fechar</button>}>
      <Aviso>{erro}</Aviso>
      {!feito ? (
        <>
          <p>Isto cria o acesso de <b>{loginExibicao(p.email)}</b> (ou troca a senha, se ela esqueceu) com a senha temporária abaixo.</p>
          <p style={{ fontSize: "1.6rem", fontFamily: "monospace", letterSpacing: 2, textAlign: "center", background: "#f3f5f7", padding: 12, borderRadius: 8 }}>{senha}</p>
          <p className="muted pequeno">Depois de criar, o sistema monta uma mensagem com o link do primeiro acesso para mandar pelo WhatsApp. No primeiro acesso a pessoa é obrigada a criar a própria senha.</p>
          <button className="primario" onClick={criar} disabled={enviando}>{enviando ? "Criando…" : "Criar / redefinir acesso"}</button>
        </>
      ) : (
        <>
          <Aviso tipo="ok">
            {feito} {p.usuario ? "Usuário" : "Login"}: <b>{loginExibicao(p.email)}</b> · Senha temporária: <b style={{ fontFamily: "monospace" }}>{senha}</b>
          </Aviso>
          <EnviarAcesso p={p} senha={senha} />
        </>
      )}
    </Modal>
  );
}

/** Mensagem pronta com o link do primeiro acesso, para mandar pelo WhatsApp ou copiar. */
function EnviarAcesso({ p, senha }: { p: Profissional; senha: string }) {
  const login = loginExibicao(p.email);
  const link = `${window.location.origin}/?u=${encodeURIComponent(login)}`;
  const primeiro = p.nome.trim().split(/\s+/)[0];
  const msg =
    `Olá, ${primeiro}! Seu acesso ao sistema da Consumed está pronto.\n\n` +
    `1) Abra este link: ${link}\n` +
    `2) Usuário: ${login}\n` +
    `3) Senha temporária: ${senha}\n\n` +
    `No primeiro acesso o sistema vai pedir para você criar a sua própria senha. Não compartilhe a sua senha com ninguém.`;
  const [fone, setFone] = useState("");
  const [copiado, setCopiado] = useState(false);
  const digitos = fone.replace(/\D/g, "");
  const numero = digitos.length >= 10 && digitos.length <= 11 ? `55${digitos}` : digitos.length >= 12 ? digitos : "";
  const wa = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
  async function copiar() {
    try { await navigator.clipboard.writeText(msg); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* navegador sem permissão */ }
  }
  return (
    <div className="grade" style={{ marginTop: 12 }}>
      <b>Mandar o acesso para {primeiro}</b>
      <textarea readOnly value={msg} rows={8} style={{ width: "100%", fontSize: ".9rem" }} onFocus={(e) => e.currentTarget.select()} />
      <Campo rotulo="Celular (WhatsApp) da pessoa — opcional">
        <input inputMode="tel" placeholder="(21) 99999-9999" value={fone} onChange={(e) => setFone(e.target.value)} />
      </Campo>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="botao primario" href={wa} target="_blank" rel="noreferrer">🟢 Enviar pelo WhatsApp</a>
        <button type="button" onClick={copiar}>{copiado ? "✅ Copiado!" : "📋 Copiar mensagem"}</button>
      </div>
      <p className="muted pequeno" style={{ margin: 0 }}>
        Sem o celular, o WhatsApp abre para você escolher o contato. O link já preenche o usuário; a senha temporária só serve
        para o primeiro acesso.
      </p>
    </div>
  );
}

// ====================================================================== Cadastro simples genérico
function CadastroSimples(props: {
  titulo: string; sub: string; tabela: string; campos: { k: string; rotulo: string; tipo?: "texto" | "numero" | "sim_nao" | "select"; opcoes?: [string, string][] }[];
  colunas: { k: string; rotulo: string; fmt?: (v: unknown) => string }[];
  acaoExtra?: (d: Record<string, unknown>) => React.ReactNode;
}) {
  const { dados, erro, carregando, recarregar } = useCarregar(async () => ok(await supabase.from(props.tabela).select("*").order("ativo", { ascending: false }).order("nome")) as Record<string, unknown>[], []);
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [e2, setE2] = useState("");
  async function salvar() {
    setE2("");
    const v: Record<string, unknown> = {};
    for (const c of props.campos) v[c.k] = c.tipo === "numero" ? Number(edit![c.k]) : c.tipo === "sim_nao" ? !!edit![c.k] : (String(edit![c.k] ?? "").trim() || null);
    v.ativo = edit!.ativo ?? true;
    const r = edit!.id ? await supabase.from(props.tabela).update(v).eq("id", edit!.id as string) : await supabase.from(props.tabela).insert(v);
    if (r.error) return setE2(msgErro(r.error));
    setEdit(null); recarregar();
  }
  return (
    <div>
      <div className="cabecalho">
        <div><h1>{props.titulo}</h1><p className="sub" style={{ margin: 0 }}>{props.sub}</p></div>
        <button className="primario" onClick={() => setEdit(Object.fromEntries(props.campos.map((c) => [c.k, c.tipo === "sim_nao" ? c.k !== "exige_senha" : c.tipo === "numero" ? (c.k === "dias_retorno" ? 30 : 15) : c.opcoes?.[0]?.[0] ?? ""])))}>➕ Novo</button>
      </div>
      <Aviso>{erro}</Aviso>
      {carregando ? <Carregando /> : (
        <div className="painel rolagem">
          <table className="tabela">
            <thead><tr>{props.colunas.map((c) => <th key={c.k}>{c.rotulo}</th>)}<th></th></tr></thead>
            <tbody>
              {(dados ?? []).map((d) => (
                <tr key={d.id as string} style={{ opacity: d.ativo ? 1 : 0.5 }}>
                  {props.colunas.map((c) => <td key={c.k}>{c.fmt ? c.fmt(d[c.k]) : (d[c.k] as string) ?? "—"}</td>)}
                  <td style={{ textAlign: "right" }}>
                    {props.acaoExtra?.(d)}{props.acaoExtra && " "}
                    <button className="mini" onClick={() => setEdit(d)}>Editar</button>{" "}
                    <button className="mini" onClick={async () => { await supabase.from(props.tabela).update({ ativo: !d.ativo }).eq("id", d.id as string); recarregar(); }}>{d.ativo ? "Desativar" : "Reativar"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dados?.length === 0 && <div className="vazio">Nenhum cadastro ainda.</div>}
        </div>
      )}
      {edit && (
        <Modal titulo={edit.id ? "Editar" : "Novo"} aoFechar={() => setEdit(null)} rodape={<><button onClick={() => setEdit(null)}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
          <Aviso>{e2}</Aviso>
          <div className="grade">
            {props.campos.map((c) => (
              c.tipo === "sim_nao"
                ? <label key={c.k} className="check"><input type="checkbox" checked={!!edit[c.k]} onChange={(e) => setEdit({ ...edit, [c.k]: e.target.checked })} /> {c.rotulo}</label>
                : <Campo key={c.k} rotulo={c.rotulo}>
                  {c.tipo === "select"
                    ? <select value={String(edit[c.k] ?? "")} onChange={(e) => setEdit({ ...edit, [c.k]: e.target.value })}>{c.opcoes!.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    : <input type={c.tipo === "numero" ? "number" : "text"} value={String(edit[c.k] ?? "")} onChange={(e) => setEdit({ ...edit, [c.k]: e.target.value })} />}
                </Campo>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Convenios() {
  const [planosDe, setPlanosDe] = useState<{ id: string; nome: string } | null>(null);
  return (
    <>
      <CadastroSimples titulo="Convênios" sub="Convênios aceitos pela clínica e os planos de cada um" tabela="convenios"
        campos={[
          { k: "nome", rotulo: "Nome do convênio" }, { k: "registro_ans", rotulo: "Registro ANS da operadora" },
          { k: "codigo_prestador", rotulo: "Código da clínica neste convênio (código do prestador)" },
          { k: "dias_retorno", rotulo: "Prazo de retorno sem cobrança (dias)", tipo: "numero" },
          { k: "exige_senha", rotulo: "Exige senha de autorização para consulta", tipo: "sim_nao" },
          { k: "observacoes_faturamento", rotulo: "Regras de faturamento (aparecem na conta)" },
        ]}
        colunas={[
          { k: "nome", rotulo: "Convênio" }, { k: "registro_ans", rotulo: "Registro ANS" }, { k: "codigo_prestador", rotulo: "Cód. prestador" },
          { k: "exige_senha", rotulo: "Senha", fmt: (v) => (v ? "Exige" : "—") },
        ]}
        acaoExtra={(d) => <button className="mini" onClick={() => setPlanosDe({ id: d.id as string, nome: d.nome as string })}>Planos</button>} />
      {planosDe && <PlanosConvenio convenio={planosDe} aoFechar={() => setPlanosDe(null)} />}
    </>
  );
}

function PlanosConvenio({ convenio, aoFechar }: { convenio: { id: string; nome: string }; aoFechar: () => void }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("convenio_planos").select("*").eq("convenio_id", convenio.id).order("ativo", { ascending: false }).order("nome")) as { id: string; nome: string; codigo: string | null; ativo: boolean }[], [convenio.id]);
  const [novo, setNovo] = useState({ nome: "", codigo: "" });
  const [e2, setE2] = useState("");
  async function incluir() {
    setE2("");
    if (!novo.nome.trim()) return setE2("Informe o nome do plano.");
    const { error } = await supabase.from("convenio_planos").insert({ convenio_id: convenio.id, nome: novo.nome.trim(), codigo: novo.codigo.trim() || null });
    if (error) return setE2(msgErro(error));
    setNovo({ nome: "", codigo: "" }); recarregar();
  }
  async function alternar(id: string, ativo: boolean) {
    const { error } = await supabase.from("convenio_planos").update({ ativo: !ativo }).eq("id", id);
    if (error) setE2(msgErro(error));
    recarregar();
  }
  return (
    <Modal titulo={`Planos — ${convenio.nome}`} aoFechar={aoFechar} rodape={<button onClick={aoFechar}>Fechar</button>}>
      <Aviso>{erro || e2}</Aviso>
      <table className="tabela">
        <tbody>
          {(dados ?? []).map((x) => (
            <tr key={x.id} style={{ opacity: x.ativo ? 1 : 0.5 }}>
              <td><b>{x.nome}</b></td><td className="muted">{x.codigo}</td>
              <td style={{ textAlign: "right" }}><button className="mini" onClick={() => alternar(x.id, x.ativo)}>{x.ativo ? "Desativar" : "Reativar"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {dados?.length === 0 && <p className="muted">Nenhum plano cadastrado. Sem planos, o paciente fica só com o convênio.</p>}
      <div className="linha" style={{ marginTop: 12 }}>
        <input style={{ flex: 2, minWidth: 160 }} placeholder="Nome do plano (ex.: Enfermaria, Apartamento)" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
        <input style={{ flex: 1, minWidth: 100 }} placeholder="Código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
        <button className="primario" onClick={incluir}>Incluir</button>
      </div>
    </Modal>
  );
}

const TIPOS_LOCAL: [string, string][] = [["consultorio", "Consultório"], ["sala_exame", "Sala de exames"], ["centro_cirurgico", "Centro cirúrgico"], ["outro", "Outro"]];
export const Locais = () => (
  <CadastroSimples titulo="Salas e consultórios" sub="Onde os atendimentos acontecem" tabela="locais"
    campos={[{ k: "nome", rotulo: "Nome" }, { k: "tipo", rotulo: "Tipo", tipo: "select", opcoes: TIPOS_LOCAL }]}
    colunas={[{ k: "nome", rotulo: "Nome" }, { k: "tipo", rotulo: "Tipo", fmt: (v) => TIPOS_LOCAL.find((t) => t[0] === v)?.[1] ?? "" }]} />
);

export const CatalogoExames = () => (
  <CadastroSimples titulo="Tipos de exame" sub="Exames que a clínica realiza (aparecem nos pedidos e na fila de exames)" tabela="exames_catalogo"
    campos={[{ k: "nome", rotulo: "Nome do exame" }, { k: "codigo_tuss", rotulo: "Código TUSS" }, { k: "duracao_min", rotulo: "Duração (min)", tipo: "numero" }, { k: "requer_laudo", rotulo: "Precisa de laudo médico", tipo: "sim_nao" }]}
    colunas={[{ k: "nome", rotulo: "Exame" }, { k: "codigo_tuss", rotulo: "TUSS" }, { k: "duracao_min", rotulo: "Duração", fmt: (v) => `${v} min` }, { k: "requer_laudo", rotulo: "Laudo", fmt: (v) => (v ? "Sim" : "Não") }]} />
);

// ====================================================================== Horários e bloqueios
export function Horarios() {
  const base = useCarregar(async () => {
    const [medicos, locais] = await Promise.all([listaAgendas(), listaLocais()]);
    return { medicos, locais };
  }, []);
  const [medico, setMedico] = useState("");
  const med = medico || base.dados?.medicos[0]?.id || "";
  const dados = useCarregar(async () => {
    if (!med) return { hs: [], bs: [] };
    const [h, b] = await Promise.all([
      supabase.from("horarios_profissional").select("*").eq("profissional_id", med).eq("ativo", true).order("dia_semana").order("hora_inicio"),
      supabase.from("bloqueios_agenda").select("*").eq("ativo", true).or(`profissional_id.eq.${med},profissional_id.is.null`).gte("fim", new Date().toISOString()).order("inicio"),
    ]);
    return { hs: ok(h) as Horario[], bs: ok(b) as Bloqueio[] };
  }, [med]);
  const [nh, setNh] = useState({ dias: [] as number[], hora_inicio: "08:00", hora_fim: "12:00", duracao_min: "15", local_id: "" });
  const [nb, setNb] = useState({ inicio: "", fim: "", motivo: "", todos: false });
  const [erro, setErro] = useState("");

  async function addHorario() {
    setErro("");
    if (nh.dias.length === 0) return setErro("Escolha pelo menos um dia da semana.");
    const { error } = await supabase.from("horarios_profissional").insert(nh.dias.map((d) => ({
      profissional_id: med, dia_semana: d, hora_inicio: nh.hora_inicio, hora_fim: nh.hora_fim, duracao_min: Number(nh.duracao_min), local_id: nh.local_id || null,
    })));
    if (error) return setErro(msgErro(error));
    setNh({ ...nh, dias: [] }); dados.recarregar();
  }
  async function addBloqueio() {
    setErro("");
    if (!nb.inicio || !nb.fim || !nb.motivo) return setErro("Preencha início, fim e motivo do bloqueio.");
    const { error } = await supabase.from("bloqueios_agenda").insert({
      profissional_id: nb.todos ? null : med, inicio: new Date(nb.inicio).toISOString(), fim: new Date(nb.fim).toISOString(), motivo: nb.motivo,
    });
    if (error) return setErro(msgErro(error));
    setNb({ inicio: "", fim: "", motivo: "", todos: false }); dados.recarregar();
  }
  async function desativar(tabela: string, id: string) {
    if (!confirm("Remover?")) return;
    const { error } = await supabase.from(tabela).update({ ativo: false }).eq("id", id);
    if (error) setErro(msgErro(error));
    dados.recarregar();
  }

  if (base.carregando) return <Carregando />;
  if (!base.dados?.medicos.length) return <div className="painel vazio">Cadastre primeiro os médicos em Cadastros → Equipe.</div>;
  return (
    <div>
      <div className="cabecalho">
        <div><h1>Horários e bloqueios</h1><p className="sub" style={{ margin: 0 }}>Quando cada médico atende — é isso que monta a grade da agenda</p></div>
        <select style={{ width: 260 }} value={med} onChange={(e) => setMedico(e.target.value)}>
          {base.dados.medicos.map((m) => <option key={m.id} value={m.id}>{nomeAgenda(m)}</option>)}
        </select>
      </div>
      <Aviso>{erro || dados.erro || base.erro}</Aviso>
      <div className="painel">
        <h2>Horários de atendimento</h2>
        <table className="tabela">
          <tbody>
            {(dados.dados?.hs ?? []).map((h) => (
              <tr key={h.id}>
                <td><b>{DIAS_SEMANA[h.dia_semana]}</b></td><td>{h.hora_inicio.slice(0, 5)} às {h.hora_fim.slice(0, 5)}</td>
                <td>consultas de {h.duracao_min} min</td><td>{nomePor(base.dados!.locais, h.local_id)}</td>
                <td style={{ textAlign: "right" }}><button className="sutil mini" onClick={() => desativar("horarios_profissional", h.id)}>remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {dados.dados?.hs.length === 0 && <div className="muted">Nenhum horário cadastrado — a agenda mostra tudo como "fora do horário".</div>}
        <div className="secao grade" style={{ marginTop: 14 }}>
          <h3>Adicionar horário</h3>
          <div className="linha">
            {DIAS_SEMANA.map((d, i) => (
              <label key={i} className="check"><input type="checkbox" checked={nh.dias.includes(i)} onChange={(e) => setNh({ ...nh, dias: e.target.checked ? [...nh.dias, i] : nh.dias.filter((x) => x !== i) })} /> {d}</label>
            ))}
          </div>
          <div className="grade g4">
            <Campo rotulo="Das"><input type="time" value={nh.hora_inicio} onChange={(e) => setNh({ ...nh, hora_inicio: e.target.value })} /></Campo>
            <Campo rotulo="Até"><input type="time" value={nh.hora_fim} onChange={(e) => setNh({ ...nh, hora_fim: e.target.value })} /></Campo>
            <Campo rotulo="Duração de cada consulta (min)">
              <select value={nh.duracao_min} onChange={(e) => setNh({ ...nh, duracao_min: e.target.value })}>{[10, 15, 20, 30, 40, 60].map((d) => <option key={d}>{d}</option>)}</select>
            </Campo>
            <Campo rotulo="Sala">
              <select value={nh.local_id} onChange={(e) => setNh({ ...nh, local_id: e.target.value })}>
                <option value="">—</option>{base.dados.locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </Campo>
          </div>
          <div><button className="primario" onClick={addHorario}>Adicionar</button></div>
        </div>
      </div>
      <div className="painel">
        <h2>Bloqueios (férias, congressos, feriados)</h2>
        <table className="tabela">
          <tbody>
            {(dados.dados?.bs ?? []).map((b) => (
              <tr key={b.id}>
                <td>{fmtDataHora(b.inicio)} até {fmtDataHora(b.fim)}</td><td>{b.motivo}</td>
                <td>{b.profissional_id ? "" : <Etiqueta cor="amarelo">Clínica toda</Etiqueta>}</td>
                <td style={{ textAlign: "right" }}><button className="sutil mini" onClick={() => desativar("bloqueios_agenda", b.id)}>remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {dados.dados?.bs.length === 0 && <div className="muted">Nenhum bloqueio futuro.</div>}
        <div className="secao grade g4" style={{ marginTop: 14 }}>
          <Campo rotulo="Início"><input type="datetime-local" value={nb.inicio} onChange={(e) => setNb({ ...nb, inicio: e.target.value })} /></Campo>
          <Campo rotulo="Fim"><input type="datetime-local" value={nb.fim} onChange={(e) => setNb({ ...nb, fim: e.target.value })} /></Campo>
          <Campo rotulo="Motivo"><input value={nb.motivo} onChange={(e) => setNb({ ...nb, motivo: e.target.value })} placeholder="Férias, congresso, feriado…" /></Campo>
          <label className="check" style={{ alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={nb.todos} onChange={(e) => setNb({ ...nb, todos: e.target.checked })} /> Vale para todos os médicos</label>
          <div><button className="primario" onClick={addBloqueio}>Bloquear</button></div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================== Modelos de texto
const TIPOS_MODELO: Record<string, string> = {
  laudo: "Laudo de exame", anamnese: "Anamnese", exame: "Exame", conduta: "Conduta", orientacoes: "Orientações ao paciente",
  atestado: "Atestado", documento: "Outros documentos", outro: "Outro",
};
export function Modelos() {
  const { eu } = useAuth();
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("modelos_texto").select("*, profissionais(nome)").eq("ativo", true).order("tipo").order("titulo")) as unknown as { id: string; tipo: string; titulo: string; texto: string; profissional_id: string; compartilhado: boolean; profissionais: { nome: string } | null }[], []);
  const [edit, setEdit] = useState<{ id?: string; tipo: string; titulo: string; texto: string; compartilhado: boolean } | null>(null);
  const [e2, setE2] = useState("");
  async function salvar() {
    setE2("");
    if (!edit!.titulo || !edit!.texto) return setE2("Preencha título e texto.");
    const v = { tipo: edit!.tipo, titulo: edit!.titulo, texto: edit!.texto, compartilhado: edit!.compartilhado };
    const r = edit!.id ? await supabase.from("modelos_texto").update(v).eq("id", edit!.id) : await supabase.from("modelos_texto").insert(v);
    if (r.error) return setE2(msgErro(r.error));
    setEdit(null); recarregar();
  }
  return (
    <div>
      <div className="cabecalho">
        <div><h1>Modelos de texto</h1><p className="sub" style={{ margin: 0 }}>Textos prontos para laudos, condutas, orientações e atestados (botão "📝 Modelos")</p></div>
        <button className="primario" onClick={() => setEdit({ tipo: "laudo", titulo: "", texto: "", compartilhado: true })}>➕ Novo modelo</button>
      </div>
      <Aviso>{erro}</Aviso>
      <div className="painel rolagem">
        <table className="tabela">
          <thead><tr><th>Tipo</th><th>Título</th><th>Autor</th><th></th></tr></thead>
          <tbody>
            {(dados ?? []).map((m) => (
              <tr key={m.id}>
                <td>{TIPOS_MODELO[m.tipo]}</td><td><b>{m.titulo}</b><div className="muted pequeno" style={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.texto}</div></td>
                <td>{m.profissionais?.nome}{!m.compartilhado && " (só meu)"}</td>
                <td style={{ textAlign: "right" }}>
                  {m.profissional_id === eu?.id && <>
                    <button className="mini" onClick={() => setEdit(m)}>Editar</button>{" "}
                    <button className="mini" onClick={async () => { if (confirm("Excluir este modelo?")) { await supabase.from("modelos_texto").update({ ativo: false }).eq("id", m.id); recarregar(); } }}>Excluir</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dados?.length === 0 && <div className="vazio">Nenhum modelo ainda.</div>}
      </div>
      {edit && (
        <Modal largo titulo={edit.id ? "Editar modelo" : "Novo modelo"} aoFechar={() => setEdit(null)} rodape={<><button onClick={() => setEdit(null)}>Cancelar</button><button className="primario" onClick={salvar}>Salvar</button></>}>
          <Aviso>{e2}</Aviso>
          <div className="grade g2">
            <Campo rotulo="Tipo"><select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>{Object.entries(TIPOS_MODELO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            <Campo rotulo="Título"><input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} placeholder="Ex.: OCT de mácula normal" /></Campo>
            <Campo rotulo="Texto" className="inteiro"><textarea rows={12} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} /></Campo>
            <label className="check inteiro"><input type="checkbox" checked={edit.compartilhado} onChange={(e) => setEdit({ ...edit, compartilhado: e.target.checked })} /> Compartilhar com os outros médicos</label>
          </div>
        </Modal>
      )}
    </div>
  );
}
