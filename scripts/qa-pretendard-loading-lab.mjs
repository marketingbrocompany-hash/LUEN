// LUEN read-only, local-only performance pilot. NEVER publish font variants.
// Preserve production typography, GA4, media, gallery motion, and forms.
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {chromium} from 'playwright';

const root=process.cwd();
const dest=path.join(root,'perf-pretendard');
fs.mkdirSync(dest,{recursive:true});
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const from='pretendardvariable-dynamic-subset.min.css';
const to='pretendardvariable.min.css';
if(source.split(from).length!==3)throw Error('Expected 2 Pretendard references, including noscript');
const gaFrom="gtag('config', 'G-QXBK6XEK7G');";
if(!source.includes(gaFrom))throw Error('Missing expected GA4 anchor');
const safe=source.replace(gaFrom,"gtag('config', 'G-QXBK6XEK7G', {send_page_view:false});");
const variants=[
  {name:'dynamic-subset-production',html:safe,port:4186},
  {name:'single-variable-test-only',html:safe.replaceAll(from,to),port:4187}
];
const procs=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const median=xs=>{
  const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);
  return a.length?a[Math.floor(a.length/2)]:null;
};
const results=[], errors=[],screens=[];
const lighthouse=path.join(root,'node_modules/.bin/lighthouse');
const chrome=chromium.executablePath();
if(!fs.existsSync(lighthouse)||!fs.existsSync(chrome))throw Error('Install pinned Lighthouse + Playwright Chromium');
const originalHash=source.length+'-'+source.slice(0,80);
try{
  for(const v of variants){
    const dir=path.join(dest,v.name);fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'index.html'),v.html);
    const link=path.join(dir,'assets');
    if(!fs.existsSync(link))fs.symlinkSync(path.join(root,'assets'),link,'dir');
    procs.push(spawn('python3',['-m','http.server',String(v.port),'--bind','127.0.0.1'],{cwd:dir,stdio:'ignore'}));
  }
  for(const v of variants){
    let ready=false;
    for(let i=0;i<35;i++){
      try{const r=await fetch('http://127.0.0.1:'+v.port+'/',{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;}}catch{}
      await sleep(300);
    }
    if(!ready)throw Error('Local server unavailable: '+v.name);
  }

  // Alternate samples to limit bias from later-run system load.
  for(let i=0;i<3;i++)for(const v of variants){
    const out=path.join(dest,v.name,'mobile-'+i);
    const args=['http://127.0.0.1:'+v.port+'/', '--quiet',
      '--only-categories=performance','--output=json','--output=html',
      '--output-path='+out,'--form-factor=mobile',
      '--throttling-method=simulate',
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage'];
    const proc=spawnSync(lighthouse,args,{encoding:'utf8',env:{...process.env,CHROME_PATH:chrome},timeout:160000,maxBuffer:3*1024*1024});
    if(proc.status!==0){errors.push(v.name+' run '+i+': '+String(proc.stderr||proc.stdout).slice(-550));continue;}
    const resultFile=out+'.report.json';
    if(!fs.existsSync(resultFile)){errors.push('Missing Lighthouse report: '+resultFile);continue;}
    const data=JSON.parse(fs.readFileSync(resultFile,'utf8'));
    const a=data.audits||{}, value=k=>a[k]?.numericValue??null;
    const req=a['network-requests']?.details?.items||[];
    const fontReq=req.filter(x=>/(\.woff2?(?:\?|$)|\.ttf(?:\?|$)|fonts\.gstatic\.com)/i.test(String(x.url||'')));
    const fontsBytes=fontReq.reduce((s,x)=>s+(x.transferSize||0),0);
    const rec={variant:v.name,index:i,score:Math.round((data.categories.performance?.score||0)*100),
      FCP_ms:value('first-contentful-paint'),LCP_ms:value('largest-contentful-paint'),
      TBT_ms:value('total-blocking-time'),CLS:value('cumulative-layout-shift'),
      totalBytes:value('total-byte-weight'),fontRequests:fontReq.length,fontBytes:fontsBytes};
    results.push(rec);
    console.log('LUEN_PRETENDARD_SAMPLE '+JSON.stringify(rec));
  }

  // Non-production viewport screenshot and typography geometry; diagnostic only.
  const browser=await chromium.launch({headless:true});
  try{
    for(const v of variants){
      const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
      await page.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
      await page.goto('http://127.0.0.1:'+v.port+'/',{waitUntil:'load',timeout:60000});
      await page.evaluate(()=>document.fonts.ready);
      const geometry=await page.evaluate(()=>{
        const h=document.querySelector('h1');
        const b=h?.getBoundingClientRect();
        return {fontFamily:h?getComputedStyle(h).fontFamily:null,
          width:b?.width??null,height:b?.height??null,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      await page.screenshot({path:path.join(dest,v.name+'-mobile-390.png'),animations:'disabled'});
      screens.push({variant:v.name,...geometry});
      await page.close();
    }
  }finally{await browser.close();}
}finally{for(const p of procs)p.kill('SIGTERM');}
if(fs.readFileSync(path.join(root,'index.html'),'utf8').length+'-'+fs.readFileSync(path.join(root,'index.html'),'utf8').slice(0,80)!==originalHash)
  throw Error('Repository index changed during read-only experiment');
const groups=variants.map(v=>{
  const r=results.filter(x=>x.variant===v.name);
  return {variant:v.name,runCount:r.length,score:median(r.map(x=>x.score)),
    FCP_ms:median(r.map(x=>x.FCP_ms)),LCP_ms:median(r.map(x=>x.LCP_ms)),
    TBT_ms:median(r.map(x=>x.TBT_ms)),CLS:median(r.map(x=>x.CLS)),
    totalBytes:median(r.map(x=>x.totalBytes)),
    fontRequests:median(r.map(x=>x.fontRequests)),fontBytes:median(r.map(x=>x.fontBytes))};
});
const summary={scope:'EXPERIMENT ONLY; no release, no real inquiries, no GA4 page views; do not change site typography without visual + WebKit/mobile QA',groups,screens,errors};
fs.writeFileSync(path.join(dest,'summary.json'),JSON.stringify(summary,null,2));
console.log('LUEN_PRETENDARD_DIAGNOSTIC '+JSON.stringify(summary));
if(process.env.GITHUB_STEP_SUMMARY){
  const fmt=x=>x===null?'n/a':Number.isInteger(x)?x:String(x.toFixed(2));
  let md='## Local-only Pretendard font loading comparison\n\n| Variant | Runs | Score | LCP ms | FCP ms | TBT ms | CLS | Font requests | Font transfer bytes |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
  for(const g of groups)md+='| '+g.variant+' | '+g.runCount+' | '+fmt(g.score)+' | '+fmt(g.LCP_ms)+' | '+fmt(g.FCP_ms)+' | '+fmt(g.TBT_ms)+' | '+fmt(g.CLS)+' | '+fmt(g.fontRequests)+' | '+fmt(g.fontBytes)+' |\n';
  md+='\nThese are simulated lab runs, not user Core Web Vitals. Do not merge this diagnostic or ship either variant without further assessment.\n';
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(results.length!==6||errors.length)process.exitCode=1;
