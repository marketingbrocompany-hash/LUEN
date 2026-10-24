// LUEN homepage editorial polish regression QA — offline only, no submissions.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const BASE=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const errors=[],results=[];
const check=(condition,message)=>{if(!condition)errors.push(message);};
const screenshots='qa-screenshots/editorial-polish';
fs.mkdirSync(screenshots,{recursive:true});
for(const [engine,browserType,width,height] of [
  ['chromium',chromium,1440,900],
  ['chromium',chromium,768,960],
  ['chromium',chromium,390,844],
  ['chromium',chromium,320,720],
  ['webkit',webkit,390,844],
  ['webkit',webkit,320,720]
]){
  const browser=await browserType.launch({headless:true});
  try{
    for(const reduce of [false,true]){
      if(reduce&&width>390)continue;
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:reduce?'reduce':'no-preference'});
      const page=await context.newPage();
      const jsErrors=[];
      page.on('pageerror',e=>jsErrors.push(e.message.slice(0,140)));
      try{
        const resp=await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:50000});
        check(resp?.status()===200,engine+' '+width+' homepage HTTP '+resp?.status());
        await page.locator('#selected-content .portfolio-head').first().scrollIntoViewIfNeeded();
        const state=await page.evaluate(()=>{
          const styles=(q)=>{const e=document.querySelector(q);return e?getComputedStyle(e):null};
          const rect=(e)=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
          const rails=[...document.querySelectorAll('#selected-content .portfolio-viewport')];
          const links=[...document.querySelectorAll('#selected-content .portfolio-explore-link')];
          const partner=document.querySelector('#partner-creators .luen-creator-feature--editorial');
          const actions=[...document.querySelectorAll('#partner-creators .luen-creator-feature-actions a')];
          const card=document.querySelector('#selected-content .portfolio-card');
          const set=document.querySelector('#selected-content .portfolio-set');
          const country=document.querySelector('#selected-content .portfolio-country');
          const note=document.querySelector('#partner-creators .luen-creator-feature-copy>p');
          return {
            width:document.documentElement.clientWidth,
            overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
            links:links.map(l=>({href:l.getAttribute('href'),visible:!!l.getBoundingClientRect().height,rect:rect(l)})),
            rails:rails.map(e=>({rect:rect(e),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflowX:getComputedStyle(e).overflowX})),
            partner:partner&&rect(partner),
            actions:actions.map(rect),
            radius:parseFloat(styles('#selected-content .portfolio-card')?.borderTopLeftRadius||'0'),
            gap:parseFloat(styles('#selected-content .portfolio-set')?.gap||'0'),
            countryFont:parseFloat(styles('#selected-content .portfolio-country')?.fontSize||'0'),
            partnerCopyFont:parseFloat(note?getComputedStyle(note).fontSize:'0'),
            normalCards:document.querySelectorAll('#selected-content .portfolio-set:not(.loop-clone) .portfolio-card').length
          };
        });
        check(state.links.length===2&&state.links[0].href==='/services/youtube-creator-marketing/'&&
          state.links[1].href==='/services/instagram-influencer-marketing/',
          engine+' '+width+' wrong service discovery links');
        for(const l of state.links)check(l.visible&&l.rect.left>=-2&&l.rect.right<=width+2,
          engine+' '+width+' clipped explore CTA '+JSON.stringify(l));
        check(state.normalCards===12,engine+' '+width+' expected 12 originals');
        check(state.rails.length===2,engine+' '+width+' expected 2 rails');
        check(state.overflow<=3,engine+' '+width+' page horizontal overflow '+state.overflow);
        check(state.radius>=13,engine+' '+width+' rounded card regression '+state.radius);
        check(state.countryFont>=9,engine+' '+width+' tiny category tag '+state.countryFont);
        check(state.partner&&state.partner.left>=-2&&state.partner.right<=width+2,
          engine+' '+width+' partner card outside viewport '+JSON.stringify(state.partner));
        if(width<=700){
          check(state.partnerCopyFont>=12.5,engine+' '+width+' tiny partner copy '+state.partnerCopyFont);
          for(const item of state.actions)check(item.height>=43&&item.right<=width+2,
            engine+' '+width+' inaccessible partner action '+JSON.stringify(item));
        }
        if(reduce){
          const scroll=await page.locator('#selected-content .portfolio-viewport').first().evaluate(async el=>{
            el.scrollLeft=110;
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            return {left:el.scrollLeft,available:el.scrollWidth-el.clientWidth,overflowX:getComputedStyle(el).overflowX};
          });
          check(scroll.available>100 && scroll.left>40 && scroll.overflowX==='auto',
            engine+' '+width+' reduced motion gallery not manually scrollable '+JSON.stringify(scroll));
        }
        check(jsErrors.length===0,engine+' '+width+' JS errors '+JSON.stringify(jsErrors));
        results.push({engine,width,reduce,radius:state.radius,overflow:state.overflow,gap:state.gap,partnerActions:state.actions.map(a=>Math.round(a.height)),links:state.links.length});
        if(!reduce&&width===390){
          await page.locator('#partner-creators .luen-creator-feature--editorial').scrollIntoViewIfNeeded();
          await page.screenshot({path:screenshots+'/'+engine+'-mobile-partner.jpg',type:'jpeg',quality:68,animations:'disabled'});
          await page.locator('#selected-content').scrollIntoViewIfNeeded();
          await page.screenshot({path:screenshots+'/'+engine+'-mobile-rails.jpg',type:'jpeg',quality:68,animations:'disabled'});
        }
      }catch(e){errors.push(engine+' '+width+' '+(reduce?'reduce':'normal')+' exception: '+e.message.slice(0,380));}
      await context.close();
    }
  }finally{await browser.close();}
}
console.log('LUEN_EDITORIAL_POLISH_QA '+JSON.stringify({runs:results.length,results,errors}));
if(errors.length)process.exitCode=1;
