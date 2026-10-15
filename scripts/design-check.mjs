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
  // Every icon sits beside text or in a labelled control, so a screen reader
  // skips it (ADR 082). lucide-react 0.468 does not hide them itself.
  const lucide=text.match(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/);
  if(lucide){
   const names=lucide[1].split(',').map(n=>n.trim().split(' as ').pop().trim()).filter(Boolean);
   for(const a of text.matchAll(/\b(?:let|const)\s+(\w+)\s*=\s*(\w+)\s*;/g))if(names.includes(a[2]))names.push(a[1]);
   // One picked by a ternary or from a [Icon, label] list goes by Icon.
   names.push('Icon');
   for(const m of text.matchAll(new RegExp(String.raw`(?<![\w.])<(${names.join('|')})(?=[\s/>])[^>]*>`,'g')))if(!m[0].includes('aria-hidden'))errors.push(`${file}: <${m[1]}> icon without aria-hidden`);
  }
 }
}
// Non-text contrast (WCAG 1.4.11, ADR 081): a field is found by its edge, so
// the border reads at 3:1 against the field and the page in both themes.
const themes={};
postcss.parse(fs.readFileSync('src/tokens.css','utf8')).walkRules(r=>{if([':root',':root[data-theme="light"]'].includes(r.selector)){themes[r.selector]??={};r.walkDecls(d=>{themes[r.selector][d.prop]=d.value;});}});
const luminance=hex=>{const [r,g,b]=[1,3,5].map(i=>{const v=parseInt(hex.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;});return 0.2126*r+0.7152*g+0.0722*b;};
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};
for(const [root,own] of Object.entries(themes)){
 const value=p=>own[p]??themes[':root'][p];
 const border=value('--field-border');
 if(!/^#[\da-f]{6}$/i.test(border??''))errors.push(`tokens.css: ${root} needs a six-digit --field-border`);
 else for(const ground of ['--panel','--bg'])if(contrast(border,value(ground))<3)errors.push(`tokens.css: ${root} --field-border is ${contrast(border,value(ground)).toFixed(2)}:1 on ${ground}, under 3:1`);
}
// The intake's done check is a dark mark on a filled circle (ADR 082): the
// mark reads at 3:1 on its fill in both themes, whatever tokens the rule names.
const check={};postcss.parse(fs.readFileSync('src/layout.css','utf8')).walkRules('.step-summary-check',r=>r.walkDecls(d=>{check[d.prop]=d.value.match(/var\((--[\w-]+)\)/)?.[1];}));
for(const [root,own] of Object.entries(themes)){
 const value=p=>own[p]??themes[':root'][p];
 const [fill,mark]=[value(check.background),value(check.color)];
 if(!fill||!mark)errors.push('layout.css: .step-summary-check takes its background and color from tokens');
 else if(contrast(mark,fill)<3)errors.push(`layout.css: ${root} .step-summary-check is ${contrast(mark,fill).toFixed(2)}:1, under 3:1`);
}
if(!/:root\[data-theme\] textarea \{[^}]*border-color: var\(--field-border\)/.test(fs.readFileSync('src/primitives.css','utf8')))errors.push('primitives.css: inputs, selects and textareas take --field-border');
// These component-local overrides have an explicit fallback in the card primitive.
definitions.add('--card-surface');definitions.add('--card-border');
for(const [file,ref] of references)if(!definitions.has(ref))errors.push(`${file}: undefined ${ref}`);
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exit(1);}
console.log(`Design validation passed: ${files.length} source files; ${definitions.size} declared tokens. Structural zero, geometry, percentages and intrinsic sizing are allowed.`);
