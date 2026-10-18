// Compare one Instagram service page using existing full Pretendard font vs
// the same-family dynamic subset. No deployment, form submission or GA events.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
const root=process.cwd(),route='/services/instagram-influencer-marketing/';
const dir=path.resolve('qa-screenshots','instagram-font-ab');
fs.mkdirSync(dir,{recursive:true});
const fontFull='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css';
const fontSubset='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const candidate=fs.readFileSync(path.join(root,'services/instagram-influencer-marketing/index.html'),'utf8');
if(candidate.split(fontSubset).length!==2||candidate.includes(fontFull))
  throw Error('Only one dynamic-subset font stylesheet expected');
const control=candidate.replace(fontSubset,fontFull);
if(control.replace(fontFull,fontSubset)!==candidate)throw Error('A/B variant differs by more than font stylesheet URL');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml',
 '.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname===route){
   res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});
   res.end(url.searchParams.get('variant')==='control'?control:candidate);return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const st=fs.statSync(file),target=st.isDirectory()?path.join(file,'index.html'):file;
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(target).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const plans=[
 ['mobile-390','control',390,844],['mobile-390','subset',390,844],
 ['mobile-390','subset',390,844],['mobile-390','control',390,844],
 ['mobile-390','control',390,844],['mobile-390','subset',390,844],
 ['desktop-1440','control',1440,900],['desktop-1440','subset',1440,900]
];
const rows=[],problems=[];
try{
 for(const [i,[view,mode,width,height]] of plans.entries()){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  await ctx.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
  await ctx.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
  const page=await ctx.newPage();
  const cdp=await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const pending=new Map(),resources=[],errors=[];
  cdp.on('Network.responseReceived',({requestId,response,type})=>
   pending.set(requestId,{url:response.url,type,status:response.status}));
  cdp.on('Network.loadingFinished',({requestId,encodedDataLength})=>{
   if(pending.has(requestId))resources.push({...pending.get(requestId),bytes:encodedDataLength});
  });
  page.on('pageerror',err=>errors.push(err.message.slice(0,200)));
  try{
   const start=Date.now();
   const result=await page.goto(base+route+'?variant='+mode,{waitUntil:'load',timeout:55000});
   if(result?.status()!==200)throw Error('HTTP '+result?.status());
   await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(180);
   const visible=await page.evaluate(()=>{
    const rect=s=>{const r=document.querySelector(s)?.getBoundingClientRect();
     return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
    const texts=[...document.querySelectorAll('.instagram-plan-card')].map(e=>
      e.innerText.replace(/\s+/g,' ').slice(0,160));
    const topTitle=document.querySelector('main h1')?.innerText.replace(/\s+/g,' ').trim()||'';
    const lineHeights=[...document.querySelectorAll('main h1, main h2, .instagram-plan-card strong, .instagram-plan-card h3')]
      .map(e=>({text:e.textContent.trim().slice(0,65),
        height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}));
    return {
     topTitle,texts,lineHeights,
     hero:rect('.instagram-reels-hero'),cta:rect('.luen-page-hero .btn'),
     cards:[...document.querySelectorAll('.instagram-plan-card')].map(e=>({
      left:e.getBoundingClientRect().left,width:e.getBoundingClientRect().width,
      height:e.getBoundingClientRect().height})),
     documentWidth:document.documentElement.scrollWidth,
     fontFamily:getComputedStyle(document.body).fontFamily,
     loadedPretendard:document.fonts.check('16px "Pretendard Variable"'),
     loadedFonts:[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))].slice(0,20)
    };
   });
   const fonts=resources.filter(x=>x.type==='Font'||/\.(woff2?|ttf|otf)(?:\?.*)?$/i.test(x.url));
   const fontBytes=fonts.reduce((n,x)=>n+x.bytes,0);
   if(!fontBytes)problems.push(view+'/'+mode+' no font transfer data captured');
   if(visible.documentWidth>width+3)problems.push(view+'/'+mode+' horizontal overflow '+visible.documentWidth);
   if(visible.cards.length!==3)problems.push(view+'/'+mode+' lost one of 3 package cards');
   if(!visible.loadedPretendard)problems.push(view+'/'+mode+' Pretendard Variable failed to load');
   if(errors.length)problems.push(view+'/'+mode+' '+errors.join(';'));
   rows.push({i,view,mode,loadMs:Date.now()-start,fontBytes,fontCount:fonts.length,
     resourceBytes:resources.reduce((n,x)=>n+x.bytes,0),
     fcp:await page.evaluate(()=>performance.getEntriesByType('paint')
       .find(x=>x.name==='first-contentful-paint')?.startTime??null),
     visible});
   if((view==='desktop-1440')||(view==='mobile-390'&&i<2)){
    await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)});
    await page.screenshot({path:path.join(dir,view+'-'+mode+'.jpg'),type:'jpeg',quality:75,fullPage:true,animations:'disabled'});
   }
  }catch(e){problems.push(view+'/'+mode+' '+String(e.message).slice(0,300));}
  await ctx.close();
 }
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
const reference=rows.find(x=>x.view==='mobile-390'&&x.mode==='control')?.visible;
if(reference)for(const row of rows.filter(x=>x.mode==='subset')){
 const c=row.visible;
 if(c.topTitle!==reference.topTitle||c.texts.join('')!==reference.texts.join(''))
   problems.push(row.view+' text difference');
 if(row.view!=='mobile-390')continue;
 for(const [i,a] of reference.lineHeights.entries()){
  const b=c.lineHeights[i];if(!b||a.text!==b.text){problems.push('heading index changed '+i);continue;}
  if(Math.abs(a.height-b.height)>2||Math.abs(a.width-b.width)>2)
   problems.push('text sizing changed at '+i+': '+JSON.stringify({a,b}));
 }
 for(const [i,a] of reference.cards.entries()){
  const b=c.cards[i];if(!b||Math.abs(a.height-b.height)>2)
   problems.push('card height changed '+i+' '+JSON.stringify({a,b}));
 }
}
const median=a=>{const t=a.filter(Number.isFinite).sort((x,y)=>x-y),n=t.length;
 return n?(n%2?t[(n-1)/2]:(t[n/2-1]+t[n/2])/2):null;};
const summary=['control','subset'].map(mode=>{
 const r=rows.filter(x=>x.view==='mobile-390'&&x.mode===mode);
 return {mode,samples:r.length,fontBytes:median(r.map(x=>x.fontBytes)),
  fontCount:median(r.map(x=>x.fontCount)),loadMs:median(r.map(x=>x.loadMs)),
  resourceBytes:median(r.map(x=>x.resourceBytes)),fcp:median(r.map(x=>x.fcp))};
});
if(summary.some(r=>r.samples!==3)||rows.length!==8)problems.push('incomplete sample coverage '+rows.length);
console.log('LUEN_INSTAGRAM_FONT_AB_MEDIANS '+JSON.stringify(summary));
console.log('LUEN_INSTAGRAM_FONT_AB_GUARDS '+JSON.stringify({samples:rows.length,problems}));
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({summary,rows,problems},null,2));
if(problems.length)process.exitCode=1;
