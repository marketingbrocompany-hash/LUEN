// Offline PR QA for alternative mobile WebP resources. Never sends a form.
import {chromium, webkit} from 'playwright';
import fs from 'node:fs';
const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const names=['herahera-highres-thumbnail','japan-beauty-creator-marketing-case-01','korea-clinic-marketing-case-02','korea-food-marketing-case-04'];
const result=[],errors=[];
for(const [name,type,viewport,dpr] of [
  ['iPhone390',webkit,{width:390,height:844},2],
  ['iPhone320',webkit,{width:320,height:720},2],
  ['Android390',chromium,{width:390,height:844},2],
  ['desktop1440Retina',chromium,{width:1440,height:900},2]
]){
  const b=await type.launch({headless:true});
  try{
    const page=await b.newPage({viewport,deviceScaleFactor:dpr});
    await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:50000});
    const rows=[];
    for(const basename of names){
      const selector='#cases img[src*="'+basename+'.webp"]';
      const img=page.locator(selector);
      if(await img.count()!==1){errors.push(name+' '+basename+' not exactly one image');continue;}
      await img.scrollIntoViewIfNeeded();
      const state=await img.evaluate(async(el)=>{
        if(!el.complete)await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('Image load timeout')),14000);
          el.addEventListener('load',()=>{clearTimeout(timer);resolve()},{once:true});
          el.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Image load failed'))},{once:true});
        });
        return {currentSrc:el.currentSrc,complete:el.complete,naturalWidth:el.naturalWidth,
          naturalHeight:el.naturalHeight,sourceCount:(el.srcset||'').split(',').length};
      });
      const selectedMobile=state.currentSrc.includes('-mobile.webp');
      if(!state.complete||state.naturalWidth===0||state.sourceCount!==2)
        errors.push(name+' '+basename+' bad source/dimensions '+JSON.stringify(state));
      if(viewport.width<=390&&!selectedMobile)
        errors.push(name+' '+basename+' mobile did not load compact resource '+JSON.stringify(state));
      if(viewport.width>1000&&selectedMobile)
        errors.push(name+' '+basename+' high DPR desktop unexpectedly picked mobile '+JSON.stringify(state));
      rows.push({basename,selectedMobile,naturalWidth:state.naturalWidth});
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(overflow>3)errors.push(name+' horizontal overflow '+overflow);
    result.push({name,dpr,viewport:viewport.width,overflow,images:rows});
    await page.close();
  }finally{await b.close();}
}
console.log('LUEN_CASE_RESPONSIVE_IMAGE_QA '+JSON.stringify({runs:result.length,result,errors}));
if(errors.length)process.exitCode=1;
