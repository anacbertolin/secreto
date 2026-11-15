const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const d=process.argv[2];
const jobs=[['logo-branco.svg',1600],['logo-azul.svg',1600],['logo-fundo-azul.svg',1600],['simbolo-azul.svg',512],['simbolo-branco.svg',512],['perfil-redes-sociais.svg',1080],['favicon.svg',512],['favicon.svg',180,'apple-touch-icon.png'],['favicon.svg',32,'favicon-32.png']];
for(const [f,w,name] of jobs){const svg=fs.readFileSync(d+'/'+f,'utf8');const vb=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);const h=Math.round(w*vb[3]/vb[2]);
 const p=await b.newPage({viewport:{width:w,height:h}});await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
 await p.screenshot({path:d+'/'+(name||f.replace('.svg','.png')),omitBackground:true});await p.close();}
await b.close();})();
