'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {WebSocket}=require('ws');
const {createServer}=require('./server');

async function fixture() {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ops-terminal-'));
  const socket='ops-test-'+process.pid+'-'+Date.now();
  const tmux=(...args)=>execFileSync('tmux',['-L',socket,...args],{encoding:'utf8'}).trim();
  tmux('-f','/dev/null','new-session','-d','-s','fixture','-x','100','-y','30','/bin/sh');
  const [pane,pid]=tmux('list-panes','-t','=fixture','-F','#{pane_id} #{pane_pid}').split(' ');
  await fs.mkdir(path.join(root,'ops'));
  await fs.writeFile(path.join(root,'TODOS.md'),'- [~] Terminal fixture task\n  id: TERM-1\n  owner: codex:test\n  Next: Verify terminal navigation\n');
  await fs.writeFile(path.join(root,'ops/terminals.json'),JSON.stringify({terminals:[{id:'fixture',agentId:'codex:test',session:'fixture',pane,panePid:+pid}]}));
  const server=createServer({root,codexRoot:false,claudeRoot:false,tmuxArgs:['-L',socket]});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  return {root,tmux,server,base,pane,async close(){server.closeTerminals();await new Promise(resolve=>server.close(resolve));try{tmux('kill-server');}catch{}await fs.rm(root,{recursive:true,force:true});}};
}
function track(ws) {
  const events=[];ws.on('message',raw=>events.push(JSON.parse(raw)));
  return async predicate=>{
    const end=Date.now()+7000;
    while(Date.now()<end){const found=events.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,25));}
    throw Error('Timed out waiting for terminal event: '+JSON.stringify(events).slice(-1000));
  };
}
test('work nudges require same origin and refuse a registered pane that is only a shell',async t=>{
  const f=await fixture();t.after(()=>f.close());
  const body=JSON.stringify({terminalId:'fixture',screenHash:'stale',message:'Continue assigned tasks'});
  assert.equal((await fetch(f.base+'/api/work-nudge',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,403);
  assert.equal((await fetch(f.base+'/api/work-nudge',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body})).status,409);
  const status=await(await fetch(f.base+'/api/work-status')).json();
  assert.equal(status[0].idle,false);
  assert.equal((await(await fetch(f.base+'/api/work-watchdog')).json()).checkedAt,null);
});
test('tmux bridge authenticates, enforces view mode, controls fixture only, and detaches without stopping it', {timeout:30000},async t=>{
  const f=await fixture();t.after(()=>f.close());
  const post=(id,origin=f.base)=>fetch(f.base+'/api/terminal-ticket',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({id})});
  assert.equal((await post('fixture',null)).status,403);
  assert.equal((await post('fixture','http://evil.invalid')).status,403);
  assert.equal((await post('unregistered')).status,404);
  const state=await(await fetch(f.base+'/api/state')).json();assert.equal(state.terminals[0].available,true);
  async function open() {
    const r=await post('fixture');assert.equal(r.status,201);const {token}=await r.json();
    const ws=new WebSocket(f.base.replace('http:','ws:')+'/api/terminal?ticket='+token,{origin:f.base});
    const wait=track(ws);await wait(e=>e.type==='mode'&&e.mode==='view');return {ws,wait,token};
  }
  const a=await open();t.after(()=>a.ws.terminate());
  await a.wait(e=>e.type==='output');
  assert.match(f.tmux('list-clients','-F','#{client_flags}'),/read-only/);
  const size=f.tmux('display-message','-p','-t','=fixture','#{pane_width}x#{pane_height}');
  const marker=path.join(f.root,'should-not-exist');
  a.ws.send(JSON.stringify({type:'input',data:`touch ${marker}\r`}));
  a.ws.send(JSON.stringify({type:'resize',cols:40,rows:10}));
  await new Promise(r=>setTimeout(r,200));
  await assert.rejects(fs.access(marker));
  assert.equal(f.tmux('display-message','-p','-t','=fixture','#{pane_width}x#{pane_height}'),size);
  const replay=new WebSocket(f.base.replace('http:','ws:')+'/api/terminal?ticket='+a.token,{origin:f.base});
  replay.on('error',()=>{});
  await new Promise(resolve=>replay.on('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,403);res.resume();replay.terminate();resolve();}));
  a.ws.send(JSON.stringify({type:'mode',mode:'control'}));await a.wait(e=>e.type==='mode'&&e.mode==='control');
  a.ws.send(JSON.stringify({type:'input',data:`touch ${marker}; printf 'OPS_CONTROL_OK\\n'\r`}));
  await a.wait(e=>e.type==='output'&&Buffer.from(e.data,'base64').toString().includes('OPS_CONTROL_OK'));
  await new Promise(r=>setTimeout(r,100));await fs.access(marker);
  const b=await open();t.after(()=>b.ws.terminate());
  b.ws.send(JSON.stringify({type:'mode',mode:'control'}));await b.wait(e=>e.type==='error'&&e.message.includes('Another browser'));
  a.ws.close();await new Promise(resolve=>a.ws.once('close',resolve));
  await new Promise(r=>setTimeout(r,150));
  f.tmux('has-session','-t','=fixture');
  b.ws.send(JSON.stringify({type:'mode',mode:'control'}));await b.wait(e=>e.type==='mode'&&e.mode==='control');
  b.ws.close();await new Promise(resolve=>b.ws.once('close',resolve));
  await new Promise(r=>setTimeout(r,150));
  assert.equal(f.tmux('list-clients'), '');
  f.tmux('has-session','-t','=fixture');
});

module.exports={fixture};

test('Claude live and ended panes have lifecycle status without Codex approval alarms', {timeout:15000},async t=>{
  const f=await fixture();t.after(()=>f.close());
  const file=path.join(f.root,'ops/terminals.json');
  const config=JSON.parse(await fs.readFile(file,'utf8'));
  config.terminals[0].agentId='claude:test';config.terminals[0].permissionMode='bypass';
  await fs.writeFile(file,JSON.stringify(config));
  let state=await(await fetch(f.base+'/api/state')).json();
  assert.equal(state.terminals[0].available,true);
  assert.equal(state.terminals[0].provider,'claude');
  assert.equal(state.terminals[0].approvalMode,'disabled');
  assert.deepEqual(state.approvals.warnings,[]);
  config.terminals[0].panePid+=100000;await fs.writeFile(file,JSON.stringify(config));
  state=await(await fetch(f.base+'/api/state')).json();
  assert.equal(state.terminals[0].available,false);
  assert.equal(state.terminals[0].state,'ended-or-changed');
  assert.match(state.terminals[0].reason,/Session ended/);
  assert.deepEqual(state.approvals.warnings,[]);
  assert.deepEqual(state.approvals.items,[]);
});

const approvalScreen=`Would you like to run the following command?

Thread: Agent (test)
Environment: local
Reason: Read the fixture

$ printf fixture

› 1. Yes, proceed (y)
  2. Yes, and don't ask again (p)
  3. No, and tell Codex what to do differently (esc)

Press enter to confirm or esc to cancel or o to open thread`;

test('approval parser refuses incomplete prompts and historical menus',()=>{
  const {parseApproval}=require('./approval-prompt');
  assert.equal(parseApproval(approvalScreen).command,'printf fixture');
  assert.equal(parseApproval(approvalScreen).reason,'Read the fixture');
  assert.equal(parseApproval(approvalScreen).allowRule,false);
  const ruleScreen=approvalScreen.replace("2. Yes, and don't ask again (p)","2. Yes, and don't ask again for commands that start with `printf` (p)");
  assert.equal(parseApproval(ruleScreen).allowRule,true);
  assert.equal(parseApproval(approvalScreen+'\nCommand finished'),null);
  assert.equal(parseApproval(approvalScreen.replace('Yes, proceed (y)','Yes, proceed')),null);
  assert.equal(parseApproval('Execution stopped by automated security review'),null);
  assert.equal(parseApproval(approvalScreen.split('$ printf')[0]),null);
});

test('live approvals require a fresh unchanged pane and explicit decision; browser reviews disposable prompts', {timeout:30000},async t=>{
  const f=await fixture();t.after(()=>f.close());
  const script=path.join(f.root,'prompt.js'),keys=path.join(f.root,'keys');
  await fs.writeFile(script,`process.stdin.setRawMode(true);process.stdin.resume();const screen=${JSON.stringify(approvalScreen)};process.stdout.write('\\x1b[2J\\x1b[H'+screen);process.stdin.on('data',b=>{require('fs').appendFileSync(${JSON.stringify(keys)},b);if(b.toString()==='s')process.stdout.write('\\x1b[2J\\x1b[H'+screen.replace('Read the fixture','Changed request'));});`);
  f.tmux('send-keys','-t',f.pane,'node '+script,'Enter');
  const state=()=>fetch(f.base+'/api/state').then(r=>r.json());
  let p;
  for(let n=0;n<50;n++){p=(await state()).approvals.items[0];if(p)break;await new Promise(r=>setTimeout(r,30));}
  assert.ok(p);assert.equal(p.command,'printf fixture');
  const post=(id,decision='accept',origin=f.base)=>fetch(f.base+'/api/approval-decision',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({id,decision})});
  assert.equal((await post(p.id,'accept',null)).status,403);
  assert.equal((await post(p.id,'accept','http://evil.invalid')).status,403);
  assert.equal((await post(p.id,'always')).status,400);
  assert.equal((await post(p.id,'allow-rule')).status,409);
  assert.equal((await post('missing')).status,409);
  f.tmux('send-keys','-t',f.pane,'s');
  await new Promise(r=>setTimeout(r,100));
  assert.equal((await post(p.id)).status,409,'changed screen must reject the old approval');
  p=(await state()).approvals.items[0];assert.equal(p.reason,'Changed request');
  // Terminal control and approval actions cannot both own browser input.
  const grant=await(await fetch(f.base+'/api/terminal-ticket',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({id:'fixture'})})).json();
  const ws=new WebSocket(f.base.replace('http:','ws:')+'/api/terminal?ticket='+grant.token,{origin:f.base}),wait=track(ws);
  t.after(()=>ws.terminate());await wait(e=>e.type==='mode');
  ws.send(JSON.stringify({type:'mode',mode:'control'}));await wait(e=>e.type==='mode'&&e.mode==='control');
  assert.equal((await post(p.id)).status,409);
  ws.close();await new Promise(resolve=>ws.once('close',resolve));
  const browser=await require('puppeteer').launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.base);await page.waitForSelector('[data-approval]');
  await page.click('[data-approval]');
  assert.match(await page.$eval('.approval-command',el=>el.textContent),/printf fixture/);
  await page.click('[data-approval-decision="accept"]');
  await page.waitForFunction(()=>document.querySelector('#approval-review-status').textContent.includes('Decision sent'));
  assert.equal(await fs.readFile(keys,'utf8'),'sy');
  assert.equal((await post(p.id)).status,409);
  assert.equal((await state()).approvals.items[0].sent,true);
  assert.deepEqual(errors,[]);
  // Change the visible prompt without changing the registered pane PID.
  f.tmux('send-keys','-t',f.pane,'C-c');
  await new Promise(r=>setTimeout(r,100));
  await fs.writeFile(script,`process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('\\x1b[2J\\x1b[H'+${JSON.stringify(approvalScreen.replace('Read the fixture','Different request'))});process.stdin.on('data',b=>require('fs').appendFileSync(${JSON.stringify(keys)},b));`);
  // Raw mode above does not interpret Ctrl-C, so stop only our fixture child.
  f.tmux('respawn-pane','-k','-t',f.pane,'node '+script);
  // A respawn changes the PID: the old registration must no longer match.
  assert.equal((await state()).approvals.items.length,0);
  assert.equal((await post(p.id)).status,409);
  const [pane,pid]=f.tmux('list-panes','-t','=fixture','-F','#{pane_id} #{pane_pid}').split(' ');
  await fs.writeFile(path.join(f.root,'ops/terminals.json'),JSON.stringify({terminals:[{id:'fixture',agentId:'codex:test',session:'fixture',pane,panePid:+pid}]}));
  for(let n=0;n<50;n++){p=(await state()).approvals.items[0];if(p)break;await new Promise(r=>setTimeout(r,30));}
  assert.ok(p);assert.equal((await post(p.id,'decline')).status,200);
  await new Promise(r=>setTimeout(r,100));assert.equal(await fs.readFile(keys,'utf8'),'sy\x03\x1b');
});

test('browser terminal renders, controls a disposable pane, and reconnects in View', {timeout:30000},async t=>{
  const f=await fixture();t.after(()=>f.close());
  const browser=await require('puppeteer').launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  t.after(()=>browser.close());
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1280,height:900});await page.goto(f.base);
  await page.goto(f.base+'#tasks/all');
  await page.waitForSelector('.task-owner [data-terminal="fixture"]');
  await page.click('.task-details');
  assert.match(await page.$eval('#detail-body',el=>el.textContent),/codex:test/);
  await page.click('#detail-body [data-terminal="fixture"]');
  await page.waitForFunction(()=>document.querySelector('#terminal-status').textContent.includes('View only'));
  await page.waitForSelector('.xterm-screen');
  await page.click('#terminal-mode');
  await page.waitForFunction(()=>document.querySelector('#terminal-status').textContent.includes('Control enabled'));
  const marker=path.join(f.root,'browser-controlled');
  await page.keyboard.type(`touch ${marker}`);await page.keyboard.press('Enter');
  for(let n=0;n<200;n++){try{await fs.access(marker);break;}catch{await new Promise(r=>setTimeout(r,50));}}
  try{await fs.access(marker);}catch(e){console.error('Fixture screen:',f.tmux('capture-pane','-p','-t',f.pane));throw e;}
  await page.click('#terminal-reconnect');
  await page.waitForFunction(()=>document.querySelector('#terminal-status').textContent.includes('View only'));
  await page.setViewport({width:390,height:844});
  await fs.mkdir(path.join(__dirname,'../scratch/ops-terminal'),{recursive:true});
  await page.screenshot({path:path.join(__dirname,'../scratch/ops-terminal/mobile.png')});
  await page.setViewport({width:1280,height:900});
  await page.screenshot({path:path.join(__dirname,'../scratch/ops-terminal/desktop.png')});
  await page.click('#terminal-close');
  assert.equal(await page.$eval('#detail',el=>el.open),true);
  f.tmux('has-session','-t','=fixture');
  assert.deepEqual(errors,[]);
});
