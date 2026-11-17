'use strict';
// Real child + loopback CDP protocol fixture. No original, browser or GPU claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),{once}=require('node:events');
const controller=require('../tools/revolt-manual-controller.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const now=Date.now(),launch={deadline:now/1000+900},cmd={action:'key',mode:'play',keys:['ArrowUp'],ms:400,nonce:'fixture-unique-001',intent:'manual forward gesture',observation:'personally reviewed road and curb'};
assert.equal(controller.policy(cmd,launch,false,now),5000);
assert.equal(controller.policy({...cmd,keys:['ArrowUp','ArrowLeft']},launch,false,now),5000);
assert.throws(()=>controller.policy({...cmd,keys:['Control','Enter']},launch,false,now));
assert.equal(controller.policy({...cmd,mode:'menu',keys:['Enter']},launch,false,now),30000);
assert.equal(controller.policy({...cmd,mode:'quit',keys:['Enter'],route:'select-quit',selectedQuit:'Quit'},launch,true,now),30000);
for(const patch of [{action:'keys'},{action:'pulse'},{ms:0},{ms:79},{ms:1401},{ms:2001},{ms:NaN},{nonce:''},{intent:''},{ms:100.5},{keys:['Cheat']},{keys:['ArrowUp','ArrowUp']},{observation:''},{mode:'quit',route:''},{mode:'menu',keys:['Control']}])assert.throws(()=>controller.policy({...cmd,...patch},launch,false,now));
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
 const root=process.env.REVOLT_TEST_OUT;assert(root&&path.isAbsolute(root),'unique run-local REVOLT_TEST_OUT required');fs.mkdirSync(root,{recursive:true});
 const endpointFile=path.join(root,'partial-DevToolsActivePort');
 assert.equal(controller.devtoolsEndpoint(endpointFile),null);
 for(const content of ['', '12345\n', '12345\n/devtools/browser/', '0\n/devtools/browser/abc']){fs.writeFileSync(endpointFile,content);assert.equal(controller.devtoolsEndpoint(endpointFile),null);}
 fs.writeFileSync(endpointFile,'12345\n/devtools/browser/abc-123\n');assert.equal(controller.devtoolsEndpoint(endpointFile),'ws://127.0.0.1:12345/devtools/browser/abc-123');
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
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/revolt-manual-controller.cjs'),'release',out,file],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
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
   const child=cp.spawn(process.execPath,[path.resolve(__dirname,'../tools/revolt-manual-controller.cjs'),'release',out,file],{stdio:['pipe','pipe','pipe']});child.stdin.end();let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const result=await new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));assert.equal(result.code,1);assert(!fs.existsSync(out+'/pulse-up.json'));
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
// Authored native x86 program. Public Win32 keys, DirectDraw7/D3D3 COM calls,
// debug output and native ExitProcess only. No original bytes or private reads.
function buildFixture(directory){
 const out=path.resolve(directory);fs.mkdirSync(out,{recursive:true});
 const put=(n,b)=>fs.writeFileSync(out+'/'+n,b,{flag:'wx'});
 const run=(cmd,args)=>cp.execFileSync(cmd,args,{stdio:'pipe'});
 const imports={kernel32:['ExitProcess@4','Sleep@4','OutputDebugStringA@4'],user32:['CreateWindowExA@48','GetAsyncKeyState@4'],ddraw:['DirectDrawCreateEx@16']};
 for(const [dll,names]of Object.entries(imports)){
  put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
  run('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 const source=String.raw`
typedef unsigned U; typedef void* P;
#define S __attribute__((stdcall))
#define I __declspec(dllimport)
I void S ExitProcess(U); I void S Sleep(U); I void S OutputDebugStringA(char*);
I P S CreateWindowExA(U,char*,char*,U,int,int,int,int,P,P,P,P);
I short S GetAsyncKeyState(int); I int S DirectDrawCreateEx(P,P,P,P);
#define C0(o,s) ((int(S*)(P))(*(P**)o)[s])(o)
#define C1(o,s,a) ((int(S*)(P,U))(*(P**)o)[s])(o,(U)a)
#define C2(o,s,a,b) ((int(S*)(P,U,U))(*(P**)o)[s])(o,(U)a,(U)b)
#define C3(o,s,a,b,c) ((int(S*)(P,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c)
#define C4(o,s,a,b,c,d) ((int(S*)(P,U,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c,(U)d)
#define C5(o,s,a,b,c,d,e) ((int(S*)(P,U,U,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c,(U)d,(U)e)
static void check(int h,U n){if(h){OutputDebugStringA("NATIVE fixture HRESULT failure");ExitProcess(n);}}
static U bits(float f){union{float f;U u;}x;x.f=f;return x.u;}
static U iidDD[4]={0x15e65ec0,0x11d23b9c,0x60002fb9,0x5bea9797};
static U iidD3D[4]={0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000};
static U hal[4]={0x84e63de0,0x11cf46aa,0xaa001681,0xb78a4700};
static int keys[12]={38,40,37,39,13,27,32,17,89,78,36,35};
static U old[12]; volatile U seen[12],released[12];
void start(void){
 P hwnd=CreateWindowExA(0,"STATIC","AUTHORED native D3D input fixture - Escape quits",0x10000000,0,0,640,480,0,0,0,0);
 P dd=0,d3d=0,primary=0,target=0,device=0,vp=0;
 check(DirectDrawCreateEx(0,&dd,iidDD,0),11);check(C2(dd,20,hwnd,8),12);
 check(C2(dd,0,iidD3D,&d3d),13);
 U desc[31]={124,1};desc[26]=0x200;check(C3(dd,6,desc,&primary,0),14);
 for(U i=0;i<31;i++)desc[i]=0;
 desc[0]=124;desc[1]=0x1007;desc[2]=240;desc[3]=320;desc[18]=32;desc[19]=0x40;desc[21]=32;
 desc[22]=0xff0000;desc[23]=0xff00;desc[24]=0xff;desc[26]=0x2840;
 check(C3(dd,6,desc,&target,0),15);check(C4(d3d,8,hal,target,&device,0),16);
 check(C2(d3d,6,&vp,0),17);check(C1(device,5,vp),18);
 U viewport[11]={44,0,0,320,240};viewport[5]=bits(160);viewport[6]=bits(120);viewport[7]=bits(160);viewport[8]=bits(120);viewport[10]=bits(1);
 check(C1(vp,5,viewport),19);check(C1(device,12,vp),20);
 U rs[6]={7,14,22,26,27,137},rv[6]={0,0,1,0,0,0};
 for(U i=0;i<6;i++)check(C2(device,22,rs[i],rv[i]),21);
 check(C3(device,40,0,1,2),22);check(C3(device,40,0,2,0),23);check(C3(device,40,1,1,1),24);
 U v[24];for(U i=0;i<24;i++)v[i]=0;
 for(U i=0;i<3;i++){v[i*8]=bits(i==1?640:-320);v[i*8+1]=bits(i==2?480:-240);v[i*8+2]=bits(.5f);v[i*8+3]=bits(1);}
 OutputDebugStringA("NATIVE fixture READY");
 for(;;){
  U held=0;for(U i=0;i<12;i++){U down=(GetAsyncKeyState(keys[i])&0x8000)!=0;held|=down<<i;
   if(down!=old[i]){char text[]="NATIVE KEY 00 UP";text[11]="0123456789ABCDEF"[(keys[i]>>4)&15];text[12]="0123456789ABCDEF"[keys[i]&15];if(down){text[14]='D';text[15]='N';seen[i]++;}else released[i]++;OutputDebugStringA(text);old[i]=down;}}
  for(U i=0;i<3;i++)v[i*8+4]=held?0xff00cc44:0xff3344cc;
  check(C0(device,9),25);check(C5(device,28,4,0x1c4,v,3,0),26);check(C0(device,10),27);
  check(C5(primary,5,0,target,0,0x1000000,0),28);
  if(held&(1<<5)){OutputDebugStringA("NATIVE fixture QUIT");ExitProcess(0);}Sleep(10);
 }
}
`;
 put('fixture.c',source);
 run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 run('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/fixture.exe',out+'/fixture.obj',...Object.keys(imports).map(d=>out+'/'+d+'.lib')]);
 const symbols=cp.execFileSync('nm',[out+'/fixture.exe'],{encoding:'utf8'});
 const address=name=>{const line=symbols.split('\n').find(l=>l.endsWith(' _'+name));assert(line,name);return parseInt(line.split(' ')[0],16);};
 const proof={path:out+'/fixture.exe',sha256:controller.sha(fs.readFileSync(out+'/fixture.exe')),seen:address('seen'),released:address('released')};
 put('fixture-symbols.json',JSON.stringify(proof,null,2)+'\n');return proof;
}
if(process.argv[2]==='--prepare'){console.log(JSON.stringify(buildFixture(process.argv[3])));}else if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={buildFixture};
