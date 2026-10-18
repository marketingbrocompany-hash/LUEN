// Head-to-head mobile Lighthouse on two HTML variants, same local server.
// This only measures, never deploys or modifies customer data.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const output=path.resolve('qa-screenshots','cors-lighthouse-ab');
fs.mkdirSync(output,{recursive:true});
const browserPath=chromium.executablePath();
if(!fs.existsSync(browserPath))throw Error('Chromium not installed');
const cli=path.resolve('node_modules/.bin/lighthouse');
if(!fs.existsSync(cli))throw Error('Lighthouse not installed');
const order=[
 ['mobile','baseline'],['mobile','candidate'],['mobile','candidate'],
 ['mobile','baseline'],['mobile','baseline'],['mobile','candidate'],
 ['desktop','baseline'],['desktop','candidate'],
 ['desktop','candidate'],['desktop','baseline']
];
const rows=[],errors=[];
for(const [i,[device,mode]] of order.entries()){
 const url='http://127.0.0.1:4175/?font-ab='+mode;
 const dest=path.join(output,device+'-'+mode+'-'+i+'.json');
 const args=[url,'--quiet','--only-categories=performance','--output=json',
   '--output-path='+dest,
   '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
   '--throttling-method=simulate'];
 if(device==='desktop')args.push('--preset=desktop');
 else args.push('--form-factor=mobile');
 const run=spawnSync(cli,args,{env:{...process.env,CHROME_PATH:browserPath},
   encoding:'utf8',timeout:190000,maxBuffer:3*1024*1024});
 if(run.status!==0||!fs.existsSync(dest)){
   const error='Failed '+i+' '+device+' '+mode+': '+(run.stderr||run.stdout||'').slice(-500);
   console.error(error);errors.push(error);continue;
 }
 const report=JSON.parse(fs.readFileSync(dest,'utf8'));
 const metric=name=>report.audits?.[name]?.numericValue??null;
 const fonts=report.audits?.['resource-summary']?.details?.items?.find(x=>x.resourceType==='font');
 const s={device,mode,index:i,score:Math.round((report.categories?.performance?.score||0)*100),
   lcp:metric('largest-contentful-paint'),fcp:metric('first-contentful-paint'),
   tbt:metric('total-blocking-time'),cls:metric('cumulative-layout-shift'),
   transferred:report.audits?.['total-byte-weight']?.numericValue??null,
   fontBytes:fonts?.transferSize??null,fontCount:fonts?.requestCount??null};
 rows.push(s);
 console.log('LUEN_CORS_LIGHTHOUSE_SAMPLE '+JSON.stringify(s));
}
const median=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y),n=s.length;
 return !n?null:n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;};
const summary=[];
for(const device of ['mobile','desktop']){
 for(const mode of ['baseline','candidate']){
  const group=rows.filter(x=>x.device===device&&x.mode===mode);
  summary.push({device,mode,samples:group.length,score:median(group.map(x=>x.score)),
    lcp:median(group.map(x=>x.lcp)),fcp:median(group.map(x=>x.fcp)),
    tbt:median(group.map(x=>x.tbt)),cls:median(group.map(x=>x.cls)),
    transferred:median(group.map(x=>x.transferred)),
    fontBytes:median(group.map(x=>x.fontBytes)),fontCount:median(group.map(x=>x.fontCount))});
 }
}
console.log('LUEN_CORS_LIGHTHOUSE_MEDIANS '+JSON.stringify(summary));
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({rows,summary,errors},null,2));
if(errors.length||rows.length!==10)process.exitCode=1;
