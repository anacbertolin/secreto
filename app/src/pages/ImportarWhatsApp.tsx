import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import JSZip from "jszip";
import { supabase, msgErro } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Aviso, BuscaPaciente, Campo, Etiqueta, type PacienteResumo } from "../components/ui";
import { fmtData, fmtTelefone, nomeExibicao } from "../lib/util";
import { podeResponderSetor, type SetorWA } from "../lib/whatsapp";
import { codigoMensagem, lerExportacao, numeroDoAutor, tipoDoArquivo, type ConversaExportada } from "../lib/whatsappExport";

interface Item {
  chave: string;
  arquivo: string;                    // nome do arquivo escolhido
  conversa: ConversaExportada;
  midias: Map<string, Blob>;          // anexos encontrados (nome → arquivo)
  telefone: string;
  paciente: PacienteResumo | null;
  situacao: "pronta" | "importando" | "feita" | "erro";
  resultado?: string;
}

const LOTE = 1000;

/** Lê os arquivos escolhidos: .zip (iPhone, ou Android com mídia) e .txt + fotos/áudios soltos */
async function lerArquivos(lista: File[]): Promise<{ itens: Omit<Item, "telefone" | "paciente" | "situacao">[]; avisos: string[] }> {
  const soltos = new Map<string, Blob>();
  const textos: { nome: string; conteudo: string; midias: Map<string, Blob> }[] = [];
  const avisos: string[] = [];
  for (const f of lista) {
    const nome = f.name;
    if (/\.zip$/i.test(nome)) {
      try {
        const zip = await JSZip.loadAsync(f);
        const midias = new Map<string, Blob>();
        let txt: { nome: string; conteudo: string } | null = null;
        for (const entrada of Object.values(zip.files)) {
          if (entrada.dir) continue;
          const base = entrada.name.split("/").pop() ?? entrada.name;
          if (/\.txt$/i.test(base) && (!txt || /_chat\.txt$/i.test(base))) txt = { nome: base, conteudo: await entrada.async("string") };
          else midias.set(base, await entrada.async("blob"));
        }
        if (txt) textos.push({ nome: /_chat\.txt$/i.test(txt.nome) ? nome : txt.nome, conteudo: txt.conteudo, midias });
        else avisos.push(`"${nome}" não tem o arquivo de texto da conversa.`);
      } catch {
        avisos.push(`Não consegui abrir "${nome}".`);
      }
    } else if (/\.txt$/i.test(nome)) {
      textos.push({ nome, conteudo: await f.text(), midias: new Map() });
    } else {
      soltos.set(nome, f);
    }
  }
  const itens = textos.map((t, i) => {
    const conversa = lerExportacao(t.conteudo, t.nome);
    // anexos soltos (Android exporta o .txt e os arquivos separados) entram na conversa que os cita
    for (const m of conversa.mensagens) if (m.arquivo && !t.midias.has(m.arquivo) && soltos.has(m.arquivo)) t.midias.set(m.arquivo, soltos.get(m.arquivo)!);
    return { chave: `${i}-${t.nome}`, arquivo: t.nome, conversa, midias: t.midias };
  });
  for (const it of itens) if (it.conversa.mensagens.length === 0) avisos.push(`"${it.arquivo}" não parece ser uma conversa exportada do WhatsApp.`);
  return { itens: itens.filter((it) => it.conversa.mensagens.length > 0), avisos };
}

export default function ImportarWhatsApp() {
  const { eu } = useAuth();
  const [params] = useSearchParams();
  const setores = (["clinica", "orientacao"] as SetorWA[]).filter((s) => podeResponderSetor(eu, s) || eu?.funcao === "admin");
  const [setor, setSetor] = useState<SetorWA>(setores.includes(params.get("setor") as SetorWA) ? (params.get("setor") as SetorWA) : setores[0] ?? "clinica");
  const [itens, setItens] = useState<Item[]>([]);
  const [clinica, setClinica] = useState("");
  const [lendo, setLendo] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState("");

  // Autores de todas as conversas: o nome que aparece em mais conversas costuma ser o da própria clínica
  const autores = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of itens) for (const a of it.conversa.autores) m.set(a.nome, (m.get(a.nome) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([nome, conversas]) => ({ nome, conversas }));
  }, [itens]);

  async function escolher(files: FileList | null) {
    if (!files?.length) return;
    setLendo(true);
    setAvisos([]);
    const { itens: novos, avisos: av } = await lerArquivos(Array.from(files));
    const prontos: Item[] = novos.map((n) => {
      const outro = n.conversa.autores.find((a) => numeroDoAutor(a.nome));
      // número do contato não salvo: mostra sem o 55 do Brasil, para ficar "(21) 98888-7777"
      const num = outro ? numeroDoAutor(outro.nome)! : "";
      return { ...n, telefone: /^55\d{10,11}$/.test(num) ? num.slice(2) : num, paciente: null, situacao: "pronta" };
    });
    const todos = [...itens, ...prontos];
    setItens(todos);
    setAvisos(av);
    if (!clinica) {
      const m = new Map<string, number>();
      for (const it of todos) for (const a of it.conversa.autores) m.set(a.nome, (m.get(a.nome) ?? 0) + 1);
      const mais = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      // com uma conversa só não dá para adivinhar: escolhe quem NÃO é número
      if (mais) setClinica(todos.length > 1 ? mais[0] : (todos[0].conversa.autores.find((a) => !numeroDoAutor(a.nome))?.nome ?? mais[0]));
    }
    setLendo(false);
  }

  function mudar(chave: string, dados: Partial<Item>) {
    setItens((lista) => lista.map((it) => (it.chave === chave ? { ...it, ...dados } : it)));
  }

  async function importarUm(it: Item) {
    mudar(it.chave, { situacao: "importando", resultado: "" });
    try {
      const digitos = it.telefone.replace(/\D/g, "");
      if (digitos.length < 10) throw new Error("Informe o número de WhatsApp do paciente (com DDD).");
      const tel = digitos.length <= 11 ? "55" + digitos : digitos;   // mesmo formato do WhatsApp: 55 + DDD + número
      const repetidas = new Map<string, number>();
      const msgs = [];
      let anexosEnviados = 0;
      for (const m of it.conversa.mensagens) {
        const iso = m.quando.toISOString();
        const base = `${iso}|${m.autor}|${m.texto}|${m.arquivo ?? ""}`;
        const n = (repetidas.get(base) ?? 0) + 1;    // mensagens idênticas no mesmo minuto
        repetidas.set(base, n);
        const codigo = await codigoMensagem([setor, tel, iso, m.autor, m.texto, m.arquivo, n]);
        const { tipo, mime } = tipoDoArquivo(m.arquivo);
        let caminho: string | null = null;
        let texto = m.texto;
        const blob = m.arquivo ? it.midias.get(m.arquivo) : undefined;
        if (m.arquivo && blob) {
          const ext = (m.arquivo.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
          caminho = `${setor}/importado/${tel}/${codigo}.${ext}`;
          const up = await supabase.storage.from("whatsapp-midia").upload(caminho, blob, { contentType: mime ?? undefined, upsert: false });
          if (up.error && !/exist|duplicate/i.test(up.error.message)) throw up.error;
          anexosEnviados++;
        } else if (m.arquivo) {
          texto = [`[anexo "${m.arquivo}" não foi enviado junto]`, texto].filter(Boolean).join("\n");
        } else if (m.midiaOculta) {
          texto = ["[anexo não exportado]", texto].filter(Boolean).join("\n");
        }
        msgs.push({
          quando: iso, direcao: m.autor === clinica ? "enviada" : "recebida",
          tipo: caminho ? tipo : m.arquivo || m.midiaOculta ? (tipo === "texto" ? "outro" : tipo) : "texto",
          texto: texto || null, codigo,
          midia_caminho: caminho, midia_tipo: caminho ? mime : null, midia_nome: caminho ? m.arquivo : null,
        });
        if (msgs.length % 200 === 0) setProgresso(`${it.conversa.titulo || it.arquivo}: preparando ${msgs.length} de ${it.conversa.mensagens.length}…`);
      }
      const outro = it.conversa.autores.find((a) => a.nome !== clinica)?.nome ?? it.conversa.titulo;
      let importadas = 0, jaExistiam = 0;
      for (let i = 0; i < msgs.length; i += LOTE) {
        setProgresso(`${it.conversa.titulo || it.arquivo}: gravando ${Math.min(i + LOTE, msgs.length)} de ${msgs.length}…`);
        const { data, error } = await supabase.rpc("whatsapp_importar", {
          p_setor: setor, p_telefone: tel, p_nome: it.paciente ? nomeExibicao(it.paciente) : (it.conversa.titulo || outro || null),
          p_paciente: it.paciente?.id ?? null, p_mensagens: msgs.slice(i, i + LOTE),
        });
        if (error) throw error;
        importadas += (data as { importadas: number }).importadas;
        jaExistiam += (data as { ja_existiam: number }).ja_existiam;
      }
      mudar(it.chave, {
        situacao: "feita",
        resultado: `${importadas} mensagem(ns) importada(s)${jaExistiam ? `, ${jaExistiam} já estavam no sistema` : ""}${anexosEnviados ? `, ${anexosEnviados} anexo(s)` : ""}.`,
      });
    } catch (e) {
      mudar(it.chave, { situacao: "erro", resultado: msgErro(e) });
    }
  }

  async function importarTodas() {
    if (!clinica) return;
    setImportando(true);
    // os campos ficam travados durante a importação: a lista do momento do clique vale até o fim
    for (const it of itens.filter((x) => x.situacao === "pronta" || x.situacao === "erro")) await importarUm(it);
    setProgresso("");
    setImportando(false);
  }

  const pendentes = itens.filter((it) => it.situacao === "pronta" || it.situacao === "erro");
  const semNumero = pendentes.filter((it) => it.telefone.replace(/\D/g, "").length < 10).length;

  if (setores.length === 0) return <div className="painel vazio">Só quem responde o WhatsApp pode importar conversas.</div>;
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Importar conversas antigas</h1>
          <p className="sub" style={{ margin: 0 }}>Traz para o sistema as conversas exportadas do WhatsApp do celular, como histórico de cada paciente.</p>
        </div>
        <Link className="botao" to={setor === "orientacao" ? "/orientacao-cirurgica" : "/whatsapp"}>← Voltar ao WhatsApp</Link>
      </div>

      <details className="painel" open={itens.length === 0}>
        <summary style={{ cursor: "pointer" }}><b>Como exportar uma conversa no celular</b></summary>
        <ol style={{ lineHeight: 1.7 }}>
          <li>No WhatsApp do celular da clínica, abra a conversa.</li>
          <li><b>Android:</b> toque nos três pontinhos → <b>Mais</b> → <b>Exportar conversa</b>. <b>iPhone:</b> toque no nome do contato → <b>Exportar conversa</b>.</li>
          <li>Escolha <b>Incluir mídia</b> (traz fotos e áudios) ou <b>Sem mídia</b> (só o texto, arquivo bem menor).</li>
          <li>Salve no Google Drive ou no e-mail da clínica e baixe no computador.</li>
          <li>Aqui, clique em <b>Escolher arquivos</b> e selecione os arquivos (o .zip, ou o .txt junto com as fotos e áudios). Dá para escolher várias conversas de uma vez.</li>
        </ol>
        <p className="muted pequeno">O assistente de IA não vai marcar consultas a partir dessas conversas antigas. Importar o mesmo arquivo de novo não duplica as mensagens.</p>
      </details>

      <div className="painel grade">
        <div className="linha">
          {setores.length > 1 && (
            <Campo rotulo="Para qual número">
              <select value={setor} onChange={(e) => setSetor(e.target.value as SetorWA)} disabled={importando}>
                {setores.map((s) => <option key={s} value={s}>{s === "clinica" ? "WhatsApp da clínica" : "Orientação Cirúrgica"}</option>)}
              </select>
            </Campo>
          )}
          <label className="botao primario" style={{ alignSelf: "end" }}>
            {lendo ? "Lendo arquivos…" : "📂 Escolher arquivos"}
            <input type="file" multiple hidden accept=".txt,.zip,image/*,audio/*,video/*,.opus,.pdf,.doc,.docx,.vcf"
              disabled={lendo || importando} onChange={(e) => { escolher(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {avisos.map((a) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}

        {itens.length > 0 && (
          <Campo rotulo="Qual destes nomes é a clínica? (as mensagens dele entram como enviadas pela clínica)">
            <select value={clinica} onChange={(e) => setClinica(e.target.value)} disabled={importando} style={{ maxWidth: 420 }}>
              {autores.map((a) => <option key={a.nome} value={a.nome}>{a.nome} — aparece em {a.conversas} conversa(s)</option>)}
            </select>
          </Campo>
        )}
      </div>

      {itens.map((it) => {
        const c = it.conversa;
        const primeira = c.mensagens[0]?.quando, ultima = c.mensagens[c.mensagens.length - 1]?.quando;
        const citados = c.mensagens.filter((m) => m.arquivo).length;
        const achados = c.mensagens.filter((m) => m.arquivo && it.midias.has(m.arquivo)).length;
        const outro = c.autores.filter((a) => a.nome !== clinica).map((a) => a.nome).join(", ") || "—";
        const travado = it.situacao === "importando" || it.situacao === "feita" || importando;
        return (
          <div key={it.chave} className="painel grade">
            <div className="linha entre">
              <div>
                <h2 style={{ margin: 0 }}>{c.titulo || outro}</h2>
                <div className="muted pequeno">
                  {c.mensagens.length} mensagens · {primeira && fmtData(primeira.toISOString())} a {ultima && fmtData(ultima.toISOString())}
                  {citados > 0 && ` · ${achados} de ${citados} anexo(s) encontrados`} · conversa com: {outro}
                </div>
              </div>
              {it.situacao === "feita" ? <Etiqueta cor="verde">Importada</Etiqueta>
                : it.situacao === "erro" ? <Etiqueta cor="vermelho">Erro</Etiqueta>
                : it.situacao === "importando" ? <Etiqueta cor="amarelo">Importando…</Etiqueta>
                : <Etiqueta cor="cinza">Pronta</Etiqueta>}
            </div>
            {it.resultado && <Aviso tipo={it.situacao === "erro" ? "erro" : "ok"}>{it.resultado}</Aviso>}
            {!travado && (
              <div className="grade g2">
                <Campo rotulo="Paciente (opcional: liga a conversa à ficha)">
                  {it.paciente ? (
                    <div className="linha entre secao" style={{ margin: 0 }}>
                      <span><b>{nomeExibicao(it.paciente)}</b> · Pront. {it.paciente.numero_prontuario}</span>
                      <button className="sutil mini" onClick={() => mudar(it.chave, { paciente: null })}>trocar</button>
                    </div>
                  ) : (
                    <BuscaPaciente placeholder={`Buscar paciente (ex.: ${c.titulo || outro})`}
                      aoEscolher={(p) => mudar(it.chave, { paciente: p, telefone: it.telefone || (p.telefone ?? "") })} />
                  )}
                </Campo>
                <Campo rotulo="Número de WhatsApp do paciente (com DDD) *">
                  <input value={fmtTelefone(it.telefone)} onChange={(e) => mudar(it.chave, { telefone: e.target.value })} placeholder="(21) 99999-9999" inputMode="tel" />
                </Campo>
              </div>
            )}
            {!travado && <div><button className="sutil mini" onClick={() => setItens((l) => l.filter((x) => x.chave !== it.chave))}>Tirar da lista</button></div>}
          </div>
        );
      })}

      {itens.length > 0 && (
        <div className="painel linha entre">
          <span className="muted">{progresso || (semNumero ? `${semNumero} conversa(s) sem número de WhatsApp: preencha antes de importar.` : `${pendentes.length} conversa(s) prontas para importar.`)}</span>
          <button className="primario grande" disabled={importando || pendentes.length === 0 || semNumero > 0 || !clinica} onClick={importarTodas}>
            {importando ? "Importando…" : `📥 Importar ${pendentes.length} conversa(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
