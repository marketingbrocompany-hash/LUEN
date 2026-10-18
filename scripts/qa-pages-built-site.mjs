// Verify an actual Jekyll-built GitHub Pages artifact from a frozen LUEN RC.
// No GitHub Pages deploy / DNS / production actions are performed here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(),site=path.join(root,'_site');
const errs=[],results=[];
if(!fs.existsSync(site))throw Error('Jekyll built _site does not exist');
const sourceMap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const routes=[...sourceMap.matchAll(/<loc>https:\/\/luenkorea\.com([^<]+)<\/loc>/g)].map(x=>x[1]);
if(routes.length!==21||new Set(routes).size!==21)throw Error('Expected 21 unique public routes, got '+routes.length);
const read=relative=>{
  const p=path.resolve(site,relative);
  if(!p.startsWith(site+path.sep))throw Error('Unsafe page path: '+relative);
  return fs.existsSync(p)?fs.readFileSync(p):null;
};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex').slice(0,12);
const assetRefs=new Set();
for(const route of routes){
  const file=route==='/'?'index.html':route.slice(1)+'index.html';
  const built=read(file),original=fs.readFileSync(path.join(root,file));
  if(!built){errs.push('GitHub Pages omitted sitemap route '+route);continue}
  const txt=built.toString('utf8');
  const match=txt.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  if(!match||match[1]!=='https://luenkorea.com'+route)
    errs.push('Canonical broken in built page '+route);
  if((txt.match(/<h1(?:\s|>)/ig)||[]).length!==1)
    errs.push('H1 changed on built page '+route);
  if(Buffer.compare(built,original)!==0)
    errs.push('Jekyll unexpectedly transformed '+route+' (source '+hash(original)+', built '+hash(built)+')');
  for(const [,link] of txt.matchAll(/(?:src|href)="(\/assets\/[^"#?]+)"/g))assetRefs.add(link);
  results.push({route,sourceBytes:original.length,builtBytes:built.length,changed:Buffer.compare(built,original)!==0});
}
for(const asset of assetRefs){
  const filename=asset.replace(/^\//,'');
  if(!read(filename))errs.push('GitHub Pages artifact missing referenced asset '+asset);
}
const builtCname=read('CNAME');
const originalCname=fs.readFileSync(path.join(root,'CNAME'),'utf8').trim();
// GitHub Pages branch-publishing domain binding is checked in the SOURCE
// repository CNAME, not necessarily in Jekyll's temporary _site artifact.
// Requiring it in _site was a false positive in the first diagnostic run.
if(originalCname!=='luenkorea.com')
  errs.push('Repository publishing-source CNAME is incorrect: '+originalCname);
if(builtCname && builtCname.toString('utf8').trim()!=='luenkorea.com')
  errs.push('Built CNAME exists but contradicts repository domain');
console.log('LUEN_GH_PAGES_CNAME_SOURCE '+JSON.stringify({
 source:originalCname,built:builtCname?.toString('utf8').trim()||null,
 note:'Branch source CNAME remains authoritative'
}));
for(const required of ['assets/css/site.css','assets/css/luen-v3.css','assets/css/luen-pages.css',
  'assets/js/site-core.js','assets/js/site.js','assets/js/luen-motion.js']){
  if(!read(required))errs.push('Missing critical runtime asset '+required);
}
const meta={pagesChecked:results.length,expected:routes.length,assetReferences:assetRefs.size,errors:errs,
  cname:builtCname?.toString('utf8').trim(),pages:results};
fs.mkdirSync('qa-reports',{recursive:true});
fs.writeFileSync('qa-reports/pages-rc-build.json',JSON.stringify(meta,null,2));
console.log('LUEN_GH_PAGES_RC_BUILD '+JSON.stringify({pages:results.length,expected:routes.length,
 assetRefs:assetRefs.size,cname:meta.cname,failures:errs.length}));
for(const e of errs)console.error('LUEN_GH_PAGES_RC_FAIL '+e);
if(errs.length||results.length!==routes.length)process.exitCode=1;
