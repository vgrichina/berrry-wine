'use strict';
const {parseApproval}=require('./approval-prompt');
function chatReady(screen) {
  if(parseApproval(screen) || /Would you like to|Press enter to confirm/i.test(screen.slice(-5000)))return false;
  const lines=screen.trimEnd().split('\n');
  const index=lines.findLastIndex(line=>/^\s*›/.test(line));
  if(index<0 || !/^\s*›\s*(?:Ask Codex to do anything)?\s*$/.test(lines[index]))return false;
  return /\bgpt-[\w.-]+\b/i.test(lines.slice(index+1).join('\n'));
}
function hasCodexChild(output,panePid) {
  const rows=output.trim().split('\n').map(line=>/^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)).filter(Boolean);
  const parents=new Map(rows.map(r=>[+r[1],+r[2]]));
  return rows.some(r=>{
    if(!/(?:^|\/)codex$/.test(r[3]))return false;
    let pid=+r[1];const seen=new Set();
    while(pid && !seen.has(pid)){if(pid===panePid)return true;seen.add(pid);pid=parents.get(pid);}
    return false;
  });
}
// Codex collapses a long paste into "[Pasted Content N chars]" and shows only what follows it, so
// a leading placeholder stands for the message's first N characters; the visible tail must still match.
function draftMatches(draft,message) {
  const squash=s=>s.replace(/\s/g,'');
  const pasted=/^\s*\[Pasted Content (\d+) chars\]/.exec(draft);
  if(!pasted)return squash(draft)===squash(message);
  // N may count code points or UTF-16 units; they differ only when the paste has emoji.
  const n=Number(pasted[1]),tail=squash(draft.slice(pasted[0].length));
  const points=Array.from(message);
  return (n<=points.length&&squash(points.slice(n).join(''))===tail)||(n<=message.length&&squash(message.slice(n))===tail);
}
function chatSubmitKey(screen,message) {
  if(parseApproval(screen) || /Would you like to|Press enter to confirm/i.test(screen.slice(-5000)))return null;
  const lines=screen.trimEnd().split('\n'),index=lines.findLastIndex(line=>/^\s*›/.test(line));
  if(index<0)return null;
  const draft=[];
  for(let i=index;i<lines.length;i++){const line=lines[i].replace(i===index?/^\s*›\s?/:/^/,'');if(!line.trim())break;draft.push(line);}
  if(!draftMatches(draft.join(''),message))return null;
  const footer=lines.slice(index+draft.length).join('\n');
  // Enter steers the running turn; Tab defers chat until that turn finishes.
  if(/tab to queue message/i.test(footer))return 'Enter';
  return /\bgpt-[\w.-]+\b|\d+% context left/i.test(footer)?'Enter':null;
}
module.exports={chatReady,hasCodexChild,chatSubmitKey};
