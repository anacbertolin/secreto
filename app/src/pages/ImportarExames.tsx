// Envio dos arquivos que saem dos aparelhos (OCT, campo visual, retinografia, topografia, biometria…).
// Fase 1 da integração com aparelhos: o técnico arrasta os arquivos, o sistema tenta adivinhar paciente,
// exame e olho pelo nome do arquivo, a pessoa confere e envia. Cada grupo (paciente + exame + olho) vira um exame
// "aguardando laudo" com os arquivos anexados (ou completa um exame já aberto do paciente).
// Usa as tabelas que já existem (exames_realizados, exame_arquivos, bucket "exames"): nenhuma mudança no banco.
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, BuscaPaciente, Etiqueta, type PacienteResumo } from "../components/ui";
import { nomeExibicao } from "../lib/util";

interface Catalogo { id: string; nome: string }
interface Item {
  id: string; arquivo: File; paciente: PacienteResumo | null; catalogoId: string; olho: string;
  estado: "pronto" | "enviando" | "ok" | "erro"; mensagem?: string; exameId?: string;
}

const MAX = 50 * 1024 * 1024;
const ACEITOS = ".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff,.dcm,.xml,.txt,.csv,.zip";

// Palavras do nome do arquivo → exame do catálogo (compara sem acento, em minúsculas)
const PISTAS: [RegExp, RegExp][] = [
  [/\boct\b|tomograf/, /oct|tomografia de coer/],
  [/campo|perimet|cv\b|hfa|humphrey|octopus/, /campo visual|perimetria/],
  [/retino|fundus|foto/, /retinografia/],
  [/topo|pentacam|orbscan/, /topografia|tomografia de c[oó]rnea/],
  [/biomet|iolmaster|lenstar/, /biometria/],
  [/paqui/, /paquimetria/],
  [/especular|endotel/, /microscopia especular/],
  [/angio/, /angiografia/],
  [/gonio/, /gonioscopia/],
  [/mapeam/, /mapeamento/],
];
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function adivinharExame(nome: string, catalogo: Catalogo[]): string {
  const n = semAcento(nome).replace(/[_\-.]+/g, " ");   // "1001_OCT_OD.pdf" → "1001 oct od pdf"
  for (const [pista, cat] of PISTAS) {
    if (pista.test(n)) {
      const c = catalogo.find((x) => cat.test(semAcento(x.nome)));
      if (c) return c.id;
    }
  }
  return "";
}
function adivinharOlho(nome: string): string {
  const n = semAcento(nome).replace(/[_\-.]/g, " ");
  if (/\b(od|re|right|direito)\b/.test(n)) return "OD";
  if (/\b(oe|os|le|left|esquerdo)\b/.test(n)) return "OE";
  return "AO";
}
const tamanho = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export default function ImportarExames() {
  const cat = useCarregar(async () => ok(await supabase.from("exames_catalogo").select("id, nome").eq("ativo", true).order("nome")) as Catalogo[], []);
  const [itens, setItens] = useState<Item[]>([]);
  const [todos, setTodos] = useState<PacienteResumo | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  async function adicionar(files: FileList | File[]) {
    setErro("");
    const catalogo = cat.dados ?? [];
    const novos: Item[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX) { setErro(`"${f.name}" passa de 50 MB e não foi incluído.`); continue; }
      novos.push({ id: crypto.randomUUID(), arquivo: f, paciente: todos, catalogoId: adivinharExame(f.name, catalogo), olho: adivinharOlho(f.name), estado: "pronto" });
    }
    // Paciente pelo nº do prontuário no nome do arquivo (ex.: 1001_OCT_OD.pdf), quando não foi escolhido para todos
    if (!todos) {
      const numeros = [...new Set(novos.map((i) => i.arquivo.name.match(/(?:^|\D)(\d{3,7})(?:\D|$)/)?.[1]).filter(Boolean))] as string[];
      if (numeros.length) {
        const { data } = await supabase.from("pacientes")
          .select("id, numero_prontuario, prontuario_anterior, nome, nome_social, data_nascimento, cpf, telefone, convenio_id")
          .in("numero_prontuario", numeros.map(Number)).eq("ativo", true);
        const mapa = new Map(((data ?? []) as PacienteResumo[]).map((p) => [String(p.numero_prontuario), p]));
        for (const i of novos) {
          const num = i.arquivo.name.match(/(?:^|\D)(\d{3,7})(?:\D|$)/)?.[1];
          if (num && mapa.has(num)) i.paciente = mapa.get(num)!;
        }
      }
    }
    setItens((x) => [...x, ...novos]);
  }
  const mudar = (id: string, campos: Partial<Item>) => setItens((x) => x.map((i) => (i.id === id ? { ...i, ...campos } : i)));

  async function enviarTudo() {
    setErro("");
    const prontos = itens.filter((i) => i.estado === "pronto" || i.estado === "erro");
    const faltando = prontos.filter((i) => !i.paciente || !i.catalogoId);
    if (faltando.length) return setErro(`Falta escolher paciente ou exame em ${faltando.length} arquivo(s).`);
    setEnviando(true);
    // Agrupa: mesmo paciente + exame + olho = um exame com vários arquivos
    const grupos = new Map<string, Item[]>();
    for (const i of prontos) {
      const k = `${i.paciente!.id}|${i.catalogoId}|${i.olho}`;
      grupos.set(k, [...(grupos.get(k) ?? []), i]);
    }
    for (const [, grupo] of grupos) {
      const { paciente, catalogoId, olho } = grupo[0];
      const nomeExame = (cat.dados ?? []).find((c) => c.id === catalogoId)!.nome;
      grupo.forEach((i) => mudar(i.id, { estado: "enviando", mensagem: undefined }));
      try {
        // 1) exame já aberto deste paciente (aguardando/em execução) com o mesmo exame e olho? Usa ele.
        const abertos = ok(await supabase.from("exames_realizados").select("id, olho, status")
          .eq("paciente_id", paciente!.id).eq("exame_catalogo_id", catalogoId).in("status", ["aguardando", "em_execucao"])
          .order("criado_em", { ascending: false })) as { id: string; olho: string | null; status: string }[];
        let exameId = abertos.find((e) => (e.olho ?? "AO") === olho)?.id ?? abertos[0]?.id;
        if (!exameId) {
          const novo = ok(await supabase.from("exames_realizados").insert({
            paciente_id: paciente!.id, exame: nomeExame, exame_catalogo_id: catalogoId, olho, status: "em_execucao",
            observacoes_execucao: "Arquivos enviados pela tela de importação dos aparelhos.",
          }).select("id").single()) as { id: string };
          exameId = novo.id;
        }
        // 2) arquivos
        for (const i of grupo) {
          const seguro = i.arquivo.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
          const caminho = `${paciente!.id}/${exameId}/${crypto.randomUUID()}-${seguro}`;
          const up = await supabase.storage.from("exames").upload(caminho, i.arquivo, { contentType: i.arquivo.type || undefined });
          if (up.error) throw up.error;
          ok(await supabase.from("exame_arquivos").insert({ exame_realizado_id: exameId, caminho, nome_arquivo: i.arquivo.name, tipo_mime: i.arquivo.type || null, tamanho_bytes: i.arquivo.size }));
        }
        // 3) exame feito: vai para a fila de laudos (e para a conta, pela regra do faturamento)
        ok(await supabase.from("exames_realizados").update({ status: "aguardando_laudo" }).eq("id", exameId));
        grupo.forEach((i) => mudar(i.id, { estado: "ok", exameId }));
      } catch (e) {
        grupo.forEach((i) => mudar(i.id, { estado: "erro", mensagem: msgErro(e) }));
      }
    }
    setEnviando(false);
  }

  const pendentes = itens.filter((i) => i.estado !== "ok").length;
  return (
    <div>
      <div className="cabecalho">
        <div>
          <h1>Arquivos dos aparelhos</h1>
          <p className="sub" style={{ margin: 0 }}>Envie os PDFs e imagens que saem do OCT, campo visual, retinógrafo, topógrafo, biômetro… Cada exame vai para a fila de laudos.</p>
        </div>
        <Link className="botao" to="/exames?aba=laudos">Fila de laudos →</Link>
      </div>
      <Aviso>{erro || cat.erro}</Aviso>
      <div className="painel">
        <div className="grade g2">
          <div>
            <b className="pequeno">Todos os arquivos são do mesmo paciente? (opcional)</b>
            {todos ? <div className="linha" style={{ marginTop: 6 }}><b>{nomeExibicao(todos)}</b> · Pront. {todos.numero_prontuario}<button className="mini" onClick={() => setTodos(null)}>trocar</button>
              {itens.some((i) => i.estado === "pronto") && <button className="mini" onClick={() => setItens((x) => x.map((i) => (i.estado === "pronto" ? { ...i, paciente: todos } : i)))}>aplicar à lista</button>}</div>
              : <div style={{ marginTop: 6 }}><BuscaPaciente aoEscolher={setTodos} placeholder="Buscar paciente (nome, CPF, prontuário)" /></div>}
          </div>
          <div className="muted pequeno">
            Dica: se o nome do arquivo tiver o <b>nº do prontuário</b> (ex.: <code>1001_OCT_OD.pdf</code>), o paciente é escolhido sozinho.
            Palavras como OCT, campo, retino, topo, biometria, paqui e OD/OE também ajudam.
          </div>
        </div>
        <div className={"zona-envio" + (arrastando ? " ativa" : "")}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionar(e.dataTransfer.files); }}
          onClick={() => entrada.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && entrada.current?.click()}>
          <div style={{ fontSize: 34 }}>📥</div>
          <b>Arraste os arquivos para cá</b> ou clique para escolher
          <div className="muted pequeno">PDF, imagens, DICOM, XML · até 50 MB cada</div>
          <input ref={entrada} type="file" multiple accept={ACEITOS} hidden onChange={(e) => { if (e.target.files) adicionar(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {itens.length > 0 && (
        <div className="painel rolagem">
          <div className="linha entre" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{itens.length} arquivo(s)</h2>
            <div className="linha">
              <button className="mini" onClick={() => setItens((x) => x.filter((i) => i.estado !== "ok"))}>Limpar enviados</button>
              <button className="primario" disabled={enviando || pendentes === 0} onClick={enviarTudo}>{enviando ? "Enviando…" : `Enviar ${pendentes} arquivo(s)`}</button>
            </div>
          </div>
          <table className="tabela">
            <thead><tr><th>Arquivo</th><th>Paciente</th><th>Exame</th><th>Olho</th><th></th></tr></thead>
            <tbody>
              {itens.map((i) => {
                const travado = i.estado === "ok" || i.estado === "enviando";
                return (
                  <tr key={i.id}>
                    <td style={{ maxWidth: 220 }}><div style={{ wordBreak: "break-all" }}>{i.arquivo.name}</div><div className="muted pequeno">{tamanho(i.arquivo.size)}</div></td>
                    <td style={{ minWidth: 240 }}>
                      {i.paciente ? <div className="linha"><span><b>{nomeExibicao(i.paciente)}</b><div className="muted pequeno">Pront. {i.paciente.numero_prontuario}</div></span>{!travado && <button className="mini" onClick={() => mudar(i.id, { paciente: null })}>trocar</button>}</div>
                        : <BuscaPaciente aoEscolher={(p) => mudar(i.id, { paciente: p })} placeholder="Buscar paciente" />}
                    </td>
                    <td>
                      <select disabled={travado} value={i.catalogoId} onChange={(e) => mudar(i.id, { catalogoId: e.target.value })} style={{ minWidth: 180, borderColor: i.catalogoId ? undefined : "var(--alerta)" }}>
                        <option value="">— escolha —</option>
                        {(cat.dados ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                    <td><select disabled={travado} value={i.olho} onChange={(e) => mudar(i.id, { olho: e.target.value })} style={{ width: 80 }}><option>AO</option><option>OD</option><option>OE</option></select></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {i.estado === "pronto" && <button className="sutil mini" onClick={() => setItens((x) => x.filter((y) => y.id !== i.id))}>remover</button>}
                      {i.estado === "enviando" && <Etiqueta cor="amarelo">enviando…</Etiqueta>}
                      {i.estado === "ok" && <Link to={`/exames/${i.exameId}`}><Etiqueta cor="verde">✓ enviado · abrir</Etiqueta></Link>}
                      {i.estado === "erro" && <span className="pequeno" style={{ color: "var(--perigo)" }}>{i.mensagem}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted pequeno">Arquivos do mesmo paciente, exame e olho entram juntos no mesmo exame. Se o paciente já tinha esse exame aberto na fila, os arquivos completam esse exame.</p>
        </div>
      )}
    </div>
  );
}
