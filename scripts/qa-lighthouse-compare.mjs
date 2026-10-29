// Lab-only Lighthouse: base main vs integrated PR, same CI runner / local HTTP.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const dir=path.resolve('qa-screenshots/lighthouse-compare');
fs.mkdirSync(dir,{recursive:true});
const chrome=chromium.executablePath();
const cli=path.resolve('node_modules/.bin/lighthouse');
if(!fs.existsSync(chrome)||!fs.existsSync(cli))throw Error('Missing playwright chromium or lighthouse');
const ports={base:'http://127.0.0.1:4173/',candidate:'http://127.0.0.1:4174/'};
const runs=[],errors=[];
for(const device of ['mobile','desktop'])for(let i=1;i<=(device==='mobile'?3:2);i++){
  for(const site of i%2?['base','candidate']:['candidate','base']){
    const prefix=path.join(dir,device+'-'+i+'-'+site);
    const args=[ports[site],'--quiet','--only-categories=performance',
      '--output=json','--output-path='+prefix,
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--throttling-method=simulate',device==='desktop'?'--preset=desktop':'--form-factor=mobile'];
    const r=spawnSync(cli,args,{env:{...process.env,CHROME_PATH:chrome},timeout:150000,encoding:'utf8',maxBuffer:6*1024*1024});
    // With a single --output=json, Lighthouse writes exactly --output-path (no suffix).
    const report=fs.existsSync(prefix)?prefix:prefix+'.report.json';
    if(r.status!==0||!fs.existsSync(report)){
      errors.push(device+'/'+i+'/'+site+': '+String(r.stderr||r.stdout||r.error).slice(-550));continue;
    }
    const data=JSON.parse(fs.readFileSync(report,'utf8')),a=data.audits||{};
    const m=k=>a[k]?.numericValue??null;
    const sample={device,i,site,score:Math.round((data.categories?.performance?.score??0)*100),
      LCP:m('largest-contentful-paint'),FCP:m('first-contentful-paint'),
      TBT:m('total-blocking-time'),CLS:m('cumulative-layout-shift'),
      bytes:m('total-byte-weight'),requests:(a['network-requests']?.details?.items||[]).length,
      warnings:(data.runWarnings||[]).length};
    runs.push(sample);
    console.log('LUEN_LH_SAMPLE '+JSON.stringify(sample));
  }
}
const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y),k=a.length>>1;return !a.length?null:a.length%2?a[k]:(a[k-1]+a[k])/2;};
const summary=[];
for(const device of ['mobile','desktop']){
  const row={device};
  for(const site of ['base','candidate']){
    const v=runs.filter(x=>x.device===device&&x.site===site);
    row[site]={n:v.length};
    for(const metric of ['score','LCP','FCP','TBT','CLS','bytes','requests'])
      row[site][metric]=median(v.map(x=>x[metric]));
  }
  row.delta={};
  for(const metric of ['score','LCP','FCP','TBT','CLS','bytes','requests']){
    const a=row.base[metric],b=row.candidate[metric];
    row.delta[metric]=a===null||b===null?null:Number((b-a).toFixed(metric==='CLS'?4:1));
  }
  summary.push(row);
}
const report={baseSha:process.env.LUEN_BASE_SHA,candidateSha:process.env.LUEN_CANDIDATE_SHA,
  note:'Same GitHub runner, local HTTP, simulated Lighthouse throttling. Not real-user INP.',summary,runs,errors};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(report,null,2));
console.log('LUEN_LIGHTHOUSE_COMPARISON '+JSON.stringify(summary));
if(process.env.GITHUB_STEP_SUMMARY){
  let md='## LUEN Lighthouse PR comparison\n\n';
  md+='Base: '+report.baseSha+' | Candidate: '+report.candidateSha+'\n\n';
  md+='| Device | Site | Samples | Score | LCP ms | FCP ms | TBT ms | CLS | Bytes | Requests |\n';
  md+='|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
  for(const row of summary)for(const site of ['base','candidate']){
    const a=row[site],fmt=k=>a[k]==null?'—':k==='CLS'?a[k].toFixed(3):Math.round(a[k]).toString();
    md+='| '+row.device+' | '+site+' | '+a.n+' | '+['score','LCP','FCP','TBT','CLS','bytes','requests'].map(fmt).join(' | ')+' |\n';
  }
  md+='\nSimulated lab metrics only; small differences do not prove a performance change.\n';
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
for(const e of errors)console.error('LUEN_LH_ERROR '+e);
if(runs.length!==10||errors.length)process.exitCode=1;