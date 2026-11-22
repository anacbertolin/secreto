// Receita digital Memed dentro do atendimento (migração 0030 + função Edge memed-token).
// Segue a implementação de referência da Memed: script carregado UMA vez (id fixo), eventos registrados uma vez
// dentro de core:moduleInit, setWorkplace no início, setPaciente + module.show no clique, e as receitas
// emitidas/excluídas guardadas no sistema (exigência da Memed para liberar a produção).
import { useEffect, useState } from "react";
import { supabase, msgErro } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useCarregar, ok, Aviso, Etiqueta } from "../ui";
import { CLINICA } from "../../lib/marca";
import { fmtDataHora } from "../../lib/util";
import type { Ctx } from "./comum";

declare global {
  interface Window {
    // objetos globais criados pelo script da Memed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MdSinapsePrescricao?: any; MdHub?: any;
  }
}
const MODULO = "plataforma.prescricao";
const SCRIPT_ID = "memed-prescricao-script";

// Estado do módulo na página (o script é carregado uma única vez por sessão)
let pronto: Promise<void> | null = null;
let contexto: { atendimentoId: string; pacienteId: string; aoMudar: () => void } | null = null;

interface Cfg { ligado: boolean; cnes: string | null; nome_local: string | null }
interface Linha { id: string; memed_id: string; emitida_em: string; itens: { nome: string; posologia?: string; receituario?: string }[]; assinada: boolean; excluida: boolean }

function carregar(token: string, script: string, cfg: Cfg): Promise<void> {
  if (pronto) return pronto;
  pronto = new Promise<void>((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) return resolve();
    const s = document.createElement("script");
    s.id = SCRIPT_ID; s.type = "text/javascript"; s.src = script; s.setAttribute("data-token", token);
    s.addEventListener("error", () => { pronto = null; reject(new Error("Não foi possível carregar a Memed.")); });
    s.addEventListener("load", () => {
      window.MdSinapsePrescricao.event.add("core:moduleInit", async (mod: { name: string }) => {
        if (mod.name !== MODULO) return;
        // eventos de negócio: guardar a receita emitida / marcar a excluída (registrados uma única vez)
        window.MdHub.event.add("prescricaoImpressa", async (dados: { prescricao?: Record<string, unknown>; reprint?: boolean }) => {
          const p = (dados?.prescricao ?? dados) as Record<string, unknown>;
          if (!contexto || !p?.id) return;
          const meds = ((p.medicamentos as Record<string, unknown>[]) ?? []).map((m) => ({
            nome: m.nome ?? m.titulo, posologia: m.sanitized_posology ?? m.posologia, quantidade: m.quantidade, receituario: m.receituario, tipo: m.tipo,
          }));
          await supabase.from("memed_prescricoes").upsert({
            memed_id: String(p.id), paciente_id: contexto.pacienteId, atendimento_id: contexto.atendimentoId,
            itens: meds, assinada: !!p.signed, reimpressao: !!(dados?.reprint ?? p.reprint),
          }, { onConflict: "memed_id", ignoreDuplicates: true });
          contexto.aoMudar();
        });
        window.MdHub.event.add("prescricaoExcluida", async (id: unknown) => {
          const memedId = String((id as { id?: unknown })?.id ?? id);
          await supabase.from("memed_prescricoes").update({ excluida: true, excluida_em: new Date().toISOString() }).eq("memed_id", memedId);
          contexto?.aoMudar();
        });
        await window.MdHub.command.send(MODULO, "setWorkplace", {
          local_name: cfg.nome_local || CLINICA.nome, cnes: cfg.cnes || undefined,
          address: CLINICA.endereco, phone: CLINICA.telefone, city: "Nova Iguaçu", state: "RJ",
        });
        resolve();
      });
    });
    document.head.appendChild(s);
  });
  return pronto;
}

async function erroDaFuncao(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  try { const j = await ctx?.json(); if (j?.erro) return j.erro; } catch { /* sem corpo */ }
  return "Não foi possível abrir a Memed agora.";
}

export function PrescricaoMemed({ ctx }: { ctx: Ctx }) {
  const { eu } = useAuth();
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState("");
  const cfg = useCarregar(async () => ok(await supabase.from("memed_config").select("ligado, cnes, nome_local").eq("id", 1).maybeSingle()) as Cfg | null, []);
  const lista = useCarregar(async () => ok(await supabase.from("memed_prescricoes").select("*").eq("atendimento_id", ctx.atend.id).order("emitida_em", { ascending: false })) as Linha[], [ctx.atend.id]);
  useEffect(() => () => { if (contexto?.atendimentoId === ctx.atend.id) contexto = null; }, [ctx.atend.id]);

  if (!cfg.dados?.ligado) return null;
  const podePrescrever = ctx.editaMedico && eu?.funcao === "medico";

  async function abrir() {
    setErro(""); setAbrindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("memed-token", { body: {} });
      if (error) throw new Error(await erroDaFuncao(error));
      await carregar(data.token, data.script, cfg.dados!);
      const { data: p } = await supabase.from("pacientes")
        .select("id, nome, nome_social, cpf, data_nascimento, sexo, telefone, email, nome_mae, logradouro, numero, bairro, cidade").eq("id", ctx.atend.paciente_id).single();
      contexto = { atendimentoId: ctx.atend.id, pacienteId: ctx.atend.paciente_id, aoMudar: lista.recarregar };
      const nasc = p?.data_nascimento ? p.data_nascimento.split("-").reverse().join("/") : undefined;
      await window.MdHub.command.send(MODULO, "setPaciente", {
        idExterno: p!.id, nome: p!.nome, nome_social: p!.nome_social || undefined,
        sexo: p!.sexo === "feminino" ? "Feminino" : p!.sexo === "masculino" ? "Masculino" : undefined,
        cpf: p!.cpf || undefined, data_nascimento: nasc, telefone: p!.telefone || undefined, email: p!.email || undefined,
        nome_mae: p!.nome_mae || undefined, cidade: p!.cidade || undefined,
        endereco: [p!.logradouro, p!.numero, p!.bairro].filter(Boolean).join(", ") || undefined,
      });
      await window.MdHub.module.show(MODULO);
    } catch (e) {
      setErro(e instanceof Error ? e.message : msgErro(e));
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <div className="secao" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 6px" }}>
        <span>💊 Receita digital (Memed)</span>
        {podePrescrever && <button className="primario" disabled={abrindo} onClick={abrir}>{abrindo ? "Abrindo…" : "Prescrever na Memed"}</button>}
      </h3>
      <p className="muted pequeno" style={{ marginTop: 0 }}>
        Receita com validade jurídica: com certificado digital o médico assina na própria Memed e o paciente recebe por SMS/WhatsApp; sem certificado, imprime e assina à mão.
      </p>
      <Aviso>{erro || cfg.erro || lista.erro}</Aviso>
      {(lista.dados ?? []).map((r) => (
        <div key={r.id} className="linha entre" style={{ padding: "6px 0", borderTop: "1px solid #f0f2f4", opacity: r.excluida ? 0.5 : 1 }}>
          <div>
            <b>{fmtDataHora(r.emitida_em)}</b> · {r.itens.map((i) => i.nome).filter(Boolean).join(", ") || "receita"}
          </div>
          <div className="linha">
            {r.assinada && <Etiqueta cor="verde">assinada</Etiqueta>}
            {r.excluida && <Etiqueta cor="cinza">excluída na Memed</Etiqueta>}
          </div>
        </div>
      ))}
    </div>
  );
}
