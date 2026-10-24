// Read-only Chromium QA for the LUEN YouTube long-form service.
// Does not submit forms or modify external resources.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const origin=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const route='/services/youtube-creator-marketing/';
const output=path.resolve('qa-screenshots','youtube-longform');
fs.mkdirSync(output,{recursive:true});
const sizes=[
  ['mobile-narrow',320,650],['mobile-small',360,740],
  ['mobile',390,844],['mobile-wide',430,932],
  ['tablet',768,1024],['tablet-edge',820,1180],
  ['tablet-landscape',1024,768],['laptop',1280,800],['desktop',1440,900]
];
const errors=[],results=[];
const browser=await chromium.launch({headless:true});
try{
 for(const [label,width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   await context.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
   await context.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
   const page=await context.newPage();
   const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message.slice(0,200)));
   try{
     const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:40000});
     if(response?.status()!==200)throw Error('HTTP '+response?.status());
     await page.locator('.yt-type-card').first().waitFor({timeout:12000});
     await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,3000))]));
     const info=await page.evaluate(()=>{
       const cards=[...document.querySelectorAll('.yt-type-card')];
       const imgs=[...document.querySelectorAll('main img')];
       const widest=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
       const offscreen=[...document.querySelectorAll('main h1, main h2, .yt-type-card, .yt-compare, .luen-page-cta a')]
         .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left < -2 || r.right>innerWidth+2)})
         .map(e=>e.tagName.toLowerCase()+'.'+(e.className||'').toString().split(' ').slice(0,2).join('.'));
       return {
         title:document.title,
         width:innerWidth,documentWidth:widest,
         cards:cards.length,
         cardLabels:cards.map(e=>e.querySelector('h3')?.textContent.trim()),
         requiredIds:['youtube-types','yt-title','yt-cta-title'].map(id=>!!document.getElementById(id)),
         compare:document.querySelectorAll('.yt-compare').length,
         faq:document.querySelectorAll('main details').length,
         inquiry:document.querySelector('.luen-page-cta a')?.getAttribute('href'),
         brokenImages:imgs.filter(x=>x.complete && x.naturalWidth===0).map(x=>x.getAttribute('src')),
         offscreen,
         cardRects:cards.map(x=>({left:Math.round(x.getBoundingClientRect().left),top:Math.round(x.getBoundingClientRect().top)}))
       };
     });
     if(!info.title.includes('롱폼'))errors.push(label+': wrong page title '+info.title);
     if(info.cards!==3||!info.cardLabels.includes('브랜디드 콘텐츠')||!info.cardLabels.includes('PPL 콘텐츠')||!info.cardLabels.includes('롱폼 크리에이터 8인 패키지'))
       errors.push(label+': missing product cards '+JSON.stringify(info.cardLabels));
     if(info.requiredIds.some(x=>!x)||info.compare!==1||info.faq<3||info.inquiry!=='/contact/?service=youtube-longform')
       errors.push(label+': key navigation, FAQ or sections missing');
     if(info.documentWidth>width+2)errors.push(label+': horizontal page overflow '+info.documentWidth+' > '+width);
     if(info.offscreen.length)errors.push(label+': offscreen content '+info.offscreen.join(','));
     // Check legibility using actual browser-computed colors, not just layout.
     const visual=await page.evaluate(()=>{
       const bgEl=document.querySelector('.luen-page-section--ink');
       const secondary=document.querySelector('.yt-longform-hero .btn-secondary');
       const inkHeading=document.querySelector('.yt-process-compact h3');
       const inkBody=document.querySelector('.yt-process-compact p');
       const media=document.querySelector('.yt-selected-work .jcm-creator-card');
       const baseBg=getComputedStyle(document.body).backgroundColor;
       const darkBg=getComputedStyle(bgEl).backgroundColor;
       const rgb=v=>{const arr=(v.match(/[\d.]+/g)||[]).map(Number);
         return {rgb:arr.slice(0,3),alpha:arr[3]??1}};
       const composite=(fg,bg)=>fg.rgb.map((v,i)=>v*fg.alpha+bg.rgb[i]*(1-fg.alpha));
       const lum=val=>{
         const linear=val.map(v=>{const s=v/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)});
         return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
       };
       const ratio=(fg,bg)=>{const a=lum(composite(rgb(fg),rgb(bg))),b=lum(rgb(bg).rgb);
         return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
       return {
         secondaryContrast:ratio(getComputedStyle(secondary).color,baseBg),
         headingContrast:ratio(getComputedStyle(inkHeading).color,darkBg),
         bodyContrast:ratio(getComputedStyle(inkBody).color,darkBg),
         cardRadius:parseFloat(getComputedStyle(media).borderTopLeftRadius)
       };
     });
     for(const [type,score] of Object.entries({secondary:visual.secondaryContrast,heading:visual.headingContrast,processBody:visual.bodyContrast}))
       if(!Number.isFinite(score)||score<4.5)errors.push(label+': '+type+' contrast below 4.5:1: '+score.toFixed(2));
     if(!Number.isFinite(visual.cardRadius)||visual.cardRadius<16)errors.push(label+': selected work lacks rounded image card');

     if(info.brokenImages.length)errors.push(label+': broken image(s): '+info.brokenImages.join(','));
     if(width>=1280 && new Set(info.cardRects.map(x=>x.left)).size!==3)
       errors.push(label+': desktop cards did not form three columns');
     if(width<=430 && new Set(info.cardRects.map(x=>x.left)).size!==1)
       errors.push(label+': mobile cards are not in one column');
     const hash=page.locator('a[href="#youtube-types"]').first();
     if(await hash.count()!==1)errors.push(label+': missing comparison anchor');
     else await hash.click();
     const hashResult=await page.evaluate(()=>location.hash);
     if(hashResult!=='#youtube-types')errors.push(label+': comparison anchor failed');
     const faq=page.locator('main details').first();
     if(await faq.count()) {
       await faq.locator('summary').click();
       if(!await faq.evaluate(e=>e.open))errors.push(label+': FAQ did not open');
     }
     if(width<=820){
       const nav=page.locator('#hamburger'),menu=page.locator('#mobileMenu');
       if(!await nav.isVisible())errors.push(label+': mobile hamburger not visible');
       else{
         await nav.click();
         if(!await menu.evaluate(e=>e.classList.contains('open')))errors.push(label+': mobile menu did not open');
         await page.keyboard.press('Escape');
         if(await menu.evaluate(e=>e.classList.contains('open')))errors.push(label+': Escape did not close menu');
         if(await page.locator('body').evaluate(e=>getComputedStyle(e).overflow)==='hidden')errors.push(label+': scroll lock not released');
       }
     }
     if(jsErrors.length)errors.push(label+': JS errors '+[...new Set(jsErrors)].join(';'));
     if(['mobile','desktop'].includes(label))await page.screenshot({
       path:path.join(output,label+'.jpg'),type:'jpeg',quality:70,fullPage:true,animations:'disabled'
     });
     results.push({label,viewport:width+'x'+height,documentWidth:info.documentWidth,cards:info.cards,brokenImages:info.brokenImages.length,jsErrors:jsErrors.length});
   }catch(e){errors.push(label+': exception '+String(e.message).slice(0,280))}
   await context.close();
 }
}finally{await browser.close()}
const report={origin,route,results,errors};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log('LUEN_YOUTUBE_PAGE_QA '+JSON.stringify({viewports:results.length,failures:errors.length,results}));
errors.forEach(e=>console.error('LUEN_YOUTUBE_PAGE_QA_FAIL '+e));
if(errors.length)process.exitCode=1;
