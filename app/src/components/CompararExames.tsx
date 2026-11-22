// Comparar dois exames lado a lado (imagens, PDF e laudo) — ex.: OCT de hoje × OCT de 6 meses atrás
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Modal, Aviso } from "./ui";
import { fmtData } from "../lib/util";

interface Exame { id: string; exame: string; olho: string | null; criado_em: string; laudo?: string | null; conclusao: string | null }
interface Arquivo { id: string; nome_arquivo: string; tipo_mime: string | null; caminho: string; url?: string }

function Coluna({ e }: { e: Exame }) {
  const [arqs, setArqs] = useState<Arquivo[] | null>(null);
  const [laudo, setLaudo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    (async () => {
      const [a, l] = await Promise.all([
        supabase.from("exame_arquivos").select("id, nome_arquivo, tipo_mime, caminho").eq("exame_realizado_id", e.id).order("criado_em"),
        supabase.from("exames_realizados").select("laudo").eq("id", e.id).single(),
      ]);
      if (a.error) return setErro(a.error.message);
      setLaudo((l.data as { laudo: string | null } | null)?.laudo ?? null);
      const lista = (a.data ?? []) as Arquivo[];
      const comUrl = await Promise.all(lista.map(async (x) => {
        const { data } = await supabase.storage.from("exames").createSignedUrl(x.caminho, 600);
        return { ...x, url: data?.signedUrl };
      }));
      setArqs(comUrl);
    })();
  }, [e.id]);
  return (
    <div className="comparar-col">
      <h3 style={{ margin: "0 0 4px" }}>{e.exame}{e.olho && ` · ${e.olho}`}</h3>
      <div className="muted pequeno" style={{ marginBottom: 8 }}>{fmtData(e.criado_em)}</div>
      <Aviso>{erro}</Aviso>
      {arqs === null ? <div className="muted">Carregando imagens…</div> : arqs.length === 0 ? <div className="muted">Sem arquivos anexados.</div> : arqs.map((a) => (
        a.tipo_mime?.startsWith("image/") ? (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.nome_arquivo} className="comparar-img" /></a>
        ) : a.tipo_mime === "application/pdf" ? (
          <iframe key={a.id} src={a.url} title={a.nome_arquivo} className="comparar-pdf" />
        ) : <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="botao mini">📎 {a.nome_arquivo}</a>
      ))}
      {(e.conclusao || laudo) && (
        <div className="secao" style={{ marginTop: 10 }}>
          {e.conclusao && <div><b>Conclusão:</b> {e.conclusao}</div>}
          {laudo && <details style={{ marginTop: 6 }}><summary className="pequeno">Laudo completo</summary><div className="pequeno" style={{ whiteSpace: "pre-wrap" }}>{laudo}</div></details>}
        </div>
      )}
    </div>
  );
}

export function CompararExames({ exames, aoFechar }: { exames: Exame[]; aoFechar: () => void }) {
  const [a, b] = [...exames].sort((x, y) => x.criado_em.localeCompare(y.criado_em));
  return (
    <Modal titulo="🔀 Comparar exames" largo aoFechar={aoFechar}>
      {a.exame !== b.exame && <Aviso tipo="alerta">Atenção: são exames de tipos diferentes.</Aviso>}
      <div className="comparar">
        <Coluna e={a} />
        <Coluna e={b} />
      </div>
    </Modal>
  );
}
