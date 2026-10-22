// Live browser QA against the isolated LUEN Cloudflare Pages development site.
// Non-destructive: never submits the contact form or writes to production.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.LUEN_QA_URL || 'https://luen-preview.pages.dev';
const failures = [], warnings = [], results = [];
const screenshots = path.join(process.cwd(), 'qa-screenshots');
fs.mkdirSync(screenshots, {recursive:true});
const browser = await chromium.launch({headless:true});
const widths = [
  {name:'desktop',width:1440,height:900},
  {name:'laptop',width:1280,height:800},
  {name:'tablet-landscape',width:1024,height:768},
  {name:'tablet-breakpoint',width:820,height:1180},
  {name:'tablet-portrait',width:768,height:1024},
  {name:'mobile-wide',width:430,height:932},
  {name:'mobile',width:390,height:844},
  {name:'mobile-small',width:360,height:740},
  {name:'mobile-narrow',width:320,height:650},
];
const serious=(where,message)=>failures.push({where,message});
const warn=(where,message)=>warnings.push({where,message});
const wrap=(fn)=>(...a)=>{try{return fn(...a);}catch(e){return null;}};
try {
  for(const v of widths) {
    const context = await browser.newContext({
      viewport:{width:v.width,height:v.height},
      deviceScaleFactor:1,
      reducedMotion:'reduce', // stable screenshots while respecting users' preference
    });
    const page = await context.newPage();
    const jsErrors = [], badResources = [];
    page.on('pageerror',err=>jsErrors.push(err.message.slice(0,230)));
    page.on('response',resp=>{
      if(resp.status()>=400 && resp.url().startsWith(BASE))
        badResources.push({status:resp.status(),url:resp.url().replace(BASE,'').slice(0,180)});
    });
    let response;
    const start = Date.now();
    try {
      response = await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('main#top').waitFor({state:'visible',timeout:20000});
      await page.waitForTimeout(900);
    }catch(e){
      serious(v.name,'Homepage load failed: '+String(e.message).slice(0,300));
      await context.close();
      continue;
    }
    const status=response?.status()||0;
    if(status!==200)serious(v.name,'Homepage returned HTTP '+status);
    const journey=await page.evaluate(()=>{
      const children=[...document.querySelectorAll('main#top > section')];
      return children.map(el=>el.id||[...el.classList][0]||'unknown');
    });
    const expectedJourney=['hero','brand-wall','cases','why-luen','services','selected-content',
      'partner-creators','content-flow','faq','contact'];
    if(JSON.stringify(journey)!==JSON.stringify(expectedJourney))
      serious(v.name,'Homepage decision journey out of order: '+JSON.stringify(journey));
    const mediaJourney=await page.evaluate(()=>{
      const work=document.querySelector('#work');
      return {insideGallery:!!work?.closest('section#selected-content'),
        clips:work?.querySelectorAll('.portfolio-card').length,
        reels:work?.querySelectorAll('.portfolio-card.portrait').length,
        caseCTA:!!document.querySelector('#cases .case-inquiry-v7 a[href="#contact"]')};
    });
    if(!mediaJourney.insideGallery||mediaJourney.clips!==12||mediaJourney.reels!==6||!mediaJourney.caseCTA)
      serious(v.name,'Separated campaign/gallery regression: '+JSON.stringify(mediaJourney));
    const doc=await page.evaluate(()=>{
      const html=document.documentElement, body=document.body, nav=document.querySelector('#nav');
      const logo=document.querySelector('#nav .logo-word');
      const main=document.querySelector('main#top');
      const titles=[...document.querySelectorAll('main#top h2.luen-section-primary-title')]
        .map(el=>({text:el.textContent.trim(),size:getComputedStyle(el).fontSize,
          color:getComputedStyle(el).color,visible:el.getBoundingClientRect().width>0}));
      const h1=[...document.querySelectorAll('h1')];
      const visibleCTA=[...document.querySelectorAll('.hero-cta a')].filter(a=>a.getBoundingClientRect().width>0);
      const viewportWidth=html.clientWidth;
      const overflowCandidates=[...main.querySelectorAll('.container,.hero-copy,.hero-layout,.contact-form,.case-support-grid-v7,.nav-inner')]
        .filter(e=>{if(e.classList.contains('portfolio-head'))return false; // intentional moving rail clone
          const r=e.getBoundingClientRect();return r.width>0 && (r.left < -6 || r.right > viewportWidth+6);})
        .slice(0,12).map(e=>({selector:e.className,left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)}));
      return {
        documentWidth:html.scrollWidth,clientWidth:viewportWidth,bodyWidth:body.scrollWidth,
        heroVisible:document.querySelector('.hero')?.getBoundingClientRect().height>0,
        h1Count:h1.length,h1Text:h1[0]?.textContent.trim().replace(/\s+/g,' '),
        titleCount:titles.length,titles,ctaCount:visibleCTA.length,
        logoColor:logo?getComputedStyle(logo).color:null,
        navHeight:nav?.getBoundingClientRect().height,
        images:document.querySelectorAll('img').length,
        selectedCards:document.querySelectorAll('.portfolio-card').length,
        originalPortfolioCards:document.querySelectorAll('.portfolio-viewport .loop-set:not(.loop-clone) .portfolio-card').length,
        loopCloneSets:document.querySelectorAll('.loop-clone').length,
        lazyImages:document.querySelectorAll('img[loading="lazy"]').length,
        htmlScrollBehavior:getComputedStyle(html).scrollBehavior,
        analyticsConfigured:Array.isArray(window.dataLayer) &&
          typeof window.gtag==='function' &&
          window.dataLayer.some(x=>x?.[0]==='config' && x?.[1]==='G-QXBK6XEK7G'),
        analyticsScriptAsync:(()=>{const s=document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
          return Boolean(s?.async);})(),
        overflowCandidates,
      };
    });
    const heroMotion=await page.evaluate(()=>{
      const scene=document.querySelector('[data-luen-motion]');
      const cards=Array.from(scene?.querySelectorAll('[data-motion-index]')||[]);
      const videoStates=cards.map(card=>{
        const v=card.querySelector('video');
        return {src:v?.getAttribute('src'),dataSrc:v?.getAttribute('data-src'),paused:v?.paused};
      });
      return {present:!!scene,cards:cards.length,active:cards.filter(c=>c.classList.contains('is-active')).length,
        mediaLoaded:videoStates.filter(s=>s.src).length,videoStates,
        stageOverflow:scene?Math.round(scene.getBoundingClientRect().right-document.documentElement.clientWidth):0,
        pauseText:scene?.querySelector('[data-motion-toggle]')?.textContent.trim()};
    });
    if(!heroMotion.present||heroMotion.cards!==3||heroMotion.active!==1)
      serious(v.name,'LUEN IN MOTION hero not present or invalid state: '+JSON.stringify(heroMotion));
    if(heroMotion.mediaLoaded!==0)
      serious(v.name,'Reduced-motion mode should not fetch hero MP4 automatically: '+JSON.stringify(heroMotion));
    // Verify the original-resolution MP4 bytes are served by Cloudflare and
    // manual selection sets a real video source. Some headless Chromium images
    // lack an H.264 decoder: do not classify a codec-only limitation as a file
    // quality defect, but report it explicitly instead of claiming decode success.
    if(v.name==='desktop'||v.name==='mobile'){
      const expected=[{w:406,h:720},{w:960,h:540},{w:406,h:720}];
      for(let i=0;i<3;i++){
        const card=page.locator('[data-motion-index="'+i+'"]');
        await card.scrollIntoViewIfNeeded();
        await card.click();
        const info=await card.locator('video').evaluate(video=>({
          src:video.getAttribute('src'),currentSrc:video.currentSrc,
          canPlay:video.canPlayType('video/mp4; codecs="avc1.4D401E"'),
          networkState:video.networkState,readyState:video.readyState,
          error:video.error?.code||0,
          width:video.videoWidth,height:video.videoHeight
        }));
        const requiredClipUrl=i===2?'clinic-preview.mp4?v=20261022-zero':'-preview.mp4?v=20261021-hq';
        if(!info.src||!info.src.includes(requiredClipUrl)){
          serious(v.name,'Hero video '+i+' did not receive an MP4 source on user click: '+JSON.stringify(info));
          continue;
        }
        const mp4Response=await context.request.get(BASE+info.src,{timeout:20000});
        const bytes=await mp4Response.body();
        if(mp4Response.status()>=400||bytes.length<180000||bytes.toString('ascii',4,8)!=='ftyp')
          serious(v.name,'Hero video '+i+' served invalid media: HTTP '+mp4Response.status()+' bytes '+bytes.length);
        let dimensions=null;
        try{
          const handle=await page.waitForFunction(idx=>{
            const vid=document.querySelector('[data-motion-index="'+idx+'"] video');
            return vid?.videoWidth>0&&vid?.videoHeight>0?{w:vid.videoWidth,h:vid.videoHeight}:false;
          },i,{timeout:4000});
          dimensions=await handle.jsonValue();
        }catch(_err){
          const details=await card.locator('video').evaluate(v=>({
            w:v.videoWidth,h:v.videoHeight,networkState:v.networkState,
            readyState:v.readyState,error:v.error?.code||0,
            canPlay:v.canPlayType('video/mp4; codecs="avc1.4D401E"')
          }));
          warn(v.name,'Headless media decoder unavailable/pending for clip '+i+
            '; CDN MP4 bytes verified independently: '+JSON.stringify(details));
        }
        if(dimensions && (dimensions.w<expected[i].w||dimensions.h<expected[i].h))
          serious(v.name,'Hero clip '+i+' decoded below original quality: '+JSON.stringify(dimensions));
      }
      await page.locator('[data-motion-toggle]').click();
    }

    if(heroMotion.stageOverflow>3)
      serious(v.name,'LUEN motion hero overflows viewport: '+heroMotion.stageOverflow+'px');
    if(!heroMotion.pauseText?.includes('재생'))
      serious(v.name,'Reduced-motion hero should present opt-in playback');
    if(doc.h1Count!==1)serious(v.name,'Expected exactly one H1, got '+doc.h1Count);
    if(!doc.analyticsConfigured || !doc.analyticsScriptAsync)serious(v.name,'GA4 config or async loader missing');
    if(doc.documentWidth>doc.clientWidth+3)serious(v.name,'Horizontal page overflow '+doc.documentWidth+'px > '+doc.clientWidth+'px');
    if(!doc.heroVisible || !doc.ctaCount)serious(v.name,'Hero or CTA is hidden');
    if(doc.titleCount!==5)serious(v.name,'Expected 5 home section H2 headings; found '+doc.titleCount);
    if(doc.originalPortfolioCards!==12)serious(v.name,'12 original Long Form/Reels cards were not preserved: '+doc.originalPortfolioCards);
    if(doc.loopCloneSets!==0)serious(v.name,'Reduced-motion created '+doc.loopCloneSets+' unnecessary marquee clones');
    if(doc.images>60)serious(v.name,'Unexpected image DOM bloat under reduced-motion: '+doc.images);
    if(doc.overflowCandidates.length)warn(v.name,'Some layout containers beyond viewport: '+JSON.stringify(doc.overflowCandidates));
    const isMobile=v.width<=820;
    if(isMobile){
      const hamburger=page.locator('#hamburger');
      if(!await hamburger.isVisible())serious(v.name,'Mobile menu button is not visible');
      else {
        await hamburger.click({timeout:8000}).catch(e=>serious(v.name,'Hamburger click failure: '+e.message.slice(0,180)));
        const opened=await page.evaluate(()=>({
          expanded:document.querySelector('#hamburger')?.getAttribute('aria-expanded'),
          menuOpen:document.querySelector('#mobileMenu')?.classList.contains('open'),
          scrollLocked:document.body.style.overflow,
          closeVisible:(()=>{const r=document.querySelector('#mobileClose')?.getBoundingClientRect();return Boolean(r?.width && r?.height)})()
        }));
        if(!opened.menuOpen || opened.expanded!=='true' || opened.scrollLocked!=='hidden' || !opened.closeVisible)
          serious(v.name,'Mobile menu failed to open/lock scroll: '+JSON.stringify(opened));
        if(v.name==='mobile')await page.screenshot({path:path.join(screenshots,'mobile-menu-390.jpg'),type:'jpeg',quality:72,animations:'disabled'});
        await page.keyboard.press('Escape');
        const closed=await page.evaluate(()=>({
          expanded:document.querySelector('#hamburger')?.getAttribute('aria-expanded'),
          menuOpen:document.querySelector('#mobileMenu')?.classList.contains('open'),
          scroll:document.body.style.overflow
        }));
        if(closed.menuOpen || closed.expanded!=='false' || closed.scroll==='hidden')
          serious(v.name,'Escape did not close menu/unlock scroll: '+JSON.stringify(closed));
      }
    }else{
      if(await page.locator('#hamburger').isVisible())warn(v.name,'Desktop shows hamburger unexpectedly');
    }
    // Capture first fold before scrolling.
    if(['desktop','tablet-portrait','mobile','mobile-narrow'].includes(v.name)){
      await page.screenshot({path:path.join(screenshots,v.name+'-first-fold.jpg'),type:'jpeg',quality:74,animations:'disabled'});
    }
    if(['desktop','mobile'].includes(v.name)){
      // Scroll to lazy-load the imagery and activate reveal observers.
      const total=await page.evaluate(()=>document.documentElement.scrollHeight);
      for(let y=0;y<total;y+=Math.max(450,Math.floor(v.height*.88))){
        await page.evaluate(y=>window.scrollTo(0,y),y);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(900);
      const imageAudit=await page.evaluate(()=>{
        const imgs=[...document.querySelectorAll('img')];
        const failed=imgs.filter(i=>i.complete && i.naturalWidth===0)
          .map(i=>i.currentSrc||i.src).slice(0,25);
        return {count:imgs.length,loaded:imgs.filter(i=>i.naturalWidth>0).length,failed};
      });
      if(imageAudit.failed.length)serious(v.name,'Broken images: '+JSON.stringify(imageAudit.failed));
      if(imageAudit.loaded<Math.floor(imageAudit.count*.7))warn(v.name,'Too few images loaded: '+JSON.stringify(imageAudit));
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.waitForTimeout(450);
      await page.screenshot({path:path.join(screenshots,v.name+'-full.jpg'),type:'jpeg',quality:62,fullPage:true,animations:'disabled'});
      doc.imageAudit=imageAudit;
    }
    if(jsErrors.length)serious(v.name,'JavaScript errors: '+JSON.stringify([...new Set(jsErrors)]));
    if(badResources.length)serious(v.name,'Failed same-origin resources: '+JSON.stringify([...new Map(badResources.map(x=>[x.url,x])).values()]));
    results.push({viewport:v.name,size:v.width+'×'+v.height,status,loadMs:Date.now()-start,...doc,errors:jsErrors,badResources});
    await context.close();
  }
  // Check actual internal routes, including case studies and service detail pages.
  const ctx=await browser.newContext();
  const p=await ctx.newPage();
  await p.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
  const links=await p.locator('a[href]').evaluateAll(all=>[...new Set(all.map(a=>a.getAttribute('href'))
     .filter(h=>h && h.startsWith('/') && !h.startsWith('//'))
     .map(h=>h.split('#')[0].split('?')[0]).filter(Boolean))]);
  const routes=[];
  for(const route of links.slice(0,45)){
    try{
      const response=await ctx.request.get(BASE+route,{timeout:20000,maxRedirects:4});
      routes.push({route,status:response.status()});
      if(response.status()>=400)serious('internal-links',route+' returned HTTP '+response.status());
    }catch(e){serious('internal-links',route+' request failed: '+e.message.slice(0,200))}
  }
  // Contact-form check: do not submit real customer information.
  const contact=await p.evaluate(()=>({
    hasForm:!!document.querySelector('#contactForm'),
    action:document.querySelector('#contactForm')?.action,
    requiredConsents:[...document.querySelectorAll('#contactForm input[type="checkbox"][required]')].length,
    hasStatus:!!document.querySelector('#copyStatus')
  }));
  if(!contact.hasForm || contact.requiredConsents!==2 || !contact.hasStatus)
    serious('contact-form','Contact form elements or consent controls missing: '+JSON.stringify(contact));
  // First FAQ is intentionally expanded on first load. Check BOTH toggle
  // directions instead of assuming a closed initial state.
  const faq=p.locator('.faq-q').first();
  if(await faq.count()){
    const initial=await faq.evaluate(e=>e.closest('.faq-item')?.classList.contains('open'));
    await faq.click();
    const afterFirst=await faq.evaluate(e=>({
      open:e.closest('.faq-item')?.classList.contains('open'),
      aria:e.getAttribute('aria-expanded')
    }));
    if(afterFirst.open===initial || afterFirst.aria!==String(afterFirst.open))
      serious('faq','FAQ initial click did not toggle state: '+JSON.stringify({initial,afterFirst}));
    await faq.click();
    const afterSecond=await faq.evaluate(e=>({
      open:e.closest('.faq-item')?.classList.contains('open'),
      aria:e.getAttribute('aria-expanded')
    }));
    if(afterSecond.open!==initial || afterSecond.aria!==String(afterSecond.open))
      serious('faq','FAQ second click did not restore state: '+JSON.stringify({initial,afterSecond}));
  }
  // Functional motion QA: thumbnails must actually move for normal users,
  // while reduced-motion mode must remain readable without animation.
  const motionAudit=[];
  for(const mode of ['no-preference','reduce']){
    const motionContext=await browser.newContext({
      viewport:{width:390,height:844},
      reducedMotion:mode
    });
    const motionPage=await motionContext.newPage();
    await motionPage.goto(BASE,{waitUntil:'load',timeout:60000});
    const strips=motionPage.locator('[data-loop-strip].portfolio-viewport');
    const count=await strips.count();
    if(count!==2)serious('portfolio-motion','Expected YouTube and Reels strips, found '+count);
    for(let i=0;i<count;i++){
      const strip=strips.nth(i);
      await strip.scrollIntoViewIfNeeded();
      await motionPage.waitForTimeout(550);
      const first=await strip.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
      await motionPage.waitForTimeout(600);
      const second=await strip.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
      const moved=first!==second;
      const label=i===0?'YouTube Long Form':'Instagram Reels';
      if(mode==='no-preference'&&!moved)
        serious('portfolio-motion',label+' marquee is static with motion enabled: '+first);
      if(mode==='reduce'&&moved)
        serious('portfolio-motion',label+' marquee moves even under reduced-motion: '+first+' → '+second);
      const cloneInfo=await strip.evaluate(e=>{
        const source=e.querySelector('.loop-set:not(.loop-clone)');
        const baseWidth=source?.getBoundingClientRect().width||0;
        const clones=e.querySelectorAll('.loop-clone').length;
        return {clones,baseWidth,viewportWidth:e.clientWidth,
          needed:Math.max(1,Math.ceil(e.clientWidth/baseWidth||0))};
      });
      if(mode==='reduce' && cloneInfo.clones!==0)
        serious('portfolio-motion',label+' has '+cloneInfo.clones+' unnecessary clones under reduced-motion');
      if(mode==='no-preference' && cloneInfo.clones!==cloneInfo.needed)
        serious('portfolio-motion',label+' has '+cloneInfo.clones+' clones but needs '+cloneInfo.needed);
      motionAudit.push({mode,label,moved,...cloneInfo});
    }
    await motionContext.close();
  }
  // Orbital hero QA: each clip's ended event rotates three upright cards
  // along their elliptical path by 120 degrees, instead of using a timer.
  // Dispatching ended avoids a codec dependency while testing the controller.
  const orbitContext=await browser.newContext({
    viewport:{width:1440,height:900},reducedMotion:'no-preference'
  });
  const orbitPage=await orbitContext.newPage();
  try{
    await orbitPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
    await orbitPage.locator('[data-luen-motion]').scrollIntoViewIfNeeded();
    await orbitPage.locator('[data-motion-index="0"]').click();
    for(let cycle=0;cycle<3;cycle++){
      const index=cycle%3;
      await orbitPage.locator('[data-motion-index="'+index+'"] video')
        .evaluate(video=>video.dispatchEvent(new Event('ended')));
      await orbitPage.waitForTimeout(1150);
      const orbitState=await orbitPage.evaluate(()=>{
        const cards=[...document.querySelectorAll('[data-luen-motion] [data-motion-index]')];
        const active=cards.findIndex(card=>card.classList.contains('is-active'));
        const angles=cards.map(card=>card.style.transform);
        return {active,angles,status:document.querySelector('[data-motion-status]')?.textContent,
          stageWidth:document.querySelector('.luen-motion-canvas')?.getBoundingClientRect().width,
          docWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
      });
      const expected=(index+1)%3;
      if(orbitState.active!==expected)
        serious('hero-orbit','End of clip '+index+' did not rotate to '+expected+': '+JSON.stringify(orbitState));
      if(new Set(orbitState.angles).size!==3||orbitState.docWidth>orbitState.viewport+3)
        serious('hero-orbit','Orbital placement missing/overflow: '+JSON.stringify(orbitState));
    }
  }catch(e){serious('hero-orbit','Orbit event test threw: '+String(e.message).slice(0,300));}
  finally{await orbitContext.close();}
  // Chromium user-agent simulation exercises LUEN's separate iOS loop code.
  // This is a JS-path smoke test, not a substitute for physical Safari QA.
  const iosAudit=[];
  const iphoneUserAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  for(const mode of ['no-preference','reduce']){
    const iosContext=await browser.newContext({
      viewport:{width:390,height:844},
      deviceScaleFactor:2,
      isMobile:true,hasTouch:true,
      userAgent:iphoneUserAgent,
      reducedMotion:mode
    });
    const iosPage=await iosContext.newPage();
    await iosPage.goto(BASE,{waitUntil:'load',timeout:60000});
    const pathEnabled=await iosPage.evaluate(()=>document.documentElement.classList.contains('ios-light-loops'));
    if(!pathEnabled)serious('ios-simulation','iOS-specific lightweight marquee controller did not initialize');
    const iosStrips=iosPage.locator('.portfolio-viewport');
    const iosCount=await iosStrips.count();
    if(iosCount!==2)serious('ios-simulation','Expected 2 iOS portfolio strips, found '+iosCount);
    for(let i=0;i<iosCount;i++){
      const strip=iosStrips.nth(i);
      await strip.scrollIntoViewIfNeeded();
      await iosPage.waitForTimeout(600);
      const first=await strip.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
      await iosPage.waitForTimeout(600);
      const second=await strip.locator('.loop-track').evaluate(e=>getComputedStyle(e).transform);
      const info=await strip.evaluate(e=>{
        const source=e.querySelector('.loop-set:not(.ios-loop-clone)');
        const width=source?.getBoundingClientRect().width||0;
        return {
          clones:e.querySelectorAll('.ios-loop-clone').length,
          needed:Math.max(1,Math.ceil(e.clientWidth/width||0)),
          viewportWidth:e.clientWidth,
          width
        };
      });
      const moved=first!==second;
      if(mode==='no-preference' && (!moved || info.clones!==info.needed))
        serious('ios-simulation','iOS motion/clone regression: '+JSON.stringify({mode,i,moved,...info}));
      if(mode==='reduce' && (moved || info.clones!==0))
        serious('ios-simulation','iOS reduced-motion regression: '+JSON.stringify({mode,i,moved,...info}));
      iosAudit.push({mode,strip:i===0?'YouTube':'Reels',moved,...info});
    }
    await iosContext.close();
  }
  results.push({internalLinkRoutes:routes,contact,faqChecked:true,motionAudit,iosAudit});
  console.log('LUEN_MOTION_QA '+JSON.stringify(motionAudit));
  console.log('LUEN_IOS_SIM_QA '+JSON.stringify(iosAudit));
  await ctx.close();
}catch(e){
  serious('test-harness','Unexpected exception: '+(e.stack||e.message).slice(0,900));
}finally{
  await browser.close();
  const report={base:BASE,timestamp:new Date().toISOString(),failures,warnings,results};
  fs.writeFileSync(path.join(screenshots,'qa-report.json'),JSON.stringify(report,null,2));
  console.log('LUEN_QA_SUMMARY '+JSON.stringify({
    viewports:results.filter(r=>r.viewport).map(r=>({viewport:r.viewport,size:r.size,
      documentWidth:r.documentWidth,clientWidth:r.clientWidth,titleCount:r.titleCount,selectedCards:r.selectedCards,
      imageAudit:r.imageAudit,originalPortfolioCards:r.originalPortfolioCards,
      loopCloneSets:r.loopCloneSets,images:r.images,loadMs:r.loadMs})),
    failed:failures.length,warnings:warnings.length,
    internalLinkRoutes:results.find(r=>r.internalLinkRoutes)?.internalLinkRoutes?.length,
  }));
  for(const f of failures)console.log('LUEN_QA_FAIL',JSON.stringify(f));
  for(const w of warnings)console.log('LUEN_QA_WARN',JSON.stringify(w));
  if(process.env.GITHUB_STEP_SUMMARY){
    const rows=results.filter(r=>r.viewport).map(r=>'| '+r.viewport+' | '+r.size+' | '+(r.documentWidth-r.clientWidth)+'px | '+r.titleCount+' | '+r.selectedCards+' |').join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
      '## LUEN live homepage QA','',
      'Target: '+BASE,'',
      '| Viewport | Size | Horizontal overflow | Section H2s | Portfolio cards |',
      '|---|---|---:|---:|---:|',rows,'',
      '**Failures:** '+failures.length+'  | **Warnings:** '+warnings.length,'',
      ...failures.map(f=>'- ❌ '+f.where+': '+f.message),'',
      ...warnings.map(f=>'- ⚠️ '+f.where+': '+f.message),'',
      'Screenshots and full JSON report attached as \`luen-live-qa-screenshots\`.'
    ].join('\n')+'\n');
  }
  if(failures.length)process.exitCode=1;
}
