import { useEffect, useState } from "react";

/** Script principal desta página (muda de nome a cada publicação). */
function scriptAtual(doc: Document | string): string {
  const html = typeof doc === "string" ? doc : doc.documentElement.outerHTML;
  return html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? "";
}

/**
 * Avisa quando sai uma versão nova do sistema (computador com a página aberta há tempo).
 * Não recarrega sozinho, para não perder o que a pessoa está digitando.
 */
export default function AvisoVersao() {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    const minha = scriptAtual(document);
    if (!minha) return;
    let parado = false;
    async function conferir() {
      if (parado || document.hidden) return;
      try {
        const r = await fetch("/", { cache: "no-store" });
        const outra = scriptAtual(await r.text());
        if (outra && outra !== minha) setNova(true);
      } catch { /* sem internet: tenta de novo depois */ }
    }
    const t = setInterval(conferir, 3 * 60 * 1000);
    window.addEventListener("focus", conferir);
    return () => { parado = true; clearInterval(t); window.removeEventListener("focus", conferir); };
  }, []);
  if (!nova) return null;
  return (
    <div className="aviso-versao">
      ✨ Saiu uma versão nova do sistema.
      <button className="primario" onClick={() => window.location.reload()}>Atualizar agora</button>
    </div>
  );
}
