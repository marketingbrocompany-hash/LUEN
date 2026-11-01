// CI-only investigation of CLS during lossless CSS compression.
// Capture LayoutShiftAttribution sources with their previous/new geometry.
// This does NOT modify the production site or submit any contact forms.
import fs from 'node:fs';
import {chromium} from 'playwright';
const hosts={baseline:'http://127.0.0.1:4213/',candidate:'http://127.0.0.1:4214/'};
const browser=await chromium.launch({headless:true});
const results=[],failures=[];
for(let n=1;n<=3;n++){
 for(const variant of n%2?['baseline','candidate']:['candidate','baseline']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
   isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,
    downloadThroughput:200000,uploadThroughput:90000});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{
   window.__luenShiftDebug={shifts:[],paints:[],fontChanges:[]};
   const o=window.__luenShiftDebug;
   const label=e=>!e?'unknown':(
    e.tagName?.toLowerCase()+
    (e.id?'#'+e.id:'')+
    (typeof e.className==='string'?'.'+e.className.trim().replace(/\s+/g,'.').slice(0,160):'')
   );
   try{new PerformanceObserver(list=>{
    for(const s of list.getEntries()){
      if(s.hadRecentInput)continue;
      o.shifts.push({at:s.startTime,value:s.value,
       sources:(s.sources||[]).map(src=>({
         node:label(src.node),
         previousRect:{x:src.previousRect.x,y:src.previousRect.y,
          width:src.previousRect.width,height:src.previousRect.height},
         currentRect:{x:src.currentRect.x,y:src.currentRect.y,
          width:src.currentRect.width,height:src.currentRect.height}
       }))});
    }
   }).observe({type:'layout-shift',buffered:true});}catch{}
   try{new PerformanceObserver(list=>{
    for(const p of list.getEntries())o.paints.push({name:p.name,time:p.startTime});
   }).observe({type:'paint',buffered:true});}catch{}
  });
  let error=null,status=null;
  try{
   const resp=await page.goto(hosts[variant],{waitUntil:'domcontentloaded',timeout:45000});
   status=resp?.status()??null;
   await page.waitForTimeout(6500);
  }catch(e){error=String(e.message||e).slice(0,250);}
  const data=await page.evaluate(()=>{
    const obj=window.__luenShiftDebug||{};
    const font=[...document.fonts].filter(f=>f.status==='loaded');
    const el=document.querySelector('.hero-desc');
    const rect=el?.getBoundingClientRect();
    return {shifts:obj.shifts||[],paints:obj.paints||[],
     fontLoaded:font.length,fontStatus:document.fonts.status,
     desc:rect?{top:rect.top,height:rect.height,width:rect.width}:null,
     htmlScrollWidth:document.documentElement.scrollWidth,
     viewportWidth:document.documentElement.clientWidth};
  });
  const row={n,variant,status,error,CLS:Number(data.shifts.reduce((v,s)=>v+s.value,0).toFixed(5)),
   shifts:data.shifts,paints:data.paints,fontLoaded:data.fontLoaded,
   desc:data.desc,overflow:data.htmlScrollWidth-data.viewportWidth};
  results.push(row);
  if(error||status!==200||row.overflow>2)failures.push({n,variant,error,status,overflow:row.overflow});
  console.log('LUEN_CSS_CLS_TRACE '+JSON.stringify(row));
  await context.close();
 }
}
await browser.close();
const out='qa-screenshots/css-cls-trace';
fs.mkdirSync(out,{recursive:true});
const response={notice:'synthetic Chromium 390px throttled test; not a field CLS value',
 results,failures};
fs.writeFileSync(out+'/summary.json',JSON.stringify(response,null,2));
console.log('LUEN_CSS_CLS_TRACE_SUMMARY '+JSON.stringify({results:results.map(r=>({
 n:r.n,variant:r.variant,cls:r.CLS,shiftCount:r.shifts.length,
 shiftingNodes:[...new Set(r.shifts.flatMap(s=>s.sources.map(x=>x.node)))].slice(0,15)
})),failures}));
if(failures.length)process.exitCode=1;
