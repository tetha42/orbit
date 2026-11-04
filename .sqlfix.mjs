import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
import {mapIdent,isReserved} from './.map.mjs';
const ts=createRequire(import.meta.url)('typescript');
const walk=(x,o=[])=>{for(const e of fs.readdirSync(x,{withFileTypes:true})){const f=path.join(x,e.name);if(e.isDirectory())walk(f,o);else o.push(f)}return o};
const fix=(s)=>{
  let t=s.replace(/\bAS\s+(")?([A-Za-z_][A-Za-z0-9_]*)\1/gi,(m,q,x)=>{ if(/^[A-Z]+$/.test(x)&&!q)return m; const r=mapIdent(x); const rr=(isReserved(r)&&!q)?`"${r}"`:(q?`"${r}"`:r); return `AS ${rr}`; });
  t=t.replace(/->>?\s*'([A-Za-z_][A-Za-z0-9_]*)'/g,(m,x)=>m.replace(`'${x}'`,`'${mapIdent(x)}'`));
  t=t.replace(/'([A-Za-z_][A-Za-z0-9_]*)'(\s*,\s*[a-z]\w*\.)/g,(m,x,c)=>`'${mapIdent(x)}'${c}`); // json_build_object('key', alias.col
  return t;
};
let n=0;
for(const f of ['src'].flatMap(d=>walk(d)).filter(f=>/\.(ts|tsx)$/.test(f)&&!/i18n/.test(f))){
 const text=fs.readFileSync(f,'utf8'); const sf=ts.createSourceFile(f,text,99,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS); const reps=[];
 (function v(node){
  const lit=ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node);
  if(lit){ const raw=text.slice(node.getStart(sf),node.end); if(/\bAS\s|->>?\s*'|build_object/i.test(raw)){ const r=fix(raw); if(r!==raw)reps.push([node.getStart(sf),node.end,r]); } }
  ts.forEachChild(node,v)})(sf);
 if(reps.length){reps.sort((a,b)=>b[0]-a[0]);let o=text;for(const[s,e,r]of reps){o=o.slice(0,s)+r+o.slice(e);n++}fs.writeFileSync(f,o)}
}
console.log('sql fixes',n);
