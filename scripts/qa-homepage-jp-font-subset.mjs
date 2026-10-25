// Regression gate for *the same* Noto Sans JP family/weight with exact homepage glyphs.
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync('index.html','utf8');
const japanese=[...new Set(html.match(/[\u3040-\u30ff\u3400-\u9fff々〆ヵヶ]/g)||[])].sort().join('');
const matches=[...html.matchAll(/<link\b[^>]*href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]*Noto\+Sans\+JP[^"]*)"[^>]*>/g)].map(m=>m[1]);
const failures=[],out=[];
if(matches.length!==2)failures.push('Expected Noto Sans JP link and noscript fallback, observed '+matches.length);
for(const link of matches){const url=new URL(link);if(url.searchParams.get('text')!==japanese)failures.push('Noto Sans JP subset missing new homepage Japanese characters');}
if(html.includes('family=Inter:wght@400..800&family=Noto+Sans+JP'))failures.push('Legacy shared full-CJK stylesheet still included');
if(!html.includes('family=Inter:wght@400..800&display=swap'))failures.push('Inter missing');
if(japanese.length!==22)failures.push('Expected 22 production JP characters, observed '+japanese.length);
const texts=['#herahera-content-title','#case-ikeda h3','#case-yuki h3','#case-masubuchi h3'];
for(const [engine,browserType,width] of [['chromium',chromium,390],['webkit',webkit,390],['chromium',chromium,1440]]){
  const browser=await browserType.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,reducedMotion:'reduce'});
    // The control and candidate must not generate real GA4 analytics events.
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const pages=[];
    for(const port of [4173,4174]){
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
      await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load',timeout:50000});
      await page.locator('#cases').scrollIntoViewIfNeeded();
      await page.evaluate(async glyphs=>{
        await document.fonts.load('600 26px "Noto Sans JP"',glyphs);
        await document.fonts.ready;
      },japanese);
      const metrics=await page.evaluate(selectors=>selectors.map(selector=>{
        const el=document.querySelector(selector);
        if(!el)return null;
        const style=getComputedStyle(el);
        const canvas=document.createElement('canvas');
        const ctx=canvas.getContext('2d');
        ctx.font=style.font;
        return {selector,text:el.textContent.trim(),family:style.fontFamily,weight:style.fontWeight,
          fontSize:style.fontSize,measuredWidth:ctx.measureText(el.textContent.trim()).width,
          rectWidth:el.getBoundingClientRect().width,rectHeight:el.getBoundingClientRect().height};
      }),texts);
      const scrollOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      if(scrollOverflow>3)failures.push(engine+' '+width+' port '+port+' horizontal overflow '+scrollOverflow);
      if(errors.length)failures.push(engine+' '+width+' JavaScript '+JSON.stringify(errors));
      pages.push({page,metrics});
    }
    for(let i=0;i<texts.length;i++){
      const a=pages[0].metrics[i],b=pages[1].metrics[i];
      if(!a||!b){failures.push(engine+' '+width+' text element missing '+texts[i]);continue;}
      if(a.text!==b.text||a.family!==b.family||a.weight!==b.weight)
        failures.push(engine+' '+width+' copy/font family changed '+texts[i]);
      const widthChange=Math.abs(a.measuredWidth-b.measuredWidth);
      const tolerance=Math.max(2,a.measuredWidth*.012);
      if(widthChange>tolerance||Math.abs(a.rectHeight-b.rectHeight)>3)
        failures.push(engine+' '+width+' text geometry changed '+texts[i]+' '+JSON.stringify({control:a,optimized:b}));
    }
    const outDir='qa-screenshots/font-subset';
    fs.mkdirSync(outDir,{recursive:true});
    if(width===390){
      for(let i=0;i<pages.length;i++){
        await pages[i].page.locator('#cases').scrollIntoViewIfNeeded();
        await pages[i].page.screenshot({path:outDir+'/'+engine+'-'+(i?'subset':'original')+'.png',animations:'disabled'});
      }
    }
    out.push({engine,width,glyphCount:japanese.length,textChecks:4,measurements:pages[1].metrics.map(x=>({text:x?.text,width:x?.measuredWidth}))});
    for(const {page} of pages)await page.close();
    await context.close();
  }finally{await browser.close();}
}
console.log('LUEN_JP_FONT_VISUAL_REGRESSION '+JSON.stringify({cases:out,errors:failures}));
if(failures.length)process.exitCode=1;