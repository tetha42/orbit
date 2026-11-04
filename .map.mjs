import fs from 'node:fs';
const dict=JSON.parse(fs.readFileSync('src/db/legacy/words.json','utf8'));
const W=Object.assign(Object.create(null),dict.words), DATA=new Set(dict.dataWords||[]);
export const MI=Object.assign(Object.create(null),{doneMi:'isDone',publicOpenMi:'isPublicOpen',importantMi:'isImportant',iLikedMi:'likedByMe',deliveredMi:'isDelivered',lockedMi:'isLocked',trashedMi:'isTrashed',pinnedMi:'isPinned',newImportantMi:'newIsImportant',validMi:'isValid',captainMi:'isCaptain',leaderMi:'isLeader',kamuyaAcikMi:'isPublicOpen',kilitliMi:'isLocked',gecerliMi:'isValid',onemliMi:'isImportant'});
const RES=new Set(['return','delete','new','default','in','of','if','else','for','while','do','switch','case','break','continue','import','export','this','void','typeof','with','yield','await','static','enum','null','true','false','try','catch','finally','throw','class','const','let','var','function','order','end','user','group','limit','table','column','check','desc','asc','from','to','all','any','select','where','like','not','or','on','union','unique','using','when','then','else','case','cast','create','window']);
const PIECE=/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+|_+|\$+|[^A-Za-z0-9_$]+/g;
export function mapIdent(id){
  if(MI[id]) return MI[id];
  const pieces=id.match(PIECE)??[id]; let ch=false;
  const out=pieces.map((p,i)=>{const e=W[p.toLowerCase()]; if(!/^[A-Za-z]+$/.test(p)||e===undefined)return p; ch=true; if(p.length>1&&p===p.toUpperCase())return e.toUpperCase(); if(i>0||/^[A-Z]/.test(p))return e[0].toUpperCase()+e.slice(1); return e;});
  return ch?out.join(''):id;
}
export const isReserved=(s)=>RES.has(s);
