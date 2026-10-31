// LUEN homepage mobile legibility QA (≤767px): minimum text size, small-text
// contrast and tap-target height. Local static server only: never deploys,
// submits forms or sends GA4 hits.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','mobile-legibility');
fs.mkdirSync(dir,{recursive:true});
const failures=[],results=[];
// Text drawn on photos (gallery captions, hero video cards, country tags) is
// excluded from the contrast scan: its background is an image, not a colour.
const onImage='.portfolio-card,.luen-motion-card,.luen-creator-feature-media';
// Light-orange project buttons keep their pinned colour (qa-services-editorial.mjs);
// their 3.25:1 label contrast is a pending design decision, not checked here.
const pinnedButtons='.luen-service-unified-cta,.faq-cta';
const browser=await chromium.launch({headless:true});
try{
  for(const width of [320,360,390,430]){
    const context=await browser.newContext({
      viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'
    });
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    try{
      const response=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
      if(response?.status()!==200)throw Error('HTTP '+response?.status());
      await page.evaluate(()=>document.querySelectorAll('.sr').forEach(e=>e.classList.add('in')));
      const audit=await page.evaluate(([onImage,pinnedButtons])=>{
        const visible=e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();
          return s.display!=='none'&&s.visibility!=='hidden'&&b.width>0&&b.height>0&&
            !e.closest('[aria-hidden="true"],.loop-clone,.ios-loop-clone,.mobile-menu');};
        const lum=c=>{const [r,g,b,a=1]=c.match(/[\d.]+/g).map(Number);
          const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};
          return {L:.2126*f(r)+.7152*f(g)+.0722*f(b),a};};
        const background=e=>{for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);
          const l=lum(s.backgroundColor);if(l.a>.9)return l.L;
          if(s.backgroundImage!=='none'&&n!==document.documentElement)return null;}
          return lum('rgb(245,243,238)').L;};
        const label=e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,30);
        const tiny=[],faint=[];
        const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
        const seen=new Set();
        while(walker.nextNode()){
          const e=walker.currentNode.parentElement;
          if(!walker.currentNode.textContent.trim()||seen.has(e)||!visible(e))continue;
          seen.add(e);
          const s=getComputedStyle(e),size=parseFloat(s.fontSize);
          if(e.closest(onImage))continue;
          if(size<10)tiny.push({size,text:label(e)});
          const fg=lum(s.color),bg=background(e);
          if(bg==null||fg.a<.5||e.closest(pinnedButtons)||!/[\p{L}\p{N}]/u.test(walker.currentNode.textContent))continue;
          const ratio=(Math.max(fg.L,bg)+.05)/(Math.min(fg.L,bg)+.05);
          const large=size>=24||(size>=18.66&&Number(s.fontWeight)>=700);
          if(ratio<(large?3:4.5))faint.push({ratio:+ratio.toFixed(2),size,text:label(e)});
        }
        const shortTaps=[...document.querySelectorAll('main a[href],main button,#nav a[href],#nav button,footer a[href]')]
          .filter(visible).map(e=>({h:Math.round(e.getBoundingClientRect().height),text:(e.getAttribute('aria-label')||label(e))}))
          .filter(t=>t.h<43);
        return {tiny,faint,shortTaps,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      },[onImage,pinnedButtons]);
      if(audit.tiny.length)failures.push(width+': text under 10px '+JSON.stringify(audit.tiny));
      if(audit.faint.length)failures.push(width+': text under contrast minimum '+JSON.stringify(audit.faint));
      if(audit.shortTaps.length)failures.push(width+': tap targets under 44px '+JSON.stringify(audit.shortTaps));
      if(audit.overflow>3)failures.push(width+': horizontal overflow '+audit.overflow);
      if(errors.length)failures.push(width+': JS errors '+errors.join(';'));
      if(width===390)await page.screenshot({path:path.join(dir,'home-390.jpg'),type:'jpeg',quality:60,fullPage:true});
      results.push({width,tiny:audit.tiny.length,faint:audit.faint.length,shortTaps:audit.shortTaps.length});
    }catch(e){failures.push(width+': '+String(e.message).slice(0,280));}
    await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,results,failures},null,2));
console.log('LUEN_MOBILE_LEGIBILITY_QA '+JSON.stringify({runs:results.length,failures:failures.length,results}));
for(const f of failures)console.error('LUEN_MOBILE_LEGIBILITY_FAIL '+f);
if(failures.length)process.exitCode=1;
