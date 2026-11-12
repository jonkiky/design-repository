const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {build} = require('../../chatbot-system-poc-1106/frontend/node_modules/esbuild');
const root = path.resolve(__dirname, '..');
const deps = path.resolve(root, '../chatbot-system-poc-1106/frontend/node_modules');
async function main() {
  await build({entryPoints:[path.join(root,'src/main.tsx')],bundle:true,format:'iife',platform:'browser',target:['es2022'],jsx:'automatic',nodePaths:[deps],outfile:path.join(root,'assets/app.js'),minify:true,legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
  // The baseline used many hard-coded blue-gray colors. Convert that palette to
  // shared tokens so every original screen responds to the same theme switch.
  let css=fs.readFileSync(path.join(root,'assets/app.css'),'utf8');
  css=css.replace(/#[0-9a-f]{6,8}\b/gi, original=>{
    if(original.length!==7)return original;
    const rgb=[1,3,5].map(i=>parseInt(original.slice(i,i+2),16));
    const [r,g,b]=rgb; const light=(Math.max(...rgb)+Math.min(...rgb))/510;
    if(b>r&&b>g&&b-r>8){
      if(light>.94)return 'var(--surface-soft)';
      if(light>.86)return 'var(--line)';
      if(light>.72)return 'var(--muted)';
      if(light>.45)return 'var(--ink-soft)';
      return 'var(--accent)';
    }
    return original;
  });
  css+='\n'+fs.readFileSync(path.join(root,'src/themes.css'),'utf8');
  // Route every legacy chromatic color through a theme token. This keeps the
  // original cascade and fixed-position overlays intact, unlike a CSS filter.
  // A&O and Cooley use the exact original fallback. The Harvey family starts
  // neutral; the blue/red editions add controlled accents in their own layer.
  const monochrome=new Map();
  css=css.replace(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/gi,(original,hex)=>{
    hex=hex.toLowerCase();
    if(hex.length<5)hex=[...hex].map(c=>c+c).join('');
    const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
    if(r===g&&g===b)return original;
    const gray=Math.round(.2126*r+.7152*g+.0722*b).toString(16).padStart(2,'0');
    const token='--mono-'+hex;
    monochrome.set(token,'#'+gray.repeat(3)+hex.slice(6));
    return 'var('+token+','+original+')';
  });
  css+='\nhtml:is([data-theme=harvey],[data-theme=harvey-blue],[data-theme=harvey-red],[data-theme=harvey-bright-blue]){'+[...monochrome].map(([key,value])=>key+':'+value).join(';')+'}\n';
  css+=fs.readFileSync(path.join(root,'src/harvey.css'),'utf8');
  css+='\n'+fs.readFileSync(path.join(root,'src/harvey-accents.css'),'utf8');
  css+='\n'+fs.readFileSync(path.join(root,'src/harvey-bright-blue.css'),'utf8');
  css+='\n'+fs.readFileSync(path.join(root,'src/harvey-type.css'),'utf8');
  fs.writeFileSync(path.join(root,'assets/app.css'),css);
  const cssVersion=createHash('sha256').update(css).digest('hex').slice(0,12);
  const jsVersion=createHash('sha256').update(fs.readFileSync(path.join(root,'assets/app.js'))).digest('hex').slice(0,12);
  const pages={index:'',harvey:'harvey','harvey-black-white':'harvey','harvey-blue':'harvey-blue','harvey-red':'harvey-red','harvey-bright-blue':'harvey-bright-blue','ao-shearman':'ao',cooley:'cooley'};
  const titles={index:'六种设计 · 自由切换',harvey:'黑白 · 法律研究工作台','harvey-black-white':'黑白 · 法律研究工作台','harvey-blue':'黑白蓝 · 法律研究工作台','harvey-red':'黑白红 · 法律研究工作台','harvey-bright-blue':'蓝灰 · 法律研究工作台','ao-shearman':'深庭 · 专业工作台',cooley:'珊瑚 · 灵感工作台'};
  for(const [name,theme] of Object.entries(pages)){
    fs.writeFileSync(path.join(root,name+'.html'),`<!doctype html>
<html lang="zh-CN" data-theme="${theme||'harvey'}"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="theme-color" content="#ffffff">
<title>裁研 · ${titles[name]}</title>
<script>(function(){var names=['harvey','harvey-blue','harvey-red','harvey-bright-blue','ao','cooley'];var t=new URLSearchParams(location.search).get('theme')||${JSON.stringify(theme)};try{if(!t)t=localStorage.getItem('caiyan-design-theme')}catch(e){}if(names.indexOf(t)<0)t='harvey';document.documentElement.dataset.theme=t})();</script>
<link rel="stylesheet" href="./assets/app.css?v=${cssVersion}"></head><body><div id="root"></div>
<noscript>请启用浏览器的 JavaScript 以使用裁研工作台。</noscript>
<script src="./assets/app.js?v=${jsVersion}" defer></script></body></html>\n`);
  }
  console.log('Built eight HTML entry points for six switchable designs.');
}
main().catch(error=>{console.error(error);process.exit(1)});
