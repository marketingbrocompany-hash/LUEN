// LUEN homepage #selected-content long-form / reels rails — mobile QA and
// diagnostics. Local static server only: never deploys, submits forms or
// sends GA4 measurements.
//
// Chromium (Android path, site-core.js) receives real CDP touch input.
// WebKit (iPhone path, site.js) is emulation only and receives dispatched
// pointer events; it is NOT a physical iPhone Safari result.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const loads=Number(process.env.LUEN_RAIL_LOADS||2);
const dir=path.resolve('qa-screenshots','selected-rails-mobile');
fs.mkdirSync(dir,{recursive:true});
const failures=[],warnings=[],results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const android='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const runs=[
  {engine:'chromium',type:chromium,width:390,height:844},
  {engine:'chromium',type:chromium,width:360,height:780},
  {engine:'chromium',type:chromium,width:320,height:650},
  {engine:'webkit',type:webkit,width:390,height:844},
  {engine:'webkit',type:webkit,width:430,height:932},
  {engine:'webkit',type:webkit,width:320,height:650}
];

// Count every animation frame so a frozen rail can be told apart from a
// browser that stopped delivering requestAnimationFrame callbacks.
// Also count loop rebuilds (each one removes the previous clone sets).
const frameCounter=()=>{
  window.__luenFrames=0;
  window.__luenRebuilds=0;
  const count=()=>{window.__luenFrames++;requestAnimationFrame(count);};
  requestAnimationFrame(count);
  document.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(records=>{
      for(const record of records)for(const node of record.removedNodes){
        if(node.classList?.contains('loop-clone')&&record.target.closest?.('#selected-content'))window.__luenRebuilds++;
      }
    }).observe(document.body,{childList:true,subtree:true});
  });
};

const railState=(page,index)=>page.evaluate(i=>{
  const rail=document.querySelectorAll('#selected-content .portfolio-viewport')[i];
  const track=rail.querySelector('.loop-track');
  const sets=[...track.querySelectorAll('.loop-set')];
  const source=sets[0];
  const sourceRect=source.getBoundingClientRect();
  const offset=-new DOMMatrix(getComputedStyle(track).transform).m41;
  const lastCard=source.lastElementChild.getBoundingClientRect();
  const contentWidth=lastCard.right-sourceRect.left+parseFloat(getComputedStyle(source).paddingRight);
  return {
    contentWidth,cardWidth:source.firstElementChild.getBoundingClientRect().width,
    rebuilds:window.__luenRebuilds,
    offset,width:sourceRect.width,clientWidth:rail.clientWidth,clones:sets.length-1,
    seam:sets[1]?sets[1].getBoundingClientRect().left-sourceRect.left:null,
    touchAction:getComputedStyle(rail).touchAction,overflowX:getComputedStyle(rail).overflowX,
    scrollLeft:rail.scrollLeft,frames:window.__luenFrames,scrollY:window.scrollY
  };
},index);

// Shortest signed distance travelled between two wrapped offsets.
const travelled=(a,b,width)=>{let d=(b-a)%width;if(d>width/2)d-=width;if(d<-width/2)d+=width;return d;};

const dispatchPointerDrag=(page,index,dx)=>page.evaluate(async ([i,dx])=>{
  const rail=document.querySelectorAll('#selected-content .portfolio-viewport')[i];
  const r=rail.getBoundingClientRect();
  const x=r.left+r.width*.7,y=r.top+r.height/2;
  const fire=(type,cx)=>rail.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:cx,clientY:y}));
  fire('pointerdown',x);
  for(let s=1;s<=10;s++){fire('pointermove',x+dx*s/10);await new Promise(r=>requestAnimationFrame(r));}
  fire('pointerup',x+dx);
},[index,dx]);

// A gesture that ends without pointerup (pointercancel, or focus lost with
// no pointer event at all) must not leave the rail paused.
const interruptedDrag=(page,index,ending)=>page.evaluate(async ([i,ending])=>{
  const rail=document.querySelectorAll('#selected-content .portfolio-viewport')[i];
  const r=rail.getBoundingClientRect();
  const x=r.left+r.width*.7,y=r.top+r.height/2;
  const fire=(type,cx)=>rail.dispatchEvent(new PointerEvent(type,{pointerId:9,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:cx,clientY:y}));
  fire('pointerdown',x);
  for(let s=1;s<=5;s++){fire('pointermove',x-12*s);await new Promise(r=>requestAnimationFrame(r));}
  if(ending==='blur')window.dispatchEvent(new Event('blur'));else fire('pointercancel',x-60);
},[index,ending]);

const touchDrag=async(cdp,page,index,dx,dy)=>{
  const box=await page.locator('#selected-content .portfolio-viewport').nth(index).boundingBox();
  const x=Math.round(box.x+box.width*.7),y=Math.round(box.y+box.height/2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let s=1;s<=10;s++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.round(x+dx*s/10),y:Math.round(y+dy*s/10)}]});
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
};

for(const run of runs){
  const label=run.engine+'-'+run.width;
  let browser;
  try{browser=await run.type.launch({headless:true});}
  catch(e){failures.push(label+': browser launch failed '+String(e.message).slice(0,160));continue;}
  for(let load=1;load<=loads;load++){
    const context=await browser.newContext({
      viewport:{width:run.width,height:run.height},deviceScaleFactor:run.engine==='webkit'?3:2,
      isMobile:true,hasTouch:true,reducedMotion:'no-preference',
      userAgent:run.engine==='webkit'?iphone:android
    });
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    await context.addInitScript(frameCounter);
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    const record={run:label,load,rails:[]};
    try{
      const response=await page.goto(base+'/',{waitUntil:'load',timeout:60000});
      if(response?.status()!==200)throw Error('HTTP '+response?.status());
      await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});
      await page.waitForTimeout(400);
      const page0=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        ios:document.documentElement.classList.contains('ios-light-loops'),
        rails:document.querySelectorAll('#selected-content .portfolio-viewport').length,
        originals:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone):not(.ios-loop-clone) .portfolio-card').length
      }));
      record.ios=page0.ios;
      if(page0.rails!==2||page0.originals!==12)failures.push(label+': expected 2 rails / 12 original cards '+JSON.stringify(page0));
      if(page0.overflow>3)failures.push(label+': horizontal overflow '+page0.overflow);
      if((run.engine==='webkit')!==page0.ios)failures.push(label+': wrong motion path, ios='+page0.ios);
      const cdp=run.engine==='chromium'?await context.newCDPSession(page):null;

      for(let i=0;i<2;i++){
        const railLocator=page.locator('#selected-content .portfolio-viewport').nth(i);
        await railLocator.scrollIntoViewIfNeeded();
        await page.evaluate(i=>{
          const r=document.querySelectorAll('#selected-content .portfolio-viewport')[i].getBoundingClientRect();
          window.scrollBy(0,r.top-innerHeight*.4);
        },i);
        await page.waitForFunction(i=>{
          const rail=document.querySelectorAll('#selected-content .portfolio-viewport')[i];
          const sets=rail.querySelectorAll('.loop-set');
          const width=sets[0]?.getBoundingClientRect().width||0;
          return width>rail.clientWidth&&sets.length===1+Math.max(1,Math.ceil(rail.clientWidth/width));
        },i,{timeout:9000});
        await page.waitForTimeout(300);

        // 1. Seamless loop: the first copy starts exactly one source width later.
        const start=await railState(page,i);
        if(Math.abs(start.seam-start.width)>1)failures.push(label+' rail '+i+': loop seam '+start.seam+' vs width '+start.width);
        // The set must end right after its last card: any extra width is an
        // empty stretch of rail before the loop repeats.
        if(Math.abs(start.width-start.contentWidth)>2)failures.push(label+' rail '+i+': '+Math.round(start.width-start.contentWidth)+
          'px empty after last card (set '+Math.round(start.width)+'px, cards '+Math.round(start.contentWidth)+'px, card '+start.cardWidth.toFixed(1)+'px)');
        if(start.touchAction!=='pan-y')failures.push(label+' rail '+i+': touch-action '+start.touchAction);

        // 2. Continuous motion over 3 s, sampled every 150 ms.
        const samples=[];
        for(let s=0;s<20;s++){samples.push(await railState(page,i));await page.waitForTimeout(150);}
        const moves=samples.slice(1).map((s,k)=>travelled(samples[k].offset,s.offset,s.width));
        let longestStall=0,run0=0;
        for(const m of moves){run0=Math.abs(m)<.05?run0+1:0;longestStall=Math.max(longestStall,run0);}
        const frames=samples.at(-1).frames-samples[0].frames;
        // Split each 150 ms window without movement by whether the browser
        // delivered animation frames in it: no frames = browser/CI cadence,
        // 3+ frames but no movement = the rail itself held still.
        const stalls=moves.map((m,k)=>({m,f:samples[k+1].frames-samples[k].frames})).filter(w=>Math.abs(w.m)<.05);
        const total=moves.reduce((n,m)=>n+m,0);
        const rail={rail:i,width:Math.round(start.width),contentWidth:Math.round(start.contentWidth),clones:start.clones,pxPerSecond:+(total/2.85).toFixed(1),
          longestStallMs:longestStall*150,framesDuringSample:frames,fps:+(frames/2.85).toFixed(1),
          stallWindowsNoFrames:stalls.filter(w=>w.f===0).length,stallWindowsWithFrames:stalls.filter(w=>w.f>=3).length,backwardSteps:moves.filter(m=>m<-.05).length,
          rebuildsDuringSample:samples.at(-1).rebuilds-samples[0].rebuilds,rebuildsSinceLoad:samples.at(-1).rebuilds};
        if(rail.stallWindowsWithFrames)warnings.push(label+' load '+load+' rail '+i+': held still in '+rail.stallWindowsWithFrames+' window(s) while frames were delivered');
        if(rail.rebuildsDuringSample)warnings.push(label+' load '+load+' rail '+i+': loop rebuilt '+rail.rebuildsDuringSample+'x while idle');
        if(total<10)failures.push(label+' load '+load+' rail '+i+': rail did not move in 3 s '+JSON.stringify(rail));
        else if(longestStall>=4)warnings.push(label+' load '+load+' rail '+i+': paused '+rail.longestStallMs+'ms then recovered '+JSON.stringify(rail));
        if(rail.backwardSteps)failures.push(label+' rail '+i+': moved backwards without input '+JSON.stringify(moves));

        // 3. Horizontal finger drag: follows the finger, pauses, then resumes.
        const before=await railState(page,i);
        if(cdp)await touchDrag(cdp,page,i,-150,0);else await dispatchPointerDrag(page,i,-150);
        const dragged=await railState(page,i);
        const dragDistance=travelled(before.offset,dragged.offset,before.width);
        rail.dragDistance=+dragDistance.toFixed(1);
        if(dragDistance<120||dragDistance>200)failures.push(label+' rail '+i+': drag moved '+dragDistance.toFixed(1)+'px for a 150px swipe');
        if(Math.abs(dragged.scrollY-before.scrollY)>2)failures.push(label+' rail '+i+': horizontal drag scrolled the page');
        await page.waitForTimeout(500);
        const paused=await railState(page,i);
        if(Math.abs(travelled(dragged.offset,paused.offset,before.width))>1.5)failures.push(label+' rail '+i+': rail did not pause after release');
        await page.waitForTimeout(1500);
        const resumed=await railState(page,i);
        rail.resumedPx=+travelled(paused.offset,resumed.offset,before.width).toFixed(1);
        if(rail.resumedPx<5)failures.push(label+' rail '+i+': auto motion did not resume after drag '+rail.resumedPx);

        // 3b. Interrupted gestures resume auto motion (no stuck pause).
        for(const ending of ['pointercancel','blur']){
          await interruptedDrag(page,i,ending);
          await page.waitForTimeout(1700);
          const a=await railState(page,i);
          await page.waitForTimeout(600);
          const b=await railState(page,i);
          const after=travelled(a.offset,b.offset,a.width);
          rail['resumeAfter_'+ending]=+after.toFixed(1);
          if(after<3)failures.push(label+' rail '+i+': rail stayed paused after '+ending+' ('+after.toFixed(1)+'px in 0.6 s)');
        }

        // 4. Vertical swipe over the rail keeps scrolling the page and does not
        //    drag the rail sideways (real touch only; touch-action:pan-y).
        if(cdp){
          const v0=await railState(page,i);
          await touchDrag(cdp,page,i,0,-240);
          await page.waitForTimeout(300);
          const v1=await railState(page,i);
          rail.verticalScroll=Math.round(v1.scrollY-v0.scrollY);
          const sideways=travelled(v0.offset,v1.offset,v0.width);
          if(rail.verticalScroll<120)failures.push(label+' rail '+i+': vertical swipe over rail did not scroll page ('+rail.verticalScroll+'px)');
          if(sideways<-1||sideways>60)failures.push(label+' rail '+i+': vertical swipe moved rail sideways '+sideways.toFixed(1)+'px');
        }
        record.rails.push(rail);
      }

      // 5. Reduced motion: native horizontal scrolling, no drag hijack.
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(700);
      const railIndex=0;
      await page.locator('#selected-content .portfolio-viewport').first().scrollIntoViewIfNeeded();
      const reduced=await railState(page,railIndex);
      if(reduced.overflowX!=='auto')failures.push(label+': reduced motion rail not scrollable '+reduced.overflowX);
      if(reduced.touchAction==='pan-y')failures.push(label+': reduced motion still blocks horizontal pan');
      if(reduced.clones!==0)failures.push(label+': reduced motion left '+reduced.clones+' clones');
      if(!cdp)await dispatchPointerDrag(page,railIndex,-150);
      const reducedAfter=await railState(page,railIndex);
      if(Math.abs(reducedAfter.offset)>.5)failures.push(label+': drag handler transformed a reduced-motion rail');
      await page.emulateMedia({reducedMotion:'no-preference'});

      if(load===1)await page.screenshot({path:path.join(dir,label+'.jpg'),type:'jpeg',quality:68});
      if(errors.length)failures.push(label+': JS errors '+errors.join(';'));
    }catch(e){failures.push(label+' load '+load+': '+String(e.message).slice(0,300));}
    results.push(record);
    await context.close();
  }
  await browser.close();
}

// Desktop mouse: drag must stay disabled so the existing desktop rail is unchanged.
{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
  const page=await context.newPage();
  try{
    await page.goto(base+'/',{waitUntil:'load',timeout:60000});
    const rail=page.locator('#selected-content .portfolio-viewport').first();
    await rail.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const box=await rail.boundingBox();
    const before=await railState(page,0);
    await page.mouse.move(box.x+box.width*.7,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.7-300,box.y+box.height/2,{steps:8});
    await page.mouse.up();
    const after=await railState(page,0);
    const moved=travelled(before.offset,after.offset,before.width);
    if(after.touchAction!=='pan-y')failures.push('desktop-1440: touch-action '+after.touchAction);
    if(moved>60)failures.push('desktop-1440: mouse drag moved the auto rail '+moved.toFixed(1)+'px');
    results.push({run:'desktop-1440-mouse',moved:+moved.toFixed(1)});
  }catch(e){failures.push('desktop-1440: '+String(e.message).slice(0,300));}
  await browser.close();
}

fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,loads,results,warnings,failures},null,2));
console.log('LUEN_SELECTED_RAILS_QA '+JSON.stringify({runs:results.length,warnings:warnings.length,failures:failures.length,results}));
for(const w of warnings)console.warn('LUEN_SELECTED_RAILS_WARN '+w);
for(const f of failures)console.error('LUEN_SELECTED_RAILS_FAIL '+f);
if(failures.length)process.exitCode=1;
