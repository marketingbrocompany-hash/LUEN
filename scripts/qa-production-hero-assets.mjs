// Verify GitHub Pages actually serves the published poster files.
// Read-only post-deploy check: HTTP 200, WebP signature and non-empty bytes.
const base='https://luenkorea.com';
const images=[
  ['confier','20261021-hq',11966],
  ['quadthera','20261021-hq',26478],
  ['clinic','20261103-hero-safe',42520]
];
const results=[],errors=[];
for(const [name,version,size] of images){
  const url=base+'/assets/images/luen-motion/'+name+'-poster.webp?v='+version;
  let success=false;
  for(let attempt=1;attempt<=4;attempt++){
    try{
      const res=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'LUEN-PRODUCTION-POSTER-QA/1.0','Cache-Control':'no-cache'}});
      const bytes=Buffer.from(await res.arrayBuffer());
      const valid=res.status===200 && bytes.length===size &&
        bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
      results.push({name,attempt,status:res.status,bytes:bytes.length,contentType:res.headers.get('content-type'),valid});
      if(valid){success=true;break;}
    }catch(e){results.push({name,attempt,error:String(e.message).slice(0,180)});}
    if(attempt<4)await new Promise(r=>setTimeout(r,1500));
  }
  if(!success)errors.push(name+' poster not served as expected by live GitHub Pages');
}
console.log('LUEN_LIVE_POSTER_ASSETS '+JSON.stringify({results,errors}));
if(errors.length)process.exitCode=1;
