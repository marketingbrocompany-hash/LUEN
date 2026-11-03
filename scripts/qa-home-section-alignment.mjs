// LUEN homepage section heading alignment QA: every homepage section title
// must start on its section's container edge, at every width. Catches a
// nested .container (which shrinks and re-centres the inner box) pushing one
// title inward. Local static server only: never deploys, submits forms or
// sends GA4 hits.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const dir=path.resolve('qa-screenshots','section-alignment');
fs.mkdirSync(dir,{recursive:true});
const sections=['cases','why-luen','services','selected-content','partner-creators','content-flow','faq','contact'];
const failures=[],results=[];
const browser=await chromium.launch({headless:true});
try{
  for(const width of [320,390,768,1024,1280,1440,1920]){
    const mobile=width<768;
    const context=await browser.newContext({viewport:{width,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const page=await context.newPage();
    try{
      const res=await page.goto(base+'/',{waitUntil:'load',timeout:45000});
      if(res?.status()!==200)throw Error('HTTP '+res?.status());
      const rows=await page.evaluate(ids=>ids.map(id=>{
        const section=document.getElementById(id);
        const container=section?.querySelector(':scope > .container');
        const title=section?.querySelector('h2');
        if(!container||!title)return {id,missing:true};
        return {id,container:+container.getBoundingClientRect().left.toFixed(1),title:+title.getBoundingClientRect().left.toFixed(1),
          nested:container.querySelectorAll('.container').length};
      }),sections);
      for(const r of rows){
        if(r.missing){failures.push(width+' #'+r.id+': section container or title not found');continue;}
        if(Math.abs(r.title-r.container)>2)failures.push(width+' #'+r.id+': title starts at '+r.title+'px, container at '+r.container+'px');
      }
      const density=await page.evaluate(()=>{
        const why=document.querySelector('#why-luen .luen-partnership-head h2');
        const works=document.querySelector('#selected-content .works-archive-title');
        const services=[...document.querySelectorAll('#services .luen-service-choice')];
        const size=el=>el?+parseFloat(getComputedStyle(el).fontSize).toFixed(1):null;
        return {whyHeading:size(why),worksHeading:size(works),
          serviceHeadings:services.map(el=>size(el.querySelector('h3'))),
          serviceHeights:services.map(el=>+el.getBoundingClientRect().height.toFixed(1)),
          serviceCount:services.length,
          railCount:document.querySelectorAll('#selected-content [data-loop-strip]').length,
          horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      if(density.horizontalOverflow>2)failures.push(width+': horizontal document overflow '+density.horizontalOverflow);
      if(density.serviceCount!==3||density.railCount!==2)
        failures.push(width+': services/works markup regression '+JSON.stringify(density));
      if(width>=768 && density.whyHeading>47)
        failures.push(width+': Why LUEN heading remains oversized '+density.whyHeading);
      if(density.worksHeading>(width<=767?35:47))
        failures.push(width+': WORKS ARCHIVE heading remains oversized '+density.worksHeading);
      if(width<=767 && density.serviceHeadings.some(sz=>sz>38))
        failures.push(width+': mobile service heading too large '+JSON.stringify(density.serviceHeadings));
      results.push({width,rows,density});
      if([390,1440].includes(width)){
        for(const id of ['why-luen','services','selected-content']){
          await page.locator('#'+id).screenshot({path:path.join(dir,id+'-'+width+'.jpg'),type:'jpeg',quality:72,animations:'disabled'});
        }
      }
      if(width===1440)await page.locator('#selected-content').screenshot({path:path.join(dir,'selected-content-1440.jpg'),type:'jpeg',quality:60});
    }catch(e){failures.push(width+': '+String(e.message).slice(0,280));}
    await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,results,failures},null,2));
console.log('LUEN_SECTION_ALIGNMENT_QA '+JSON.stringify({runs:results.length,failures:failures.length}));
for(const f of failures)console.error('LUEN_SECTION_ALIGNMENT_FAIL '+f);
if(failures.length)process.exitCode=1;
