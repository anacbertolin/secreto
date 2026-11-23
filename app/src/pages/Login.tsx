import { useState, type FormEvent } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { Aviso, Campo } from "../components/ui";
import { CLINICA } from "../lib/marca";
import { emailDoLogin } from "../lib/util";

export default function Login() {
  // Link de primeiro acesso (tela Equipe): ?u=<usuário> já preenche o usuário
  const [login, setLogin] = useState(() => new URLSearchParams(window.location.search).get("u") ?? "");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [esqueci, setEsqueci] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoLogin(login), password: senha });
    if (error) setErro(msgErro(error));
    setEnviando(false);
  }

  return (
    <div className="tela-login">
      <form className="caixa-login grade" onSubmit={entrar}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <img src="/logo-escuro.png" alt={`${CLINICA.nome} · ${CLINICA.subtitulo}`} style={{ width: 240, maxWidth: "100%" }} />
          <p className="muted" style={{ margin: "10px 0 0" }}>Sistema da clínica · acesso da equipe</p>
        </div>
        <Aviso>{erro}</Aviso>
        <Campo rotulo="Usuário (ou e-mail da administração)">
          <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus={!login} />
        </Campo>
        <Campo rotulo="Senha">
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoFocus={!!login} />
        </Campo>
        <button className="primario grande" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        <button type="button" className="sutil" onClick={() => setEsqueci(!esqueci)}>Esqueci minha senha / primeiro acesso</button>
        {esqueci && (
          <Aviso tipo="info">
            Peça à administração da clínica uma <b>senha temporária</b> (tela Cadastros → Equipe).
            No primeiro acesso o sistema pede para você criar a sua própria senha.
          </Aviso>
        )}
      </form>
    </div>
  );
}

export function TrocarSenha({ obrigatoria }: { obrigatoria?: boolean }) {
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (s1.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (s1 !== s2) return setErro("As duas senhas não são iguais.");
    const { error } = await supabase.auth.updateUser({ password: s1, data: { trocar_senha: false } });
    if (error) return setErro(/different from the old/i.test(error.message) ? "A nova senha deve ser diferente da temporária." : msgErro(error));
    setOk("Senha alterada com sucesso.");
    setS1("");
    setS2("");
  }

  const form = (
    <form className={obrigatoria ? "caixa-login grade" : "painel grade"} style={{ maxWidth: 420 }} onSubmit={salvar}>
      <h2>{obrigatoria ? "Crie sua senha" : "Trocar minha senha"}</h2>
      {obrigatoria && <p className="muted" style={{ margin: 0 }}>Este é seu primeiro acesso (ou sua senha foi redefinida). Crie uma senha pessoal, que só você saiba.</p>}
      <Aviso>{erro}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      <Campo rotulo="Nova senha (mínimo 8 caracteres)">
        <input type="password" autoComplete="new-password" value={s1} onChange={(e) => setS1(e.target.value)} required />
      </Campo>
      <Campo rotulo="Repita a nova senha">
        <input type="password" autoComplete="new-password" value={s2} onChange={(e) => setS2(e.target.value)} required />
      </Campo>
      <button className="primario">Salvar senha</button>
      {obrigatoria && <button type="button" className="sutil" onClick={() => supabase.auth.signOut()}>Sair</button>}
    </form>
  );
  return obrigatoria ? <div className="tela-login">{form}</div> : form;
}
