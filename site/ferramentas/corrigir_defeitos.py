"""Corrige defeitos que vieram do site WordPress original (pedido da dona em 2026-11-15).

Uso: python3 ferramentas/corrigir_defeitos.py public
Rodar depois de preparar_copia.py e trocar_marca.py (ordem em LEIAME.md). Pode rodar de novo.

1. Tira do ar páginas de rascunho esquecidas (o Caddyfile redireciona quem cair nelas).
2. Remove o código quebrado "[vc_row ...]" que aparecia como texto (Equipe, A clínica,
   Contato, Convênios) — junto somem os botões que apontavam para o servidor de testes
   da agência (homologacao.consumedolhos.com.br).
3. Tira do carrossel de convênios da página inicial o quadro vazio (logo assist.png não existe).
4. Gera sitemap.xml e robots.txt para o Google (o WordPress tinha /wp-sitemap.xml).
"""
import json
import os
import re
import shutil
import sys
from datetime import date

DOMINIO = 'https://consumedolhos.com.br'
RASCUNHOS = ['link', 'homez', 'pagina-exemplo', 'procedimentos2', 'exames2', 'video-background']
SHORTCODE = re.compile(r'\[/?vc_[a-z_]+(?:[^\[\]]*)\]')

raiz = sys.argv[1]
mudou = []

# 1) rascunhos
for r in RASCUNHOS:
    d = os.path.join(raiz, r)
    if os.path.isdir(d):
        shutil.rmtree(d)
        mudou.append(f'removida /{r}/')

# 2) código quebrado nas páginas
BOTAO = re.compile(r'\[vc_btn\b[^\]]*?title=(?:&#8221;|")(.*?)(?:&#8221;|")[^\]]*?link=(?:&#8221;|")url:([^|\]&]*)[^\]]*\]')


def botao(m):
    """[vc_btn title="X" link="url:..."] vira um botão de verdade apontando para a página do próprio site."""
    import urllib.parse
    url = urllib.parse.unquote(m.group(2))
    url = re.sub(r'^https?://[^/]*consumedolhos\.com\.br', '', url) or '/'
    return (f'<p style="margin:15px 0 30px"><a class="btn btn-effect btn-contact-bg" href="{url}">'
            f'{m.group(1)} <i class="fa fa-angle-right"></i></a></p>')


ENFEITE = re.compile(r'<img[^>]*bar-vertical-m\.png[^>]*/?>')  # barra de layout antigo, solta
ROTULO = re.compile(r'<strong>(Missão|Visão|Valores)\s*</strong></p>\s*<p>')

for d, _, fs in os.walk(raiz):
    for f in fs:
        if not f.endswith('.html'):
            continue
        p = os.path.join(d, f)
        t = open(p, encoding='utf-8').read()
        n = BOTAO.sub(botao, t)
        n = SHORTCODE.sub('', n)
        n = ENFEITE.sub('', n)
        n = ROTULO.sub(r'</p><h3>\1</h3><p>', n)
        n = re.sub(r'<p>\s*</p>', '', n)  # parágrafos que ficaram vazios
        if n != t:
            open(p, 'w', encoding='utf-8').write(n)
            mudou.append(f'limpa {os.path.relpath(p, raiz)}')

# índice da busca: sem rascunhos e sem código quebrado
ip = os.path.join(raiz, 'busca', 'indice.json')
if os.path.exists(ip):
    itens = json.load(open(ip, encoding='utf-8'))
    novos = []
    for it in itens:
        if it['url'].strip('/') in RASCUNHOS:
            continue
        tinha_codigo = '[vc_' in it['resumo'] or '[/vc_' in it['resumo']
        it['texto'] = re.sub(r'\s+', ' ', SHORTCODE.sub(' ', it['texto'])).strip()
        if tinha_codigo:  # resumo era o começo do texto, cortado no meio do código: refaz
            it['resumo'] = it['texto'][:300]
        novos.append(it)
    json.dump(novos, open(ip, 'w', encoding='utf-8'), ensure_ascii=False)
    mudou.append(f'índice da busca: {len(itens)} -> {len(novos)} itens')

# 3) quadro vazio no carrossel de convênios
hp = os.path.join(raiz, 'index.html')
t = open(hp, encoding='utf-8').read()
slide = re.search(r'<div class="swiper-slide"[^>]*>(?:(?!<div class="swiper-slide").)*?assist\.png.*?</figure></div>', t, re.S)
if slide:
    t = t[:slide.start()] + t[slide.end():]
    total = len(re.findall(r'aria-label="\d+ de 12"', t))
    if total == 11:
        k = iter(range(1, 12))
        t = re.sub(r'aria-label="\d+ de 12"', lambda m: f'aria-label="{next(k)} de 11"', t)
    open(hp, 'w', encoding='utf-8').write(t)
    mudou.append('carrossel de convênios: quadro vazio removido')

# 4) sitemap.xml e robots.txt
paginas = []
for d, _, fs in os.walk(raiz):
    if 'index.html' not in fs:
        continue
    rel = os.path.relpath(d, raiz).replace(os.sep, '/')
    rel = '' if rel == '.' else rel + '/'
    if rel.startswith(('busca/', 'wp-', 'marca/')) or '/page/' in '/' + rel:
        continue
    paginas.append('/' + rel)
hoje = date.today().isoformat()
with open(os.path.join(raiz, 'sitemap.xml'), 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for u in sorted(paginas, key=lambda x: (x != '/', x)):
        f.write(f'  <url><loc>{DOMINIO}{u}</loc><lastmod>{hoje}</lastmod></url>\n')
    f.write('</urlset>\n')
with open(os.path.join(raiz, 'robots.txt'), 'w', encoding='utf-8') as f:
    f.write(f'User-agent: *\nDisallow: /busca/\n\nSitemap: {DOMINIO}/sitemap.xml\n')
mudou.append(f'sitemap.xml com {len(paginas)} páginas + robots.txt')

print('\n'.join(mudou))
