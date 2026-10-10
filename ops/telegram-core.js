'use strict';
const crypto=require('node:crypto');
const {approvalIdentity}=require('./approval-prompt');
const formatting=require('./telegram-format');
const {statusText}=require('./telegram-status');
const {blockersText}=require('./telegram-blockers');
const COMMANDS=[{command:'status',description:'Current task summary'},{command:'blockers',description:'Blockers and actions from the dashboard'},{command:'screen',description:'Orchestrator terminal'},{command:'approvals',description:'Review pending approval'},{command:'queue',description:'Unread inbox messages per agent'},{command:'cancel',description:'Explain why saved messages cannot be cancelled'},{command:'help',description:'Chat and approval help'}];
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const promptHash=p=>hash(p.terminalId+'\n'+approvalIdentity(p.prompt));
const isStatusQuestion=text=>/^(?:\/status|status|(?:ascii(?: art)? )?tldr(?: status)?|(?:what['’]?s|whats['’]?|whtas['’]?) (?:the )?latest|any updates?|sup|hi|hey)[?!.]*$/i.test(text.trim());
const HELP='Messages, images and files are saved to the agent inbox (scratch/telegram/inbox.jsonl) and acknowledged as Saved #N; agents read it and reply here.\n'+COMMANDS.map(c=>'/'+c.command+' — '+c.description).join('\n')+'\n\nApproval buttons accept once, decline, or allow the displayed persistent rule when supported. Plain chat never answers a permission prompt. Direct answers and explicit milestones are forwarded; routine progress stays on the dashboard.';
// Anything the owner attaches: the largest photo size, or any file, video, audio, voice note, animation or sticker.
const attachmentOf=m=>{
  if(m?.photo?.length)return {...m.photo[m.photo.length-1],kind:'image'};
  for(const kind of ['document','video','animation','audio','voice','video_note','sticker'])if(m?.[kind]?.file_id)return {...m[kind],kind:/^image\//.test(m[kind].mime_type||'')?'image':kind};
  return null;
};
// inbox(entry) appends {text,attachments} to the inbox file and returns it with its id;
// inboxStatus() optionally returns {last,consumers:[{agent,cursor}]} for /queue.
function createBot({state,save,telegram,local,download,inbox,inboxStatus,now=Date.now}) {
  let typingBusy=false,lastTyping=0;
  async function typing(){
    if(typingBusy||!state.owner||!state.lastChat||state.pending||now()-state.lastChat.at>10*60000||state.lastDirectReplyAt>=state.lastChat.at||now()-lastTyping<3500)return;
    typingBusy=true;lastTyping=now();
    try{await telegram('sendChatAction',{chat_id:state.owner.chatId,action:'typing'});}catch{}finally{typingBusy=false;}
  }
  const send=async(text,extra={})=>{
    const chunks=String(text).match(/[\s\S]{1,3500}/g)||['(empty)'];
    let result;for(let i=0;i<chunks.length;i++)result=await telegram('sendMessage',{chat_id:state.owner.chatId,text:chunks[i],...(i===chunks.length-1?extra:{})});return result;
  };
  const authorized=(user,chat)=>!!state.owner && chat?.type==='private' && user?.id===state.owner.userId && chat.id===state.owner.chatId;
  async function sendStatus({ascii=false}={}){
    const s=await local('/api/state');
    const text=statusText(s,{ascii});
    const result=await send(text,ascii?{entities:[{type:'pre',offset:0,length:text.length}]}:{});
    state.lastStatusDelivery={at:now(),messageId:result?.message_id};await save();return result;
  }
  async function notifyApproval(p) {
    const key=promptHash(p);
    if(!state.owner || p.sent || p.terminalId!=='orchestrator')return;
    const parts=formatting.approval(p);
    if(state.notified===key){
      if(state.pending?.messageId&&state.pending.formatVersion!==1&&parts.length===1){
        await telegram('editMessageText',{chat_id:state.owner.chatId,message_id:state.pending.messageId,text:parts[0].text,entities:parts[0].entities,reply_markup:{inline_keyboard:[[{text:'Accept once',callback_data:'a:'+state.pending.id}],...(p.allowRule?[[{text:'Always allow shown rule',callback_data:'p:'+state.pending.id}]]:[]),[{text:'Decline',callback_data:'d:'+state.pending.id}]]}});
        state.pending.formatVersion=1;await save();
      }
      return;
    }
    if(state.pending?.messageId)await telegram('editMessageReplyMarkup',{chat_id:state.owner.chatId,message_id:state.pending.messageId,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
    state.pending={id:p.id,hash:key,formatVersion:1};await save();
    const buttons=[{text:'Accept once',callback_data:'a:'+p.id}];
    if(p.allowRule)buttons.push({text:'Always allow shown rule',callback_data:'p:'+p.id});
    buttons.push({text:'Decline',callback_data:'d:'+p.id});
    let message;
    for(let i=0;i<parts.length;i++)message=await send(parts[i].text,{entities:parts[i].entities,...(i===parts.length-1?{reply_markup:{inline_keyboard:buttons.map(b=>[b])}}:{})});
    state.pending.messageId=message.message_id;state.notified=key;await save();
  }
  async function handle(update) {
    const callback=update.callback_query,m=update.message;
    if(callback){
      if(!authorized(callback.from,callback.message?.chat))return;
      await telegram('answerCallbackQuery',{callback_query_id:callback.id,text:'Checking current prompt…'});
      const match=/^([adp]):([a-f0-9]{48})$/.exec(callback.data||''),pending=state.pending;
      const snapshot=await local('/api/state');
      const refresh=async()=>{
        await telegram('editMessageReplyMarkup',{chat_id:state.owner.chatId,message_id:callback.message.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
        const current=snapshot.approvals?.items.find(p=>!p.sent&&p.terminalId==='orchestrator');
        if(current)await notifyApproval(current);
        if(state.staleNotice!==callback.message.message_id){state.staleNotice=callback.message.message_id;await save();await send(current?'That button is no longer current. Review the current approval above.':'That request is already closed.');}
      };
      if(!match || !pending || pending.id!==match[2] || pending.messageId!==callback.message.message_id)return refresh();
      const live=snapshot.approvals?.items.find(p=>!p.sent && p.terminalId==='orchestrator' && promptHash(p)===pending.hash);
      if(!live || (match[1]==='p'&&!live.allowRule)){state.pending=null;state.notified=null;await save();return refresh();}
      state.pending=null;await save(); // Consume before delivery: never replay an ambiguous approval.
      try{await local('/api/approval-decision',{id:live.id,decision:match[1]==='a'?'accept':match[1]==='p'?'allow-rule':'decline'});await send(match[1]==='a'?'Accepted once.':match[1]==='p'?'Approved the persistent rule shown in the prompt.':'Declined.');}
      catch(e){await send(e.message+' No automatic retry. Use /screen to inspect.');}
      await telegram('editMessageReplyMarkup',{chat_id:state.owner.chatId,message_id:callback.message.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
      return;
    }
    if(!m || m.chat?.type!=='private' || m.from?.is_bot)return;
    const attachment=attachmentOf(m);
    if(typeof m.text!=='string' && !attachment)return;
    if(!state.owner){
      const code=/^\/start ([a-f0-9]{32})$/.exec(m.text);
      if(!code || !state.pairing || state.pairing.expires<now() || hash(code[1])!==state.pairing.hash){
        return telegram('sendMessage',{chat_id:m.chat.id,text:'Hi! This bot is not paired yet. Open the private pairing link from your dashboard setup conversation and tap Start, or paste its /start code here. If the link expired, ask for a new one. No orchestrator access is enabled until pairing succeeds.'});
      }
      state.owner={userId:m.from.id,chatId:m.chat.id};delete state.pairing;state.pairedAt=now();await save();
      return send('Hi! I’m connected to the Wine Assembly orchestrator. This private account is now paired. Send me a message and I’ll pass it on.\n\n'+HELP);
    }
    if(!authorized(m.from,m.chat))return;
    if(m.date && now()-m.date*1000>5*60000)return send('Old message ignored. Please resend it if still needed.');
    const text=(m.text??m.caption??'').trim();
    // Anything with an attachment is inbox content, even when its caption looks like a command.
    if(attachment||!text.startsWith('/')&&!isStatusQuestion(text))return saveToInbox(text,attachment,m.message_id);
    if(['/help','/start'].includes(text))return send(HELP);
    if(text==='/queue'){
      const s=inboxStatus?await inboxStatus():null;
      if(!s)return send('Messages are saved to the inbox as they arrive; nothing waits in the bridge.');
      return send(`Inbox last #${s.last}.\n`+(s.consumers.map(c=>`${c.agent}: read to #${c.cursor}, ${Math.max(0,s.last-c.cursor)} unread`).join('\n')||'No consumers configured.'));
    }
    if(text==='/cancel')return send('Nothing to cancel: messages are saved to the inbox as soon as they arrive. Send a correction instead.');
    if(text==='/screen'){const s=await local('/api/orchestrator-screen');for(const part of formatting.chunks([{text:s.text,type:'pre'}]))await send(part.text,{entities:part.entities});return;}
    if(/^\/blockers(?:@[A-Za-z0-9_]+)?$/.test(text))return send(blockersText(await local('/api/state')));
    if(isStatusQuestion(text))return sendStatus({ascii:/\bascii\b/i.test(text)});
    if(text==='/approvals'){const s=await local('/api/state');const p=s.approvals?.items.find(p=>p.terminalId==='orchestrator'&&!p.sent);if(!p)return send('No supported live command-approval prompt. /screen shows other prompts.');state.notified=null;return notifyApproval(p);}
    return send(HELP);
  }
  // The bot never types into an agent pane: every message becomes one inbox line,
  // attachments are recorded by path only, and consumers watch the file.
  async function saveToInbox(text,attachment,messageId){
    if(!inbox)return send('The inbox is not available in this bridge build; nothing was saved.');
    const attachments=[];
    if(attachment){
      if(!download)return send('Attachments are not supported by this bridge build.');
      try{attachments.push(await download(attachment,messageId));}catch(e){return send('Could not save the attachment: '+e.message);}
    }
    let entry;try{entry=await inbox({text,attachments});}catch(e){return send('Could not save to the inbox: '+e.message);}
    state.lastChat={text,at:now(),inboxId:entry.id};await save();
    await send('Saved #'+entry.id);
    lastTyping=0;await typing();
    return entry;
  }
  return {handle,notifyApproval,send,sendStatus,typing};
}
module.exports={createBot,hash,COMMANDS};
