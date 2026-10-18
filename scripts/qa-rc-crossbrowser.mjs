// Non-destructive LUEN RC browser-engine compatibility test.
// WebKit+emulated iPhone and Chromium+emulated Pixel are NOT physical device QA.
import {chromium,webkit,devices} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','release-crossbrowser');
fs.mkdirSync(dir,{recursive:true});
const routes=['/','/services/','/services/youtube-creator-marketing/',
  '/services/instagram-influencer-marketing/','/cases/herahera-seoul-fnb/',
  '/contact/','/about/','/project-guide/'];
const profiles=[
 {id:'webkit-iphone13',engine:webkit,device:devices['iPhone 13']},
 {id:'chromium-pixel7',engine:chromium,device:devices['Pixel 7']}
];
const failures=[],results=[];
const wait=ms=>new Promise(done=>setTimeout(done,ms));
for(const profile of profiles){
 const browser=await profile.engine.launch({headless:true});
 try{
  const context=await browser.newContext({...profile.device,reducedMotion:'reduce'});
  await context.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
  await context.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
  const page=await context.newPage();page.setDefaultTimeout(9500);
  for(const route of routes){
   const pageErrors=[];
   const onError=error=>pageErrors.push(String(error.message||error).slice(0,200));
   page.on('pageerror',onError);
   try{
    const res=await page.goto(root+route,{waitUntil:'domcontentloaded',timeout:45000});
    if(res?.status()!==200)throw Error('route status '+res?.status());
    await page.locator('main#top').waitFor({state:'visible',timeout:18000});
    await page.waitForTimeout(210);
    const info=await page.evaluate(()=>{
     const main=document.querySelector('main#top');
     const w=document.documentElement.clientWidth;
     const body=document.body;
     const links=[...main.querySelectorAll('a[href]')].map(x=>x.getAttribute('href'));
     const visibleImg=[...main.querySelectorAll('img')].filter(x=>{
       const a=x.getBoundingClientRect();
       return a.width>0&&a.height>0&&a.top<innerHeight&&a.bottom>0;
     });
     const overflow=[...main.querySelectorAll('h1,h2,.luen-page-cta,.instagram-plan-card,.yt-type-card,.contact-page-form')]
       .filter(x=>{const a=x.getBoundingClientRect();return a.width>0&&(a.left< -4||a.right>w+4)})
       .slice(0,8).map(x=>x.tagName+'.'+(typeof x.className==='string'?x.className.split(' ').join('.'):'')); 
     return {
      title:document.title,viewportWidth:w,scrollWidth:document.documentElement.scrollWidth,
      mainHeight:main.getBoundingClientRect().height,
      h1Count:main.querySelectorAll('h1').length,
      internalContactLink:links.filter(l=>l==='/contact/').length,
      contactFormCount:document.querySelectorAll('#contactForm').length,
      heroTop:document.querySelector('.hero,.luen-page-hero')?.getBoundingClientRect().top??null,
      visibleBrokenImages:visibleImg.filter(x=>x.complete&&x.naturalWidth===0).map(x=>x.getAttribute('src')),
      overflow,
      bodyScrollLock:body.style.overflow,
      fontFamily:getComputedStyle(body).fontFamily
     };
    });
    if(info.mainHeight<150||info.h1Count!==1)failures.push(profile.id+route+' main/h1 missing');
    if(info.scrollWidth>info.viewportWidth+3)failures.push(profile.id+route+' horizontal overflow '+info.scrollWidth+'/'+info.viewportWidth);
    if(info.visibleBrokenImages.length)failures.push(profile.id+route+' broken visible images '+info.visibleBrokenImages.join(','));
    if(info.overflow.length)failures.push(profile.id+route+' offscreen content '+info.overflow.join(','));
    if(route==='/contact/'&&info.contactFormCount!==1)failures.push(profile.id+route+' missing inquiry form');
    if(route.startsWith('/services/')&&route!=='/services/'&&info.internalContactLink===0)
      failures.push(profile.id+route+' no contact CTA');
    if(route==='/'||route==='/contact/'){
     const menu=page.locator('#hamburger'),drawer=page.locator('#mobileMenu');
     if(!await menu.isVisible())failures.push(profile.id+route+' no mobile menu button');
     else{
      await menu.click();
      if(!await drawer.evaluate(el=>el.classList.contains('open')))
        failures.push(profile.id+route+' drawer failed to open');
      await page.locator('#mobileClose').click();
      if(await drawer.evaluate(el=>el.classList.contains('open')))
        failures.push(profile.id+route+' drawer failed to close');
      const scroll=await page.locator('body').evaluate(el=>el.style.overflow);
      if(scroll==='hidden')failures.push(profile.id+route+' body left locked');
     }
    }
    if(route==='/services/instagram-influencer-marketing/'||route==='/services/youtube-creator-marketing/'){
     const faq=page.locator('main details').first();
     if(await faq.count()){
      await faq.locator('summary').click();
      if(!(await faq.evaluate(el=>el.open)))failures.push(profile.id+route+' FAQ failed to open');
     }
    }
    if(route==='/'||route==='/contact/'||route==='/services/instagram-influencer-marketing/'){
     await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});
     await page.waitForTimeout(110);
     await page.screenshot({path:path.join(dir,profile.id+'-'+(route==='/'?'home':route.slice(1).replaceAll('/','-'))+'.jpg'),
       type:'jpeg',quality:70,animations:'disabled',fullPage:route!=='/'});
    }
    if(pageErrors.length)failures.push(profile.id+route+' JS error '+[...new Set(pageErrors)].join('; '));
    results.push({profile:profile.id,route,documentWidth:info.scrollWidth,
      viewport:info.viewportWidth,visibleBrokenImages:info.visibleBrokenImages.length,
      pageErrors:pageErrors.length,formCount:info.contactFormCount,headings:info.h1Count});
   }catch(error){failures.push(profile.id+route+' EXCEPTION '+String(error.message).slice(0,320));}
   finally{page.off('pageerror',onError);}
  }
  await context.close();
 }finally{await browser.close();}
}
const report={profiles:profiles.map(x=>x.id),routes,results,failures};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
console.log('LUEN_RC_CROSSBROWSER_SUMMARY '+JSON.stringify({checks:results.length,expected:profiles.length*routes.length,failures:failures.length,results}));
for(const err of failures)console.error('LUEN_RC_CROSSBROWSER_FAIL '+err);
if(failures.length||results.length!==profiles.length*routes.length)process.exitCode=1;
