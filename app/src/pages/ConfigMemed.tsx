// Administração: receita digital Memed (migração 0030)
import { useEffect, useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando, Campo } from "../components/ui";

interface Cfg { ligado: boolean; ambiente: string; cnes: string | null; nome_local: string | null }

export default function ConfigMemed() {
  const cfg = useCarregar(async () => ok(await supabase.from("memed_config").select("ligado, ambiente, cnes, nome_local").eq("id", 1).single()) as Cfg, []);
  const medicos = useCarregar(async () => {
    const [m, d] = await Promise.all([
      supabase.from("profissionais").select("id, nome, numero_conselho, uf_conselho").eq("funcao", "medico").eq("ativo", true).order("nome"),
      supabase.from("profissionais_dados_pessoais").select("profissional_id, cpf, data_nascimento"),
    ]);
    const dados = new Map(((d.data ?? []) as { profissional_id: string; cpf: string | null; data_nascimento: string | null }[]).map((x) => [x.profissional_id, x]));
    return (ok(m) as { id: string; nome: string; numero_conselho: string | null; uf_conselho: string | null }[]).map((p) => {
      const x = dados.get(p.id);
      const falta = [!x?.cpf && "CPF", !x?.data_nascimento && "nascimento", !p.numero_conselho && "CRM", !p.uf_conselho && "UF"].filter(Boolean);
      return { ...p, falta };
    });
  }, []);
  const [f, setF] = useState<Cfg | null>(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (cfg.dados) setF(cfg.dados); }, [cfg.dados]);
  if (!f) return cfg.erro ? <Aviso>{cfg.erro}</Aviso> : <Carregando />;

  async function salvar(extra: Partial<Cfg> = {}) {
    setErro(""); setMsg("");
    const v = { ...f, ...extra, cnes: (f!.cnes ?? "").replace(/\D/g, "") || null, nome_local: f!.nome_local || null };
    if (v.ligado && v.ambiente === "producao" && !v.cnes) return setErro("Para a produção, a Memed exige o CNES da clínica.");
    const { error } = await supabase.from("memed_config").update(v).eq("id", 1);
    if (error) return setErro(msgErro(error));
    setMsg("Salvo ✓"); cfg.recarregar();
  }
  return (
    <div>
      <div className="cabecalho"><div><h1>Receita digital (Memed)</h1><p className="sub" style={{ margin: 0 }}>O médico prescreve na Memed sem sair do atendimento; a receita fica guardada no prontuário.</p></div></div>
      <Aviso>{erro}</Aviso>
      {msg && <Aviso tipo="ok">{msg}</Aviso>}
      <div className="painel">
        <div className="linha entre">
          <h2 style={{ margin: 0 }}>Situação: {f.ligado ? "LIGADA" : "desligada"} · ambiente {f.ambiente === "producao" ? "de PRODUÇÃO (receitas reais)" : "de TESTE (homologação)"}</h2>
          {f.ligado ? <button onClick={() => salvar({ ligado: false })}>Desligar</button> : <button className="primario" onClick={() => salvar({ ligado: true })}>Ligar</button>}
        </div>
        <div className="grade g3" style={{ marginTop: 12 }}>
          <Campo rotulo="Ambiente">
            <select value={f.ambiente} onChange={(e) => setF({ ...f, ambiente: e.target.value })}>
              <option value="homologacao">Teste (homologação da Memed)</option><option value="producao">Produção (receitas reais)</option>
            </select>
          </Campo>
          <Campo rotulo="CNES da clínica"><input inputMode="numeric" value={f.cnes ?? ""} onChange={(e) => setF({ ...f, cnes: e.target.value })} /></Campo>
          <Campo rotulo="Nome do local no receituário"><input value={f.nome_local ?? ""} onChange={(e) => setF({ ...f, nome_local: e.target.value })} placeholder="Consumed Clínica de Olhos" /></Campo>
        </div>
        <button className="primario" style={{ marginTop: 10 }} onClick={() => salvar()}>Salvar</button>
        <h3>Como passar para a produção</h3>
        <ol className="pequeno">
          <li>Testar no ambiente de <b>teste</b> (funciona de segunda a sexta, das 6h à meia-noite).</li>
          <li>Preencher na Memed a "Autorização para Credenciais de Produção" (site doc.memed.com.br → Obter credenciais).</li>
          <li>Cadastrar as chaves recebidas nos segredos do Supabase: <code>MEMED_API_KEY</code> e <code>MEMED_SECRET_KEY</code> (pelo painel; nunca por mensagem).</li>
          <li>Informar o CNES aqui e trocar o ambiente para <b>Produção</b>.</li>
        </ol>
      </div>
      <div className="painel">
        <h2>Médicos</h2>
        <p className="muted pequeno" style={{ marginTop: 0 }}>A Memed exige CPF, data de nascimento e CRM com UF de cada médico (preencha em Cadastros → Equipe). Com certificado digital, o médico assina a receita dentro da Memed; sem certificado, imprime e assina à mão.</p>
        <table className="tabela"><tbody>
          {(medicos.dados ?? []).map((m) => (
            <tr key={m.id}><td><b>{m.nome}</b></td><td>{m.falta.length ? <span style={{ color: "var(--alerta)" }}>falta {m.falta.join(", ")}</span> : <span style={{ color: "var(--sucesso)" }}>✓ pronto para a Memed</span>}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}
