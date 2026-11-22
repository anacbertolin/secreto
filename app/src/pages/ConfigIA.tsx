// Administração: liga/desliga o resumo do prontuário por IA (migração 0027)
import { useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Carregando } from "../components/ui";
import { fmtDataHora } from "../lib/util";

export default function ConfigIA() {
  const cfg = useCarregar(async () => ok(await supabase.from("ia_prontuario_config").select("*").eq("id", 1).single()) as { ligado: boolean; atualizado_em: string; ultima_execucao: string | null; ultimo_resumo_rodada: string | null }, []);
  const [erro, setErro] = useState("");
  async function mudar(ligado: boolean) {
    if (ligado && !confirm("Ligar o resumo por IA?\n\nO histórico clínico dos pacientes com consulta marcada (sem nome, CPF, telefone e endereço) passa a ser lido pela IA do plano do Claude da clínica (Anthropic, EUA) para preparar o resumo.\n\nConfirme que a clínica autorizou esse uso.")) return;
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
        {cfg.dados?.ultima_execucao && <Aviso tipo="info">Última rodada: {fmtDataHora(cfg.dados.ultima_execucao)} · {cfg.dados.ultimo_resumo_rodada}</Aviso>}
        <h3>Como funciona</h3>
        <ul>
          <li>Uma <b>tarefa agendada do plano do Claude</b> da clínica roda de hora em hora (6h às 19h, segunda a sábado) e prepara o resumo dos pacientes com consulta nas próximas horas, além dos pedidos feitos pelos médicos. Não usa chave de API.</li>
          <li>O médico ou a enfermagem abre <b>✨ Resumo (IA)</b> na ficha ou no atendimento e o resumo já está pronto. Se não houver, pode pedir.</li>
          <li><b>Não são enviados</b>: nome, CPF, telefone, endereço, nome da mãe. Números longos, e-mails e o nome que aparecer nos textos são apagados antes.</li>
          <li>São enviados: idade, sexo, alergias, medicamentos, diagnósticos, medidas (pressão do olho, visão, grau), exames, cirurgias e as anotações das consultas.</li>
          <li>O resumo fica guardado no sistema (só médico e enfermagem veem) e é refeito quando o prontuário muda. A auditoria registra cada resumo.</li>
          <li>Na conta do Claude usada pela tarefa, deixe desligado "Ajudar a melhorar o Claude".</li>
        </ul>
      </div>
    </div>
  );
}
