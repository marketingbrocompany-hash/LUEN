// LUEN Signature Campaigns / isolated layout and content checks.
// Verifies approved 2x2 desktop index, stacked compact mobile rows, real media,
// entire-row links, original case destinations and no duplicated inquiry CTA.
import {chromium, webkit} from 'playwright';
import fs from 'node:fs';
const origin=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const directory='qa-screenshots/signature-case-index';
fs.mkdirSync(directory,{recursive:true});
const failures=[],results=[],screenshots=[];
const hrefs=['/cases/herahera-seoul-fnb/','/cases/ikeda-edita/','/cases/yuki-clinic/','/cases/masubuchi-bibigo/'];
const sources=['herahera-highres-thumbnail.webp','japan-beauty-creator-marketing-case-01.webp','korea-clinic-marketing-case-02.webp','korea-food-marketing-case-04.webp'];
for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [320,360,390,430,768,1024,1440]){
      const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
      const page=await ctx.newPage();
      const errorList=[];
      page.on('pageerror',e=>errorList.push(e.message));
      const tag=engine.name()+' '+width;
      try{
        const r=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:45000});
        if(!r?.ok())throw new Error('HTTP '+r?.status());
        await page.locator('#cases').scrollIntoViewIfNeeded();
        for(const img of await page.locator('#cases .luen-case-media img').all()){
          await img.scrollIntoViewIfNeeded();
          await img.evaluate(async el=>{if(!el.complete)await new Promise(res=>{el.addEventListener('load',res,{once:true});el.addEventListener('error',res,{once:true});});});
        }
        const d=await page.evaluate(()=>{
          const root=document.querySelector('#cases.luen-case-index');
          const cards=[...root.querySelectorAll('.luen-case-entry')];
          const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right};};
          const grid=root.querySelector('.luen-case-index-grid');
          return {
            width:innerWidth,documentWidth:document.documentElement.scrollWidth,
            height:box(root).h, gridColumns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
            cards:cards.map(c=>{const a=c.querySelector('a');const img=c.querySelector('img');const h=c.querySelector('h3');return {
              rect:box(c),linkBox:box(a),href:a?.getAttribute('href'),image:img?.getAttribute('src'),naturalWidth:img?.naturalWidth,
              title:h?.innerText,titleScroll:h?.scrollWidth,titleWidth:h?.clientWidth,
              focusable:a?.tabIndex>=0
            };}),
            inquiryBanner:root.querySelectorAll('.case-inquiry-v7,.case-inquiry-btn-v7').length,
            duplicateFeatured:root.querySelectorAll('.case-feature-v7').length,
            archive:!!document.querySelector('#selected-content .portfolio-viewport'),
            services:!!document.querySelector('#services .luen-service-choice'),
            caseHeading:root.querySelector('#cases-title')?.innerText,
            footer:root.querySelector('.luen-case-index-foot')?.innerText
          };
        });
        results.push({engine:engine.name(),width,...d});
        if(errorList.length)failures.push(tag+' JS '+errorList.slice(0,3).join('; '));
        if(d.cards.length!==4||d.inquiryBanner||d.duplicateFeatured||!d.archive||!d.services)
          failures.push(tag+' structure '+JSON.stringify({cases:d.cards.length,inquiry:d.inquiryBanner,featured:d.duplicateFeatured,archive:d.archive,services:d.services}));
        if(d.documentWidth>width+2)failures.push(tag+' overflow document='+d.documentWidth);
        if(d.gridColumns!==(width<=767?1:2))failures.push(tag+' unexpected grid columns '+d.gridColumns);
        if(d.caseHeading!=='Signature Campaigns'||!d.footer?.includes('SELECTED CAMPAIGNS'))
          failures.push(tag+' header/footer missing');
        if(width===1440 && d.height>750)failures.push(tag+' section too tall '+d.height);
        for(const [i,c] of d.cards.entries()){
          if(c.href!==hrefs[i]||!c.image?.includes(sources[i])||c.naturalWidth<1||!c.focusable)
            failures.push(tag+' case '+i+' source/link/keyboard '+JSON.stringify(c));
          if(c.rect.x < -2||c.rect.right>width+2||c.titleScroll>c.titleWidth+4)
            failures.push(tag+' case '+i+' overflow '+JSON.stringify(c.rect));
          if(c.rect.h>(width<=767?205:265))failures.push(tag+' case '+i+' too tall '+c.rect.h);
        }
        if(d.cards.length===4){
          const a=d.cards.map(x=>x.rect);
          if(width<=767){
            if(a[1].y<=a[0].y||a[2].y<=a[1].y||a[3].y<=a[2].y)
              failures.push(tag+' cards are not stacked');
          }else if(Math.abs(a[1].y-a[0].y)>4||Math.abs(a[3].y-a[2].y)>4)
            failures.push(tag+' 2x2 alignment failed');
        }
        if((engine===chromium && [320,390,768,1440].includes(width))||(engine===webkit&&width===390)){
          await page.locator('#cases').scrollIntoViewIfNeeded();
          const filename=directory+'/'+engine.name()+'-'+width+'.jpg';
          await page.locator('#cases').screenshot({path:filename,type:'jpeg',quality:88,animations:'disabled'});
          screenshots.push(filename);
        }
      }catch(e){failures.push(tag+' '+e.message.slice(0,320));}
      finally{await ctx.close();}
    }
  }finally{await browser.close();}
}
const report={checks:results.length,failures:failures.length,errors:failures,screenshots,geometry:results.map(x=>({engine:x.engine,width:x.width,height:Math.round(x.height),columns:x.gridColumns,cards:x.cards.map(c=>Math.round(c.rect.h))}))};
fs.writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));
console.log('SIGNATURE_CASE_INDEX '+JSON.stringify(report));
if(failures.length)process.exitCode=1;
