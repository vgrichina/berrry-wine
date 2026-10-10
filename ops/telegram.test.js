'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBot,hash}=require('./telegram-core');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const inbox=require('./telegram-inbox'),{appendInbox,readUnread}=inbox;
const {chatReady,hasCodexChild,chatSubmitKey}=require('./telegram-guard');
const prompt={id:'a'.repeat(48),terminalId:'orchestrator',prompt:'Exact command: echo hello',sent:false};
function fixture(){const state={owner:{userId:10,chatId:10}},calls=[],actions=[],saved=[];let live=prompt;
 const bot=createBot({state,save:async()=>{},telegram:async(method,body)=>{calls.push({method,body});return {message_id:20};},local:async(url,body)=>{if(url==='/api/state')return {tasks:[],approvals:{items:live?[live]:[]}};actions.push({url,body});return {sent:true};},inbox:async e=>{const entry={id:saved.length+1,...e};saved.push(entry);return entry;}});
 return {state,bot,calls,actions,saved,live:p=>live=p};}
const message=(text,id=10,type='private')=>({message:{text,date:Date.now()/1000,from:{id},chat:{id,type}}});
test('/blockers matches dashboard grouping and stays read-only for authorized users',async()=>{
 const snapshot={tasks:[
  {id:'root',title:'Restore game files',status:'blocked',line:1,needs:'Restore archive',blocker:'Files absent',owner:'codex:one'},
  {id:'child',title:'Verify game',status:'blocked',line:2,dependencies:['root']},
  {id:'done',title:'Old blocker',status:'done',blocker:'Resolved'},
  {id:'review',title:'Review validation',status:'blocked',line:3,waitingOn:'Automated review',blocker:'Review stopped execution'},
 ],approvals:{items:[{reason:'Check exact command',terminalId:'orchestrator'},{reason:'Old approval',sent:true}]},terminals:[{agentId:'codex:one',label:'Fixture owner'}]};
 const calls=[],reads=[],state={owner:{userId:10,chatId:10}};
 const bot=createBot({state,save:async()=>{},telegram:async(method,body)=>{calls.push({method,body});return{};},local:async(url,body)=>{assert.equal(body,undefined);reads.push(url);return snapshot;}});
 await bot.handle(message('/blockers',11));await bot.handle(message('/blockers',10,'group'));
 assert.equal(reads.length,0);
 await bot.handle(message('/blockers@wine_bot'));
 assert.deepEqual(reads,['/api/state']);assert.equal(state.chatQueue,undefined);
 const text=calls.map(x=>x.body.text).join('\n');
 assert.match(text,/1 live approvals · 2 primary blockers · 1 dependent tasks/);
 assert.match(text,/Next: Restore archive/);assert.match(text,/Reason: Files absent/);assert.match(text,/Owner: Fixture owner/);
 assert.match(text,/Also holds up: Verify game \[child\]/);assert.match(text,/No dashboard override/);
 assert(!text.includes('Old blocker'));assert(!text.includes('Old approval'));
 assert.match(text,/1 need your input · 1 agent-resolvable/);assert.match(text,/NEEDS YOUR INPUT\n\nReview validation \[review\]/);assert.match(text,/AGENT-RESOLVABLE\n\nRestore game files \[root\]/);assert.match(text,/Who: No waitingOn recorded/);
});
test('/blockers empty state and command menu/help share the command catalog',async()=>{
 const f=fixture();f.live(null);await f.bot.handle(message('/blockers'));
 assert.match(f.calls.at(-1).body.text,/No blocked tasks recorded/);
 await f.bot.handle(message('/help'));
 const {COMMANDS}=require('./telegram-core');
 assert(COMMANDS.some(x=>x.command==='blockers'));
 for(const c of COMMANDS)assert(f.calls.at(-1).body.text.includes('/'+c.command+' — '+c.description));
 assert.equal(f.actions.length,0);
});
test('Remote Codex capitalized model footer permits an empty prompt and exact chat submission',()=>{
 assert(chatReady('› Ask Codex to do anything\n\n  GPT-6-Astra medium · ~/wine-assembly'));
 assert.equal(chatSubmitKey('› [Telegram] hello\n\n  GPT-6-Astra medium · ~/wine-assembly','[Telegram] hello'),'Enter');
 assert(!chatReady('› existing draft\n\n  GPT-6-Astra medium'));
});
test('Telegram ignores other users and groups; chat never becomes a direct approval',async()=>{const f=fixture();await f.bot.handle(message('hello',11));await f.bot.handle(message('hello',10,'group'));assert.equal(f.actions.length,0);await f.bot.handle(message('yes'));assert.equal(f.actions.length,0,'chat never reaches a dashboard endpoint');assert.deepEqual(f.saved,[{id:1,text:'yes',attachments:[]}]);assert.equal(f.calls.find(c=>c.method==='sendMessage').body.text,'Saved #1');});
test('Pairing requires secret, expiry, private account; only one owner',async()=>{const f=fixture();delete f.state.owner;f.state.pairing={hash:hash('f'.repeat(32)),expires:Date.now()+1000};await f.bot.handle(message('/start '+'e'.repeat(32)));assert(!f.state.owner);await f.bot.handle(message('/start '+'f'.repeat(32)));assert.equal(f.state.owner.userId,10);assert.match(f.calls[0].body.text,/Hi!/);await f.bot.handle(message('/start '+'f'.repeat(32),11));assert.equal(f.state.owner.userId,10);});
test('Approval binds user/message/exact prompt, consumes before dispatch and rejects replay',async()=>{const f=fixture();await f.bot.notifyApproval(prompt);const cb={callback_query:{id:'q',from:{id:10},message:{message_id:20,chat:{id:10,type:'private'}},data:'a:'+prompt.id}};await f.bot.handle({...cb,callback_query:{...cb.callback_query,from:{id:11}}});assert.equal(f.actions.length,0);await f.bot.handle(cb);assert.equal(f.actions.length,1);assert.deepEqual(f.actions[0].body,{id:prompt.id,decision:'accept'});await f.bot.handle(cb);assert.equal(f.actions.length,1);});
test('Changed and expired prompts cannot be approved',async()=>{const f=fixture();await f.bot.notifyApproval(prompt);f.live({...prompt,prompt:'Different command'});await f.bot.handle({callback_query:{id:'q',from:{id:10},message:{message_id:20,chat:{id:10,type:'private'}},data:'a:'+prompt.id}});assert.equal(f.actions.length,0);});
test('Chat guard rejects shells, drafts and approval menus; process ancestry must match',()=>{assert(chatReady('Working\n› Ask Codex to do anything\n gpt-6-astra medium · project'));assert(!chatReady('$ shell\n'));assert(!chatReady('› unfinished draft\n gpt-6-astra'));assert(!chatReady('Would you like to run the following command?\n› Ask Codex to do anything\n gpt-6-astra'));assert(hasCodexChild('100 1 node\n101 100 /vendor/bin/codex',100));assert(!hasCodexChild('100 1 node\n101 2 /vendor/bin/codex',100));});
test('Pairing expires but an unchanged live approval remains usable after ten minutes',async()=>{
 const f=fixture();delete f.state.owner;f.state.pairing={hash:hash('f'.repeat(32)),expires:Date.now()-1000};
 await f.bot.handle(message('/start '+'f'.repeat(32)));assert(!f.state.owner);
 f.state.owner={userId:10,chatId:10};await f.bot.notifyApproval(prompt);f.state.pending.expires=Date.now()-1000;
 await f.bot.handle({callback_query:{id:'q',from:{id:10},message:{message_id:20,chat:{id:10,type:'private'}},data:'a:'+prompt.id}});
 assert.equal(f.actions.length,1);
});
test('Plain start explains pairing without granting access',async()=>{
 const f=fixture();delete f.state.owner;
 await f.bot.handle(message('/start'));
 assert(!f.state.owner);assert.equal(f.actions.length,0);
 assert.match(f.calls[0].body.text,/not paired yet/);
 assert.equal(f.calls[0].body.chat_id,10);
});
test('Chat steers a busy turn instead of queuing behind it and requires the exact draft',()=>{
 const busy='Working\n› [Telegram] status\n\n  tab to queue message 69% context left';
 assert.equal(chatSubmitKey(busy,'[Telegram] status'),'Enter');
 assert.equal(chatSubmitKey(busy,'different draft'),null);
 assert.equal(chatSubmitKey('Would you like to run the following command?\n'+busy,'[Telegram] status'),null);
 assert.equal(chatSubmitKey('› [Telegram] status\n\n gpt-6-astra medium','[Telegram] status'),'Enter');
});
test('Chat submission accepts a long paste Codex collapsed into a [Pasted Content N chars] placeholder',()=>{
 const head='[Telegram] Jezzball crashes when '+'the ball hits a wall. '.repeat(46),tail='Steps: open it, start a game, wait.';
 const msg=head+tail,n=head.length;assert(n>1000);
 const screen=n=>'Working\n› [Pasted Content '+n+' chars]'+tail+'\n\n  tab to queue message 61% context left';
 assert.equal(chatSubmitKey(screen(n),msg),'Enter');
 assert.equal(chatSubmitKey('› [Pasted Content '+n+' chars] '+tail+'\n\n gpt-6-astra medium',msg),'Enter');
 assert.equal(chatSubmitKey(screen(n+1),msg),null,'wrong N leaves a different tail');
 assert.equal(chatSubmitKey(screen(n),msg+' extra'),null,'tail must match');
 assert.equal(chatSubmitKey(screen(msg.length+5),msg),null,'N past the end');
 const emoji='[Telegram] 🎮 '+'x'.repeat(1100);
 assert.equal(chatSubmitKey('› [Pasted Content '+Array.from(emoji).length+' chars]end\n\n gpt-6-astra medium',emoji+'end'),'Enter');
});
test('Approval dedup survives dashboard IDs changing; callback resolves fresh ID',async()=>{
 const f=fixture();await f.bot.notifyApproval(prompt);
 const changed={...prompt,id:'b'.repeat(48)};f.live(changed);await f.bot.notifyApproval(changed);
 assert.equal(f.calls.filter(c=>c.method==='sendMessage').length,1);
 await f.bot.handle({callback_query:{id:'q',from:{id:10},message:{message_id:20,chat:{id:10,type:'private'}},data:'a:'+prompt.id}});
 assert.equal(f.actions[0].body.id,changed.id);
});
test('Approval identity ignores background output but preserves command spaces',()=>{
 const {parseApproval,approvalIdentity}=require('./approval-prompt');
 const p="Would you like to run the following command?\n\n$ echo 'a  b'\n\n› 1. Yes, proceed (y)\n2. No, and tell Codex what to do differently (esc)\n\nPress enter to confirm or esc to cancel";
 assert.equal(approvalIdentity(parseApproval('old progress\n'+p).prompt),approvalIdentity(parseApproval('new progress\n'+p).prompt));
 assert.notEqual(approvalIdentity(p),approvalIdentity(p.replace('a  b','a b')));
});
test('Persistent approval is offered only for the observed rule option',async()=>{
 const f=fixture();await f.bot.notifyApproval(prompt);
 assert.equal(f.calls[0].body.reply_markup.inline_keyboard.flat().length,2);
 f.state.notified=null;const p={...prompt,allowRule:true};f.live(p);await f.bot.notifyApproval(p);
 assert.equal(f.calls.filter(c=>c.method==='sendMessage').at(-1).body.reply_markup.inline_keyboard.flat().length,3);
 await f.bot.handle({callback_query:{id:'q',from:{id:10},message:{message_id:20,chat:{id:10,type:'private'}},data:'p:'+prompt.id}});
 assert.equal(f.actions[0].body.decision,'allow-rule');
});
test('Direct final replies persist failures, resume chunks and deduplicate',async()=>{
 const {enqueue,flush}=require('./telegram-replies'),state={telegramActiveTurn:true};let saved=0,sent=[];
 const record={type:'response_item',payload:{type:'message',id:'m1',role:'assistant',phase:'final_answer',content:[{type:'output_text',text:'Status '+ 'x'.repeat(4000)}]}};
 enqueue(state,record);enqueue(state,record);assert.equal(state.replyQueue.length,1);
 const save=async()=>{saved++;};let attempts=0;
 await flush(state,save,async text=>{if(++attempts===2)throw Error('offline');sent.push(text);return {message_id:1};},()=>100);
 assert.equal(state.replyQueue[0].next,1);assert.equal(sent.length,1);assert(saved>0);
 const restored=JSON.parse(JSON.stringify(state));await flush(restored,save,async text=>{sent.push(text);return {message_id:2};},()=>20000);
 assert.equal(restored.replyQueue.length,0);assert.equal(sent.length,2);
 enqueue(restored,record);assert.equal(restored.replyQueue.length,0);
 enqueue(restored,{...record,payload:{...record.payload,id:'analysis',phase:'analysis'}});assert.equal(restored.replyQueue.length,0);
});
test('Quiet delivery suppresses routine progress and autonomous finals, preserves direct answers and explicit milestones',()=>{
 const {enqueue,formatChunks}=require('./telegram-replies'),s={};
 const user=(text,turn)=>({type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text}],internal_chat_message_metadata_passthrough:{turn_id:turn}}});
 const answer=(id,phase,turn,text='Answer')=>({type:'response_item',payload:{type:'message',id,role:'assistant',phase,content:[{type:'output_text',text}],internal_chat_message_metadata_passthrough:{turn_id:turn}}});
 enqueue(s,user('[Telegram] status','direct'));enqueue(s,answer('p','commentary','direct'));
 enqueue(s,answer('a','final_answer','direct'));assert.equal(s.replyQueue.length,1);assert.equal(s.replyQueue[0].chunks[0].text,'Answer');
 enqueue(s,user('Continue goal','background'));enqueue(s,answer('b','final_answer','background'));assert.equal(s.replyQueue.length,1);
 enqueue(s,answer('c','final_answer','background','[Telegram update] Task completed.'));assert.equal(s.replyQueue.length,2);
 const chunks=formatChunks('Status\n```text\nRUNNING  Game\n```\nNext.');
 assert(!chunks[0].text.includes('```'));const e=chunks[0].entities[0];assert.equal(chunks[0].text.slice(e.offset,e.offset+e.length),'RUNNING  Game\n');
 enqueue(s,answer('heading','final_answer','direct','Orchestrator\n\nShort answer.'));
 assert.equal(s.replyQueue.at(-1).chunks[0].text,'Short answer.');
});
test('Approvals format exact commands and rules as code and omit terminal keyboard instructions',()=>{
 const {approval,chunks}=require('./telegram-format');
 const command="ssh example 'echo <hello> & exit 0'";
 const p={command,reason:'Run the check?',allowRule:true,prompt:"Would you like to run the following command?\n$ "+command+"\n› 1. Yes, proceed (y)\n2. Yes, and don't ask again for commands that start with `ssh example` (p)\n3. No, and tell Codex what to do differently (esc)\nPress enter to confirm"};
 const part=approval(p)[0];
 assert(!part.text.includes('Press enter'));assert(!part.text.includes('1. Yes'));
 const code=part.entities.filter(e=>e.type==='pre').map(e=>part.text.slice(e.offset,e.offset+e.length));
 assert.equal(code[0],command);assert.match(code[1],/`ssh example`/);
 const long='😀'+ '<&'.repeat(4000);const parts=chunks([{text:long,type:'pre'}]);
 assert.equal(parts.map(p=>p.text).join(''),long);assert(parts.every(p=>p.text.length<=3000&&p.entities[0].length===p.text.length));
});
test('An existing approval is reformatted in place without another notification',async()=>{
 const f=fixture();await f.bot.notifyApproval(prompt);delete f.state.pending.formatVersion;
 await f.bot.notifyApproval(prompt);
 assert.equal(f.calls.filter(c=>c.method==='sendMessage').length,1);
 assert.equal(f.calls.filter(c=>c.method==='editMessageText').length,1);
});
test('Chat is appended to the inbox, acknowledged as Saved #N, never typed into a pane and has no length limit',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tg-inbox-')),file=path.join(dir,'inbox.jsonl'),state={owner:{userId:10,chatId:10}},calls=[],local=[];
 const make=()=>createBot({state,save:async()=>{},telegram:async(method,body)=>{calls.push({method,body});return {};},local:async url=>{local.push(url);return {};},inbox:e=>appendInbox(file,e)});
 await make().handle(message('capture next game'));
 const long='x'.repeat(9000);await make().handle(message(long));
 assert.deepEqual(local,[],'no dashboard call, so nothing can type into a terminal');
 const sent=calls.filter(c=>c.method==='sendMessage').map(c=>c.body.text);
 assert.deepEqual(sent,['Saved #1','Saved #2']);
 const lines=fs.readFileSync(file,'utf8').trimEnd().split('\n').map(l=>JSON.parse(l));
 assert.deepEqual(lines.map(l=>[l.id,l.text.length,l.attachments]),[[1,17,[]],[2,9000,[]]]);
 assert.equal(fs.statSync(file).mode&0o777,0o600);
 assert.equal(state.chatQueue,undefined);assert.equal(state.lastChat.inboxId,2);
 await make().handle(message('/cancel'));assert.match(calls.at(-1).body.text,/Nothing to cancel/);
});
test('Successful save shows typing until the answer or approval',async()=>{
 const state={owner:{userId:10,chatId:10}},calls=[];let time=Date.now();
 const bot=createBot({state,now:()=>time,save:async()=>{},local:async()=>({}),inbox:async e=>({id:1,...e}),telegram:async(method,body)=>{calls.push({method,body});return {};}});
 await bot.handle(message('check the game screenshots'));assert.deepEqual(calls.map(c=>c.method),['sendMessage','sendChatAction']);assert.equal(calls[1].body.action,'typing');
 await bot.typing();assert.equal(calls.length,2);
 time+=4000;await bot.typing();assert.equal(calls.length,3);
 state.pending={};time+=4000;await bot.typing();assert.equal(calls.length,3);
 state.pending=null;state.lastDirectReplyAt=time;await bot.typing();assert.equal(calls.length,3);
 state.lastDirectReplyAt=0;time+=11*60000;await bot.typing();assert.equal(calls.length,3);
});
test('Status questions reply from dated dashboard state without touching a busy terminal',async()=>{
 const calls=[],requests=[],state={owner:{userId:10,chatId:10}};
 const bot=createBot({state,save:async()=>{},telegram:async(method,body)=>{calls.push({method,body});return {message_id:42};},local:async url=>{requests.push(url);assert.equal(url,'/api/state');return {tasks:[],projectStatus:{available:true,body:'Checking gameplay screenshots.',updatedAt:'2026-10-03T09:00:00Z'}};}});
 for(const text of ["whtas' latest",'sup','/status','ascii art tldr status'])await bot.handle(message(text));
 assert.equal(requests.length,4);assert.equal(calls.length,4);
 assert(calls.every(c=>c.method==='sendMessage'&&c.body.text.includes('TASK STATUS')&&c.body.text.includes('2026-10-03 09:00 UTC')));
 assert.equal(calls[3].body.entities[0].type,'pre');
 assert.equal(calls[3].body.entities[0].length,calls[3].body.text.length);
 assert(!calls[0].body.entities);
 assert.equal(state.chatQueue,undefined);assert.equal(state.lastStatusDelivery.messageId,42);
});
test('TLDR stays bounded for a large ledger and never dumps STATUS prose',()=>{
 const {statusText}=require('./telegram-status');
 const snapshot={tasks:Array.from({length:200},(_,i)=>({status:i<10?'active':'blocked',title:'Gameplay qualification '.repeat(20)})),candidates:[],projectStatus:{body:'SECRET_LONG_PROSE'.repeat(100)}};
 const text=statusText(snapshot,{ascii:true});
 assert(text.length<1100);assert(!text.includes('SECRET_LONG_PROSE'));
 assert.match(text,/ACTIVE  10/);assert.match(text,/BLOCKED 190/);
 assert(text.split('\n').every(line=>line.length===50));
});
test('Claude orchestrator: busy pane still accepts chat into an empty prompt, never over a draft or approval',()=>{
  const {claudeChatReady,claudeChatSubmitKey}=require('./work-guard');
  const busy='● Working on it\n✻ Imagining… (12s)\n─────\n❯ \n─────\n  ⏵⏵ bypass permissions on · esc to interrupt';
  assert.equal(claudeChatReady(busy),true);
  assert.equal(claudeChatReady(busy.replace('❯ ','❯ half-typed note')),false);
  assert.equal(claudeChatReady('just a shell $'),false);
  const text='[Telegram] status?';
  assert.equal(claudeChatSubmitKey(busy.replace('❯ ','❯ '+text),text),'Enter');
  assert.equal(claudeChatSubmitKey(busy,text),null);
  const long='[Telegram] '+'wep16_chips: CHIP01.MID '.repeat(20);
  assert.equal(claudeChatSubmitKey(busy.replace('❯ ','❯ [Pasted text #3 +2 lines]'),long),'Enter');
  assert.equal(claudeChatSubmitKey(busy.replace('❯ ','❯ [Pasted text #3]'),text),null);
  assert.equal(claudeChatSubmitKey(busy.replace('❯ ','❯ note [Pasted text #3]'),long),null);
});
test('Claude transcript replies: final text after a Telegram prompt is direct, tool chatter is not',()=>{
  const replies=require('./telegram-replies'),state={};
  const user=(content,extra={})=>({type:'user',timestamp:'t',uuid:'u'+Math.random(),message:{role:'user',content},...extra});
  const said=(text,stop,uuid)=>({type:'assistant',timestamp:'t',uuid,message:{id:'m',stop_reason:stop,content:[{type:'text',text}]}});
  replies.enqueue(state,user('[Telegram] how is myth going?'));
  replies.enqueue(state,said('Checking the board.','tool_use','a1'));
  replies.enqueue(state,user([{type:'tool_result',tool_use_id:'x',content:'ok'}]));
  replies.enqueue(state,said('Myth worker is on the demo search.','end_turn','a2'));
  replies.enqueue(state,user('[Telegram] ignore',{isSidechain:true}));
  assert.deepEqual(state.replyQueue.map(r=>[r.id,r.text,r.direct]),[['a2','Myth worker is on the demo search.',true]]);
  replies.enqueue(state,user('local keyboard prompt'));
  replies.enqueue(state,said('Autonomous final.','end_turn','a3'));
  replies.enqueue(state,said('[Telegram update] Myth demo found.','end_turn','a4'));
  assert.deepEqual(state.replyQueue.map(r=>r.id),['a2','a4']);
});
test('Claude transcript replies: Telegram chat queued while busy still gets its answer relayed',()=>{
  const replies=require('./telegram-replies'),state={};
  const said=(text,stop,uuid)=>({type:'assistant',timestamp:'t',uuid,message:{id:'m',stop_reason:stop,content:[{type:'text',text}]}});
  const queued=prompt=>({type:'attachment',timestamp:'t',attachment:{type:'queued_command',prompt}});
  replies.enqueue(state,{type:'user',timestamp:'t',message:{role:'user',content:[{type:'text',text:'<task-notification>done</task-notification>'}]}});
  replies.enqueue(state,queued('[Telegram] still cannot see them'));
  replies.enqueue(state,said('Fixed: they had no category.','end_turn','q1'));
  replies.enqueue(state,queued('local note typed while busy'));
  replies.enqueue(state,said('Autonomous final.','end_turn','q2'));
  assert.deepEqual(state.replyQueue.map(r=>[r.id,r.direct]),[['q1',true]]);
});

test('a dim Claude prompt suggestion is not a draft', () => {
  const {claudeChatReady,plainScreen}=require('./work-guard');
  const rule='\x1b[38;5;244m'+'─'.repeat(40)+'\x1b[0m';
  const footer='  \x1b[38;5;211m⏵⏵ bypass permissions on\x1b[0m (shift+tab to cycle) · ← for agents';
  const ghost=['✻ Churned for 1m 52s',rule,'\x1b[39m❯ \x1b[2myes, list the clean merged Codex worktrees\x1b[0m',rule,footer].join('\n');
  assert.equal(claudeChatReady(plainScreen(ghost)),true);
  const typed=ghost.replace('\x1b[2myes, list','typed by hand, list');
  assert.equal(claudeChatReady(plainScreen(typed)),false);
  assert.match(plainScreen('\x1b[2mdim status\x1b[0m line'),/^dim status line$/);
});
test('Owner images and files are saved under inbox/ and recorded by path only, with the caption as text',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tg-inbox-')),file=path.join(dir,'inbox.jsonl');
 const state={owner:{userId:10,chatId:10}},actions=[],fetched=[],sent=[];
 const bot=createBot({state,save:async()=>{},telegram:async(m,b)=>{if(m==='sendMessage')sent.push(b.text);return {message_id:20};},local:async(url,body)=>{actions.push({url,body});return {};},inbox:e=>appendInbox(file,e),
  download:async(a,messageId)=>{fetched.push(a.file_id);return path.join(dir,'inbox',messageId+'-'+(a.file_name||'photo.jpg'));}});
 const base={date:Date.now()/1000,from:{id:10},chat:{id:10,type:'private'}};
 await bot.handle({message:{...base,message_id:7,caption:'what is wrong here?',photo:[{file_id:'small'},{file_id:'large'}]}});
 assert.deepEqual(fetched,['large'],'the largest photo size is saved');
 await bot.handle({message:{...base,message_id:8,document:{file_id:'png',file_name:'shot.png',mime_type:'image/png'}}});
 await bot.handle({message:{...base,message_id:9,caption:'/status',document:{file_id:'zip',file_name:'save.zip',mime_type:'application/zip'}}});
 await bot.handle({message:{...base,message_id:10,voice:{file_id:'v'}}});
 assert.deepEqual(fetched,['large','png','zip','v']);assert.deepEqual(actions,[]);
 const entries=await readUnread(file,0);
 assert.deepEqual(entries.map(e=>[e.id,e.text,e.attachments]),[
  [1,'what is wrong here?',[path.join(dir,'inbox/7-photo.jpg')]],
  [2,'',[path.join(dir,'inbox/8-shot.png')]],
  [3,'/status',[path.join(dir,'inbox/9-save.zip')]],
  [4,'',[path.join(dir,'inbox/10-photo.jpg')]]]);
 assert(entries.every(e=>!Number.isNaN(Date.parse(e.at))));
 assert.deepEqual(sent,['Saved #1','Saved #2','Saved #3','Saved #4']);
 const failing=createBot({state,save:async()=>{},telegram:async(m,b)=>{sent.push(b.text);return {};},local:async()=>({}),inbox:e=>appendInbox(file,e),download:async()=>{throw Error('too big');}});
 await failing.handle({message:{...base,message_id:11,photo:[{file_id:'x'}]}});
 assert.match(sent.at(-1),/Could not save the attachment: too big/);assert.equal((await readUnread(file,0)).length,4,'nothing appended on a failed download');
});
test('Inbox ids continue after restart, cursors are plain integers and readers skip read entries',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tg-inbox-')),file=path.join(dir,'inbox.jsonl');
 assert.deepEqual(await readUnread(file,0),[],'a missing inbox has nothing unread');
 await appendInbox(file,{text:'one'});await appendInbox(file,{text:'two',attachments:['/a.png']});
 fs.appendFileSync(file,'{"partial":\n');
 assert.equal((await appendInbox(file,{text:'three'})).id,3,'id derives from the file and ignores junk lines');
 const cursor=inbox.cursorPath(dir,'claude-80aa9e95');assert.equal(cursor,path.join(dir,'inbox.claude-80aa9e95.cursor'));
 assert.equal(inbox.readCursorSync(cursor),0);fs.writeFileSync(cursor,'2\n');assert.equal(inbox.readCursorSync(cursor),2);
 assert.deepEqual(inbox.readUnreadSync(file,inbox.readCursorSync(cursor)).map(e=>e.text),['three']);
 assert.throws(()=>inbox.cursorPath(dir,'../x'));
});
test('Inbox nudge: only stale unread entries, idle or stalled consumer, no draft, one per 15 minutes, fixed line',()=>{
 const now=Date.parse('2026-10-10T12:00:00Z'),at=ms=>new Date(now-ms).toISOString();
 const unread=[{id:4,at:at(4*60000),text:'SECRET user text'},{id:5,at:at(30000),text:'more'}];
 const idle={id:'claude-orchestrator',idle:true,stalled:false,promptOpen:false};
 const d=inbox.nudgeDecision({unread,terminal:idle,consumer:{kind:'claude'},now});
 assert.equal(d.send,true);assert.equal(d.goalResume,false);
 assert.equal(d.message,'[Telegram inbox] 2 unread in scratch/telegram/inbox.jsonl - read past your cursor');
 assert(inbox.NUDGE_RE.test(d.message));assert(!d.message.includes('SECRET'));
 const why=args=>inbox.nudgeDecision({unread,terminal:idle,consumer:{kind:'claude'},now,...args}).record.reason;
 assert.equal(why({unread:[]}),'no unread entries');
 assert.equal(why({unread:[{id:5,at:at(2*60000)}]}),'unread entries are recent');
 assert.equal(why({terminal:undefined}),'consumer terminal not registered');
 assert.equal(why({terminal:{...idle,promptOpen:true}}),'draft or prompt open');
 assert.equal(why({terminal:{...idle,promptOpen:true,stalled:true}}),'draft or prompt open');
 assert.equal(why({terminal:{...idle,idle:false}}),'consumer busy');
 assert.equal(why({previous:{lastNudgeAt:now-14*60000}}),'cooldown');
 assert.equal(why({config:{paused:true}}),'paused');
 assert.equal(inbox.nudgeDecision({unread,terminal:idle,consumer:{kind:'claude'},now,previous:{lastNudgeAt:now-16*60000}}).send,true);
 const stalled={...idle,idle:false,stalled:true};
 const codex=inbox.nudgeDecision({unread,terminal:stalled,consumer:{kind:'codex'},now});
 assert.equal(codex.send,true);assert.equal(codex.goalResume,true);
 assert.equal(inbox.nudgeDecision({unread,terminal:stalled,consumer:{kind:'claude'},now}).goalResume,false);
 assert.equal(inbox.stalledScreen('...\n⚠ Goal stalled: no progress\n› '),true);
 assert.equal(inbox.stalledScreen("You've hit your usage limit · resets 3pm"),true);
 assert.equal(inbox.stalledScreen('● Working\n❯ '),false);
});
test('Inbox nudge screen guard: drafts and approvals are open prompts, an empty prompt is not',()=>{
 const {promptOpen}=require('./work-guard');
 const claude='● done\n─────\n❯ \n─────\n  ⏵⏵ bypass permissions on (shift+tab to cycle)';
 assert.equal(promptOpen(claude,'claude'),false);
 assert.equal(promptOpen(claude.replace('❯ ','❯ half typed'),'claude'),true);
 assert.equal(promptOpen('› Ask Codex to do anything\n\n gpt-6-astra medium','codex'),false);
 assert.equal(promptOpen('› my draft\n\n gpt-6-astra medium','codex'),true);
 assert.equal(promptOpen('Would you like to run the following command?\n› Ask Codex to do anything','codex'),true);
});
test('Work watchdog nudges the configured inbox consumer once, by agentId, and persists the cooldown',async()=>{
 const {inboxNudges}=require('./work-watchdog');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tg-wd-')),dir=path.join(root,'scratch/work-watchdog');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(root,inbox.INBOX),now=Date.now();
 await appendInbox(file,{text:'hello',at:new Date(now-5*60000).toISOString()});
 const terminals=[{id:'orchestrator',agentId:'codex:01a0ff91-cf9d',idle:true,screenHash:'c'},{id:'claude-orchestrator',agentId:'claude:80aa9e95-435b-4acb',idle:true,stalled:false,promptOpen:false,screenHash:'h'}];
 const config={telegramInbox:{consumers:[{agent:'claude-80aa9e95',agentId:'claude:80aa9e95',kind:'claude'}]}},state={},requests=[];
 const request=async(url,body)=>{requests.push({url,body});return {sent:true};};
 await inboxNudges({root,config,terminals,state,save:()=>{},request,dir,now});
 assert.deepEqual(requests,[{url:'/api/work-nudge',body:{terminalId:'claude-orchestrator',screenHash:'h',kind:'telegram-inbox',message:'[Telegram inbox] 1 unread in scratch/telegram/inbox.jsonl - read past your cursor'}}]);
 assert.equal(state.telegramInbox['claude-80aa9e95'].lastNudgeAt,now);
 await inboxNudges({root,config,terminals,state,save:()=>{},request,dir,now:now+60000});
 assert.equal(requests.length,1);assert.equal(state.telegramInbox['claude-80aa9e95'].reason,'cooldown');
 fs.writeFileSync(path.join(root,'scratch/telegram/inbox.claude-80aa9e95.cursor'),'1');
 await inboxNudges({root,config,terminals,state,save:()=>{},request,dir,now:now+20*60000});
 assert.equal(requests.length,1);assert.equal(state.telegramInbox['claude-80aa9e95'].reason,'no unread entries');
});
