// LUEN IN MOTION browser audit — preview-only, non-destructive.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const base=(process.env.LUEN_QA_URL||'https://luen-preview.pages.dev').replace(/\/$/,'');
const widths=[{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844},{name:'mobile-narrow',width:320,height:690}];
const failures=[],reports=[];
const folder=path.resolve('qa-screenshots/hero-motion');
fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const w of widths){
  const ctx=await browser.newContext({viewport:{width:w.width,height:w.height},reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
  try{
   const r=await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   if(r?.status()!==200)throw new Error('Hero page HTTP '+r?.status());
   const section=page.locator('[data-luen-motion]');
   await section.scrollIntoViewIfNeeded();
   const cards=section.locator('[data-motion-index]');
   if(await cards.count()!==3)throw new Error('Hero should show 3 campaigns');
   for(const name of ['confier','quadthera','clinic']){
    const poster=section.locator('img[src="/assets/images/luen-motion/'+name+'-poster.webp"]');
    if(await poster.count()!==1)throw new Error('Poster missing: '+name);
    await poster.scrollIntoViewIfNeeded();
    await page.waitForFunction(key=>{
      const img=document.querySelector('img[src="/assets/images/luen-motion/'+key+'-poster.webp"]');
      return img?.complete && img.naturalWidth>=100 && img.naturalHeight>=80;
    },name,{timeout:12000});
   }
   // Selecting the Beauty card must load its own real MP4 but not other inactive videos.
   await cards.nth(1).click({timeout:12000});
   await page.waitForFunction(()=>{
     const card=document.querySelector('[data-motion-index="1"]');
     const v=card?.querySelector('video');
     return card?.classList.contains('is-active')&&v?.readyState>=2&&v.currentTime>.05;
   },null,{timeout:12000});
   const selected=await page.evaluate(()=>{
     const tiles=[...document.querySelectorAll('[data-motion-index]')];
     return {active:tiles.map((t,i)=>t.classList.contains('is-active')?i:null).filter(x=>x!==null),
       videos:tiles.map(t=>({src:t.querySelector('video').getAttribute('src'),playing:!t.querySelector('video').paused})),
       overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   if(selected.active.length!==1||selected.active[0]!==1)throw new Error('Manual Quadthera selection failed');
   if(selected.videos.filter(v=>v.playing).length!==1)throw new Error('Expected exactly one active clip: '+JSON.stringify(selected.videos));
   if(selected.overflow>3)throw new Error('Page has horizontal overflow: '+selected.overflow);
   const pause=section.locator('[data-motion-toggle]');
   await pause.click();
   await page.waitForTimeout(250);
   if(!await cards.nth(1).locator('video').evaluate(v=>v.paused))throw new Error('Pause control not working');
   await page.screenshot({path:path.join(folder,'hero-motion-'+w.name+'.jpg'),type:'jpeg',quality:75,animations:'disabled'});
   reports.push({viewport:w.name,ok:true,selected});
  }catch(e){failures.push({viewport:w.name,error:String(e.message).slice(0,380)});}
  finally{if(errors.length)failures.push({viewport:w.name,jsErrors:errors.slice(0,4)});await ctx.close();}
 }
 console.log('LUEN_HERO_VIDEO_QA '+JSON.stringify({pairs:reports.length,failures}));
 if(failures.length)process.exitCode=1;
}finally{await browser.close();}
