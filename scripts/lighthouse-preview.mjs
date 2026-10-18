// Repeatable Lighthouse lab audit on Cloudflare Pages development URL.
// Generates HTML/JSON artifacts; does not change user-facing data.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';

const target=process.env.LUEN_LIGHTHOUSE_URL || 'https://luen-preview.pages.dev/';
const dir=path.resolve('lighthouse-results');
fs.mkdirSync(dir,{recursive:true});
// Keep CI measurements tied to the *newly deployed* page rather than the
// previous Cloudflare production version when push/deploy jobs overlap.
const localIndex=fs.readFileSync(path.resolve('index.html'),'utf8').trim();
let siteReady=false;
for(let tryCount=0;tryCount<45;tryCount++){
  try {
    const url=target+(target.includes('?')?'&':'?')+'lhverify='+Date.now();
    const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
    if(response.ok && (await response.text()).trim()===localIndex){siteReady=true;break;}
  }catch(error){
    if(tryCount===44)console.log('Cloudflare preview fetch failed',String(error).slice(0,230));
  }
  await new Promise(resolve=>setTimeout(resolve,4000));
}
if(!siteReady)throw new Error('Cloudflare preview did not match checked-out index.html; refusing to audit stale deployment.');
const chrome=chromium.executablePath();
if(!fs.existsSync(chrome))throw new Error('Playwright Chromium is not installed: '+chrome);
const binary=path.resolve('node_modules/.bin/lighthouse');
if(!fs.existsSync(binary))throw new Error('Lighthouse npm binary is missing.');
const runs=[];
for(const [sampleIndex,formFactor] of ['mobile','mobile','mobile','desktop','desktop'].entries()){
  const outputPath=path.join(dir,formFactor+'-'+sampleIndex);
  const args=[
    target,
    '--quiet',
    '--only-categories=performance',
    '--output=json','--output=html',
    '--output-path='+outputPath,
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
    '--form-factor='+formFactor,
    '--throttling-method=simulate',
  ];
  if(formFactor==='desktop'){
    args.push('--screenEmulation.mobile=false','--screenEmulation.width=1350',
      '--screenEmulation.height=940','--screenEmulation.deviceScaleFactor=1',
      '--screenEmulation.disabled=false');
  }
  console.log('Running Lighthouse',formFactor,'at',target);
  const p=spawnSync(binary,args,{env:{...process.env,CHROME_PATH:chrome},encoding:'utf8',timeout:180000,maxBuffer:1024*1024*3});
  if(p.status!==0){
    console.error('Lighthouse '+formFactor+' failed',p.status,(p.stderr||p.stdout||'').slice(-2000));
    process.exitCode=1; continue;
  }
  const file=outputPath+'.report.json';
  if(!fs.existsSync(file)){
    console.error('Expected Lighthouse report not found at',file);
    process.exitCode=1;continue;
  }
  const r=JSON.parse(fs.readFileSync(file,'utf8')),audits=r.audits||{};
  const value=id=>audits[id]?.numericValue??null;
  const resources=audits['network-requests']?.details?.items||[];
  const grouped=(audits['resource-summary']?.details?.items||[]).map(item=>({
    type:item.resourceType,transferBytes:item.transferSize,requestCount:item.requestCount
  }));
  const largest=resources.filter(x=>x.transferSize>0)
    .sort((a,b)=>b.transferSize-a.transferSize).slice(0,14)
    .map(x=>({url:String(x.url||'').split('?')[0].slice(0,200),bytes:x.transferSize,resourceType:x.resourceType}));
  const opportunities=Object.entries(audits)
    .filter(([,x])=>x?.details?.overallSavingsMs>0||x?.details?.overallSavingsBytes>0)
    .map(([id,x])=>({id,title:x.title,savingsMs:x.details.overallSavingsMs||0,savingsBytes:x.details.overallSavingsBytes||0}))
    .sort((a,b)=>b.savingsMs-a.savingsMs||b.savingsBytes-a.savingsBytes).slice(0,14);
  const summary={
    formFactor,sampleIndex,url:r.finalDisplayedUrl,
    score:Math.round((r.categories.performance?.score||0)*100),
    metrics:{LCP_ms:value('largest-contentful-paint'),FCP_ms:value('first-contentful-paint'),
      SpeedIndex_ms:value('speed-index'),TBT_ms:value('total-blocking-time'),CLS:value('cumulative-layout-shift')},
    loading:{totalByteWeight:audits['total-byte-weight']?.numericValue,domSize:value('dom-size'),
      mainThreadWork_ms:value('mainthread-work-breakdown')},
    grouped,largest,opportunities,
    lcpElement:audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet||null,
    warnings:r.runWarnings||[],
  };
  runs.push(summary);
  console.log('LUEN_LIGHTHOUSE_RESULT '+JSON.stringify(summary).slice(0,14000));
}
const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]??null;};
const medians=['mobile','desktop'].map(device=>{
  const samples=runs.filter(r=>r.formFactor===device);
  return {device,samples:samples.length,score:median(samples.map(x=>x.score)),
    LCP_ms:median(samples.map(x=>x.metrics.LCP_ms)),TBT_ms:median(samples.map(x=>x.metrics.TBT_ms)),
    FCP_ms:median(samples.map(x=>x.metrics.FCP_ms)),CLS:median(samples.map(x=>x.metrics.CLS)),
    transferredBytes:median(samples.map(x=>x.loading.totalByteWeight))};
});
console.log('LUEN_LIGHTHOUSE_MEDIANS '+JSON.stringify(medians));
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({url:target,date:new Date().toISOString(),runs,medians},null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  let md='\n## LUEN Lighthouse Performance — '+target+'\n\n';
  md+='| Device | Score | LCP | FCP | TBT | CLS | Transferred |\n|---|---:|---:|---:|---:|---:|---:|\n';
  for(const r of runs){
    const n=v=>Number.isFinite(v)?Math.round(v).toLocaleString():'—';
    md+='| '+r.formFactor+' | '+r.score+'/100 | '+n(r.metrics.LCP_ms)+' ms | '+n(r.metrics.FCP_ms)+' ms | '+n(r.metrics.TBT_ms)+' ms | '+(r.metrics.CLS?.toFixed(3)??'—')+' | '+n(r.loading.totalByteWeight)+' B |\n';
  }
  md+='\nLighthouse lab values are one run per device with simulated network throttling; not real user INP or field Core Web Vitals.\n\nJSON and HTML reports in the workflow artifact.\n';
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(runs.length!==5)process.exitCode=1;
