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
const services=fs.readFileSync(path.join(root,'services/index.html'),'utf8');
const motionCss=fs.readFileSync(path.join(root,'assets/css/luen-motion.css'),'utf8');
const motionJs=fs.readFileSync(path.join(root,'assets/js/luen-motion.js'),'utf8');
const finish=fs.readFileSync(path.join(root,'assets/css/luen-finish.css'),'utf8');
const designedPages=htmlFiles.filter(filename=>
  fs.readFileSync(path.join(root,filename),'utf8').includes('luen-v3.css?v=')
);
const checks=[
  ['mobile nav controls have warm-ivory contrast',
    design.includes('border:1px solid rgba(74,66,60,.38)!important;')
    &&design.includes('background:#2A2521!important;')
    &&design.includes('html body #nav .hamburger span{')],
  ['mobile navigation remains scrollable in landscape',
    design.includes('overflow-y:auto!important;')
    &&design.includes('overscroll-behavior:contain;')
    &&design.includes('@media(max-height:600px) and (max-width:820px)')],
  ['mobile menu closes when desktop navigation returns',
    core.includes('closeOnDesktop')
    &&core.includes('setMenu(false,{restoreFocus:false})')
    &&core.includes('min-width:821px')],
  ['reduced-motion preference stops, clears and restores marquee loops',
    core.includes('syncLoopMotionPreference')
    &&core.includes('loopControllers.forEach((_controller,viewport)=>stopLoop(viewport))')
    &&core.includes('window.requestAnimationFrame(initLoopStrips)')],
  ['marquee uses only necessary clones and lazy-loads duplicate imagery',
    core.includes('Math.max(1,Math.ceil(viewport.clientWidth/baseWidth))')
    &&core.includes("img.loading='lazy'")
    &&core.includes("loopControllers.set(viewport,{raf:0,visible:false,track})")],
  ['all shared pages load updated mobile CSS and JS',
    designedPages.length>=20
    &&designedPages.every(filename=>{
      const content=fs.readFileSync(path.join(root,filename),'utf8');
      return content.includes('luen-v3.css?v=20261017-8')
        &&/site-core\.js\?v=\d{8}-\d+/.test(content);
    })],
  ['LUEN wordmark has accessible dark contrast on ivory navigation and footer',
    design.includes('html body #nav .logo .logo-word,')
    &&design.includes('html body footer .logo .logo-word{')
    &&design.includes('color:#2A2521!important;')
    &&design.includes('background:#D56F40!important;')],
  ['all styled pages load the refreshed logo stylesheet',
    designedPages.length>=20
    &&designedPages.every(filename=>fs.readFileSync(path.join(root,filename),'utf8')
      .includes('luen-v3.css?v=20261017-8'))],
  ['all six section headlines share LUEN orange',
    finish.includes('html body main#top .luen-section-primary-title{')
    &&finish.includes('color:var(--luen-finish-cta)!important;')
    &&!finish.includes('html body main#top #content-flow .luen-section-primary-title{')
    &&/luen-finish\.css\?v=\d{8}-\d+/.test(home)],
  ['homepage heading and subheading typography remains restrained',
    finish.includes('font-size:clamp(40px,4vw,52px)!important;')
    &&finish.includes('font-size:clamp(30px,8vw,34px)!important;')
    &&finish.includes('font-weight:700!important;')
    &&finish.includes('font-size:clamp(18px,1.65vw,21px)!important;')
    &&finish.includes('font-size:clamp(16px,4vw,17px)!important;')
    &&finish.includes('#services .luen-home-services-head')
    &&finish.includes('#cases.case-studies-v7 .case-feature-v7')
    &&finish.includes('#faq .faq-layout')
    &&finish.includes('#contact .contact-layout')],
  ['six English section labels are semantic large headings',
    [
      ['services-title','SERVICES'],
      ['cases-title','Signature Campaigns'],
      ['content-flow-title','HOW LUEN WORKS'],
      ['performance-title','PERFORMANCE'],
      ['faq-title','FAQ'],
      ['contact-title','PROJECT INQUIRY']
    ].every(([id,label])=>home.includes('<h2 class="luen-section-primary-title" id="'+id+'">'+label+'</h2>'))
    &&(home.match(/class="luen-section-primary-title"/g)||[]).length===6
    &&finish.includes('.luen-section-primary-title{')],
  ['numbered section labels and obsolete Korean display titles removed',
    !/0[3-8] · (?:SERVICES|HOW LUEN WORKS|PERFORMANCE|FAQ|PROJECT INQUIRY)/.test(home)
    &&!home.includes('채널마다 <em>다른 역할</em>')
    &&!home.includes('프로젝트 <em>성과</em>')
    &&!home.includes('설명이 필요하면 YouTube, 여러 인플루언서로 확산하려면 Instagram')
    &&!home.includes('예약, 랭킹, 매장 방문. 조회수 밖에서 확인된 결과들입니다.')],
  ['four secondary Korean headlines retained beneath English headings',
    (home.match(/class="luen-section-subheading"/g)||[]).length===4
    &&home.includes('복잡한 과정은 줄이고,')
    &&home.includes('업로드 직후만 보지 않고')
    &&home.includes('문의 전,')
    &&home.includes('프로젝트에 대해')
    &&finish.includes('.luen-section-subheading{')],
  ['remaining section descriptions preserved',
    home.includes('크리에이터 매칭부터 일정·가이드·콘텐츠 확인·발행까지 한 흐름으로 관리합니다.')
    &&home.includes('첫 주 이후 +31.4% 성장한 공개 지표를 추적하고')
    &&home.includes('브랜드, 목표 시장, 현재 고민만 알려주세요.')],
  ['headings are not hidden by a separate motion observer',!motionCss.includes('luen-motion-title')&&!motionCss.includes('clip-path:inset(0 0 100%')&&!motionJs.includes("classList.add('luen-motion-title')")],
  ['Instagram navigation links remain valid',
    home.includes('id="instagram-reels"')
    &&(services.includes('href="/#instagram-reels"')
      ||(services.includes('href="/services/instagram-influencer-marketing/"')
        &&known.has('services/instagram-influencer-marketing/index.html')))],
  ['Instagram detailed Premium offer stays consistent with homepage',
    !known.has('services/instagram-influencer-marketing/index.html')
    ||(home.includes('<strong>Premium</strong>')
      &&fs.readFileSync(path.join(root,'services/instagram-influencer-marketing/index.html'),'utf8')
        .includes('크리에이터 규모 · Reels 편수 맞춤 협의')
      &&!fs.readFileSync(path.join(root,'services/instagram-influencer-marketing/index.html'),'utf8')
        .includes('20인 · 20 Reels'))],
  ['TikTok deep-link target',home.includes('id="tiktok-series"')&&services.includes('href="/#tiktok-series"')],
  ['Services hub lists all six offerings',(services.match(/class="service-hub-item/g)||[]).length===6],
  ['three moving brand/YouTube/Instagram strips',(home.match(/\bdata-loop-strip\s*=/g)||[]).length===3],
  ['Instagram Basic / Standard / Premium',['Basic','Standard','Premium'].every(x=>home.includes('<strong>'+x+'</strong>'))],
  ['deleted More Content heading stays deleted',!home.includes('class="case-selected-work-head-v10"')],
  ['offline POP preserved in case detail',cases.includes('data-herahera-pop-proof')],
  ['main motion asset linked',home.includes('assets/js/luen-motion.js')],
  ['progressive scroll reveal activation',core.includes("classList.add('js-scroll-reveal')")],
  ['JavaScript failure visible-content fallback',design.includes('html:not(.js-scroll-reveal) body .sr')],
  ['warm partner-strip override',home.includes('section.brand-wall{background:#EEE6DA!important}')],
  ['curated partner approach visible',home.includes('id="why-luen"')&&home.includes('CREATIVE DIRECTION')],
  ['partner roster has distinct profile and inquiry links',home.includes('id="partner-creators"')&&home.includes('/creators/masubuchi-sachiyo/')&&home.includes('/contact/?inquiry=creator&amp;creator=masubuchi')],
  ['creator profile contains safe collaboration qualifiers',fs.readFileSync(path.join(root,'creators/masubuchi-sachiyo/index.html'),'utf8').includes('전속 소속 또는 독점 매니지먼트를 의미하지 않습니다.')],
  ['contact form supports creator preselection',fs.readFileSync(path.join(root,'contact/index.html'),'utf8').includes('name="creator_requested"')&&fs.readFileSync(path.join(root,'contact/index.html'),'utf8').includes("new URLSearchParams(window.location.search)")],
  ['creator profile included in sitemap',fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').includes('https://luenkorea.com/creators/masubuchi-sachiyo/')],
  ['Masubuchi LUEN F&B gallery includes 8 originals, 4 Instagram Reels, and no removed Shorts',(()=>{
    const creator=fs.readFileSync(path.join(root,'creators/masubuchi-sachiyo/index.html'),'utf8');
    return creator.includes('id="korea-food-content"')
      &&['n-u1DvcEtoc','_AdGQ49Oc5Y','DWn-bFBARLT','ntho1xxBfW0','Jwtgq2v_2hc','Dc5tHpyhAbX','Ddi5Yc6h_Zu','DaM3mwqhQSI'].every(id=>creator.includes(id))
      &&!creator.includes('NYlAk6xwFcE')
      &&!creator.includes('YOUTUBE SHORTS')
      &&(creator.match(/class="luen-food-video-card"/g)||[]).length===8
      &&(creator.match(/href="https:\/\/www.instagram.com\/reel\//g)||[]).length===4
      &&creator.includes('위 영상 8편은 LUEN이 직접 진행한 한국 F&amp;B 협업입니다.')
      &&!creator.includes('<iframe');
  })()]
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
