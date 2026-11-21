'use strict';
// Independent UP participant. A refused DOWN may have no guard UP ticket.
// Retain its real trusted DOM UP separately, without inventing a native receipt
// or making a status/release query after the main scope becomes UNKNOWN.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {ownChild}=require('./quake2-native-release.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function installReleaseWitness(intent) {
  const w=window.fixtureWine||runningApps.find(a=>a?.name==='mdk2_demo')?.wine;
  if(!w?.running||!w.renderer||!w.memory||!w.instance)throw Error('release owner missing');
  const renderer=w.renderer,memory=w.memory,module=w._wasmModule,instance=w.instance,pid=w.processId;
  const armed=Date.now();
  function up(event){
    if(!event.isTrusted||event.keyCode!==intent.code||event.code!==intent.domCode)return;
    window.removeEventListener('keyup',up,true);
    // Existing browser-input handlers finish before this read. Only observe.
    queueMicrotask(()=>{
      const stable=w.renderer===renderer&&w.memory===memory&&w._wasmModule===module&&w.instance===instance&&w.processId===pid;
      const held=!!renderer.peekKeyDownState(intent.code);
      const receipt={nonce:intent.nonce,code:intent.code,domCode:intent.domCode,kind:'key',at:Date.now(),armed,trusted:event.isTrusted,down:held,stable,processId:pid,
        boundary:'trusted-dom-up-renderer-unheld',nativeGuardReceipt:false};
      console.info('MDK2_RELEASE_SCOPE_ACK',JSON.stringify(receipt));
    });
  }
  window.addEventListener('keyup',up,true);
  return {nonce:intent.nonce,armed,processId:pid,boundary:'preinstalled-trusted-dom-up'};
}
function validateACK(a,r){
  return !!r&&r.nonce===a.nonce&&r.code===a.code&&r.domCode===a.domCode&&r.kind==='key'&&
    r.trusted===true&&r.down===false&&r.stable===true&&r.at>=a.armed&&r.at<=a.fallback&&
    r.boundary==='trusted-dom-up-renderer-unheld'&&r.nativeGuardReceipt===false;
}
function identity(cfg){assert.equal(fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8').split(') ').at(-1).split(' ')[19],cfg.startToken);}
async function participant(out,cfg){
  const c=require('./gltron-browser-controller.cjs').connection(cfg.url);
  let active=null,task=null,ended=false,buffer='',hard;
  const emit=v=>process.stdout.write(JSON.stringify(v)+'\n');
  const bounded=async(fn,ms)=>{let t;try{return await Promise.race([fn(),new Promise((_,j)=>t=setTimeout(()=>j(Error('release transport deadline')),ms))]);}finally{clearTimeout(t);}};
  const seen=new Set();
  try{
    identity(cfg);hard=setTimeout(()=>{c.ws.close();process.exit(1);},5000);
    await bounded(()=>c.ready,1000);
    const session=(await bounded(()=>c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true}),500)).sessionId;
    c.event=v=>{if(v.sessionId!==session||v.method!=='Runtime.consoleAPICalled')return;
      const tag=v.params.args?.[0]?.value;if(!['MDK2_RELEASE_SCOPE_ACK','GLTRON_NATIVE_PHYSICAL_UP'].includes(tag))return;
      const r=JSON.parse(v.params.args[1].value);if(active?.nonce!==r.nonce)return;
      if(tag==='MDK2_RELEASE_SCOPE_ACK')active.releaseACK=r;else active.guardReceipt=r;
    };
    await bounded(()=>c.send('Runtime.enable',{},session),500);
    await new Promise((resolve,reject)=>{
      const finish=()=>{if(ended&&!task)resolve();};
      process.stdin.on('end',()=>{ended=true;finish();});
      process.stdin.on('data',b=>{buffer+=b;let i;
        try{while((i=buffer.indexOf('\n'))>=0){const v=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);
          if(v.command==='arm'){
            assert(!active&&!task&&!seen.has(v.nonce)&&/^action-\d+$/.test(v.name));
            assert(v.kind==='key'&&Number.isInteger(v.code)&&v.code>0&&v.code<255&&typeof v.key==='string'&&typeof v.domCode==='string');
            identity(cfg);seen.add(v.nonce);const armed=Date.now(),a=active={...v,armed,fallback:armed+1750,due:armed+1500,releaseACK:null,guardReceipt:null};
            clearTimeout(hard);hard=setTimeout(()=>{c.ws.close();process.exit(1);},5000);
            task=(async()=>{
              // This is the last endpoint evaluation in the participant. It
              // completes before the parent receives arm authority or DOWN.
              const installed=await bounded(()=>c.send('Runtime.evaluate',{expression:'('+installReleaseWitness.toString()+')('+JSON.stringify(v)+')',returnByValue:true},session),500);
              assert(!installed.exceptionDetails&&installed.result.value?.nonce===v.nonce,'release witness prearm');a.witness=installed.result.value;
              emit({event:'armed',nonce:a.nonce,at:armed,fallback:a.fallback,releaseDue:a.due,pid:process.pid,witness:a.witness});
              while(!a.cancelNoDown&&Date.now()<a.due)await sleep(Math.max(1,Math.min(5,a.due-Date.now())));
              try{if(!a.cancelNoDown){identity(cfg);a.fired=Date.now();
                await bounded(()=>c.send('Input.dispatchKeyEvent',{type:'keyUp',key:a.key,code:a.domCode,windowsVirtualKeyCode:a.code,nativeVirtualKeyCode:a.code},session),250);
                a.transportACKAt=Date.now();
                while(!a.releaseACK&&Date.now()<a.fallback+500)await sleep(5);
              }}finally{fs.writeFileSync(out+'/'+a.name+'-up.json',JSON.stringify({...a,independent:true})+'\n',{flag:'wx'});}
              assert(a.cancelNoDown||(a.fired<=a.fallback&&validateACK(a,a.releaseACK)),'independent trusted UP/release ACK absent or late');
              clearTimeout(hard);hard=null;active=null;
              emit({event:'done',nonce:a.nonce,ok:true,cancelNoDown:!!a.cancelNoDown,releaseACK:a.releaseACK,guardReceipt:a.guardReceipt});
            })().then(()=>{task=null;finish();},reject);
          }else{assert(active&&active.nonce===v.nonce,'stale release nonce');if(v.command==='cancel')active.cancelNoDown=true;
            else{assert(v.command==='due'&&Number.isSafeInteger(v.at)&&v.at>=active.armed&&v.at<=active.fallback);active.due=Math.min(active.due,v.at);}}
        }}catch(e){reject(e);}
      });
      clearTimeout(hard);hard=null;emit({event:'ready',pid:process.pid,targetId:cfg.targetId,startToken:cfg.startToken});
    });
  }finally{clearTimeout(hard);c.ws.close();process.stdin.destroy();}
}
async function createRelease(out,cfg){
  const file=out+'/mdk2-release-config.json';fs.writeFileSync(file,JSON.stringify(cfg)+'\n',{flag:'wx'});
  const child=cp.spawn(process.execPath,[__filename,'participant',out,file],{stdio:['pipe','pipe','pipe']});
  const owned=ownChild(child,r=>fs.writeFileSync(out+'/mdk2-release-wait.json',JSON.stringify(r)+'\n',{flag:'wx'}));
  const messages=[],waiters=new Set();let buffer='',failure=null,stderr='';
  const notify=()=>{for(const f of waiters)f();};
  child.stdin.on('error',e=>{failure??=e;notify();});child.on('error',e=>{failure??=e;notify();});
  child.stdout.on('data',b=>{buffer+=b;let i;while((i=buffer.indexOf('\n'))>=0){messages.push(JSON.parse(buffer.slice(0,i)));buffer=buffer.slice(i+1);}notify();});
  child.stderr.on('data',b=>stderr+=b);
  const joined=owned.joined.then(r=>{failure??=Error('release participant closed '+r.code+' '+stderr);notify();return r;});
  function receive(event,nonce,ms){const until=performance.now()+ms;return new Promise((resolve,reject)=>{let timer;const check=()=>{const v=messages.find(v=>v.event===event&&(nonce===undefined||v.nonce===nonce));if(!v&&!failure&&performance.now()<until)return;clearTimeout(timer);waiters.delete(check);if(v)resolve(v);else reject(failure||Error('independent UP '+event+' deadline'));};timer=setTimeout(check,ms);waiters.add(check);check();});}
  const send=v=>{if(failure)throw failure;child.stdin.write(JSON.stringify(v)+'\n');};
  try{const ready=await receive('ready',undefined,2000);assert(ready.pid===child.pid&&ready.targetId===cfg.targetId&&ready.startToken===cfg.startToken);const nonces=new Set();
    return {async arm(v){assert(!nonces.has(v.nonce));nonces.add(v.nonce);send({...v,command:'arm'});return receive('armed',v.nonce,500);},due:(nonce,at)=>send({command:'due',nonce,at}),cancel:nonce=>send({command:'cancel',nonce}),finish:nonce=>receive('done',nonce,3000),async close(){child.stdin.end();return joined;}};
  }catch(e){await owned.stop();throw e;}
}
module.exports={createRelease,installReleaseWitness,validateACK};
if(require.main===module)participant(process.argv[3],JSON.parse(fs.readFileSync(process.argv[4]))).catch(e=>{console.error(e.stack);process.exitCode=1;});
