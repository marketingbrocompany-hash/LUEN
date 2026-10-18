// Lighthouse performance A/B on same local Instagram page with font URL only.
// Isolated page variants have GA4 removed to avoid synthetic Analytics traffic.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const dir=path.resolve('qa-screenshots','instagram-font-lighthouse');
fs.mkdirSync(dir,{recursive:true});
const binary=path.resolve('node_modules/.bin/lighthouse');
const chrome=chromium.executablePath();
if(!fs.existsSync(binary)||!fs.existsSync(chrome))throw Error('Browser or Lighthouse not installed');
const order=[
 ['mobile','control'],['mobile','subset'],['mobile','subset'],
 ['mobile','control'],['mobile','control'],['mobile','subset'],
 ['desktop','control'],['desktop','subset'],
 ['desktop','subset'],['desktop','control']
];
const rows=[],problems=[];
for(const [i,[device,variant]] of order.entries()){
 const url='http://127.0.0.1:4175/services/instagram-influencer-marketing/?variant='+variant;
 const output=path.join(dir,device+'-'+variant+'-'+i+'.json');
 const args=[url,'--quiet','--only-categories=performance','--output=json','--output-path='+output,
   '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
   '--throttling-method=simulate'];
 if(device==='desktop')args.push('--preset=desktop');
 else args.push('--form-factor=mobile');
 const run=spawnSync(binary,args,{env:{...process.env,CHROME_PATH:chrome},
   encoding:'utf8',timeout:190000,maxBuffer:3*1024*1024});
 if(run.status!==0||!fs.existsSync(output)){
  problems.push(device+'/'+variant+': Lighthouse failed '+(run.stderr||run.stdout||'').slice(-350));continue;
 }
 const report=JSON.parse(fs.readFileSync(output,'utf8'));
 const audit=id=>report.audits?.[id]?.numericValue??null;
 const resource=report.audits?.['resource-summary']?.details?.items||[];
 const font=resource.find(x=>x.resourceType==='font');
 const row={device,variant,index:i,score:Math.round((report.categories?.performance?.score||0)*100),
  lcp:audit('largest-contentful-paint'),fcp:audit('first-contentful-paint'),
  tbt:audit('total-blocking-time'),cls:audit('cumulative-layout-shift'),
  bytes:report.audits?.['total-byte-weight']?.numericValue??null,
  fontBytes:font?.transferSize??null,fontRequests:font?.requestCount??null};
 rows.push(row);console.log('LUEN_INSTAGRAM_FONT_LH_SAMPLE '+JSON.stringify(row));
}
const median=arr=>{let a=arr.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;
 return n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):null;};
const summary=[];
for(const device of ['mobile','desktop'])for(const variant of ['control','subset']){
 const v=rows.filter(x=>x.device===device&&x.variant===variant);
 summary.push({device,variant,samples:v.length,
  score:median(v.map(x=>x.score)),lcp:median(v.map(x=>x.lcp)),fcp:median(v.map(x=>x.fcp)),
  tbt:median(v.map(x=>x.tbt)),cls:median(v.map(x=>x.cls)),
  bytes:median(v.map(x=>x.bytes)),fontBytes:median(v.map(x=>x.fontBytes)),
  fontRequests:median(v.map(x=>x.fontRequests))});
}
console.log('LUEN_INSTAGRAM_FONT_LH_MEDIANS '+JSON.stringify(summary));
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({summary,rows,problems},null,2));
if(problems.length||rows.length!==10)process.exitCode=1;
