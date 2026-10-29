// LUEN homepage SERVICES type-only redesign: browser regression + screenshots.
// Local static test. Never submits forms or changes any account / live site.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const url=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output='qa-screenshots/services-editorial';
fs.mkdirSync(output,{recursive:true});
const results=[],errors=[],screenshots=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,360,390,430,768,1024,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
   const page=await ctx.newPage();
   const pageErrors=[];
   page.on('pageerror',e=>pageErrors.push(e.message));
   try{
    const res=await page.goto(url+'/',{waitUntil:'domcontentloaded',timeout:45000});
    if(!res?.ok())throw Error('Page HTTP '+res?.status());
    await page.locator('#services').scrollIntoViewIfNeeded();
    await page.waitForTimeout(280);
    const sample=await page.evaluate(()=>{
     const section=document.querySelector('#services');
     const cards=[...section.querySelectorAll('.luen-service-choice')];
     const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
     const a=cards.map(c=>({title:c.querySelector('h3')?.textContent?.trim(),
       sub:c.querySelector('.luen-service-choice-kicker')?.textContent?.trim(),
       height:r(c)?.height,rect:r(c),titleRect:r(c.querySelector('h3')),
       textWidth:c.querySelector('h3')?.scrollWidth,
       textBoxWidth:c.querySelector('h3')?.clientWidth,
       link:c.querySelector('.luen-service-choice-bottom>a')?.getAttribute('href'),
       linkVisible:!!c.querySelector('.luen-service-choice-bottom>a')?.getClientRects().length,
       imgs:c.querySelectorAll('img,picture,video,iframe,canvas').length,
       details:c.querySelector('.luen-service-choice-formats')?.textContent?.trim(),
       kickerSize:parseFloat(getComputedStyle(c.querySelector('.luen-service-choice-kicker')).fontSize),
       headingSize:parseFloat(getComputedStyle(c.querySelector('h3')).fontSize),
       descriptionSize:parseFloat(getComputedStyle(c.querySelector('.luen-service-choice-when')).fontSize),
       metadataSize:parseFloat(getComputedStyle(c.querySelector('.luen-service-choice-channel')).fontSize),
       ctaSize:parseFloat(getComputedStyle(c.querySelector('.luen-service-choice-bottom>a')).fontSize)
     }));
     return {
      viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,
      section:r(section),header:section.querySelector('h2')?.textContent?.trim(),
      intro:section.querySelector('.luen-services-editorial-intro')?.textContent?.trim(),
      cards:a,links:[...section.querySelectorAll('.luen-service-help nav a')].map(x=>x.getAttribute('href')),
      media:section.querySelectorAll('img,picture,video,iframe,canvas').length,
      why:!!document.querySelector('#why-luen .luen-why-rows'),
      archive:!!document.querySelector('#selected-content .works-archive-title')
     };
    });
    results.push({engine:engine.name(),width,...sample});
    const label=engine.name()+' '+width;
    if(pageErrors.length)errors.push(label+' script: '+pageErrors.slice(0,3).join('; '));
    if(sample.documentWidth>width+2)errors.push(label+' horizontal document overflow '+sample.documentWidth);
    if(sample.cards.length!==3||sample.media!==0)errors.push(label+' missing 3 cards or found media');
    if(sample.header!=='SERVICES'||!sample.intro||!sample.why||!sample.archive)
      errors.push(label+' section structure missing');
    const expected=['YouTube','Instagram','TikTok'];
    const hrefs=['/contact/?service=youtube-longform','/contact/?service=instagram-reels','/contact/?service=tiktok-series'];
    for(const [i,c] of sample.cards.entries()){
     if(c.title!==expected[i]||c.link!==hrefs[i]||!c.linkVisible||c.imgs)
       errors.push(label+' card '+i+' missing title/link or contains media');
     if(c.textWidth>c.textBoxWidth+3)errors.push(label+' card '+i+' heading overflow '+c.textWidth+'/'+c.textBoxWidth);
     if(c.headingSize<35||c.headingSize<2.4*c.kickerSize||c.headingSize<2.5*c.metadataSize)
       errors.push(label+' card '+i+' platform title not primary: '+JSON.stringify({h:c.headingSize,k:c.kickerSize,meta:c.metadataSize}));
     if(c.kickerSize<13||c.ctaSize<10.5||c.descriptionSize<13)
       errors.push(label+' card '+i+' text not readable: '+JSON.stringify({k:c.kickerSize,cta:c.ctaSize,d:c.descriptionSize}));
     if(c.rect?.right>width+2||c.rect?.x < -2)errors.push(label+' card '+i+' out of viewport');
     const maxHeight=width>1020?390:width>767?315:330;
     if(c.height>maxHeight)errors.push(label+' card '+i+' too tall '+c.height+' > '+maxHeight);
    }
    if(sample.links.length!==3)errors.push(label+' missing assistance links');
    if([320,390,768,1440].includes(width) && engine===chromium || width===390 && engine===webkit){
      const filename=path.join(output,engine.name()+'-'+width+'.jpg');
      await page.locator('#services').screenshot({path:filename,type:'jpeg',quality:85,animations:'disabled'});
      screenshots.push(filename);
    }
   }catch(e){errors.push(engine.name()+' '+width+' exception: '+e.message.slice(0,300));}
   finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
const report={timestamp:new Date().toISOString(),cases:results.length,failures:errors.length,errors,
  screenshots,results};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log('LUEN_SERVICES_EDITORIAL '+JSON.stringify({cases:report.cases,failures:errors.length,errors,
  geometry:results.map(x=>({e:x.engine,w:x.width,cardHeights:x.cards.map(c=>Math.round(c.height)),documentWidth:x.documentWidth}))}));
if(errors.length)process.exitCode=1;
