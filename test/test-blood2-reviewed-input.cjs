'use strict';
// Self-contained authored native USER consumer; never loads Blood II media.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),cp=require('node:child_process');
const common=require('../tools/native-supervisor-common.cjs');
const out=path.resolve(process.argv[3]||fs.mkdtempSync(path.join(os.tmpdir(),'blood2-input-')));
async function body(){
 const a=require('../tools/blood2-reviewed-input.cjs');fs.mkdirSync(out,{recursive:true});a.R=out;
 const exe=path.join(out,'authored.exe');fs.writeFileSync(exe,require('./test-cli-native-button-delivery.cjs').fixture(0));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 a.URL='http://127.0.0.1:'+port+'/ctl';Object.assign(process.env,{BLOOD2_CONTROL_OUT:out,BLOOD2_CONTROL_URL:a.URL});
 const now=common.now();a.save('launch.json',{at:now,deadline:now+240,gameplayCutoff:now+60,reserveSeconds:180,nativeScene:true,
 inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:5,menuFreshnessSeconds:30}});
 const p=cp.spawn(process.execPath,['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--max-seconds=35','--max-batches=10000000','--control='+port,'--quiet-api','--quiet-blocks','--no-close'],{cwd:path.resolve(__dirname,'..'),stdio:['ignore','pipe','pipe']});
 const waited=common.communicate(p);a.save('native-pid.json',{pid:p.pid,startToken:common.token(p.pid),at:common.now()});
 async function review(name){await a.capture(name);const rr=a.read(name+'.json');a.save(name+'-review.json',{at:common.now(),pngSHA256:rr.pngSHA256,scene:'game',observation:'Automated authored test fixture only'});}
 try{
  const end=Date.now()+15000;for(;;){try{const s=await a.call({action:'snapshot'},.5);if(s.mainHwnd!=='0x0'&&s.focusWindow.live&&s.physicalUp)break;}catch{}assert(Date.now()<end,'authored startup');await common.sleep(25);}
  await review('binding');await a.bind('binding');
  for(const [name,key]of [['forward',38],['turn',39],['fire',17]]){
   await review(name+'before');await a.pulse(name,['keydown:'+key],100,name+'before','authored finite input');
   const down=a.read(name+'-down.json')[0],up=a.read(name+'-up.json');assert(down.consumed&&down.nativeMessage.wParam===key);assert.equal(down.receiptBoundary,'native-input-return');assert.equal(down.nativeMessage.consumption,'owner-user-return');assert.equal(up.state,'ACK');assert(up.at-down.consumedAt/1000<1.75);
  }
  // A real consumption followed by a deliberately lost reply is terminal.
  await review('lostbefore');const post=common.postJSON;let lost=false;
  common.postJSON=async(...args)=>{const value=await post(...args);if(args[1].action==='guarded-input'){lost=true;throw Error('authored lost ACK after native return');}return value;};
  await assert.rejects(a.pulse('lost',['keydown:17'],100,'lostbefore','authored ACK loss'),/lost ACK/);common.postJSON=post;
  assert(lost&&a.read('terminal-input-failure.json').noReplay);assert.equal(a.read('lost-up.json').state,'ACK');
  let calls=0;common.postJSON=async()=>{calls++;throw Error('closed endpoint called');};
  await assert.rejects(a.capture('afterunknown'),/sticky UNKNOWN/);assert.equal(calls,0);common.postJSON=post;
  a.save('assertions.json',{pass:true,nativeForwardTurnCtrl:true,independentUP:true,lostAckClosed:true,noLaterEndpoint:true});
 }finally{
  p.kill('SIGTERM');const wait=await waited;a.save('native-wait.json',{exit:wait.returncode,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded,stdout:wait.stdout.toString(),stderr:wait.stderr.toString()});assert(p.stdout.readableEnded&&p.stderr.readableEnded);assert.equal(wait.returncode,0);
 }
}
async function main(){if(process.argv[2]==='--body')return body();fs.mkdirSync(out,{recursive:true});const r=await require('../tools/native-supervise.cjs').supervise(path.join(out,'containment'),[process.execPath,__filename,'--body',path.join(out,'native')],{deadline:common.now()+55,cleanup_deadline:common.now()+65,grace:2});assert.equal(r.exit,0);assert.equal(r.leaked,false);console.log(JSON.stringify({pass:true,out}));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
