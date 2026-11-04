// Synthetic Lighthouse A/B for 42KB CI-only hero font preload.
// No font uploaded or committed. No production deploy.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const dir='qa-screenshots/hero-font-lighthouse';
fs.mkdirSync(dir,{recursive:true});
const src=fs.readFileSync('index.html','utf8');
const link='<link rel="preload" href="/qa-font/pretendard-hero-ci-only.woff2" as="font" type="font/woff2" crossorigin/>'+
 '<link rel="stylesheet" href="/qa-font/hero.css"/>';
const variants={baseline:src,candidate:src.replace('</head>',link+'\n</head>')};
for(const [name,html] of Object.entries(variants)){
 const root=path.resolve('qa-temp-hero-lh',name);
 fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'index.html'),html);
 const assets=path.join(root,'assets');
 if(!fs.existsSync(assets))fs.symlinkSync(path.resolve('assets'),assets,'dir');
 if(name==='candidate'){
  const fontDir=path.join(root,'qa-font');fs.mkdirSync(fontDir,{recursive:true});
  fs.copyFileSync('qa-temp-hero-font/pretendard-hero-ci-only.woff2',
   path.join(fontDir,'pretendard-hero-ci-only.woff2'));
  fs.copyFileSync('qa-temp-hero-font/hero.css',path.join(fontDir,'hero.css'));
 }
}
if(process.argv.includes('--prepare')){console.log('LUEN_HERO_LH_STAGED '+JSON.stringify(Object.keys(variants)));process.exit(0);}
const cli=path.resolve('node_modules/.bin/lighthouse'),chrome=chromium.executablePath();
const ports={baseline:4293,candidate:4294},samples=[],errors=[];
for(const device of ['mobile','desktop']){
 for(let n=1;n<=(device==='mobile'?3:2);n++){
  for(const variant of n%2?['baseline','candidate']:['candidate','baseline']){
   const file=path.join(dir,device+'-'+n+'-'+variant+'.json');
   const proc=spawnSync(cli,[
    'http://127.0.0.1:'+ports[variant]+'/',
    '--quiet','--only-categories=performance','--output=json','--output-path='+file,
    '--throttling-method=simulate',
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
    device==='desktop'?'--preset=desktop':'--form-factor=mobile'
   ],{env:{...process.env,CHROME_PATH:chrome},timeout:150000,encoding:'utf8',maxBuffer:7e6});
   if(proc.status!==0||!fs.existsSync(file)){
    errors.push('Lighthouse '+device+'/'+n+'/'+variant+': '+String(proc.stderr||proc.error).slice(-280));
    continue;
   }
   const r=JSON.parse(fs.readFileSync(file,'utf8')),a=r.audits||{},value=k=>a[k]?.numericValue??null;
   const net=a['network-requests']?.details?.items||[];
   const row={device,n,variant,score:Math.round(100*(r.categories?.performance?.score||0)),
    LCP:value('largest-contentful-paint'),FCP:value('first-contentful-paint'),
    TBT:value('total-blocking-time'),CLS:value('cumulative-layout-shift'),
    bytes:value('total-byte-weight'),requests:net.length,
    heroFontDownloads:net.filter(i=>(i.url||'').includes('pretendard-hero-ci-only.woff2')).length};
   samples.push(row);
   console.log('LUEN_HERO_FONT_LH_SAMPLE '+JSON.stringify(row));
  }
 }
}
const median=items=>{const a=items.filter(Number.isFinite).sort((x,y)=>x-y);
 return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const summary=[];
for(const device of ['mobile','desktop']){
 const row={device};
 for(const variant of ['baseline','candidate']){
  const vals=samples.filter(s=>s.device===device&&s.variant===variant);
  row[variant]={n:vals.length};
  for(const field of ['score','LCP','FCP','TBT','CLS','bytes','requests','heroFontDownloads'])
   row[variant][field]=median(vals.map(x=>x[field]));
 }
 row.delta={};
 for(const field of ['score','LCP','FCP','TBT','CLS','bytes','requests'])
  row.delta[field]=Number((row.candidate[field]-row.baseline[field]).toFixed(field==='CLS'?4:1));
 summary.push(row);
}
const output={summary,errors,
 scope:'Synthetic Lighthouse CI only; does not validate actual iPhone Safari or field CWV'};
fs.writeFileSync(dir+'/summary.json',JSON.stringify(output,null,2)+'\n');
console.log('LUEN_HERO_FONT_LH_SUMMARY '+JSON.stringify(output));
if(process.env.GITHUB_STEP_SUMMARY){
 let md='## 42KB Pretendard hero glyph preload — lab only, no deployment\n\n';
 md+='| Device | Version | N | Score | LCP ms | FCP ms | TBT ms | CLS | Bytes |\n';
 md+='|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
 for(const row of summary)for(const variant of ['baseline','candidate']){
  const x=row[variant],fmt=f=>x[f]==null?'—':f==='CLS'?x[f].toFixed(4):Math.round(x[f]);
  md+='| '+row.device+' | '+variant+' | '+x.n+' | '+
   ['score','LCP','FCP','TBT','CLS','bytes'].map(fmt).join(' | ')+' |\n';
 }
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(errors.length||samples.length!==10)process.exitCode=1;
