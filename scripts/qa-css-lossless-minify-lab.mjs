// LUEN lossless stylesheet whitespace/comment compression — CI-only A/B.
// Do NOT re-order, merge, delete, or normalize CSS rules, values, selectors.
// Exact PostCSS AST parity (except comments) is a required precondition.
// Neither browser candidate nor source files are ever deployed by this script.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { chromium, webkit } from 'playwright';
import { spawnSync } from 'node:child_process';
const ROOT=process.cwd();
const cssPaths=['assets/css/site.css','assets/css/luen-v3.css'];
const out='qa-screenshots/css-lossless-minify-lab';
const hostRoot='qa-temp-css-lossless';
const ports={baseline:4213,candidate:4214};
fs.mkdirSync(out,{recursive:true});

const children=node=>node.nodes?.map(n=>n.type==='comment'?null:semantic(n)).filter(Boolean)||null;
const semantic=node=>{
 switch(node.type){
  case 'root':return {type:'root',nodes:children(node)};
  case 'rule':return {type:'rule',selector:node.selector,nodes:children(node)};
  case 'atrule':return {type:'atrule',name:node.name,params:node.params,nodes:children(node)};
  case 'decl':return {type:'decl',prop:node.prop,value:node.value,important:!!node.important};
  default:throw Error('Unexpected CSS syntax '+node.type);
 }
};
const compact=node=>{
 switch(node.type){
  case 'root':return (node.nodes||[]).map(compact).join('');
  case 'comment':return node.text.trim().startsWith('!')?'/*'+node.text+'*/':'';
  case 'rule':return node.selector+'{'+(node.nodes||[]).map(compact).join('')+'}';
  case 'atrule':return '@'+node.name+(node.params?' '+node.params:'')+
    (node.nodes?'{'+node.nodes.map(compact).join('')+'}':';');
  case 'decl':return node.prop+':'+node.value+(node.important?'!important':'')+';';
  default:throw Error('Unknown CSS syntax '+node.type);
 }
};
const zipped=s=>Buffer.byteLength(s);
const summaries=[];
const prepare=()=>{
 const base=path.join(hostRoot,'baseline'),candidate=path.join(hostRoot,'candidate');
 for(const dir of [base,candidate])fs.mkdirSync(path.join(dir,'assets'),{recursive:true});
 fs.writeFileSync(path.join(base,'index.html'),fs.readFileSync('index.html'));
 fs.writeFileSync(path.join(candidate,'index.html'),fs.readFileSync('index.html'));
 if(!fs.existsSync(path.join(base,'assets/css')))
  fs.symlinkSync(path.join(ROOT,'assets/css'),path.join(base,'assets/css'),'dir');
 const cssDir=path.join(candidate,'assets/css');fs.mkdirSync(cssDir,{recursive:true});
 for(const name of fs.readdirSync(path.join(ROOT,'assets'))){
  if(name==='css')continue;
  const link=path.join(candidate,'assets',name);
  if(!fs.existsSync(link))fs.symlinkSync(path.join(ROOT,'assets',name),link,
    fs.statSync(path.join(ROOT,'assets',name)).isDirectory()?'dir':'file');
 }
 const minPaths=new Set(cssPaths.map(p=>path.basename(p)));
 for(const name of fs.readdirSync(path.join(ROOT,'assets/css'))){
  if(minPaths.has(name))continue;
  const link=path.join(cssDir,name);
  if(!fs.existsSync(link)){
   const full=path.join(ROOT,'assets/css',name);
   fs.symlinkSync(full,link,fs.statSync(full).isDirectory()?'dir':'file');
  }
 }
 for(const file of cssPaths){
  const original=fs.readFileSync(file,'utf8');
  const ast=postcss.parse(original,{from:file});
  const minified=compact(ast);
  const parsed=postcss.parse(minified,{from:file+'.min'});
  assert.deepEqual(semantic(ast),semantic(parsed),'CSS declaration/cascade AST changed for '+file);
  if(minified.length>=original.length)throw Error('CSS did not shrink: '+file);
  fs.writeFileSync(path.join(cssDir,path.basename(file)),minified);
  const row={file,sourceBytes:zipped(original),minBytes:zipped(minified),
   sourceGzip:gzipSync(original,{level:9}).length,minGzip:gzipSync(minified,{level:9}).length,
   sourceBrotli:brotliCompressSync(original).length,minBrotli:brotliCompressSync(minified).length,
   matchedDeclarations:(ast.nodes||[]).length,astIdentical:true};
  summaries.push(row);
  console.log('LUEN_CSS_LOSSLESS_BYTES '+JSON.stringify(row));
 }
 fs.writeFileSync(path.join(out,'preparation.json'),JSON.stringify(summaries,null,2));
};

if(process.argv.includes('--prepare')){
 prepare();
 process.exit(0);
}

const cli=path.resolve('node_modules/.bin/lighthouse');
const chrome=chromium.executablePath(),samples=[],errors=[];
for(const device of ['mobile','desktop']){
 for(let i=1;i<=(device==='mobile'?3:2);i++){
  for(const variant of i%2?['baseline','candidate']:['candidate','baseline']){
   const filename=path.join(out,device+'-'+i+'-'+variant+'.json');
   const args=['http://127.0.0.1:'+ports[variant]+'/',
    '--quiet','--only-categories=performance','--output=json',
    '--output-path='+filename,'--throttling-method=simulate',
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
    device==='desktop'?'--preset=desktop':'--form-factor=mobile'];
   const p=spawnSync(cli,args,{env:{...process.env,CHROME_PATH:chrome},timeout:150000,
    encoding:'utf8',maxBuffer:5e6});
   if(p.status!==0||!fs.existsSync(filename)){
    errors.push('Lighthouse '+device+'/'+i+'/'+variant+':'+String(p.stderr||p.error).slice(-300));
    continue;
   }
   const report=JSON.parse(fs.readFileSync(filename,'utf8'));
   const a=report.audits||{},val=k=>a[k]?.numericValue??null;
   const net=a['network-requests']?.details?.items||[];
   const row={device,i,variant,score:Math.round((report.categories?.performance?.score||0)*100),
    LCP:val('largest-contentful-paint'),FCP:val('first-contentful-paint'),
    TBT:val('total-blocking-time'),CLS:val('cumulative-layout-shift'),
    bytes:val('total-byte-weight'),requests:net.length,
    cssRequests:cssPaths.map(file=>({file,count:net.filter(r=>
      (r.url||'').includes('/'+file)).length}))};
   console.log('LUEN_CSS_LOSSLESS_LH_SAMPLE '+JSON.stringify(row));
   samples.push(row);
  }
 }
}

const visual=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const pages={};
   for(const variant of ['baseline','candidate']){
    const context=await browser.newContext({viewport:{width,height:880},deviceScaleFactor:1,
      reducedMotion:'reduce'});
    const page=await context.newPage(),jsErrors=[],styles=[];
    page.on('pageerror',e=>jsErrors.push(e.message));
    page.on('response',r=>{
     if(cssPaths.some(file=>r.url().includes('/'+file)))
      styles.push({url:r.url(),status:r.status()});
    });
    await page.goto('http://127.0.0.1:'+ports[variant]+'/',{waitUntil:'load',timeout:50000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(500);
    const data=await page.evaluate(()=>{
     const sels=['.hero h1','.hero-desc','.luen-motion-showcase','#cases .luen-case-entry',
      '#services .luen-service-choice','#selected-content .portfolio-card',
      '#faq .faq-cta','footer .footer-links a'];
     const boxes=sels.map(sel=>{
      const e=document.querySelector(sel);
      if(!e)return {sel,missing:true};
      const r=e.getBoundingClientRect(),c=getComputedStyle(e);
      return {sel,text:e.textContent.trim().slice(0,90),w:r.width,h:r.height,
       font:c.fontFamily,size:c.fontSize,line:c.lineHeight,weight:c.fontWeight,
       color:c.color,bg:c.backgroundColor,display:c.display,opacity:c.opacity};
     });
     return {boxes,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      cases:document.querySelectorAll('#cases .luen-case-entry').length,
      services:document.querySelectorAll('#services .luen-service-choice').length,
      cta:document.querySelectorAll('#services .luen-service-unified-cta').length,
      reels:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone):not(.ios-loop-clone) .portfolio-card.portrait').length};
    });
    pages[variant]={data,jsErrors,styles};
    await context.close();
   }
   const a=pages.baseline,b=pages.candidate,fail=[];
   for(let k=0;k<a.data.boxes.length;k++){
    const x=a.data.boxes[k],y=b.data.boxes[k];
    if(x.missing||y.missing||x.text!==y.text||
       Math.abs(x.w-y.w)>1||Math.abs(x.h-y.h)>1||
       ['font','size','line','weight','color','bg','display','opacity'].some(prop=>x[prop]!==y[prop]))
      fail.push('Visual geometry/style mismatch: '+x.sel);
   }
   if(b.data.overflow>2||b.data.cases!==4||b.data.services!==3||b.data.cta!==1||b.data.reels!==6)
    fail.push('Homepage content structure changed or overflow');
   if(b.styles.length!==2||b.styles.some(r=>r.status!==200)||b.jsErrors.length)
    fail.push('CSS HTTP status or page JS error: '+JSON.stringify(b.styles));
   visual.push({engine:engine.name(),width,baselineStyles:a.styles.length,
    candidateStyles:b.styles.length,errors:fail});
   errors.push(...fail.map(e=>engine.name()+'/'+width+': '+e));
   console.log('LUEN_CSS_LOSSLESS_VISUAL '+JSON.stringify(visual.at(-1)));
  }
 }finally{await browser.close();}
}
const median=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);
 return b.length?(b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2):null;};
const summary=[];
for(const device of ['mobile','desktop']){
 const row={device};
 for(const variant of ['baseline','candidate']){
  const rows=samples.filter(x=>x.device===device&&x.variant===variant);
  row[variant]={n:rows.length};
  for(const metric of ['score','LCP','FCP','TBT','CLS','bytes','requests'])
   row[variant][metric]=median(rows.map(x=>x[metric]));
 }
 row.delta={};
 for(const metric of ['score','LCP','FCP','TBT','CLS','bytes','requests'])
  row.delta[metric]=row.candidate[metric]!==null&&row.baseline[metric]!==null?
   +(row.candidate[metric]-row.baseline[metric]).toFixed(metric==='CLS'?4:1):null;
 summary.push(row);
}
const output={summary,visual,errors,scope:'Lossless declaration/cascade AST parity, no production site changes'};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(output,null,2));
console.log('LUEN_CSS_LOSSLESS_SUMMARY '+JSON.stringify(output));
if(process.env.GITHUB_STEP_SUMMARY){
 let md='## LUEN lossless CSS compression experiment — synthetic (not deployed)\n\n';
 md+='| Device | Version | N | Score | LCP ms | FCP ms | TBT ms | CLS | Bytes |\n';
 md+='|---|---|---:|---:|---:|---:|---:|---:|\n';
 for(const r of summary)for(const v of ['baseline','candidate']){
  const d=r[v],fmt=k=>d[k]===null?'—':k==='CLS'?d[k].toFixed(3):Math.round(d[k]);
  md+='| '+r.device+' | '+v+' | '+d.n+' | '+['score','LCP','FCP','TBT','CLS','bytes'].map(fmt).join(' | ')+' |\n';
 }
 md+='\nDo not deploy without full mobile/iPhone QA and repeatable LCP benefit.\n';
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(samples.length!==10||errors.length)process.exitCode=1;
