import sys, os
sys.path.insert(0, sys.argv[1]); from logo import glyph_runs, eye, adv_runs
OUT=sys.argv[2]
CAP=133; BASE=157; CY=98.5; TIP=98.6
GAP=36; TRACK=float(os.environ.get('TRACK',10)); SUB_TRACK=float(os.environ.get('STRACK',8)); EYE_HALF=56; EYE_GAP=46
SUB_CAP=47; SUB_GAP=17; SUB_SPACE=33; SUB_TOP=211   # medidas tiradas do logo original
n=[0]
def uid(): n[0]+=1; return f'hob{n[0]}'

def eye_svg(cx, cy, ink, acc, k=1.0):
    lens, mid, stripes, ring = eye(cx, cy, k)
    a,b=uid(),uid()
    big=f'M{cx-400} {cy-400}h800v800h-800Z'
    return (f'<defs><clipPath id="{a}"><path d="{lens}"/></clipPath>'
            f'<clipPath id="{b}"><path clip-rule="evenodd" d="{big} {mid}"/></clipPath></defs>'
            f'<g clip-path="url(#{a})"><path fill="{acc}" clip-path="url(#{b})" d="{stripes}"/></g>'
            f'<path fill="{ink}" fill-rule="evenodd" d="{ring}"/>')

def lockup(big, sub, ink='#FFFFFF', acc=None, sub_ink=None, bg=None, pad=28):
    acc=acc or ink; sub_ink=sub_ink or ink
    d1,l0,r0,ecx=adv_runs(big,700,0,BASE,CAP,TRACK)
    left=min(l0,ecx-EYE_HALF); right=max(r0,ecx+EYE_HALF)
    d2=''; s0=ecx+EYE_HALF+EYE_GAP
    sbase=SUB_TOP+SUB_CAP
    _,a,b,_=adv_runs(sub,700,0,sbase,SUB_CAP,SUB_TRACK)
    w=b-a
    start = s0 if s0+w<=right else left+(right-left-w)/2   # como no original: começa depois do olho
    ds,_,_,_=adv_runs(sub,700,start-a,sbase,SUB_CAP,SUB_TRACK)
    top=CY-TIP; bot=max(sbase, CY+TIP)
    vx,vy,vw,vh=left-pad, top-pad, right-left+2*pad, bot-top+2*pad
    bgr=f'<rect x="{vx:.1f}" y="{vy:.1f}" width="{vw:.1f}" height="{vh:.1f}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx:.1f} {vy:.1f} {vw:.1f} {vh:.1f}" role="img" aria-label="Hospital de Olhos da Baixada">'
            f'<title>Hospital de Olhos da Baixada</title>{bgr}<path fill="{ink}" d="{d1} {d2}"/>{eye_svg(ecx,CY,ink,acc)}'
            f'<path fill="{sub_ink}" d="{ds}"/></svg>')

def simbolo(ink, acc, bg=None, circle=False):
    if circle:
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-130 -130 260 260" role="img" aria-label="Hospital de Olhos da Baixada">'
                f'<circle r="130" fill="{bg}"/>{eye_svg(0,0,ink,acc,0.95)}</svg>')
    bgr=f'<rect x="-64" y="-104" width="128" height="208" rx="0" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-64 -104 128 208" role="img" aria-label="Hospital de Olhos da Baixada">{bgr}{eye_svg(0,0,ink,acc)}</svg>')

def favicon(ink, bg):
    # quadrado, olho maior para ler em 16-32 px
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220"><rect x="-110" y="-110" width="220" height="220" rx="44" fill="{bg}"/>{eye_svg(0,0,ink,ink,1.0)}</svg>')

os.makedirs(OUT,exist_ok=True)
AZ='#1E3A5C'; BR='#FFFFFF'
files={
 'logo-branco.svg': lockup('H*SPITAL','DE OLHOS DA BAIXADA'),
 'logo-azul.svg': lockup('H*SPITAL','DE OLHOS DA BAIXADA', ink=AZ),
 'logo-fundo-azul.svg': lockup('H*SPITAL','DE OLHOS DA BAIXADA', bg=AZ, pad=70),
 'simbolo-azul.svg': simbolo(AZ,AZ),
 'simbolo-branco.svg': simbolo(BR,BR),
 'perfil-redes-sociais.svg': simbolo(BR,BR,bg=AZ,circle=True),
 'favicon.svg': favicon(BR,AZ),
}
for k,v in files.items(): open(os.path.join(OUT,k),'w').write(v)
print('ok')
