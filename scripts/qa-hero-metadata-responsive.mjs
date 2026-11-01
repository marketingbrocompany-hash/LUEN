// Preview-only browser regression for the single-line LUEN hero campaign footer.
// Tests actual rendered geometry in Chromium and WebKit; never sends a form or deploys.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=path.resolve('qa-screenshots/hero-three-videos');
fs.mkdirSync(output,{recursive:true});
const cases=[
  {number:'01 / 03',category:'F&B',brand:'CONFIER'},
  {number:'02 / 03',category:'BEAUTY',brand:'QUADTHERA'},
  {number:'03 / 03',category:'CLINIC',brand:'KOREA CLINIC'}
];
const widths=[320,360,390,420,430,768,1440];
const failures=[],results=[];
const rect=e=>{
  const r=e.getBoundingClientRect();
  return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
};
for(const engine of [{name:'chromium',type:chromium},{name:'webkit',type:webkit}]){
  const browser=await engine.type.launch({headless:true});
  try{
    for(const width of widths){
      const context=await browser.newContext({
        viewport:{width,height:width<=430?844:900},
        deviceScaleFactor:width<=430?2:1,isMobile:width<=430,
        hasTouch:width<=430,reducedMotion:'reduce'
      });
      await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
      try{
        const response=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
        if(response?.status()!==200)throw Error('Unexpected HTTP '+response?.status());
        await page.locator('[data-luen-motion]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(120);
        const start=await page.evaluate(()=>{
          const hero=document.querySelector('[data-luen-motion]');
          return {
            cards:hero?.querySelectorAll('[data-motion-index]').length,
            videos:hero?.querySelectorAll('video').length,
            obsolete:hero?.querySelectorAll('.luen-motion-card-meta').length,
            footers:hero?.querySelectorAll('[data-motion-status]').length,
            names:hero?.querySelectorAll('[data-motion-brand]').length,
          };
        });
        if(start.cards!==3||start.videos!==3||start.obsolete!==0||start.footers!==1||start.names!==1)
          failures.push(engine.name+'/'+width+': missing or duplicated markup '+JSON.stringify(start));
        for(let index=0;index<3;index++){
          // The existing dedicated video QA exercises genuine card clicks and decoding.
          // Here reduce-motion plus DOM click makes layout/label checks deterministic.
          await page.locator('[data-motion-index="'+index+'"]').evaluate(el=>el.click());
          const state=await page.evaluate(()=>{
            const hero=document.querySelector('[data-luen-motion]');
            const bottom=hero.querySelector('.luen-motion-bottom');
            const current=hero.querySelector('.luen-motion-current');
            const progress=hero.querySelector('.luen-motion-progress');
            const pause=hero.querySelector('.luen-motion-pause');
            const box=rectLocal=>{
              const r=rectLocal.getBoundingClientRect();
              return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
            };
            return {
              number:hero.querySelector('[data-motion-number]')?.textContent.trim(),
              category:hero.querySelector('[data-motion-category]')?.textContent.trim(),
              brand:hero.querySelector('[data-motion-brand]')?.textContent.trim(),
              active:[...hero.querySelectorAll('[data-motion-index]')].findIndex(e=>e.classList.contains('is-active')),
              display:getComputedStyle(bottom).display,
              bottom:box(bottom),current:box(current),progress:box(progress),pause:box(pause),
              documentWidth:document.documentElement.scrollWidth,
              clientWidth:document.documentElement.clientWidth,
              currentScrollWidth:current.scrollWidth,
              currentClientWidth:current.clientWidth
            };
          });
          const label=engine.name+'/'+width+'px card '+index;
          const want=cases[index];
          if(state.active!==index||state.number!==want.number||state.category!==want.category||state.brand!==want.brand)
            failures.push(label+': footer not synchronized '+JSON.stringify(state));
          if(state.documentWidth>state.clientWidth+2)
            failures.push(label+': horizontal page overflow '+(state.documentWidth-state.clientWidth)+'px');
          if(state.currentScrollWidth>state.currentClientWidth+2)
            failures.push(label+': active label clipped '+JSON.stringify(state.current));
          if(state.current.left<state.bottom.left-1||state.pause.right>state.bottom.right+1)
            failures.push(label+': footer items out of bounds '+JSON.stringify(state));
          if(state.progress.width<19)
            failures.push(label+': progress line collapsed to '+state.progress.width);
          const overlapX=state.current.right>state.pause.left+1&&state.pause.right>state.current.left+1;
          const overlapY=state.current.bottom>state.pause.top+1&&state.pause.bottom>state.current.top+1;
          if(overlapX&&overlapY)failures.push(label+': active label overlaps pause button');
          if(width<=420){
            if(state.display!=='grid')failures.push(label+': narrow footer not grid '+state.display);
            if(state.progress.top<Math.max(state.current.bottom,state.pause.bottom)+2)
              failures.push(label+': progress line not below controls '+JSON.stringify(state));
          }else{
            if(state.display!=='flex')failures.push(label+': wide footer not flex '+state.display);
            if(state.progress.left<state.current.right-1||state.progress.right>state.pause.left+1)
              failures.push(label+': progress line not between controls '+JSON.stringify(state));
          }
          results.push({engine:engine.name,width,index,active:state.active,
            number:state.number,category:state.category,brand:state.brand,
            layout:state.display,progressWidth:+state.progress.width.toFixed(1),
            overflow:state.documentWidth-state.clientWidth});
          if(index===2&&[320,390,430,1440].includes(width)){
            await page.locator('[data-luen-motion]').screenshot({
              path:path.join(output,'hero-footer-'+engine.name+'-'+width+'.jpg'),
              type:'jpeg',quality:70,animations:'disabled'
            });
          }
        }
        if(errors.length)failures.push(engine.name+'/'+width+': JS errors '+errors.join('; '));
      }catch(error){failures.push(engine.name+'/'+width+': '+String(error.message).slice(0,350));}
      await context.close();
    }
  }finally{await browser.close();}
}
fs.writeFileSync(path.join(output,'responsive-metadata.json'),JSON.stringify({results,failures},null,2));
console.log('LUEN_HERO_METADATA_RESPONSIVE_QA '+JSON.stringify({
  cases:results.length,engines:2,widths,failures
}));
if(failures.length)process.exitCode=1;
