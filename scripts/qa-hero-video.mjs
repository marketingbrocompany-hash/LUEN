// LUEN showcase removal regression QA: check at real responsive widths.
// Videos/assets are intentionally retained in the repository for rollback.
import {chromium} from 'playwright';
const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const widths=[{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844},{name:'mobile-narrow',width:320,height:690}];
const failures=[],results=[];
const browser=await chromium.launch({headless:true});
try{
 for(const v of widths){
  const context=await browser.newContext({viewport:{width:v.width,height:v.height},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   const response=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
   if(!response||response.status()>=400)throw Error('Homepage HTTP '+response?.status());
   const result=await page.evaluate(()=>{
     const doc=document.documentElement;
     const hero=document.querySelector('main#top>.hero');
     const h1=hero?.querySelector('h1');
     const strips=[...document.querySelectorAll('#selected-content .portfolio-viewport')];
     const cards=strips.map(el=>el.querySelectorAll('.loop-set:not(.loop-clone) .portfolio-card').length);
     return {
       removed:document.querySelectorAll('[data-luen-motion],.luen-motion-showcase,[data-motion-index],.luen-motion-pause').length,
       mediaScripts:document.querySelectorAll('script[src*="luen-motion-hero.js"],link[href*="luen-motion-hero.css"]').length,
       h1Visible:!!h1&&h1.getBoundingClientRect().width>0,
       heroCopy:hero?.querySelector('.hero-copy')?.getBoundingClientRect().width||0,
       strips:strips.length,
       cards,
       creatorSection:!!document.getElementById('partner-creators'),
       overflow:doc.scrollWidth-doc.clientWidth
     };
   });
   if(result.removed!==0||result.mediaScripts!==0)failures.push(v.name+': removed showcase still present/loaded');
   if(!result.h1Visible||result.heroCopy<200)failures.push(v.name+': editorial hero copy missing or too narrow');
   if(result.strips!==2||result.cards.reduce((a,b)=>a+b,0)!==12)failures.push(v.name+': moving content cards not preserved');
   if(!result.creatorSection)failures.push(v.name+': partner creators section missing');
   if(result.overflow>3)failures.push(v.name+': horizontal overflow '+result.overflow);
   if(errors.length)failures.push(v.name+': JS '+errors.slice(0,3).join('; '));
   results.push({viewport:v.name,...result,jsErrors:errors.length});
  }catch(error){failures.push(v.name+': '+String(error.message).slice(0,250));}
  finally{await context.close();}
 }
}finally{await browser.close();}
console.log('LUEN_SHOWCASE_REMOVAL_QA '+JSON.stringify({results,failures}));
if(failures.length)process.exitCode=1;
