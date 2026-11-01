// Read-only LUEN CSS/render-path diagnostic, against current main served locally.
// Chrome CSS Coverage records used *document-wide* rules, not viewport-only.
// Report this limitation clearly. No CSS/HTML/JS changes and no form submits.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const origin=process.env.LUEN_AUDIT_URL||'http://127.0.0.1:4173/';
const out='qa-screenshots/lcp-critical-css';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const tests=[],failures=[];
const sizes=[];
for(const [device,width] of [['mobile',390],['desktop',1440]]){
  for(let run=1;run<=2;run++){
    const context=await browser.newContext({
      viewport:{width,height:900},deviceScaleFactor:1,
      isMobile:device==='mobile',hasTouch:device==='mobile',
      reducedMotion:'no-preference',serviceWorkers:'block'
    });
    const page=await context.newPage(),responses=[],networkFailures=[];
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    // Same lab throttle for each run. This is NOT a field-traffic measurement.
    await cdp.send('Network.emulateNetworkConditions',{
      offline:false,latency:100,downloadThroughput:200000,uploadThroughput:96000
    });
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await cdp.send('Performance.enable');
    await page.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    page.on('response',r=>{
      const url=r.url();
      if(/\.css(?:\?|$)|\.woff2?(?:\?|$)|confier-poster\.webp/.test(url))
        responses.push({url:url.slice(0,220),status:r.status()});
    });
    page.on('requestfailed',r=>{
      if(/\.css(?:\?|$)|\.woff2?(?:\?|$)|confier-poster\.webp/.test(r.url()))
        networkFailures.push({url:r.url().slice(0,220),reason:r.failure()});
    });
    await page.addInitScript(()=>{
      window.__luenLCPAudit={lcp:[],longTasks:[],shifts:[],paint:[]};
      const x=window.__luenLCPAudit;
      try{new PerformanceObserver(l=>{for(const e of l.getEntries())x.lcp.push({
        at:e.startTime,tag:e.element?.tagName,src:e.element?.currentSrc||e.url||null,
        id:e.element?.id||null,className:String(e.element?.className||'').slice(0,180)
      });}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
      try{new PerformanceObserver(l=>{for(const e of l.getEntries())x.longTasks.push({
        at:e.startTime,duration:e.duration
      });}).observe({type:'longtask',buffered:true});}catch{}
      try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)x.shifts.push({
        at:e.startTime,value:e.value
      });}).observe({type:'layout-shift',buffered:true});}catch{}
      try{new PerformanceObserver(l=>{for(const e of l.getEntries())x.paint.push({
        name:e.name,at:e.startTime
      });}).observe({type:'paint',buffered:true});}catch{}
    });
    await page.coverage.startCSSCoverage({resetOnNavigation:false});
    let status=null,error=null;
    try{
      const resp=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});
      status=resp?.status()??null;
      await page.waitForTimeout(6500);
    }catch(e){error=String(e.message||e).slice(0,250);}
    const coverage=await page.coverage.stopCSSCoverage();
    const report=await page.evaluate(()=>{
      const data=window.__luenLCPAudit||{};
      const resources=performance.getEntriesByType('resource');
      const poster=resources.find(r=>r.name.includes('confier-poster.webp'));
      const css=resources.filter(r=>/\.css(?:\?|$)/.test(r.name));
      const hero=document.querySelector('.hero'),first=document.querySelector('.luen-motion-card img');
      const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {
        top:r.top,bottom:r.bottom,width:r.width,height:r.height};
      };
      const nav=performance.getEntriesByType('navigation')[0];
      return {
        lcp:data.lcp,paints:data.paint,longTasks:data.longTasks,layoutShifts:data.shifts,
        hero:rect(hero),confier:rect(first),
        poster:poster?{start:poster.startTime,end:poster.responseEnd,duration:poster.duration,
          transferSize:poster.transferSize,decodedSize:poster.decodedBodySize}:null,
        css:css.map(r=>({name:r.name,start:r.startTime,end:r.responseEnd,duration:r.duration,
          transferSize:r.transferSize})),
        nav:nav?{domContentLoaded:nav.domContentLoadedEventEnd,load:nav.loadEventEnd}:null,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        fontStatus:document.fonts.status,jsErrors:window.__luenJavaScriptErrors||[]
      };
    });
    const measured=await cdp.send('Performance.getMetrics');
    const metrics=Object.fromEntries(measured.metrics.filter(m=>[
      'RecalcStyleDuration','LayoutDuration','ScriptDuration','TaskDuration','Nodes','LayoutCount','RecalcStyleCount'
    ].includes(m.name)).map(m=>[m.name,m.value]));
    const styles=coverage.map(row=>{
      const ranges=[...row.ranges].sort((a,b)=>a.start-b.start),merged=[];
      for(const r of ranges){
        if(merged.length&&r.start<=merged[merged.length-1].end)
          merged[merged.length-1].end=Math.max(merged[merged.length-1].end,r.end);
        else merged.push({start:r.start,end:r.end});
      }
      const used=merged.reduce((n,r)=>n+r.end-r.start,0);
      return {url:row.url||'(inline)',total:row.text.length,used,unused:row.text.length-used,
        percent:row.text.length?Math.round(used/row.text.length*1000)/10:0};
    }).sort((a,b)=>b.total-a.total);
    const last=report.lcp?.at(-1),poster=report.poster;
    const result={device,width,run,status,error,
      latestLCP:last,lcpCount:report.lcp?.length,
      lcpDelayAfterPoster:last&&poster?Math.round(last.at-poster.end):null,
      poster,paints:report.paints,longTasks:report.longTasks.slice(0,30),
      totalLongTaskMs:report.longTasks.reduce((a,b)=>a+b.duration,0),
      nonInputCLS:report.layoutShifts.reduce((a,b)=>a+b.value,0),
      metrics,cssCoverage:styles,cssResourceTiming:report.css,
      overflow:report.overflow,fontStatus:report.fontStatus,
      failedRequests:networkFailures,assetResponses:responses};
    tests.push(result);
    if(error||status!==200||!report.poster||report.overflow>2)
      failures.push({device,run,error,status,poster:!!report.poster,overflow:report.overflow});
    console.log('LUEN_CSS_LCP_AUDIT_SAMPLE '+JSON.stringify({
      device,run,status,error,lcp:last,poster,delay:result.lcpDelayAfterPoster,
      usedCSS:styles.slice(0,10),metrics,failures:networkFailures}));
    await context.close();
  }
}
await browser.close();
const output={kind:'CI-only synthetic Chromium audit; CSS coverage is page-wide, not first-viewport isolated',
  sourceSha:process.env.LUEN_MAIN_SHA||'unknown',tests,failures};
fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(output,null,2));
const heroSummary=tests.map(t=>({device:t.device,run:t.run,
  LCP:Math.round(t.latestLCP?.at||0),posterResponseEnd:Math.round(t.poster?.end||0),
  delayAfterPoster:t.lcpDelayAfterPoster,styleRecalcMs:Math.round((t.metrics.RecalcStyleDuration||0)*1000),
  layoutMs:Math.round((t.metrics.LayoutDuration||0)*1000),
  longTaskMs:Math.round(t.totalLongTaskMs)}));
console.log('LUEN_CSS_LCP_AUDIT_SUMMARY '+JSON.stringify({heroSummary,failures}));
if(process.env.GITHUB_STEP_SUMMARY){
  let md='## LUEN mobile/desktop LCP source audit (read-only)\n\n';
  md+='CSS coverage represents all matched elements in the document, **NOT just the first viewport**. Chromium 4x CPU + throttled local HTTP, not field Core Web Vitals.\n\n';
  md+='| Device | Iteration | LCP ms | Poster response end ms | Gap after poster ms | Style recalc ms | Long tasks ms |\n';
  md+='|---|---:|---:|---:|---:|---:|---:|\n';
  for(const d of heroSummary)md+='| '+[d.device,d.run,d.LCP,d.posterResponseEnd,d.delayAfterPoster,d.styleRecalcMs,d.longTaskMs].join(' | ')+' |\n';
  md+='\nNo changes to images, videos, CSS, site source, DNS or Formspree.\n';
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
}
if(failures.length||tests.length!==4)process.exitCode=1;
