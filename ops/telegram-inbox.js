'use strict';
// Telegram inbox: the bot never types into an agent pane. Each owner message is
// appended to scratch/telegram/inbox.jsonl as one JSON line
//   {"id":N,"at":"<ISO>","text":"...","attachments":["/abs/path", ...]}
// and consumers read past their own cursor file
//   scratch/telegram/inbox.<agent>.cursor   (plain integer: last id read)
// replying with ops/telegram-send.js. The work watchdog only nudges an idle or
// stalled consumer with one fixed line (nudgeDecision); it never pastes text.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const INBOX='scratch/telegram/inbox.jsonl';
const cursorPath=(dir,agent)=>{
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(agent||''))throw Error('invalid inbox consumer name');
  return path.join(dir,'inbox.'+agent+'.cursor');
};
function parseLines(text){
  const out=[];
  for(const line of text.split('\n')){if(!line.trim())continue;try{const e=JSON.parse(line);if(Number.isSafeInteger(e?.id))out.push(e);}catch{}}
  return out;
}
async function readInbox(file){
  try{return parseLines(await fsp.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}
}
// Ids derive from the file itself, so they survive restarts and stay monotonic.
// The bot is the single writer; one appendFile call per line keeps readers from
// ever seeing a partial line.
async function appendInbox(file,{text='',attachments=[],at=new Date().toISOString()}={}){
  await fsp.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  const entries=await readInbox(file);
  const id=entries.reduce((max,e)=>Math.max(max,e.id),0)+1;
  const entry={id,at,text:String(text),attachments:attachments.map(String)};
  await fsp.appendFile(file,JSON.stringify(entry)+'\n',{mode:0o600});
  await fsp.chmod(file,0o600).catch(()=>{});
  return entry;
}
function readCursorSync(file){
  try{const n=Number.parseInt(fs.readFileSync(file,'utf8').trim(),10);return Number.isSafeInteger(n)&&n>0?n:0;}
  catch(e){if(e.code==='ENOENT')return 0;throw e;}
}
async function readUnread(file,cursor=0){return (await readInbox(file)).filter(e=>e.id>cursor);}
function readUnreadSync(file,cursor=0){
  try{return parseLines(fs.readFileSync(file,'utf8')).filter(e=>e.id>cursor);}catch(e){if(e.code==='ENOENT')return [];throw e;}
}
const nudgeLine=n=>`[Telegram inbox] ${n} unread in ${INBOX} - read past your cursor`;
const NUDGE_RE=/^\[Telegram inbox\] \d{1,9} unread in scratch\/telegram\/inbox\.jsonl - read past your cursor$/;
// Screen states that leave a consumer unable to pick up its inbox by itself.
const stalledScreen=screen=>/Goal stalled|usage limit|limit reached|hit your (?:usage )?limit|rate limit/i.test(String(screen||'').slice(-4000));
// Pure decision: unread entries older than staleMs, consumer at an empty prompt
// (idle) or stalled, no draft/prompt open, and at most one nudge per cooldownMs.
// terminal: {id, idle, stalled, promptOpen} from /api/work-status, or undefined.
function nudgeDecision({unread=[],terminal,consumer={},previous={},now=Date.now(),config={}}){
  const record={...previous,checkedAt:now,unread:unread.length};
  const skip=reason=>({send:false,record:{...record,reason}});
  if(config.enabled===false||config.paused)return skip('paused');
  if(!unread.length)return skip('no unread entries');
  const oldest=Math.min(...unread.map(e=>Date.parse(e.at)).filter(Number.isFinite));
  if(!Number.isFinite(oldest)||now-oldest<(config.staleMs??180000))return skip('unread entries are recent');
  if(!terminal)return skip('consumer terminal not registered');
  if(terminal.promptOpen)return skip('draft or prompt open');
  if(!terminal.idle&&!terminal.stalled)return skip('consumer busy');
  if(previous.lastNudgeAt&&now-previous.lastNudgeAt<(config.cooldownMs??900000))return skip('cooldown');
  return {send:true,message:nudgeLine(unread.length),goalResume:consumer.kind==='codex'&&!!terminal.stalled,
    record:{...record,reason:terminal.stalled?'stalled consumer with unread inbox':'idle consumer with unread inbox'}};
}
module.exports={INBOX,cursorPath,appendInbox,readInbox,readUnread,readUnreadSync,readCursorSync,nudgeLine,NUDGE_RE,stalledScreen,nudgeDecision};
