// LUEN typo-parity QA, read-only CI-only temporary derived font.
// Unlike ResourceTiming (which can omit third-party WOFF2), count actual
// network response events AND loaded FontFace objects.
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';

const urls={baseline:'http://127.0.0.1:4183/',candidate:'http://127.0.0.1:4184/'};
const selectors=['body','main .hero h1','.hero-desc','#cases-title','#case-herahera h3','#case-ikeda h3','#case-yuki h3','#case-masubuchi h3','#services-title','#contact h2'];
const sampleTexts=[
 '누구와 함께할지부터, 무엇을 만들지까지.',
 '브랜드 크리에이터 한국 일본',
 '크리에이터 채널 규모 172만 구독자',
 '헤라헤라 삼총사 서울 F&B',
 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
 'ヘラヘラ三銃士 美容看護師 池田真子'
];
const results=[],failures=[];
const round=v=>Math.round(v*100)/100;

for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1440]){
   const pages={};
   for(const variant of Object.keys(urls)){
    const context=await browser.newContext({viewport:{width,height:940},reducedMotion:'reduce'});
    const page=await context.newPage();
    const fontResponses=[],networkFailures=[];
    page.on('response',resp=>{
      if(/\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(resp.url()))
        fontResponses.push({url:resp.url(),status:resp.status()});
    });
    page.on('requestfailed',request=>{
      if(/woff|pretendard|fonts\.googleapis/i.test(request.url()))
        networkFailures.push({url:request.url().slice(0,130),message:request.failure()});
    });
    await page.goto(urls[variant],{waitUntil:'domcontentloaded',timeout:50000});
    // The original CSS intentionally uses media=print until loaded.
    await page.waitForFunction(()=>{
      const link=document.querySelector('link[href*="pretendardvariable-dynamic-subset.min.css"]');
      return !!link&&link.media==='all'&&!!link.sheet;
    },null,{timeout:35000});
    const samples=await page.evaluate(async({sampleTexts,selectors})=>{
      // Load both regular and bold for all test glyphs, *after* CDN CSS is ready.
      const text=sampleTexts.join(' ');
      const loadedRegular=await document.fonts.load('400 16px "Pretendard Variable"',text);
      const loadedBold=await document.fonts.load('700 24px "Pretendard Variable"',text);
      await document.fonts.ready;
      const c=document.createElement('canvas').getContext('2d');
      const widths=sampleTexts.map(text=>{
        c.font='400 16px "Pretendard Variable"'; const regular=c.measureText(text).width;
        c.font='700 24px "Pretendard Variable"'; const bold=c.measureText(text).width;
        return {text,regular,bold};
      });
      const nodes=selectors.map(sel=>{
        const e=document.querySelector(sel);
        if(!e)return {selector:sel,missing:true};
        const rect=e.getBoundingClientRect(),cs=getComputedStyle(e);
        return {selector:sel,text:e.textContent.trim(),fontFamily:cs.fontFamily,
          width:rect.width,height:rect.height,scrollHeight:e.scrollHeight,
          fontWeight:cs.fontWeight,lineHeight:cs.lineHeight};
      });
      return {
        loadedRegular:loadedRegular.length,loadedBold:loadedBold.length,
        liveFontFaces:[...document.fonts].filter(f=>/Pretendard/i.test(f.family)&&f.status==='loaded').length,
        allPretendardFaces:[...document.fonts].filter(f=>/Pretendard/i.test(f.family)).length,
        browserText:widths,nodes,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
      };
    },{sampleTexts,selectors});
    // DOM settles after forced font loading; capture actual final geometries.
    samples.nodes=await page.evaluate(selectors=>selectors.map(sel=>{
      const e=document.querySelector(sel);if(!e)return {selector:sel,missing:true};
      const rect=e.getBoundingClientRect(),cs=getComputedStyle(e);
      return {selector:sel,text:e.textContent.trim(),fontFamily:cs.fontFamily,
        width:rect.width,height:rect.height,scrollHeight:e.scrollHeight,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight};
    }),selectors);
    const loadedFiles=fontResponses.filter(r=>r.status===200);
    pages[variant]={samples,fontResponses:loadedFiles,networkFailures};
    await context.close();
   }
   const base=pages.baseline,cand=pages.candidate,problems=[];
   if(!base.samples.liveFontFaces||base.fontResponses.length<2)
     problems.push('baseline official Pretendard font downloads not confirmed');
   if(!cand.samples.liveFontFaces||!cand.fontResponses.some(r=>r.url.includes('pretendard-home-CI-ONLY.woff2')))
     problems.push('candidate temporary subset download not confirmed');
   if(base.networkFailures.length||cand.networkFailures.length)
     problems.push('font networking failed during comparison');
   if(base.samples.overflow>2||cand.samples.overflow>2)problems.push('horizontal overflow');
   for(let i=0;i<sampleTexts.length;i++){
    const x=base.samples.browserText[i],y=cand.samples.browserText[i];
    if(Math.abs(x.regular-y.regular)>1||Math.abs(x.bold-y.bold)>1)
      problems.push('canvas glyph width changed: '+x.text);
   }
   for(let i=0;i<selectors.length;i++){
    const x=base.samples.nodes[i],y=cand.samples.nodes[i];
    if(x.missing||y.missing){problems.push('missing element '+selectors[i]);continue;}
    // Whole-document height includes asynchronously loading images and videos;
    // a few pixels over an 8000px page are not a typography regression.
    // All actual editorial text elements must still match within 2px.
    const heightTolerance=selectors[i]==='body'?12:2;
    if(x.text!==y.text||x.fontFamily!==y.fontFamily||x.fontWeight!==y.fontWeight||
       Math.abs(x.width-y.width)>2||Math.abs(x.height-y.height)>heightTolerance)
      problems.push('text geometry differs: '+selectors[i]+' ('+round(x.height)+' → '+round(y.height)+')');
   }
   const result={engine:engine.name(),width,
     baselineLoadedFaces:base.samples.liveFontFaces,
     candidateLoadedFaces:cand.samples.liveFontFaces,
     baselineFontResponses:base.fontResponses.length,
     candidateFontResponses:cand.fontResponses.length,
     subsetResponseCount:cand.fontResponses.filter(r=>r.url.includes('pretendard-home-CI-ONLY.woff2')).length,
     problems};
   results.push(result);
   failures.push(...problems.map(p=>engine.name()+'/'+width+': '+p));
   console.log('LUEN_FONT_PARITY_CHECK '+JSON.stringify(result));
  }
 }finally{await browser.close();}
}
const result={result:'font sizes and geometry only; not pixel-art or real-device QA',
              cases:results.length,failures,results};
console.log('LUEN_FONT_PARITY_SUMMARY '+JSON.stringify(result));
fs.mkdirSync('qa-screenshots/font-parity',{recursive:true});
fs.writeFileSync('qa-screenshots/font-parity/result.json',JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;
