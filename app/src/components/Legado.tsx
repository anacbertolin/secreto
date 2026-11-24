import { useState } from "react";
import { supabase, msgErro } from "../lib/supabase";
import { useCarregar, ok, Aviso, Campo, Etiqueta } from "./ui";
import { fmtData, fmtDataHora } from "../lib/util";

export interface RegistroLegado {
  id: string; data: string; profissional_id: string | null; tipo: string; titulo: string | null;
  conteudo: string | null; formato: string; arquivo_caminho: string | null; assinatura: Record<string, unknown> | null;
}

/** Converte HTML antigo em texto simples (nunca executa o HTML importado) */
export function htmlParaTexto(html: string): string {
  const doc = new DOMParser().parseFromString(
    html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n"),
    "text/html",
  );
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function abrirDocumento(caminho: string, aoErro: (m: string) => void) {
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(caminho, 300);
  if (error) return aoErro(msgErro(error));
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Um registro do prontuário antigo (Micrologos), recolhido por padrão */
export function ItemLegado({ r, nomeProf }: { r: RegistroLegado; nomeProf: string }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const texto = r.conteudo ? (r.formato === "html" ? htmlParaTexto(r.conteudo) : r.conteudo) : "";
  return (
    <div className="evento">
      <div className="linha entre">
        <button className="sutil" style={{ padding: 0, color: "var(--texto)" }} onClick={() => setAberto(!aberto)}>
          <b>{fmtData(r.data)}</b> · {r.titulo || r.tipo}{nomeProf && ` · ${nomeProf}`} {aberto ? "▾" : "▸"}
        </button>
        <Etiqueta cor="cinza">Micrologos</Etiqueta>
      </div>
      {!aberto && texto && <div className="pequeno muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{texto.slice(0, 160)}</div>}
      {aberto && (
        <div className="secao" style={{ marginTop: 6 }}>
          <Aviso>{erro}</Aviso>
          {texto ? <div style={{ whiteSpace: "pre-wrap" }}>{texto}</div> : <div className="muted">Sem texto.</div>}
          {r.arquivo_caminho && <button className="mini" style={{ marginTop: 8 }} onClick={() => abrirDocumento(r.arquivo_caminho!, setErro)}>📎 Abrir arquivo original</button>}
          {r.assinatura && <p className="muted pequeno" style={{ marginTop: 8 }}>Assinado digitalmente no sistema antigo{typeof r.assinatura.assinado_em === "string" ? ` em ${fmtDataHora(r.assinatura.assinado_em)}` : ""}.</p>}
        </div>
      )}
    </div>
  );
}

interface Doc { id: string; tipo: string; titulo: string; data_documento: string | null; caminho: string; nome_arquivo: string; tamanho_bytes: number | null; sha256: string | null; origem: string; criado_em: string }
const TIPOS: Record<string, string> = {
  laudo: "Laudo", exame: "Exame", receita: "Receita", atestado: "Atestado", termo: "Termo assinado",
  foto: "Foto", documento_pessoal: "Documento pessoal", outro: "Outro",
};

async function sha256(file: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Documentos do paciente (PDFs, fotos, termos) — os enviados aqui e os importados */
export function DocumentosPaciente({ pacienteId, podeAnexar = true }: { pacienteId: string; podeAnexar?: boolean }) {
  const { dados, erro, recarregar } = useCarregar(async () => ok(await supabase.from("paciente_documentos").select("*").eq("paciente_id", pacienteId).order("data_documento", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false })) as Doc[], [pacienteId]);
  const [f, setF] = useState({ tipo: "exame", titulo: "", data_documento: "" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [e2, setE2] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setE2("");
    if (!arquivo) return setE2("Escolha o arquivo.");
    if (arquivo.size > 50 * 1024 * 1024) return setE2("O arquivo passa de 50 MB.");
    setEnviando(true);
    try {
      const hash = await sha256(arquivo);
      const seguro = arquivo.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
      const caminho = `${pacienteId}/${crypto.randomUUID()}-${seguro}`;
      const up = await supabase.storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
      if (up.error) throw up.error;
      const r = await supabase.from("paciente_documentos").insert({
        paciente_id: pacienteId, tipo: f.tipo, titulo: f.titulo.trim() || arquivo.name, data_documento: f.data_documento || null,
        caminho, nome_arquivo: arquivo.name, tipo_mime: arquivo.type || null, tamanho_bytes: arquivo.size, sha256: hash,
      });
      if (r.error) throw r.error;
      setF({ tipo: f.tipo, titulo: "", data_documento: "" }); setArquivo(null); recarregar();
    } catch (e) {
      setE2(msgErro(e));
    }
    setEnviando(false);
  }

  return (
    <div className="painel grade">
      <Aviso>{erro || e2}</Aviso>
      <div className="rolagem">
        <table className="tabela">
          <thead><tr><th>Data</th><th>Documento</th><th>Tipo</th><th>Origem</th><th></th></tr></thead>
          <tbody>
            {(dados ?? []).map((d) => (
              <tr key={d.id}>
                <td>{fmtData(d.data_documento ?? d.criado_em)}</td>
                <td><b>{d.titulo}</b><div className="muted pequeno">{d.nome_arquivo}{d.tamanho_bytes ? ` · ${Math.max(1, Math.round(d.tamanho_bytes / 1024))} KB` : ""}</div></td>
                <td>{TIPOS[d.tipo] ?? d.tipo}</td>
                <td>{d.origem === "micrologos" ? <Etiqueta cor="cinza">Micrologos</Etiqueta> : <Etiqueta cor="azul">Sistema</Etiqueta>}</td>
                <td style={{ textAlign: "right" }}><button className="mini" onClick={() => abrirDocumento(d.caminho, setE2)}>Abrir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {dados?.length === 0 && <div className="vazio">Nenhum documento.</div>}
      </div>
      {podeAnexar && <div className="secao grade">
        <h3>Anexar documento</h3>
        <div className="grade g4">
          <Campo rotulo="Tipo">
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Campo>
          <Campo rotulo="Título" className="span2"><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Exame externo de campo visual" /></Campo>
          <Campo rotulo="Data do documento"><input type="date" value={f.data_documento} onChange={(e) => setF({ ...f, data_documento: e.target.value })} /></Campo>
          <Campo rotulo="Arquivo (PDF ou imagem, até 50 MB)" className="span3"><input type="file" accept="application/pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
          <div style={{ alignSelf: "end" }}><button className="primario" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : "Anexar"}</button></div>
        </div>
        <p className="muted pequeno" style={{ margin: 0 }}>Documentos anexados não podem ser apagados. O sistema guarda uma "impressão digital" (SHA-256) de cada arquivo para provar que ele não foi alterado.</p>
      </div>}
    </div>
  );
}
