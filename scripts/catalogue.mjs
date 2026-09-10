import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import fs from 'node:fs';
export function parseCsv(text) {
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('Unclosed CSV quotation');if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}const header=rows.shift();if(!header||new Set(header).size!==header.length)throw Error('Missing or duplicate CSV headers');
 return rows.filter(r=>r.some(Boolean)).map((r,n)=>{if(r.length!==header.length)throw Error(`Column count mismatch at row ${n+2}`);return Object.fromEntries(header.map((h,i)=>[h.replace(/^\uFEFF/,''),r[i]]));});
}
export function compile(issues,questions){
 const ids=new Set(), keys=new Set(); const output=[];
 for(const r of issues){if(!/^[a-z][a-z0-9-]*$/.test(r.id)||ids.has(r.id))throw Error('Invalid/duplicate issue ID '+r.id);ids.add(r.id);if(!r.title||!r.pattern||!r.example||!r.qualification||!r.category)throw Error('Missing required issue field '+r.id);if(!['Offered','Review first','Referral only'].includes(r.availability))throw Error('Invalid availability '+r.id);if(!Number.isFinite(Number(r.priority)))throw Error('Invalid priority '+r.id);new RegExp(r.pattern,'i');if(r.exclude)new RegExp(r.exclude,'i');if(new RegExp(r.pattern,'i').test(''))throw Error('Pattern must not match empty text '+r.id);
 output.push({...r,priority:Number(r.priority),questions:[]});}
 for(const q of questions){if(!ids.has(q.issue_id)||!q.id||!q.label)throw Error('Invalid question reference '+q.issue_id);const key=q.issue_id+':'+q.id;if(keys.has(key))throw Error('Duplicate question '+key);keys.add(key);const opts=q.options?q.options.split('|'):undefined;if(opts&&new Set(opts).size!==opts.length)throw Error('Duplicate choices '+key);output.find(i=>i.id===q.issue_id).questions.push({id:q.id,label:q.label,...(opts?{options:opts}:{})});}
 for(const i of output)if(i.questions.length<3)throw Error('At least three questions required '+i.id);
 return output;
}
if(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
const data=compile(parseCsv(fs.readFileSync('catalogue/issues.csv','utf8')),parseCsv(fs.readFileSync('catalogue/questions.csv','utf8')));
const json=JSON.stringify(data,null,2)+'\n';const table='# Service and clarification catalogue\n\nNormalized from word-matrix.csv plus the existing issue library. Source licence flags are unverified reference notes, not legal determinations.\n\n| Issue | Availability | Questions | Source rows |\n|---|---|---|---|\n'+data.map(i=>`| ${i.title} | ${i.availability} | ${i.questions.map(q=>q.label.replaceAll('|','/')).join('<br>')} | ${i.source_rows||'Existing library'} |`).join('\n')+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync('src/catalogue.generated.json','utf8').replaceAll('\r\n','\n')!==json||fs.readFileSync('CLARIFICATION-CATALOGUE.md','utf8').replaceAll('\r\n','\n')!==table)throw Error('Catalogue is stale: run npm run catalogue:generate');}else{fs.writeFileSync('src/catalogue.generated.json',json);fs.writeFileSync('CLARIFICATION-CATALOGUE.md',table);}
console.log(`Validated ${data.length} issues and ${data.reduce((n,i)=>n+i.questions.length,0)} questions`);

}
