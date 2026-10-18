// Non-destructive form QA: intercept all Formspree POSTs and simulate responses.
// Real customer submissions and email delivery are NOT performed by this test.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE=(process.env.LUEN_QA_URL||'https://luen-preview.pages.dev').replace(/\/$/,'');
const browser=await chromium.launch({headless:true});
const dest=path.resolve('qa-screenshots','launch-forms');
fs.mkdirSync(dest,{recursive:true});
const errors=[],outcomes=[];
const fail=(route,step,detail)=>errors.push({route,step,detail});
try{
  for(const route of ['/','/contact/']){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.route(/https:\/\/(www\.)?googletagmanager\.com\//,r=>r.abort());
    await context.route(/https:\/\/(www\.)?google-analytics\.com\//,r=>r.abort());
    let responseMode='success';
    let posts=0;
    const submittedNames=[];
    await context.route(/^https:\/\/formspree\.io\//,async r=>{
      posts++;
      const req=r.request();
      if(req.method()!=='POST')fail(route,'method','Unexpected Formspree method '+req.method());
      const fields=await req.postDataBuffer().catch(()=>Buffer.from(''));
      const body=fields.toString('utf8');
      for(const key of ['name="company"','name="name"','name="email"','name="market"',
        'name="privacy_consent"','name="overseas_transfer_consent"','name="_subject"']){
        if(!body.includes(key))fail(route,'payload','Expected form field absent: '+key);
      }
      submittedNames.push(req.url().replace(/https:\/\/formspree\.io\/f\//,''));
      if(responseMode==='success')
        await r.fulfill({status:200,contentType:'application/json',
          headers:{'Access-Control-Allow-Origin':'*'},body:'{"ok":true}'});
      else
        await r.fulfill({status:422,contentType:'application/json',
          headers:{'Access-Control-Allow-Origin':'*'},body:'{"errors":[{"message":"모의 전송 오류입니다."}]}'});
    });
    const page=await context.newPage();
    const jsErrors=[];
    page.on('pageerror',e=>jsErrors.push(String(e.message).slice(0,240)));
    try{
      const result=await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:45000});
      if(result?.status()!==200)fail(route,'load','HTTP '+result?.status());
      const form=page.locator('#contactForm');
      if(await form.count()!==1)throw new Error('Missing contact form');
      const action=await form.getAttribute('action');
      if(!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(action||''))
        fail(route,'action','Form action is not expected Formspree endpoint');
      if(await form.locator('input[type="checkbox"][required]').count()!==2)
        fail(route,'consent','Two required consent checkboxes expected');
      const fieldNames=await form.locator('input[name],select[name],textarea[name]').evaluateAll(list=>list.map(e=>e.getAttribute('name')));
      for(const name of ['company','name','email','phone','market','privacy_consent','overseas_transfer_consent'])
        if(!fieldNames.includes(name))fail(route,'fields','Missing '+name);
      await page.locator('#company').fill('LUEN QA SIMULATED');
      await page.locator('#name').fill('Automation Test');
      await page.locator('#market').selectOption({label:'일본 시장'});
      await page.locator('#privacyConsent').check({force:true});
      await page.locator('#overseasConsent').check({force:true});

      // Missing both email and phone MUST fail before any POST occurs.
      await form.locator('button[type="submit"]').click();
      await page.waitForTimeout(180);
      const invalid=await page.locator('#email').evaluate(e=>({
        valid:e.checkValidity(),message:e.validationMessage,custom:e.validity.customError
      }));
      if(invalid.valid||!invalid.custom||posts!==0)
        fail(route,'contact-method','Empty email and phone bypassed validation: '+JSON.stringify({invalid,posts}));
      // Restore valid email; submit with fake endpoint response. No real email.
      await page.locator('#email').fill('test@invalid.example');
      await form.locator('button[type="submit"]').click();
      await page.waitForTimeout(250);
      const success=await page.evaluate(()=>({
        success:document.querySelector('#contactForm')?.classList.contains('is-success'),
        busy:document.querySelector('#contactForm')?.classList.contains('is-submitting'),
        event:window.dataLayer?.some(e=>e?.[0]==='event' && e?.[1]==='generate_lead'),
        feedback:document.querySelector('#copyStatus')?.textContent?.trim()
      }));
      if(posts!==1||!success.success||success.busy||!success.event)
        fail(route,'mock-success','Success simulation failed: '+JSON.stringify({posts,success}));
      await page.screenshot({path:path.join(dest,route==='/'?'homepage-success.jpg':'contact-success.jpg'),
        type:'jpeg',quality:66,animations:'disabled'});

      await page.locator('#formReset').click();
      const reset=await page.locator('#contactForm').evaluate(e=>({
        success:e.classList.contains('is-success'),company:e.querySelector('#company')?.value,
        buttonDisabled:e.querySelector('.form-submit')?.disabled
      }));
      if(reset.success||reset.buttonDisabled||reset.company)
        fail(route,'reset','Reset did not restore blank editable form: '+JSON.stringify(reset));
      // Simulated HTTP failure must NOT show success.
      responseMode='failure';
      await page.locator('#company').fill('LUEN QA SIMULATED');
      await page.locator('#name').fill('Automation Test');
      await page.locator('#email').fill('test@invalid.example');
      await page.locator('#market').selectOption({label:'일본 시장'});
      await page.locator('#privacyConsent').check({force:true});
      await page.locator('#overseasConsent').check({force:true});
      await form.locator('button[type="submit"]').click();
      await page.waitForTimeout(230);
      const failure=await page.evaluate(()=>({
        success:document.querySelector('#contactForm')?.classList.contains('is-success'),
        error:document.querySelector('#copyStatus')?.classList.contains('is-error'),
        message:document.querySelector('#copyStatus')?.textContent?.trim(),
        busy:document.querySelector('#contactForm')?.classList.contains('is-submitting')
      }));
      if(posts!==2||failure.success||!failure.error||failure.busy||!failure.message)
        fail(route,'mock-failure','Error response not handled: '+JSON.stringify({posts,failure}));
      if(jsErrors.length)fail(route,'js-errors',JSON.stringify([...new Set(jsErrors)]));
      outcomes.push({route,formActionConfigured:!!action,requiredConsentCount:2,
        invalidContactBlocked:invalid.custom,successShown:success.success,
        resetWorks:!reset.success && !reset.buttonDisabled,errorShown:failure.error,
        generateLeadQueued:success.event,mockedRequests:posts});
    }catch(e){fail(route,'exception',String(e.message).slice(0,600))}
    await context.close();
  }
}finally{
  await browser.close();
}
const report={at:new Date().toISOString(),note:'All Formspree requests intercepted. NO real submissions sent.',
  outcomes,errors};
fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(report,null,2));
console.log('LUEN_FORM_QA_SUMMARY '+JSON.stringify({pages:outcomes.length,errors:errors.length,outcomes}));
for(const err of errors)console.log('LUEN_FORM_QA_FAIL '+JSON.stringify(err));
if(process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '\n### Form validation and response simulation\n'+
    '**'+outcomes.length+' pages checked; '+errors.length+' failures.** No real data sent to Formspree.\n'+
    errors.map(x=>'- ❌ '+x.route+' / '+x.step+': '+x.detail).join('\n')+'\n');
if(errors.length)process.exitCode=1;
