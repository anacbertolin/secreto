import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok, Aviso, Carregando, Etiqueta } from "../components/ui";
import { HistoricoSaude } from "../components/Clinico";
import { BarraFluxoAtendimento } from "../components/Fluxo";
import { EvolucaoPaciente } from "../components/Evolucao";
import { BotaoProtocolo } from "../components/Protocolos";
import { BotaoResumoIA } from "../components/ResumoIA";
import { DesenhoOlhos } from "../components/pep/Desenho";
import { PrescricaoMemed } from "../components/pep/Memed";
import type { AtendimentoCompleto, Ctx } from "../components/pep/comum";
import { CamposAtendimento, PreConsulta, Refracao, ExameOftalmologico } from "../components/pep/SecoesExame";
import { Diagnosticos, ReceitaOculos, ReceitaMedicamentos, PedidosExame, Documentos, Adendos } from "../components/pep/SecoesConduta";
import { TIPOS_AGENDA, fmtCPF, fmtData, fmtDataHora, idade, nomeExibicao } from "../lib/util";

const ABAS = [
  ["pre", "Pré-consulta"], ["anamnese", "Anamnese"], ["refracao", "Refração"], ["exame", "Exame"], ["desenho", "Desenho"],
  ["diagnostico", "Diagnóstico"], ["conduta", "Conduta"], ["receitas", "Receitas"], ["pedidos", "Pedidos de exame"],
  ["documentos", "Atestados e documentos"],
] as const;

interface Pac { id: string; nome: string; nome_social: string | null; numero_prontuario: number; data_nascimento: string | null; cpf: string | null; sexo: string }

export default function Atendimento() {
  const { id } = useParams();
  const { eu } = useAuth();
  const nav = useNavigate();
  const [aba, setAba] = useState<string>(eu?.funcao === "enfermagem" ? "pre" : "anamnese");
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0); // muda depois de aplicar um protocolo, para as abas recarregarem
  const protocoloAplicado = useRef(false);

  const { dados, erro: erroCarga, carregando, recarregar } = useCarregar(async () => {
    const a = ok(await supabase.from("atendimentos").select("*").eq("id", id!).single()) as AtendimentoCompleto;
    const [p, m] = await Promise.all([
      supabase.from("pacientes").select("id, nome, nome_social, numero_prontuario, data_nascimento, cpf, sexo").eq("id", a.paciente_id).single(),
      supabase.from("profissionais").select("nome").eq("id", a.profissional_id).single(),
    ]);
    return { atend: a, pac: ok(p) as Pac, medico: (ok(m) as { nome: string }).nome };
  }, [id]);

  // depois de aplicar um protocolo, espera o atendimento atualizado chegar e então recarrega as abas
  useEffect(() => {
    if (dados && protocoloAplicado.current) { protocoloAplicado.current = false; setVersao((v) => v + 1); }
  }, [dados]);

  useEffect(() => {
    if (dados) supabase.rpc("registrar_leitura", { p_paciente_id: dados.pac.id, p_detalhes: `Abriu o atendimento ${dados.atend.id}` }).then(() => {});
  }, [dados]);

  if (carregando && !dados) return <Carregando />;
  if (!dados) return <Aviso>{erroCarga || "Atendimento não encontrado."}</Aviso>;

  const { atend, pac } = dados;
  const aberto = atend.status === "em_andamento";
  const souResponsavel = eu?.id === atend.profissional_id;
  const ctx: Ctx = {
    atend,
    editaMedico: aberto && souResponsavel && eu?.funcao === "medico",
    editaClinico: aberto && (eu?.funcao === "medico" || eu?.funcao === "enfermagem"),
    recarregar,
  };

  async function finalizar() {
    setErro("");
    const { count } = await supabase.from("diagnosticos").select("id", { count: "exact", head: true }).eq("atendimento_id", atend.id);
    const aviso = count ? "" : "\n\nAtenção: nenhum diagnóstico (CID) foi lançado.";
    if (!confirm(`Finalizar o atendimento?\n\nDepois de finalizado, nada poderá ser alterado — só complementado por adendo. Confira se salvou todas as abas.${aviso}`)) return;
    const { error } = await supabase.from("atendimentos").update({ status: "finalizado" }).eq("id", atend.id);
    if (error) return setErro(msgErro(error));
    recarregar();
  }

  return (
    <div>
      <div className="cabecalho">
        <div>
          <div className="linha">
            <h1 style={{ margin: 0 }}>{nomeExibicao(pac)}</h1>
            {aberto ? <Etiqueta cor="amarelo">Em andamento</Etiqueta> : <Etiqueta cor="verde">Finalizado {fmtDataHora(atend.finalizado_em)}</Etiqueta>}
          </div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            Pront. {pac.numero_prontuario}{pac.data_nascimento && ` · ${idade(pac.data_nascimento)} (${fmtData(pac.data_nascimento)})`}
            {pac.cpf && ` · CPF ${fmtCPF(pac.cpf)}`} · {TIPOS_AGENDA[atend.tipo]} de {fmtDataHora(atend.inicio)} · {dados.medico}
          </p>
        </div>
        <div className="linha">
          <Link className="botao" to={`/pacientes/${pac.id}`}>📁 Histórico do paciente</Link>
          <BotaoResumoIA pacienteId={pac.id} />
          {ctx.editaMedico && <BotaoProtocolo atendId={atend.id} pacienteId={pac.id} aoAplicar={() => { protocoloAplicado.current = true; recarregar(); }} />}
          {ctx.editaMedico && <button className="primario" onClick={finalizar}>✅ Finalizar atendimento</button>}
          {aberto && !souResponsavel && eu?.funcao === "enfermagem" && <button onClick={() => nav("/consultorio")}>Concluir pré-consulta</button>}
        </div>
      </div>
      <Aviso>{erro}</Aviso>
      {aberto && !ctx.editaMedico && eu?.funcao === "medico" && <Aviso tipo="info">Este atendimento é de outro médico: você pode consultar e preencher pré-consulta e refração.</Aviso>}
      {aberto && eu?.funcao === "enfermagem" && <Aviso tipo="info">Preencha a <b>pré-consulta</b> e a <b>refração</b>. As demais abas são preenchidas pelo médico.</Aviso>}

      {aberto && atend.agendamento_id && <BarraFluxoAtendimento agendamentoId={atend.agendamento_id} />}

      <div className="pep">
        <div className="painel resumo-pac">
          <h2>Saúde do paciente</h2>
          <HistoricoSaude pacienteId={pac.id} />
        </div>
        <div className="painel">
          <div className="abas">
            {ABAS.map(([k, r]) => <button key={k} className={aba === k ? "ativa" : ""} onClick={() => setAba(k)}>{r}</button>)}
            <button className={aba === "evolucao" ? "ativa" : ""} onClick={() => setAba("evolucao")}>📈 Evolução</button>
            {!aberto && <button className={aba === "adendos" ? "ativa" : ""} onClick={() => setAba("adendos")}>Adendos</button>}
          </div>
          <div key={versao}>
          {aba === "evolucao" && <EvolucaoPaciente pacienteId={pac.id} />}
          {aba === "pre" && <PreConsulta ctx={ctx} />}
          {aba === "anamnese" && (
            <CamposAtendimento ctx={ctx} campos={[
              { k: "queixa_principal", rotulo: "Queixa principal", linhas: 2, tipoModelo: "anamnese" },
              { k: "historia_doenca_atual", rotulo: "História da doença atual", linhas: 5, tipoModelo: "anamnese" },
              { k: "revisao_sistemas", rotulo: "Revisão de sistemas / outras informações", linhas: 3 },
            ]} />
          )}
          {aba === "refracao" && <Refracao ctx={ctx} />}
          {aba === "exame" && <ExameOftalmologico ctx={ctx} />}
          {aba === "desenho" && <DesenhoOlhos ctx={ctx} />}
          {aba === "diagnostico" && <Diagnosticos ctx={ctx} />}
          {aba === "conduta" && (
            <CamposAtendimento ctx={ctx} campos={[
              { k: "conduta", rotulo: "Conduta", linhas: 4, tipoModelo: "conduta" },
              { k: "orientacoes", rotulo: "Orientações ao paciente", linhas: 3, tipoModelo: "orientacoes" },
              { k: "retorno_em", rotulo: "Retorno", curto: true },
            ]} />
          )}
          {aba === "receitas" && (
            <>
              <h2>Óculos</h2>
              <ReceitaOculos ctx={ctx} />
              <h2 style={{ marginTop: 24 }}>Medicamentos</h2>
              <PrescricaoMemed ctx={ctx} />
              <ReceitaMedicamentos ctx={ctx} />
            </>
          )}
          {aba === "pedidos" && <PedidosExame ctx={ctx} />}
          {aba === "documentos" && <Documentos ctx={ctx} />}
          {aba === "adendos" && <Adendos ctx={ctx} podeEscrever={eu?.funcao === "medico" || eu?.funcao === "enfermagem"} />}
          </div>
        </div>
      </div>
    </div>
  );
}
