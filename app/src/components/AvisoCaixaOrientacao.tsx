// Avisos do caixa da Orientação Cirúrgica (pedido do Dr. Gelson, 26/11/2026), para quem atende a Orientação:
//  * a partir das 17h, com o caixa de hoje aberto → faixa amarela "não esqueça de fechar";
//  * caixa de um dia anterior ainda aberto → faixa vermelha "feche primeiro";
//  * ao fechar → mensagem verde (MensagemCaixaFechado, usada na tela do caixa).
// Quem confere vem do cadastro (Equipe → "confere o caixa").
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCarregar, ok } from "./ui";
import { fmtData, isoDia } from "../lib/util";

const HORA_AVISO = 17;
const primeiroNome = (n: string) => n.split(" ")[0];
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });

/** "pelo **Luciano** quando ele voltar, ou por **Andrea**, **Soraline** ou **Luana**" */
function QuemConfere({ nomes }: { nomes: string[] }) {
  const luciano = nomes.find((n) => /^luciano/i.test(n));
  const outros = nomes.filter((n) => n !== luciano);
  const lista = (ns: string[]) => ns.map((n, i) => <span key={n}>{i > 0 && (i === ns.length - 1 ? " ou " : ", ")}<b>{n}</b></span>);
  if (!nomes.length) return <>por quem confere o caixa</>;
  return luciano
    ? <>pelo <b>{luciano}</b> quando ele voltar{outros.length > 0 && <>, ou por {lista(outros)}</>}</>
    : <>por {lista(nomes)}</>;
}

function useConferentes() {
  const { eu } = useAuth();
  const { dados } = useCarregar(async () => (ok(await supabase.from("profissionais").select("id, nome").eq("caixa_conferir", true).eq("ativo", true).order("nome")) as { id: string; nome: string }[]), []);
  return (dados ?? []).filter((p) => p.id !== eu?.id).map((p) => primeiroNome(p.nome));
}

export function AvisoCaixaOrientacao() {
  const { eu } = useAuth();
  const ativo = !!eu?.orientacao_cirurgica;
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60000); return () => clearInterval(t); }, []);
  const { dados: aberto } = useCarregar(async () => ativo
    ? ((ok(await supabase.from("caixas").select("id, data").eq("setor", "orientacao").eq("status", "aberto").limit(1)) as { id: string; data: string }[])[0] ?? null)
    : null, [ativo]);
  const conferentes = useConferentes();
  if (!ativo || !aberto) return null;
  const nome = primeiroNome(eu?.nome ?? "");
  const hoje = isoDia(agora);

  if (aberto.data < hoje) return (
    <div className="painel" style={{ background: "#fdecea", border: "2px solid #c62828", marginBottom: 14 }}>
      <div style={{ fontSize: "1.1rem" }}>⚠️ <b>{nome}, o caixa da Orientação de {diaSemana(aberto.data)} ({fmtData(aberto.data)}) ficou aberto.</b></div>
      <p style={{ margin: "8px 0 4px" }}><b>Antes de começar o dia, feche esse caixa:</b></p>
      <ol style={{ margin: "0 0 8px", paddingLeft: 20 }}>
        <li>Clique em <b>“Ir para o caixa de {diaSemana(aberto.data)}”</b>.</li>
        <li>Conte o dinheiro que está na gaveta e clique em <b>“Fechar caixa”</b>.</li>
        <li>Depois abra o caixa de hoje normalmente.</li>
      </ol>
      <p style={{ margin: "0 0 8px" }}><b>Atenção:</b> enquanto o caixa de {diaSemana(aberto.data)} estiver aberto, as vendas em dinheiro de hoje entram <b>no caixa de {diaSemana(aberto.data)}</b>, misturando o dinheiro dos dois dias — por isso feche primeiro.</p>
      <p style={{ margin: "0 0 10px" }}>A conferência do caixa de {diaSemana(aberto.data)} continua <QuemConfere nomes={conferentes} />.</p>
      <Link to={`/caixa/${aberto.id}`}><button className="primario">📂 Ir para o caixa de {diaSemana(aberto.data)}</button></Link>
    </div>
  );

  if (agora.getHours() < HORA_AVISO) return null;
  return (
    <div className="painel" style={{ background: "#fff8e1", border: "2px solid #f9a825", marginBottom: 14 }}>
      <div style={{ fontSize: "1.1rem" }}>⏰ <b>{nome}, não esqueça de fechar o caixa da Orientação antes de ir embora.</b></div>
      <p style={{ margin: "8px 0 4px" }}>Para fechar: conte o dinheiro da gaveta, digite o valor e clique em <b>“Fechar caixa”</b>.</p>
      <p style={{ margin: "0 0 4px" }}><b>Por que fechar hoje?</b> O sistema só deixa ter um caixa da Orientação aberto por vez. Se este ficar aberto, no próximo dia você <b>não consegue abrir um caixa novo</b>.</p>
      <p style={{ margin: "0 0 10px" }}><b>O Luciano não está hoje? Não tem problema.</b> Você fecha normalmente e o caixa fica guardado esperando a conferência — que pode ser feita <QuemConfere nomes={conferentes} />. Você não precisa esperar ninguém para ir embora.</p>
      <Link to={`/caixa/${aberto.id}`}><button className="primario">💵 Fechar caixa agora</button></Link>
    </div>
  );
}

/** Mostrada na tela do caixa da Orientação logo depois de fechar. */
export function MensagemCaixaFechado({ data }: { data: string }) {
  const { eu } = useAuth();
  const conferentes = useConferentes();
  return (
    <div className="painel" style={{ background: "#e8f5e9", border: "2px solid #2e7d32", marginBottom: 14 }}>
      <div style={{ fontSize: "1.1rem" }}>✅ <b>Pronto, {primeiroNome(eu?.nome ?? "")}! O caixa de {diaSemana(data)} ({fmtData(data)}) está fechado.</b></div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.5 }}>
        <li><b>O que acontece agora:</b> o caixa fica <b>“Fechado · aguardando conferência”</b> e ninguém consegue mais mexer nele.</li>
        <li><b>Quem confere:</b> <QuemConfere nomes={conferentes} />. Você não pode conferir o seu próprio caixa — isso é normal.</li>
        <li><b>No próximo dia:</b> é só clicar em <b>“Abrir caixa”</b> como sempre. Este caixa continua esperando a conferência, sem atrapalhar.</li>
        <li><b>Se alguém encontrar um erro:</b> quem conferir devolve o caixa para correção e você vai ver o aviso com o motivo.</li>
      </ul>
    </div>
  );
}
