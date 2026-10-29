// LUEN moving archive: audit actual loaded image pixels (not just link syntax).
// Runs only against static PR copy; public production HEAD probe is read-only.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const url=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir='qa-screenshots/selected-work-images';
fs.mkdirSync(dir,{recursive:true});
const results=[],failures=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const ctx=await browser.newContext({
    viewport:{width,height:844},reducedMotion:'no-preference',
    ...(engine===webkit && width===390
      ?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}
      :{})
   });
   const page=await ctx.newPage();
   const resourceErrors=[],exceptions=[];
   page.on('response',r=>{if(r.url().includes('/assets/images/selected-work/')&&r.status()>=400)resourceErrors.push(r.status()+' '+r.url());});
   page.on('requestfailed',r=>{if(r.url().includes('/assets/images/selected-work/'))resourceErrors.push(r.failure()?.errorText+' '+r.url());});
   page.on('pageerror',e=>exceptions.push(e.message));
   try{
    const res=await page.goto(url+'/',{waitUntil:'load',timeout:50000});
    if(!res?.ok())throw new Error('Homepage HTTP '+res?.status());
    await page.locator('#selected-content').scrollIntoViewIfNeeded();
    const gallery=page.locator('#selected-content');
    await page.waitForFunction(()=>{
     const x=[...document.querySelectorAll('#selected-content .portfolio-track img')];
     const originals=x.filter(i=>!i.closest('.loop-clone'));
     return originals.length>=12 && originals.every(i=>i.dataset.luenRailReady==='1'&&i.loading==='eager');
    },null,{timeout:8000});
    // Images outside the current moving viewport must still decode before they scroll into it.
    await page.waitForFunction(()=>{
     const originals=[...document.querySelectorAll('#selected-content .portfolio-set:not(.loop-clone) img')];
     return originals.length===12 && originals.every(i=>i.complete&&i.naturalWidth>0);
    },null,{timeout:16000});
    await page.waitForTimeout(1350);
    const audit=await page.evaluate(()=>{
     const images=[...document.querySelectorAll('#selected-content .portfolio-track img')];
     const original=images.filter(i=>!i.closest('.loop-clone'));
     const clone=images.filter(i=>i.closest('.loop-clone'));
     const broken=images.filter(i=>i.complete&&i.naturalWidth===0);
     const lazy=images.filter(i=>i.loading==='lazy');
     const notReady=images.filter(i=>!i.complete || i.naturalWidth===0);
     const visible=images.filter(i=>{
      const r=i.getBoundingClientRect();
      const rail=i.closest('.portfolio-viewport')?.getBoundingClientRect();
      return rail && r.right>rail.left+10 && r.left<rail.right-10
        && r.bottom>rail.top && r.top<rail.bottom
        && r.bottom>0 && r.top<innerHeight;
     });
     return {total:images.length,original:original.length,clone:clone.length,
       originalsReady:original.filter(i=>i.complete&&i.naturalWidth>0).length,
       clonesReady:clone.filter(i=>i.complete&&i.naturalWidth>0).length,
       visible:visible.length,visibleReady:visible.filter(i=>i.complete&&i.naturalWidth>0).length,
       lazy:lazy.length,broken:broken.map(i=>i.src),notReady:notReady.map(i=>i.src).slice(0,8),
       eagerClones:clone.filter(i=>i.loading==='eager').length,
       resourceHints:images.slice(0,3).map(i=>({loading:i.loading,complete:i.complete,naturalWidth:i.naturalWidth}))
     };
    });
    const label=engine.name()+'-'+width;
    await gallery.screenshot({path:path.join(dir,label+'.jpg'),type:'jpeg',quality:75,animations:'disabled'});
    results.push({engine:engine.name(),width,audit,resourceErrors,exceptions});
    if(audit.originalsReady!==12 || audit.visibleReady!==audit.visible || audit.broken.length ||
       audit.lazy>0 || audit.clone!==audit.eagerClones || resourceErrors.length || exceptions.length)
     failures.push(label+': '+JSON.stringify({audit,resourceErrors,exceptions}).slice(0,2000));
   }catch(e){failures.push(engine.name()+' '+width+': '+e.message.slice(0,400));}
   await ctx.close();
  }
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({cases:results.length,failures,results},null,2));
console.log('LUEN_SELECTED_WORK_IMAGE_QA '+JSON.stringify({cases:results.length,failures,results}));
if(failures.length)process.exitCode=1;
