// LUEN: deterministic, AST-verified CSS staging for static site delivery.
// Keeps authored assets/css/*.css readable and unchanged. Only edits copies in
// _site (or an explicit qa-temp-* staging tree). Never deploys by itself.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import assert from 'node:assert/strict';
import postcss from 'postcss';

const styles=['assets/css/site.css','assets/css/luen-v3.css'];
const stageArg=process.argv.indexOf('--stage');
const stage=path.resolve(stageArg>=0?process.argv[stageArg+1]:'_site');
const root=path.resolve('.');
const allowed=stage===path.join(root,'_site') ||
 stage.startsWith(path.join(root,'qa-temp-')) ||
 stage.startsWith(path.join(root,'qa-stage-'));
if(!allowed||stage===root||!fs.existsSync(path.join(stage,'index.html')))
 throw Error('Refusing to write outside a prepared _site / qa-stage-* / qa-temp-* tree');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const semantics=node=>{
 switch(node.type){
 case 'root':return ['root',(node.nodes||[]).filter(x=>x.type!=='comment').map(semantics)];
 case 'rule':return ['rule',node.selector,(node.nodes||[]).filter(x=>x.type!=='comment').map(semantics)];
 case 'atrule':return ['atrule',node.name,node.params,node.nodes?
  node.nodes.filter(x=>x.type!=='comment').map(semantics):null];
 case 'decl':return ['decl',node.prop,node.value,!!node.important];
 default:throw Error('Unsupported CSS rule: '+node.type);
 }
};
const emit=node=>{
 switch(node.type){
 case 'root':return (node.nodes||[]).map(emit).join('');
 case 'comment':return node.text.trim().startsWith('!')?'/*'+node.text+'*/':'';
 case 'rule':return node.selector+'{'+(node.nodes||[]).map(emit).join('')+'}';
 case 'atrule':return '@'+node.name+(node.params?' '+node.params:'')+
  (node.nodes?'{'+node.nodes.map(emit).join('')+'}':';');
 case 'decl':return node.prop+':'+node.value+(node.important?'!important':'')+';';
 default:throw Error('Unsupported CSS rule: '+node.type);
 }
};
const bytes=s=>Buffer.byteLength(s),zip=s=>gzipSync(s,{level:9}).length,
 brotli=s=>brotliCompressSync(s).length;
const result=[];
for(const file of styles){
 const original=fs.readFileSync(path.join(root,file),'utf8');
 const stagedPath=path.join(stage,file);
 if(!fs.existsSync(stagedPath))throw Error('Missing staged stylesheet: '+file);
 const staged=fs.readFileSync(stagedPath,'utf8');
 assert.equal(staged,original,'Staged stylesheet differs from authored source: '+file);
 const origAst=postcss.parse(original,{from:file});
 const compressed=emit(origAst);
 const newAst=postcss.parse(compressed,{from:file+'.minified'});
 assert.deepEqual(semantics(origAst),semantics(newAst),
  'CSS selectors, order, at-rules, declarations or values changed: '+file);
 if(bytes(compressed)>=bytes(original))throw Error('No compression achieved: '+file);
 // Never overwrite authored source file; only same-relative-path in staging.
 fs.writeFileSync(stagedPath,compressed,'utf8');
 result.push({file,source_sha256:sha(original),stage_sha256:sha(compressed),
  source_bytes:bytes(original),stage_bytes:bytes(compressed),
  source_gzip:zip(original),stage_gzip:zip(compressed),
  source_brotli:brotli(original),stage_brotli:brotli(compressed),
  semantically_identical:true});
}
const totals=result.reduce((a,r)=>({
 source_bytes:a.source_bytes+r.source_bytes,
 stage_bytes:a.stage_bytes+r.stage_bytes,
 source_gzip:a.source_gzip+r.source_gzip,
 stage_gzip:a.stage_gzip+r.stage_gzip,
 source_brotli:a.source_brotli+r.source_brotli,
 stage_brotli:a.stage_brotli+r.stage_brotli
}),{source_bytes:0,stage_bytes:0,source_gzip:0,stage_gzip:0,
 source_brotli:0,stage_brotli:0});
const report={scope:'staged files only: NEVER modify source CSS or HTML',files:result,totals};
fs.mkdirSync('qa-screenshots',{recursive:true});
fs.writeFileSync('qa-screenshots/css-lossless-staging-report.json',
 JSON.stringify(report,null,2)+'\n');
console.log('LUEN_CSS_STAGING_LOSSLESS '+JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY)
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '### AST-exact staged CSS minification (no source edits)\n\n'+
  result.map(r=>'- '+r.file+': '+r.source_bytes+' → '+r.stage_bytes+
  ' bytes (gzip '+r.source_gzip+' → '+r.stage_gzip+')').join('\n')+
  '\n\nOriginal stylesheet source SHA256 unchanged.\n');
