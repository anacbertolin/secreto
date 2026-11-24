import { useState, type FormEvent } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, Aviso, Campo, Carregando } from "../components/ui";
import { CLINICA } from "../lib/marca";
import { fmtData } from "../lib/util";

/**
 * Verificação em duas etapas (aplicativo autenticador / TOTP) — administração (migração 0089).
 * O banco só libera os poderes de administrador depois do código (sessão "aal2").
 */

const soDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 6);
/** O QR vem como "data:image/svg+xml;utf-8,<svg…>" sem codificar: alguns navegadores não mostram. */
function qrParaImagem(q: string) {
  const i = q.indexOf("<svg");
  return i >= 0 ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(q.slice(i))}` : q;
}

/** Tela pedida logo após a senha, quando a pessoa tem o código ativado. */
export function VerificarCodigo() {
  const { sair, recarregar } = useAuth();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function verificar(e: FormEvent) {
    e.preventDefault();
    setErro(""); setEnviando(true);
    const { data: f, error: e1 } = await supabase.auth.mfa.listFactors();
    const fator = f?.totp.find((x) => x.status === "verified");
    if (e1 || !fator) { setEnviando(false); return setErro(e1 ? msgErro(e1) : "Nenhum autenticador encontrado."); }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
    setEnviando(false);
    if (error) { setCodigo(""); return setErro(/invalid|expired/i.test(error.message) ? "Código errado ou vencido. Digite o código que está aparecendo agora no aplicativo." : msgErro(error)); }
    await recarregar();
  }

  return (
    <div className="tela-login">
      <form className="caixa-login grade" onSubmit={verificar}>
        <div style={{ textAlign: "center" }}>
          <img src="/logo-escuro.png" alt={CLINICA.nome} style={{ width: 200, maxWidth: "100%" }} />
          <h2 style={{ margin: "12px 0 4px" }}>🔐 Verificação em duas etapas</h2>
          <p className="muted" style={{ margin: 0 }}>Abra o aplicativo autenticador no seu celular e digite o código de 6 números de <b>{CLINICA.nome} Sistema</b>.</p>
        </div>
        <Aviso>{erro}</Aviso>
        <Campo rotulo="Código">
          <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(soDigitos(e.target.value))}
            style={{ fontSize: "1.6rem", letterSpacing: 6, textAlign: "center" }} placeholder="000000" />
        </Campo>
        <button className="primario grande" disabled={codigo.length !== 6 || enviando}>{enviando ? "Conferindo…" : "Entrar"}</button>
        <button type="button" className="sutil" onClick={sair}>Sair</button>
        <p className="muted pequeno" style={{ margin: 0 }}>Perdeu o celular? Peça ao suporte técnico para desativar o código; depois você ativa de novo no celular novo.</p>
      </form>
    </div>
  );
}

/** Ativar / ver a verificação em duas etapas ("Minha conta"). */
export function AtivarDuasEtapas() {
  const { recarregar } = useAuth();
  const fatores = useCarregar(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data.totp;
  }, []);
  const [novo, setNovo] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const ativo = (fatores.dados ?? []).find((f) => f.status === "verified");

  async function comecar() {
    setErro(""); setOk("");
    // apaga tentativas anteriores não concluídas
    for (const f of (fatores.dados ?? []).filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `${CLINICA.nome} Sistema`, issuer: `${CLINICA.nome} Sistema` });
    if (error) return setErro(msgErro(error));
    if (data.type !== "totp") return setErro("Tipo de verificação inesperado.");
    setNovo({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  }
  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!novo) return;
    setErro("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: novo.id, code: codigo });
    if (error) { setCodigo(""); return setErro(/invalid|expired/i.test(error.message) ? "Código errado ou vencido. Digite o código que está aparecendo agora no aplicativo." : msgErro(error)); }
    setNovo(null); setCodigo("");
    setOk("Pronto! A partir de agora, depois da senha o sistema vai pedir o código do aplicativo.");
    fatores.recarregar(); recarregar();
  }

  return (
    <div className="painel grade" style={{ maxWidth: 520 }}>
      <h2 style={{ margin: 0 }}>🔐 Verificação em duas etapas</h2>
      <p className="muted" style={{ margin: 0 }}>
        Além da senha, o sistema pede um código de 6 números do aplicativo autenticador do seu celular. Mesmo que alguém
        descubra sua senha, não entra sem o seu celular.
      </p>
      <Aviso>{erro || fatores.erro}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      {fatores.carregando && !fatores.dados ? <Carregando /> : ativo ? (
        <Aviso tipo="ok">✅ Ativada{ativo.created_at ? ` desde ${fmtData(ativo.created_at)}` : ""}. O código é pedido toda vez que você entra.</Aviso>
      ) : !novo ? (
        <div><button className="primario" onClick={comecar}>Ativar verificação em duas etapas</button></div>
      ) : (
        <form className="grade" onSubmit={confirmar}>
          <p style={{ margin: 0 }}><b>1.</b> No aplicativo autenticador, toque em <b>+</b> e escaneie este código:</p>
          <img src={qrParaImagem(novo.qr)} alt="QR code para o aplicativo autenticador" style={{ width: 200, height: 200, background: "#fff", padding: 8, border: "1px solid #ddd", borderRadius: 8 }} />
          <p className="muted pequeno" style={{ margin: 0 }}>Não dá para escanear? Escolha "inserir chave" e digite: <code style={{ userSelect: "all" }}>{novo.segredo}</code></p>
          <p style={{ margin: 0 }}><b>2.</b> Digite o código de 6 números que apareceu no aplicativo:</p>
          <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(soDigitos(e.target.value))}
            style={{ fontSize: "1.4rem", letterSpacing: 6, textAlign: "center", maxWidth: 220 }} placeholder="000000" />
          <div className="linha">
            <button type="button" onClick={() => setNovo(null)}>Cancelar</button>
            <button className="primario" disabled={codigo.length !== 6}>Confirmar e ativar</button>
          </div>
        </form>
      )}
    </div>
  );
}
