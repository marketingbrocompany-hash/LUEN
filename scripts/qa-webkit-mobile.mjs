// Local WebKit browser check of the iPhone-specific LUEN home experience.
// Never deploys, submits contact forms, or sends GA4 measurements.
import {webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const widths=[390,320];
const failures=[],results=[];
const out='qa-screenshots/webkit-mobile';
fs.mkdirSync(out,{recursive:true});
const browser=await webkit.launch({headless:true});
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const expected=['hero','brand-wall','cases','why-luen','services','selected-content','partner-creators','content-flow','faq','contact'];
try{
  for(const width of widths){
    const context=await browser.newContext({
      viewport:{width,height:844},deviceScaleFactor:2,
      userAgent:ua,isMobile:true,hasTouch:true,reducedMotion:'no-preference'
    });
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const page=await context.newPage();
    const errors=[],warnings=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      const response=await page.goto(base+'/',{waitUntil:'load',timeout:60000});
      if(response?.status()!==200)throw Error('Homepage HTTP '+response?.status());
      await page.waitForTimeout(500);
      const initial=await page.evaluate(()=>({
        journey:[...document.querySelectorAll('main#top > section')].map(s=>s.id||[...s.classList][0]),
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        ios:document.documentElement.classList.contains('ios-light-loops'),
        sections:document.querySelectorAll('main#top > section').length,
        cards:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone) .portfolio-card').length
      }));
      if(JSON.stringify(initial.journey)!==JSON.stringify(expected))throw Error('Section order '+JSON.stringify(initial.journey));
      if(initial.overflow>3)throw Error('Page horizontal overflow '+initial.overflow);
      if(!initial.ios)throw Error('iOS lightweight loop did not initialize');
      if(initial.cards!==12)throw Error('Expected 12 original portfolio cards, got '+initial.cards);
      const poster=page.locator('[data-motion-index="2"] img');
      await poster.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{
        const img=document.querySelector('[data-motion-index="2"] img');
        return img?.complete&&img.naturalWidth===406&&img.naturalHeight===720;
      },null,{timeout:18000});
      const rails=page.locator('#selected-content .portfolio-viewport');
      if(await rails.count()!==2)throw Error('Missing YouTube or Reels rail');
      for(let i=0;i<2;i++){
        const rail=rails.nth(i);
        await rail.scrollIntoViewIfNeeded();
        // WebKit may initially report only a 72px offscreen placeholder.
        // Repeated geometry reads allow the deferred source layout to settle;
        // the controller must then rebuild to the correct clone count.
        await page.waitForFunction(index=>{
          const rail=document.querySelectorAll('#selected-content .portfolio-viewport')[index];
          const source=rail?.querySelector('.loop-set:not(.ios-loop-clone)');
          const width=source?.getBoundingClientRect().width||0;
          const expected=Math.max(1,Math.ceil((rail?.clientWidth||0)/width));
          return width>(rail?.clientWidth||0) &&
            rail.querySelectorAll('.ios-loop-clone').length===expected;
        },i,{timeout:7000});
        await page.waitForTimeout(450);
        const t1=await rail.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
        await page.waitForTimeout(650);
        const t2=await rail.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
        const count=await rail.locator('.ios-loop-clone').count();
        if(t1===t2||count!==1)throw Error('iOS rail '+i+' motion/clones incorrect: '+JSON.stringify({t1,t2,count}));
      }
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(500);
      if(await page.locator('.ios-loop-clone').count()!==0)throw Error('Reduced-motion left iOS clones');
      const selected=page.locator('#selected-content');
      await selected.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,'selected-content-'+width+'.jpg'),type:'jpeg',quality:70});
      const partner=page.locator('#partner-creators');
      await partner.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,'partner-creators-'+width+'.jpg'),type:'jpeg',quality:70});
      const partnerBox=await partner.boundingBox();
      if(!partnerBox || partnerBox.width>width+3)throw Error('Partner block overflows');
      if(errors.length)throw Error('JS errors: '+errors.slice(0,4).join('; '));
      results.push({width,initial,iosRailChecks:2,poster:'406x720 first frame',reducedMotion:true,errors:0,warnings});
    }catch(e){
      let diagnostic=null;
      try{
        diagnostic=await page.evaluate(()=>({
          innerWidth:innerWidth,clientWidth:document.documentElement.clientWidth,
          metaViewport:document.querySelector('meta[name="viewport"]')?.content,
          rails:[...document.querySelectorAll('#selected-content .portfolio-viewport')].map(el=>{
            const source=el.querySelector('.loop-set:not(.ios-loop-clone)');
            const track=el.querySelector('.loop-track');
            const card=source?.querySelector('.portfolio-card');
            const css=card?getComputedStyle(card):null;
            const setCss=source?getComputedStyle(source):null;
            return {
              clientWidth:el.clientWidth,sourceRectWidth:source?.getBoundingClientRect().width,
              trackRectWidth:track?.getBoundingClientRect().width,
              sourceScrollWidth:source?.scrollWidth,
              sourceDisplay:setCss?.display,sourceFlex:setCss?.flex,
              sourceGap:setCss?.gap,sourcePadding:setCss?.paddingRight,
              cardCount:source?.querySelectorAll('.portfolio-card').length,
              cardRectWidth:card?.getBoundingClientRect().width,
              cardFlexBasis:css?.flexBasis,cardDisplay:css?.display,
              clones:el.querySelectorAll('.ios-loop-clone').length,
              debugInit:el.dataset.iosDebugInit,
              debugVisible:el.dataset.iosDebugVisible,
              transform:track?getComputedStyle(track).transform:null
            };
          })
        }));
        await page.screenshot({path:path.join(out,'failure-'+width+'.jpg'),type:'jpeg',quality:65});
      }catch(_err){}
      failures.push({width,error:String(e.message).slice(0,360),diagnostic});
    }
    finally{await context.close();}
  }
}finally{await browser.close();}
console.log('LUEN_WEBKIT_MOBILE_QA '+JSON.stringify({results,failures}));
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({results,failures},null,2));
if(failures.length)process.exitCode=1;
