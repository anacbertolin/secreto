// DESATIVADA (15/11/2026) — decisão da dona: nada no sistema chama o Claude pela API.
// A análise das conversas do WhatsApp roda pela TAREFA AGENDADA do Claude, no plano da clínica
// (ver docs/sistema/assistente-tarefa-agendada.md e as funções whatsapp_extrator_* no banco, migração 0019).
// A versão antiga (que usava ANTHROPIC_API_KEY) está no histórico do git.
Deno.serve(() =>
  new Response(JSON.stringify({ erro: "Função desativada: a análise usa a tarefa agendada do Claude (plano da clínica)." }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
