import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const V=Object.assign(Object.create(null),JSON.parse(fs.readFileSync('scripts/turkish-values.json','utf8')).values);
const walk=(x,o=[])=>{for(const e of fs.readdirSync(x,{withFileTypes:true})){const f=path.join(x,e.name);if(e.isDirectory())walk(f,o);else o.push(f)}return o};
const SQL=/\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|RETURNING|WHERE|ON CONFLICT)\b/i;
const NOATTR=/^(className|id|name|key|htmlFor|href|src|aria-.*|data-testid|placeholder|title|label|alt|style|type|role)$/;
const RES=new Set(['return','delete','new','default','in','of','if','else','for','while','do','switch','case','break','continue','import','export','this','void','typeof','with','yield','await','static','enum','null','true','false','try','catch','finally','throw','class','const','let','var','function']);
const sqlMap=(s)=>s.replace(/'([a-z][a-z_-]*)'/g,(m,k)=>V[k]?`'${V[k]}'`:m);
let n=0;
const files=['src','tests','scripts'].flatMap(d=>walk(d)).filter(f=>/\.(ts|tsx|mjs)$/.test(f)&&!/i18n|turkish|check-ident|build-mappings|refactor-rename|scan-ident|\.d\.ts/.test(f));
for(const f of files){
 const text=fs.readFileSync(f,'utf8'); const sf=ts.createSourceFile(f,text,99,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS); const reps=[];
 const push=(s,e,r)=>{ if(text.slice(s,e)!==r) reps.push([s,e,r]); };
 (function v(node){
  if(ts.isTemplateExpression(node)&&SQL.test(node.getText(sf))){ for(const part of [node.head,...node.templateSpans.map(s=>s.literal)]) push(part.getStart(sf),part.end,sqlMap(text.slice(part.getStart(sf),part.end))); node.templateSpans.forEach(s=>v(s.expression)); return; }
  if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))){
    const p=node.parent; const raw=text.slice(node.getStart(sf),node.end);
    if(ts.isImportDeclaration(p)||ts.isExportDeclaration(p)||ts.isExternalModuleReference(p)) return;
    if(SQL.test(node.text)||/'[a-z_-]+'/.test(node.text)) { push(node.getStart(sf),node.end,sqlMap(raw)); return; }
    if(Object.hasOwn(V,node.text)){
      if(ts.isCallExpression(p)&&/^(t|fill|useI18n)$/.test(p.expression.getText(sf))) return;
      if(ts.isJsxAttribute(p)&&NOATTR.test(p.name.getText(sf))) return;
      if(ts.isPropertyAssignment(p)&&p.name===node&&false) return;
      push(node.getStart(sf)+1,node.end-1,V[node.text]);
    }
    return;
  }
  if(ts.isIdentifier(node)&&Object.hasOwn(V,node.text)&&/^[a-z][a-z_]*$/.test(node.text)){
    const p=node.parent; const isKey=(ts.isPropertyAssignment(p)||ts.isPropertySignature(p)||ts.isPropertyAccessExpression(p)&&p.name===node||ts.isEnumMember(p))&&p.name===node;
    if(ts.isPropertyAccessExpression(p)&&p.name===node&&ts.isIdentifier(p.expression)&&/^(s|ui|k|styles|css|st)$/.test(p.expression.text)) return;
    if(ts.isImportSpecifier(p)||ts.isExportSpecifier(p)) return;
    push(node.getStart(sf),node.end,RES.has(V[node.text])&&!isKey?V[node.text]+'Value':V[node.text]);
  }
  ts.forEachChild(node,v);
 })(sf);
 if(reps.length){reps.sort((a,b)=>b[0]-a[0]);let o=text,last=Infinity;for(const[s,e,r]of reps){if(e>last)continue;o=o.slice(0,s)+r+o.slice(e);last=s;n++}fs.writeFileSync(f,o)}
}
console.log('replaced',n);
