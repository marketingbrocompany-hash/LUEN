// Compare official source homepage with staged _site minified CSS.
// READ ONLY. Semantic equality asserted by build script; test geometry here.
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const paths=['/assets/css/site.css','/assets/css/luen-v3.css'];
const sites={source:'http://127.0.0.1:4273/',stage:'http://127.0.0.1:4274/'};
const selectors=['.hero h1','.hero-desc','.hero-cta .btn-primary',
 '.luen-motion-showcase','#cases .luen-case-entry',
 '#services .luen-service-choice','#selected-content .portfolio-card',
 '#faq .faq-cta','footer .footer-links a'];
const results=[],errors=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,768,1440]){
   const states={};
   for(const type of ['source','stage']){
    const context=await browser.newContext({viewport:{width,height:900},
     reducedMotion:'reduce',deviceScaleFactor:1});
    const page=await context.newPage(),assetResponses=[],jsErrors=[];
    page.on('pageerror',e=>jsErrors.push(String(e.message).slice(0,220)));
    page.on('response',r=>{
     if(paths.some(p=>r.url().includes(p)))assetResponses.push({url:r.url(),status:r.status()});
    });
    await page.goto(sites[type],{waitUntil:'load',timeout:55000});
    await page.waitForFunction(()=>{
     const link=document.querySelector('link[href*="pretendardvariable-dynamic-subset.min.css"]');
     return !!link&&link.media==='all'&&!!link.sheet;
    },null,{timeout:35000});
    await page.evaluate(async()=>{
     await document.fonts.load('400 16px "Pretendard Variable"',
       document.querySelector('main')?.innerText||'브랜드 마케팅');
     await document.fonts.ready;
    });
    await page.waitForTimeout(500);
    const data=await page.evaluate(selectors=>{
     const rects=selectors.map(selector=>{
      const e=document.querySelector(selector);
      if(!e)return {selector,missing:true};
      const r=e.getBoundingClientRect(),c=getComputedStyle(e);
      return {selector,w:r.width,h:r.height,text:e.textContent.trim().slice(0,160),
       font:c.fontFamily,size:c.fontSize,weight:c.fontWeight,
       line:c.lineHeight,color:c.color,background:c.backgroundColor,
       display:c.display};
     });
     return {rects,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
       cases:document.querySelectorAll('#cases .luen-case-entry').length,
       services:document.querySelectorAll('#services .luen-service-choice').length,
       cta:document.querySelectorAll('#services .luen-service-unified-cta').length,
       reels:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone):not(.ios-loop-clone) .portfolio-card.portrait').length
     };
    },selectors);
    states[type]={...data,jsErrors,assetResponses};
    await context.close();
   }
   const base=states.source,st=states.stage,issues=[];
   if(st.assetResponses.length!==2||st.assetResponses.some(r=>r.status!==200))
    issues.push('Minified CSS request missing or not HTTP 200');
   if(st.jsErrors.length)issues.push('JavaScript errors: '+st.jsErrors.join(' | '));
   if(st.overflow>2||st.cases!==4||st.services!==3||st.cta!==1||st.reels!==6)
    issues.push('Unexpected homepage structure/overflow');
   for(let i=0;i<selectors.length;i++){
    const a=base.rects[i],b=st.rects[i];
    if(a.missing||b.missing||a.text!==b.text||
     Math.abs(a.w-b.w)>2||Math.abs(a.h-b.h)>2||
     ['font','size','weight','line','color','background','display'].some(k=>a[k]!==b[k]))
       issues.push('CSS geometry/appearance changed '+selectors[i]);
   }
   results.push({engine:engine.name(),width,styles:st.assetResponses.length,issues});
   errors.push(...issues.map(x=>engine.name()+'/'+width+': '+x));
   console.log('LUEN_STAGED_CSS_BROWSER '+JSON.stringify(results.at(-1)));
  }
 }finally{await browser.close();}
}
fs.mkdirSync('qa-screenshots',{recursive:true});
fs.writeFileSync('qa-screenshots/css-staged-browser-qa.json',
 JSON.stringify({results,errors},null,2)+'\n');
console.log('LUEN_STAGED_CSS_BROWSER_SUMMARY '+JSON.stringify({checked:results.length,errors}));
if(errors.length||results.length!==8)process.exitCode=1;
