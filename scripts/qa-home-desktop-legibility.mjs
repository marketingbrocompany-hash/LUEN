// LUEN homepage desktop/tablet legibility QA (≥768px): visible text must meet
// WCAG contrast (4.5:1, or 3:1 for large text) and no text may be under
// 10px. Text drawn on photos and text clipped away (collapsed FAQ answers,
// closed privacy details) is skipped. Local static server only: never
// deploys, submits forms or sends GA4 hits.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','desktop-legibility');
fs.mkdirSync(dir,{recursive:true});
const onImage='.portfolio-card,.luen-motion-card,.luen-creator-feature-media';
const failures=[],results=[];
const browser=await chromium.launch({headless:true});
try{
  for(const width of [768,1024,1440,1920]){
    const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    try{
      const res=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
      if(res?.status()!==200)throw Error('HTTP '+res?.status());
      await page.evaluate(()=>document.querySelectorAll('.sr').forEach(e=>e.classList.add('in')));
      const audit=await page.evaluate(onImage=>{
        const shown=e=>{
          const s=getComputedStyle(e),b=e.getBoundingClientRect();
          if(s.display==='none'||s.visibility==='hidden'||b.width===0||b.height===0)return false;
          if(e.closest('[aria-hidden="true"],.loop-clone,.ios-loop-clone,.mobile-menu,.float-cta'))return false;
          if(e.closest('details:not([open])')&&!e.closest('summary'))return false;
          // Clipped away by an overflow:hidden ancestor (collapsed accordion).
          for(let n=e.parentElement;n&&n!==document.body;n=n.parentElement){
            const ns=getComputedStyle(n);
            if(ns.overflow==='visible'&&ns.overflowY==='visible')continue;
            const r=n.getBoundingClientRect();
            if(Math.min(b.bottom,r.bottom)-Math.max(b.top,r.top)<1)return false;
          }
          return true;
        };
        const lum=c=>{const [r,g,b,a=1]=c.match(/[\d.]+/g).map(Number);
          const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};
          return {L:.2126*f(r)+.7152*f(g)+.0722*f(b),a};};
        const background=e=>{for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);
          const l=lum(s.backgroundColor);if(l.a>.9)return l.L;
          if(s.backgroundImage!=='none'&&n!==document.documentElement)return null;}
          return lum('rgb(245,243,238)').L;};
        const label=e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,30);
        const tiny=[],faint=[];const seen=new Set();
        const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){
          const e=walker.currentNode.parentElement;
          if(!walker.currentNode.textContent.trim()||seen.has(e)||e.closest(onImage)||!shown(e))continue;
          seen.add(e);
          const s=getComputedStyle(e),size=parseFloat(s.fontSize);
          if(size<10)tiny.push({size,text:label(e)});
          const fg=lum(s.color),bg=background(e);
          if(bg==null||fg.a<.5||!/[\p{L}\p{N}]/u.test(walker.currentNode.textContent))continue;
          const ratio=(Math.max(fg.L,bg)+.05)/(Math.min(fg.L,bg)+.05);
          const large=size>=24||(size>=18.66&&Number(s.fontWeight)>=700);
          if(ratio<(large?3:4.5))faint.push({ratio:+ratio.toFixed(2),size,text:label(e)});
        }
        return {tiny,faint,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,height:document.documentElement.scrollHeight};
      },onImage);
      if(audit.tiny.length)failures.push(width+': text under 10px '+JSON.stringify(audit.tiny));
      if(audit.faint.length)failures.push(width+': text under contrast minimum '+JSON.stringify(audit.faint));
      if(audit.overflow>3)failures.push(width+': horizontal overflow '+audit.overflow);
      if(errors.length)failures.push(width+': JS errors '+errors.join(';'));
      if(width===1440)await page.screenshot({path:path.join(dir,'home-1440.jpg'),type:'jpeg',quality:55,fullPage:true});
      results.push({width,tiny:audit.tiny.length,faint:audit.faint.length,height:audit.height});
    }catch(e){failures.push(width+': '+String(e.message).slice(0,280));}
    await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,results,failures},null,2));
console.log('LUEN_DESKTOP_LEGIBILITY_QA '+JSON.stringify({runs:results.length,failures:failures.length,results}));
for(const f of failures)console.error('LUEN_DESKTOP_LEGIBILITY_FAIL '+f);
if(failures.length)process.exitCode=1;
