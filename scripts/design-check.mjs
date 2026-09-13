import fs from 'node:fs';
import postcss from 'postcss';
const files=fs.readdirSync('src').filter(f=>/\.(css|tsx)$/.test(f));
const definitions=new Set();const references=[];const errors=[];
const canonical=new Set();
postcss.parse(fs.readFileSync('src/tokens.css','utf8')).walkDecls(d=>{if(d.prop.startsWith('--'))canonical.add(d.prop);});
for(const file of files){
 const text=fs.readFileSync('src/'+file,'utf8');
 for(const m of text.matchAll(/var\((--[\w-]+)/g))references.push([file,m[1]]);
 if(file.endsWith('.css')){
  const ast=postcss.parse(text,{from:file});
  ast.walkRules(r=>{if(file!=='tokens.css'&&r.selectors.some(s=>/^:root\[data-theme(?:=[^\]]+)?\]$/.test(s.trim())))errors.push(`${file}: theme root owned by tokens.css`);});
  ast.walkDecls(d=>{
   if(d.prop.startsWith('--'))definitions.add(d.prop);
   if(d.prop.includes('var('))errors.push(`${file}: invalid property ${d.prop}`);
   if(file==='tokens.css')return;
   if(canonical.has(d.prop))errors.push(`${file}: canonical token ${d.prop} must be defined only in tokens.css`);
   if(/#[\da-f]{3,8}\b|\brgba?\(/i.test(d.value))errors.push(`${file}: literal color in ${d.prop}`);
   if(/^(?:border-radius|z-index|box-shadow|text-shadow)$/.test(d.prop)&&!d.value.includes('var(')&&!['0','none','auto','inherit'].includes(d.value))errors.push(`${file}: untokenized ${d.prop}`);
   if(d.value.includes('gradient('))errors.push(`${file}: gradient belongs in tokens.css`);
  });
 }else{
  for(const m of text.matchAll(/size=\{(\d+)\}/g))if(![16,20,24,32,48].includes(+m[1]))errors.push(`${file}: icon size ${m[1]}`);
  if(/(?:fill|stroke|color|background)(?:=|:)\s*["']#[\da-f]{3,8}/i.test(text))errors.push(`${file}: inline color literal`);
 }
}
// These component-local overrides have an explicit fallback in the card primitive.
definitions.add('--card-surface');definitions.add('--card-border');
for(const [file,ref] of references)if(!definitions.has(ref))errors.push(`${file}: undefined ${ref}`);
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exit(1);}
console.log(`Design validation passed: ${files.length} source files; ${definitions.size} declared tokens. Structural zero, geometry, percentages and intrinsic sizing are allowed.`);
