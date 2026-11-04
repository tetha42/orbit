import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const walk=(x,o=[])=>{for(const e of fs.readdirSync(x,{withFileTypes:true})){const f=path.join(x,e.name);if(e.isDirectory())walk(f,o);else o.push(f)}return o};
let n=0;
for(const f of ['src','tests','scripts'].flatMap(d=>walk(d)).filter(f=>/\.(ts|tsx|mjs)$/.test(f)&&!/i18n|turkish|check-ident/.test(f))){
 const text=fs.readFileSync(f,'utf8'); const sf=ts.createSourceFile(f,text,99,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS); const cut=[];
 (function v(node){
  if(ts.isObjectLiteralExpression(node)||ts.isInterfaceDeclaration(node)||ts.isTypeLiteralNode(node)){
    const members=ts.isObjectLiteralExpression(node)?node.properties:node.members; const seen=new Set();
    members.forEach((m,i)=>{ const nm=m.name&&(ts.isIdentifier(m.name)||ts.isStringLiteral(m.name))?m.name.text:null; if(!nm)return; if(seen.has(nm)){ const prev=i>0?members[i-1].end:node.getStart(sf)+1; cut.push([prev,m.end]); } else seen.add(nm); });
  }
  ts.forEachChild(node,v)})(sf);
 if(cut.length){cut.sort((a,b)=>b[0]-a[0]);let o=text,last=Infinity;for(const[s,e]of cut){if(e>last)continue;o=o.slice(0,s)+o.slice(e);last=s;n++}fs.writeFileSync(f,o)}
}
console.log('dup members removed',n);
