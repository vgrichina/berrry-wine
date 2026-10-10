'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const {parseApproval,approvalIdentity}=require('./approval-prompt');
const {chatReady,hasCodexChild,chatSubmitKey}=require('./telegram-guard');
const {workReady,workSubmitKey,claudeChatReady,claudeChatSubmitKey,plainScreen,promptOpen}=require('./work-guard');
const {stalledScreen,NUDGE_RE}=require('./telegram-inbox');

function createTerminalBridge(server, options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const config = options.terminalConfig || path.join(root, 'ops/terminals.json');
  const tmux = options.tmuxBinary || 'tmux';
  // Test-only server socket selection; never accepted from HTTP or mapping data.
  const tmuxArgs = options.tmuxArgs || [];
  let WebSocketServer, wss;
  try { ({WebSocketServer} = require('ws')); wss = new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false}); } catch {}
  const tickets = new Map(), connections = new Set(), controllers = new Map();
  const observed=new Map(), decisions=new Set();
  const signature=value=>crypto.createHash('sha256').update(value).digest('hex');
  async function capture(target) {
    if(!await exists(target))throw Error('Registered pane changed or unavailable');
    const {stdout}=await exec(tmux,[...tmuxArgs,'capture-pane','-p','-e','-J','-t',target.pane],{timeout:2000,maxBuffer:524288});
    return plainScreen(stdout);
  }
  async function approvals() {
    const targets=await mappings(),items=[],warnings=[];
    for(const id of observed.keys())if(!targets.some(t=>t.id===id))observed.delete(id);
    for(const target of targets) {
      try {
        // Ended workers are terminal lifecycle state, not urgent approvals.
        // Never interpret Claude's screen using Codex's menu/key protocol.
        if(!await exists(target) || provider(target)!=='codex' || target.permissionMode==='bypass') {
          observed.delete(target.id);continue;
        }
        const screen=await capture(target),prompt=parseApproval(screen),fingerprint=prompt&&signature(JSON.stringify(target)+approvalIdentity(prompt.prompt));
        if(!prompt){observed.delete(target.id);continue;}
        let record=observed.get(target.id);
        if(!record || record.fingerprint!==fingerprint) {
          record={id:crypto.randomBytes(24).toString('hex'),fingerprint,target,firstSeenAt:new Date().toISOString(),sent:false};
          observed.set(target.id,record);
        }
        record.checkedAt=Date.now();
        items.push({...prompt,id:record.id,terminalId:target.id,label:target.label || target.session,firstSeenAt:record.firstSeenAt,sent:record.sent});
      }catch{observed.delete(target.id);warnings.push(`Approval monitor unavailable for ${target.label || target.session}. Inspect the terminal.`);}
    }
    return {items,warnings};
  }
  async function approvalDecision(req,res) {
    const fail=(code,message)=>{res.writeHead(code,{'Content-Type':'text/plain'});res.end(message);};
    if(!originOK(req))return fail(403,'Same-origin request required');
    if(req.headers['content-type']!=='application/json')return fail(415,'JSON required');
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1024)return fail(413,'Request too large');chunks.push(chunk);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return fail(400,'Invalid JSON');}
    if(!['accept','decline','allow-rule'].includes(input?.decision))return fail(400,'Choose accept once, allow rule or decline');
    const record=[...observed.values()].find(r=>r.id===input.id);
    if(!record || record.sent || Date.now()-record.checkedAt>15000)return fail(409,'Prompt expired or already answered. Refresh and review again.');
    const id=record.target.id;
    if(controllers.has(id) || decisions.has(id))return fail(409,'Terminal is being controlled. Switch all browser terminals to View first.');
    decisions.add(id);
    try {
      const target=(await mappings()).find(t=>t.id===id);
      if(!target || JSON.stringify(target)!==JSON.stringify(record.target))return fail(409,'Terminal registration changed. Refresh first.');
      if(provider(target)!=='codex' || target.permissionMode==='bypass')return fail(409,'This terminal does not use Codex command approvals');
      const screen=await capture(target);
      const prompt=parseApproval(screen);
      if(!prompt || signature(JSON.stringify(target)+approvalIdentity(prompt.prompt))!==record.fingerprint)return fail(409,'Prompt changed. Refresh and review the current command.');
      if(input.decision==='allow-rule'&&!prompt.allowRule)return fail(409,'This prompt has no persistent approval option');
      record.sent=true; // Never replay a decision, including after an ambiguous send failure.
      await exec(tmux,[...tmuxArgs,'send-keys','-t',target.pane,input.decision==='accept'?'y':input.decision==='allow-rule'?'p':'Escape'],{timeout:2000,maxBuffer:65536});
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({sent:true}));
    }catch{return fail(409,'Could not confirm delivery. Inspect the terminal before trying again.');}
    finally{decisions.delete(id);}
  }
  const originOK = req => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') && req.headers.origin === `http://${req.headers.host}`;
  async function screen(req,res) {
    const target=(await mappings()).find(t=>t.id==='orchestrator');
    try{if(!target)throw Error();const text=await capture(target);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({text,agentId:target.agentId}));}
    catch{res.writeHead(409);res.end('Orchestrator pane unavailable');}
  }
  async function workStatus() {
    return Promise.all((await mappings()).map(async target=>{
      try {
        const screen=await capture(target);
        return {id:target.id,agentId:target.agentId,provider:provider(target),idle:!controllers.has(target.id)&&!decisions.has(target.id)&&workReady(screen,provider(target)),stalled:stalledScreen(screen),promptOpen:promptOpen(screen,provider(target)),screenHash:signature(screen)};
      } catch {return {id:target.id,agentId:target.agentId,idle:false,reason:'Terminal unavailable'};}
    }));
  }
  async function chat(req,res,work=false) {
    const fail=(code,message)=>{res.writeHead(code,{'Content-Type':'text/plain'});res.end(message);};
    if(!originOK(req))return fail(403,'Same-origin request required');
    if(req.headers['content-type']!=='application/json')return fail(415,'JSON required');
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>20000)return fail(413,'Message too long');chunks.push(chunk);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return fail(400,'Invalid JSON');}
    if(typeof input.message!=='string' || !input.message.trim() || input.message.length>4000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.message))return fail(400,'Plain text of 1–4000 characters required');
    const target=(await mappings()).find(t=>t.id===(work?input.terminalId:'orchestrator'));
    if(!target)return fail(409,'Orchestrator not registered');
    if(controllers.has(target.id) || decisions.has(target.id))return fail(409,'Terminal is being controlled; retry when it is in View mode');
    decisions.add(target.id);
    try {
      const processes=await exec('ps',['-ax','-o','pid=,ppid=,comm='],{timeout:2000,maxBuffer:2*1024*1024});
      if(provider(target)==='codex' ? !hasCodexChild(processes.stdout,target.panePid) : provider(target)!=='claude' || !processes.stdout.split('\n').some(l=>new RegExp('^\\s*'+target.panePid+'\\s+\\d+\\s+(?:.*/)?claude\\s*$').test(l)))return fail(409,'Registered pane is not running its agent');
      if(JSON.stringify((await mappings()).find(t=>t.id===target.id))!==JSON.stringify(target))return fail(409,'Orchestrator registration changed');
      const initial=await capture(target);
      // A Claude orchestrator uses the Claude screen guards for Telegram chat too.
      const claudeChat=!work && provider(target)==='claude';
      if(work ? !workReady(initial,provider(target)) || signature(initial)!==input.screenHash : claudeChat ? !claudeChatReady(initial) : !chatReady(initial))return fail(409,claudeChat?'Orchestrator has a prompt or draft open.':'Agent is busy, changed, or has a prompt/draft open');
      // One literal line, with a fixed prefix: never a slash command or terminal control sequence.
      // Telegram inbox nudges are one fixed line (never message text); a stalled Codex goal may also get /goal resume.
      const kind=work?input.kind:undefined;
      if(kind==='telegram-inbox' && !NUDGE_RE.test(input.message))return fail(400,'Inbox nudge must be the fixed line');
      if(kind==='goal-resume' && (provider(target)!=='codex' || input.message!=='/goal resume'))return fail(400,'goal-resume is the literal /goal resume for a Codex terminal');
      if(kind!==undefined && kind!=='telegram-inbox' && kind!=='goal-resume')return fail(400,'Unknown nudge kind');
      const message=kind?input.message:(work?'[Work watchdog] ':'[Telegram] ')+input.message.replace(/\s+/g,' ').trim();
      await exec(tmux,[...tmuxArgs,'send-keys','-l','-t',target.pane,'--',message],{timeout:2000,maxBuffer:65536});
      // Let the TUI finish processing pasted text before choosing its submit key.
      await new Promise(resolve=>setTimeout(resolve,300));
      const submitted=screen=>work?workSubmitKey(screen,message,provider(target)):claudeChat?claudeChatSubmitKey(screen,message):chatSubmitKey(screen,message);
      const key=submitted(await capture(target));
      if(!key)return fail(409,'Message entered but not submitted. Inspect the terminal before resending');
      await exec(tmux,[...tmuxArgs,'send-keys','-t',target.pane,key],{timeout:2000,maxBuffer:65536});
      await new Promise(resolve=>setTimeout(resolve,300));
      if(submitted(await capture(target)))return fail(409,'Message remains in the input box. Inspect the terminal before resending');
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({sent:true}));
    }catch{return fail(409,'Delivery uncertain; inspect the terminal before resending');}
    finally{decisions.delete(target.id);}
  }
  async function mappings() {
    let data; try { data=JSON.parse(await fs.readFile(config,'utf8')); } catch { return []; }
    if(!Array.isArray(data.terminals)) return [];
    const seen=new Set();
    return data.terminals.filter(t=>{
      if(!t || !/^[a-z0-9-]{1,60}$/.test(t.id) || seen.has(t.id) || typeof t.agentId!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(t.session) || !/^%\d+$/.test(t.pane) || !Number.isSafeInteger(t.panePid) || t.panePid<=0) return false;
      seen.add(t.id);return true;
    });
  }
  async function exists(t) {
    try {
      const {stdout}=await exec(tmux,[...tmuxArgs,'list-panes','-s','-t','='+t.session,'-F','#{pane_id}\t#{pane_pid}\t#{pane_dead}'],{timeout:2000,maxBuffer:65536});
      return stdout.split('\n').some(line=>line===`${t.pane}\t${t.panePid}\t0`);
    } catch {return false;}
  }
  const provider=t=>t.agentId.startsWith('claude:')?'claude':t.agentId.startsWith('codex:')?'codex':'unknown';
  async function list() {
    return Promise.all((await mappings()).map(async t=>{
      const live=await exists(t),kind=provider(t);
      return {id:t.id,agentId:t.agentId,label:t.label || t.session,session:t.session,provider:kind,
        state:live?'live':'ended-or-changed',permissionMode:t.permissionMode==='bypass'?'bypass':'default',
        approvalMode:t.permissionMode==='bypass'?'disabled':kind==='codex'?'command-menu':'terminal',
        available:!!wss && live,reason:!wss?'Run npm ci --prefix ops':!live?'Session ended or pane changed; resume the agent and register its current pane.':null};
    }));
  }
  async function ticket(req,res) {
    const fail=(code,message)=>{res.writeHead(code,{'Content-Type':'text/plain'});res.end(message);};
    if(!originOK(req)) return fail(403,'Same-origin request required');
    if(!wss) return fail(503,'Terminal dependencies unavailable; run npm ci --prefix ops');
    if(req.headers['content-type']!=='application/json') return fail(415,'JSON required');
    let bytes=0,chunks=[];
    for await(const chunk of req) {bytes+=chunk.length;if(bytes>1024)return fail(413,'Request too large');chunks.push(chunk);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return fail(400,'Invalid JSON');}
    const target=(await mappings()).find(t=>t.id===input?.id);
    if(!target)return fail(404,'Terminal not registered');
    if(!await exists(target))return fail(409,'Registered tmux pane is unavailable or changed');
    for(const [key,value] of tickets)if(value.expires<Date.now())tickets.delete(key);
    if(tickets.size>=32)return fail(429,'Too many pending connections');
    const token=crypto.randomBytes(32).toString('hex');
    tickets.set(token,{target,expires:Date.now()+30000});
    res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({token,id:target.id,session:target.session}));
  }
  server.on('upgrade',async(req,socket,head)=>{
    const reject=()=>{socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');};
    try {
      const url=new URL(req.url,'http://localhost');
      if(!wss || !originOK(req) || url.pathname!=='/api/terminal' || connections.size>=8)return reject();
      const token=url.searchParams.get('ticket'),grant=tickets.get(token);tickets.delete(token);
      if(!grant || grant.expires<Date.now())return reject();
      const current=(await mappings()).find(t=>t.id===grant.target.id);
      if(!current || JSON.stringify(current)!==JSON.stringify(grant.target) || !await exists(current))return reject();
      if(socket.destroyed)return;
      if(connections.size>=8)return reject();
      wss.handleUpgrade(req,socket,head,ws=>connect(ws,current));
    } catch {reject();}
  });
  function connect(ws,target) {
    connections.add(ws);
    let terminal=null,mode='view',closed=false,alive=true,ready=false;
    let pending='',block=null,attached=false,snapshotting=false,geometry=null,inputBytes=0,inputEpoch=0,inputQueue=Promise.resolve();
    const commands=[];
    const send=(type,data)=>{if(ws.readyState===1)ws.send(JSON.stringify({type,...data}));};
    const output=data=>{if(ws.bufferedAmount>2*1024*1024)return ws.close(1013,'Output consumer too slow');send('output',{data:Buffer.from(data,'latin1').toString('base64')});};
    const detach=()=>{const old=terminal;terminal=null;if(old){old.stdin.end();old.kill('SIGTERM');}};
    const release=()=>{if(controllers.get(target.id)===ws)controllers.delete(target.id);};
    const cleanup=()=>{if(closed)return;closed=true;clearInterval(heartbeat);release();detach();connections.delete(ws);};
    ws.on('close',cleanup);ws.on('error',cleanup);ws.on('pong',()=>{alive=true;});
    const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},15000);heartbeat.unref();
    function setMode(nextMode) {
      if(nextMode==='control' && decisions.has(target.id)){send('error',{message:'An approval decision is being delivered. Try again shortly.'});return;}
      if(nextMode==='control' && controllers.has(target.id) && controllers.get(target.id)!==ws) {send('error',{message:'Another browser controls this terminal. Switch it to View first.'});return;}
      inputEpoch++;release();mode=nextMode;
      if(mode==='control')controllers.set(target.id,ws);
      send('mode',{mode,session:target.session});
    }
    function command(text,done) {commands.push(done);terminal?.stdin.write(text+'\n');}
    function snapshot() {
      if(snapshotting || closed)return;snapshotting=true;ready=false;
      command(`display-message -p -t ${target.pane} '#{pane_width} #{pane_height} #{cursor_x} #{cursor_y}'`,lines=>{
        const values=lines.join('').split(' ').map(Number);
        if(values.length!==4 || values.some(n=>!Number.isInteger(n)))return ws.close(1011,'Pane geometry unavailable');
        geometry=values;send('geometry',{cols:values[0],rows:values[1]});
        command(`capture-pane -p -e -t ${target.pane}`,screen=>{
          const [cols,rows,x,y]=geometry;
          output('\x1b[0m\x1b[2J\x1b[H'+screen.slice(0,rows).join('\r\n')+`\x1b[${y+1};${x+1}H`);
          ready=true;snapshotting=false;
        });
      });
    }
    function line(text) {
      if(!block && text.startsWith('%begin ')){block={id:text.slice(7),lines:[]};return;}
      if(block && (text==='%end '+block.id || text==='%error '+block.id)) {
        const result=block.lines;block=null;
        if(text.startsWith('%error '))return ws.close(1011,'tmux command failed');
        if(!attached){attached=true;setMode('view');snapshot();}else commands.shift()?.(result);
        return;
      }
      if(block){block.lines.push(text);return;}
      const match=/^%output (%\d+) (.*)$/.exec(text);
      if(match && match[1]===target.pane && ready)output(match[2].replace(/\\([0-7]{3})/g,(_,oct)=>String.fromCharCode(parseInt(oct,8))));
      if(text.startsWith('%layout-change ') && attached)snapshot();
      if(text.startsWith('%exit'))ws.close();
    }
    ws.on('message',(bytes,binary)=>{
      if(binary || closed)return ws.close(1008,'JSON messages required');
      let msg;try{msg=JSON.parse(bytes.toString());}catch{return ws.close(1008,'Invalid message');}
      if(msg?.type==='input' && ready && mode==='control' && typeof msg.data==='string' && Buffer.byteLength(msg.data)<=8192) {
        const data=Buffer.from(msg.data),version=inputEpoch;inputBytes+=data.length;
        if(inputBytes>32768)return ws.close(1008,'Too much pending input');
        inputQueue=inputQueue.then(async()=>{
          if(closed || version!==inputEpoch || mode!=='control' || !data.length)return;
          if(!await exists(target))return ws.close(1008,'Registered pane changed');
          if(closed || version!==inputEpoch || mode!=='control')return;
          // Literal bytes only: neither shell commands nor tmux syntax come from the browser.
          await exec(tmux,[...tmuxArgs,'send-keys','-H','-t',target.pane,...Array.from(data,n=>n.toString(16))],{timeout:2000,maxBuffer:65536});
        }).catch(()=>send('error',{message:'Input could not be delivered'})).finally(()=>{inputBytes-=data.length;});
      } else if(msg?.type==='mode' && attached && ['view','control'].includes(msg.mode) && msg.mode!==mode)setMode(msg.mode);
    });
    const env={...process.env};delete env.TMUX;delete env.TMUX_PANE;
    terminal=spawn(tmux,[...tmuxArgs,'-C','attach-session','-E','-f','read-only,ignore-size','-t','='+target.session],{cwd:root,env,stdio:['pipe','pipe','pipe']});
    terminal.stdin.on('error',()=>{});
    terminal.stderr.resume();
    terminal.stdout.setEncoding('latin1');
    terminal.stdout.on('data',chunk=>{
      pending+=chunk;
      if(pending.length>4*1024*1024)return ws.close(1013,'Output too large');
      let end;while(!closed && (end=pending.indexOf('\n'))!==-1){const text=pending.slice(0,end);pending=pending.slice(end+1);line(text);}
    });
    terminal.on('error',()=>{send('error',{message:'Could not attach to tmux'});ws.close(1011);});
    terminal.on('exit',()=>{if(!closed){send('ended',{message:'tmux attachment ended. The session may still be running.'});ws.close();}});
  }
  function close(){tickets.clear();for(const ws of connections)ws.terminate();wss?.close();}
  server.on('close',close);
  return {list,ticket,close,approvals,approvalDecision,screen,chat,workStatus,nudge:(req,res)=>chat(req,res,true)};
}
module.exports={createTerminalBridge};
