// LUEN Cloudflare Pages — full-site launch gate, no form submissions.
// Runs after a successful preview deployment using Playwright Chromium.
// External GA is blocked to avoid inflating site analytics with automated visits.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE=(process.env.LUEN_QA_URL || 'https://luen-preview.pages.dev').replace(/\/$/,'');
const routes=[
  '/', '/about/', '/services/',
  '/services/japan-marketing/', '/services/japan-creator-marketing/',
  '/services/japan-inbound/', '/services/youtube-creator-marketing/',
  '/services/instagram-influencer-marketing/',
  '/cases/', '/cases/herahera-seoul-fnb/', '/cases/ikeda-edita/',
  '/cases/yuki-clinic/', '/cases/masubuchi-bibigo/',
  '/insights/', '/insights/how-to-choose-japan-marketing-agency/',
  '/insights/japan-inbound-creator-marketing/',
  '/insights/japan-influencer-marketing-cost/',
  '/insights/japan-youtuber-matching-guide/',
  '/insights/youtube-creator-marketing-metrics/',
  '/project-guide/', '/contact/', '/creators/masubuchi-sachiyo/'
];
// Verify every indexed public route is covered before browser QA starts.
// Do not silently skip newly added service/case/insight pages.
const sitemapUrls=[...fs.readFileSync(path.resolve('sitemap.xml'),'utf8')
  .matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const sitemapPaths=new Set(sitemapUrls
  .filter(url=>url.startsWith('https://luenkorea.com/'))
  .map(url=>new URL(url).pathname));
const uncovered=[...sitemapPaths].filter(route=>!routes.includes(route));
const unindexed=routes.filter(route=>!sitemapPaths.has(route));
if(uncovered.length||unindexed.length)throw new Error(
  'QA routes differ from sitemap: missing='+JSON.stringify(uncovered)+
  ', unindexed='+JSON.stringify(unindexed)
);
const configs=[
  {name:'desktop',width:1440,height:900},
  {name:'mobile',width:390,height:844},
  {name:'mobile-narrow',width:320,height:690}
];
const failures=[],warnings=[],pages=[],screenshots=path.resolve('qa-screenshots','launch-pages');
fs.mkdirSync(screenshots,{recursive:true});
const fail=(route,v,message)=>failures.push({route,viewport:v,message});
const warn=(route,v,message)=>warnings.push({route,viewport:v,message});
const browser=await chromium.launch({headless:true});
const navVisited=new Set();
const resourceFailures=new Map();
const fragments=new Map();
const uniqueLinks=new Map();
const safeName=route=>route==='/'?'home':route.slice(1,-1).replace(/\//g,'-');
try{
  for(const v of configs){
    const ctx=await browser.newContext({
      viewport:{width:v.width,height:v.height},reducedMotion:'reduce',deviceScaleFactor:1
    });
    // The site uses async GA4. We do not send synthetic pageviews or create
    // customer data while testing public navigation.
    await ctx.route(/https:\/\/(www\.)?googletagmanager\.com\//,route=>route.abort());
    await ctx.route(/https:\/\/(www\.)?google-analytics\.com\//,route=>route.abort());
    const page=await ctx.newPage();
    page.setDefaultTimeout(8000);
    for(const route of routes){
      const jsErrors=[],httpErrors=[];
      const onError=e=>jsErrors.push(String(e?.message||e).slice(0,220));
      const onResponse=r=>{
        const url=r.url();
        if(url.startsWith(BASE) && r.status()>=400)
          httpErrors.push({url:url.replace(BASE,''),status:r.status()});
      };
      page.on('pageerror',onError);page.on('response',onResponse);
      const started=Date.now();
      try{
        const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:35000});
        await page.locator('main#top').waitFor({state:'attached',timeout:13000});
        await page.waitForTimeout(230);
        const info=await page.evaluate(()=>{
          const main=document.querySelector('main#top');
          const pageWidth=document.documentElement.clientWidth;
          const h1=[...document.querySelectorAll('main h1')];
          const nav=document.querySelector('#nav');
          const hamburger=document.querySelector('#hamburger');
          const images=[...main.querySelectorAll('img')];
          const idCounts={};
          for(const el of document.querySelectorAll('[id]')){
            const id=el.id;idCounts[id]=(idCounts[id]||0)+1;
          }
          const brokenAnchors=[];
          const links=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
          for(const href of links){
            if(!href||href==='#'||href==='#top')continue;
            if(href.startsWith('#')&&!document.getElementById(decodeURIComponent(href.slice(1)))){
              brokenAnchors.push(href);
            }
          }
          const incompleteImages=images.filter(i=>i.complete && i.naturalWidth===0)
            .map(i=>(i.currentSrc||i.src).slice(0,130));
          const heroH1=h1[0]?.getBoundingClientRect();
          const titleStyle=h1[0]?getComputedStyle(h1[0]):null;
          const cta=[...main.querySelectorAll('a[href="/contact/"]')].filter(e=>e.getBoundingClientRect().width>0);
          return {
            title:document.title,
            h1Count:h1.length,h1Text:h1[0]?.textContent.trim().replace(/\s+/g,' ').slice(0,110),
            h1Visible:!!heroH1?.width && !!heroH1?.height && titleStyle?.visibility!=='hidden',
            mainHeight:main.getBoundingClientRect().height,
            bodyScrollWidth:document.body.scrollWidth,
            htmlScrollWidth:document.documentElement.scrollWidth,
            clientWidth:pageWidth,
            duplicates:Object.entries(idCounts).filter(([,v])=>v>1).slice(0,8),
            brokenAnchors:brokenAnchors.slice(0,8),
            totalImgs:images.length,incompleteImages,
            imgsWithoutAlt:images.filter(i=>!i.hasAttribute('alt')).length,
            navVisible:!!nav?.getBoundingClientRect().height,
            hamburgerVisible:!!hamburger && getComputedStyle(hamburger).display!=='none' && !!hamburger.getBoundingClientRect().width,
            contactLinks:cta.length,
            internalLinks:[...new Set(links.filter(h=>h && h.startsWith('/') && !h.startsWith('//')))]
          };
        });
        const status=response?.status()||0;
        const prefix='HTTP '+status+' / ';
        if(status!==200)fail(route,v.name,prefix+'Page did not return OK');
        if(info.h1Count!==1)fail(route,v.name,'Expected 1 H1, found '+info.h1Count);
        if(!info.h1Visible)fail(route,v.name,'Primary H1 is hidden or zero-sized');
        if(info.htmlScrollWidth>info.clientWidth+3)
          fail(route,v.name,'Horizontal HTML overflow: '+info.htmlScrollWidth+' > '+info.clientWidth);
        if(info.bodyScrollWidth>info.clientWidth+3)
          fail(route,v.name,'Horizontal BODY overflow: '+info.bodyScrollWidth+' > '+info.clientWidth);
        if(info.mainHeight<450)warn(route,v.name,'Unexpectedly short page: '+Math.round(info.mainHeight)+'px');
        if(!info.navVisible)fail(route,v.name,'Navigation missing/hidden');
        if(info.duplicates.length)fail(route,v.name,'Duplicate element IDs: '+JSON.stringify(info.duplicates));
        if(info.brokenAnchors.length)fail(route,v.name,'Broken in-page anchors: '+JSON.stringify(info.brokenAnchors));
        if(info.imgsWithoutAlt)warn(route,v.name,info.imgsWithoutAlt+' content images have no alt attribute');
        if(info.incompleteImages.length)fail(route,v.name,'Broken eagerly-loaded images: '+JSON.stringify(info.incompleteImages));
        if(jsErrors.length)fail(route,v.name,'JavaScript errors: '+JSON.stringify([...new Set(jsErrors)]));
        if(httpErrors.length)fail(route,v.name,'Same-origin resource HTTP errors: '+JSON.stringify(httpErrors));
        if(route!=='/contact/' && info.contactLinks<1)
          warn(route,v.name,'No obvious path to /contact/');
        if(!info.hamburgerVisible && v.width<=820)fail(route,v.name,'Mobile hamburger not visible');
        if(info.hamburgerVisible && v.width>820)warn(route,v.name,'Unexpected desktop hamburger');
        const key=route+'|'+v.name;
        if(v.width<=820){
          const hamburger=page.locator('#hamburger');
          if(await hamburger.isVisible()){
            await hamburger.click();
            const opened=await page.evaluate(()=>({
              open:document.querySelector('#mobileMenu')?.classList.contains('open'),
              expanded:document.querySelector('#hamburger')?.getAttribute('aria-expanded'),
              lock:document.body.style.overflow,
              closeVisible:!!document.querySelector('#mobileClose')?.getBoundingClientRect().width
            }));
            if(!opened.open||opened.expanded!=='true'||opened.lock!=='hidden'||!opened.closeVisible)
              fail(route,v.name,'Mobile navigation did not open: '+JSON.stringify(opened));
            await page.keyboard.press('Escape');
            const closed=await page.evaluate(()=>({
              open:document.querySelector('#mobileMenu')?.classList.contains('open'),
              expanded:document.querySelector('#hamburger')?.getAttribute('aria-expanded'),
              lock:document.body.style.overflow
            }));
            if(closed.open||closed.expanded!=='false'||closed.lock==='hidden')
              fail(route,v.name,'Mobile navigation did not close: '+JSON.stringify(closed));
          }
        }

        // The user-provided Instagram view screenshot must be served as real pixels
        // on both the creator profile and original bibigo case route.
        if(route==='/creators/masubuchi-sachiyo/'||route==='/cases/masubuchi-bibigo/'){
          const proof=page.locator('img[src="/assets/images/cases/masubuchi-bibigo-instagram-full.avif"]');
          if(await proof.count()!==1)fail(route,v.name,'Missing full Instagram Reel screenshot');
          else{
            await proof.scrollIntoViewIfNeeded();
            let dimensions;
            try{
              const handle=await page.waitForFunction(()=>{
                const img=document.querySelector('img[src="/assets/images/cases/masubuchi-bibigo-instagram-full.avif"]');
                return img&&img.complete&&img.naturalWidth>0
                  ? {width:img.naturalWidth,height:img.naturalHeight,complete:img.complete}
                  : false;
              },null,{timeout:12000});
              dimensions=await handle.jsonValue();
            }catch(_err){
              dimensions=await proof.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,complete:img.complete}));
            }
            if(!dimensions.complete||dimensions.width<600||dimensions.height<900)
              fail(route,v.name,'Instagram proof image did not decode: '+JSON.stringify(dimensions));
          }
        }

        // Supplied partner portrait is real and stays square on desktop / mobile.
        if(route==='/creators/masubuchi-sachiyo/'){
          const portrait=page.locator('.luen-profile-media img.luen-creator-portrait');
          if(await portrait.count()!==1) fail(route,v.name,'Masubuchi profile portrait missing');
          else{
            const state=await portrait.evaluate(async img=>{
              try{await img.decode()}catch(_){}
              const rect=img.getBoundingClientRect();
              return {naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,displayWidth:rect.width,displayHeight:rect.height};
            });
            if(state.naturalWidth<600||state.naturalHeight<600)
              fail(route,v.name,'Profile portrait did not load at 640px: '+JSON.stringify(state));
            if(Math.abs(state.displayWidth-state.displayHeight)>5)
              fail(route,v.name,'Profile portrait was distorted/cropped outside square: '+JSON.stringify(state));
          }
        }
        // The homepage partner feature also points to the supplied profile photo.
        if(route==='/'){
          const homePortrait=page.locator('.luen-creator-feature-media img.luen-creator-portrait');
          if(await homePortrait.count()!==1)fail(route,v.name,'Homepage partner portrait missing');
        }

        // Featured creator: load each local Instagram cover to catch missing assets,
        // and check the YouTube cover baseline without assuming every upload has maxres.
        if(route==='/creators/masubuchi-sachiyo/'){
          const reelGrid=page.locator('.luen-food-video-grid--short');
          const layout=await reelGrid.evaluate(grid=>{
            const cards=[...grid.querySelectorAll('.luen-food-video-card')];
            const columns=getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
            const positions=cards.map(card=>({top:card.getBoundingClientRect().top,left:card.getBoundingClientRect().left,width:card.getBoundingClientRect().width}));
            return {columns,positions};
          });
          const expectedColumns=v.width>820?4:2;
          if(layout.columns!==expectedColumns)
            fail(route,v.name,'Expected '+expectedColumns+' Instagram columns, found '+layout.columns);
          if(layout.positions.length===4 && expectedColumns===4 && Math.max(...layout.positions.map(p=>p.top))-Math.min(...layout.positions.map(p=>p.top))>3)
            fail(route,v.name,'Instagram Reels do not share one row: '+JSON.stringify(layout.positions));
          // One-page creator journey: inline case proof and in-page story links.
          const journey=await page.evaluate(()=>{
            const ids=['creator-identity','bibigo-feature','korea-food-content','brand-fit'];
            return {
              anchors:ids.map(id=>({id,exists:!!document.getElementById(id),top:document.getElementById(id)?.getBoundingClientRect().top||0})),
              bibigoMetric:document.querySelector('.luen-bibigo-full-screenshot img')?.getAttribute('alt')||'',
              oldExternalCaseLink:!!document.querySelector('a[href="/cases/masubuchi-bibigo/"]'),
              removedNote:document.querySelector('main')?.textContent.includes('위 항목은 LUEN의 제안 가능 분야이며')
            };
          });
          if(journey.anchors.some(x=>!x.exists)||journey.anchors.some((x,i)=>i>0 && x.top<=journey.anchors[i-1].top))
            fail(route,v.name,'Inline creator sections missing or out of sequence: '+JSON.stringify(journey.anchors));
          if(!journey.bibigoMetric?.includes('292.5만')||journey.oldExternalCaseLink||journey.removedNote)
            fail(route,v.name,'bibigo one-page integration/regression failed: '+JSON.stringify(journey));
          const igCovers=page.locator('.luen-food-video-grid--short img.luen-instagram-cover');
          const ytCovers=page.locator('.luen-food-video-grid--long img[data-youtube-video]');
          if(await igCovers.count()!==4)fail(route,v.name,'Expected 4 local Instagram cover images');
          if(await ytCovers.count()!==4)fail(route,v.name,'Expected 4 YouTube cover images');
          for(let k=0;k<await igCovers.count();k++){
            const el=igCovers.nth(k);
            await el.scrollIntoViewIfNeeded();
            // Images can be pending immediately after scrolling on a throttled
            // mobile viewport: wait for an actual decoded cover, not a microtask.
            let decoded;
            try{
              const handle=await page.waitForFunction(index=>{
                const img=document.querySelectorAll('.luen-food-video-grid--short img.luen-instagram-cover')[index];
                if(!img||!img.complete||img.naturalWidth===0)return false;
                return {src:img.currentSrc,complete:img.complete,width:img.naturalWidth,height:img.naturalHeight};
              },k,{timeout:12000});
              decoded=await handle.jsonValue();
            }catch(_err){
              decoded=await el.evaluate(img=>({src:img.currentSrc,complete:img.complete,width:img.naturalWidth,height:img.naturalHeight}));
            }
            if(!decoded.complete||decoded.width<200||decoded.height<200)
              fail(route,v.name,'Instagram cover '+(k+1)+' did not decode at usable size: '+JSON.stringify(decoded));
          }
          const firstYoutube=ytCovers.first();
          await firstYoutube.scrollIntoViewIfNeeded();
          await firstYoutube.evaluate(async img=>{try{await img.decode()}catch(_err){}});
          const youtubeInfo=await firstYoutube.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,quality:img.dataset.imageQuality||'hqdefault'}));
          if(youtubeInfo.width<320||youtubeInfo.height<180)
            fail(route,v.name,'YouTube cover too small: '+JSON.stringify(youtubeInfo));
        }
        // Screenshot first-fold of all core pages, plus critical detail pages.
        if(v.name!=='mobile-narrow' && (routes.indexOf(route)<13 || route==='/contact/'||route==='/project-guide/'||route==='/creators/masubuchi-sachiyo/')){
          const name=safeName(route)+'-'+v.name+'.jpg';
          await page.screenshot({path:path.join(screenshots,name),type:'jpeg',quality:69,animations:'disabled',timeout:16000});
        }
        if(v.name==='desktop'){
          for(const href of info.internalLinks){
            const address=href.split('#')[0].split('?')[0];
            if(!address || address.startsWith('/assets/'))continue;
            uniqueLinks.set(address,route);
          }
        }
        pages.push({route,viewport:v.name,status,loadMs:Date.now()-started,
          width:info.htmlScrollWidth,client:info.clientWidth,h1:info.h1Text,
          images:info.totalImgs,anchorsBroken:info.brokenAnchors,
          menuChecked:v.width<=820});
      }catch(e){
        fail(route,v.name,'Navigation or interaction exception: '+String(e.message).slice(0,300));
      }finally{
        page.removeListener('pageerror',onError);page.removeListener('response',onResponse);
      }
    }
    await ctx.close();
  }
  const context=await browser.newContext();
  const request=context.request;
  const links=[];
  for(const [href,origin] of uniqueLinks){
    let status=0;
    try{
      const response=await request.get(BASE+href,{timeout:20000,maxRedirects:4});
      status=response.status();
      if(status>=400)fail(origin,'internal-link',href+' returned HTTP '+status);
    }catch(e){fail(origin,'internal-link',href+' failed: '+String(e.message).slice(0,200));}
    links.push({href,origin,status});
  }
  await context.close();
  const report={base:BASE,checkedAt:new Date().toISOString(),routeCount:routes.length,
    testedPageViewportPairs:pages.length,checkedLinks:links.length,failures,warnings,pages,links};
  fs.writeFileSync(path.join(screenshots,'report.json'),JSON.stringify(report,null,2));
  console.log('LUEN_SUBPAGE_QA_SUMMARY '+JSON.stringify({
    pairs:pages.length,routes:routes.length,links:links.length,failures:failures.length,warnings:warnings.length
  }));
  for(const err of failures)console.log('LUEN_SUBPAGE_QA_FAIL '+JSON.stringify(err));
  for(const err of warnings)console.log('LUEN_SUBPAGE_QA_WARN '+JSON.stringify(err));
  if(process.env.GITHUB_STEP_SUMMARY){
    const rows=pages.map(p=>'| '+p.route+' | '+p.viewport+' | '+p.status+' | '+(p.width-p.client)+' px |').join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
      '\n## LUEN 20-route public-launch QA','',
      'No forms submitted. Customer login excluded from internal-link checks.','',
      '| Route | Viewport | HTTP | Overflow |','|---|---|---:|---:|',rows,'',
      '**Failures: '+failures.length+'; Warnings: '+warnings.length+'; Unique internal links: '+links.length+'**','',
      ...failures.map(e=>'- ❌ '+e.route+' / '+e.viewport+': '+e.message),
      ...warnings.map(e=>'- ⚠️ '+e.route+' / '+e.viewport+': '+e.message),'',
      'All screenshot and JSON details: qa-screenshots/launch-pages/'
    ].join('\n')+'\n');
  }
  if(failures.length)process.exitCode=1;
}finally{
  await browser.close();
}
