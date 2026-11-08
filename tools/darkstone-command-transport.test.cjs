'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..');
const selected=root+'/scratch/runs/20261108-darkstone-current-bat-2025';
const owned=root+'/scratch/runs/20261108-darkstone-quit-admission-repair-2054';
const base=require('./gltron-logical-fps-local.cjs');
const adapter=require('./darkstone-command-transport.cjs');
const transport=adapter.loadTransport(selected+'/transport.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(t,cleanup=true){const out=fs.mkdtempSync(path.join(os.tmpdir(),'darkstone-admission-'));fs.mkdirSync(out+'/commands');if(cleanup)t.after(()=>fs.rmSync(out,{recursive:true,force:true}));return out;}
function queue(out){return fs.readdirSync(out+'/commands').filter(n=>/^\d+\.json$/.test(n));}

test('actual ACK client rejects invalid timeout before writing; remains usable',async t=>{
 const out=fixture(t);
 for(const ms of [100000,55001,0,-1,1.5,NaN,Infinity,'55000',null]){
  await assert.rejects(base.commandAck(out,{id:'bad',action:'quit'},ms),/bounded ACK/);
  assert.deepEqual(fs.readdirSync(out),['commands']);
 }
 const pending=base.commandAck(out,{id:'legal',action:'quit'},55000);
 base.writeJson(out+'/reply-0.json',{ok:true,id:'legal'});
 assert.equal((await pending).id,'legal');assert.deepEqual(queue(out),['0.json']);
});

test('historical wrapper reproduces sticky closure for the same prequeue invalidity',async t=>{
 const out=fixture(t),historical=require(selected+'/transport.cjs');
 await assert.rejects(historical.request(out,'bad',{action:'quit'},100000),/bounded ACK/);
 assert.equal(queue(out).length,0);assert(fs.existsSync(out+'/transport-closed.json'));
 await assert.rejects(historical.request(out,'new',{action:'quit'},55000),/sticky/);
});

test('guard rejects changed source; shared timeout validator preserves exact bounds',()=>{
 const source=fs.readFileSync(selected+'/transport.cjs','utf8');
 assert.throws(()=>adapter.repairTransport(source+'\n'),/unrecognized/);
 for(const n of [1,55000])assert.equal(base.validateAckTimeout(n),n);
 assert.equal(adapter.quitTimeoutMs,55000);
});

test('repaired exact consumer refuses invalid timeout without lock/ID/closure; legal same ID publishes exactly once',async t=>{
 const out=fixture(t);
 for(const ms of [100000,55001,0,-1,1.1,NaN,Infinity,'55000',null]){
  await assert.rejects(transport.request(out,'finish',{action:'quit'},ms),/bounded ACK/);
  assert.deepEqual(fs.readdirSync(out),['commands']);
 }
 const pending=transport.request(out,'finish',{action:'quit'});
 let executions=0;await transport.consume(out,0,async c=>{assert.equal(c.action,'quit');executions++;});
 assert.equal((await pending).id,'finish');assert.equal(executions,1);
 await assert.rejects(transport.request(out,'finish',{action:'quit'}),/EEXIST/);
 await assert.rejects(transport.consume(out,0,async()=>{executions++;}),/duplicate/);
 assert.equal(executions,1);assert.deepEqual(queue(out),['0.json']);
});

for(const late of [false,true])test((late?'late':'lost')+' published ACK stays sticky UNKNOWN; same or new ID cannot replay',async t=>{
 const out=fixture(t);
 await assert.rejects(transport.request(out,'quit',{action:'quit'},15),/ACK deadline/);
 assert.equal(queue(out).length,1);assert(fs.existsSync(out+'/transport-closed.json'));
 if(late)base.writeJson(out+'/reply-0.json',{ok:true,id:'quit'});
 for(const id of ['quit','new'])await assert.rejects(transport.request(out,id,{action:'quit'},1000));
 assert.deepEqual(queue(out),['0.json']);
 let calls=0;await assert.rejects(transport.consume(out,0,async()=>{calls++;}),/sticky/);assert.equal(calls,0);
});

test('wrong ACK identity and prior runtime failure remain closed',async t=>{
 const out=fixture(t),pending=transport.request(out,'quit',{action:'quit'},1000);
 base.writeJson(out+'/reply-0.json',{ok:true,id:'wrong'});
 await assert.rejects(pending,/exact ACK ID/);
 await assert.rejects(transport.request(out,'next',{action:'quit'},1000),/sticky/);
 assert.deepEqual(queue(out),['0.json']);
});

test('exception immediately after actual rename remains sticky despite publisher throwing',async t=>{
 const out=fixture(t),rename=fs.renameSync;
 fs.renameSync=function(from,to){rename(from,to);if(to===out+'/commands/0.json')throw Error('after publication');};
 let pending;
 try{pending=transport.request(out,'quit',{action:'quit'},1000);}finally{fs.renameSync=rename;}
 await assert.rejects(pending,/after publication/);
 assert.deepEqual(queue(out),['0.json']);assert(fs.existsSync(out+'/transport-closed.json'));
 base.writeJson(out+'/reply-0.json',{ok:true,id:'quit'});
 await assert.rejects(transport.request(out,'next',{action:'quit'},1000),/sticky/);
});

test('existing UNKNOWN, cleanup, and prior missing ACK cannot be cleared by invalid admission',async t=>{
 const out=fixture(t);
 base.writeJson(out+'/transport-closed.json',{sticky:true});
 await assert.rejects(transport.request(out,'bad',{action:'quit'},100000),/bounded ACK/);
 await assert.rejects(transport.request(out,'legal',{action:'quit'},55000),/sticky/);
 assert.deepEqual(queue(out),[]);
 const closed=fixture(t);base.writeJson(closed+'/cleanup.json',{});
 await assert.rejects(transport.request(closed,'quit',{action:'quit'},55000),/child exited/);
 assert.deepEqual(queue(closed),[]);
 const missing=fixture(t);base.writeJson(missing+'/commands/0.json',{id:'old',action:'quit'});
 await assert.rejects(transport.request(missing,'quit',{action:'quit'},55000),/prior command UNKNOWN/);
 assert.deepEqual(queue(missing),['0.json']);
});

// Execute the actual owned consumer's repaired close/execute functions and
// exact transport.consume. Substitute only CDP/page observations; use a real
// Node child plus inherited stdout/stderr writer, never Chrome or a game.
for(const mode of ['drain','terminal-unknown','log-unknown'])test('owned browser/ACK integration '+mode,async t=>{
 const source=require(owned+'/consumer.cjs').buildSource();new vm.Script(source);
 const out=fs.mkdtempSync(path.join(owned,'integration-'+mode+'-'));fs.mkdirSync(out+'/commands');fs.mkdirSync(out+'/chrome-profile');
 const browser=spawn(process.execPath,['-e',`
  const {spawn}=require('node:child_process');
  const writer=spawn(process.execPath,['-e',"setTimeout(()=>{console.log('writer EOF');process.exit(0)},300)"],{stdio:['ignore',process.stdout,process.stderr]});
  writer.unref();process.send('ready');process.on('message',()=>process.exit(0));
 `],{stdio:['ignore','pipe','pipe','ipc']});
 const closed=once(browser,'close');
 t.after(async()=>{if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL');await closed;logs.close();});
 await once(browser,'message');
 const logs=require('./native-command-log.cjs').createLogs(out);
 logs.attach('chrome.stdout',browser.stdout);logs.attach('chrome.stderr',browser.stderr);
 let requests=0;
 const realClose=require('./native-browser-close.cjs').closeBrowser;
 const load=name=>name===root+'/tools/native-browser-close.cjs'&&mode==='terminal-unknown'
  ?{closeBrowser:options=>realClose({...options,graceMs:40,termMs:20,killMs:20})}:require(name);
 const context=vm.createContext({fs,console,require:load,process:{exitCode:0},root,out,browser,server:null,
  compressedLogs:mode==='log-unknown'?{drainStreams:async()=>{await logs.drainStreams();throw Error('log EOF UNKNOWN');}}:logs,
  closing:false,timer:null,diskMonitor:null,pending:new Map(),clearTimeout,clearInterval,Date,assert,deadline:Date.now()+5000,
  ws:{readyState:1,close(){}},send:async method=>{assert.equal(method,'Browser.close');requests++;browser.send('close');},
  evaluate:async()=>[],save:(n,v)=>base.writeJson(out+'/'+n,v),log:(n,v)=>logs.append(n,JSON.stringify(v)+'\n'),t:transport});
 const close=source.slice(source.indexOf('let closePromise;function close(reason)'),source.indexOf('async function execute('));
 const execute=source.slice(source.indexOf('async function execute('),source.indexOf('(async()=>{\n server='));
 vm.runInContext(close+'\n'+execute,context);
 const pending=transport.request(out,'finish',{action:'quit'},1000);
 // Attach rejection handlers immediately: the producer may fail before client polling.
 const response=pending.then(value=>({value}),error=>({error}));
 const consuming=transport.consume(out,0,context.execute).then(value=>({value}),error=>({error}));
 await pause(60);
 assert.equal(fs.existsSync(out+'/reply-0.json'),false);
 assert.equal(fs.existsSync(out+'/cleanup.json'),false);
 assert.equal(fs.existsSync(out+'/chrome-profile'),true);
 const result=await consuming,ack=await response;
 if(mode==='drain'){
  assert.equal(result.error,undefined);assert.equal(ack.value.id,'finish');
  assert.equal(fs.existsSync(out+'/chrome-profile'),false);
  assert.equal(JSON.parse(fs.readFileSync(out+'/stream-log-drain.json')).eof,true);
  assert.equal(JSON.parse(fs.readFileSync(out+'/browser-terminal.json')).drained,true);
  assert(fs.existsSync(out+'/cleanup.json'));assert(browser.stdout.readableEnded);
 }else{
  assert.match(String(result.error),/UNKNOWN/);assert(ack.error);
  assert.equal(fs.existsSync(out+'/reply-0.json'),false);
  assert.equal(fs.existsSync(out+'/cleanup.json'),false);
  assert.equal(fs.existsSync(out+'/chrome-profile'),true);
  await assert.rejects(transport.request(out,'retry',{action:'quit'},1000),/sticky/);
 }
 assert.equal(requests,1);assert.deepEqual(queue(out),['0.json']);await closed;
});
