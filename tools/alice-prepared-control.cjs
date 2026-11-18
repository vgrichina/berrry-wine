'use strict';
// Alice's accepted finite USER-return/PM_NOREMOVE receipt and independent UP.
// Each invocation follows an actual whole-frame review. No automatic gameplay.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),a=require('./alice-local-original.cjs'),c=require('./native-supervisor-common.cjs'),d=require('./drakan-menu-input.cjs');
const run=path.resolve(process.env.ALICE_CONTROL_OUT||'.');
function configure(){a.R=run;a.URL=a.read('endpoint.json').url;}
const p=d.policy(process.env.ALICE_GAME_SLOW==='1'?{confirmationMs:5000,fallbackMs:6500,physicalUpMs:12000,operationMs:15000}:{confirmationMs:2000,fallbackMs:3000,physicalUpMs:5500,operationMs:8000});
assert(a.confirmationFits(10,10+p.confirmationMs/1000-.001,20,p.confirmationMs));assert(!a.confirmationFits(10,10+p.confirmationMs/1000+.001,20,p.confirmationMs));
async function main(){
 configure();
 const [mode,name,review,keyArg,scene='menu',intent='gameplay',route,finalArg]=process.argv.slice(2);
 if(mode==='capture'){console.log(await a.capture(name));return;}
 if(mode==='release'){await d.release(run,a.URL,name,review,Number(keyArg),p.confirmationMs);return;}
 assert.equal(mode,'pulse');const key=Number(keyArg),start=c.now(),end=start+p.operationMs/1000,ms=Number(process.env.ALICE_PULSE_MS||200);assert(Number.isInteger(ms)&&ms>=80&&ms<=1000);
 assert(/^[A-Za-z0-9-]+$/.test(name));assert([13,27,32,37,38,39,40,65,68,83,87].includes(key));assert(['menu','game'].includes(scene));
 // Local immutable admission precedes owner lookup, review writes, binding,
 // lease requests and UP arming. Refusal is known NOT_SENT, never UNKNOWN.
 const admission=preflight({intent,key,route,end,at:start,cutoff:a.reserve(),quitPhase:fs.existsSync(path.join(run,'quit-phase.json'))});
 if(!admission.allowed){
  a.save(name+'-rejection.json',{...admission,at:start,end,effects:false});
  if(admission.quitPhase&&!fs.existsSync(path.join(run,'quit-phase.json')))a.save('quit-phase.json',{at:start,cutoff:a.reserve(),irreversible:true,reason:'full operation no longer fits'});
  console.log('NOT_SENT: '+admission.reason);return;
 }
 a.opened();a.policy(intent,['keydown:'+key],null,route,end);
 const rr=a.read(review+'.json');assert.equal(c.sha256(fs.readFileSync(path.join(run,review+'.png'))),rr.pngSHA256);
 const personal={at:c.now(),pngSHA256:rr.pngSHA256,wholeFrame:true,scene,targetHwnd:rr.snapshot.focus,observation:process.env.ALICE_OBSERVATION,quitRoute:route??null};assert(personal.observation?.trim());assert(start>=rr.at&&start-rr.at<(scene==='menu'?90:60));a.save(review+'-review.json',personal);
 if(!fs.existsSync(path.join(run,'input-owner.json')))await a.bind(review);
 const [owner,before]=await a.lease();assert(before.physicalUp&&rr.snapshot.physicalUp);assert(!fs.readdirSync(run).some(n=>n.startsWith(review+'-used-by-')));
 const targeting=Math.min(rr.at+(scene==='menu'?90:60),personal.at+(scene==='menu'?90:60),end),due=c.now()+p.fallbackMs/1000,deadline=Math.trunc(Math.min(targeting,due,intent==='quit'?end:a.reserve())*1000),nonce=crypto.randomUUID();
 assert(c.now()+p.confirmationMs/1000+ms/1000<due);assert(due+p.confirmationMs/1000<end);
 a.save(name+'-operation.json',{start,end,policy:p,targeting,due,deadline,nonce,ms,key,scene,intent,route,review,immutable:true,calibration:'Original menu ACK908ms, native menu consequence about15s; finite confirmation selected before dispatch independently of pulse and UP'});a.save(review+'-used-by-'+name,{name,nonce});
 const child=cp.spawn(process.execPath,[__filename,'release',name,owner.owner,String(due)],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const wait=new Promise(resolve=>child.once('close',(code,signal)=>resolve({pid:child.pid,code,signal,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr})));
 let error;try{
 const armed=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('UP arm deadline')),1000);child.stdout.once('data',()=>{clearTimeout(t);resolve(JSON.parse(stdout.split('\n')[0]));});});assert(armed.armed);a.save(name+'-armed.json',armed);a.opened();a.policy(intent,['keydown:'+key],review,route,end);
 const sentAt=c.now();assert(sentAt+p.confirmationMs/1000+ms/1000<due);a.save(name+'-dispatch.json',{at:sentAt,nonce,mayHaveEffects:true});const result=await c.postJSON(a.URL,{action:'guarded-input',cmd:'keydown:'+key,guard:{...owner,nonce,reviewed:true,deadline,intent:{review:{contract:'native-reviewed-context-v1',captureId:rr.captureId,pngSHA256:rr.pngSHA256,reviewed:true,reviewedAt:personal.at*1000,scope:scene,targetHwnd:rr.snapshot.focus}}}},p.confirmationMs/1000);const returnedAt=c.now();a.save(name+'-reply.json',{sentAt,returnedAt,result});assert(result.ok,JSON.stringify(result));const receipt=result.value;require(path.join(ROOT,'tools/alice-native-game-window.cjs')).inputReceipt(receipt,{owner,nonce,deadline,key,sentAt,hwnd:Number(rr.snapshot.focus),threadId:rr.snapshot.focusWindow.threadId});assert(a.confirmationFits(sentAt,returnedAt,deadline/1000,p.confirmationMs));a.save(name+'-receipt.json',receipt);a.save(name+'-release-at.json',{at:receipt.consumedAt/1000+ms/1000});
 }catch(e){error=e;if(!fs.existsSync(path.join(run,name+'-dispatch.json')))a.save(name+'-disarm.json',{at:c.now()});}finally{a.save(name+'-release-wait.json',await wait);}
 if(error)throw error;const up=a.read(name+'-up.json');if(!up.physicalUpACK&&finalArg==='final'){let exited;while(c.now()<end){exited=a.exitedOwner(a.read('native-pid.json'));if(exited)break;await c.sleep(10);}assert(exited,'final exit requires actual native wait');a.save(name+'-owner-exited.json',{exited,physicalUpACK:false});}else assert(up.physicalUpACK);assert(up.at<end);assert((up.at-start)*1000<p.physicalUpMs);if(fs.existsSync(path.join(run,'last-intent.json')))fs.unlinkSync(path.join(run,'last-intent.json'));a.save('last-intent.json',{nonces:[nonce]});a.save(name+'-complete.json',{at:c.now(),consumed:true,physicalUpACK:up.physicalUpACK===true,visualConsequence:false});if(finalArg==='final'){console.log('Final ordinary input consumed; wait for native/watchdog EOF');return;}console.log(await a.capture(name,end));
}
if(require.main===module)main().catch(e=>{if(!(e instanceof a.ReserveRejected))a.fail(e,process.argv[3]);console.error(e);process.exitCode=1;});
function preflight({intent,key,route,end,at,cutoff,quitPhase}){
 assert(['gameplay','quit'].includes(intent));assert([at,end,cutoff].every(Number.isFinite)&&end>at);
 if(intent==='quit')return {allowed:!!a.QUIT_ROUTES[route]?.includes('keydown:'+key),state:'NOT_SENT',quitPhase:true,reason:'ordinary Quit route required'};
 if(quitPhase||end>=cutoff)return {allowed:false,state:'NOT_SENT',quitPhase:true,reason:'preserve immutable Quit reserve'};
 return {allowed:true,quitPhase:false};
}
module.exports={main,preflight};
