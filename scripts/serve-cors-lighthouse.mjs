// Static test server for CORS preconnect Lighthouse A/B; never deploy.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hint='<!-- CDN CSS uses ordinary fetch; font faces use a separate anonymous CORS connection. -->\n<link crossorigin="" href="https://cdn.jsdelivr.net" rel="preconnect"/>\n';
if(html.split(hint).length!==2)throw Error('Candidate must contain exactly one CORS preconnect hint');
const baseline=html.replace(hint,'');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript',
 '.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4175');
  if(url.pathname==='/'){
    const isBase=url.searchParams.get('font-ab')==='baseline';
    res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});
    res.end(isBase?baseline:html);return;
  }
  const full=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const stat=fs.statSync(full),filename=stat.isDirectory()?path.join(full,'index.html'):full;
  res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(filename).pipe(res);
 }catch{res.writeHead(404);res.end();}
});
server.listen(4175,'127.0.0.1',()=>console.log('LUEN_CORS_AB_SERVER_READY 4175'));
