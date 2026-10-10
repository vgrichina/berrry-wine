#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const inbox=require('./telegram-inbox');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
// TODOS owners are written both as the full session id and as its first UUID
// group (claude:d10ba697); both name the same agent.
const sameAgent=(owner,agentId)=>!!owner && !!agentId && (owner===agentId || agentId.startsWith(owner+'-'));
function eligible(tasks,agentId,config={}) {
  const byId=new Map(tasks.map(t=>[t.id,t]));
  return tasks.filter(t=>sameAgent(t.owner,agentId) && ['active','ready','review'].includes(t.status) && !t.blocker &&
    !(config.excludedTasks||[]).includes(t.id) &&
    !(t.dependencies||[]).some(id=>byId.get(id)?.status!=='done'))
    .sort((a,b)=>({active:0,review:1,ready:2}[a.status]-{active:0,review:1,ready:2}[b.status])||a.id.localeCompare(b.id));
}
function decide(snapshot,terminal,config,previous={},now=Date.now()) {
  const tasks=eligible(snapshot.tasks||[],terminal.agentId,config);
  const signature=hash(tasks.map(t=>[t.id,t.status,t.next,t.evidence,t.notes]));
  const same=previous.signature===signature && previous.agentId===terminal.agentId;
  const record={...previous,agentId:terminal.agentId,signature,taskIds:tasks.map(t=>t.id),checkedAt:now,
    attempts:same?(previous.attempts||0):0,lastNudgeAt:same?previous.lastNudgeAt:null};
  const skip=reason=>({send:false,record:{...record,reason}});
  if(!config.enabled || config.paused || (config.pausedTerminals||[]).includes(terminal.id)){record.idleSince=null;return skip('paused');}
  if(!tasks.length){record.idleSince=null;return skip('no actionable owned tasks');}
  const agent=snapshot.agents?.find(a=>a.id===terminal.agentId);
  if(snapshot.agents && agent?.state!=='idle'){record.idleSince=null;return skip('session has not reported an idle turn');}
  if(!terminal.idle){record.idleSince=null;return skip('busy, prompt, draft, controller, or unavailable');}
  if(!same || previous.screenHash!==terminal.screenHash || !previous.idleSince)record.idleSince=now;
  record.screenHash=terminal.screenHash;
  if(now-record.idleSince<(config.idleMs??120000))return skip('observing stable idle terminal');
  if(record.attempts>=(config.maxUnchangedNudges??2))return skip('stalled: repeated nudges without task progress; inspect agent');
  if(record.lastNudgeAt && now-record.lastNudgeAt<(config.cooldownMs??900000))return skip('cooldown');
  return {send:true,tasks,record:{...record,reason:'idle with actionable work'}};
}
// A worker with nothing it owns has no one to nudge it; tell the dispatcher
// (config.dispatcher, a terminal id) once workers have sat idle and unassigned
// for unassignedMs, so it can hand out the next ready task.
function unassigned(snapshot,terminal,config,previous={},now=Date.now()) {
  const agent=snapshot.agents?.find(a=>a.id===terminal.agentId);
  const idle=terminal.idle && (!snapshot.agents || agent?.state==='idle') && !eligible(snapshot.tasks||[],terminal.agentId,config).length;
  return idle?(previous.unassignedSince||now):null;
}
function dispatch(snapshot,terminals,config,previous={},now=Date.now()) {
  const skip=reason=>({send:false,record:{...previous,reason,checkedAt:now}});
  const target=terminals.find(t=>t.id===config.dispatcher);
  if(!config.enabled || config.paused || !target || (config.pausedTerminals||[]).includes(target.id))return skip('no dispatcher');
  const wait=config.unassignedMs??600000;
  const idle=terminals.filter(t=>t.id!==target.id && (config.terminals||[]).includes(t.id) &&
    !(config.pausedTerminals||[]).includes(t.id) && t.unassignedSince!=null && now-t.unassignedSince>=wait).map(t=>t.id).sort();
  const signature=hash(idle);
  const same=previous.signature===signature;
  const record={...previous,signature,workers:idle,checkedAt:now,attempts:same?(previous.attempts||0):0,lastNudgeAt:same?previous.lastNudgeAt:null};
  const hold=reason=>({send:false,record:{...record,reason}});
  if(!idle.length)return hold('every worker has owned work or is busy');
  if(!target.idle)return hold('dispatcher busy, prompt, draft, controller, or unavailable');
  if(record.attempts>=(config.maxUnchangedNudges??2))return hold('stalled: dispatcher did not assign work; inspect it');
  if(record.lastNudgeAt && now-record.lastNudgeAt<(config.cooldownMs??900000))return hold('cooldown');
  return {send:true,workers:idle,record:{...record,reason:'idle workers without owned tasks'}};
}
function dispatchMessage(workers) {
  return `Idle with no owned task: ${workers.join(', ').slice(0,120)}. Give each the next ready TODOS task (user asks first, then new games, GL/D3D goal, sweep crashes): set owner to its full agent id, post CLAIM, message its pane. Unowned tasks with prev-owner codex are free. One browser at a time. Do not deploy publicly.`;
}
function message(tasks,config) {
  const names=tasks.slice(0,2).map(t=>t.id).join(', ').slice(0,100);
  // Short literal drafts avoid the TUI collapsing long input into a paste chip,
  // whose hidden contents cannot be checked by the exact-draft delivery guard.
  return `Resume assigned work (${names}). Read TODOS.md, messageboard.txt and ops/work-watchdog.json first; reconcile merged work and collect worker results. Respect pauses and laptop-owned Heroes II. Continue the two-game lane; serialize runtime tests. Do not deploy publicly or answer approvals. If blocked, update tasks. Intentional pause: scratch/work-watchdog/control.json paused=true.`;
}
// Telegram inbox fallback: the bot never types; this nudges a consumer that has
// left inbox entries unread past its cursor with one fixed line (see telegram-inbox.js).
// A consumer names its terminal by agentId (full id or first UUID group), resolved
// against ops/terminals.json through /api/work-status.
async function inboxNudges({root,config,terminals,state,save,request,dir,now=Date.now()}) {
  const cfg=config.telegramInbox;if(!cfg?.consumers?.length)return;
  const file=path.join(root,inbox.INBOX),tgDir=path.join(root,'scratch/telegram');
  state.telegramInbox??={};
  for(const consumer of cfg.consumers){
    let unread;try{unread=inbox.readUnreadSync(file,inbox.readCursorSync(inbox.cursorPath(tgDir,consumer.agent)));}catch(e){state.telegramInbox[consumer.agent]={...state.telegramInbox[consumer.agent],reason:'inbox read failed: '+e.message};continue;}
    const terminal=terminals.find(t=>sameAgent(consumer.agentId,t.agentId));
    const previous=state.telegramInbox[consumer.agent]||{};
    const d=inbox.nudgeDecision({unread,terminal,consumer,previous,now,config:{...cfg,paused:config.paused||cfg.paused}});
    state.telegramInbox[consumer.agent]={...d.record,terminalId:terminal?.id};
    if(!d.send)continue;
    // Persist the attempt first: an uncertain delivery still starts the cooldown.
    const record=state.telegramInbox[consumer.agent];record.lastNudgeAt=now;save();
    try{
      await request('/api/work-nudge',{terminalId:terminal.id,screenHash:terminal.screenHash,kind:'telegram-inbox',message:d.message});record.reason='inbox nudge delivered';
      if(d.goalResume){
        const fresh=(await request('/api/work-status')).find(t=>t.id===terminal.id);
        await request('/api/work-nudge',{terminalId:terminal.id,screenHash:fresh?.screenHash,kind:'goal-resume',message:'/goal resume'});record.reason+=' + /goal resume';
      }
    }catch(e){record.reason='inbox nudge not confirmed: '+e.message;}
    fs.appendFileSync(path.join(dir,'events.jsonl'),JSON.stringify({at:new Date(now).toISOString(),terminalId:terminal.id,telegramInbox:consumer.agent,...record})+'\n');
  }
}
async function run({root=path.resolve(__dirname,'..'),base=process.env.OPS_URL||'http://127.0.0.1:8098'}={}) {
  const dir=path.join(root,'scratch/work-watchdog');fs.mkdirSync(dir,{recursive:true});
  const lock=path.join(dir,'lock');
  try{fs.mkdirSync(lock);}catch{
    let pid;try{pid=Number(fs.readFileSync(path.join(lock,'pid'),'utf8'));process.kill(pid,0);}catch(e){
      if(e.code==='ESRCH' && pid>0){fs.rmSync(lock,{recursive:true});return run({root,base});}
    }
    throw Error('Work watchdog lock exists; verify its PID before restarting');
  }
  fs.writeFileSync(path.join(lock,'pid'),String(process.pid));
  let stopping=false;const stop=()=>{stopping=true;};process.on('SIGTERM',stop);process.on('SIGINT',stop);
  const read=(f,fallback)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
  const stateFile=path.join(dir,'state.json');let state=read(stateFile,{targets:{}});
  const save=()=>{fs.writeFileSync(stateFile+'.tmp',JSON.stringify(state,null,2)+'\n');fs.renameSync(stateFile+'.tmp',stateFile);};
  const request=async(url,body)=>{const r=await fetch(base+url,{signal:AbortSignal.timeout(15000),...(body?{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`${url}: ${r.status} ${(await r.text()).slice(0,180)}`);return r.json();};
  try{while(!stopping){
    try{
      const config={...read(path.join(root,'ops/work-watchdog.json'),{enabled:false}),...read(path.join(dir,'control.json'),{})};
      const [snapshot,terminals]=await Promise.all([request('/api/state'),request('/api/work-status')]);
      if(!snapshot.generatedAt || Date.now()-Date.parse(snapshot.generatedAt)>120000)throw Error('Stale dashboard snapshot');
      const watched=terminals.filter(t=>(config.terminals||[]).includes(t.id));
      for(const terminal of watched){
        const previous=state.targets[terminal.id]||{};
        const d=decide(snapshot,terminal,config,previous);state.targets[terminal.id]=d.record;
        d.record.unassignedSince=terminal.unassignedSince=unassigned(snapshot,terminal,config,previous);
        if(d.send){
          // Persist an attempt before delivery; uncertain sends must never replay immediately.
          d.record.attempts++;d.record.lastNudgeAt=Date.now();save();
          try{await request('/api/work-nudge',{terminalId:terminal.id,screenHash:terminal.screenHash,message:message(d.tasks,config)});d.record.reason='nudge delivered';}
          catch(e){d.record.reason='delivery not confirmed: '+e.message;}
          fs.appendFileSync(path.join(dir,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),terminalId:terminal.id,...d.record})+'\n');
        }
      }
      const dd=dispatch(snapshot,watched,config,state.dispatch);state.dispatch=dd.record;
      if(dd.send){
        const target=watched.find(t=>t.id===config.dispatcher);
        dd.record.attempts++;dd.record.lastNudgeAt=Date.now();save();
        try{await request('/api/work-nudge',{terminalId:target.id,screenHash:target.screenHash,message:dispatchMessage(dd.workers)});dd.record.reason='dispatch nudge delivered';}
        catch(e){dd.record.reason='dispatch delivery not confirmed: '+e.message;}
        fs.appendFileSync(path.join(dir,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),terminalId:target.id,dispatch:true,...dd.record})+'\n');
      }
      await inboxNudges({root,config,terminals,state,save,request,dir});
      state.error=null;
    }catch(e){state.error=e.message;console.error(e.message);}
    state.checkedAt=new Date().toISOString();state.pid=process.pid;save();
    if(process.argv.includes('--once'))break;
    for(let n=0;n<30&&!stopping;n++)await new Promise(r=>setTimeout(r,1000));
  }}finally{fs.rmSync(lock,{recursive:true,force:true});}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={eligible,decide,message,unassigned,dispatch,dispatchMessage,inboxNudges};
