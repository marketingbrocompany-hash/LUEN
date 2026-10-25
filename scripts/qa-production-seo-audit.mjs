import fs from 'node:fs';
const base='https://luenkorea.com',errors=[],warnings=[],routes=[];
const fetchPublic=async url=>{
  const u=new URL(url,base);
  if(u.origin!==base)throw Error('External URL refused');
  return fetch(u,{headers:{'Cache-Control':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(16000)});
};
const tagValue=(html,key,keyType='name',outType='content')=>{
  const tags=html.match(/<(meta|link)\s+[^>]*>/gi)||[];
  const tag=tags.find(t=>t.includes(keyType+'="'+key+'"')||t.includes(keyType+"='"+key+"'"));
  if(!tag)return '';
  const match=tag.match(new RegExp(outType+'\\s*=\\s*["\\x27]([^"\\x27]*)','i'));
  return match?match[1]:'';
};
const rob=await fetchPublic('/robots.txt');
const robots=await rob.text();
if(rob.status!==200||/Disallow:\s*\/\s*$/mi.test(robots))errors.push('robots inaccessible or broad blocked');
if(!robots.includes('https://luenkorea.com/sitemap.xml'))errors.push('robots sitemap reference missing');
const map=await fetchPublic('/sitemap.xml');
const xml=await map.text();
if(map.status!==200)errors.push('sitemap inaccessible');
const entries=[...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map(m=>({url:m[1],lastmod:m[2]||''}));
if(entries.length<15)errors.push('sitemap unexpectedly small: '+entries.length);
const seen=new Set();
for(const entry of entries){
  if(seen.has(entry.url))errors.push('duplicate sitemap page '+entry.url);
  seen.add(entry.url);
  if(!entry.url.startsWith(base+'/')){errors.push('unexpected sitemap origin');continue;}
  try{
    const res=await fetchPublic(entry.url);
    if(res.status!==200){errors.push('HTTP '+res.status+' '+entry.url);continue;}
    const html=await res.text();
    const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.trim()||'';
    const description=tagValue(html,'description');
    const canonical=tagValue(html,'canonical','rel','href');
    const robotsMeta=tagValue(html,'robots');
    const ogImage=tagValue(html,'og:image','property');
    const h1count=(html.match(/<h1[\s>]/gi)||[]).length;
    const jsonLd=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
    if(!title)errors.push('missing title '+entry.url);
    if(!description)errors.push('missing description '+entry.url);
    if(!canonical)errors.push('missing canonical '+entry.url);
    else if(canonical.replace(/\/+$/,'')!==entry.url.replace(/\/+$/,''))errors.push('canonical mismatch '+entry.url+' -> '+canonical);
    if(/noindex/i.test(robotsMeta))errors.push('sitemap page noindex '+entry.url);
    if(!ogImage)warnings.push('missing OG image '+entry.url);
    if(h1count!==1)warnings.push('H1 count '+h1count+' '+entry.url);
    for(const item of jsonLd){try{JSON.parse(item)}catch(e){errors.push('invalid JSON-LD '+entry.url)}}
    if(entry.lastmod && entry.lastmod>'2026-10-25')warnings.push('future lastmod '+entry.url);
    if(['/','/services/youtube-creator-marketing/','/services/instagram-influencer-marketing/'].includes(new URL(entry.url).pathname)&&entry.lastmod<'2026-10-25')warnings.push('stale lastmod on newly released page '+entry.url);
    routes.push({path:new URL(entry.url).pathname,title,titleLength:title.length,descriptionLength:description.length,h1count,canonical,jsonLdCount:jsonLd.length,ogImage:!!ogImage,lastmod:entry.lastmod});
  }catch(e){errors.push('fetch failed '+entry.url+' '+String(e.message).slice(0,80))}
}
const home=await(await fetchPublic('/')).text();
const gaId=(home.match(/gtag\/js\?id=(G-[A-Z0-9]+)/)||[])[1]||'';
if(!gaId||!home.includes("gtag('config', '"+gaId+"')"))errors.push('GA4 tag/config missing or inconsistent');
const scripts=[...home.matchAll(/<script\b[^>]*src=["']([^"']+\.js(?:\?[^"']*)?)["']/gi)].map(m=>m[1]);
const observedEvents=new Set();
for(const script of scripts){
  if(!(script.startsWith('/assets/')||script.startsWith('assets/')))continue;
  const res=await fetchPublic(script);
  if(res.status!==200){warnings.push('missing JS '+script);continue;}
  const js=await res.text();
  for(const event of ['generate_lead','cta_click','contact_form_start','contact_form_submit_attempt','contact_form_error']){
    if(js.includes(event))observedEvents.add(event);
  }
}
if(!observedEvents.has('generate_lead'))warnings.push('generate_lead not statically found in JS');
const summary={checkedAt:new Date().toISOString(),origin:base,declaredPages:entries.length,checkedPages:routes.length,
  ga4:{tagId:gaId,sourceEventNames:[...observedEvents],actualEventDeliveryVerified:false},routes,errors,warnings,
  disclaimer:'Technical public HTML audit only. Does not prove pages are indexed or GA4 receives live events.'};
fs.mkdirSync('seo-audit-results',{recursive:true});
fs.writeFileSync('seo-audit-results/technical-seo.json',JSON.stringify(summary,null,2));
console.log('LUEN_SEO_PRODUCTION_AUDIT '+JSON.stringify({declaredPages:entries.length,checkedPages:routes.length,ga4:summary.ga4,errors,warnings}));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '## Production technical SEO audit\n\nPages: '+routes.length+'/'+entries.length+
  '\n\nGA4 tag: '+(gaId||'missing')+'\n\nErrors: '+errors.length+'\n\nWarnings: '+warnings.length+
  '\n\n'+warnings.map(w=>'- '+w).join('\n')+'\n');
if(errors.length)process.exitCode=1;
