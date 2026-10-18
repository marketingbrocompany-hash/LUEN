// A/B local server for Lighthouse: same Instagram page except Pretendard URL.
// Remove GA4 from *both* variants only inside this test server to avoid fake hits.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd(),route='/services/instagram-influencer-marketing/';
const raw=fs.readFileSync(path.join(root,'services/instagram-influencer-marketing/index.html'),'utf8');
const full='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css';
const subset='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
if(raw.split(subset).length!==2||raw.includes(full))throw Error('Expected only dynamic-subset font link in candidate');
const scriptRe=/<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script>/;
const analyticsInit=/<script>\s*window\.dataLayer=window\.dataLayer\|\|\[\];[\s\S]*?gtag\('config','G-[^']+'\);\s*<\/script>/;
if(!scriptRe.test(raw)||!analyticsInit.test(raw))throw Error('GA4 script tags not found for test interception');
const candidate=raw.replace(scriptRe,'').replace(analyticsInit,'');
const baseline=candidate.replace(subset,full);
if(baseline.replace(full,subset)!==candidate)throw Error('A/B pages differ beyond font URL');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript',
 '.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4175');
  if(url.pathname===route){
   const body=url.searchParams.get('variant')==='control'?baseline:candidate;
   res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});
   res.end(body);return;
  }
  const fullpath=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!fullpath.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const st=fs.statSync(fullpath),file=st.isDirectory()?path.join(fullpath,'index.html'):fullpath;
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
server.listen(4175,'127.0.0.1',()=>console.log('LUEN_INSTAGRAM_FONT_SERVER_READY'));
