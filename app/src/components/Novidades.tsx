// Avisos curtos de novidade, mostrados UMA vez a quem interessa (some ao clicar em "Entendi").
// Usa a mesma contagem de leituras do guia (tabela guia_leituras, migração 0160). Novidade nova = nova entrada na lista.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth, type Profissional } from "../lib/auth";

interface Novidade { id: string; para: (eu: Profissional | null) => boolean; texto: (nome: string) => React.ReactNode }

const NOVIDADES: Novidade[] = [
  {
    id: "novidade_whatsapp_enviei_errado", // 27/11/2026, pedido da dona (Alessandra mandou um arquivo errado)
    para: (eu) => !!eu?.orientacao_cirurgica,
    texto: (nome) => <>
      <b>🆕 Novidade, {nome}: mandou um arquivo errado no WhatsApp?</b> O WhatsApp oficial não deixa apagar, mas agora,
      embaixo da foto/áudio/documento que você enviou, tem o botão <b>“⚠️ Enviei errado”</b>: ele manda um aviso pedindo
      para o paciente desconsiderar, citando o arquivo. Depois é só mandar o certo pelo 📎. Em texto, o botão é
      <b> “✏️ Corrigir”</b>. Dica: confira o arquivo na pré-visualização antes de clicar em Enviar.
    </>,
  },
  {
    id: "novidade_mais_formas_pagamento", // 27/11/2026, pedido do Dr. Gelson
    para: (eu) => !!eu?.orientacao_cirurgica || eu?.funcao === "faturamento",
    texto: (nome) => <>
      <b>🆕 Novidade, {nome}: agora dá para registrar mais de uma forma de pagamento.</b> Se o paciente pagar, por exemplo,
      R$ 1.300 em dinheiro e R$ 900 no PIX, preencha a primeira forma e clique em <b>“➕ Pagou com mais de uma forma”</b> para
      acrescentar as outras — na <b>venda</b> e no <b>repasse</b>. Só a parte em dinheiro entra no caixa.
    </>,
  },
];

export function Novidades() {
  const { eu } = useAuth();
  const [pendentes, setPendentes] = useState<Novidade[]>([]);
  useEffect(() => {
    if (!eu) return;
    const minhas = NOVIDADES.filter((n) => n.para(eu));
    void Promise.all(minhas.map(async (n) => {
      const { data, error } = await supabase.rpc("guia_vezes", { p_guia: n.id, p_versao: 1 });
      return !error && Number(data ?? 0) === 0 ? n : null;
    })).then((r) => setPendentes(r.filter((x): x is Novidade => !!x)));
  }, [eu]);
  async function entendi(n: Novidade) {
    setPendentes((p) => p.filter((x) => x.id !== n.id));
    await supabase.rpc("guia_li", { p_guia: n.id, p_versao: 1 });
  }
  if (!pendentes.length) return null;
  const nome = (eu?.nome ?? "").split(" ")[0];
  return (
    <>
      {pendentes.map((n) => (
        <div key={n.id} className="painel nao-imprimir linha" style={{ background: "#e3f2fd", border: "2px solid #1565c0", marginBottom: 14, alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, lineHeight: 1.5 }}>{n.texto(nome)}</div>
          <button className="primario" onClick={() => entendi(n)}>Entendi</button>
        </div>
      ))}
    </>
  );
}
