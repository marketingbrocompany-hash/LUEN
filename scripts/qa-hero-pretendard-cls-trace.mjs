// Read-only controlled test: does Pretendard download change LUEN hero CLS?
// Block Pretendard WOFF2 for the DIAGNOSTIC arm, never a deployed feature.
// Font fallback looks different in this arm; do NOT promote it into production.
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const origin='http://127.0.0.1:4273/';
const variants=['baseline','pretendard-blocked'];
const results=[],errors=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of [390,1440]){
  for(const variant of variants){
   const context=await browser.newContext({viewport:{width,height:900},
    deviceScaleFactor:1,serviceWorkers:'block'});
   const page=await context.newPage(),failed=[],fontResponses=[];
   if(variant==='pretendard-blocked'){
    await page.route(/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard.*\.(?:woff2?|otf)(?:\?|$)/i,
      route=>route.abort());
   }
   page.on('requestfailed',r=>{if(/woff2?|pretendard/i.test(r.url()))failed.push(r.url().slice(0,160));});
   page.on('response',r=>{if(/woff2?|pretendard/i.test(r.url()))
    fontResponses.push({url:r.url().slice(0,160),status:r.status()});});
   const cdp=await context.newCDPSession(page).catch(()=>null);
   if(cdp){
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:140,
      downloadThroughput:220000,uploadThroughput:90000});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   }
   await page.addInitScript(()=>{
    const label=e=>!e?'unknown':e.tagName?.toLowerCase()+
      (e.id?'#'+e.id:'')+(typeof e.className==='string'?'.'+e.className.trim().replace(/\s+/g,'.').slice(0,100):'');
    const measurements=[];
    const measure=(reason)=>{
     const rect=sel=>{
      const e=document.querySelector(sel);if(!e)return null;
      const b=e.getBoundingClientRect();return {top:+b.top.toFixed(1),
       height:+b.height.toFixed(1),bottom:+b.bottom.toFixed(1),
       width:+b.width.toFixed(1)};
     };
     measurements.push({at:+performance.now().toFixed(1),reason,
      h1:rect('.hero h1'),desc:rect('.hero-desc'),
      cta:rect('.hero-cta'),copy:rect('.hero-copy'),
      fonts:document.fonts?.status,
      loadedPretendard:[...document.fonts].filter(f=>/Pretendard/i.test(f.family)&&f.status==='loaded').length});
    };
    window.__heroFontCLS={measurements,shifts:[],fontEvents:[]};
    window.__heroFontCLS.measure=measure;
    try{
     new PerformanceObserver(list=>{
      for(const e of list.getEntries())if(!e.hadRecentInput)
       window.__heroFontCLS.shifts.push({at:+e.startTime.toFixed(1),value:e.value,
        sources:e.sources.map(s=>({node:label(s.node),
         prevY:s.previousRect.y,nextY:s.currentRect.y}))});
     }).observe({type:'layout-shift',buffered:true});
    }catch{}
    const event=(type)=>{window.__heroFontCLS.fontEvents.push({type,at:performance.now()});measure(type);};
    document.fonts?.addEventListener('loading',()=>event('font:loading'));
    document.fonts?.addEventListener('loadingdone',()=>event('font:loadingdone'));
    document.fonts?.addEventListener('loadingerror',()=>event('font:loadingerror'));
    document.addEventListener('DOMContentLoaded',()=>{measure('dom-ready');
     let t=0;const timer=setInterval(()=>{t++;measure('tick'+t);
      if(t>=23)clearInterval(timer);},500);
    },{once:true});
   });
   let error=null,status=null;
   try{
    const r=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:48000});
    status=r?.status()||null;
    await page.waitForTimeout(12500);
   }catch(e){error=String(e.message).slice(0,200);}
   const data=await page.evaluate(()=>({
    samples:window.__heroFontCLS?.measurements||[],
    shifts:window.__heroFontCLS?.shifts||[],
    fontEvents:window.__heroFontCLS?.fontEvents||[],
    fontStatus:document.fonts.status,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
   }));
   const shiftSum=data.shifts.reduce((x,e)=>x+e.value,0);
   const row={engine:engine.name(),width,variant,status,error,
    CLS:+shiftSum.toFixed(5),
    mainShifts:data.shifts.filter(x=>x.value>0.0001),
    fontEvents:data.fontEvents,
    first:data.samples[0],last:data.samples.at(-1),
    keyTransitions:data.samples.filter((x,i,a)=>i&&x.h1&&a[i-1].h1&&
      (Math.abs(x.h1.height-a[i-1].h1.height)>3||
       Math.abs(x.desc?.top-a[i-1].desc?.top)>3)),
    loadedFontResponses:fontResponses.filter(r=>r.status===200).length,
    failedFontRequests:failed.length,overflow:data.overflow};
   results.push(row);
   if(error||status!==200||row.overflow>2)
    errors.push(engine.name()+'/'+width+'/'+variant+': '+(error||status||row.overflow));
   console.log('LUEN_HERO_FONT_CLS_TRACE '+JSON.stringify(row));
   await context.close();
  }
 }
 }finally{await browser.close();}
}
fs.mkdirSync('qa-screenshots/hero-font-cls-trace',{recursive:true});
const output={notice:'Diagnostic only. Blocking fonts changes intended typography and is NOT a release candidate.',
 results,errors};
fs.writeFileSync('qa-screenshots/hero-font-cls-trace/report.json',
 JSON.stringify(output,null,2)+'\n');
console.log('LUEN_HERO_FONT_CLS_SUMMARY '+JSON.stringify({
 results:results.map(r=>({engine:r.engine,width:r.width,variant:r.variant,
 CLS:r.CLS,first:r.first?.desc,last:r.last?.desc,transitionCount:r.keyTransitions.length,
 fontEvents:r.fontEvents.length,loadedFontResponses:r.loadedFontResponses})),errors}));
if(errors.length)process.exitCode=1;
