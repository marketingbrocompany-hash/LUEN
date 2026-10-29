// Browser diagnostic for LUEN IN MOTION, no production mutation.
import {chromium, webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const out=path.resolve('qa-screenshots/hero-three-videos');
fs.mkdirSync(out,{recursive:true});
const results=[],failures=[];
for(const type of [chromium,webkit]){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(root+'/',{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('[data-luen-motion]').scrollIntoViewIfNeeded();
   for(const index of [0,1,2]){
    const card=page.locator('[data-motion-index="'+index+'"]');
    await card.click();
    await page.waitForTimeout(300);
    const video=card.locator('video');
    const before=await video.evaluate(v=>({src:v.getAttribute('src'),currentTime:v.currentTime,
      error:v.error?.code||0,readyState:v.readyState,networkState:v.networkState,
      decoder:v.canPlayType('video/mp4; codecs="avc1.4D401E"'),w:v.videoWidth,h:v.videoHeight}));
    await page.waitForTimeout(2000);
    const after=await video.evaluate(v=>({currentTime:v.currentTime,paused:v.paused,
      error:v.error?.code||0,readyState:v.readyState,networkState:v.networkState,
      w:v.videoWidth,h:v.videoHeight}));
    const result={engine:type.name(),width,index,before,after,advancing:after.currentTime>before.currentTime+.2};
    results.push(result);
    if(!before.src?.includes(['confier-preview','quadthera-preview','clinic-preview'][index]))
      failures.push('Missing video src '+JSON.stringify(result));
    // Codec availability is platform-specific in CI. Do not call unsupported headless decoding a site bug.
    if(!result.advancing)console.warn('LUEN_HERO_DECODER_DIAGNOSTIC '+JSON.stringify(result));
   }
   if(errors.length)failures.push('Page errors '+type.name()+' '+width+': '+errors.slice(0,4).join(' | '));
   await ctx.close();
  }
  // Inject promise rejection to simulate a supported browser that refuses media.
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.addInitScript(()=>{
   HTMLMediaElement.prototype.play=function(){
    return Promise.reject(new DOMException('Simulated media playback error','NotSupportedError'));
   };
  });
  await page.goto(root+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('[data-luen-motion]').scrollIntoViewIfNeeded();
  const first=await page.evaluate(()=>[...document.querySelectorAll('[data-motion-index]')].findIndex(x=>x.classList.contains('is-active')));
  await page.waitForTimeout(6100);
  const last=await page.evaluate(()=>[...document.querySelectorAll('[data-motion-index]')].findIndex(x=>x.classList.contains('is-active')));
  const moved=first!==last;
  results.push({engine:type.name(),scenario:'play-reject-fallback',first,last,moved});
  if(!moved)failures.push(type.name()+' video play rejects; carousel stays frozen on same card after 6.1s.');
  await ctx.close();
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,failures},null,2));
console.log('LUEN_HERO_THREE_VIDEO_QA '+JSON.stringify({checks:results.length,failures,results}));
if(failures.length)process.exitCode=1;
