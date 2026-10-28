// Read-only hero CLS diagnosis. Local site; no form submissions, no deployment.
// Compare first paint / late Pretendard font swap and record DOM geometry.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=process.env.LUEN_QA_URL||'http://127.0.0.1:4173';
const out=path.resolve('qa-screenshots/hero-font-cls-diagnostics');
fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];
const devices=[
  {width:320,height:780},{width:360,height:780},
  {width:390,height:844},{width:430,height:932},
  {width:768,height:1024},{width:1440,height:900}
];
for(const browserType of [chromium,webkit]){
  const engine=browserType.name(),browser=await browserType.launch({headless:true});
  try{
    for(const v of devices){
      for(const slow of [false,true]){
        // Use fresh context for every load, no cross-run asset cache.
        const context=await browser.newContext({viewport:v,deviceScaleFactor:1});
        if(slow)await context.route(/pretendardvariable-dynamic-subset\.min\.css/,async route=>{
          await new Promise(resolve=>setTimeout(resolve,1800));
          try{await route.continue();}catch{}
        });
        const page=await context.newPage(),label=engine+'/'+v.width+(slow?'/delayed':'/normal');
        page.on('pageerror',e=>errors.push(label+' '+e.message.slice(0,160)));
        await page.addInitScript(()=>{
          window.__shiftSamples=[];
          try{
            new PerformanceObserver(list=>{
              for(const s of list.getEntries()){
                if(s.hadRecentInput)continue;
                window.__shiftSamples.push({value:s.value,at:Math.round(s.startTime),
                  sources:(s.sources||[]).slice(0,4).map(q=>({
                    node:q.node?.tagName+'#'+(q.node?.id||'')+'.'+(q.node?.className||''),
                    previous:q.previousRect,current:q.currentRect
                  }))});
              }
            }).observe({type:'layout-shift',buffered:true});
          }catch{}
        });
        try{
          const response=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:35000});
          if(!response?.ok())throw Error('HTTP '+response?.status());
          const geometry=async()=>await page.evaluate(()=>{
            const rect=selector=>{
              const e=document.querySelector(selector);
              if(!e)return null;
              const r=e.getBoundingClientRect();
              return {top:+r.top.toFixed(1),height:+r.height.toFixed(1),width:+r.width.toFixed(1)};
            };
            const font=window.getComputedStyle(document.querySelector('.hero-desc')||document.body);
            return {at:Math.round(performance.now()),fontState:document.fonts.status,
              fontFamily:font.fontFamily,hero:rect('main#top>.hero'),
              copy:rect('.hero-copy'),heading:rect('.hero-copy h1'),
              desc:rect('.hero-desc'),cta:rect('.hero-cta'),
              showcase:rect('.luen-motion-showcase'),
              hasPretendard:document.fonts.check('450 14px "Pretendard Variable"','가나다'),
              shifts:window.__shiftSamples};
          });
          const first=await geometry();
          await page.waitForTimeout(800);
          const at800=await geometry();
          await page.waitForTimeout(2200);
          const at3000=await geometry();
          const shifts=at3000.shifts||[];
          const record={label,width:v.width,engine,delayedStylesheet:slow,
            first,at800,at3000,cls:shifts.reduce((a,s)=>a+s.value,0),
            copyHeightDelta:+((at3000.copy?.height??0)-(first.copy?.height??0)).toFixed(1),
            showcaseTopDelta:+((at3000.showcase?.top??0)-(first.showcase?.top??0)).toFixed(1)};
          results.push(record);
          console.log('LUEN_HERO_FONT_DIAG '+JSON.stringify({label,first:record.first.copy,
            loaded:record.at3000.copy,delta:record.copyHeightDelta,
            showcaseDelta:record.showcaseTopDelta,cls:record.cls,
            pretFirst:first.hasPretendard,pretFinal:at3000.hasPretendard}).slice(0,1000));
          if([320,390,430].includes(v.width)&&slow)
            await page.screenshot({path:path.join(out,engine+'-'+v.width+'.jpg'),type:'jpeg',quality:70});
        }catch(e){errors.push(label+': '+e.message);}
        finally{await context.close();}
      }
    }
  }finally{await browser.close();}
}
const summary={checked:results.length,errors,results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(summary,null,2));
console.log('LUEN_HERO_FONT_CLS_SUMMARY '+JSON.stringify({
  checked:results.length,errors:errors.length,
  samples:results.map(v=>({label:v.label,delta:v.copyHeightDelta,showcaseDelta:v.showcaseTopDelta,cls:v.cls}))
}));
if(errors.length||results.length!==24)process.exitCode=1;
