// LUEN isolated Pretendard A/B: dynamic subsets vs single variable file.
// Both variants use the same HTML/CSS/JS, except two occurrences of the
// Pretendard CDN link. Does not deploy or submit user data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';

const root=process.cwd(),dir=path.resolve('qa-screenshots','font-ab');
fs.mkdirSync(dir,{recursive:true});
const candidateUrl='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css';
const baselineUrl='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const candidateHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(candidateHtml.split(candidateUrl).length!==3)throw Error('Expected precisely two experimental font links');
const baselineHtml=candidateHtml.split(candidateUrl).join(baselineUrl);
if(baselineHtml.replaceAll(baselineUrl,candidateUrl)!==candidateHtml)
  throw Error('Baseline must differ from candidate by CDN font URL only');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){
      res.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'});
      res.end(url.searchParams.get('font-ab')==='baseline'?baselineHtml:candidateHtml);return;
    }
    const resolved=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!resolved.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const st=fs.statSync(resolved);
    const file=st.isDirectory()?path.join(resolved,'index.html'):resolved;
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,base='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true});
const plans=[
  {width:390,height:844,mode:'baseline'},{width:390,height:844,mode:'candidate'},
  {width:390,height:844,mode:'candidate'},{width:390,height:844,mode:'baseline'},
  {width:390,height:844,mode:'baseline'},{width:390,height:844,mode:'candidate'},
  {width:1440,height:900,mode:'baseline'},{width:1440,height:900,mode:'candidate'}
];
const rows=[],failures=[],warnings=[];
try{
 for(const [index,plan] of plans.entries()){
  const ctx=await browser.newContext({
    viewport:{width:plan.width,height:plan.height},reducedMotion:'reduce',
    deviceScaleFactor:1
  });
  // Prevent synthetic GA hits and remove unchanged third-party JS noise.
  await ctx.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
  await ctx.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
  const page=await ctx.newPage();
  const cdp=await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const requestData=new Map(),loadData=[];
  cdp.on('Network.responseReceived',({requestId,response,type})=>{
    requestData.set(requestId,{url:response.url,type,status:response.status});
  });
  cdp.on('Network.loadingFinished',({requestId,encodedDataLength})=>{
    const e=requestData.get(requestId);
    if(e)loadData.push({...e,encodedDataLength});
  });
  const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message.slice(0,180)));
  const start=Date.now();
  try{
    const response=await page.goto(base+'/?font-ab='+plan.mode,{waitUntil:'load',timeout:70000});
    if(response?.status()!==200)throw Error('HTTP '+response?.status());
    // Both variants have the same content and loading behavior. A browser
    // paint-only comparison without waiting for fonts can hide glyph shifts.
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(250);
    const ui=await page.evaluate(()=>{
      const getRect=e=>{const r=e?.getBoundingClientRect();
        return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null};
      const headings=[...document.querySelectorAll('main h1,main h2.luen-section-primary-title')];
      const imgs=[...document.querySelectorAll('.creator-profile-card img')];
      const phrase=document.querySelector('main h1')?.textContent.replace(/\s+/g,' ').trim();
      const fontCandidates=[...document.fonts].map(f=>({family:f.family,status:f.status}))
        .filter(f=>f.status==='loaded').slice(0,90);
      return {
        phrase,bodyFont:getComputedStyle(document.body).fontFamily,
        headRects:headings.map(getRect),
        ctaRect:getRect(document.querySelector('.hero-cta a')),
        heroRect:getRect(document.querySelector('.hero')),
        headingCount:headings.length,
        profileImages:imgs.length,displayWidth:document.documentElement.scrollWidth,
        fontLoadedFamilies:[...new Set(fontCandidates.map(f=>f.family))],
        fcp:performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint')?.startTime??null,
        pageLoad:performance.getEntriesByType('navigation')[0]?.loadEventEnd??null
      };
    });
    if(ui.displayWidth>plan.width+2)failures.push(plan.mode+': page overflow '+ui.displayWidth);
    if(ui.headingCount!==7||ui.profileImages<5)failures.push(plan.mode+': critical content missing');
    if(jsErrors.length)failures.push(plan.mode+': JS '+jsErrors.join(';'));
    const fontItems=loadData.filter(x=>x.type==='Font'||/\.(woff2?|ttf|otf)(?:\?.*)?$/i.test(x.url));
    const fontBytes=fontItems.reduce((n,x)=>n+x.encodedDataLength,0);
    const gfonts=loadData.filter(x=>x.url.includes('fonts.googleapis.com'));
    const allBytes=loadData.reduce((n,x)=>n+x.encodedDataLength,0);
    rows.push({index,viewport:plan.width,mode:plan.mode,elapsedMs:Date.now()-start,
      fontRequests:fontItems.length,fontTransferBytes:fontBytes,
      fontCssTransferBytes:gfonts.reduce((n,x)=>n+x.encodedDataLength,0),
      totalTransferBytes:allBytes,ui});
    if((plan.width===390&&index<2)||(plan.width===1440)){
      await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});
      await page.screenshot({path:path.join(dir,plan.mode+'-'+plan.width+'.jpg'),
        type:'jpeg',quality:75,animations:'disabled'});
    }
  }catch(e){failures.push(plan.mode+'/'+plan.width+': '+String(e.message).slice(0,300))}
  await ctx.close();
 }
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
const median=nums=>{
 const arr=nums.filter(Number.isFinite).sort((a,b)=>a-b);
 return !arr.length?null:arr.length%2?arr[(arr.length-1)/2]:(arr[arr.length/2-1]+arr[arr.length/2])/2;
};
const medians=['baseline','candidate'].map(mode=>{
 const items=rows.filter(r=>r.mode===mode&&r.viewport===390);
 return {mode,samples:items.length,fontRequests:median(items.map(x=>x.fontRequests)),
  fontTransferBytes:median(items.map(x=>x.fontTransferBytes)),
  totalTransferBytes:median(items.map(x=>x.totalTransferBytes)),
  fcp:median(items.map(x=>x.ui.fcp)),
  load:median(items.map(x=>x.ui.pageLoad))};
});
const baseline=rows.find(r=>r.mode==='baseline'&&r.viewport===390)?.ui;
if(baseline){
 for(const r of rows.filter(x=>x.mode==='candidate')){
  const other=r.ui;
  if(other.phrase!==baseline.phrase||other.headingCount!==baseline.headingCount)
    failures.push('Heading text/count changed for candidate '+r.viewport);
  if(other.bodyFont!==baseline.bodyFont)
    failures.push('Computed body font changed for candidate '+r.viewport);
  // Only compare mobile-to-mobile, not different-width desktop coordinates.
  if(r.viewport!==390)continue;
  for(const [i,br] of baseline.headRects.entries()){
   const cr=other.headRects[i];
   if(!br||!cr)continue;
   if(Math.abs(br.height-cr.height)>2||Math.abs(br.width-cr.width)>2)
     failures.push('Heading layout changed at '+i+': '+JSON.stringify({baseline:br,candidate:cr}));
  }
  if(baseline.ctaRect&&other.ctaRect&&
   (Math.abs(baseline.ctaRect.width-other.ctaRect.width)>2||
    Math.abs(baseline.ctaRect.height-other.ctaRect.height)>2))
    failures.push('CTA sizing changed between font loading modes');
 }
}
if(medians.some(m=>m.samples!==3))failures.push('Expected 3 samples per font mode');
const baseMed=medians[0],candMed=medians[1];
const recommendation=baseMed.fontTransferBytes!==null&&candMed.fontTransferBytes!==null?
  (candMed.fontTransferBytes<=baseMed.fontTransferBytes*.9?'candidate-lower-font-transfer':
   candMed.fontTransferBytes>=baseMed.fontTransferBytes*1.1?'candidate-higher-font-transfer':'similar-font-transfer'):'undetermined';
const report={medians,recommendation,rows,failures,warnings};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
console.log('LUEN_FONT_AB_MEDIANS '+JSON.stringify({medians,recommendation}));
console.log('LUEN_FONT_AB_GUARDS '+JSON.stringify({rows:rows.length,failures:failures.length,warnings:warnings.length}));
failures.forEach(f=>console.error('LUEN_FONT_AB_FAIL '+f));
if(failures.length)process.exitCode=1;
