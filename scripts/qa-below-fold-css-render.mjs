// Controlled performance laboratory. Never touches published index.html.
// The only candidate delta is making two *below-fold-only* section stylesheets
// non-render-blocking, with noscript fallback. Hero CSS and all JS unchanged.
// No forms are submitted. Lighthouse lab data is NOT field CWV.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';

const root=process.cwd(),html=fs.readFileSync('index.html','utf8');
const targets=[
  '/assets/css/services-editorial.css?v=20261029-clean-hierarchy-4',
  '/assets/css/signature-case-index.css?v=20261029-1'
];
let candidate=html;
for(const href of targets){
  const tag=`<link rel="stylesheet" href="${href}"/>`;
  if(!candidate.includes(tag)||candidate.split(tag).length!==2)
    throw Error('CSS anchor changed, abort: '+href);
  const nonblocking=`<link rel="stylesheet" href="${href}" media="print" onload="this.onload=null;this.media='all'"/>`+
    `<noscript><link rel="stylesheet" href="${href}"/></noscript>`;
  candidate=candidate.replace(tag,nonblocking);
}
const dirs={baseline:'qa-temp-css-render/baseline',candidate:'qa-temp-css-render/candidate'};
for(const [name,dir] of Object.entries(dirs)){
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'index.html'),name==='baseline'?html:candidate);
 const assets=path.join(dir,'assets');
 if(!fs.existsSync(assets))fs.symlinkSync(path.join(root,'assets'),assets,'dir');
}
const ports={baseline:4193,candidate:4194};
const reportDir='qa-screenshots/below-fold-css-render';
fs.mkdirSync(reportDir,{recursive:true});
const runs=[],errors=[];
const cli=path.resolve('node_modules/.bin/lighthouse'),chrome=chromium.executablePath();
if(!fs.existsSync(cli)||!fs.existsSync(chrome))throw Error('Lighthouse or Chromium missing');
for(const device of ['mobile','desktop']){
 for(let i=1;i<=(device==='mobile'?3:2);i++){
  for(const name of i%2?['baseline','candidate']:['candidate','baseline']){
   const filename=path.join(reportDir,`${device}-${i}-${name}.json`);
   const args=[`http://127.0.0.1:${ports[name]}/`,'--quiet','--only-categories=performance',
     '--output=json','--output-path='+filename,'--throttling-method=simulate',
     '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
     device==='desktop'?'--preset=desktop':'--form-factor=mobile'];
   const p=spawnSync(cli,args,{env:{...process.env,CHROME_PATH:chrome},timeout:140000,encoding:'utf8',maxBuffer:6e6});
   if(p.status!==0||!fs.existsSync(filename)){
     errors.push('Lighthouse '+device+'/'+i+'/'+name+': '+String(p.stderr||p.error).slice(-320));continue;
   }
   const r=JSON.parse(fs.readFileSync(filename,'utf8'));const a=r.audits||{},v=k=>a[k]?.numericValue??null;
   const net=a['network-requests']?.details?.items||[];
   const sample={device,iteration:i,variant:name,score:Math.round((r.categories?.performance?.score||0)*100),
     LCP:v('largest-contentful-paint'),FCP:v('first-contentful-paint'),
     TBT:v('total-blocking-time'),CLS:v('cumulative-layout-shift'),
     bytes:v('total-byte-weight'),requestCount:net.length,
     observedCSS:targets.map(target=>({target,count:net.filter(x=>(x.url||'').includes(target)).length}))};
   runs.push(sample);
   console.log('LUEN_CSS_RENDER_SAMPLE '+JSON.stringify(sample));
  }
 }
}
const median=arr=>{const a=arr.filter(Number.isFinite).sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const summary=[];
for(const device of ['mobile','desktop']){
 const row={device};
 for(const name of ['baseline','candidate']){
  const list=runs.filter(x=>x.device===device&&x.variant===name);
  row[name]={n:list.length};
  for(const k of ['score','LCP','FCP','TBT','CLS','bytes','requestCount'])
    row[name][k]=median(list.map(x=>x[k]));
 }
 row.delta={};
 for(const k of ['score','LCP','FCP','TBT','CLS','bytes','requestCount']){
   const a=row.baseline[k],b=row.candidate[k];
   row.delta[k]=a===null||b===null?null:+(b-a).toFixed(k==='CLS'?4:1);
 }
 summary.push(row);
}
const browserRuns=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const sites={};
   for(const name of ['baseline','candidate']){
    const context=await browser.newContext({
      viewport:{width,height:880},reducedMotion:'reduce',deviceScaleFactor:1
    });
    const page=await context.newPage(),pageErrors=[],cssResponses=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    page.on('response',r=>{
      if(targets.some(t=>r.url().includes(t.split('?')[0])))
        cssResponses.push({url:r.url(),status:r.status()});
    });
    await page.addInitScript(()=>{
      window.__cssShift=0;
      try{new PerformanceObserver(l=>{
        for(const x of l.getEntries())if(!x.hadRecentInput)window.__cssShift+=x.value;
      }).observe({type:'layout-shift',buffered:true});}catch{}
    });
    await page.goto(`http://127.0.0.1:${ports[name]}/`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(targets=>{
       return targets.every(h=>{
        const l=[...document.querySelectorAll('link[rel="stylesheet"]')].find(e=>e.href.includes(h));
        return !!l&&(l.media==='all'||l.media==='')&&!!l.sheet;
       });
    },targets,{timeout:40000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(450);
    const state=await page.evaluate(()=>{
      const selectors=['.hero-copy h1','.hero-desc','.luen-motion-showcase','#services .luen-service-choice','#cases .luen-case-entry'];
      const cards=selectors.map(sel=>{
        const e=document.querySelector(sel);if(!e)return {sel,missing:true};
        const r=e.getBoundingClientRect(),css=getComputedStyle(e);
        return {sel,top:r.top,width:r.width,height:r.height,display:css.display,fontFamily:css.fontFamily};
      });
      return {cards,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        cases:document.querySelectorAll('#cases .luen-case-entry').length,
        services:document.querySelectorAll('#services .luen-service-choice').length,
        unifiedCTA:document.querySelectorAll('#services .luen-service-unified-cta').length,
        shift:window.__cssShift,styles:[...document.querySelectorAll('link[href*="editorial.css"],link[href*="signature-case-index.css"]')].map(x=>({media:x.media,hasSheet:!!x.sheet}))};
    });
    sites[name]={...state,pageErrors,cssResponses};
    await context.close();
   }
   const fail=[];
   for(const name of ['baseline','candidate']){
     const s=sites[name];
     if(s.pageErrors.length||s.overflow>2||s.cases!==4||s.services!==3||s.unifiedCTA!==1||s.cssResponses.length!==2||s.cssResponses.some(r=>r.status!==200))
       fail.push(name+' unexpected pages/links/render state: '+JSON.stringify(s).slice(0,600));
   }
   for(let k=0;k<sites.baseline.cards.length;k++){
     const a=sites.baseline.cards[k],b=sites.candidate.cards[k];
     if(a.missing||b.missing||Math.abs(a.width-b.width)>2||Math.abs(a.height-b.height)>2||a.display!==b.display)
       fail.push('post-load geometry changed '+a.sel);
   }
   // Candidate must not introduce meaningful additional CLS on initial load.
   if(sites.candidate.shift>sites.baseline.shift+0.01)
     fail.push('candidate added CLS '+sites.baseline.shift.toFixed(3)+' to '+sites.candidate.shift.toFixed(3));
   const row={engine:engine.name(),width,baselineShift:sites.baseline.shift,candidateShift:sites.candidate.shift,
     geometriesStable:!fail.length,cssLoaded:sites.candidate.cssResponses.length,fail};
   browserRuns.push(row);errors.push(...fail.map(x=>engine.name()+'/'+width+': '+x));
   console.log('LUEN_CSS_RENDER_VISUAL '+JSON.stringify(row));
  }
 }finally{await browser.close();}
}
const report={scope:'LAB ONLY — unchanged hero fonts, motion and images; no DNS or Formspree changes',
  baselineSha:process.env.LUEN_MAIN_SHA||'main',summary,browserRuns,errors};
fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify(report,null,2));
console.log('LUEN_CSS_RENDER_SUMMARY '+JSON.stringify({summary,browserRuns,errors}));
if(process.env.GITHUB_STEP_SUMMARY){
 let md='## LUEN below-fold CSS render-path experiment (no deploy)\n\n';
 md+='| Device | Version | N | Score | LCP ms | FCP ms | TBT ms | CLS | Bytes |\n';
 md+='|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
 for(const r of summary)for(const v of ['baseline','candidate']){
  const z=r[v],fmt=k=>z[k]==null?'—':k==='CLS'?z[k].toFixed(3):Math.round(z[k]);
  md+='| '+r.device+' | '+v+' | '+z.n+' | '+['score','LCP','FCP','TBT','CLS','bytes'].map(fmt).join(' | ')+' |\n';
 }
 md+='\nVisual CSS smoke: '+(errors.length?'FAIL '+errors.length:'PASS 6 scenarios')+'.\n';
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(runs.length!==10||errors.length)process.exitCode=1;
