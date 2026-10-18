// LUEN Homepage browser QA: real motion, reduced-motion and font cost.
// Only runs against a local static server. Does not submit forms or send GA traffic.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','homepage-motion');
fs.mkdirSync(dir,{recursive:true});
const failures=[];
const results=[];
const browser=await chromium.launch({headless:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const guards=[
  {name:'mobile-390',width:390,height:844},
  {name:'desktop-1440',width:1440,height:900},
  {name:'mobile-320',width:320,height:650}
];
try{
 for(const v of guards){
   const context=await browser.newContext({
     viewport:{width:v.width,height:v.height},
     reducedMotion:'no-preference',deviceScaleFactor:1
   });
   // Guard GA4: testing must never send synthetic pageviews to Analytics.
   await context.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
   await context.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
   const page=await context.newPage();
   const errs=[];
   page.on('pageerror',e=>errs.push(e.message.slice(0,250)));
   try{
     const response=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:35000});
     if(response?.status()!==200)throw Error('HTTP '+response?.status());
     await page.waitForLoadState('load',{timeout:35000});
     await page.waitForTimeout(450);
     const strips=page.locator('[data-loop-strip]');
     if(await strips.count()!==3)throw Error('Expected three moving rails, got '+await strips.count());
     const before=await page.locator('.loop-clone').count();
     if(before<3)failures.push(v.name+': expected moving loop clones; got '+before);
     const paths=[];
     for(let i=0;i<3;i++){
       const strip=strips.nth(i);
       await strip.scrollIntoViewIfNeeded({timeout:10000});
       await page.waitForTimeout(200);
       const read=()=>strip.locator('.loop-track').evaluate(el=>getComputedStyle(el).transform);
       const a=await read();
       await page.waitForTimeout(400);
       const b=await read();
       const clones=await strip.locator('.loop-clone').count();
       const original=await strip.locator('.loop-set:not(.loop-clone)').count();
       if(!clones||original!==1)failures.push(v.name+': rail '+i+' clone/original missing ('+clones+'/'+original+')');
       if(a===b)failures.push(v.name+': rail '+i+' not moving ('+a+')');
       paths.push({rail:i,clones,moved:a!==b,transformBefore:a,transformAfter:b});
     }
     // Test *live* OS preference transitions, not only initial load.
     await page.evaluate(()=>{
       window.__luenReducedChanges=[];
       window.__luenReducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
       window.__luenReducedQuery.addEventListener('change',event=>window.__luenReducedChanges.push(event.matches));
     });
     await page.emulateMedia({reducedMotion:'reduce'});
     await page.waitForTimeout(320);
     const reduced=await page.evaluate(()=>({
       clones:document.querySelectorAll('.loop-clone').length,
       viewportWidth:document.documentElement.clientWidth,
       scrollWidth:document.documentElement.scrollWidth,
       mediaMatches:matchMedia('(prefers-reduced-motion: reduce)').matches,
       storedMediaMatches:window.__luenReducedQuery?.matches,
       mediaChangeEvents:window.__luenReducedChanges,
       preferenceHandlerCalls:window.__luenMotionPreferenceEvents||0,
       htmlClass:document.documentElement.className,
       transforms:[...document.querySelectorAll('[data-loop-strip] .loop-track')].map(e=>getComputedStyle(e).transform)
     }));
     if(reduced.clones!==0)failures.push(v.name+': toggling reduced-motion left '+reduced.clones+' clones; trace '+JSON.stringify(reduced));
     if(reduced.scrollWidth>v.width+2)failures.push(v.name+': reduced-motion overflow '+reduced.scrollWidth);
     await page.emulateMedia({reducedMotion:'no-preference'});
     await page.waitForTimeout(350);
     const restored=await page.locator('.loop-clone').count();
     if(restored<3)failures.push(v.name+': normal motion not restored, '+restored+' clones');
     await page.evaluate(()=>window.scrollTo(0,0));
     if(v.name!=='mobile-320')await page.screenshot({
       path:path.join(dir,v.name+'-first-fold.jpg'),type:'jpeg',quality:70,animations:'disabled'
     });
     if(errs.length)failures.push(v.name+': JS errors '+[...new Set(errs)].join(';'));
     results.push({viewport:v.name,initialClones:before,rails:paths,reducedClones:reduced.clones,restoredClones:restored,jsErrors:errs.length});
   }catch(e){failures.push(v.name+': '+String(e.message).slice(0,280));}
   await context.close();
 }
 // Non-changing diagnostic of font network/paint cost. GA requests are blocked
 // in both cases; font blocking can change appearance and must NOT be shipped.
 for(const mode of ['fonts-normal','fonts-blocked']){
   const context=await browser.newContext({
     viewport:{width:390,height:844},reducedMotion:'reduce',deviceScaleFactor:1
   });
   await context.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
   await context.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
   if(mode==='fonts-blocked'){
     await context.route(/\.(?:woff2?|ttf|otf)(?:\?.*)?$/i,r=>r.abort());
     await context.route('https://fonts.googleapis.com/**',r=>r.abort());
   }
   const page=await context.newPage();
   await page.addInitScript(()=>{
     window.__luenMeasurements={longTasks:[],lcp:[]};
     try{new PerformanceObserver(list=>{
       for(const e of list.getEntries())window.__luenMeasurements.longTasks.push({at:e.startTime,duration:e.duration});
     }).observe({entryTypes:['longtask']});}catch{}
     try{new PerformanceObserver(list=>{
       for(const e of list.getEntries())window.__luenMeasurements.lcp.push(e.startTime);
     }).observe({type:'largest-contentful-paint',buffered:true});}catch{}
   });
   const requests=[];
   page.on('request',r=>requests.push(r.url()));
   const pageErrors=[];
   page.on('pageerror',e=>pageErrors.push(e.message.slice(0,120)));
   try{
     const started=Date.now();
     const res=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
     await page.waitForTimeout(1700);
     const perf=await page.evaluate(()=>{
       const nav=performance.getEntriesByType('navigation')[0];
       const paints=performance.getEntriesByType('paint');
       const p=(name)=>paints.find(e=>e.name===name)?.startTime??null;
       const fontFaceChecks={
         pretendard:document.fonts.check('16px "Pretendard Variable"'),
         inter:document.fonts.check('16px Inter')
       };
       const tasks=window.__luenMeasurements?.longTasks||[];
       const lcps=window.__luenMeasurements?.lcp||[];
       return {
         domContentLoadedMs:nav?.domContentLoadedEventEnd??null,
         loadEventMs:nav?.loadEventEnd??null,
         firstPaintMs:p('first-paint'),
         firstContentfulPaintMs:p('first-contentful-paint'),
         lastLcpCandidateMs:lcps.at(-1)??null,
         longTasks:tasks.length,
         longTaskTotalMs:Math.round(tasks.reduce((n,e)=>n+e.duration,0)),
         bodyFont:getComputedStyle(document.body).fontFamily,
         fontFaceChecks,
         width:document.documentElement.scrollWidth
       };
     });
     const count=requests.filter(u=>/\.(?:woff2?|ttf|otf)(?:\?.*)?$/i.test(u)).length;
     if(res?.status()!==200)failures.push(mode+': HTTP '+res?.status());
     if(perf.width>390+2)failures.push(mode+': horizontal overflow '+perf.width);
     if(pageErrors.length)failures.push(mode+': JS errors '+pageErrors.join(';'));
     results.push({mode,elapsedMs:Date.now()-started,fontRequests:count,metrics:perf});
   }catch(e){failures.push(mode+': '+String(e.message).slice(0,280));}
   await context.close();
 }
}finally{await browser.close();}
const summary={target:base,results,failures};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
console.log('LUEN_HOME_MOTION_PERF_QA '+JSON.stringify({checks:results.length,failures:failures.length,results}));
for(const f of failures)console.error('LUEN_HOME_MOTION_PERF_FAIL '+f);
if(failures.length)process.exitCode=1;
