import {chromium,webkit} from 'playwright';
const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const cases=[{name:'chrome-mobile',engine:chromium,width:390,ua:null},
{name:'chrome-desktop',engine:chromium,width:1440,ua:null},
{name:'ios-webkit',engine:webkit,width:390,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}];
const outcomes=[],errors=[];
for(const spec of cases){
  const browser=await spec.engine.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:spec.width,height:844},reducedMotion:'no-preference',
      userAgent:spec.ua||undefined,deviceScaleFactor:spec.ua?2:1});
    // Do not send synthetic analytics events.
    await ctx.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,route=>route.abort());
    const page=await ctx.newPage(),jsErrors=[];
    page.on('pageerror',e=>jsErrors.push(String(e).slice(0,260)));
    try{
      await page.goto(base+'/',{waitUntil:'load',timeout:55000});
      await page.waitForTimeout(450);
      const before=await page.evaluate(()=>({
        sourceCards:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone) .portfolio-card').length,
        galleryClones:document.querySelectorAll('#selected-content .loop-clone').length,
        brandClones:document.querySelectorAll('.brand-wall .loop-clone').length,
        pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      }));
      if(before.sourceCards!==12)errors.push(spec.name+' original cards missing '+before.sourceCards);
      if(before.galleryClones!==0)errors.push(spec.name+' offscreen galleries initialized too early '+before.galleryClones);
      // Safari can report unresolved geometry for the brand strip until visible.
      // The required behavior is to initialize when the visitor actually sees it.
      await page.locator('.brand-wall .brand-viewport').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelectorAll('.brand-wall .loop-clone').length>0,null,{timeout:9500});
      const brandClones=await page.locator('.brand-wall .loop-clone').count();
      if(brandClones<1)errors.push(spec.name+' visible brand loop did not initialize');
      if(before.pageOverflow>2)errors.push(spec.name+' initial horizontal overflow '+before.pageOverflow);
      const rails=page.locator('#selected-content .portfolio-viewport');
      for(let i=0;i<2;i++){
        const rail=rails.nth(i);
        await rail.scrollIntoViewIfNeeded();
        await page.waitForFunction(index=>document.querySelectorAll('#selected-content .portfolio-viewport')[index]
          ?.querySelectorAll('.loop-clone').length>0,i,{timeout:9500});
        // Mirror the proven iOS QA timing; wait for the initial Safari
        // geometry pass and RAF to stabilize before comparing transforms.
        await page.waitForFunction(index=>{
          const el=document.querySelectorAll('#selected-content .portfolio-viewport')[index];
          const source=el?.querySelector('.loop-set:not(.loop-clone)');
          return source?.getBoundingClientRect().width > el.clientWidth;
        },i,{timeout:9500});
        const read=()=>rail.locator('.loop-track').evaluate(el=>getComputedStyle(el).transform);
        await page.waitForTimeout(450);
        const a=await read();await page.waitForTimeout(650);const b=await read();
        if(a===b)errors.push(spec.name+' gallery '+i+' not moving when visible');
      }
      const afterClones=await page.locator('#selected-content .loop-clone').count();
      if(afterClones<2)errors.push(spec.name+' gallery clone not initialized');
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(450);
      const reduced=await page.evaluate(()=>({
        galleryClones:document.querySelectorAll('#selected-content .loop-clone').length,
        brandClones:document.querySelectorAll('.brand-wall .loop-clone').length,
        documentWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth
      }));
      if(reduced.galleryClones!==0||reduced.brandClones!==0||reduced.documentWidth>reduced.clientWidth+2)
        errors.push(spec.name+' reduced motion cleanup failed '+JSON.stringify(reduced));
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForTimeout(480);
      if(await page.locator('#selected-content .loop-clone').count()<2)
        errors.push(spec.name+' gallery auto motion not restored on OS preference change');
      if(jsErrors.length)errors.push(spec.name+' JS errors '+JSON.stringify(jsErrors));
      outcomes.push({name:spec.name,before,afterClones,reduced,jsErrors});
    }catch(error){errors.push(spec.name+' exception '+String(error).slice(0,450))}
    finally{await ctx.close();}
  }finally{await browser.close();}
}
console.log('LUEN_DEFER_GALLERY_QA '+JSON.stringify({cases:outcomes,errors}));
if(errors.length)process.exitCode=1;