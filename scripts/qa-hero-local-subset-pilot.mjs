// One-file hero font preload A/B. Temporary CI-generated WOFF2 is never
// committed or uploaded. The source Pretendard CDN fallback is retained.
import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
const output='qa-screenshots/hero-local-subset-pilot';
fs.mkdirSync(output,{recursive:true});
const variants={baseline:'http://127.0.0.1:4283/',candidate:'http://127.0.0.1:4284/'};
const meta=JSON.parse(fs.readFileSync('qa-temp-hero-font/metadata.json','utf8'));
const src=fs.readFileSync('index.html','utf8');
const link='<link rel="preload" href="/qa-font/pretendard-hero-ci-only.woff2" as="font" type="font/woff2" crossorigin/>'+
 '<link rel="stylesheet" href="/qa-font/hero.css"/>';
for(const [name,html] of Object.entries({
 baseline:src,candidate:src.replace('</head>',link+'\n</head>')
})){
 const root=path.resolve('qa-temp-hero-site',name);
 fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'index.html'),html);
 fs.symlinkSync(path.resolve('assets'),path.join(root,'assets'),'dir');
 if(name==='candidate'){
  const dest=path.join(root,'qa-font');fs.mkdirSync(dest,{recursive:true});
  fs.copyFileSync('qa-temp-hero-font/pretendard-hero-ci-only.woff2',
   path.join(dest,'pretendard-hero-ci-only.woff2'));
  fs.copyFileSync('qa-temp-hero-font/hero.css',path.join(dest,'hero.css'));
 }
}
const records=[],errors=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [390,1440]){
   for(const name of ['baseline','candidate']){
    const context=await browser.newContext({viewport:{width,height:900},
      deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage(),fontNetwork=[];
    page.on('response',r=>{if(/woff2?/.test(r.url()))
      fontNetwork.push({url:r.url().slice(0,160),status:r.status()});});
    if(engine===chromium){
     const cdp=await context.newCDPSession(page);
     await cdp.send('Network.enable');
     await cdp.send('Network.emulateNetworkConditions',{
       offline:false,latency:140,downloadThroughput:220000,uploadThroughput:90000});
     await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    }
    await page.addInitScript(()=>{
     window.__heroShift=[];
     try{new PerformanceObserver(list=>{
      for(const entry of list.getEntries())if(!entry.hadRecentInput)
       window.__heroShift.push({at:entry.startTime,value:entry.value});
     }).observe({type:'layout-shift',buffered:true});}catch{}
    });
    await page.goto(variants[name],{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(11000);
    await page.evaluate(()=>document.fonts.ready);
    const state=await page.evaluate(()=>{
      const rect=s=>{const e=document.querySelector(s);const b=e.getBoundingClientRect();
       return {top:b.top,width:b.width,height:b.height,
         font:getComputedStyle(e).fontFamily};};
      return {CLS:window.__heroShift.reduce((s,x)=>s+x.value,0),
        h1:rect('.hero h1'),desc:rect('.hero-desc'),
        fontFaces:[...document.fonts].filter(f=>/LUEN Hero Pretendard/.test(f.family)&&f.status==='loaded').length,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        cases:document.querySelectorAll('#cases .luen-case-entry').length,
        services:document.querySelectorAll('#services .luen-service-choice').length
      };
    });
    const row={engine:engine.name(),width,variant:name,
      CLS:+state.CLS.toFixed(5),h1:state.h1,desc:state.desc,
      subsetResponses:fontNetwork.filter(r=>r.status===200&&r.url.includes('pretendard-hero-ci-only')).length,
      loadedSubsetFaces:state.fontFaces,overflow:state.overflow,
      cases:state.cases,services:state.services};
    if(name==='candidate'&&(!row.subsetResponses||!row.loadedSubsetFaces))
      errors.push(engine.name()+'/'+width+': local subset not successfully loaded');
    if(row.overflow>2||row.cases!==4||row.services!==3)
      errors.push(engine.name()+'/'+width+': layout or section count invalid');
    records.push(row);
    console.log('LUEN_HERO_SUBSET_PILOT_SAMPLE '+JSON.stringify(row));
    await context.close();
   }
  }
 }finally{await browser.close();}
}
for(const engine of ['chromium','webkit'])for(const width of [390,1440]){
 const a=records.find(r=>r.engine===engine&&r.width===width&&r.variant==='baseline');
 const b=records.find(r=>r.engine===engine&&r.width===width&&r.variant==='candidate');
 if(Math.abs(a.h1.height-b.h1.height)>2||
    Math.abs(a.desc.height-b.desc.height)>2||
    Math.abs(a.h1.width-b.h1.width)>2||
    Math.abs(a.desc.width-b.desc.width)>2)
   errors.push(engine+'/'+width+': visible post-load hero geometry differs');
}
const report={meta,records,errors,
 warning:'Temporary font scope for CI only. Browser/WebKit geometry is not real iPhone QA; Lighthouse and usability still required.'};
fs.writeFileSync(output+'/summary.json',JSON.stringify(report,null,2)+'\n');
console.log('LUEN_HERO_SUBSET_PILOT_SUMMARY '+JSON.stringify({meta,records,errors}));
if(errors.length)process.exitCode=1;
