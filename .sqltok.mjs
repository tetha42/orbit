import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
import {mapIdent,isReserved} from './.map.mjs';
const ts=createRequire(import.meta.url)('typescript');
const dict=JSON.parse(fs.readFileSync('src/db/legacy/words.json','utf8')); const W=Object.assign(Object.create(null),dict.words);
const KEEP=new Set(['AS','NOT','ASC','DESC']);
const walk=(x,o=[])=>{for(const e of fs.readdirSync(x,{withFileTypes:true})){const f=path.join(x,e.name);if(e.isDirectory())walk(f,o);else o.push(f)}return o};
const SQL=/\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|WITH\s+\w+\s+AS|RETURNING|ORDER BY|GROUP BY)\b/;
const tok=(t)=>{ if(/^[A-Z_0-9]+$/.test(t)) return t; if(t.includes('_')||/^[a-z0-9]+$/.test(t)){ const ps=t.split('_'); let ch=false; const o=ps.map(p=>{const e=W[p]; if(e!==undefined){ch=true;return e.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())} return p}); if(!ch)return t; const r=o.join('_'); return isReserved(r)?`"${r}"`:r; } const r=mapIdent(t); return r;};
const proc=(s)=>{ // outside single quotes
  let out='',i=0; const parts=s.split(/('(?:[^']|'')*')/); return parts.map((seg,k)=>k%2? seg : seg.replace(/"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g,(m)=>{ if(m.startsWith('"'))return `"${mapIdent(m.slice(1,-1))}"`; return m.split('.').map(tok).join('.'); })).join('');
};
let n=0;
for(const f of walk('src').filter(f=>/\.(ts|tsx)$/.test(f)&&!/i18n/.test(f))){
 const text=fs.readFileSync(f,'utf8'); const sf=ts.createSourceFile(f,text,99,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS); const reps=[];
 (function v(node){
  if(ts.isTemplateExpression(node)){ const full=node.getText(sf); if(SQL.test(full)){ for(const part of [node.head,...node.templateSpans.map(s=>s.literal)]){ const raw=text.slice(part.getStart(sf),part.end); const m=proc(raw); if(m!==raw)reps.push([part.getStart(sf),part.end,m]); } node.templateSpans.forEach(s=>v(s.expression)); return; } }
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){ if(SQL.test(node.text)){ const raw=text.slice(node.getStart(sf),node.end); const m=proc(raw); if(m!==raw)reps.push([node.getStart(sf),node.end,m]); return; } }
  ts.forEachChild(node,v)})(sf);
 if(reps.length){reps.sort((a,b)=>b[0]-a[0]);let o=text;for(const[s,e,r]of reps){o=o.slice(0,s)+r+o.slice(e);n++}fs.writeFileSync(f,o)}
}
console.log('sql token fixes',n);
