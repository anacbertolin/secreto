// "Vigia" do recebimento do WhatsApp (pedido da dona, 25/11/2026; migração 0103).
// O número da Orientação Cirúrgica está só na API oficial — não há celular para conferir. Se a entrega da Meta para
// o sistema (webhook) parar, esta faixa avisa: conta o tempo sem nenhum sinal (mensagem recebida ou confirmação ✓✓)
// apenas DENTRO do horário de atendimento (o mesmo da resposta "Fora do horário") e fica amarela/vermelha.
// O botão "Testar recebimento" espera uma mensagem mandada de qualquer celular e mostra se chegou.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCarregar, Modal } from "./ui";
import type { SetorWA } from "../lib/whatsapp";

interface Sinais { ultimo_recebido: string | null; ultimo_status: string | null; sem_confirmacao: number; confirmadas_3h: number }
type Horarios = Record<string, [string, string]>;

const NUMERO_SETOR: Record<SetorWA, string> = { orientacao: "(21) 96724-7984", clinica: "da clínica" };
const ATENCAO_MIN = 60;   // amarelo
const ALERTA_MIN = 120;   // vermelho

const HORARIO_PADRAO: Horarios = {
  1: ["08:00", "17:00"], 2: ["08:00", "17:00"], 3: ["08:00", "17:00"], 4: ["08:00", "17:00"], 5: ["08:00", "17:00"], 6: ["08:00", "12:00"],
} as unknown as Horarios;

/** Minutos de atendimento (horário da clínica, fuso de Brasília, sem horário de verão) entre duas datas */
function minutosUteis(de: Date, ate: Date, h: Horarios): number {
  let total = 0;
  const passo = 5 * 60000;
  const ini = Math.max(de.getTime(), ate.getTime() - 14 * 86400000); // olha no máximo 14 dias
  for (let t = ini; t < ate.getTime(); t += passo) {
    const local = new Date(t - 3 * 3600000); // Brasília = UTC−3
    const dia = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
    const faixa = h[String(dia)];
    if (!faixa) continue;
    const hm = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
    if (hm >= faixa[0] && hm < faixa[1]) total += 5;
  }
  return total;
}

function fmtHa(d: string | null): string {
  if (!d) return "nunca";
  const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h${min % 60 ? ` ${String(min % 60).padStart(2, "0")}` : ""}`;
  return `há ${Math.floor(h / 24)} dias`;
}

function avaliar(s: Sinais | undefined, h: Horarios) {
  if (!s) return { nivel: "ok" as const, texto: "Conferindo o recebimento…", util: 0, ultimo: null as string | null };
  const ultimo = [s.ultimo_recebido, s.ultimo_status].filter(Boolean).sort().pop() ?? null;
  const util = ultimo ? minutosUteis(new Date(ultimo), new Date(), h) : 9999;
  // Mensagens enviadas sem nenhuma confirmação de entrega, enquanto antes vinham: as confirmações pararam de chegar
  const confirmacoesPararam = s.sem_confirmacao >= 3 && s.confirmadas_3h === 0;
  if (util >= ALERTA_MIN || confirmacoesPararam) {
    return {
      nivel: "alerta" as const, util, ultimo,
      texto: confirmacoesPararam
        ? `As confirmações de entrega (✓✓) pararam de chegar: ${s.sem_confirmacao} mensagens enviadas sem confirmação.`
        : `Nada chegou há ${Math.round(util / 60)} h de expediente`,
    };
  }
  if (util >= ATENCAO_MIN) return { nivel: "atencao" as const, util, ultimo, texto: `Sem mensagens há ${util} min de expediente` };
  return { nivel: "ok" as const, util, ultimo, texto: `Recebendo · última ${fmtHa(s.ultimo_recebido)}` };
}

export function VigiaWhatsApp({ setor }: { setor: SetorWA }) {
  const sinais = useCarregar(async () => {
    const { data } = await supabase.rpc("whatsapp_vigia", { p_setor: setor });
    return ((data as Sinais[] | null)?.[0]) ?? { ultimo_recebido: null, ultimo_status: null, sem_confirmacao: 0, confirmadas_3h: 0 };
  }, [setor]);
  const horarios = useCarregar(async () => {
    const { data } = await supabase.from("whatsapp_ausencia").select("horarios").eq("setor", setor).maybeSingle();
    return ((data?.horarios as Horarios) ?? HORARIO_PADRAO);
  }, [setor]);
  const [aberto, setAberto] = useState(false);
  const [, setTique] = useState(0);

  // Atualiza a cada minuto e na hora em que chega mensagem
  useEffect(() => {
    const t = window.setInterval(() => { sinais.recarregar(); setTique((x) => x + 1); }, 60000);
    const canal = supabase.channel("vigia-" + setor)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensagens" }, () => sinais.recarregar())
      .subscribe();
    return () => { window.clearInterval(t); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setor]);

  const a = avaliar(sinais.dados ?? undefined, horarios.dados ?? HORARIO_PADRAO);
  const icone = a.nivel === "alerta" ? "🔴" : a.nivel === "atencao" ? "🟡" : "🟢";
  return (
    <>
      <button className={"vigia vigia-" + a.nivel} onClick={() => setAberto(true)} title="Vigia do recebimento: clique para detalhes e para testar">
        <span>{icone}</span>
        <span className="vigia-texto">{a.texto}</span>
        {a.nivel !== "ok" && <b className="vigia-acao">Testar</b>}
      </button>
      {aberto && (
        <TesteRecebimento setor={setor} sinais={sinais.dados ?? undefined} avaliacao={a}
          aoFechar={() => { setAberto(false); sinais.recarregar(); }} />
      )}
    </>
  );
}

function TesteRecebimento(props: {
  setor: SetorWA; sinais?: Sinais; avaliacao: ReturnType<typeof avaliar>; aoFechar: () => void;
}) {
  const [inicio, setInicio] = useState<Date | null>(null);
  const [chegou, setChegou] = useState<number | null>(null);
  const [esgotou, setEsgotou] = useState(false);
  const [, setTique] = useState(0);

  useEffect(() => {
    if (!inicio || chegou !== null) return;
    const verificar = async () => {
      const { data } = await supabase.rpc("whatsapp_vigia", { p_setor: props.setor });
      const ult = (data as Sinais[] | null)?.[0]?.ultimo_recebido;
      if (ult && new Date(ult).getTime() >= inicio.getTime() - 2000) setChegou(Math.max(1, Math.round((new Date(ult).getTime() - inicio.getTime()) / 1000)));
      else if (Date.now() - inicio.getTime() > 3 * 60000) setEsgotou(true);
      setTique((x) => x + 1);
    };
    const t = window.setInterval(() => void verificar(), 3000);
    return () => window.clearInterval(t);
  }, [inicio, chegou, props.setor]);

  const s = props.sinais;
  const espera = inicio ? Math.round((Date.now() - inicio.getTime()) / 1000) : 0;
  return (
    <Modal titulo="📶 Vigia do recebimento" aoFechar={props.aoFechar} rodape={<button onClick={props.aoFechar}>Fechar</button>}>
      <div className={"vigia vigia-" + props.avaliacao.nivel} style={{ cursor: "default", maxWidth: "none", margin: 0 }}>{props.avaliacao.texto}</div>
      <dl className="vigia-dados">
        <dt>Última mensagem recebida</dt><dd>{s?.ultimo_recebido ? `${new Date(s.ultimo_recebido).toLocaleString("pt-BR")} (${fmtHa(s.ultimo_recebido)})` : "—"}</dd>
        <dt>Última confirmação ✓✓</dt><dd>{s?.ultimo_status ? `${new Date(s.ultimo_status).toLocaleString("pt-BR")} (${fmtHa(s.ultimo_status)})` : "—"}</dd>
        <dt>Enviadas sem ✓✓ (3 h)</dt><dd>{s?.sem_confirmacao ?? 0}</dd>
      </dl>
      <p className="pequeno muted">
        O alerta só conta o tempo dentro do horário de atendimento (o mesmo do “🌙 Fora do horário”). Fica amarelo com
        1 h sem nenhuma mensagem e vermelho com 2 h — pode ser só um período calmo, por isso existe o teste abaixo.
      </p>

      <h3 style={{ marginBottom: 6 }}>Testar agora</h3>
      {!inicio ? (
        <>
          <p style={{ marginTop: 0 }}>
            1. Clique em <b>Começar o teste</b>.<br />
            2. De qualquer celular, mande uma mensagem (por exemplo, “teste”) para o WhatsApp <b>{NUMERO_SETOR[props.setor]}</b>.<br />
            3. Esta janela mostra se ela chegou ao sistema.
          </p>
          <button className="primario" onClick={() => { setInicio(new Date()); setChegou(null); setEsgotou(false); }}>Começar o teste</button>
        </>
      ) : chegou !== null ? (
        <div className="aviso ok">✅ <b>Chegou!</b> A mensagem apareceu no sistema {chegou <= 60 ? `${chegou} s` : `${Math.round(chegou / 60)} min`} depois de começar o teste. O recebimento está funcionando.</div>
      ) : esgotou ? (
        <div className="aviso erro">
          ❌ <b>Nenhuma mensagem chegou em 3 minutos.</b> Confira se mandou para o número certo ({NUMERO_SETOR[props.setor]}).
          Se mandou e não chegou, a entrega da Meta para o sistema pode ter parado: avise a administração / o Claude para
          conferir o webhook no painel da Meta. As mensagens não se perdem — a Meta tenta entregar de novo por até 7 dias.
          <div style={{ marginTop: 8 }}><button onClick={() => { setInicio(new Date()); setEsgotou(false); }}>Tentar de novo</button></div>
        </div>
      ) : (
        <div className="aviso info">⏳ Esperando a mensagem chegar… ({espera} s). Mande agora uma mensagem para {NUMERO_SETOR[props.setor]}.</div>
      )}
    </Modal>
  );
}
