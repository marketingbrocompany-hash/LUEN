// Read-only smoke test of the real LUEN GitHub Pages custom domain.
import fs from 'node:fs';
const origin='https://luenkorea.com';
const routeSource=fs.readFileSync('sitemap.xml','utf8');
const paths=[...routeSource.matchAll(/<loc>https:\/\/luenkorea\.com([^<]+)<\/loc>/g)].map(x=>x[1]);
if(paths.length!==21||new Set(paths).size!==21)throw Error('Source sitemap must have 21 unique paths');
const failures=[],warnings=[],results=[];
async function request(url){
 let last;
 for(let attempt=0;attempt<2;attempt++)try{
  return await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(23000),
   headers:{'user-agent':'LUEN-site-quality-monitor/1.0'}});
 }catch(e){last=e}
 throw last;
}
const get=(s,r)=>s.match(r)?.[1]||'';
for(const route of paths){
 try{
  const r=await request(origin+route);
  if(r.status!==200){failures.push(route+' HTTP '+r.status);continue}
  const html=await r.text(),destination=new URL(r.url);
  const title=get(html,/<title>([\s\S]*?)<\/title>/i);
  const canonical=get(html,/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)||
   get(html,/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i);
  if(destination.hostname!=='luenkorea.com')failures.push(route+' wrong host '+r.url);
  if(!title.includes('LUEN'))failures.push(route+' title does not mention LUEN');
  if(canonical!==origin+route)failures.push(route+' wrong canonical '+canonical);
  if((html.match(/<h1(?:\s|>)/gi)||[]).length!==1)failures.push(route+' h1 count incorrect');
  if(!/<main\b/i.test(html))failures.push(route+' missing main');
  if(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html))failures.push(route+' noindex');
  if(route==='/contact/'&&!html.includes('id="contactForm"'))failures.push('contact form not found');
  if(route==='/services/instagram-influencer-marketing/'&&!html.includes('instagram-plan-card'))
   failures.push('Instagram product details missing');
  if(route==='/services/youtube-creator-marketing/'&&!html.includes('yt-type-card'))
   failures.push('YouTube long-form details missing');
  results.push({route,status:r.status,bytes:html.length,title});
  console.log('LUEN_LIVE_ROUTE '+JSON.stringify({route,status:r.status,bytes:html.length}));
 }catch(e){failures.push(route+' network '+String(e.message).slice(0,160))}
}
for(const path of ['/assets/css/site.css','/assets/css/luen-v3.css','/assets/css/luen-pages.css',
 '/assets/js/site-core.js','/assets/images/seo/luen-og-1200x630-v2.jpg','/sitemap.xml','/robots.txt']){
 try{const r=await request(origin+path);
  if(r.status!==200)failures.push('asset '+path+' HTTP '+r.status);
  results.push({asset:path,status:r.status});
 }catch(e){failures.push('asset '+path+' '+String(e.message).slice(0,120))}
}
try{
 const r=await request('https://www.luenkorea.com/');
 if(r.status!==200)failures.push('www HTTP '+r.status);
 if(new URL(r.url).hostname!=='luenkorea.com')warnings.push('www is not redirected to apex: '+r.url);
 results.push({www:r.url,status:r.status});
}catch(e){failures.push('www '+String(e.message).slice(0,180))}
fs.mkdirSync('qa-reports',{recursive:true});
const summary={checks:results.length,expectedPublicRoutes:paths.length,
 observedPublicRoutes:results.filter(x=>x.route).length,failures,warnings,results};
fs.writeFileSync('qa-reports/live-domain-postlaunch.json',JSON.stringify(summary,null,2));
console.log('LUEN_LIVE_DOMAIN_SUMMARY '+JSON.stringify({routes:summary.observedPublicRoutes,
 assets:results.filter(x=>x.asset).length,failures:failures.length,warnings:warnings.length}));
failures.forEach(e=>console.error('LUEN_LIVE_DOMAIN_FAIL '+e));
warnings.forEach(e=>console.warn('LUEN_LIVE_DOMAIN_WARN '+e));
if(failures.length)process.exitCode=1;
