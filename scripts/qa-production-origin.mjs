// LUEN production origin guard: DNS + public HTML inspection only.
// No provider credentials, DNS changes, form submissions, or deployments.
// Run with Node.js 22+; intended for manual execution or a targeted PR check.
import { promises as dns } from 'node:dns';

const apex='luenkorea.com';
const www='www.luenkorea.com';
const githubPagesIPv4=new Set([
  '185.199.108.153','185.199.109.153','185.199.110.153','185.199.111.153'
]);
const errors=[],warnings=[],details={};
const timeout=15000;

async function inspect(label,fn){
  try {details[label]=await fn();return details[label];}
  catch(e){errors.push(label+': '+String(e.message||e).slice(0,200));return null;}
}
const A=await inspect('apexA',()=>dns.resolve4(apex));
if(A){
  if(!A.length||A.some(ip=>!githubPagesIPv4.has(ip))){
    errors.push('Official apex DNS no longer points exclusively at known GitHub Pages IPv4 addresses');
  }
  if(A.length<4)warnings.push('GitHub Pages recommends four apex A records; public DNS currently returns '+A.length);
}
const CNAME=await inspect('wwwCname',()=>dns.resolveCname(www));
if(CNAME&&!(CNAME.length===1&&CNAME[0].replace(/\.$/,'').toLowerCase()==='marketingbrocompany-hash.github.io'))
  errors.push('www CNAME differs from approved GitHub Pages origin');
const NS=await inspect('nameservers',()=>dns.resolveNs(apex));
if(NS&&!NS.every(ns=>ns.toLowerCase().includes('cafe24.')))
  warnings.push('Authoritative DNS provider changed; recheck hosting runbook');
// Verify live release independently of Vercel READY. Scrape only public pages.
const response=await inspect('apexHttp',async()=>{
  const r=await fetch('https://'+apex+'/',{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':'LUEN-DNS-ORIGIN-QA/1.0'}});
  const html=await r.text();
  return {
    status:r.status,
    https:r.url.startsWith('https://'),
    cases:(html.match(/class="luen-case-entry case-support-card-v7"/g)||[]).length,
    services:(html.match(/class="luen-service-choice"/g)||[]).length,
    unifiedCTA:(html.match(/class="luen-service-unified-cta"/g)||[]).length,
    hasCanonical:html.includes('https://luenkorea.com/'),
    hasExpectedCNAME:Boolean(A?.length)
  };
});
if(response){
  if(response.status!==200||!response.https||response.cases!==4||response.services!==3||response.unifiedCTA!==1)
    errors.push('Official homepage does not expose the approved current SERVICES / Signature Campaigns release');
}
const wwwResponse=await inspect('wwwRedirect',async()=>{
  const r=await fetch('https://'+www+'/',{redirect:'manual',signal:AbortSignal.timeout(timeout)});
  return {status:r.status,location:r.headers.get('location')};
});
if(wwwResponse){
  const dest=wwwResponse.location?new URL(wwwResponse.location,'https://'+www):null;
  if(![301,302,307,308].includes(wwwResponse.status)||dest?.hostname!==apex||dest?.protocol!=='https:')
    errors.push('www must redirect to canonical https://luenkorea.com');
}
const result={checks:5,passed:errors.length===0,errors,warnings,observed:details};
console.log('LUEN_ORIGIN_QA '+JSON.stringify(result));
if(errors.length)process.exitCode=1;
