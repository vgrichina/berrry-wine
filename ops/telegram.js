#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createBot,hash,COMMANDS}=require('./telegram-core');
const replies=require('./telegram-replies');
const inboxLib=require('./telegram-inbox');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'scratch/telegram');
const base=process.env.OPS_URL||'http://127.0.0.1:8098';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('OPS_URL must be loopback HTTP');
async function atomic(file,data){await fs.writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n',{mode:0o600});await fs.rename(file+'.tmp',file);}
async function findLog(agentId){
  const claude=/^claude:/.test(agentId||''),id=agentId?.replace(/^(codex|claude):/,'');if(!/^[a-f0-9-]{36}$/.test(id||''))return null;
  const start=claude?process.env.CLAUDE_PROJECTS_ROOT||path.join(os.homedir(),'.claude/projects'):process.env.CODEX_SESSIONS_ROOT||path.join(os.homedir(),'.codex/sessions');
  async function walk(d,depth){if(depth>4)return null;for(const e of await fs.readdir(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isFile()&&e.name.endsWith(id+'.jsonl'))return f;if(e.isDirectory()){const found=await walk(f,depth+1);if(found)return found;}}return null;}
  return walk(start,0);
}
async function main(){
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  const file=path.join(dir,'state.json');
  let state;try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={offset:0};}
  if(process.argv.includes('--pair')){
    if(state.owner)throw Error('Already paired. Stop the service and remove owner from local state to re-pair.');
    const code=crypto.randomBytes(16).toString('hex');state.pairing={hash:hash(code),expires:Date.now()+30*60000};await atomic(file,state);
    console.log('Pair in Telegram: /start '+code);return;
  }
  const token=(await fs.readFile(process.env.TELEGRAM_TOKEN_FILE||path.join(root,'scratch/telegram-token.txt'),'utf8')).trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid bot token file');
  async function telegram(method,body){
    let response;try{response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{throw Error('Telegram request timed out or unavailable');}
    const data=await response.json();if(!data.ok)throw Error('Telegram '+method+' failed ('+response.status+')');return data.result;
  }
  async function local(endpoint,body){
    let r;try{r=await fetch(base+endpoint,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}catch{throw Error('Local dashboard unavailable');}
    if(!r.ok){const error=Error((await r.text()).slice(0,300));error.status=r.status;throw error;}return r.json();
  }
  // Every image and file the owner sends is saved here, so the orchestrator can open it by path.
  // The Bot API serves files up to 20 MB.
  async function download(attachment,messageId){
    if(attachment.file_size>20*1024*1024)throw Error('over the Bot API 20 MB download limit');
    const info=await telegram('getFile',{file_id:attachment.file_id});
    if(!info.file_path)throw Error('Telegram returned no file path');
    const r=await fetch('https://api.telegram.org/file/bot'+token+'/'+info.file_path,{signal:AbortSignal.timeout(60000)});
    if(!r.ok)throw Error('download failed ('+r.status+')');
    const name=path.basename(attachment.file_name||info.file_path).replace(/[^A-Za-z0-9._-]/g,'_').slice(-80);
    const inbox=path.join(dir,'inbox');await fs.mkdir(inbox,{recursive:true,mode:0o700});
    const out=path.join(inbox,new Date().toISOString().replace(/[:.]/g,'-')+'-'+messageId+'-'+name);
    await fs.writeFile(out,Buffer.from(await r.arrayBuffer()),{mode:0o600});return out;
  }
  const inboxFile=path.join(root,inboxLib.INBOX);
  const inbox=entry=>inboxLib.appendInbox(inboxFile,entry);
  async function inboxStatus(){
    let consumers=[];try{consumers=JSON.parse(await fs.readFile(path.join(root,'ops/work-watchdog.json'),'utf8')).telegramInbox?.consumers||[];}catch{}
    const entries=await inboxLib.readInbox(inboxFile);
    return {last:entries.at(-1)?.id||0,consumers:consumers.map(c=>({agent:c.agent,cursor:inboxLib.readCursorSync(inboxLib.cursorPath(dir,c.agent))}))};
  }
  const save=()=>atomic(file,state),bot=createBot({state,save,telegram,local,download,inbox,inboxStatus});
  // Messages left in the old pane-typing queue move to the inbox instead of being dropped.
  if(state.chatQueue?.length||state.chatAttempt){
    for(const item of [...(state.chatAttempt?[state.chatAttempt]:[]),...(state.chatQueue||[])])await inbox({text:item.text,attachments:[],at:new Date(item.at||Date.now()).toISOString()});
    delete state.chatQueue;delete state.chatAttempt;await save();
  }
  if(state.replyPolicyVersion!==2){state.replyQueue=(state.replyQueue||[]).filter(x=>x.direct);state.replyPolicyVersion=2;state.replyDeliveryVersion=1;await save();}
  const me=await telegram('getMe',{});console.log('Telegram bridge connected: @'+me.username);
  const webhook=await telegram('getWebhookInfo',{});if(webhook.url)throw Error('Bot has a webhook configured; remove it before long polling');
  await telegram('setMyCommands',{commands:COMMANDS});
  let log=null,logId=null;
  const typingTimer=setInterval(()=>{void bot.typing();},4000);typingTimer.unref();
  while(true){
    try {
      const updates=await telegram('getUpdates',{offset:state.offset,timeout:5,allowed_updates:['message','callback_query']});
      for(const update of updates){state.offset=update.update_id+1;await save();try{await bot.handle(update);}catch{if(state.owner)await bot.send('Bridge request failed. Use /status or /screen to check; actions are not automatically replayed.').catch(()=>{});}}
      if(state.owner){
        // Approval monitoring must not hold up replies when the dashboard is unavailable.
        try{
          const snapshot=await local('/api/state');
          const prompts=snapshot.approvals?.items||[];
          for(const p of prompts)await bot.notifyApproval(p);
          if(!prompts.some(p=>p.terminalId==='orchestrator')&&!snapshot.approvals?.warnings?.length){
            if(state.pending?.messageId)await telegram('editMessageReplyMarkup',{chat_id:state.owner.chatId,message_id:state.pending.messageId,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
            state.pending=null;state.notified=null;await save();
          }
        }catch(e){state.approvalError={at:Date.now(),message:e.message};await save();}
        const terminal=JSON.parse(await fs.readFile(path.join(root,'ops/terminals.json'),'utf8')).terminals?.find(t=>t.id==='orchestrator');
        if(terminal?.agentId!==logId){logId=terminal?.agentId;log=await findLog(logId);if(state.logId!==logId){state.logId=logId;state.logOffset=log?(await fs.stat(log)).size:0;}await save();}
        if(log){
          const size=(await fs.stat(log)).size;
          // Recover recent Telegram turn identities without replaying historical output.
          if(state.replySeedLogId!==logId){
            const handle=await fs.open(log,'r'),start=Math.max(0,size-8*1024*1024),buffer=Buffer.alloc(size-start);
            try{await handle.read(buffer,0,buffer.length,start);}finally{await handle.close();}
            for(const line of buffer.toString().split('\n')){try{const r=JSON.parse(line);if(r.payload?.role==='user')replies.enqueue(state,r);}catch{}}
            state.replySeedLogId=logId;await save();
          }
          if(size<state.logOffset){state.logOffset=size;await save();}
          if(size>state.logOffset){
            const handle=await fs.open(log,'r');let buffer;
            try{buffer=Buffer.alloc(Math.min(size-state.logOffset,2*1024*1024));const {bytesRead}=await handle.read(buffer,0,buffer.length,state.logOffset);buffer=buffer.subarray(0,bytesRead);}finally{await handle.close();}
            const end=buffer.lastIndexOf(10);
            if(end>=0){for(const line of buffer.subarray(0,end).toString().split('\n')){try{replies.enqueue(state,JSON.parse(line));}catch{}}state.logOffset+=end+1;await save();}
            else if(buffer.length===2*1024*1024){state.logOffset+=buffer.length;state.replyError={at:Date.now(),message:'Skipped oversized session record'};await save();}
          }
        }
        await replies.flush(state,save,bot.send);
      }
      process.send?.({type:'heartbeat'});
      await atomic(path.join(dir,'health.json'),{pid:process.pid,updatedAt:new Date().toISOString(),paired:!!state.owner,status:'running'});
    }catch{console.error(new Date().toISOString()+' Bridge connection unavailable; retrying.');process.send?.({type:'heartbeat'});await new Promise(r=>setTimeout(r,3000));}
  }
}
main().catch(()=>{console.error('Telegram bridge startup failed; check token, state, local dashboard and network.');process.exitCode=1;});
