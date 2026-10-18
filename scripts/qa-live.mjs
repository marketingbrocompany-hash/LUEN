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
      const overflowCandidates=[...main.querySelectorAll('.container,.hero-copy,.hero-layout,.contact-form,.case-support-grid-v7,.portfolio-head,.nav-inner')]
        .filter(e=>{const r=e.getBoundingClientRect();return r.width>0 && (r.left < -6 || r.right > viewportWidth+6);})
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
        htmlScrollBehavior:getComputedStyle(html).scrollBehavior,
        overflowCandidates,
      };
    });
    if(doc.h1Count!==1)serious(v.name,'Expected exactly one H1, got '+doc.h1Count);
    if(doc.documentWidth>doc.clientWidth+3)serious(v.name,'Horizontal page overflow '+doc.documentWidth+'px > '+doc.clientWidth+'px');
    if(!doc.heroVisible || !doc.ctaCount)serious(v.name,'Hero or CTA is hidden');
    if(doc.titleCount!==6)serious(v.name,'Expected 6 home section H2 headings; found '+doc.titleCount);
    if(doc.selectedCards<10)serious(v.name,'Long/short form portfolio rail has only '+doc.selectedCards+' cards');
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
  const faq=p.locator('.faq-q').first();
  if(await faq.count()){
    await faq.click();
    const opened=await faq.evaluate(e=>e.closest('.faq-item')?.classList.contains('open'));
    if(!opened)serious('faq','FAQ did not open on click');
  }
  results.push({internalLinkRoutes:routes,contact,faqChecked:true});
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
      imageAudit:r.imageAudit,loadMs:r.loadMs})),
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
