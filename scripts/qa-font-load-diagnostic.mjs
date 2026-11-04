// No Lighthouse and no font files: isolate whether CI browser can load the
// official deferred Pretendard CSS on local and actual official LUEN pages.
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const local='http://127.0.0.1:4183/';
const output={};
const cjk='가나다라마바사아자차카타파하 서울 일본 한국 브랜드 마케팅';
for (const engine of [chromium,webkit]) {
 const browser=await engine.launch({headless:true});
 try {
  for(const [label,url] of Object.entries({local,production:'https://luenkorea.com/'})) {
   const context=await browser.newContext({viewport:{width:390,height:844}});
   const page=await context.newPage();
   const failures=[],responses=[];
   page.on('requestfailed',req=>{if(/font|jsdelivr|pretendard/.test(req.url()))failures.push({url:req.url().slice(0,180),error:req.failure()});});
   page.on('response',resp=>{if(/font|jsdelivr|pretendard/.test(resp.url()))responses.push({url:resp.url().slice(0,180),status:resp.status()});});
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
   await page.waitForTimeout(3000);
   const before=await page.evaluate(()=>({
    media:[...document.querySelectorAll('link[rel="stylesheet"]')].filter(x=>/pretendard/.test(x.href)).map(x=>({href:x.href,media:x.media,hasSheet:!!x.sheet})),
    faces:[...document.fonts].filter(x=>/Pretendard/i.test(x.family)).map(x=>({family:x.family,weight:x.weight,status:x.status})).slice(0,6),
    fontCount:[...document.fonts].filter(x=>/Pretendard/i.test(x.family)).length,
    bodyFont:getComputedStyle(document.body).fontFamily,
    titleFont:getComputedStyle(document.querySelector('.hero h1')).fontFamily
   }));
   const loaded=await page.evaluate(async text=>{
    const loaded=await document.fonts.load('400 16px "Pretendard Variable"',text);
    await document.fonts.ready;
    return {count:loaded.length,fonts:loaded.slice(0,5).map(f=>({family:f.family,status:f.status,weight:f.weight})),
      check:document.fonts.check('400 16px "Pretendard Variable"',text)};
   },cjk);
   const after=await page.evaluate(()=>({
    facesLoaded:[...document.fonts].filter(x=>/Pretendard/i.test(x.family)&&x.status==='loaded').length,
    fontResources:performance.getEntriesByType('resource').filter(x=>/woff2?|font|jsdelivr|pretendard/.test(x.name)).map(x=>({url:x.name.slice(0,180),duration:Math.round(x.duration)})).slice(0,35)
   }));
   output[engine.name()+'-'+label]={before,loaded,after,failures:failures.slice(0,15),responses:responses.slice(0,15)};
   await context.close();
  }
 }finally{await browser.close();}
}
console.log('LUEN_PRETENDARD_LIVE_FONT_DIAGNOSTIC '+JSON.stringify(output));
fs.mkdirSync('qa-screenshots/font-diagnostic',{recursive:true});
fs.writeFileSync(path.join('qa-screenshots/font-diagnostic','result.json'),JSON.stringify(output,null,2));
