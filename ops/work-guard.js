'use strict';
const {chatReady,chatSubmitKey}=require('./telegram-guard');
const {parseApproval}=require('./approval-prompt');
function workReady(screen,provider) {
  if(parseApproval(screen)||/esc to (?:interrupt|cancel)|tab to queue|Would you like to|Press enter to confirm/i.test(screen.slice(-5000)))return false;
  const prompts=screen.split('\n').filter(l=>/^\s*[›❯]/.test(l));
  const lastMessage=prompts.filter(l=>!/^\s*[›❯]\s*(?:Ask Codex to do anything)?\s*$/.test(l)).at(-1)||'';
  if(/^\s*[›❯]\s*(?:\[Telegram\]\s*)?(?:stop|pause|wait|hold off|do not continue|don't continue)\b/i.test(lastMessage))return false;
  if(provider==='codex')return chatReady(screen);
  if(provider!=='claude')return false;
  const lines=screen.trimEnd().split('\n'),i=lines.findLastIndex(l=>/^\s*❯/.test(l));
  return i>=0 && /^\s*❯\s*$/.test(lines[i]) && /bypass permissions|accept edits|shift.tab to cycle/i.test(lines.slice(i+1).join('\n'));
}
function workSubmitKey(screen,message,provider) {
  if(provider==='codex')return chatSubmitKey(screen,message);
  if(provider!=='claude'||parseApproval(screen)||/esc to interrupt|Would you like to|Press enter to confirm/i.test(screen.slice(-5000)))return null;
  const lines=screen.trimEnd().split('\n'),i=lines.findLastIndex(l=>/^\s*❯/.test(l));
  if(i<0)return null;
  const draft=[];
  for(let n=i;n<lines.length;n++){const l=lines[n].replace(n===i?/^\s*❯\s?/:/^/,'');if(!l.trim()||/^[─━]+/.test(l))break;draft.push(l);}
  return draft.join('').replace(/\s/g,'')===message.replace(/\s/g,'')?'Enter':null;
}
// Telegram chat into a Claude pane: Claude queues input typed while it works, so only
// an approval prompt, a modal question or an existing draft blocks delivery.
function claudeDraft(screen){
  const lines=screen.trimEnd().split('\n'),i=lines.findLastIndex(l=>/^\s*❯/.test(l));
  if(i<0)return null;
  const draft=[];
  for(let n=i;n<lines.length;n++){const l=lines[n].replace(n===i?/^\s*❯\s?/:/^/,'');if(!l.trim()||/^[─━]+/.test(l))break;draft.push(l);}
  return draft.join('');
}
function claudeChatReady(screen){
  if(parseApproval(screen)||/Would you like to|Press enter to confirm/i.test(screen.slice(-5000)))return false;
  return claudeDraft(screen)==='' && /bypass permissions|accept edits|shift.tab to cycle/i.test(screen.slice(-3000));
}
function claudeChatSubmitKey(screen,message){
  if(parseApproval(screen))return null;
  const draft=claudeDraft(screen);
  if(draft===null)return null;
  // Claude Code collapses long typed input into a placeholder, so a long message
  // never appears verbatim; the placeholder alone in the box is that message.
  if(message.length>=200 && /^\s*\[Pasted text #\d+[^\]]*\]\s*$/.test(draft))return 'Enter';
  return draft.replace(/\s/g,'')===message.replace(/\s/g,'')?'Enter':null;
}
// `capture-pane -e` text to plain text. Claude Code prints a suggested next prompt in
// dim text after an empty `❯`; read as a draft it blocks every Telegram delivery, so dim
// runs on prompt lines are dropped before the escapes are.
const SGR=/\x1b\[[0-9;]*m/g;
function plainScreen(ansi){
  return ansi.split('\n').map(line=>{
    if(/^\s*[›❯]/.test(line.replace(SGR,'')))line=line.replace(/\x1b\[2m[\s\S]*?(?=\x1b\[(?:0|22)?m|$)/g,'');
    return line.replace(SGR,'');
  }).join('\n');
}
// An approval, modal question or typed draft is open: the inbox nudge must not touch the pane.
function promptOpen(screen,provider){
  if(parseApproval(screen)||/Would you like to|Press enter to confirm/i.test(screen.slice(-5000)))return true;
  if(provider==='claude')return !!claudeDraft(screen);
  const lines=screen.trimEnd().split('\n'),i=lines.findLastIndex(l=>/^\s*›/.test(l));
  return i>=0 && !/^\s*›\s*(?:Ask Codex to do anything)?\s*$/.test(lines[i]);
}
module.exports={workReady,workSubmitKey,claudeChatReady,claudeChatSubmitKey,plainScreen,promptOpen,claudeDraft};
