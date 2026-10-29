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
  const active=()=>page.evaluate(()=>[...document.querySelectorAll('[data-motion-index]')].findIndex(x=>x.classList.contains('is-active')));
  const first=await active(),sequence=[first];
  for(const expected of [1,2,0]){
   try{
    await page.waitForFunction(index=>[...document.querySelectorAll('[data-motion-index]')].findIndex(x=>x.classList.contains('is-active'))===index,expected,{timeout:9000});
    sequence.push(await active());
   }catch(error){
    failures.push(type.name()+' rejected-video fallback failed to reach card '+expected+': '+error.message.slice(0,120));
    break;
   }
  }
  if(sequence.join(',')!=='0,1,2,0')failures.push(type.name()+' poster fallback sequence incomplete: '+sequence.join(','));
  // Manual pause must stop fallback rotation; resume must restore it.
  await page.locator('[data-motion-toggle]').click();
  const pausedAt=await active();
  await page.waitForTimeout(4400);
  const pauseHeld=await active()===pausedAt;
  if(!pauseHeld)failures.push(type.name()+' pause did not hold poster fallback at '+pausedAt);
  await page.locator('[data-motion-toggle]').click();
  let resumed=false;
  try{
   await page.waitForFunction(index=>[...document.querySelectorAll('[data-motion-index]')].findIndex(x=>x.classList.contains('is-active'))!==index,pausedAt,{timeout:9000});
   resumed=true;
  }catch{}
  if(!resumed)failures.push(type.name()+' poster fallback did not resume after manual play');
  results.push({engine:type.name(),scenario:'play-reject-3-card-cycle-pause-resume',sequence,pauseHeld,resumed});
  await ctx.close();
  if(type===webkit){
   // Separate real H.264 decode/ended path: do not confuse a poster fallback with native autoplay.
   const nativeCtx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
   const nativePage=await nativeCtx.newPage();
   await nativePage.goto(root+'/',{waitUntil:'domcontentloaded',timeout:45000});
   await nativePage.locator('[data-luen-motion]').scrollIntoViewIfNeeded();
   try{
    await nativePage.waitForFunction(()=>{
     const v=document.querySelector('[data-motion-index="0"] video');
     return v&&v.currentTime>.35&&v.error===null;
    },null,{timeout:7500});
    await nativePage.waitForFunction(()=>document.querySelector('[data-motion-index="1"]')?.classList.contains('is-active'),null,{timeout:15000});
    results.push({engine:'webkit',scenario:'native-h264-ended-rotates',success:true});
   }catch(error){
    failures.push('WebKit native H264 autoplay/ended did not progress: '+error.message.slice(0,130));
    results.push({engine:'webkit',scenario:'native-h264-ended-rotates',success:false});
   }
   await nativeCtx.close();
  }
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,failures},null,2));
console.log('LUEN_HERO_THREE_VIDEO_QA '+JSON.stringify({checks:results.length,failures,results}));
if(failures.length)process.exitCode=1;
