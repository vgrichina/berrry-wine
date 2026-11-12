'use strict';
// Exercise the exact emitted functions, including real Chrome/server disposal.
const fs=require('fs'),assert=require('assert/strict'),cp=require('child_process'),http=require('http'),path=require('path'),crypto=require('crypto');
const source=fs.readFileSync(path.join(__dirname,'caesar3-native-browser.cjs'),'utf8');
const action=source.slice(source.indexOf('async function action(c)'),source.indexOf('(async()=>{\n const pins='));
const close=source.slice(source.indexOf('let closeTask,browserJoin;'),source.indexOf('async function launch(app)'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const R=process.env.EVIDENCE_DIR;assert(R,'set EVIDENCE_DIR to an owned run directory');
fs.mkdirSync(R,{recursive:true});
const sha=crypto.createHash('sha256').update(source).digest('hex');
async function fixture(){
 const out=path.join(R,'owned-child');fs.mkdirSync(out);fs.mkdirSync(out+'/profile');
 const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2));
 const server=http.createServer((q,s)=>s.end('owned fixture'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],{stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';browser.stdout.on('data',b=>stdout+=b);browser.stderr.on('data',b=>stderr+=b);
 const joined=new Promise(r=>browser.once('close',(code,signal)=>{save('chrome-join.json',{pid:browser.pid,code,signal,actualChildClose:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded});r();}));
 let ws;try{
  const active=out+'/profile/DevToolsActivePort';for(let i=0;i<150&&!fs.existsSync(active);i++){assert(browser.exitCode===null);await wait(100);}
  const [dp,wp]=fs.readFileSync(active,'utf8').trim().split('\n');ws=new WebSocket('ws://127.0.0.1:'+dp+wp);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0;const pending=new Map(),effects=[];ws.onmessage=e=>{const v=JSON.parse(e.data),p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.t);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}};
  const send=(method,params,session)=>{effects.push(method);assert.equal(method,'Browser.close');assert.equal(session,null);return new Promise((resolve,reject)=>{const n=++id,t=setTimeout(()=>{pending.delete(n);reject(Error('UNKNOWN Browser.close'));},30000);pending.set(n,{resolve,reject,t});ws.send(JSON.stringify({id:n,method,params}));});};
  const compile=new Function('assert','fs','out','browser','server','ws','pending','send','save','wait','joined',`let closing=false;const deadline=Date.now()-1000,teardownDeadline=Date.now()+60000;${close};browserJoin=joined;${action};return {action,close};`);
  const f=compile(assert,fs,out,browser,server,ws,pending,send,save,wait,joined);
  await assert.rejects(f.action({action:'click',x:1,y:1}),/assert|false/i);assert.deepEqual(effects,[]);
  save('late-input.json',{refused:true,zeroEffects:effects.length===0});
  await f.action({action:'quit'});await f.close('second waiter');
  assert.deepEqual(effects,['Browser.close']);assert.equal(browser.exitCode,0);assert.equal(browser.signalCode,null);assert(!server.listening);assert(!fs.existsSync(out+'/profile'));
  const closed=JSON.parse(fs.readFileSync(out+'/closed.json'));assert(closed.actualChildClose);
  save('result.json',{passed:true,sourceSHA256:sha,port,chromePid:browser.pid,effects,lateGameplayRefused:true,closed});
 }finally{if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL');await joined;ws?.close();if(server.listening)await new Promise(r=>server.close(r));fs.writeFileSync(out+'/chrome.stdout',stdout);fs.writeFileSync(out+'/chrome.stderr',stderr);}
}
async function controls(){
 const rows=[];
 for(const fail of ['', 'mousePressed','mouseReleased','owner','stale','hash','review','cleanup-expired']){
  const emitted=[],captures=[],latest={label:'fresh',sha256:'exact',at:Date.now()-(fail==='stale'?180001:0)};
  const state=async()=>({apps:[{name:fail==='owner'?'other':'caesar3_demo',running:true,stopped:false}],canvas:{left:0,top:0,w:800,h:600,width:800,height:600}});
  const send=async(m,p)=>{emitted.push({m,p});if(p.type===fail)throw Error('UNKNOWN '+fail);};
  const f=new Function('assert','fs','out','latest','deadline','teardownDeadline','state','send','wait','capture','close','launch',`let closing=false;${action};return action;`)(assert,{readFileSync:()=>JSON.stringify({...latest,sha256:fail==='hash'?'wrong':latest.sha256,review:fail==='review'?'':'full fresh frame'})},'/unused',latest,Date.now()+60000,Date.now()-1,state,send,async()=>{},async l=>captures.push(l),async()=>{throw Error('unauthorized close');},async()=>{});
  let error;try{await f({action:fail==='cleanup-expired'?'quit':'physical-click',review:'fresh',label:'click',x:20,y:30});}catch(e){error=String(e);}
  if(!fail){assert.equal(captures.length,1);assert.equal(emitted.at(-1).p.type,'mouseReleased');assert.equal(emitted.at(-1).p.buttons,0);}
  else{assert(error);assert.equal(captures.length,0);if(['mousePressed','mouseReleased'].includes(fail))assert.equal(emitted.at(-1).p.type,'mouseReleased');else assert.equal(emitted.length,0);}
  rows.push({fail,emitted,captures,error});
 }
 fs.writeFileSync(R+'/actual-input-controls.json',JSON.stringify({passed:true,sourceSHA256:sha,rows},null,2));
 const child=cp.spawn(process.execPath,[__filename,'fixture'],{env:process.env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const result=await new Promise(r=>child.once('close',(code,signal)=>r({pid:child.pid,code,signal,actualParentWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr})));
 fs.writeFileSync(R+'/fixture-parent-wait.json',JSON.stringify(result,null,2));assert.equal(result.code,0,stderr);assert(result.stdoutEOF&&result.stderrEOF);console.log('Actual emitted controls and real owned Chrome/server late teardown PASS');
}
(process.argv[2]==='fixture'?fixture():controls()).catch(e=>{console.error(e);process.exitCode=1;});
