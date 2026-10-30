// Controlled LUEN proof of concept: one CI-generated homepage glyph subset.
// All font binaries are generated transiently and never uploaded/download-linked.
// This benchmark changes NO public repository HTML/CSS/JS or production DNS.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const cwd=process.cwd();
const source=fs.readFileSync('index.html','utf8');
const target=path.resolve('qa-temp-font-pilot');
const font=path.join(target,'pretendard-home-CI-ONLY.woff2');
const css=path.join(target,'pretendard-home.css');
const metadata=JSON.parse(fs.readFileSync(path.join(target,'meta.json'),'utf8'));
if(!fs.existsSync(font)||!fs.existsSync(css)||metadata.derived_bytes>650_000)
  throw Error('Temporary font subset missing or unexpectedly heavy; abort.');
const baseHtml=source;
const candHtml=source.replace('</head>','<link rel="stylesheet" href="/qa-font/pretendard-home.css" data-luen-font-subset-lab="temporary"/>\n</head>');
if(candHtml===baseHtml)throw Error('Candidate HTML not modified');
const roots={baseline:path.resolve('qa-temp-font-pilot/site-baseline'),candidate:path.resolve('qa-temp-font-pilot/site-candidate')};
for(const [name,root] of Object.entries(roots)){
 fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'index.html'),name==='baseline'?baseHtml:candHtml);
 const assetLink=path.join(root,'assets');
 if(!fs.existsSync(assetLink))fs.symlinkSync(path.join(cwd,'assets'),assetLink,'dir');
}
const dest=path.join(roots.candidate,'qa-font');
fs.mkdirSync(dest,{recursive:true});
fs.copyFileSync(font,path.join(dest,path.basename(font)));
fs.copyFileSync(css,path.join(dest,path.basename(css)));
const urls={baseline:'http://127.0.0.1:4183/',candidate:'http://127.0.0.1:4184/'};
const reportDir=path.resolve('qa-screenshots/home-font-subset-lab');
fs.mkdirSync(reportDir,{recursive:true});
const cli=path.resolve('node_modules/.bin/lighthouse');
const chrome=chromium.executablePath();
const samples=[],errors=[];
for(const device of ['mobile','desktop']){
 for(let n=1;n<=(device==='mobile'?3:2);n++){
  for(const variant of n%2?['baseline','candidate']:['candidate','baseline']){
    const out=path.join(reportDir,`${device}-${n}-${variant}.json`);
    const args=[urls[variant],'--quiet','--only-categories=performance',
      '--output=json','--output-path='+out,
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--throttling-method=simulate',device==='desktop'?'--preset=desktop':'--form-factor=mobile'];
    const proc=spawnSync(cli,args,{env:{...process.env,CHROME_PATH:chrome},timeout:150000,encoding:'utf8',maxBuffer:6e6});
    if(proc.status!==0||!fs.existsSync(out)){errors.push(`${device}/${n}/${variant} `+String(proc.stderr||proc.error).slice(-350));continue;}
    const a=JSON.parse(fs.readFileSync(out,'utf8'));const audits=a.audits||{},num=k=>audits[k]?.numericValue??null;
    const reqs=audits['network-requests']?.details?.items||[];
    const fonts=reqs.filter(r=>/\.(woff2?|otf)(\?|$)/.test(r.url||''));
    const targetSubset=reqs.filter(r=>(r.url||'').includes('pretendard-home-CI-ONLY.woff2'));
    const row={variant,device,n,score:Math.round((a.categories?.performance?.score||0)*100),
      LCP:num('largest-contentful-paint'),FCP:num('first-contentful-paint'),TBT:num('total-blocking-time'),
      CLS:num('cumulative-layout-shift'),bytes:num('total-byte-weight'),requests:reqs.length,
      fontRequests:fonts.length,fontBytes:fonts.reduce((x,y)=>x+(y.transferSize||0),0),
      customSubsetRequests:targetSubset.length,
      styleLayout:(audits['mainthread-work-breakdown']?.details?.items||[]).filter(x=>x.group==='styleLayout').reduce((s,x)=>s+(x.duration||0),0)};
    samples.push(row);console.log('LUEN_GLYPH_SUBSET_LAB_SAMPLE '+JSON.stringify(row));
  }
 }
}
const layoutChecks=[];
const selectors=['main .hero h1','.hero-desc','#cases-title','#case-herahera h3','#case-ikeda h3','#case-yuki h3','#case-masubuchi h3','#services-title','#contact h2','.luen-service-unified-cta'];
const rounded=n=>Number(n.toFixed(1));
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const pages={};
   for(const variant of ['baseline','candidate']){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(urls[variant],{waitUntil:'domcontentloaded',timeout:45000});
    await page.evaluate(()=>document.fonts.ready);
    const data=await page.evaluate(selectors=>selectors.map(selector=>{
      const e=document.querySelector(selector);if(!e)return {selector,missing:true};
      e.scrollIntoView({block:'center',behavior:'instant'});
      const b=e.getBoundingClientRect(),cs=getComputedStyle(e);
      return {selector,text:e.textContent.trim(),fontFamily:cs.fontFamily,
        width:b.width,height:b.height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight};
    }),selectors);
    const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
    const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    if(engine===chromium&&width===390){
      await page.locator('main .hero').screenshot({path:path.join(reportDir,variant+'-hero-'+width+'.jpg'),type:'jpeg',quality:88,animations:'disabled'});
    }
    pages[variant]={data,resources,documentWidth};
    await context.close();
   }
   const bad=[];
   for(let i=0;i<selectors.length;i++){
     const x=pages.baseline.data[i],y=pages.candidate.data[i];
     if(x.missing||y.missing)continue;
     const dx=Math.abs(x.width-y.width),dy=Math.abs(x.height-y.height);
     if(x.text!==y.text||dx>3||dy>3||x.fontFamily!==y.fontFamily)bad.push({selector:selectors[i],dx:rounded(dx),dy:rounded(dy),fontDiff:x.fontFamily!==y.fontFamily});
   }
   const loadsSubset=pages.candidate.resources.some(x=>x.includes('pretendard-home-CI-ONLY.woff2'));
   const over=pages.candidate.documentWidth-width;
   const entry={engine:engine.name(),width,geometricChanges:bad,
     subsetRequested:loadsSubset,overflow:over,
     baselineFontFiles:pages.baseline.resources.filter(x=>/woff2/.test(x)).length,
     candidateFontFiles:pages.candidate.resources.filter(x=>/woff2/.test(x)).length};
   if(!loadsSubset||over>2||bad.length)errors.push('layout '+JSON.stringify(entry));
   layoutChecks.push(entry);
  }
 }finally{await browser.close();}
}
const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const summary=[];
for(const device of ['mobile','desktop']){
 const x={device};
 for(const variant of ['baseline','candidate']){
   const r=samples.filter(t=>t.device===device&&t.variant===variant);
   x[variant]={n:r.length};
   for(const metric of ['score','LCP','FCP','TBT','CLS','bytes','requests','fontRequests','fontBytes','styleLayout','customSubsetRequests'])
     x[variant][metric]=median(r.map(t=>t[metric]));
 }
 x.delta={};
 for(const key of Object.keys(x.baseline))if(key!=='n'&&x.baseline[key]!==null&&x.candidate[key]!==null)
    x.delta[key]=Number((x.candidate[key]-x.baseline[key]).toFixed(key==='CLS'?4:1));
 summary.push(x);
}
const output={metadata,summary,layoutChecks,errors,note:'Temporary font generated in runner and excluded from artifacts. Chromium Lighthouse synthetic lab only; actual browser geometry checked in Chromium+WebKit. No release unless media & mobile QA separately pass.'};
fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify(output,null,2));
console.log('LUEN_GLYPH_SUBSET_LAB_SUMMARY '+JSON.stringify({metadata,summary,layoutChecks,errors}));
if(process.env.GITHUB_STEP_SUMMARY){
 let md='## LUEN ephemeral homepage Pretendard glyph-subset experiment\n\n';
 md+='**No downloadable font assets**. All performance data is synthetic.\n\n';
 md+='| Device | Variant | Score | LCP | FCP | TBT | CLS | Bytes | Font requests | Font bytes |\n';
 md+='|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
 for(const x of summary)for(const v of ['baseline','candidate']){
  const d=x[v],fmt=k=>d[k]==null?'—':k==='CLS'?d[k].toFixed(3):Math.round(d[k]);
  md+='| '+x.device+' | '+v+' | '+['score','LCP','FCP','TBT','CLS','bytes','fontRequests','fontBytes'].map(fmt).join(' | ')+' |\n';
 }
 md+='\n**Layout errors:** '+errors.length+'; actual site files never changed.\n';
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(errors.length||samples.length!==10)process.exitCode=1;
