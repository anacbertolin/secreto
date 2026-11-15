// Ficha do paciente: gerar/revogar o link do portal (migração 0028)
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Modal, Aviso, Etiqueta } from "./ui";
import { fmtDataHora } from "../lib/util";
import { CLINICA } from "../lib/marca";

interface L { token: string; criado_em: string; expira_em: string; revogado: boolean; acessos: number; ultimo_acesso_em: string | null; tentativas_erradas: number }

export function BotaoPortal({ pacienteId }: { pacienteId: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)} title="Link para o paciente ver receitas, atestados e exames pelo celular">🔗 Portal do paciente</button>
      {aberto && <ModalPortal pacienteId={pacienteId} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function ModalPortal({ pacienteId, aoFechar }: { pacienteId: string; aoFechar: () => void }) {
  const links = useCarregar(async () => ok(await supabase.from("portal_links").select("*").eq("paciente_id", pacienteId).order("criado_em", { ascending: false }).limit(10)) as L[], [pacienteId]);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const url = (t: string) => `${window.location.origin}/portal/${t}`;
  async function gerar() {
    setErro("");
    const { data, error } = await supabase.rpc("portal_criar_link", { p_paciente: pacienteId });
    if (error) return setErro(msgErro(error));
    setNovo(String(data)); links.recarregar();
  }
  async function revogar(t: string) {
    const { error } = await supabase.from("portal_links").update({ revogado: true }).eq("token", t);
    if (error) setErro(msgErro(error)); else links.recarregar();
  }
  const texto = `Olá! Seus documentos da ${CLINICA.nome} estão neste link (vale 7 dias). Para abrir, digite sua data de nascimento: ${url(novo)}`;
  return (
    <Modal titulo="🔗 Portal do paciente" aoFechar={aoFechar} rodape={<button onClick={aoFechar}>Fechar</button>}>
      <Aviso>{erro || links.erro}</Aviso>
      <p style={{ marginTop: 0 }}>O paciente abre pelo celular, digita a <b>data de nascimento</b> e vê as receitas, atestados, pedidos e resultados de exames dos últimos 6 meses, além das próximas consultas. O link vale <b>7 dias</b>.</p>
      {!novo ? <button className="primario" onClick={gerar}>Gerar link novo</button> : (
        <div className="secao">
          <div style={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: 13 }}>{url(novo)}</div>
          <div className="linha" style={{ marginTop: 8 }}>
            <button className="mini primario" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { setErro("Não foi possível copiar. Selecione o link e copie."); } }}>{copiado ? "✓ Mensagem copiada" : "📋 Copiar mensagem com o link"}</button>
            <Link className="botao mini" to={`/whatsapp?paciente=${pacienteId}`}>💬 Abrir WhatsApp do paciente</Link>
          </div>
          <p className="muted pequeno">Cole a mensagem na conversa do WhatsApp. Não mande para um número que não seja do paciente ou do responsável.</p>
        </div>
      )}
      {(links.dados ?? []).length > 0 && (
        <>
          <h3>Links gerados</h3>
          <table className="tabela"><tbody>
            {(links.dados ?? []).map((l) => {
              const ativo = !l.revogado && new Date(l.expira_em) > new Date() && l.tentativas_erradas < 5;
              return (
                <tr key={l.token}>
                  <td className="pequeno">{fmtDataHora(l.criado_em)}<div className="muted">vale até {fmtDataHora(l.expira_em)}</div></td>
                  <td className="pequeno">{l.acessos} acesso(s){l.ultimo_acesso_em && <div className="muted">último {fmtDataHora(l.ultimo_acesso_em)}</div>}</td>
                  <td>{ativo ? <Etiqueta cor="verde">ativo</Etiqueta> : <Etiqueta cor="cinza">{l.revogado ? "cancelado" : l.tentativas_erradas >= 5 ? "bloqueado" : "vencido"}</Etiqueta>}</td>
                  <td style={{ textAlign: "right" }}>{ativo && <button className="mini" onClick={() => revogar(l.token)}>Cancelar</button>}</td>
                </tr>
              );
            })}
          </tbody></table>
        </>
      )}
    </Modal>
  );
}
