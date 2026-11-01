// Integration-only QA for Claude P1/P2/P3. No form submits, no deployment.
// Check touch hit-areas for neighboring links, not just their heights, and
// verify unified orange CTA, FAQ float guard, timeline and Reels labels.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const results=[],errors=[];
const widths=[320,390,767,768,1440];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of widths){
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,
   hasTouch:width<=767,isMobile:width<=767,reducedMotion:'reduce'});
 const page=await context.newPage();const failures=[],jsErrors=[];
 page.on('pageerror',e=>jsErrors.push(e.message.slice(0,140)));
 await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
 try{
  const r=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
  if(!r||r.status()!==200)throw Error('HTTP '+r?.status());
  const baseState=await page.evaluate(()=>{
    const rect=(selector)=>{
     const e=document.querySelector(selector);
     if(!e)return null;
     const b=e.getBoundingClientRect(),css=getComputedStyle(e);
     return {width:b.width,height:b.height,color:css.backgroundColor};
    };
    const rows=[...document.querySelectorAll('#content-flow ol > li')].map(e=>{
      const a=e.getBoundingClientRect(),s=e.querySelector('strong')?.getBoundingClientRect();
      return s?Math.round(s.left-a.left):null;
    });
    return {scrollOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      timeline:rows,services:document.querySelectorAll('#services .luen-service-choice').length,
      cases:document.querySelectorAll('#cases .luen-case-entry').length,
      unifiedCta:document.querySelectorAll('#services .luen-service-unified-cta').length,
      colors:[
       rect('.hero-cta .btn-primary')?.color,
       rect('#services .luen-service-unified-cta')?.color,
       rect('#faq .faq-cta')?.color
      ],
      reels:[...document.querySelectorAll(
       '#selected-content .loop-set:not(.loop-clone):not(.ios-loop-clone) .portfolio-card.portrait'
      )].map(card=>{
       const s=card.querySelector('.portfolio-meta span'),b=card.querySelector('.portfolio-meta b');
       if(!s||!b)return null;
       const x=s.getBoundingClientRect(),y=b.getBoundingClientRect();
       const cs=getComputedStyle(s),cb=getComputedStyle(b);
       return {stacked:y.top>=x.bottom-1,
         single:x.height<parseFloat(cs.lineHeight)*1.5&&y.height<parseFloat(cb.lineHeight)*1.5};
      })
    };
  });
  if(baseState.scrollOverflow>2)failures.push('horizontal overflow '+baseState.scrollOverflow);
  if(baseState.services!==3||baseState.cases!==4||baseState.unifiedCta!==1)
    failures.push('approved site content structure changed');
  if(baseState.timeline.length!==4||new Set(baseState.timeline).size!==1)
    failures.push('timeline left alignment differs: '+baseState.timeline);
  if(baseState.colors.some(c=>c!=='rgb(185, 85, 42)'))
    failures.push('primary CTA orange mismatch: '+baseState.colors.join(','));
  if(width<=767&&(baseState.reels.length!==6||baseState.reels.some(c=>!c||!c.stacked||!c.single)))
    failures.push('mobile Reels labels incorrectly wrapped or not stacked');

  // User hit-area QA — check width and height, and ensure neighboring footer
  // links do not overlap on the screen. Negative margins must not swallow taps.
  const hit=await page.evaluate((mobile)=>{
    const list=[...document.querySelectorAll('footer .footer-links a, footer .footer-business-info a')]
      .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;});
    const boxes=list.map(e=>{
      const r=e.getBoundingClientRect();
      return {title:e.textContent.trim().slice(0,30),x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
    });
    const collisions=[];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      const x=Math.min(a.right,b.right)-Math.max(a.x,b.x),y=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
      if(x>5&&y>5)collisions.push([a.title,b.title,Math.round(x),Math.round(y)]);
    }
    return {short:mobile?boxes.filter(b=>b.height<43).map(x=>({name:x.title,height:x.height})):[],
      collisions,boxes:boxes.length};
  },width<=767);
  if(hit.short.length)failures.push('footer small touch heights: '+JSON.stringify(hit.short));
  if(hit.collisions.length)failures.push('neighboring footer links overlap: '+JSON.stringify(hit.collisions));

  await page.locator('#faq .faq-cta').scrollIntoViewIfNeeded();
  await page.waitForTimeout(170);
  const overlap=await page.evaluate(()=>{
    const a=document.querySelector('.float-cta'),b=document.querySelector('#faq .faq-cta');
    const c=a.getBoundingClientRect(),d=b.getBoundingClientRect();
    return {floatingShown:a.classList.contains('show'),
      intersect:Math.min(c.right,d.right)>Math.max(c.left,d.left)
        &&Math.min(c.bottom,d.bottom)>Math.max(c.top,d.top)};
  });
  if(overlap.floatingShown&&overlap.intersect)failures.push('floating CTA overlaps FAQ CTA');

  if(jsErrors.length)failures.push(...jsErrors.map(e=>'JS: '+e));
  results.push({engine:engine.name(),width,footerLinks:hit.boxes,
    footerCollisionCount:hit.collisions.length,faqFloatOverlap:overlap.floatingShown&&overlap.intersect,
    colors:baseState.colors,timeline:baseState.timeline,reels:baseState.reels.length,failures});
 }catch(e){failures.push('unexpected: '+String(e.message).slice(0,250));}
 finally{errors.push(...failures.map(e=>engine.name()+'/'+width+': '+e));await context.close();}
 }
 }finally{await browser.close();}
}
fs.mkdirSync('qa-screenshots/claude-mobile-ux-integrated',{recursive:true});
fs.writeFileSync('qa-screenshots/claude-mobile-ux-integrated/summary.json',JSON.stringify({results,errors},null,2));
console.log('LUEN_CLAUDE_MOBILE_UX_INTEGRATED '+JSON.stringify({checks:results.length,errors,results}));
if(errors.length)process.exitCode=1;
