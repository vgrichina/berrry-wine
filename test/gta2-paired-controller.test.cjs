'use strict';
// Real child + loopback CDP protocol fixture. No original, browser or GPU claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),{once}=require('node:events');
const controller=require('../tools/gta2-paired-controller.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const now=Date.now(),launch={deadline:now/1000+900},cmd={mode:'play',keys:['ArrowUp'],ms:400,nonce:'fixture-unique-001',intent:'manual forward gesture',observation:'personally reviewed road and curb'};
assert.equal(controller.policy(cmd,launch,false,now),5000);
assert.equal(controller.policy({...cmd,keys:['ArrowUp','ArrowLeft']},launch,false,now),5000);
assert.throws(()=>controller.policy({...cmd,keys:['Control','Enter']},launch,false,now));
assert.equal(controller.policy({...cmd,mode:'menu',keys:['Enter']},launch,false,now),30000);
assert.equal(controller.policy({...cmd,mode:'quit',keys:['Enter'],route:'select-quit',selectedQuit:'Quit'},launch,true,now),30000);
for(const patch of [{ms:0},{ms:79},{ms:1401},{ms:2001},{ms:NaN},{nonce:''},{intent:''},{ms:100.5},{keys:['Cheat']},{keys:['ArrowUp','ArrowUp']},{observation:''},{mode:'quit',route:''},{mode:'menu',keys:['Control']}])assert.throws(()=>controller.policy({...cmd,...patch},launch,false,now));
assert.throws(()=>controller.policy(cmd,launch,true,now));
assert.throws(()=>controller.policy(cmd,launch,false,now+717001));
assert.throws(()=>controller.policy({...cmd,mode:'quit',keys:['Enter'],route:'select-quit'},launch,true,now));
assert.throws(()=>controller.policy({...cmd,mode:'quit',keys:['Escape'],route:'open-menu'},launch,true,now+900001));
class RendererProbe{constructor(){this.inputQueue=[];this.windows={};this._exited=false;}}
require('../lib/renderer-input').installInputHandlers(RendererProbe);
for(const [key,vk] of Object.entries(controller.KEYS)){
 const renderer=new RendererProbe();renderer.handleKeyDown(vk,{code:key});assert.equal(renderer.peekKeyDownState(vk),0x8000);renderer.handleKeyUp(vk,{code:key});assert.equal(renderer.peekKeyDownState(vk),0);
 assert.equal(renderer.inputQueue.length,2,'balanced production renderer edges '+key);
}
async function main(){
 const root=process.env.GTA2_TEST_OUT;assert(root&&path.isAbsolute(root),'unique run-local GTA2_TEST_OUT required');fs.mkdirSync(root,{recursive:true});
 const server=http.createServer(),sockets=new Set(),events=[];let failUp=false;
 server.on('upgrade',(req,socket)=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer=Buffer.alloc(0);
  const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const response=v=>{const b=Buffer.from(JSON.stringify(v)),head=Buffer.alloc(b.length<126?2:4);head[0]=0x81;if(b.length<126)head[1]=b.length;else{head[1]=126;head.writeUInt16BE(b.length,2);}socket.write(Buffer.concat([head,b]));};
  socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);while(buffer.length>=2){const opcode=buffer[0]&15;let size=buffer[1]&127,offset=2;if(size===126){if(buffer.length<4)return;size=buffer.readUInt16BE(2);offset=4;}assert(size<65536);if(buffer.length<offset+4+size)return;const mask=buffer.subarray(offset,offset+4);offset+=4;const b=Buffer.from(buffer.subarray(offset,offset+size));for(let i=0;i<b.length;i++)b[i]^=mask[i%4];buffer=buffer.subarray(offset+size);if(opcode===8){socket.end(Buffer.from([0x88,0]));continue;}const v=JSON.parse(b);events.push({at:Date.now(),...v});if(failUp&&v.method==='Input.dispatchKeyEvent')continue;response({id:v.id,result:v.method==='Target.attachToTarget'?{sessionId:'fixture-page'}:v.method==='Runtime.evaluate'?{result:{value:{apps:[{name:'gta2_demo',processId:1}]}}}:{}});}});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 try {
  for(const kind of ['scheduled','parent-eof','pair']){
   const out=path.join(root,kind);fs.mkdirSync(out);const keys=kind==='pair'?['ArrowUp','ArrowLeft']:['Enter'];
   const file=out+'/config.json';fs.writeFileSync(file,JSON.stringify({pid:process.pid,startToken,url:'ws://127.0.0.1:'+server.address().port,targetId:'exact-page',keys,name:'pulse'}));
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/gta2-paired-controller.cjs'),'release',out,file],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
   const end=Date.now()+2000;while(!stdout.includes('\n')){assert(Date.now()<end);await pause(5);}const armed=JSON.parse(stdout.trim());assert(armed.armed);assert.equal(armed.fallback-armed.at,1500);
   if(kind!=='parent-eof')child.stdin.write(JSON.stringify({at:armed.at+150})+'\n');child.stdin.end();
   const result=await joined;assert.equal(result.code,0,stderr);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
   const up=JSON.parse(fs.readFileSync(out+'/pulse-up.json'));assert.equal(up.state,'ACK');assert(up.ack>=up.due&&up.ack-up.armed<=1750);
   const ups=events.filter(e=>e.method==='Input.dispatchKeyEvent'&&e.at>=armed.at&&e.at<=up.ack);assert.deepEqual(ups.map(e=>e.params.key),[...keys].reverse());assert(ups.every(e=>e.params.type==='keyUp'&&e.sessionId==='fixture-page'));
   fs.writeFileSync(out+'/wait.json',JSON.stringify({...result,stdoutEOF:true,stderrEOF:true,actualWait:true,stdout,stderr,events:ups}));
  }
  for(const kind of ['wrong-start','wrong-owner','unknown-up']){
   failUp=kind==='unknown-up';const out=path.join(root,kind);fs.mkdirSync(out);const file=out+'/config.json';const start=events.length;
   fs.writeFileSync(file,JSON.stringify({pid:process.pid,startToken:kind==='wrong-start'?'replacement':startToken,url:'ws://127.0.0.1:'+server.address().port,targetId:'exact-page',keys:['Enter'],name:'pulse',...(kind==='wrong-owner'?{owner:{processId:2}}:{})}));
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/gta2-paired-controller.cjs'),'release',out,file],{stdio:['pipe','pipe','pipe']});child.stdin.end();let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const result=await new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));assert.equal(result.code,1);assert(!fs.existsSync(out+'/pulse-up.json'));
   const requests=events.slice(start).filter(e=>e.method==='Input.dispatchKeyEvent');assert.equal(requests.length,kind==='unknown-up'?1:0,'no replay after UNKNOWN or changed owner');assert(!requests.some(e=>e.params.type==='keyDown'));
   fs.writeFileSync(out+'/wait.json',JSON.stringify({...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr,requests}));
  }
  // A timed-out request seals the transport, including all later non-input requests.
  failUp=true;const start=events.length,unknown=[];
  const connection=controller.connection('ws://127.0.0.1:'+server.address().port,v=>unknown.push(v));await connection.ready;
  await assert.rejects(connection.send('Input.dispatchKeyEvent',{type:'keyUp'}),/UNKNOWN/);
  for(const method of ['Input.dispatchKeyEvent','Runtime.evaluate','Browser.close'])await assert.rejects(connection.send(method),/permanently closed/);
  await pause(20);assert.equal(events.length-start,1);assert.equal(unknown.length,1);assert.equal(unknown[0].laterRequestsAllowed,0);
  fs.writeFileSync(root+'/permanent-UNKNOWN.json',JSON.stringify({unknown,requests:events.slice(start),laterRequests:0}));
  const {FIELDS,same}=require('../'+controller.HELPER),identity=Object.fromEntries(FIELDS.map(k=>[k,'original:'+k]));same(identity,{...identity});for(const k of FIELDS)assert.throws(()=>same(identity,{...identity,[k]:'replacement'}));
  console.log('PASS reserve/irreversible Quit/finite keys, permanent identity replacement, independent actual child scheduled/EOF/pair UP; no game or renderer proof');
 } finally {for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
