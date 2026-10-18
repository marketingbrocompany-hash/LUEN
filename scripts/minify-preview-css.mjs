// Preview-only, reversible CSS minification. Source files remain unchanged.
// Do not remove selectors: some are revealed by scroll, menu and motion JS.
import {transform} from 'lightningcss';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('_site');
const styles=[
  'assets/css/site.css',
  'assets/css/luen-v3.css',
  'assets/css/luen-motion.css',
  'assets/css/luen-finish.css',
];
const reports=[];
for(const rel of styles){
  const p=path.join(root,rel);
  if(!fs.existsSync(p))throw new Error('Missing deployed stylesheet: '+rel);
  const before=fs.readFileSync(p);
  const out=transform({
    filename:p,
    code:before,
    minify:true,
    sourceMap:false,
    errorRecovery:false
  });
  if(!out.code.length)throw new Error('Minifier emitted empty stylesheet: '+rel);
  fs.writeFileSync(p,out.code);
  const percent=Number((100*(1-out.code.length/before.length)).toFixed(1));
  reports.push({path:rel,before:before.length,after:out.code.length,percent});
}
const totals=reports.reduce((a,r)=>({before:a.before+r.before,after:a.after+r.after}),{before:0,after:0});
const report={date:new Date().toISOString(),files:reports,
  totals:{...totals,percent:Number((100*(1-totals.after/totals.before)).toFixed(1))}};
fs.mkdirSync('qa-screenshots',{recursive:true});
fs.writeFileSync('qa-screenshots/css-deployment-report.json',JSON.stringify(report,null,2));
console.log('LUEN_CSS_BUILD '+JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY)
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
   '\n### Preview-only CSS minification\n'+
   reports.map(r=>'- '+r.path+': '+r.before+' → '+r.after+' bytes ('+r.percent+'% smaller)').join('\n')+
   '\n\nFour source CSS files stay unchanged; no rules intentionally discarded.\n');
