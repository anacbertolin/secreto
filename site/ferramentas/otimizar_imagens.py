"""Deixa as imagens do site mais leves, sem mudar nenhum endereço nas páginas.

Uso: python3 ferramentas/otimizar_imagens.py public

Para cada .jpg/.jpeg/.png:
  1. reduz para no máximo LADO_MAX pixels no lado maior (fotos de celular vinham com 2560+);
  2. regrava o próprio arquivo mais leve (JPEG progressivo q82; PNG otimizado sem perda);
  3. cria ao lado uma versão WebP (ex.: foto.jpg -> foto.jpg.webp), entregue pelo servidor
     (Caddyfile) a navegadores que aceitam WebP.
Só troca um arquivo se a versão nova for realmente menor. Arquivos que já têm o .webp ao lado
são pulados, e JPEG já progressivo não é recomprimido: pode rodar de novo sem perder qualidade.
"""
import os
import sys

from PIL import Image, ImageOps

LADO_MAX = 1920
QUALIDADE_JPEG = 82
QUALIDADE_WEBP = 80
EXTS = ('.jpg', '.jpeg', '.png')


def salvar_se_menor(img, destino, tamanho_atual, **opts):
    tmp = destino + '.tmp'
    img.save(tmp, **opts)
    novo = os.path.getsize(tmp)
    if novo < tamanho_atual * 0.95:
        os.replace(tmp, destino)
        return novo
    os.remove(tmp)
    return None


def otimizar(caminho):
    antes = os.path.getsize(caminho)
    with Image.open(caminho) as aberto:
        fmt = aberto.format
        img = ImageOps.exif_transpose(aberto)
        img.load()
    reduzida = max(img.size) > LADO_MAX
    if reduzida:
        img.thumbnail((LADO_MAX, LADO_MAX), Image.LANCZOS)

    # 1+2) regrava o original (JPEG já progressivo = já otimizado antes; não recomprime de novo)
    ja_feito = fmt == 'JPEG' and aberto_progressivo(caminho) and not reduzida
    if fmt == 'JPEG' and not ja_feito:
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        salvar_se_menor(img, caminho, antes if not reduzida else float('inf'),
                        format='JPEG', quality=QUALIDADE_JPEG, optimize=True, progressive=True)
    elif fmt == 'PNG':
        salvar_se_menor(img, caminho, antes if not reduzida else float('inf'),
                        format='PNG', optimize=True)
    depois = os.path.getsize(caminho)

    # 3) versão WebP, só se ficar menor que o original
    webp = caminho + '.webp'
    tem_alfa = img.mode in ('RGBA', 'LA', 'P')
    img.convert('RGBA' if tem_alfa else 'RGB').save(webp, format='WEBP', quality=QUALIDADE_WEBP, method=6)
    if os.path.getsize(webp) >= depois * 0.95:
        os.remove(webp)
        return antes, depois, depois
    return antes, depois, os.path.getsize(webp)


def aberto_progressivo(caminho):
    with Image.open(caminho) as i:
        return bool(i.info.get('progressive') or i.info.get('progression'))


def main(raiz):
    total_antes = total_depois = total_webp = n = 0
    for d, _, arquivos in os.walk(raiz):
        for nome in arquivos:
            if not nome.lower().endswith(EXTS):
                continue
            c = os.path.join(d, nome)
            if os.path.exists(c + '.webp'):
                continue
            try:
                a, b, w = otimizar(c)
            except Exception as e:  # imagem corrompida/estranha: deixa como está
                print('pulei', c, e)
                continue
            n += 1
            total_antes += a
            total_depois += b
            total_webp += w
    mb = lambda x: f'{x / 1048576:.1f} MB'
    print(f'{n} imagens | antes {mb(total_antes)} | original otimizado {mb(total_depois)} | WebP {mb(total_webp)}')


if __name__ == '__main__':
    main(sys.argv[1])
