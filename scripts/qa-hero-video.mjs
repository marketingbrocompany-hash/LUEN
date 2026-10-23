// LUEN IN MOTION browser audit — preview-only, non-destructive.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const base=(process.env.LUEN_QA_URL||'https://luen-preview.pages.dev').replace(/\/$/,'');
const widths=[{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844},{name:'mobile-narrow',width:320,height:690}];
const failures=[],warnings=[],reports=[];
const folder=path.resolve('qa-screenshots/hero-motion');
fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const w of widths){
  const ctx=await browser.newContext({viewport:{width:w.width,height:w.height},reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  const errors=[];
  let phase='navigation';
  page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
  try{
   const r=await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   if(r?.status()!==200)throw new Error('Hero page HTTP '+r?.status());
   phase='hero visibility';
   const section=page.locator('[data-luen-motion]');
   await section.scrollIntoViewIfNeeded();
   const cards=section.locator('[data-motion-index]');
   if(await cards.count()!==3)throw new Error('Hero should show 3 campaigns');
   for(const name of ['confier','quadthera','clinic']){
    const poster=section.locator('img[src^="/assets/images/luen-motion/'+name+'-poster.webp"]');
    if(await poster.count()!==1)throw new Error('Poster missing: '+name);
    phase='poster '+name;
    await poster.scrollIntoViewIfNeeded();
    await page.waitForFunction(key=>{
      const img=document.querySelector('img[src^="/assets/images/luen-motion/'+key+'-poster.webp"]');
      return img?.complete && img.naturalWidth>=100 && img.naturalHeight>=80;
    },name,{timeout:12000});
   }
   // Selecting the Beauty card must load its own real MP4 but not other inactive videos.
   phase='Quadthera click and playback';
   await cards.nth(1).click({timeout:12000});
   await page.waitForFunction(()=>{
     const card=document.querySelector('[data-motion-index="1"]');
     const v=card?.querySelector('video');
     return card?.classList.contains('is-active')&&!!v?.getAttribute('src');
   },null,{timeout:12000});
   // Headless Chromium may have no proprietary H.264 decoder. Verify original
   // actual MP4 bytes separately rather than falsely treating that as a site bug.
   const source=await cards.nth(1).locator('video').getAttribute('src');
   const mediaResponse=await page.request.get(base+source,{timeout:15000});
   const bytes=await mediaResponse.body();
   if(mediaResponse.status()!==200||bytes.length<180000||bytes.toString('ascii',4,8)!=='ftyp')
     throw new Error('Quadthera MP4 missing/invalid: HTTP '+mediaResponse.status()+' bytes='+bytes.length);
   const codec=await cards.nth(1).locator('video').evaluate(v=>({
     decoder:v.canPlayType('video/mp4; codecs="avc1.4D401E"'),
     error:v.error?.code||0
   }));
   if(codec.decoder){
     await page.waitForFunction(()=>{
       const v=document.querySelector('[data-motion-index="1"] video');
       return v?.readyState>=2&&v.currentTime>.05;
     },null,{timeout:12000});
   }else{
     warnings.push({viewport:w.name,reason:'H.264 playback cannot be verified in test browser; MP4 bytes and poster verified.'});
   }
   const selected=await page.evaluate(()=>{
     const tiles=[...document.querySelectorAll('[data-motion-index]')];
     return {active:tiles.map((t,i)=>t.classList.contains('is-active')?i:null).filter(x=>x!==null),
       videos:tiles.map(t=>({src:t.querySelector('video').getAttribute('src'),playing:!t.querySelector('video').paused})),
       overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   if(selected.active.length!==1||selected.active[0]!==1)throw new Error('Manual Quadthera selection failed');
   if(codec.decoder&&selected.videos.filter(v=>v.playing).length!==1)
     throw new Error('Expected exactly one active clip: '+JSON.stringify(selected.videos));
   if(selected.overflow>3)throw new Error('Page has horizontal overflow: '+selected.overflow);
   const pause=section.locator('[data-motion-toggle]');
   await pause.click();
   await page.waitForTimeout(250);
   if(!await cards.nth(1).locator('video').evaluate(v=>v.paused))throw new Error('Pause control not working');
   await page.screenshot({path:path.join(folder,'hero-motion-'+w.name+'.jpg'),type:'jpeg',quality:75,animations:'disabled'});
   reports.push({viewport:w.name,ok:true,selected});
  }catch(e){
    let diagnostic=null,videoHTTP=null;
    try{
      diagnostic=await page.evaluate(()=>({
        visibility:document.visibilityState,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
        rootRect:(()=>{const r=document.querySelector('[data-luen-motion]')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,width:r.width}:null})(),
        cards:[...document.querySelectorAll('[data-motion-index]')].map(card=>{
          const video=card.querySelector('video'),img=card.querySelector('img');
          return {name:card.dataset.motionIndex,active:card.classList.contains('is-active'),
            playing:card.classList.contains('is-playing'),video:{paused:video?.paused,readyState:video?.readyState,
              networkState:video?.networkState,currentTime:video?.currentTime,src:video?.getAttribute('src'),
              error:video?.error?.code,videoWidth:video?.videoWidth,videoHeight:video?.videoHeight},
            img:{complete:img?.complete,naturalWidth:img?.naturalWidth,naturalHeight:img?.naturalHeight,src:img?.currentSrc}};
        })
      }));
    }catch(_err){}
    try{
      const head=await page.request.head(base+'/assets/video/luen-motion/quadthera-preview.mp4',{timeout:6000});
      videoHTTP={status:head.status(),type:head.headers()['content-type'],length:head.headers()['content-length']};
    }catch(_err){}
    failures.push({viewport:w.name,phase,error:String(e.message).slice(0,250),diagnostic,videoHTTP});
  }
  finally{if(errors.length)failures.push({viewport:w.name,jsErrors:errors.slice(0,4)});await ctx.close();}
 }
 console.log('LUEN_HERO_VIDEO_QA '+JSON.stringify({pairs:reports.length,failures,warnings}));
 if(failures.length)process.exitCode=1;
}finally{await browser.close();}
