// Non-deploying LUEN mobile performance diagnosis. Three local variants share
// EXACT same assets; only Pretendard CSS loading mode or one hero preload changes.
// No GA removal, no video changes, no customer data or form submissions.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';

const root=process.cwd();
const out=path.join(root,'qa-screenshots/mobile-lcp-font-pilot');
fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css='/variable/pretendardvariable-dynamic-subset.min.css';
if(original.split(css).length-1!==2)throw Error('Pretendard links changed; abort experiment');
const insertBefore='<link rel="stylesheet" href="assets/css/site.css?v=20260930-13"/>';
if(original.split(insertBefore).length!==2)throw Error('Site CSS anchor changed; abort experiment');
const variants={
  baseline:original,
  fullfont:original.replaceAll(css,'/variable/pretendardvariable.min.css'),
  posterpreload:original.replace(insertBefore,
    '<link rel="preload" as="image" href="/assets/images/luen-motion/confier-poster.webp?v=20261021-hq" fetchpriority="high"/>\n'+insertBefore)
};
for(const [name,html] of Object.entries(variants)){
  if(name!=='baseline'&&html===original)throw Error('Variant '+name+' unchanged');
  const dir=path.join(root,'qa-screenshots/mobile-lcp-font-pilot-site',name);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),html);
}
const ports={baseline:4173,fullfont:4174,posterpreload:4175};
const cli=path.resolve('node_modules/.bin/lighthouse');
const chrome=chromium.executablePath();
if(!fs.existsSync(cli)||!fs.existsSync(chrome))throw Error('Missing pinned Lighthouse/Chromium');
const runs=[],errors=[];
const med=arr=>{const a=arr.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null;};
for(const device of ['mobile','desktop']){
  for(let n=1;n<=(device==='mobile'?3:2);n++){
    const ordered=n===2?['posterpreload','fullfont','baseline']:n===3?['fullfont','baseline','posterpreload']:['baseline','posterpreload','fullfont'];
    for(const site of ordered){
      const filename=path.join(out,device+'-'+n+'-'+site+'.json');
      const args=['http://127.0.0.1:'+ports[site]+'/',
        '--quiet','--only-categories=performance','--output=json','--output-path='+filename,
        '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
        '--throttling-method=simulate',device==='desktop'?'--preset=desktop':'--form-factor=mobile'];
      const result=spawnSync(cli,args,{env:{...process.env,CHROME_PATH:chrome},timeout:150000,encoding:'utf8',maxBuffer:6*1024*1024});
      if(result.status!==0||!fs.existsSync(filename)){
        errors.push({site,device,n,error:String(result.stderr||result.stdout||result.error).slice(-450)});
        continue;
      }
      const report=JSON.parse(fs.readFileSync(filename,'utf8'));
      const audits=report.audits||{},metric=k=>audits[k]?.numericValue??null;
      const requests=audits['network-requests']?.details?.items||[];
      const fontReq=requests.filter(r=>/woff2?|\.(ttf|otf)(\?|$)|font-display|fonts\.googleapis|pretendardvariable/.test(r.url||''));
      const fonts=fontReq.filter(r=>/woff2?|\.(ttf|otf)(\?|$)/.test(r.url||''));
      const tasks=audits['mainthread-work-breakdown']?.details?.items||[];
      const element=audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet||
        audits['lcp-breakdown-insight']?.details?.items?.[0]?.node?.snippet||null;
      const rec={site,device,run:n,score:Math.round(100*(report.categories?.performance?.score||0)),
        LCP:metric('largest-contentful-paint'),FCP:metric('first-contentful-paint'),
        TBT:metric('total-blocking-time'),CLS:metric('cumulative-layout-shift'),
        bytes:metric('total-byte-weight'),requests:requests.length,
        fontRequests:fonts.length,fontBytes:fonts.reduce((sum,r)=>sum+(r.transferSize||0),0),
        mainThread:metric('mainthread-work-breakdown'),element,
        topMainTasks:tasks.slice().sort((a,b)=>(b.duration||0)-(a.duration||0)).slice(0,5).map(t=>({group:t.group,duration:t.duration})),
        jsTagBytes:requests.filter(r=>/googletagmanager\.com/.test(r.url||'')).reduce((sum,r)=>sum+(r.transferSize||0),0)};
      runs.push(rec);
      console.log('LUEN_MOBILE_PERF_PILOT_SAMPLE '+JSON.stringify(rec));
    }
  }
}
const metrics=['score','LCP','FCP','TBT','CLS','bytes','requests','fontRequests','fontBytes','mainThread','jsTagBytes'];
const summary=[];
for(const device of ['mobile','desktop']){
 const row={device};
 for(const site of Object.keys(variants)){
  const samples=runs.filter(r=>r.device===device&&r.site===site);
  row[site]={n:samples.length};
  for(const k of metrics)row[site][k]=med(samples.map(r=>r[k]));
 }
 for(const site of ['fullfont','posterpreload']){
  row[site+'Delta']={};
  for(const k of metrics){
    const before=row.baseline[k],after=row[site][k];
    row[site+'Delta'][k]=before===null||after===null?null:Number((after-before).toFixed(k==='CLS'?4:1));
  }
 }
 summary.push(row);
}
const answer={label:'LOCAL SIMULATED Lighthouse A/B — DO NOT CLAIM FIELD CWV',sourceSha:process.env.LUEN_BASE_SHA||'unknown',
  note:'Each variant keeps all HTML and assets except one font URL OR one poster preload; mobile 3 / desktop 2. Browser engine Lighthouse Chromium only. Monitor image/typography visually and use WebKit before release.',
  summary,runs,errors};
fs.writeFileSync(path.join(out,'pilot-summary.json'),JSON.stringify(answer,null,2));
console.log('LUEN_MOBILE_PERF_PILOT_SUMMARY '+JSON.stringify({summary,errors}));
if(process.env.GITHUB_STEP_SUMMARY){
 let text='## LUEN local Lighthouse font & image-priority pilot\n\nSimulated throttling, not Core Web Vitals field data. All three variants serve the same site assets.\n\n';
 text+='| Device | Variant | N | Score | LCP ms | FCP ms | TBT ms | CLS | Bytes | Fonts (requests / bytes) |\n';
 text+='|---|---|---:|---:|---:|---:|---:|---:|---|\n';
 for(const row of summary)for(const site of Object.keys(variants)){
  const v=row[site],fmt=k=>v[k]===null?'—':k==='CLS'?v[k].toFixed(3):Math.round(v[k]).toString();
  text+='| '+row.device+' | '+site+' | '+v.n+' | '+['score','LCP','FCP','TBT','CLS','bytes'].map(fmt).join(' | ')+' | '+v.fontRequests+' / '+Math.round(v.fontBytes||0)+' |\n';
 }
 text+='\n**Decision:** No site code changes are authorized by this experiment. Preserve current fonts and motion unless a measured improvement has visual and functional QA.\n';
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,text);
}
if(runs.length!==15||errors.length)process.exitCode=1;
