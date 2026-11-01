// CI-only LUEN A/B: skip deep offscreen layout without touching hero/case grid.
// Hypothesis based on PR261: full-page layout cost >2.9s; actual improvement
// needs Lighthouse and WebKit/Chromium scroll+CLS proof before production.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const original=fs.readFileSync('index.html','utf8');
const targets=['#why-luen','#services','#partner-creators','#content-flow','#faq','#contact'];
const injected='<style id="luen-offscreen-layout-experiment">'+
 '@supports (content-visibility:auto){'+
 targets.map(s=>'html body main#top > '+s).join(',')+
 '{content-visibility:auto;contain-intrinsic-size:auto 750px}}'+
 '</style>';
if(!original.includes('</head>')||targets.some(x=>!original.includes('id="'+x.slice(1)+'"')))
  throw Error('Homepage section selectors changed; abort');
const versions={baseline:original,candidate:original.replace('</head>',injected+'\n</head>')};
const dir='qa-screenshots/offscreen-layout-lab';
fs.mkdirSync(dir,{recursive:true});
for(const [variant,html] of Object.entries(versions)){
 const root=path.join('qa-temp-offscreen-site',variant);fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'index.html'),html);
 if(!fs.existsSync(path.join(root,'assets')))fs.symlinkSync(path.resolve('assets'),path.join(root,'assets'),'dir');
}
const ports={baseline:4203,candidate:4204};
const cli=path.resolve('node_modules/.bin/lighthouse'),chrome=chromium.executablePath();
const samples=[],errors=[];
for(const device of ['mobile','desktop'])for(let n=1;n<=(device==='mobile'?3:2);n++){
 for(const variant of n%2?['baseline','candidate']:['candidate','baseline']){
  const file=path.join(dir,device+'-'+n+'-'+variant+'.json');
  const proc=spawnSync(cli,['http://127.0.0.1:'+ports[variant]+'/',
   '--quiet','--only-categories=performance','--output=json','--output-path='+file,
   '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
   '--throttling-method=simulate',device==='desktop'?'--preset=desktop':'--form-factor=mobile'],
    {env:{...process.env,CHROME_PATH:chrome},timeout:145000,encoding:'utf8',maxBuffer:5e6});
  if(proc.status!==0||!fs.existsSync(file)){errors.push('Lighthouse '+device+'/'+n+'/'+variant+': '+String(proc.stderr||proc.error).slice(-500));continue;}
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  const a=report.audits||{},m=k=>a[k]?.numericValue??null;
  const row={device,n,variant,score:Math.round(100*(report.categories?.performance?.score||0)),
   LCP:m('largest-contentful-paint'),FCP:m('first-contentful-paint'),
   TBT:m('total-blocking-time'),CLS:m('cumulative-layout-shift'),
   bytes:m('total-byte-weight')};
  console.log('LUEN_OFFSCREEN_LH_SAMPLE '+JSON.stringify(row));
  samples.push(row);
 }
}
const median=x=>{const a=x.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2):null;};
const summary=[];
for(const device of ['mobile','desktop']){
 const r={device};
 for(const variant of ['baseline','candidate']){
  const z=samples.filter(x=>x.device===device&&x.variant===variant);
  r[variant]={n:z.length};
  for(const key of ['score','LCP','FCP','TBT','CLS','bytes'])
   r[variant][key]=median(z.map(x=>x[key]));
 }
 r.delta={};
 for(const key of ['score','LCP','FCP','TBT','CLS','bytes'])
  r.delta[key]=r.baseline[key]!==null&&r.candidate[key]!==null?+(r.candidate[key]-r.baseline[key]).toFixed(key==='CLS'?4:1):null;
 summary.push(r);
}
const browserChecks=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const outcomes={};
   for(const variant of ['baseline','candidate']){
    const context=await browser.newContext({viewport:{width,height:850},
      reducedMotion:'reduce',deviceScaleFactor:1});
    const page=await context.newPage(),pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message.slice(0,240)));
    await page.addInitScript(()=>{
     window.__qaShifts=[];
     try{new PerformanceObserver(l=>{for(const e of l.getEntries())
      if(!e.hadRecentInput)window.__qaShifts.push({time:e.startTime,amount:e.value});})
      .observe({type:'layout-shift',buffered:true});}catch{}
    });
    await page.goto('http://127.0.0.1:'+ports[variant]+'/',{waitUntil:'load',timeout:50000});
    await page.waitForTimeout(350);
    const before=await page.evaluate((sels)=>({
     siteWidth:document.documentElement.scrollWidth,
     viewport:document.documentElement.clientWidth,
     hasCandidateStyle:!!document.querySelector('#luen-offscreen-layout-experiment'),
     heroHeight:document.querySelector('main#top>.hero').getBoundingClientRect().height,
     casesHeight:document.querySelector('#cases').getBoundingClientRect().height,
     sections:Object.fromEntries(sels.map(sel=>[sel,{
      height:document.querySelector(sel).getBoundingClientRect().height,
      visibility:getComputedStyle(document.querySelector(sel)).contentVisibility
     }]))
    }),targets);
    const scrolled=[];
    for(const selector of targets){
     await page.locator(selector).scrollIntoViewIfNeeded({timeout:15000});
     await page.waitForTimeout(350);
     const state=await page.evaluate(sel=>{
      const e=document.querySelector(sel),r=e.getBoundingClientRect();
      return {height:r.height,top:r.top,visibility:getComputedStyle(e).contentVisibility};
     },selector);
     scrolled.push({selector,...state});
    }
    const after=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      totalShift:window.__qaShifts.reduce((n,r)=>n+r.amount,0),
      cases:document.querySelectorAll('#cases .luen-case-entry').length,
      services:document.querySelectorAll('#services .luen-service-choice').length,
      cta:document.querySelectorAll('#services .luen-service-unified-cta').length,
      reels:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone):not(.ios-loop-clone) .portfolio-card.portrait').length
    }));
    outcomes[variant]={before,scrolled,after,pageErrors};
    await context.close();
   }
   const a=outcomes.baseline,b=outcomes.candidate,issues=[];
   if(!b.before.hasCandidateStyle||b.before.sections[targets[0]].visibility!=='auto')
     issues.push('content-visibility candidate not enabled');
   if(Math.abs(a.before.heroHeight-b.before.heroHeight)>2||
      Math.abs(a.before.casesHeight-b.before.casesHeight)>2)
     issues.push('hero or Signature Campaigns layout changed');
   for(let i=0;i<targets.length;i++)
    if(Math.abs(a.scrolled[i].height-b.scrolled[i].height)>3)
     issues.push(targets[i]+' differs after scroll '+a.scrolled[i].height+' to '+b.scrolled[i].height);
   if(b.after.overflow>2||b.after.cases!==4||b.after.services!==3||b.after.cta!==1||
      b.after.reels!==6||b.pageErrors.length)issues.push('structural or JS errors');
   // A large new CLS is unacceptable, even if LCP improves.
   if(b.after.totalShift>a.after.totalShift+0.015)
     issues.push('extra CLS: '+a.after.totalShift.toFixed(4)+' -> '+b.after.totalShift.toFixed(4));
   const row={engine:engine.name(),width,baselineShift:a.after.totalShift,
    candidateShift:b.after.totalShift,baselineBefore:a.before.sections,
    candidateBefore:b.before.sections,failures:issues};
   console.log('LUEN_OFFSCREEN_VISUAL '+JSON.stringify(row));
   browserChecks.push(row);
   errors.push(...issues.map(e=>engine.name()+'/'+width+': '+e));
  }
 }finally{await browser.close();}
}
const result={summary,browserChecks,errors,
  notice:'LAB ONLY: content visibility does not change public HTML/CSS/JS. Lighthouse synthetic; scroll-induced CLS checked separately.'};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(result,null,2));
console.log('LUEN_OFFSCREEN_LAYOUT_SUMMARY '+JSON.stringify({
 summary,visual:browserChecks.map(x=>({engine:x.engine,width:x.width,
  baselineShift:x.baselineShift,candidateShift:x.candidateShift,failures:x.failures})),errors
}));
if(process.env.GITHUB_STEP_SUMMARY){
 let md='## LUEN deep-section layout-containment experiment (not deployed)\n\n';
 md+='| Device | Version | N | Score | LCP ms | FCP ms | TBT ms | CLS | Bytes |\n';
 md+='|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
 for(const r of summary)for(const variant of ['baseline','candidate']){
  const d=r[variant],f=k=>d[k]===null?'—':k==='CLS'?d[k].toFixed(3):Math.round(d[k]);
  md+='| '+r.device+' | '+variant+' | '+d.n+' | '+['score','LCP','FCP','TBT','CLS','bytes'].map(f).join(' | ')+' |\n';
 }
 md+='\nScroll QA: '+(errors.length?'FAIL '+errors.length:'PASS')+'; release forbidden pending actual iPhone verification.\n';
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(samples.length!==10||errors.length)process.exitCode=1;
