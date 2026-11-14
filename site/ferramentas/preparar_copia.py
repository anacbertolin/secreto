"""Transforma o espelho baixado de consumedolhos.com.br numa cópia estática.

Uso: python3 preparar_copia.py <pasta_espelho/consumedolhos.com.br> <pasta_extras> <saida>
  pasta_extras precisa ter: olho.html (página de busca original), nada.html,
  404.html, api_posts.json, api_pages.json
"""
import html, json, os, re, shutil, sys

src, extras, out = sys.argv[1:4]
HOST_RE = r'(?:https?:)?(?:\\/\\/|//)(?:www\.|homologacao\.)?consumedolhos\.com\.br'
TEXT_EXT = ('.html', '.css', '.js', '.json', '.xml', '.svg', '.txt')
PROTECT = re.compile(
    r'<link[^>]+rel="canonical"[^>]*>|<meta[^>]+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>'
    r'|<script[^>]+application/ld\+json[^>]*>.*?</script>', re.S)
HEAD_JUNK = re.compile(
    r'<link[^>]+rel="(?:https://api\.w\.org/|EditURI|shortlink|pingback)"[^>]*>\s*'
    r'|<link[^>]+type="(?:application/json(?:\+oembed)?|text/xml\+oembed|application/rss\+xml)"[^>]*>\s*')
INJECT = '<script src="/site-copia.js" defer></script>'


def relativize(text):
    # só troca quando o endereço começa um valor (atributo, url(), srcset, texto JSON);
    # links de compartilhar (?u=https://consumedolhos...) continuam completos.
    text = re.sub(r'(["\'(\s,;])' + HOST_RE + r'(?=["\')\s&])', r'\1/', text)  # domínio sozinho -> "/"
    return re.sub(r'(["\'(\s,;])' + HOST_RE + r'(?=\\?/)', r'\1', text)


def process_html(t):
    keep = []
    t = PROTECT.sub(lambda m: (keep.append(m.group(0)), f'\x00{len(keep)-1}\x00')[1], t)
    t = HEAD_JUNK.sub('', t)
    t = relativize(t)
    t = re.sub('\x00(\\d+)\x00', lambda m: keep[int(m.group(1))], t)
    if INJECT not in t:
        t = t.replace('</body>', INJECT + '\n</body>', 1)
    return t


AJUSTES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ajustes.json'), encoding='utf-8'))


def process_file(path):
    with open(path, encoding='utf-8', errors='surrogateescape') as f:
        t = f.read()
    t = process_html(t) if path.endswith('.html') else relativize(t)
    for a in AJUSTES:  # mudanças de conteúdo pedidas pela clínica (ver ajustes.json)
        t = t.replace(a['de'], a['para'])
    with open(path, 'w', encoding='utf-8', errors='surrogateescape') as f:
        f.write(t)


# 1) copia, tirando "?ver=..." dos nomes de arquivo
if os.path.exists(out):
    shutil.rmtree(out)
for d, _, files in os.walk(src):
    for name in files:
        clean = name.split('?')[0]
        rel = os.path.relpath(os.path.join(d, clean), src)
        dst = os.path.join(out, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst):
            shutil.copy2(os.path.join(d, name), dst)

# 2) páginas especiais vindas do original: 404 e busca
shutil.copy(os.path.join(extras, '404.html'), os.path.join(out, '404.html'))
os.makedirs(os.path.join(out, 'busca'), exist_ok=True)
t = open(os.path.join(extras, 'olho.html'), encoding='utf-8').read()
t = re.sub(r'<title>.*?</title>', '<title>Resultados da pesquisa &#8211; Consumed</title>', t, flags=re.S)
t = t.replace('<h1>olho</h1>', '<h1 id="busca-titulo"></h1>')
t = t.replace('<span class="current">Search results for: olho</span>',
              '<span class="current" id="busca-trilha">Search results for: </span>')
start = t.index('<div class="col-md-8"><div class="row">') + len('<div class="col-md-8"><div class="row">')
end = t.index('<div class="pagination">', start)
t = t[:start] + '<div id="busca-resultados"></div></div>' + t[end:]
t = re.sub(r'<div class="pagination">.*?</div>', '<div class="pagination"></div>', t, count=1, flags=re.S)
t = re.sub(r'(name="s" placeholder="[^"]*" value=")olho(")', r'\1\2', t)
open(os.path.join(out, 'busca', 'index.html'), 'w', encoding='utf-8').write(t)

# 3) índice de busca (posts e páginas, como o WordPress faz)
def strip(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))).strip()

index = []
for kind in ('posts', 'pages'):
    for p in json.load(open(os.path.join(extras, f'api_{kind}.json'), encoding='utf-8')):
        if p.get('status', 'publish') != 'publish':
            continue
        exc = strip(p.get('excerpt', {}).get('rendered')) or strip(p['content']['rendered'])[:300]
        index.append({
            'id': p['id'], 'url': re.sub(HOST_RE, '', p['link']) or '/',
            'titulo': html.unescape(p['title']['rendered']),
            'resumo': exc, 'texto': strip(p['content']['rendered']), 'data': p['date'],
        })
json.dump(index, open(os.path.join(out, 'busca', 'indice.json'), 'w', encoding='utf-8'), ensure_ascii=False)

# 4) reescreve endereços em todos os arquivos de texto
for d, _, files in os.walk(out):
    for name in files:
        if name.endswith(TEXT_EXT):
            process_file(os.path.join(d, name))

# 5) arquivos próprios da cópia (script dos formulários/busca)
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'extra')
for name in os.listdir(here):
    shutil.copy(os.path.join(here, name), os.path.join(out, name))
print('ok:', sum(len(f) for _, _, f in os.walk(out)), 'arquivos')
