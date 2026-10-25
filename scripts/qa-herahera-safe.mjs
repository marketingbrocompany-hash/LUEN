// Protected review-only case QA. No real inquiries, visitor images, or deployment.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const out='qa-screenshots/herahera-safe';
fs.mkdirSync(out,{recursive:true});
const tests=[
  {name:'desktop-1440',engine:chromium,width:1440,height:900,mobile:false},
  {name:'mobile-webkit-390',engine:webkit,width:390,height:844,mobile:true}
];
const results=[];
for(const t of tests){
  const browser=await t.engine.launch({headless:true});
  try{
    const context=await browser.newContext({
      viewport:{width:t.width,height:t.height},
      deviceScaleFactor:t.mobile?2:1,
      isMobile:t.mobile,hasTouch:t.mobile
    });
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,route=>route.abort());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const res=await page.goto(base+'/cases/herahera-seoul-fnb/',{waitUntil:'load',timeout:60000});
    if(res?.status()!==200)throw Error(t.name+' returned HTTP '+res?.status());
    const offline=page.locator('#case-offline');
    await offline.scrollIntoViewIfNeeded();
    // The existing production site.js dynamically appends the already published
    // original POP raster to [data-herahera-pop-proof].
    await page.waitForFunction(()=>{
      const img=document.querySelector('[data-herahera-pop-proof] img');
      return !!img && img.complete && img.naturalWidth>100 && img.naturalHeight>100;
    },null,{timeout:15000});
    const state=await page.evaluate(()=>{
      const section=document.querySelector('#case-offline');
      const img=section?.querySelector('[data-herahera-pop-proof] img');
      const layout=section?.querySelector('.herahera-offline-layout');
      const videoCards=document.querySelectorAll('#case-content .herahera-video-card');
      return {
        sourceIsExistingDataWebp:img?.getAttribute('src')?.startsWith('data:image/webp;base64,')||false,
        popDecoded:!!img&&img.naturalWidth>100&&img.naturalHeight>100,
        videoCards:videoCards.length,
        metrics:[...document.querySelectorAll('.herahera-video-metrics dd')].map(n=>n.textContent.trim()),
        visitorPhotos:document.querySelectorAll('[src*="herahera-visitor"],.herahera-visitor-gallery').length,
        recreatedPop:document.querySelectorAll('[src*="herahera-pop-cutout"]').length,
        pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        layoutColumns:layout?getComputedStyle(layout).gridTemplateColumns:null,
        popBeforeCaption:!!img&&getComputedStyle(img).order<getComputedStyle(img.parentElement.querySelector('figcaption')).order,
        cta:!!document.querySelector('.herahera-hero a[href="#case-offline"]')
      };
    });
    if(!state.popDecoded||!state.sourceIsExistingDataWebp)throw Error(t.name+': original POP did not decode: '+JSON.stringify(state));
    if(state.visitorPhotos!==0||state.recreatedPop!==0)throw Error(t.name+': unsafe image reference in DOM');
    if(state.videoCards!==2||!state.metrics.includes('97만')||!state.metrics.includes('49만'))throw Error(t.name+': expected video count/metrics absent');
    if(state.pageOverflow>3)throw Error(t.name+': horizontal overflow '+state.pageOverflow);
    if(!state.popBeforeCaption)throw Error(t.name+': original POP appears below caption');
    if(!state.cta)throw Error(t.name+': offline anchor missing');
    if(errors.length)throw Error(t.name+': JavaScript errors '+errors.join('; '));
    await offline.screenshot({path:out+'/'+t.name+'-offline.jpg',animations:'disabled'});
    results.push({name:t.name,...state});
    await context.close();
  }finally{await browser.close();}
}
console.log(JSON.stringify({status:'PASS',results},null,2));
