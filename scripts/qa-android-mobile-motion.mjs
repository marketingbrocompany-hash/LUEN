// Read-only Android Chrome emulation against public LUEN site.
// No inquiry submits; GA4 requests are blocked. Not a physical-device test.
import {chromium,devices} from 'playwright';
import fs from 'node:fs';
const BASE=(process.env.LUEN_QA_URL||'https://luenkorea.com').replace(/\/$/,'');
const errors=[],out=[];
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({...devices['Pixel 7'],reducedMotion:'no-preference'});
  await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,route=>route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push('JS: '+error.message.slice(0,200)));
  try{
    const response=await page.goto(BASE+'/',{waitUntil:'load',timeout:60000});
    if(response?.status()!==200)throw Error('Homepage status: '+response?.status());
    const rails=page.locator('#selected-content .portfolio-viewport');
    if(await rails.count()!==2)throw Error('Expected long-form and short-form mobile rails');
    const start=await page.evaluate(()=>({
      isMobile:matchMedia('(pointer:coarse)').matches,
      width:document.documentElement.clientWidth,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      cards:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone) .portfolio-card').length
    }));
    if(!start.isMobile||start.overflow>3||start.cards!==12)errors.push('Initial Android geometry '+JSON.stringify(start));
    await page.waitForFunction(()=>document.querySelectorAll('[data-loop-strip] .loop-clone').length>=3,null,{timeout:12000});
    for(let i=0;i<2;i++){
      const rail=rails.nth(i);
      await rail.scrollIntoViewIfNeeded({timeout:15000});
      await page.waitForTimeout(400);
      const before=await rail.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
      await page.waitForTimeout(500);
      const after=await rail.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
      const geo=await rail.evaluate(el=>{
        const original=el.querySelector('.loop-set:not(.loop-clone)');
        const first=original?.querySelector('.portfolio-card');
        return {sourceWidth:original?.getBoundingClientRect().width,
          cardWidth:first?.getBoundingClientRect().width,
          clones:el.querySelectorAll('.loop-clone').length,
          documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      if(before===after||!geo.clones||geo.cardWidth<60||geo.sourceWidth<200||geo.documentOverflow>3)
        errors.push('Android rail '+i+' motion/layout '+JSON.stringify({before,after,geo}));
      out.push({rail:i,moved:before!==after,...geo});
    }
    fs.mkdirSync('qa-screenshots/android-mobile',{recursive:true});
    await page.screenshot({path:'qa-screenshots/android-mobile/selected-content.jpg',
      type:'jpeg',quality:70,animations:'disabled'});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(500);
    const paused=await page.locator('[data-loop-strip] .loop-clone').count();
    if(paused!==0)errors.push('Reduced motion still has '+paused+' clones');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForFunction(()=>document.querySelectorAll('[data-loop-strip] .loop-clone').length>=3,null,{timeout:12000});
    out.push({androidEmulation:'Pixel 7',reducedMotionPaused:paused===0,resumed:true,start});
  }finally{await context.close();}
}finally{await browser.close();}
console.log('LUEN_ANDROID_PRODUCTION_MOTION_QA '+JSON.stringify({out,errors}));
if(errors.length)process.exitCode=1;
