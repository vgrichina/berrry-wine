'use strict';
// A dedicated process owns only UP. No DOWN method or parent ACK dependency.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {ownChild}=require('./quake2-native-release.cjs');
const {exactInput}=require('./native-mouse-consumption-input.cjs');
function createReleaseState(intent,at=Date.now()){
  exactInput(intent);
  const state={...structuredClone(intent),armed:at,due:at+1500,fallback:at+1750,cancelNoDown:false,fired:null};
  return {state,
    command(v){assert(v.nonce===state.nonce&&!state.fired,'stale/fired release command');
      if(v.command==='cancel')state.cancelNoDown=true;
      else{assert(v.command==='due'&&!state.cancelNoDown&&Number.isSafeInteger(v.at)&&v.at>=at&&v.at<=state.fallback);
        state.due=Math.min(state.due,v.at);}},
    params(){assert(!state.cancelNoDown&&!state.fired,'release cancelled/already fired');
      state.fired=Date.now();return state.kind==='key'?
        {type:'keyUp',key:state.key,code:state.domCode,windowsVirtualKeyCode:state.code,nativeVirtualKeyCode:state.code}:
        {type:'mouseReleased',button:state.button===2?'right':'left',buttons:0,x:state.x,y:state.y,clickCount:1};},
  };
}
function identity(cfg){assert.equal(fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8').split(') ').at(-1).split(' ')[19],cfg.startToken);}
async function participant(out,cfg){
  assert(typeof cfg.owner==='string'&&cfg.owner);identity(cfg);
  const c=require('./warcraft3-current-controller.cjs').qualifiedLoader().load('tools/gltron-browser-controller.cjs').connection(cfg.url);
  const bounded=async(fn,ms)=>{let timer;try{return await Promise.race([fn(),new Promise((_,j)=>{timer=setTimeout(()=>j(Error('mouse release transport deadline')),ms);})]);}finally{clearTimeout(timer);}};
  let active=null,task=null,ended=false,buffer='',hard;
  const seen=new Set(),emit=v=>process.stdout.write(JSON.stringify(v)+'\n');
  try{
    await bounded(()=>c.ready,1000);
    const session=(await bounded(()=>c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true}),500)).sessionId;
    await bounded(()=>c.send('Runtime.enable',{},session),500);
    c.event=v=>{if(v.sessionId!==session||v.method!=='Runtime.consoleAPICalled'||v.params.args?.[0]?.value!=='GLTRON_NATIVE_PHYSICAL_UP')return;
      const receipt=JSON.parse(v.params.args[1].value),a=active?.state;
      if(a&&receipt.nonce===a.nonce&&receipt.code===a.code&&receipt.kind===a.kind&&receipt.owner===cfg.owner)a.receipt=receipt;};
    await new Promise((resolve,reject)=>{
      const finish=()=>{if(ended&&!task)resolve();};
      process.stdin.on('end',()=>{ended=true;finish();});
      process.stdin.on('data',b=>{buffer+=b;let i;try{while((i=buffer.indexOf('\n'))>=0){
        const v=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);
        if(v.command!=='arm'){assert(active,'no armed release');active.command(v);continue;}
        assert(!active&&!seen.has(v.nonce),'concurrent/replayed release');identity(cfg);
        seen.add(v.nonce);active=createReleaseState(v);const a=active.state;
        hard=setTimeout(()=>{c.ws.close();process.exit(1);},5000);
        emit({event:'armed',nonce:a.nonce,at:a.armed,releaseDue:a.due,fallback:a.fallback,pid:process.pid});
        task=(async()=>{
          try{
            while(!a.cancelNoDown&&Date.now()<a.due)await new Promise(r=>setTimeout(r,Math.max(1,Math.min(5,a.due-Date.now()))));
            if(!a.cancelNoDown){
              identity(cfg);const params=active.params();
              await bounded(()=>c.send(a.kind==='key'?'Input.dispatchKeyEvent':'Input.dispatchMouseEvent',params,session),250);a.transportACKAt=Date.now();
              while(!a.receipt&&Date.now()<a.fallback+500)await new Promise(r=>setTimeout(r,5));
              assert(a.fired<=a.fallback&&a.receipt?.trusted&&!a.receipt.down&&
                a.receipt.at>=a.armed&&a.receipt.at<=a.fallback,'independent trusted mouse UP absent/late');
            }
          }catch(e){a.failure=e.stack;throw e;}
          finally{fs.writeFileSync(out+'/'+a.name+'-up.json',JSON.stringify({...a,independent:true})+'\n',{flag:'wx'});}
          clearTimeout(hard);hard=null;active=null;
          emit({event:'done',nonce:a.nonce,ok:true,cancelNoDown:a.cancelNoDown});
        })().then(()=>{task=null;finish();},reject);
      }}catch(e){reject(e);}});
      emit({event:'ready',pid:process.pid,targetId:cfg.targetId,startToken:cfg.startToken,owner:cfg.owner});
    });
  }finally{
    // EOF, malformed IPC or a stale command cannot retire the independent
    // transport before an already armed edge has had its finite UP attempt.
    process.stdin.pause();if(task)await task;
    clearTimeout(hard);c.ws.close();process.stdin.destroy();
  }
}
async function createRelease(out,cfg){
  const file=out+'/native-mouse-release-config.json';fs.writeFileSync(file,JSON.stringify(cfg)+'\n',{flag:'wx'});
  const child=cp.spawn(process.execPath,[__filename,'participant',out,file],{stdio:['pipe','pipe','pipe']});
  const owned=ownChild(child,r=>fs.writeFileSync(out+'/native-mouse-release-wait.json',JSON.stringify(r)+'\n',{flag:'wx'}));
  let buffer='',failure=null,closing=false;const messages=[],waiters=new Set();
  const notify=()=>{for(const f of waiters)f();};
  child.stdin.on('error',e=>{failure??=e;notify();});child.on('error',e=>{failure??=e;notify();});
  child.stdout.on('data',b=>{buffer+=b;let i;try{while((i=buffer.indexOf('\n'))>=0){messages.push(JSON.parse(buffer.slice(0,i)));buffer=buffer.slice(i+1);}notify();}catch(e){failure=e;notify();}});
  const joined=owned.joined.then(r=>{failure??=Error('independent mouse release exited '+r.code);notify();return r;});
  const receive=(event,nonce,ms)=>new Promise((resolve,reject)=>{
    const until=performance.now()+ms;let timer;
    const check=()=>{const v=messages.find(m=>m.event===event&&(nonce===undefined||m.nonce===nonce));
      if(performance.now()<until&&!v&&!failure)return;clearTimeout(timer);waiters.delete(check);
      if(performance.now()>=until)reject(Error('mouse release '+event+' deadline'));else if(v)resolve(v);else reject(failure);};
    timer=setTimeout(check,ms);waiters.add(check);check();
  });
  const send=v=>{if(failure||closing)throw failure||Error('mouse release closed');child.stdin.write(JSON.stringify(v)+'\n');};
  const seen=new Set();
  try{const r=await receive('ready',undefined,2000);
    assert(r.pid===child.pid&&r.targetId===cfg.targetId&&r.startToken===cfg.startToken&&r.owner===cfg.owner);
    return {get alive(){return !failure&&!closing;},async arm(i){exactInput(i);assert(!seen.has(i.nonce));seen.add(i.nonce);send({...i,command:'arm'});return receive('armed',i.nonce,500);},
      due:(nonce,at)=>send({command:'due',nonce,at}),cancel:nonce=>send({command:'cancel',nonce}),finish:nonce=>receive('done',nonce,3000),
      async close(){if(!closing){closing=true;child.stdin.end();}const timer=setTimeout(()=>child.kill('SIGKILL'),3500);
        try{return await joined;}finally{clearTimeout(timer);}}};
  }catch(e){child.stdin.end();await owned.stop();throw e;}
}
module.exports={createReleaseState,createRelease};
if(require.main===module)participant(process.argv[3],JSON.parse(fs.readFileSync(process.argv[4]))).catch(e=>{console.error(e);process.exitCode=1;});
