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
      results.push({width,rows});
      if(width===1440)await page.locator('#selected-content').screenshot({path:path.join(dir,'selected-content-1440.jpg'),type:'jpeg',quality:60});
    }catch(e){failures.push(width+': '+String(e.message).slice(0,280));}
    await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({target:base,results,failures},null,2));
console.log('LUEN_SECTION_ALIGNMENT_QA '+JSON.stringify({runs:results.length,failures:failures.length}));
for(const f of failures)console.error('LUEN_SECTION_ALIGNMENT_FAIL '+f);
if(failures.length)process.exitCode=1;
