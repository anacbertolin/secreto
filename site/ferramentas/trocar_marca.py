"""Troca a marca antiga (Consumed) pela nova (Hospital de Olhos da Baixada) nas páginas de public/.
Pode ser rodado de novo depois de refazer a cópia do site:  python3 ferramentas/trocar_marca.py public
Não mexe no endereço consumedolhos.com.br, no link do Facebook nem na busca do mapa do Google,
que continuam com o nome antigo até serem trocados lá fora."""
import base64, pathlib, sys

N = "Hospital de Olhos da Baixada"
NU = "Hospital%20de%20Olhos%20da%20Baixada"
LOGO_W, LOGO_H = 1600, 448
ph = base64.b64encode(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{LOGO_W}" height="{LOGO_H}" viewBox="0 0 {LOGO_W} {LOGO_H}">'
    '<rect width="100%" height="100%" style="fill:#cfd4db;fill-opacity: 0.1;"/></svg>'.encode()).decode()
ph_old = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTExIiBoZWlnaHQ9IjI2MCIgdmlld0JveD0iMCAwIDE1MTEgMjYwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBzdHlsZT0iZmlsbDojY2ZkNGRiO2ZpbGwtb3BhY2l0eTogMC4xOyIvPjwvc3ZnPg=="

TROCAS = [
    # logo do topo
    (ph_old, ph),
    ('data-src="/wp-content/uploads/2025/08/ConsumedLogoBranco.png" alt=""  style="width:250px; height:auto;" width="1511" height="260"',
     f'data-src="/marca/logo-branco.png" alt="{N}"  style="width:210px; height:auto;" width="{LOGO_W}" height="{LOGO_H}"'),
    ("/wp-content/uploads/2025/08/ConsumedLogoBranco.png", "/marca/logo-branco.png"),
    # ícones do site
    ("/wp-content/uploads/2021/10/cropped-LogoIcon4-32x32.png", "/marca/favicon-32.png"),
    ("/wp-content/uploads/2021/10/cropped-LogoIcon4-192x192.png", "/marca/favicon-192.png"),
    ("/wp-content/uploads/2021/10/cropped-LogoIcon4-180x180.png", "/marca/apple-touch-icon.png"),
    ("/wp-content/uploads/2021/10/cropped-LogoIcon4-270x270.png", "/marca/favicon-270.png"),
    # textos em links (codificados)
    ("Consumed%20%E2%80%93%20Cl%C3%ADnica%20de%20olhos", NU),
    ("%20%E2%80%93%20Consumed", f"%20%E2%80%93%20{NU}"),
    ("aqui%20%C3%A9%20da%20Consumed%2C", f"aqui%20%C3%A9%20do%20{NU}%2C"),
    ("sobre%20a%20CONSUMED", f"sobre%20o%20{NU}"),
    # textos com o nome completo
    ("Consumed Cl\\u00ednica de Olhos", N),
    ("Consumed – Clínica de olhos", N),
    ("Consumed &#8211; Clínica de olhos", N),
    ("à Consumed Clínica de Olhos", f"ao {N}"),
    ("da Consumed Clínica de Olhos", f"do {N}"),
    ("Consumed Clínica de Olhos", N),
    # frases com artigo
    ("A\\u00a0Consumed\\u00a0", f"O\\u00a0{N}\\u00a0"),
    ("A\xa0Consumed\xa0", f"O\xa0{N}\xa0"),  # espaço "duro" do editor (ex.: página Equipe)
    ("A Consumed ", f"O {N} "),
    ("a Consumed ", f"o {N} "),
    ("à Consumed", f"ao {N}"),
    ("da Consumed", f"do {N}"),
    # o que sobrar (títulos das abas, nome no WhatsApp)
    ("Consumed", N),
]
PROTEGER = ["Consumed%20Cl%C3%ADnica%20de%20Olhos"]  # busca do mapa do Google

def trocar(txt):
    for i, p in enumerate(PROTEGER):
        txt = txt.replace(p, f"\0{i}\0")
    for a, b in TROCAS:
        txt = txt.replace(a, b)
    for i, p in enumerate(PROTEGER):
        txt = txt.replace(f"\0{i}\0", p)
    return txt

raiz = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public")
mudados = 0
for f in raiz.rglob("*"):
    if f.suffix in (".html", ".json", ".js", ".txt", ".xml") and f.is_file():
        t = f.read_text(encoding="utf-8")
        n = trocar(t)
        if n != t:
            f.write_text(n, encoding="utf-8"); mudados += 1
print(f"{mudados} arquivos atualizados")
