// PR #243: verify Claude's new homepage + About/Services/Insights design at
// mobile/tablet/desktop breakpoints. Static local server; no form submissions.
// Any SVG sprite icon must have a viewBox and resolve to an actual drawing.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=path.resolve('qa-screenshots','integrated-visual-system');
fs.mkdirSync(output,{recursive:true});
const failures=[],results=[];
const targets=[
  {url:'/',title:'LUEN WORKS ARCHIVE'},
  {url:'/about/',title:'크리에이터를'},
  {url:'/services/',title:'목표가 다르면'},
  {url:'/insights/',title:'검색을 위한'}
];
const sizes=[
  {name:'mobile-320',width:320,height:700},
  {name:'mobile-390',width:390,height:844},
  {name:'mobile-430',width:430,height:932},
  {name:'boundary-720',width:720,height:900},
  {name:'boundary-740',width:740,height:900},
  {name:'boundary-767',width:767,height:1024},
  {name:'tablet-768',width:768,height:1024},
  {name:'tablet-820',width:820,height:1024},
  {name:'desktop-1440',width:1440,height:900}
];
for(const engine of [{name:'chromium',type:chromium,sizes},{name:'webkit',type:webkit,sizes:sizes.filter(s=>[390,740,767,820].includes(s.width))}]){
  const browser=await engine.type.launch({headless:true});
  try{
    for(const size of engine.sizes){
      const context=await browser.newContext({
        viewport:{width:size.width,height:size.height},reducedMotion:'reduce',
        deviceScaleFactor:1,isMobile:size.width<=430,hasTouch:size.width<=430
      });
      await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
      const page=await context.newPage();
      page.on('pageerror',e=>failures.push(engine.name+'/'+size.name+': JS '+e.message.slice(0,180)));
      for(const target of targets){
        const label=engine.name+'/'+size.name+target.url;
        try{
          const response=await page.goto(base+target.url,{waitUntil:'load',timeout:45000});
          if(response?.status()!==200)throw Error('HTTP '+response?.status());
          const report=await page.evaluate(route=>{
            const sel=q=>document.querySelector(q);
            const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right}};
            const svgs=[...document.querySelectorAll('.lv-icon-tile svg')];
            const icons=svgs.map(e=>{
              let b;
              try{b=e.getBBox();}catch{return {viewBox:e.getAttribute('viewBox'),bboxW:-1,bboxH:-1}}
              return {viewBox:e.getAttribute('viewBox'),bboxW:b.width,bboxH:b.height,renderW:rect(e).w,renderH:rect(e).h};
            });
            const flow=sel('.luen-flow-list-timeline');
            const items=flow?[...flow.querySelectorAll(':scope > li')].map(rect):[];
            const covers=[...document.querySelectorAll('.insight-card-cover')];
            const archive=sel('.works-archive-title');
            return {
              route,
              overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
              width:innerWidth,
              why:document.querySelectorAll('.luen-why-row').length,
              archive:archive?.textContent?.trim(),
              archiveRect:rect(archive),
              flowItems:items,
              flowOverflow:flow?flow.scrollWidth-flow.clientWidth:null,
              aboutBridgeArrows:document.querySelectorAll('.about-bridge-arrow svg').length,
              icons,
              covers:covers.length,
              coverWidths:covers.map(c=>rect(c).w),
              mainH1:document.querySelector('h1')?.textContent?.trim()||''
            };
          },target.url);
          if(report.overflow>3)failures.push(label+': page overflow '+report.overflow+'px');
          if(target.url==='/'){
            if(report.why!==3||report.flowItems.length!==4||report.archive!=='LUEN WORKS ARCHIVE')failures.push(label+': missing homepage design '+JSON.stringify({why:report.why,flow:report.flowItems.length,archive:report.archive}));
            if(report.archiveRect?.right>size.width+3)failures.push(label+': archive heading clipped '+JSON.stringify(report.archiveRect));
            if(report.flowOverflow>3)failures.push(label+': timeline overflow '+report.flowOverflow);
            if(size.width<=720&&Math.abs(report.flowItems[1]?.x-report.flowItems[0]?.x)>4)failures.push(label+': expected vertical timeline at <=720');
          }
          if(target.url==='/about/'&& (report.aboutBridgeArrows!==2||report.icons.length!==9))failures.push(label+': missing About visuals '+JSON.stringify({arrows:report.aboutBridgeArrows,icons:report.icons.length}));
          if(target.url==='/services/'&&report.icons.length!==6)failures.push(label+': expected six service icons, got '+report.icons.length);
          for(const icon of report.icons){
            if(icon.viewBox!=='0 0 48 48'||icon.bboxW<1||icon.bboxH<1||icon.renderW<10)
              failures.push(label+': invisible/clipped icon '+JSON.stringify(icon));
          }
          if(target.url==='/insights/'&&(report.covers!==5||report.coverWidths.some(w=>w<60)))
            failures.push(label+': missing insight graphic covers '+JSON.stringify({covers:report.covers,widths:report.coverWidths}));
          // Save evidence at meaningful breakpoints; scroll before screenshots.
          if(['mobile-390','boundary-740','desktop-1440'].includes(size.name)){
            const targetEl=target.url==='/'?'.luen-why-rows':target.url==='/insights/'?'.insights-grid':target.url==='/services/'?'.service-hub-list':'.about-principles';
            await page.locator(targetEl).first().scrollIntoViewIfNeeded();
            await page.waitForTimeout(250);
            await page.screenshot({path:path.join(output,engine.name+'-'+size.name+'-'+(target.url==='/'?'home':target.url.slice(1,-1))+'.jpg'),type:'jpeg',quality:76});
          }
          results.push({engine:engine.name,viewport:size.width,route:target.url,overflow:report.overflow,iconCount:report.icons.length,coverCount:report.covers,flowOverflow:report.flowOverflow});
        }catch(e){failures.push(label+': '+String(e.message).slice(0,220));}
      }
      await context.close();
    }
  }finally{await browser.close();}
}
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({base,checks:results.length,failures,results},null,2));
console.log('LUEN_INTEGRATED_VISUAL_QA '+JSON.stringify({checks:results.length,failures:failures.length,details:failures.slice(0,25)}));
if(failures.length)process.exitCode=1;
