// LUEN diagnostic only: CDP CSS rule usage and resource cost by route/viewport.
// CSS coverage is observational, NOT permission to purge unobserved selectors.
// It does not submit forms or send GA4 pageviews.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const reportsDir=path.resolve('qa-screenshots','css-resource-audit');
fs.mkdirSync(reportsDir,{recursive:true});
const routes=['/','/services/','/services/instagram-influencer-marketing/',
  '/services/youtube-creator-marketing/','/cases/herahera-seoul-fnb/','/contact/'];
const layouts=[{label:'mobile',width:390,height:844},{label:'desktop',width:1440,height:900}];
const rows=[],problems=[];
const browser=await chromium.launch({headless:true});
const isSameSiteCSS=url=>url.includes('/assets/css/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function unionSize(items){
 const ranges=items.filter(v=>v.used).map(v=>[v.startOffset,v.endOffset]).sort((a,b)=>a[0]-b[0]);
 let total=0,start=-1,end=-1;
 for(const [a,b] of ranges){
   if(a>end){if(start>=0)total+=end-start;start=a;end=b;}
   else end=Math.max(end,b);
 }
 if(start>=0)total+=end-start;
 return total;
}
try{
 for(const layout of layouts){
  for(const route of routes){
   // Each route is a fresh, cold browser context; otherwise caching the
   // first route's font requests would falsely make later routes look cheap.
   const ctx=await browser.newContext({
    viewport:{width:layout.width,height:layout.height},deviceScaleFactor:1,reducedMotion:'reduce'
   });
   await ctx.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
   await ctx.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
   const page=await ctx.newPage();
   page.setDefaultTimeout(9000);
   const cdp=await ctx.newCDPSession(page);
   const styles=new Map(),network=new Map(),loaded=[],pageErrors=[];
   cdp.on('CSS.styleSheetAdded',event=>styles.set(event.header.styleSheetId,event.header));
   cdp.on('Network.responseReceived',event=>network.set(event.requestId,{
     url:event.response.url,status:event.response.status,type:event.type
   }));
   cdp.on('Network.loadingFinished',event=>{
     const req=network.get(event.requestId);
     if(req)loaded.push({...req,bytes:event.encodedDataLength});
   });
   page.on('pageerror',e=>pageErrors.push(e.message.slice(0,180)));
   try{
    await cdp.send('DOM.enable');await cdp.send('CSS.enable');await cdp.send('Network.enable');
    await cdp.send('CSS.startRuleUsageTracking');
    const response=await page.goto(base+route,{waitUntil:'load',timeout:55000});
    if(response?.status()!==200)throw Error('HTTP '+response?.status());
    // Scroll through the full page to exercise ordinary reveal states
    // without forcing risky clicks or external navigation.
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);
    const step=Math.max(480,Math.floor(layout.height*.8));
    for(let y=0;y<height;y+=step){
      await page.evaluate(y=>{
        document.documentElement.style.scrollBehavior='auto';
        window.scrollTo(0,y);
      },y);
      await sleep(50);
    }
    if(layout.width<=430){
      const open=page.locator('#hamburger');
      if(await open.count()&&await open.isVisible()){
        await open.click({timeout:9000});
        await sleep(100);
        await page.keyboard.press('Escape');
      }
    }
    // Toggle the first FAQ to account for dynamic CSS.
    const faq=page.locator('.faq-q, main details summary').first();
    if(await faq.count()&&await faq.isVisible()){
      await faq.click({timeout:7000}).catch(()=>{});
    }
    await sleep(200);
    const usage=(await cdp.send('CSS.stopRuleUsageTracking')).ruleUsage||[];
    const byStyle=new Map();
    for(const u of usage){
      if(!byStyle.has(u.styleSheetId))byStyle.set(u.styleSheetId,[]);
      byStyle.get(u.styleSheetId).push(u);
    }
    const coverage=[];
    for(const [id,header] of styles){
      if(!isSameSiteCSS(header.sourceURL||''))continue;
      const r=byStyle.get(id)||[];
      try{
       const css=(await cdp.send('CSS.getStyleSheetText',{styleSheetId:id})).text;
       coverage.push({file:new URL(header.sourceURL).pathname,
         stylesheetBytes:css.length,observedRuleBytes:unionSize(r),
         percentObserved:css.length?Math.round(unionSize(r)*1000/css.length)/10:0,
         trackedRanges:r.length,usedRanges:r.filter(x=>x.used).length});
      }catch(e){coverage.push({file:header.sourceURL,error:String(e.message).slice(0,180)})}
    }
    const summary={route,viewport:layout.label,css:coverage,
      localCSS:loaded.filter(x=>isSameSiteCSS(x.url)).map(x=>({
       file:new URL(x.url).pathname,bytes:x.bytes,status:x.status
      })),
      font:{requests:loaded.filter(x=>x.type==='Font'||/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(x.url)).length,
       bytes:loaded.filter(x=>x.type==='Font'||/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(x.url))
         .reduce((n,x)=>n+x.bytes,0)},
      scripts:loaded.filter(x=>x.type==='Script').map(x=>({url:x.url.slice(0,170),bytes:x.bytes})),
      resourceBytes:loaded.reduce((n,x)=>n+x.bytes,0),
      pageErrors:pageErrors.slice(),documentWidth:await page.evaluate(()=>document.documentElement.scrollWidth)};
    if(summary.documentWidth>layout.width+3)problems.push(route+' '+layout.label+' overflow '+summary.documentWidth);
    if(pageErrors.length)problems.push(route+' '+layout.label+' JS error '+pageErrors.join(';'));
    if(!coverage.some(x=>/site\.css$/.test(x.file))||!coverage.some(x=>/luen-v3\.css$/.test(x.file)))
      problems.push(route+' '+layout.label+' missing main stylesheet coverage');
    rows.push(summary);
    console.log('LUEN_CSS_RESOURCE_SAMPLE '+JSON.stringify({route,viewport:layout.label,
     css:coverage.map(x=>({file:x.file,observed:x.percentObserved,bytes:x.stylesheetBytes})),
     font:summary.font,resources:summary.resourceBytes}).slice(0,3900));
   }catch(e){problems.push(route+' '+layout.label+' '+String(e.message).slice(0,260));}
   await cdp.detach().catch(()=>{});
   await ctx.close();
  }
 }
}finally{await browser.close()}
const reports={source:'Unminified local code; sampled states only; do NOT delete unobserved rules',
  routes,layouts,rows,problems};
fs.writeFileSync(path.join(reportsDir,'coverage.json'),JSON.stringify(reports,null,2));
const aggregate={};
for(const row of rows)for(const css of row.css){
 if(!css.stylesheetBytes)continue;
 if(!aggregate[css.file])aggregate[css.file]={routeSamples:0,maxObservedPercent:0,minObservedPercent:100,bytes:css.stylesheetBytes};
 const r=aggregate[css.file];r.routeSamples++;
 r.maxObservedPercent=Math.max(r.maxObservedPercent,css.percentObserved);
 r.minObservedPercent=Math.min(r.minObservedPercent,css.percentObserved);
}
console.log('LUEN_CSS_RESOURCE_SUMMARY '+JSON.stringify({samples:rows.length,aggregate,
 topFont:rows.map(x=>({route:x.route,viewport:x.viewport,...x.font})),problems}));
if(problems.length||rows.length!==routes.length*layouts.length)process.exitCode=1;
