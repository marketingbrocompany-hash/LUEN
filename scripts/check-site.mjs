// LUEN: zero-dependency static integrity checks (Node 22+).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const errors=[];
const warnings=[];
const allFiles=[];
function walk(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(['.git','node_modules','.vercel'].includes(entry.name))continue;
    const filename=path.join(dir,entry.name);
    if(entry.isDirectory())walk(filename);
    else if(entry.isFile())allFiles.push(path.relative(root,filename).replaceAll(path.sep,'/'));
  }
}
walk(root);
const known=new Set(allFiles);
const htmlFiles=allFiles.filter(name=>name.endsWith('.html'));
const jsFiles=allFiles.filter(name=>name.endsWith('.js'));
const cssFiles=allFiles.filter(name=>name.endsWith('.css'));

function resolveLink(raw,from) {
  const href=raw.split(/[?#]/)[0];
  if(!href || /^(https?:|\/\/|mailto:|tel:|data:|javascript:)/i.test(href))return null;
  const parts=href.startsWith('/') ? href.slice(1) : path.posix.join(path.posix.dirname(from),href);
  const normal=path.posix.normalize(parts);
  if(normal==='.'||normal==='')return 'index.html';
  if(normal.endsWith('/'))return normal+'index.html';
  if(!path.posix.basename(normal).includes('.'))return normal+'/index.html';
  return normal;
}

for(const filename of htmlFiles) {
  const html=fs.readFileSync(path.join(root,filename),'utf8');
  const ids=new Set();
  for(const match of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    if(ids.has(match[1]))errors.push(filename+': duplicate ID '+match[1]);
    ids.add(match[1]);
  }
  for(const match of html.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)) {
    const target=match[1];
    if(target.startsWith('#')) {
      if(target.length>1&&!ids.has(decodeURIComponent(target.slice(1))))
        errors.push(filename+': missing local anchor '+target);
      continue;
    }
    const resolved=resolveLink(target,filename);
    if(resolved&&!known.has(resolved))
      errors.push(filename+': missing referenced file '+target+' → '+resolved);
  }
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs=match[1],body=match[2].trim();
    if(!body||/\bsrc\s*=/.test(attrs))continue;
    try {
      if(/application\/ld\+json/i.test(attrs))JSON.parse(body);
      else new vm.Script(body,{filename});
    }catch(error){errors.push(filename+': invalid inline script or JSON-LD '+error.message);}
  }
}

for(const filename of jsFiles){
  const src=fs.readFileSync(path.join(root,filename),'utf8');
  try{new vm.Script(src,{filename});}catch(error){errors.push(filename+': invalid JavaScript '+error.message);}
}
for(const filename of cssFiles) {
  const css=fs.readFileSync(path.join(root,filename),'utf8');
  const opens=(css.match(/{/g)||[]).length,closes=(css.match(/}/g)||[]).length;
  if(opens!==closes)errors.push(filename+': brace count differs ('+opens+' vs '+closes+')');
}

// Behavioral regression checks on the homepage's required content.
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cases=fs.readFileSync(path.join(root,'cases/herahera-seoul-fnb/index.html'),'utf8');
const core=fs.readFileSync(path.join(root,'assets/js/site-core.js'),'utf8');
const design=fs.readFileSync(path.join(root,'assets/css/luen-v3.css'),'utf8');
const checks=[
  ['three moving brand/YouTube/Instagram strips',(home.match(/\bdata-loop-strip\s*=/g)||[]).length===3],
  ['Instagram Basic / Standard / Premium',['Basic','Standard','Premium'].every(x=>home.includes('<strong>'+x+'</strong>'))],
  ['deleted More Content heading stays deleted',!home.includes('class="case-selected-work-head-v10"')],
  ['offline POP preserved in case detail',cases.includes('data-herahera-pop-proof')],
  ['main motion asset linked',home.includes('assets/js/luen-motion.js')],
  ['progressive scroll reveal activation',core.includes("classList.add('js-scroll-reveal')")],
  ['JavaScript failure visible-content fallback',design.includes('html:not(.js-scroll-reveal) body .sr')],
  ['warm partner-strip override',home.includes('section.brand-wall{background:#EEE6DA!important}')]
];
for(const [name,pass] of checks)if(!pass)errors.push('Regression check failed: '+name);

// The original optimized-asset inventory is historical; warn, do not
// turn this known legacy document into a deployment blocker.
const manifest=path.join(root,'asset-manifest.json');
if(fs.existsSync(manifest)){
  try{
    const records=JSON.parse(fs.readFileSync(manifest,'utf8'));
    const stale=records.filter(item=>item.path&&!known.has(item.path));
    if(stale.length)warnings.push('Legacy asset-manifest.json: '+stale.length+' of '+records.length+' listed paths no longer exist');
  }catch(error){warnings.push('Legacy asset-manifest.json is not parseable: '+error.message);}
}

console.log('LUEN static QA: '+htmlFiles.length+' HTML / '+jsFiles.length+' JS / '+cssFiles.length+' CSS files');
for(const item of warnings)console.warn('WARNING: '+item);
for(const item of errors)console.error('ERROR: '+item);
if(errors.length){
  console.error('FAILED: '+errors.length+' issue(s)');
  process.exitCode=1;
}else console.log('PASS: links, anchors, IDs, script syntax, JSON-LD, CSS braces and homepage regressions');
