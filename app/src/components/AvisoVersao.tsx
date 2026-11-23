import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/** Script principal desta página (muda de nome a cada publicação). */
function scriptAtual(doc: Document | string): string {
  const html = typeof doc === "string" ? doc : doc.documentElement.outerHTML;
  return html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? "";
}

const PARADO_MS = 10 * 60 * 1000; // 10 min sem mexer no computador

/**
 * Atualiza o sistema sozinho quando sai versão nova, num momento seguro:
 * - quando a pessoa troca de tela (o que estava na tela anterior já foi salvo ou abandonado);
 * - ou depois de 10 min sem ninguém mexer no computador;
 * - `imediato` (TV da sala de espera): na hora.
 * Enquanto isso, mostra o aviso com o botão "Atualizar agora".
 */
export default function AvisoVersao({ imediato = false }: { imediato?: boolean }) {
  const [nova, setNova] = useState(false);
  const loc = useLocation();
  const rotaInicial = useRef(loc.pathname + loc.search);
  const ultimoUso = useRef(Date.now());

  useEffect(() => {
    const minha = scriptAtual(document);
    if (!minha) return;
    let parado = false;
    async function conferir() {
      if (parado) return;
      try {
        const r = await fetch("/", { cache: "no-store" });
        const outra = scriptAtual(await r.text());
        if (outra && outra !== minha) setNova(true);
      } catch { /* sem internet: tenta de novo depois */ }
    }
    const t = setInterval(conferir, 60 * 1000);
    window.addEventListener("focus", conferir);
    const usou = () => { ultimoUso.current = Date.now(); };
    const eventos = ["keydown", "mousedown", "touchstart", "wheel"];
    eventos.forEach((e) => window.addEventListener(e, usou, { passive: true }));
    return () => {
      parado = true; clearInterval(t); window.removeEventListener("focus", conferir);
      eventos.forEach((e) => window.removeEventListener(e, usou));
    };
  }, []);

  // Versão nova + troca de tela → carrega a tela nova já na versão nova
  useEffect(() => {
    const rota = loc.pathname + loc.search;
    if (nova && rota !== rotaInicial.current) window.location.reload();
    rotaInicial.current = rota;
  }, [loc.pathname, loc.search, nova]);

  // Versão nova + computador parado (ou TV) → atualiza sozinho
  useEffect(() => {
    if (!nova) return;
    if (imediato) { window.location.reload(); return; }
    const t = setInterval(() => { if (Date.now() - ultimoUso.current > PARADO_MS) window.location.reload(); }, 30 * 1000);
    return () => clearInterval(t);
  }, [nova, imediato]);

  if (!nova || imediato) return null;
  return (
    <div className="aviso-versao">
      ✨ Saiu uma versão nova do sistema. Ela entra sozinha quando você mudar de tela.
      <button className="primario" onClick={() => window.location.reload()}>Atualizar agora</button>
    </div>
  );
}
