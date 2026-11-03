// LUEN hero rhythm + duplicate CTA regression; local preview only, no form submits.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const out=path.resolve('qa-screenshots/hero-editorial-rhythm');
fs.mkdirSync(out,{recursive:true});
const sizes=[320,360,390,430,768,1024,1440];
const results=[],failures=[];
for(const engine of [{name:'chromium',type:chromium},{name:'webkit',type:webkit}]){
 const browser=await engine.type.launch({headless:true});
 try{
  for(const width of sizes){
   const height=width<=430?844:900;
   const context=await browser.newContext({viewport:{width,height},
    isMobile:width<=430,hasTouch:width<=430,deviceScaleFactor:1,
    reducedMotion:'reduce'});
   await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message.slice(0,160)));
   try{
    const response=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
    if(response?.status()!==200)throw Error('HTTP '+response?.status());
    await page.waitForTimeout(220);
    const metrics=await page.evaluate(()=>{
     const h=document.querySelector('main#top>.hero h1');
     const desc=document.querySelector('main#top>.hero .hero-desc');
     const heroCta=document.querySelector('main#top>.hero .hero-cta');
     const floatCta=document.getElementById('floatCta');
     const r=e=>{const x=e.getBoundingClientRect();return {top:x.top,bottom:x.bottom,left:x.left,right:x.right,width:x.width,height:x.height};};
     return {titleFont:parseFloat(getComputedStyle(h).fontSize),
      lineHeight:parseFloat(getComputedStyle(h).lineHeight),
      descMargin:parseFloat(getComputedStyle(desc).marginTop),
      spans:[...h.children].map(r),floatShown:floatCta.classList.contains('show'),
      title:r(h),desc:r(desc),cta:r(heroCta),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    const ratio=metrics.lineHeight/metrics.titleFont;
    const targetRatio=width<=380?1.035:1.10;
    if(Math.abs(ratio-targetRatio)>.015)failures.push(engine.name+'/'+width+': headline line-height ratio '+ratio+' expected '+targetRatio);
    if(metrics.spans.length!==3)failures.push(engine.name+'/'+width+': expected three headline lines');
    for(let i=1;i<metrics.spans.length;i++){
      if(metrics.spans[i].top<metrics.spans[i-1].bottom-1)
       failures.push(engine.name+'/'+width+': headline line overlap '+i);
    }
    if(metrics.overflow>2)failures.push(engine.name+'/'+width+': horizontal overflow '+metrics.overflow);
    if(metrics.floatShown)failures.push(engine.name+'/'+width+': floating CTA shown at top');
    const scrollCheck=[];
    const end=Math.max(0,await page.locator('.hero').evaluate(e=>e.getBoundingClientRect().height)+height);
    for(let y=0;y<=end;y+=80){
     await page.evaluate(y=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,y);},y);
     await page.waitForTimeout(65);
     const v=await page.evaluate(()=>{
       const heroCta=document.querySelector('main#top>.hero .hero-cta');
       const floatCta=document.getElementById('floatCta');
       const b=heroCta?.getBoundingClientRect();
       const visible=Boolean(b&&b.width&&b.top<window.innerHeight&&b.bottom>0);
       return {heroCtaVisible:visible,floatShown:floatCta.classList.contains('show')};
     });
     if(v.heroCtaVisible&&v.floatShown)failures.push(engine.name+'/'+width+': duplicated visible hero and float CTA at scroll '+y);
     scrollCheck.push(v);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    if([320,390,768,1440].includes(width))
      await page.locator('main#top>.hero').screenshot({path:path.join(out,engine.name+'-'+width+'.jpg'),
       type:'jpeg',quality:74,animations:'disabled'});
    if(errors.length)failures.push(engine.name+'/'+width+': JS '+errors.join(';'));
    results.push({engine:engine.name,width,fontSize:metrics.titleFont,lineHeight:metrics.lineHeight,
     lineHeightRatio:+ratio.toFixed(3),descriptionMargin:metrics.descMargin,
     scrollSamples:scrollCheck.length,overflow:metrics.overflow});
   }catch(e){failures.push(engine.name+'/'+width+': '+String(e.message).slice(0,220));}
   await context.close();
  }
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,failures},null,2));
console.log('LUEN_HERO_EDITORIAL_RHYTHM_QA '+JSON.stringify({checked:results.length,
  widths:sizes,engines:2,failures,results}));
if(failures.length||results.length!==14)process.exitCode=1;
