// LUEN: verified mosaiced gallery release gate. Tests browser behavior and exact approved file bytes.
// No user photographs in screenshots, logs, artifacts or network telemetry.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium, webkit} from 'playwright';

const base=(process.env.LUEN_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const paths=[1,2,3,4].map(i=>'/assets/images/cases/herahera-visitor-0'+i+'.webp');
const approved=[
  'f6591d1ad3a279db9ecefd7a487939155ede67b64a11e38e43899d08b6510778',
  'f4e8d695501383161157d05b4c2ba4dbc48641ff747ae5c5ccbd34e403660897',
  '19a5310ab640fc477fd6d291c89c441b7e81d283387f404725bbc3c93ac5cf21',
  'b87cb2b1bd85490c48376a6a9a07b3958eac1a8d2ce14543fbe2e4dcd0e09409'
];
for(let i=0;i<4;i++){
  const bytes=fs.readFileSync('assets/images/cases/herahera-visitor-0'+(i+1)+'.webp');
  if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')throw Error('Gallery '+(i+1)+' not WebP');
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hash!==approved[i])throw Error('Gallery '+(i+1)+' differs from previously approved mosaiced file');
}
const variants=[
 {engine:chromium,name:'desktop-1440',width:1440,height:900},
 {engine:chromium,name:'android-width-390',width:390,height:844},
 {engine:webkit,name:'ios-webkit-390',width:390,height:844},
 {engine:webkit,name:'ios-webkit-320',width:320,height:690}
];
let fails=[];
for(const v of variants){
  const browser=await v.engine.launch({headless:true});
  try{
    const context=await browser.newContext({
      viewport:{width:v.width,height:v.height},
      isMobile:v.width<700,hasTouch:v.width<700,
      deviceScaleFactor:v.width<700?2:1
    });
    await context.route(/https:\/\/(?:www\.)?(?:googletagmanager\.com|google-analytics\.com)\//,r=>r.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>fails.push(v.name+' page error: '+e.message));
    const response=await page.goto(base+'/cases/herahera-seoul-fnb/',{waitUntil:'domcontentloaded',timeout:60000});
    if(response?.status()!==200)throw Error(v.name+' route HTTP '+response?.status());

    const info=await page.evaluate(()=>{
      const figures=[...document.querySelectorAll('.herahera-visitor-gallery figure')];
      const container=document.querySelector('.herahera-visitor-gallery');
      const pop=document.querySelector('.herahera-pop-feature>img');
      return {
        photoSources:figures.map(f=>f.querySelector('img')?.getAttribute('src')),
        popPath:pop?.getAttribute('src'),
        cardCount:document.querySelectorAll('.herahera-video-card').length,
        metrics:[...document.querySelectorAll('.herahera-video-metrics dd')].map(el=>el.textContent.trim()),
        sections:['case-content','case-offline','case-next-title'].every(id=>document.getElementById(id)),
        pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        scrolling:container?{width:container.clientWidth,scrollWidth:container.scrollWidth,overflowX:getComputedStyle(container).overflowX}:null,
        removedNotice:document.querySelector('main')?.textContent?.includes('방문 인증 사진은 실제 현장 반응을 보여주는 사례이며'),
        heroPrimary:document.querySelector('.herahera-hero .btn-primary')?.textContent.trim(),
        heroSecondary:document.querySelector('.herahera-hero .btn-secondary')?.textContent.trim()
      };
    });
    if(JSON.stringify(info.photoSources)!==JSON.stringify(paths))throw Error(v.name+' wrong 4 mosaic gallery paths');
    if(info.popPath!=='/assets/images/cases/herahera-pop-cutout-hq.webp')throw Error(v.name+' POP mismatch');
    if(info.cardCount!==2||JSON.stringify(info.metrics)!==JSON.stringify(['97만','7.9천','351','49만','4.8천','181']))
      throw Error(v.name+' unexpected video metrics');
    if(!info.sections||info.removedNotice||info.heroPrimary!=='콘텐츠 보기 ↓'||info.heroSecondary!=='현장 인증 보기 ↓')
      throw Error(v.name+' approved layout/copy regression');
    if(info.pageOverflow>3)throw Error(v.name+' horizontal page overflow: '+info.pageOverflow);
    const pop=page.locator('.herahera-pop-feature>img');
    await pop.scrollIntoViewIfNeeded();
    const popImage=await pop.evaluate(async img=>{
      try{await img.decode()}catch{}
      return {w:img.naturalWidth,h:img.naturalHeight,complete:img.complete};
    });
    if(popImage.w<1100||popImage.h<1300||!popImage.complete)throw Error(v.name+' pop not decoded');
    const gallery=page.locator('.herahera-visitor-gallery');
    for(let i=0;i<4;i++){
      const img=gallery.locator('img').nth(i);
      await img.scrollIntoViewIfNeeded();
      const im=await img.evaluate(async el=>{
        try{await el.decode()}catch{}
        return {w:el.naturalWidth,h:el.naturalHeight,complete:el.complete};
      });
      if(im.w<550||im.h<740||!im.complete)throw Error(v.name+' photo '+(i+1)+' not decoded');
    }
    const scroll=await gallery.evaluate(el=>{
      el.scrollLeft=0;
      el.scrollLeft=el.scrollWidth;
      return {scrollLeft:el.scrollLeft,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
    });
    if(v.width<700&&(scroll.scrollWidth<=scroll.clientWidth+50||scroll.scrollLeft<25))
      throw Error(v.name+' gallery does not swipe horizontally');
    if(v.width>=700&&scroll.scrollWidth>scroll.clientWidth+4)
      throw Error(v.name+' desktop gallery width overflow');
    // Never screenshot visitor images or POP here.
    console.log('LUEN_MOSAIC_CASE_PASS '+JSON.stringify({variant:v.name,cards:info.cardCount,mosaicImages:4,
      pageOverflow:info.pageOverflow,popDecoded:true,swipeTest:v.width<700?'PASS':'not required'}));
    await context.close();
  }finally{await browser.close();}
}
if(fails.length)throw Error(fails.join('; '));
console.log('LUEN_MOSAIC_RELEASE_QA SUCCESS: all four approved bytes, desktop/Android/WebKit 320+390');
