// LUEN homepage QA: HOW LUEN WORKS timeline alignment and the floating
// inquiry button never covering the FAQ project CTA.
// Local static server only: never deploys, submits forms or sends GA4 hits.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','flow-timeline-float-cta');
fs.mkdirSync(dir,{recursive:true});
const failures=[],results=[];
const browser=await chromium.launch({headless:true});
try{
  for(const width of [320,360,390,430,740,768,1024,1440]){
    const mobile=width<700;
    const context=await browser.newContext({
      viewport:{width,height:mobile?844:900},isMobile:mobile,hasTouch:mobile,
      deviceScaleFactor:1,reducedMotion:'reduce'
    });
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    try{
      const response=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
      if(response?.status()!==200)throw Error('HTTP '+response?.status());
      await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});

      // Every step's number and title start at the same offset, clear of the dot.
      const steps=await page.evaluate(()=>[...document.querySelectorAll('#content-flow ol > li')].map(li=>{
        const box=li.getBoundingClientRect();
        const dot=getComputedStyle(li,'::before');
        return {
          number:Math.round(li.querySelector('span').getBoundingClientRect().left-box.left),
          title:Math.round(li.querySelector('strong').getBoundingClientRect().left-box.left),
          dotRight:parseFloat(dot.left)+parseFloat(dot.width),
          top:Math.round(li.querySelector('strong').getBoundingClientRect().top-box.top)
        };
      }));
      if(steps.length!==4)failures.push(width+': expected 4 timeline steps, got '+steps.length);
      if(new Set(steps.map(s=>s.title)).size!==1||new Set(steps.map(s=>s.number)).size!==1)
        failures.push(width+': timeline steps misaligned '+JSON.stringify(steps));
      // Vertical (mobile) timeline: text must start right of the dot, not on it.
      const vertical=steps.length>1&&steps.every(s=>s.top<s.dotRight+40)&&
        await page.evaluate(()=>getComputedStyle(document.querySelector('#content-flow ol')).gridTemplateColumns.split(' ').length===1);
      if(vertical&&steps.some(s=>s.title<s.dotRight+4))
        failures.push(width+': timeline text overlaps its dot '+JSON.stringify(steps));

      // Scroll the whole page: the floating button never sits on the FAQ CTA.
      const scan=await page.evaluate(async()=>{
        const floating=document.getElementById('floatCta');
        const faqCta=document.querySelector('#faq .faq-cta');
        let shown=0,overlap=0;
        for(let y=0;y<document.documentElement.scrollHeight;y+=120){
          scrollTo(0,y);
          await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
          if(!floating.classList.contains('show'))continue;
          shown++;
          const a=floating.getBoundingClientRect(),b=faqCta.getBoundingClientRect();
          if(b.width&&a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom)overlap++;
        }
        return {shown,overlap};
      });
      if(scan.overlap)failures.push(width+': floating CTA covered the FAQ CTA at '+scan.overlap+' scroll positions');
      if(!scan.shown)failures.push(width+': floating CTA never appeared');
      if(width===390||width===740){
        await page.locator('#content-flow ol').scrollIntoViewIfNeeded();
        await page.locator('#content-flow ol').screenshot({path:path.join(dir,'timeline-'+width+'.jpg'),type:'jpeg',quality:65});
      }
      if(errors.length)failures.push(width+': JS errors '+errors.join(';'));
      results.push({width,steps:steps.map(s=>s.title),floatShownPositions:scan.shown,faqOverlap:scan.overlap});
    }catch(e){failures.push(width+': '+String(e.message).slice(0,280));}
    await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,results,failures},null,2));
console.log('LUEN_FLOW_TIMELINE_FLOAT_CTA_QA '+JSON.stringify({runs:results.length,failures:failures.length,results}));
for(const f of failures)console.error('LUEN_FLOW_TIMELINE_FLOAT_CTA_FAIL '+f);
if(failures.length)process.exitCode=1;
