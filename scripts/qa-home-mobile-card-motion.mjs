// LUEN homepage mobile card-by-card reveal QA — local static server only.
// Never deploys, submits the contact form, or sends GA4 measurements.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','mobile-card-motion');
fs.mkdirSync(dir,{recursive:true});
const failures=[],results=[];
const fail=message=>failures.push(message);
const cardSelector=[
  '.luen-service-choice-grid.sr > .luen-service-choice',
  '.case-support-grid-v7.sr > .case-support-card-v7',
  '.luen-flow-list-v2.sr > li'
].join(',');
const runs=[
  {name:'mobile-390',width:390,height:844,reduce:false,mobile:true},
  {name:'mobile-320',width:320,height:650,reduce:false,mobile:true},
  {name:'mobile-390-reduced',width:390,height:844,reduce:true,mobile:true},
  {name:'tablet-768',width:768,height:1024,reduce:false,mobile:false},
  {name:'desktop-1440',width:1440,height:900,reduce:false,mobile:false}
];
const browser=await chromium.launch({headless:true});
try{
  for(const run of runs){
    const context=await browser.newContext({
      viewport:{width:run.width,height:run.height},deviceScaleFactor:1,
      isMobile:run.mobile,hasTouch:run.mobile,reducedMotion:run.reduce?'reduce':'no-preference'
    });
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
    try{
      const response=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
      if(response?.status()!==200)throw Error('HTTP '+response?.status());
      await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});
      await page.waitForTimeout(300);
      const initial=await page.evaluate(selector=>({
        html:document.documentElement.className,
        total:document.querySelectorAll(selector).length,
        revealed:document.querySelectorAll(':is('+selector+').luen-motion-card-in').length,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      }),cardSelector);
      if(initial.total!==10)fail(run.name+': expected 10 service/case/flow cards, got '+initial.total);
      if(initial.overflow>3)fail(run.name+': horizontal overflow '+initial.overflow);
      const mobileMode=initial.html.includes('luen-motion-mobile');
      if(run.mobile&&!run.reduce&&!mobileMode)fail(run.name+': mobile card motion not enabled');
      if((!run.mobile||run.reduce)&&mobileMode)fail(run.name+': mobile card motion enabled outside its scope');

      // Each card must be hidden while below the fold, then reveal on its own.
      const cards=page.locator(cardSelector);
      const trace=[];
      for(let i=0;i<initial.total;i++){
        const card=cards.nth(i);
        const before=await card.evaluate(el=>{
          const r=el.getBoundingClientRect();
          return {below:r.top>innerHeight,opacity:Number(getComputedStyle(el).opacity),
            revealed:el.classList.contains('luen-motion-card-in')};
        });
        await card.evaluate(el=>window.scrollTo(0,window.scrollY+el.getBoundingClientRect().top-innerHeight*.55));
        await page.waitForTimeout(1300);
        const after=await card.evaluate(el=>{
          const cs=getComputedStyle(el);
          let blocker=null;
          for(let node=el;node&&node!==document.body;node=node.parentElement){
            if(Number(getComputedStyle(node).opacity)<.98){blocker=String(node.className).slice(0,60);break;}
          }
          const img=el.querySelector('figure img');
          return {opacity:Number(cs.opacity),translate:cs.translate,blocker,
            imageScale:img?getComputedStyle(img).scale:null,
            radius:el.querySelector('figure')?parseFloat(getComputedStyle(el.querySelector('figure')).borderTopLeftRadius):null};
        });
        trace.push({i,before,after});
        if(after.blocker)fail(run.name+': card '+i+' still faded by '+after.blocker+' '+JSON.stringify(after));
        if(after.translate!=='none'&&after.translate!=='0px'&&after.translate!=='0px 0px')
          fail(run.name+': card '+i+' did not settle '+after.translate);
        if(after.imageScale&&after.imageScale!=='none'&&Math.abs(parseFloat(after.imageScale)-1)>.003)
          fail(run.name+': case image did not settle '+after.imageScale);
        if(after.radius!==null&&after.radius<12)fail(run.name+': case image lost rounded frame '+after.radius);
        if(mobileMode&&before.below&&(before.revealed||before.opacity>.05))
          fail(run.name+': card '+i+' was already visible below the fold '+JSON.stringify(before));
        if(!mobileMode&&run.mobile&&before.opacity<.98)
          fail(run.name+': reduced-motion card hidden before scroll '+JSON.stringify(before));
      }
      if(mobileMode){
        // Grid wrappers must never hide a whole stack of cards at once.
        const wrappers=await page.evaluate(()=>[...document.querySelectorAll(
          '.luen-service-choice-grid.sr,.case-support-grid-v7.sr,.luen-flow-list-v2.sr')]
          .map(el=>({cls:String(el.className).slice(0,40),opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform})));
        for(const w of wrappers)if(w.opacity!=='1'||w.transform!=='none')fail(run.name+': grid wrapper still animated '+JSON.stringify(w));
        await page.locator('#services .luen-service-choice').nth(1).scrollIntoViewIfNeeded();
        await page.waitForTimeout(900);
        await page.screenshot({path:path.join(dir,run.name+'-services.jpg'),type:'jpeg',quality:70});
      }
      // Anchor jump past the cards, then back to the top: nothing remains hidden.
      await page.evaluate(()=>document.getElementById('contact').scrollIntoView());
      await page.waitForTimeout(250);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.waitForTimeout(250);
      for(const id of ['cases','services','content-flow']){
        await page.evaluate(id=>document.getElementById(id).scrollIntoView(),id);
        await page.waitForTimeout(900);
      }
      const hidden=await page.evaluate(selector=>[...document.querySelectorAll(selector)]
        .filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&Number(getComputedStyle(el).opacity)<.98;}).length,cardSelector);
      if(hidden)fail(run.name+': '+hidden+' on-screen cards hidden after anchor jumps');
      // Printing must include every card.
      await page.emulateMedia({media:'print'});
      await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
      await page.waitForTimeout(950);
      const printHidden=await page.evaluate(selector=>[...document.querySelectorAll(selector)]
        .filter(el=>Number(getComputedStyle(el).opacity)<.98).length,cardSelector);
      if(printHidden)fail(run.name+': '+printHidden+' cards hidden for print');
      if(errors.length)fail(run.name+': JS errors '+errors.join(';'));
      results.push({run:run.name,mobileMode,cards:initial.total,initiallyRevealed:initial.revealed,
        hiddenBelowFold:trace.filter(t=>t.before.below&&t.before.opacity<=.05).length});
    }catch(e){fail(run.name+': '+String(e.message).slice(0,300));}
    await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,results,failures},null,2));
console.log('LUEN_MOBILE_CARD_MOTION_QA '+JSON.stringify({runs:results.length,failures:failures.length,results}));
for(const f of failures)console.error('LUEN_MOBILE_CARD_MOTION_FAIL '+f);
if(failures.length)process.exitCode=1;
