// Administração: liga/desliga o resumo do prontuário por IA (migração 0027)
import { useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { fmtDataHora } from "../lib/util";

export default function ConfigIA() {
  const cfg = useCarregar(async () => ok(await supabase.from("ia_prontuario_config").select("*").eq("id", 1).single()) as { ligado: boolean; atualizado_em: string }, []);
  const [erro, setErro] = useState("");
  async function mudar(ligado: boolean) {
    if (ligado && !confirm("Ligar o resumo por IA?\n\nAo usar, o histórico clínico do paciente (sem nome, CPF, telefone e endereço) é enviado à Anthropic (EUA) para gerar o resumo. Nada é guardado pela IA para treino.\n\nConfirme que a clínica autorizou esse uso.")) return;
    const { error } = await supabase.from("ia_prontuario_config").update({ ligado }).eq("id", 1);
    if (error) return setErro(msgErro(error));
    cfg.recarregar();
  }
  if (cfg.carregando && !cfg.dados) return <Carregando />;
  const ligado = !!cfg.dados?.ligado;
  return (
    <div>
      <div className="cabecalho"><div><h1>Inteligência artificial</h1><p className="sub" style={{ margin: 0 }}>Resumo do prontuário para o médico, antes da consulta.</p></div></div>
      <Aviso>{erro || cfg.erro}</Aviso>
      <div className="painel">
        <div className="linha entre">
          <div><h2 style={{ margin: 0 }}>✨ Resumo do prontuário por IA</h2><div className="muted pequeno">Situação: <b>{ligado ? "LIGADO" : "desligado"}</b>{cfg.dados?.atualizado_em && ` · alterado em ${fmtDataHora(cfg.dados.atualizado_em)}`}</div></div>
          {ligado ? <button onClick={() => mudar(false)}>Desligar</button> : <button className="primario" onClick={() => mudar(true)}>Ligar</button>}
        </div>
        <h3>Como funciona</h3>
        <ul>
          <li>O médico ou a enfermagem clica em <b>✨ Resumo (IA)</b> na ficha ou no atendimento.</li>
          <li>O sistema lê o histórico <b>com o login de quem pediu</b> (só o que essa pessoa já pode ver) e manda para a IA (Claude, da Anthropic).</li>
          <li><b>Não são enviados</b>: nome, CPF, telefone, endereço, nome da mãe. Números longos, e-mails e o nome que aparecer nos textos são apagados antes.</li>
          <li>São enviados: idade, sexo, alergias, medicamentos, diagnósticos, medidas (pressão do olho, visão, grau), exames, cirurgias e as anotações das consultas.</li>
          <li>O resumo aparece na tela e <b>não fica guardado</b>. A auditoria registra quem pediu e de qual paciente.</li>
          <li>Precisa da chave da IA (<code>ANTHROPIC_API_KEY</code>) nos segredos do Supabase, a mesma do assistente do WhatsApp.</li>
        </ul>
      </div>
    </div>
  );
}
