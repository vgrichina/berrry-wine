'use strict';
// Ordinary authored USER/async-key control. The busy frame is guest work,
// timed by GetTickCount; no host pause, focus assignment or extra input poll.
function fixture({frameMs=0,directInput=true}={}) {
 const b=require('./drakan-retired-modal-focus.cjs').fixture({delay:0});
 const raw=r=>r-0x1000+0x200,u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 let at=0x1b00;
 const names=['RegisterClassA','DefWindowProcA','CreateWindowExA','MessageBoxA','ShowWindow','GetFocus','PeekMessageA','TranslateMessage','DispatchMessageA','GetAsyncKeyState','SetWindowTextA','PostQuitMessage'];
 for(const [i,n]of names.entries()){b.writeUInt32LE(at,raw(0x1940+i*4));b.write(n+'\0',raw(at+2));at+=n.length+3;}b.writeUInt32LE(0,raw(0x1940+names.length*4));
 b.write('Authored Drakan menu input\0',raw(0x2700));b.write('Native Enter dispatched\0',raw(0x2740));
 if(directInput){
  for(const [r,v]of [[0x1828,0x1980],[0x1834,0x18b0],[0x1838,0x1980],[0x1980,0x1d00]])b.writeUInt32LE(v,raw(r));
  b.writeUInt32LE(80,0x80+24+108);b.write('dinput.dll\0',raw(0x18b0));b.write('DirectInputCreateA\0',raw(0x1d02));
  b.set([0x61,0x2b,0x1d,0x6f,0xa0,0xd5,0xcf,0x11,0xbf,0xc7,0x44,0x45,0x53,0x54,0,0],raw(0x2c00));
  // Standard DIDATAFORMAT with one ordinary DIK_RETURN key object.
  for(const [i,v]of [24,16,2,256,1,0x402d40].entries())b.writeUInt32LE(v,raw(0x2d00+i*4));
  for(const [i,v]of [0,28,0x1c04,0].entries())b.writeUInt32LE(v,raw(0x2d40+i*4));
  b.set([0x60,0x2b,0x1d,0x6f,0xa0,0xd5,0xcf,0x11,0xbf,0xc7,0x44,0x45,0x53,0x54,0,0],raw(0x2c20));
  for(const [i,v]of [24,16,2,16,7,0x402dc0].entries())b.writeUInt32LE(v,raw(0x2d80+i*4));
  for(let i=0;i<7;i++)for(const [j,v]of [0,i<3?i*4:i+9,i<3?3:12,0].entries())b.writeUInt32LE(v,raw(0x2dc0+i*16+j*4));
 }
 const code=[],emit=(...v)=>code.push(...v),push=n=>emit(0x68,...u(n)),call=i=>emit(0xff,0x15,...u(0x401940+i*4));
 emit(0xb8,...u(0x402900),0xa3,...u(0x402604));push(0x402600);call(0);
 for(const n of [0,0x400000,0,0,360,640,100,80,0x00ca0000,0x402700,0x402500,0])push(n);call(2);emit(0x89,0xc6);push(5);emit(0x56);call(4);
 const method=(slot,offset,args)=>{for(const n of args)push(n);emit(0xff,0x35,...u(slot),0xa1,...u(slot),0x8b,0,0xff,0x50,offset);};
 if(directInput){
  for(const n of [0,0x402a00,0x500,0x400000])push(n);emit(0xff,0x15,...u(0x401980));
  method(0x402a00,12,[0,0x402a04,0x402c00]);method(0x402a04,44,[0x402d00]);
  push(6);emit(0x56,0xff,0x35,...u(0x402a04),0xa1,...u(0x402a04),0x8b,0,0xff,0x50,52);
  method(0x402a04,28,[]);
  method(0x402a00,12,[0,0x402a08,0x402c20]);method(0x402a08,44,[0x402d80]);
  push(6);emit(0x56,0xff,0x35,...u(0x402a08),0xa1,...u(0x402a08),0x8b,0,0xff,0x50,52);method(0x402a08,28,[]);
 }
 const loop=code.length;
 if(frameMs){emit(0xff,0x15,...u(0x401904),0x89,0xc3);const busy=code.length;emit(0xff,0x15,...u(0x401904),0x29,0xd8,0x3d,...u(frameMs),0x72,0);code[code.length-1]=(busy-code.length)&255;}
 // This public polling call observes the shared physical state independently
 // of the later USER message return. It never acknowledges that message.
 push(13);call(9);emit(0xa3,...u(0x402810));
 if(directInput){method(0x402a04,36,[0x402e00,256]);emit(0xa3,...u(0x402818));method(0x402a08,36,[0x402f00,16]);emit(0xa3,...u(0x40281c),0x0f,0xb6,0x05,...u(0x402f0c),0x09,0x05,...u(0x402824));}
 for(const [min,max]of [[0x100,0x108],[0x200,0x209],[0,0]]){
  const drain=code.length;
  for(const n of [1,max,min,0,0x402840])push(n);call(6);emit(0x85,0xc0,0x74,27);
  push(0x402840);call(7);push(0x402840);call(8);
  emit(0xe9,...u(drain-code.length-5));
 }
 emit(0xe9,...u(loop-code.length-5));b.fill(0,raw(0x2000),raw(0x2500));b.set(code,raw(0x2000));
 // The actual guest callback records native dispatch and updates its caption.
 const cb=[],e=(...v)=>cb.push(...v),p=n=>e(0x68,...u(n)),c=i=>e(0xff,0x15,...u(0x401940+i*4));
 e(0x81,0x7c,0x24,8,...u(0x100),0x74,10,0x81,0x7c,0x24,8,...u(0x201),0x75,0);const skip=cb.length-1;
 e(0xff,0x05,...u(0x402814));p(0x402740);e(0xff,0x74,0x24,8);c(10);
 if(directInput){p(0x402f00);p(16);e(0xff,0x35,...u(0x402a08),0xa1,...u(0x402a08),0x8b,0,0xff,0x50,36,0xa3,...u(0x40281c),0x0f,0xb6,0x05,...u(0x402f0c),0x09,0x05,...u(0x402824));}
 cb[skip]=cb.length-skip-1;e(0xff,0x25,...u(0x401944));b.set(cb,raw(0x2900));return b;
}
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('./native-supervisor-common.cjs'),a=require('./drakan-authentic-reviewed.cjs');
function policy(p){
 assert(p&&Number.isInteger(p.confirmationMs)&&p.confirmationMs>=500&&p.confirmationMs<=5000);
 for(const k of ['fallbackMs','physicalUpMs','operationMs'])assert(Number.isInteger(p[k])&&p[k]>0&&p[k]<=15000);
 assert(p.fallbackMs>p.confirmationMs+500);assert(p.physicalUpMs>p.fallbackMs+p.confirmationMs);
 assert(p.operationMs>p.physicalUpMs+1000);return Object.freeze({...p});
}
function reviewSeconds(p,scene){
 const seconds=p[scene+'FreshnessSeconds']??(scene==='game'?15:30);
 assert(['game','menu'].includes(scene));
 assert(Number.isInteger(seconds)&&seconds>0&&seconds<=(scene==='game'?60:90));
 return seconds;
}
function reviewAdmission(now,targeting,p){
 return Number.isFinite(now)&&Number.isFinite(targeting)&&now+p.confirmationMs/1000<targeting;
}
function durationAdmission(p,ms){
 return Number.isInteger(ms)&&ms>=80&&ms<=1000&&p.confirmationMs+ms<p.fallbackMs;
}
function proof(r,{owner,nonce,deadline,key,sentAt,hwnd,threadId,pointer}){
 assert.equal(r.state,'CONSUMED');assert.equal(r.consumed,true);
 for(const k of ['owner','epoch'])assert.equal(r[k],owner[k]);assert.equal(r.nonce,nonce);assert.equal(r.deadline,deadline);
 assert.equal(r.receiptBoundary,'native-input-return');assert.equal(r.nativeMessage?.consumption,'owner-user-return');
 assert.equal(r.nativeMessage.nonce,nonce);assert(r.nativeMessage.token>0);
 assert.equal(r.nativeMessage.msg,pointer?(pointer.action==='mousemove'?0x200:0x201):0x100);
 if(!pointer)assert.equal(r.nativeMessage.wParam,key);
 assert.equal(r.nativeMessage.hwnd,hwnd);assert.equal(r.nativeMessage.threadId,threadId);
 assert([1,2,3].includes(r.nativeMessage.apiKind));assert.equal(r.nativeMessage.remove,true);
 assert(r.consumedAt>=Math.trunc(sentAt*1000)&&r.consumedAt<deadline);
}
async function release(run,url,name,owner,due,confirmationMs){
 a.R=run;a.URL=url;const target=a.read('native-pid.json');
 process.stdout.write(JSON.stringify({armed:true,pid:process.pid,target,due,confirmationMs})+'\n');
 while(c.now()<due){
  const shorten=path.join(run,name+'-release-at.json');if(fs.existsSync(shorten))due=Math.min(due,c.readJSON(shorten).at);
  if(fs.existsSync(path.join(run,name+'-disarm.json')))return;
  await c.sleep(Math.min(5,Math.max(0,(due-c.now())*1000)));
 }
 if(!fs.existsSync(path.join(run,name+'-dispatch.json')))return;
 const at=c.now();assert.equal(c.token(target.pid),target.startToken);
 let reply;try{reply=await c.postJSON(url,{action:'guarded-release',owner},confirmationMs/1000);}catch(e){reply={ok:false,error:String(e)};}
 a.save(name+'-up.json',{at:c.now(),sentAt:at,physicalUpACK:reply.ok&&reply.value?.released===true,reply});
 if(!reply.ok)process.exitCode=1;
}
async function pulse({name,key,pointer=null,scene='menu',ms=300,review,observation,final=false,route=null}){
 assert(/^[a-zA-Z0-9-]+$/.test(name));assert(ms>=80&&ms<=1000);assert(['menu','game'].includes(scene));
 if(pointer){assert(key===undefined);assert(['mousemove','mousedown'].includes(pointer.action));assert(Number.isInteger(pointer.x)&&Number.isInteger(pointer.y));}
 else assert(Number.isInteger(key)&&key>=1&&key<=254);
 assert(observation?.trim());a.opened();const launch=a.read('launch.json'),p=policy(launch.menuInputPolicy);
 if(!durationAdmission(p,ms)){
  a.save(name+'-rejection.json',{at:c.now(),state:'NOT_SENT',effects:false,ms,policy:p,reason:'pulse cannot fit preselected fallback'});
  return 'NOT_SENT: pulse cannot fit preselected fallback';
 }
 const start=c.now(),end=start+p.operationMs/1000,intent=route?'quit':'gameplay';
 const enforce=()=>{
  if(!pointer)return a.policy(intent,['keydown:'+key],review,route,end);
  if(route){assert.equal(route,'ordinary-pointer-quit');assert.equal(scene,'menu');}
  else{assert(end<a.reserve());assert(!fs.existsSync(path.join(a.R,'quit-phase.json')));}
 };
 enforce();
 try{
  const [owner,before]=await a.lease(),rr=a.read(review+'.json');
  assert(before.physicalUp&&before.capture==='0x0');assert(rr.snapshot.physicalUp&&rr.snapshot.capture==='0x0');
  const reviewFile=path.join(a.R,review+'-review.json');
  const personal=fs.existsSync(reviewFile)?a.read(review+'-review.json'):{at:c.now(),pngSHA256:rr.pngSHA256,scene,wholeFrame:true,targetHwnd:rr.snapshot.focus,observation,quitRoute:route};
  if(!fs.existsSync(reviewFile))a.save(review+'-review.json',personal);
  assert(personal.wholeFrame&&personal.pngSHA256===rr.pngSHA256&&personal.scene===scene);
  const fresh=reviewSeconds(p,scene);
  assert(c.now()>=personal.at&&c.now()-personal.at<fresh);assert.equal(personal.targetHwnd,rr.snapshot.focus);
  if(route)assert.equal(personal.quitRoute,route);
  assert.equal(c.sha256(fs.readFileSync(path.join(a.R,review+'.png'))),rr.pngSHA256);
  assert(!fs.readdirSync(a.R).some(n=>n.startsWith(review+'-used-by-')));
  if(pointer)require('../lib/cli-native-pointer-coordinates').nativePoint(rr.snapshot.pointerMapping,pointer.x,pointer.y);
  const targeting=Math.min(rr.at+fresh,personal.at+fresh,end),due=c.now()+p.fallbackMs/1000;
  const refuse=stage=>{a.save(name+'-rejection.json',{at:c.now(),stage,state:'NOT_SENT',effects:false,targeting,confirmationMs:p.confirmationMs,reason:'insufficient remaining reviewed-image confirmation budget'});return 'NOT_SENT: fresh capture and review required';};
  if(!reviewAdmission(c.now(),targeting,p))return refuse('before-prearm');
  assert(c.now()+p.confirmationMs/1000+ms/1000<due);assert(due+p.confirmationMs/1000<end);
  const nonce=crypto.randomUUID(),deadline=Math.trunc(Math.min(targeting,due,route?end:a.reserve())*1000);
  a.save(name+'-operation.json',{start,end,policy:p,deadline,targeting,due,nonce,immutable:true,ms,key,pointer,scene,review});
  a.save(review+'-used-by-'+name,{name,nonce});
  const child=cp.spawn(process.execPath,[__filename,'release',a.R,a.URL,name,owner.owner,String(due),String(p.confirmationMs)],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const wait=new Promise(r=>child.once('close',(code,signal)=>r({pid:child.pid,code,signal,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr})));
  let error,receipt;
  try{
   const armed=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('UP prearm timeout')),1000);child.stdout.once('data',()=>{clearTimeout(t);resolve(JSON.parse(stdout.split('\n')[0]));});});a.save(name+'-armed.json',armed);
   assert.equal(armed.armed,true);assert(c.now()+p.confirmationMs/1000+ms/1000<due);
   a.opened();enforce();
   if(!reviewAdmission(c.now(),targeting,p)){a.save(name+'-disarm.json',{at:c.now()});return refuse('after-prearm');}
   const sentAt=c.now();assert(sentAt<targeting);a.save(name+'-dispatch.json',{at:sentAt,nonce,mayHaveEffects:true});
   const cmd=pointer?pointer.action+':'+pointer.x+':'+pointer.y:'keydown:'+key;
   const result=await c.postJSON(a.URL,{action:'guarded-input',cmd,guard:{...owner,nonce,reviewed:true,deadline,intent:{review:{contract:'native-reviewed-context-v1',captureId:rr.captureId,pngSHA256:rr.pngSHA256,reviewed:true,reviewedAt:personal.at*1000,scope:scene,targetHwnd:rr.snapshot.focus}}}},p.confirmationMs/1000);
   const returnedAt=c.now();a.save(name+'-reply.json',{sentAt,returnedAt,result});assert(result.ok,JSON.stringify(result));receipt=result.value;
   proof(receipt,{owner,nonce,deadline,key,pointer,sentAt,hwnd:Number(rr.snapshot.focus),threadId:rr.snapshot.focusWindow.threadId});assert((returnedAt-sentAt)*1000<=p.confirmationMs);
   a.save(name+'-receipt.json',receipt);assert(returnedAt<receipt.consumedAt/1000+ms/1000,'late receipt cannot authorize pulse renewal');
   a.save(name+'-release-at.json',{at:receipt.consumedAt/1000+ms/1000});
  }catch(e){error=e;if(!fs.existsSync(path.join(a.R,name+'-dispatch.json')))a.save(name+'-disarm.json',{at:c.now()});}
  finally{a.save(name+'-release-wait.json',await wait);}
  if(error)throw error;
  const up=a.read(name+'-up.json');assert(up.physicalUpACK);assert.equal(up.reply.value.owner,owner.owner);assert(up.at<end);assert((up.at-start)*1000<p.physicalUpMs);
  if(fs.existsSync(path.join(a.R,'last-intent.json')))fs.unlinkSync(path.join(a.R,'last-intent.json'));
  a.save('last-intent.json',{nonces:[nonce]});a.save(name+'-complete.json',{at:c.now(),consumed:true,physicalUpACK:true,receipt,up,visualConsequence:false,ordinaryQuit:false});
  if(final)return 'Finite final input acknowledged; ordinary exit still requires actual wait';
  const image=await a.capture(name,end);assert.equal(a.read(name+'.json').snapshot.physicalUp,true);return image;
 }catch(e){a.fail(e,name);throw e;}
}
module.exports={fixture,policy,reviewSeconds,reviewAdmission,durationAdmission,proof,pulse,release};
if(require.main===module&&process.argv[2]==='release')release(process.argv[3],process.argv[4],process.argv[5],process.argv[6],Number(process.argv[7]),Number(process.argv[8])).catch(e=>{console.error(e);process.exitCode=1;});
