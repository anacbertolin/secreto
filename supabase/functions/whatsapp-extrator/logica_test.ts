// Testes das regras puras do extrator:  deno test supabase/functions/whatsapp-extrator/logica_test.ts
import {
  encaixeNoHorario, horaLocalParaData, mascarar, medirTempos, mesmoNome, partesSP, telefoneCadastro, transcrever,
  type Mensagem,
} from "./logica.ts";

function igual(a: unknown, b: unknown, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}\n  esperado: ${JSON.stringify(b)}\n  veio:     ${JSON.stringify(a)}`);
}

Deno.test("mascarar dados pessoais", () => {
  igual(mascarar("meu cpf é 123.456.789-00"), "meu cpf é [CPF]");
  igual(mascarar("cpf 12345678900 ok"), "cpf [CPF] ok");
  igual(mascarar("liga no (21) 99876-5432 por favor"), "liga no [número] por favor");
  igual(mascarar("carteirinha 0 123 456789 0001"), "carteirinha [número]");
  igual(mascarar("email maria.silva@gmail.com"), "email [e-mail]");
  // datas e horários continuam
  igual(mascarar("pode ser dia 20/11/2026 às 14:30?"), "pode ser dia 20/11/2026 às 14:30?");
  igual(mascarar("tenho 2 filhos de 10 e 12 anos"), "tenho 2 filhos de 10 e 12 anos");
});

const m = (direcao: "recebida" | "enviada", quando: string, enviado_por: string | null = null, texto = "oi"): Mensagem => ({
  id: quando, direcao, tipo: "texto", texto, modelo: null, midia_nome: null, enviado_por, quando,
});

Deno.test("tempo de resposta", () => {
  const t = medirTempos([
    m("recebida", "2026-11-16T12:00:00Z"),
    m("recebida", "2026-11-16T12:01:00Z"),
    m("enviada", "2026-11-16T12:05:00Z", "a1"), // 5 min
    m("recebida", "2026-11-16T12:06:00Z"),
    m("enviada", "2026-11-16T12:07:00Z", null), // automática não conta
    m("enviada", "2026-11-16T12:16:00Z", "a1"), // 10 min
  ]);
  igual(t, { primeira_resposta_seg: 300, resposta_media_seg: 450, maior_espera_seg: 600, sem_resposta: false });
  const s = medirTempos([m("recebida", "2026-11-16T12:00:00Z")]);
  igual(s, { primeira_resposta_seg: null, resposta_media_seg: null, maior_espera_seg: null, sem_resposta: true });
});

Deno.test("hora de Brasília", () => {
  const d = horaLocalParaData("2026-11-20T14:30")!;
  igual(d.toISOString(), "2026-11-20T17:30:00.000Z");
  igual(partesSP(d), { dia: "2026-11-20", diaSemana: 5, minutos: 14 * 60 + 30 });
  igual(horaLocalParaData("20/11 14h"), null);
  igual(partesSP(new Date("2026-11-21T01:00:00Z")).dia, "2026-11-20"); // 22h de sexta em SP
});

Deno.test("encaixe no horário do médico", () => {
  const h = [
    { dia_semana: 5, hora_inicio: "08:00:00", hora_fim: "12:00:00", duracao_min: 20, local_id: "sala1", vigente_de: null, vigente_ate: null },
    { dia_semana: 1, hora_inicio: "13:00:00", hora_fim: "18:00:00", duracao_min: 15, local_id: null, vigente_de: "2027-01-01", vigente_ate: null },
  ];
  igual(encaixeNoHorario(horaLocalParaData("2026-11-20T08:00")!, h)?.local_id, "sala1");
  igual(encaixeNoHorario(horaLocalParaData("2026-11-20T11:40")!, h)?.local_id, "sala1"); // 11:40 + 20 = 12:00
  igual(encaixeNoHorario(horaLocalParaData("2026-11-20T11:45")!, h), null); // passaria do fim
  igual(encaixeNoHorario(horaLocalParaData("2026-11-20T14:00")!, h), null); // sexta à tarde não atende
  igual(encaixeNoHorario(horaLocalParaData("2026-11-23T14:00")!, h), null); // segunda: só a partir de 2027
});

Deno.test("nomes", () => {
  igual(mesmoNome("Maria José da Silva", "MARIA JOSE DA SILVA"), true);
  igual(mesmoNome("Maria Silva", "MARIA JOSE DA SILVA"), true); // primeiro + último
  igual(mesmoNome("Maria", "MARIA JOSE DA SILVA"), false);
  igual(mesmoNome("João Souza", "JOANA SOUZA"), false);
});

Deno.test("telefone e transcrição", () => {
  igual(telefoneCadastro("5521998765432"), "21998765432");
  const t = transcrever([
    m("recebida", "2026-11-16T12:00:00Z", null, "quero marcar, meu cpf 123.456.789-00"),
    m("enviada", "2026-11-16T12:05:00Z", "uuid-1", "Claro!"),
  ], new Map([["uuid-1", "Atendente 1"]]));
  if (!t.includes("PACIENTE: quero marcar, meu cpf [CPF]") || !t.includes("CLÍNICA (Atendente 1): Claro!")) throw new Error(t);
});
