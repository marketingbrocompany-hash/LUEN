// One-time READ-ONLY real iPhone Safari QA of Claude P1/P2/P3 integration.
// BrowserStack Local makes the current PR branch's localhost site accessible to
// a PHYSICAL iPhone. No production DNS, deployment, Formspree submit or photos.
import assert from 'node:assert/strict';
import webdriver from 'selenium-webdriver';
import browserstackLocal from 'browserstack-local';
const {Builder,By}=webdriver;
const userName=process.env.BROWSERSTACK_USERNAME;
const accessKey=process.env.BROWSERSTACK_ACCESS_KEY;
const localIdentifier='luen-pr259-'+(process.env.GITHUB_RUN_ID||'local');
if(!userName||!accessKey)throw Error('Missing BrowserStack Automate credentials');
const tunnel=new browserstackLocal.Local();
let driver=null,tunnelStarted=false;
const results=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ensure=async(fn,msg,max=24000)=>{
 const until=Date.now()+max;
 while(Date.now()<until){try{const v=await fn();if(v)return v;}catch{}await delay(550);}
 throw Error(msg+' timed out');
};
const caps={
 browserName:'Safari',
 'bstack:options':{
  userName,accessKey,deviceName:'iPhone 16',osVersion:'18',realMobile:'true',
  local:true,localIdentifier,
  projectName:'LUEN Homepage',buildName:'LUEN Claude P1-P2-P3 integrated candidate',
  sessionName:'Real iPhone Safari local candidate QA (no production)',
  video:false,debug:false,networkLogs:false
 }
};
const passed=(name,data)=>{results.push({name,status:'PASS',...data});};
try {
 await new Promise((resolve,reject)=>tunnel.start({key:accessKey,localIdentifier,onlyAutomate:true},err=>err?reject(err):resolve()));
 tunnelStarted=true;
 driver=await new Builder().usingServer('https://hub-cloud.browserstack.com/wd/hub')
   .withCapabilities(caps).build();
 await driver.manage().setTimeouts({pageLoad:50000,script:25000,implicit:0});
 const host='http://localhost:4173';
 await driver.get(host+'/');
 const home=await ensure(()=>driver.executeScript(function(){
  if(document.readyState==='loading'||!document.querySelector('#cases .luen-case-entry'))return null;
  return {width:innerWidth,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
   cases:document.querySelectorAll('#cases .luen-case-entry').length,
   services:document.querySelectorAll('#services .luen-service-choice').length,
   reels:document.querySelectorAll('#selected-content .loop-set:not(.loop-clone):not(.ios-loop-clone) .portfolio-card.portrait').length,
   p2CSS:!!document.querySelector('link[href*="mobile-legibility.css"]'),
   p3CSS:!!document.querySelector('link[href*="creator-partnerships.css?v=20261031-reels-meta"]')
  };
 }), 'Candidate local homepage');
 assert.ok(home.width>=300&&home.width<=700,'Not a physical iPhone Safari viewport');
 assert.ok(home.overflow<=3,'Horizontal overflow on iPhone');
 assert.equal(home.cases,4);assert.equal(home.services,3);assert.equal(home.reels,6);
 assert.ok(home.p2CSS&&home.p3CSS,'Not testing the integrated PR branch');
 passed('Integrated PR served on actual iPhone',home);

 await driver.findElement(By.id('hamburger')).click();
 assert.equal(await driver.executeScript('return document.querySelector("#hamburger").getAttribute("aria-expanded")'),'true');
 await driver.findElement(By.id('mobileClose')).click();
 assert.equal(await driver.executeScript('return document.querySelector("#hamburger").getAttribute("aria-expanded")'),'false');
 passed('Native mobile menu taps',{opened:true,closed:true});

 const ux=await driver.executeScript(function(){
  const steps=[...document.querySelectorAll('#content-flow ol > li')].map(li=>{
    const rect=li.getBoundingClientRect();
    return Math.round(li.querySelector('strong').getBoundingClientRect().left-rect.left);
  });
  const color=q=>getComputedStyle(document.querySelector(q)).backgroundColor;
  const footer=[...document.querySelectorAll('footer .footer-links a')].map(el=>{
    const r=el.getBoundingClientRect();
    return {name:el.textContent.trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height};
  });
  const collisions=[];
  for(let i=0;i<footer.length;i++)for(let j=i+1;j<footer.length;j++){
    const a=footer[i],b=footer[j];
    const x=Math.min(a.right,b.right)-Math.max(a.x,b.x);
    const y=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
    if(x>5&&y>5)collisions.push([a.name,b.name]);
  }
  const captions=[...document.querySelectorAll('#selected-content .loop-set:not(.loop-clone):not(.ios-loop-clone) .portfolio-card.portrait')].map(card=>{
    const s=card.querySelector('.portfolio-meta span'),b=card.querySelector('.portfolio-meta b');
    const rs=s.getBoundingClientRect(),rb=b.getBoundingClientRect();
    const line=e=>parseFloat(getComputedStyle(e).lineHeight)||parseFloat(getComputedStyle(e).fontSize)*1.4;
    return rb.top>=rs.bottom-1&&rs.height<line(s)*1.5&&rb.height<line(b)*1.5;
  });
  return {steps,colors:[color('.hero-cta .btn-primary'),
   color('#services .luen-service-unified-cta'),color('#faq .faq-cta')],
   minFooterHeight:Math.min(...footer.map(x=>x.height)),footerCollisions:collisions,
   reelsCount:captions.length,reelsAllStacked:captions.every(Boolean)};
 });
 assert.equal(ux.steps.length,4);assert.equal(new Set(ux.steps).size,1);
 assert.ok(ux.colors.every(x=>x==='rgb(185, 85, 42)'),'Orange CTA colors differ');
 assert.ok(ux.minFooterHeight>=43.5,'Footer iPhone tap targets are too short');
 assert.equal(ux.footerCollisions.length,0,'Footer interactive links overlap');
 assert.equal(ux.reelsCount,6);assert.equal(ux.reelsAllStacked,true);
 passed('Native Safari P1/P2/P3 styles and tap areas',ux);

 await driver.executeScript(function(){
  document.querySelector('#faq .faq-cta').scrollIntoView({block:'center',behavior:'instant'});
 });
 await delay(450);
 const float=await driver.executeScript(function(){
  const c=document.querySelector('#floatCta'),b=document.querySelector('#faq .faq-cta');
  const x=c.getBoundingClientRect(),y=b.getBoundingClientRect();
  return {visible:c.classList.contains('show'),
   overlapped:Math.min(x.right,y.right)>Math.max(x.left,y.left)
     &&Math.min(x.bottom,y.bottom)>Math.max(x.top,y.top)};
 });
 assert.ok(!float.visible||!float.overlapped,'Floating CTA covers FAQ CTA on real iPhone');
 passed('FAQ CTA has no floating-button overlap',float);

 await driver.executeScript(function(){
  document.querySelector('#selected-content').scrollIntoView({block:'center',behavior:'instant'});
 });
 const sample=()=>driver.executeScript(function(){
  return [...document.querySelectorAll('#selected-content .portfolio-viewport')]
    .map(el=>({clones:el.querySelectorAll('.ios-loop-clone').length,
      matrix:getComputedStyle(el.querySelector('.loop-track')).transform}));
 });
 await ensure(async()=>(await sample()).every(v=>v.clones>0),'Safari Rails clones');
 const first=await sample();await delay(1100);const last=await sample();
 assert.equal(first.length,2);
 for(let i=0;i<2;i++)assert.notEqual(first[i].matrix,last[i].matrix,'Frozen iOS rail '+i);
 passed('Real Safari two content rails moving',{rails:2});

 await driver.executeScript(function(){
  document.querySelector('#services .luen-service-unified-cta').scrollIntoView({block:'center',behavior:'instant'});
 });
 await driver.findElement(By.css('#services .luen-service-unified-cta')).click();
 const form=await ensure(()=>driver.executeScript(function(){
  if(location.pathname!=='/contact/'||!document.querySelector('#contactForm'))return null;
  return {path:location.pathname,requiredConsents:document.querySelectorAll('#contactForm input[type="checkbox"][required]').length};
 }), 'Local contact form navigation');
 assert.equal(form.requiredConsents,2);
 passed('Native iPhone tap to local contact page; no form submission',form);
 console.log('LUEN_CLAUDE_PR259_REAL_IPHONE_QA '+JSON.stringify({status:'PASS',device:'iPhone 16',iOS:'18',origin:'BrowserStack Local',results}));
}catch(err){
 console.error('LUEN_CLAUDE_PR259_REAL_IPHONE_QA '+JSON.stringify({
  status:'FAIL',device:'iPhone 16',iOS:'18',origin:'BrowserStack Local',results,error:String(err.message||err).slice(0,700)}));
 process.exitCode=1;
}finally{
 if(driver)try{await driver.quit();}catch{}
 if(tunnelStarted)await new Promise(resolve=>tunnel.stop(()=>resolve()));
}
