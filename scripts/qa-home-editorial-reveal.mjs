// LUEN homepage editorial reveal QA: THE LUEN APPROACH (#why-luen) and
// PARTNER CREATORS (#partner-creators). Checks that below-the-fold content
// starts hidden and finishes fully visible once scrolled to, that nothing
// stays hidden after a full scroll, and that reduced motion / no JS show
// everything at once. Local static server only: never deploys, submits
// forms or sends GA4 hits.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','editorial-reveal');
fs.mkdirSync(dir,{recursive:true});
const failures=[],results=[];
const targets='#why-luen .luen-partnership-head,#why-luen .luen-why-row>*,#why-luen .luen-approach-link,'+
  '#partner-creators .luen-partnership-head,#partner-creators .luen-creator-feature-copy>*';

const state=page=>page.evaluate(sel=>{
  const els=[...document.querySelectorAll(sel)];
  const media=document.querySelector('#partner-creators .luen-creator-feature-media');
  const rows=[...document.querySelectorAll('#why-luen .luen-why-row')];
  return {
    enhanced:document.documentElement.classList.contains('luen-editorial-motion'),
    count:els.length,
    hidden:els.filter(e=>Number(getComputedStyle(e).opacity)<.99).map(e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,24)),
    clip:media?getComputedStyle(media).clipPath:null,
    rules:rows.map(r=>getComputedStyle(r,'::before').transform),
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
  };
},targets);

const scrollThrough=async page=>{
  const h=await page.evaluate(()=>document.documentElement.scrollHeight);
  for(let y=0;y<=h;y+=300){await page.evaluate(v=>window.scrollTo(0,v),y);await page.waitForTimeout(40);}
  await page.waitForTimeout(1700);
};

const browser=await chromium.launch({headless:true});
try{
  const viewports=[
    {name:'mobile-320',width:320,height:700,isMobile:true,hasTouch:true},
    {name:'mobile-390',width:390,height:844,isMobile:true,hasTouch:true},
    {name:'tablet-768',width:768,height:1024},
    {name:'desktop-1440',width:1440,height:900}
  ];
  for(const v of viewports){
    for(const mode of ['motion','reduce','nojs']){
      const context=await browser.newContext({viewport:{width:v.width,height:v.height},isMobile:!!v.isMobile,
        hasTouch:!!v.hasTouch,reducedMotion:mode==='reduce'?'reduce':'no-preference',javaScriptEnabled:mode!=='nojs'});
      await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
      const tag=v.name+'/'+mode;
      try{
        const res=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
        if(res?.status()!==200)throw Error('HTTP '+res?.status());
        await page.waitForTimeout(400);
        const before=await state(page);
        if(!before.count)throw Error('editorial targets not found');
        if(mode==='motion'){
          if(!before.enhanced)failures.push(tag+': html.luen-editorial-motion missing');
          if(!before.hidden.length)failures.push(tag+': below-fold content was not hidden before scrolling (no reveal)');
          if(before.clip!=='inset(100% 0px 0px)'&&!/^inset\(100%/.test(before.clip||''))failures.push(tag+': portrait not clipped before reveal: '+before.clip);
        }else{
          if(before.enhanced)failures.push(tag+': motion class present under '+mode);
          if(before.hidden.length)failures.push(tag+': hidden without motion '+JSON.stringify(before.hidden));
        }
        await scrollThrough(page);
        const after=await state(page);
        if(after.hidden.length)failures.push(tag+': still hidden after full scroll '+JSON.stringify(after.hidden));
        if(after.clip&&after.clip!=='none'&&!/^inset\(0(px)?\)$/.test(after.clip))failures.push(tag+': portrait still clipped '+after.clip);
        if(after.rules.some(t=>t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)'))failures.push(tag+': row rule not fully drawn '+JSON.stringify(after.rules));
        if(after.overflow>3)failures.push(tag+': horizontal overflow '+after.overflow);
        if(errors.length)failures.push(tag+': JS errors '+errors.join(';'));
        if(mode==='motion'){
          await page.locator('#why-luen').scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          await page.locator('#why-luen').screenshot({path:path.join(dir,v.name+'-why-luen.jpg'),type:'jpeg',quality:60});
          await page.locator('#partner-creators').screenshot({path:path.join(dir,v.name+'-partner-creators.jpg'),type:'jpeg',quality:60});
        }
        results.push({tag,count:before.count,hiddenBefore:before.hidden.length,hiddenAfter:after.hidden.length,clipBefore:before.clip,clipAfter:after.clip});
      }catch(e){failures.push(tag+': '+String(e.message).slice(0,280));}
      await context.close();
    }
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,results,failures},null,2));
console.log('LUEN_EDITORIAL_REVEAL_QA '+JSON.stringify({runs:results.length,failures:failures.length,results}));
for(const f of failures)console.error('LUEN_EDITORIAL_REVEAL_FAIL '+f);
if(failures.length)process.exitCode=1;
