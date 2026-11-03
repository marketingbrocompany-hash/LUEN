// Real browser test for three hero poster assets and one-shot error recovery.
// Never submits forms or mutates production.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\\/$/,'');
const folder=path.resolve('qa-screenshots/hero-poster-resilience');
fs.mkdirSync(folder,{recursive:true});
const checks=[],failures=[];
for(const engine of [{name:'chromium',type:chromium},{name:'webkit',type:webkit}]){
  const browser=await engine.type.launch({headless:true});
  try{
    for(const width of [390,1440]){
      const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      const page=await ctx.newPage();
      try{
        await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(()=>[...document.querySelectorAll('[data-luen-motion] img')].length===3 &&
          [...document.querySelectorAll('[data-luen-motion] img')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:15000});
        const data=await page.locator('[data-luen-motion] img').evaluateAll(images=>images.map(i=>({
          loaded:i.complete&&i.naturalWidth>0,retry:i.dataset.posterRetry||'',loading:i.loading,
          naturalWidth:i.naturalWidth,visible:getComputedStyle(i).visibility
        })));
        if(data.length!==3||data.some(i=>!i.loaded||i.loading!=='eager'||i.retry))
          failures.push(engine.name+'/'+width+' normal poster load '+JSON.stringify(data));
        checks.push({engine:engine.name,width,scenario:'all-posters-eager',data});
      }catch(e){failures.push(engine.name+'/'+width+' normal: '+e.message.slice(0,230));}
      await ctx.close();
    }
    for(const mode of ['recover-after-one-failure','permanently-unavailable']){
      const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      const page=await ctx.newPage();let attempts=0;
      await page.route(/\\/assets\\/images\\/luen-motion\\/clinic-poster\\.webp/,async route=>{
        attempts++;
        if(mode==='permanently-unavailable'||attempts===1)await route.abort('failed');
        else await route.continue();
      });
      try{
        await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForFunction(mode=>{
          const card=document.querySelector('[data-motion-index="2"]');
          const img=card?.querySelector('img');
          return mode==='recover-after-one-failure'
            ? img?.complete&&img.naturalWidth>0&&img.dataset.posterRetry==='1'&&!card.classList.contains('is-poster-failed')
            : card?.classList.contains('is-poster-failed')&&img?.dataset.posterRetry==='1';
        },mode,{timeout:15000});
        const data=await page.locator('[data-motion-index="2"]').evaluate(card=>{
          const img=card.querySelector('img'),media=card.querySelector('.luen-motion-media');
          return {visible:getComputedStyle(img).visibility,loaded:img.naturalWidth>0,
            fallback:card.classList.contains('is-poster-failed'),
            title:getComputedStyle(media,'::after').content,retry:img.dataset.posterRetry};
        });
        if(attempts!==2)failures.push(engine.name+'/'+mode+' expected 2 requests, got '+attempts);
        if(mode==='recover-after-one-failure' && (!data.loaded||data.fallback||data.visible==='hidden'))
          failures.push(engine.name+'/'+mode+' retry did not recover '+JSON.stringify(data));
        if(mode==='permanently-unavailable' && (!data.fallback||data.visible!=='hidden'||!data.title.includes('KOREA CLINIC')))
          failures.push(engine.name+'/'+mode+' broken image glyph not hidden '+JSON.stringify(data));
        checks.push({engine:engine.name,scenario:mode,attempts,data});
        if(mode==='permanently-unavailable')await page.locator('[data-luen-motion]').screenshot({
          path:path.join(folder,'poster-fallback-'+engine.name+'.jpg'),type:'jpeg',quality:75
        });
      }catch(e){failures.push(engine.name+'/'+mode+': '+e.message.slice(0,230));}
      await ctx.close();
    }
  }finally{await browser.close();}
}
fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify({checks,failures},null,2));
console.log('LUEN_HERO_POSTER_RESILIENCE '+JSON.stringify({checks:checks.length,failures}));
if(failures.length)process.exitCode=1;
