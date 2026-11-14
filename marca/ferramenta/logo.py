import sys, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import os; FD=os.environ['FD']
fonts={w:TTFont(f'{FD}/Montserrat-Bold.ttf') for w in (600,700)}

def word(text, w, x, base, cap, track):
    """return (path_d, xmin, xmax) for text set at baseline with given cap height; track in px between glyph advances"""
    f=fonts[w]; gs=f.getGlyphSet(); cmap=f.getBestCmap(); upm=f['head'].unitsPerEm
    capH=f['OS/2'].sCapHeight; s=cap/capH
    d=[]; cx=x; xmin=None; xmax=None
    for ch in text:
        if ch==' ':
            cx+=f['hmtx'][cmap[32]][0]*s+track; continue
        g=cmap[ord(ch)]
        bp=BoundsPen(gs); gs[g].draw(bp)
        sp=SVGPathPen(gs); tp=TransformPen(sp,(s,0,0,-s,cx,base)); gs[g].draw(tp)
        d.append(sp.getCommands())
        if bp.bounds:
            x0=cx+bp.bounds[0]*s; x1=cx+bp.bounds[2]*s
            xmin=x0 if xmin is None else min(xmin,x0); xmax=x1 if xmax is None else max(xmax,x1)
        cx+=f['hmtx'][g][0]*s+track
    return ' '.join(d), xmin, xmax, cx

def glyph_runs(text, w, x, base, cap, gap, space):
    """posiciona letras pela caixa (bbox) com distância fixa entre elas"""
    f=fonts[w]; gs=f.getGlyphSet(); cmap=f.getBestCmap(); s=cap/f['OS/2'].sCapHeight
    d=[]; cx=x; first=None
    for ch in text:
        if ch==' ': cx+=space-gap; continue
        g=cmap[ord(ch)]; bp=BoundsPen(gs); gs[g].draw(bp); b0,_,b1,_=bp.bounds
        ox=cx-b0*s
        sp=SVGPathPen(gs); gs[g].draw(TransformPen(sp,(s,0,0,-s,ox,base))); d.append(sp.getCommands())
        if first is None: first=cx
        cx=ox+b1*s+gap
    return ' '.join(d), first, cx-gap

def eye(cx, cy, k=1.0):
    """olho listrado do logo original. k = escala (1 = tamanho medido no PNG: altura ~197)"""
    R,dd=101*k,21.9*k; ro,ri,rex=55*k,29.5*k,65*k
    pitch, sw = 19.6*k, 11*k
    lid_r, lid_off = 93*k, 28.5*k   # curva da pálpebra (borda interna dos cílios)
    tip=math.sqrt(R*R-dd*dd)
    lens=(f'M{cx:.2f} {cy-tip:.2f} A{R:.2f} {R:.2f} 0 0 1 {cx:.2f} {cy+tip:.2f} '
          f'A{R:.2f} {R:.2f} 0 0 1 {cx:.2f} {cy-tip:.2f} Z')
    def circ(r): return f'M{cx-r:.2f} {cy:.2f} a{r:.2f} {r:.2f} 0 1 0 {2*r:.2f} 0 a{r:.2f} {r:.2f} 0 1 0 {-2*r:.2f} 0 Z'
    stripes=''.join(f'M{cx+(i-2.5)*pitch-sw/2:.2f} {cy-tip-1:.2f}h{sw:.2f}v{2*tip+2:.2f}h{-sw:.2f}Z' for i in range(6))
    # região entre as pálpebras = interseção de dois círculos (sem cílios)
    hx=math.sqrt(lid_r**2-lid_off**2)
    mid=(f'M{cx-hx:.2f} {cy:.2f} A{lid_r:.2f} {lid_r:.2f} 0 0 1 {cx+hx:.2f} {cy:.2f} '
         f'A{lid_r:.2f} {lid_r:.2f} 0 0 1 {cx-hx:.2f} {cy:.2f} Z')
    return lens, mid, stripes, circ(ro)+' '+circ(ri)

def adv_runs(text, w, x, base, cap, track):
    """posiciona pelas larguras da fonte + espaçamento extra (como o original). '*' = O invisível; devolve centro do O"""
    f=fonts[w]; gs=f.getGlyphSet(); cmap=f.getBestCmap(); s=cap/f['OS/2'].sCapHeight
    d=[]; cx=x; eye_c=None; xmin=None; xmax=None
    for ch in text:
        g=cmap[ord('O' if ch=='*' else ch)]; adv=f['hmtx'][g][0]*s
        bp=BoundsPen(gs); gs[g].draw(bp)
        if bp.bounds:
            b0,_,b1,_=bp.bounds; a=cx+b0*s; b=cx+b1*s
            xmin=a if xmin is None else min(xmin,a); xmax=b if xmax is None else max(xmax,b)
            if ch=='*': eye_c=(a+b)/2
            else:
                sp=SVGPathPen(gs); gs[g].draw(TransformPen(sp,(s,0,0,-s,cx,base))); d.append(sp.getCommands())
        cx+=adv+track
    return ' '.join(d), xmin, xmax, eye_c
