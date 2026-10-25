// Read-only Lighthouse attribution experiment. Variants are local only.
// NOTE: "without GA4" and "without webfonts" are DIAGNOSTIC, NOT shippable.
// No inquiry submission, site edits, GA4 requests from tests, or release.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {chromium} from 'playwright';

const root=process.cwd(), reportDir=path.join(root,'perf-attribution');
fs.mkdirSync(reportDir,{recursive:true});
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const variants=[
  {name:'baseline',html:source,port:4181},
  {name:'without-gtag-loader',html:source.replace(/<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+"><\/script>/,
    '<!-- DIAGNOSTIC ONLY: remove third-party GA loader, preserve inline gtag calls -->'),port:4182},
  {name:'without-external-webfonts',html:source.replace(/<link\b[^>]*(?:cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard|fonts\.googleapis\.com\/css2)[^>]*>/g,'').replace(/<noscript><\/noscript>/g,''),
    port:4183}
];
if(variants[1].html===source||variants[2].html===source)throw Error('Variant transformation unexpectedly did nothing');
if(variants[1].html.includes('<script async src="https://www.googletagmanager.com/gtag/js?'))throw Error('GA loader removal failed');
if(variants[2].html.includes('rel="stylesheet" media="print"'))throw Error('font removal incomplete');
const servers=[];
const chrome=chromium.executablePath();
const binary=path.join(root,'node_modules/.bin/lighthouse');
if(!fs.existsSync(chrome)||!fs.existsSync(binary))throw Error('Pinned Lighthouse/Playwright Chromium not installed');
for(const v of variants){
  const dir=path.join(reportDir,v.name);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),v.html);
  fs.symlinkSync(path.join(root,'assets'),path.join(dir,'assets'),'dir');
  const proc=spawn('python3',['-m','http.server',String(v.port),'--bind','127.0.0.1'],{cwd:dir,stdio:'ignore'});
  servers.push(proc);
}
const fetchReady=async port=>{
  for(let attempt=0;attempt<35;attempt++){
    try{
      const r=await fetch('http://127.0.0.1:'+port+'/',{signal:AbortSignal.timeout(1800)});
      if(r.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  throw Error('HTTP server not ready '+port);
};
const med=values=>{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  return sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
};
const audits=[],errors=[];
try{
  await Promise.all(variants.map(v=>fetchReady(v.port)));
  for(const v of variants){
    // Three runs each: schedule is interleaved by variant, interpret with noise caveat.
    for(let i=0;i<3;i++){
      const out=path.join(reportDir,v.name,'mobile-'+i);
      const args=['http://127.0.0.1:'+v.port+'/', '--quiet','--only-categories=performance',
        '--output=json','--output-path='+out,'--form-factor=mobile',
        '--throttling-method=simulate','--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage'];
      const run=spawnSync(binary,args,{encoding:'utf8',env:{...process.env,CHROME_PATH:chrome},
        timeout:150000,maxBuffer:3*1024*1024});
      if(run.status!==0){errors.push(v.name+' '+i+' Lighthouse failed: '+(run.stderr||run.stdout||'').slice(-750));continue;}
      const filename=out+'.report.json';
      if(!fs.existsSync(filename)){errors.push('missing report '+filename);continue;}
      const result=JSON.parse(fs.readFileSync(filename,'utf8'));
      const a=result.audits||{},value=id=>a[id]?.numericValue??null;
      const bootup=(a['bootup-time']?.details?.items||[]).map(x=>({
        url:String(x.url||''),totalMs:x.total??null,scriptingMs:x.scripting??null,
        parseCompileMs:x.scriptParseCompile??null
      })).sort((x,y)=>(y.totalMs||0)-(x.totalMs||0)).slice(0,14);
      const mainThread=(a['mainthread-work-breakdown']?.details?.items||[]).map(x=>({group:x.group,duration:x.duration})).sort((x,y)=>(y.duration||0)-(x.duration||0));
      const network=(a['network-requests']?.details?.items||[]).filter(x=>/\.css(?:\?|$)|gtag\/js|fonts\.googleapis|fonts\.gstatic|pretendard/i.test(String(x.url||'')))
        .map(x=>({url:String(x.url||'').slice(0,250),bytes:x.transferSize,start:x.startTime,end:x.endTime,
          resourceType:x.resourceType})).slice(0,32);
      const lcpElement=a['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet||null;
      const diagnostics=a['diagnostics']?.details?.items?.[0]||{};
      const record={variant:v.name,index:i,score:Math.round((result.categories.performance?.score||0)*100),
        FCP_ms:value('first-contentful-paint'),LCP_ms:value('largest-contentful-paint'),
        TBT_ms:value('total-blocking-time'),CLS:value('cumulative-layout-shift'),
        speedIndex:value('speed-index'),mainThreadMs:value('mainthread-work-breakdown'),
        bootup,mainThread,network,lcpElement,
        renderBlockingMs:a['render-blocking-resources']?.details?.overallSavingsMs??
          a['render-blocking-insight']?.details?.overallSavingsMs??null,
        totalBytes:a['total-byte-weight']?.numericValue??null,
        diagnostics:{numTasks:diagnostics.numTasks,numTasksOver50ms:diagnostics.numTasksOver50ms,
          numTasksOver100ms:diagnostics.numTasksOver100ms,mainDocumentTransferSize:diagnostics.mainDocumentTransferSize}};
      audits.push(record);
      console.log('LUEN_ATTRIBUTION_SAMPLE '+JSON.stringify({variant:v.name,index:i,score:record.score,
        FCP_ms:record.FCP_ms,LCP_ms:record.LCP_ms,TBT_ms:record.TBT_ms,CLS:record.CLS,
        mainThreadMs:record.mainThreadMs,bootup:record.bootup.slice(0,8),mainThread:record.mainThread.slice(0,8),
        cssCount:record.network.filter(x=>x.resourceType==='Stylesheet').length,lcpElement:record.lcpElement}));
    }
  }
}finally{for(const process of servers)process.kill('SIGTERM');}
const rows=variants.map(v=>{
  const samples=audits.filter(a=>a.variant===v.name);
  return {variant:v.name,count:samples.length,score:med(samples.map(x=>x.score)),
    FCP_ms:med(samples.map(x=>x.FCP_ms)),LCP_ms:med(samples.map(x=>x.LCP_ms)),
    TBT_ms:med(samples.map(x=>x.TBT_ms)),CLS:med(samples.map(x=>x.CLS)),
    mainThreadMs:med(samples.map(x=>x.mainThreadMs)),totalBytes:med(samples.map(x=>x.totalBytes))};
});
const baseline=rows[0],deltas=rows.slice(1).map(v=>({
  variant:v.variant,scoreDelta:v.score-baseline.score,
  FCP_msDelta:v.FCP_ms-baseline.FCP_ms,LCP_msDelta:v.LCP_ms-baseline.LCP_ms,
  TBT_msDelta:v.TBT_ms-baseline.TBT_ms,mainThreadMsDelta:v.mainThreadMs-baseline.mainThreadMs,
  CLSDelta:v.CLS-baseline.CLS
}));
const summary={scope:'Local three-sample Lighthouse mobile diagnostic only. Fonts removed changes typography. GA disabled is measurement only; analytics must be preserved in shipped site. No code released.',
  baselineVersion:'the tested GitHub Pages main checkout',
  rows,deltas,errors,firstBaseline:audits.find(x=>x.variant==='baseline')||null};
fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify(summary,null,2));
console.log('LUEN_MOBILE_PERFORMANCE_ATTRIBUTION '+JSON.stringify({rows,deltas,errors,
  baselineBootup:summary.firstBaseline?.bootup,baselineMainThread:summary.firstBaseline?.mainThread,
  baselineRequests:summary.firstBaseline?.network}));
if(process.env.GITHUB_STEP_SUMMARY){
  const n=x=>Number.isFinite(x)?x.toFixed(1):'—';
  let md='## Production-main mobile performance attribution (local test variants only)\n\n';
  md+='| Condition | Runs | Score | LCP ms | FCP ms | TBT ms | JS/main thread ms | CLS |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
  for(const x of rows)md+='| '+x.variant+' | '+x.count+' | '+n(x.score)+' | '+n(x.LCP_ms)+' | '+n(x.FCP_ms)+' | '+n(x.TBT_ms)+' | '+n(x.mainThreadMs)+' | '+n(x.CLS)+' |\n';
  md+='\n**Diagnosis only:** No GA4 deletion, font deletion or layout change is recommended from this experiment alone. Different typography changes rendering. Lighthouse simulated lab measurements are variable.\n';
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(audits.length!==9||errors.length)process.exitCode=1;