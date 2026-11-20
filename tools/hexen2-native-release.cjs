'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=process.env.WINE_BRIDGE_ROOT||path.resolve(__dirname,'..');
const identity=cfg=>assert.equal(fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8').split(') ').at(-1).split(' ')[19],cfg.startToken);
async function participant(out,cfg){
  const {connection}=require(ROOT+'/tools/gltron-browser-controller.cjs');identity(cfg);
  const c=connection(cfg.url);let active=null,buffer='',ended=false,task=null;
  const seen=new Set(),emit=v=>process.stdout.write(JSON.stringify(v)+'\n');
  let hard=setTimeout(()=>{c.ws.close();process.exit(1);},5000);
  const bounded=async(fn,ms)=>{let timer;try{return await Promise.race([fn(),new Promise((_,j)=>{timer=setTimeout(()=>j(Error('release transport deadline')),ms);})]);}finally{clearTimeout(timer);}};
  try{
    await bounded(()=>c.ready,1000);
    const session=(await bounded(()=>c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true}),500)).sessionId;
    await bounded(()=>c.send('Runtime.enable',{},session),500);
    c.event=v=>{if(v.sessionId===session&&v.method==='Runtime.consoleAPICalled'&&v.params.args?.[0]?.value==='GLTRON_NATIVE_PHYSICAL_UP'){
      const r=JSON.parse(v.params.args[1].value);if(active?.nonce===r.nonce)active.receipt=r;
    }};
    const done=new Promise((resolve,reject)=>{
      const finish=()=>{if(ended&&!task)resolve();};
      process.stdin.on('end',()=>{ended=true;finish();});
      process.stdin.on('data',b=>{buffer+=b;let i;try{while((i=buffer.indexOf('\n'))>=0){
        const v=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);
        if(v.command==='arm'){
          assert(!active&&!seen.has(v.nonce)&&typeof v.nonce==='string'&&v.nonce);
          assert(/^action-\d+$/.test(v.name)&&['key','mouse'].includes(v.kind));
          assert(Number.isInteger(v.code)&&v.code>0&&v.code<255);
          if(v.kind==='mouse')assert(v.code===1&&v.button===0&&Number.isFinite(v.x)&&Number.isFinite(v.y));
          else assert(typeof v.key==='string'&&typeof v.domCode==='string');
          identity(cfg);seen.add(v.nonce);const armed=Date.now();
          const a=active={...v,armed,fallback:armed+1750,due:armed+1500,receipt:null};
          clearTimeout(hard);hard=setTimeout(()=>{c.ws.close();process.exit(1);},5000);
          emit({event:'armed',nonce:a.nonce,at:armed,fallback:a.fallback,releaseDue:a.due,pid:process.pid});
          task=(async()=>{
            while(!a.cancelNoDown&&Date.now()<a.due)await new Promise(r=>setTimeout(r,Math.max(1,Math.min(5,a.due-Date.now()))));
            try{if(!a.cancelNoDown){
              // No owner/focus query and no await of a parent's DOWN ACK can
              // postpone an already armed UP. This participant never sends DOWN.
              identity(cfg);a.fired=Date.now();
              const params=a.kind==='mouse'?{type:'mouseReleased',button:'left',buttons:0,x:a.x,y:a.y,clickCount:1}:
                {type:'keyUp',key:a.key,code:a.domCode,windowsVirtualKeyCode:a.code,nativeVirtualKeyCode:a.code};
              await bounded(()=>c.send(a.kind==='mouse'?'Input.dispatchMouseEvent':'Input.dispatchKeyEvent',params,session),250);
              a.transportACKAt=Date.now();
              while(!a.receipt&&Date.now()<a.fallback+500)await new Promise(r=>setTimeout(r,5));
            }
            }catch(e){a.failure=e.stack;throw e;}finally{
              fs.writeFileSync(out+'/'+a.name+'-up.json',JSON.stringify({...a,independent:true})+'\n',{flag:'wx'});
            }
            assert(a.cancelNoDown||(a.fired<=a.fallback&&a.receipt?.trusted&&!a.receipt.down&&a.receipt.at>=a.armed&&a.receipt.at<=a.fallback),'independent trusted physical UP absent/late');
            clearTimeout(hard);hard=null;
            active=null;emit({event:'done',nonce:a.nonce,ok:true,cancelNoDown:!!a.cancelNoDown});
          })().then(()=>{task=null;finish();},reject);
        }else{
          assert(active&&active.nonce===v.nonce,'stale release nonce');
          if(v.command==='cancel')active.cancelNoDown=true;
          else{assert(v.command==='due'&&Number.isSafeInteger(v.at)&&v.at>=active.armed&&v.at<=active.fallback);active.due=Math.min(active.due,v.at);}
        }
      }}catch(e){reject(e);}});
      emit({event:'ready',pid:process.pid,targetId:cfg.targetId,startToken:cfg.startToken});
    });
    clearTimeout(hard);hard=null;await done;
  }finally{clearTimeout(hard);c.ws.close();process.stdin.destroy();}
}
async function createRelease(out,cfg){
  const file=path.join(out,'hexen-release-config.json');fs.writeFileSync(file,JSON.stringify(cfg)+'\n',{flag:'wx'});
  const child=cp.spawn(process.execPath,[__filename,'participant',out,file],{stdio:['pipe','pipe','pipe']});
  const messages=[],waiters=new Set();let buffer='',stdout='',stderr='',failure=null;
  const notify=()=>{for(const f of waiters)f();};
  child.stdin.on('error',e=>{failure??=e;notify();});child.on('error',e=>{failure??=e;notify();});
  child.stdout.on('data',b=>{stdout+=b;buffer+=b;let i;while((i=buffer.indexOf('\n'))>=0){messages.push(JSON.parse(buffer.slice(0,i)));buffer=buffer.slice(i+1);}notify();});
  child.stderr.on('data',b=>stderr+=b);
  const joined=new Promise(resolve=>child.once('close',(code,signal)=>{failure??=Error('release child closed '+code+' '+stderr);notify();
    const receipt={pid:child.pid,code,signal,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr};
    fs.writeFileSync(out+'/hexen-release-wait.json',JSON.stringify(receipt)+'\n',{flag:'wx'});resolve(receipt);}));
  function receive(event,nonce,ms){const until=performance.now()+ms;return new Promise((resolve,reject)=>{
    let timer;const check=()=>{
      const value=messages.find(v=>v.event===event&&(nonce===undefined||v.nonce===nonce));
      if(performance.now()<until&&!value&&!failure)return;
      clearTimeout(timer);waiters.delete(check);
      if(performance.now()>=until)reject(Error('independent UP '+event+' deadline'));
      else if(value)resolve(value);else reject(failure);
    };timer=setTimeout(check,ms);waiters.add(check);check();
  });}
  const send=v=>{if(failure)throw failure;child.stdin.write(JSON.stringify(v)+'\n');};
  try{const ready=await receive('ready',undefined,2000);assert(ready.pid===child.pid&&ready.targetId===cfg.targetId&&ready.startToken===cfg.startToken);
    return {get alive(){return !failure;},async arm(v){send({...v,command:'arm'});return receive('armed',v.nonce,500);},
      due:(nonce,at)=>send({command:'due',nonce,at}),cancel:nonce=>send({command:'cancel',nonce}),
      finish:nonce=>receive('done',nonce,3000),async close(){child.stdin.end();return joined;}};
  }catch(e){child.stdin.end();await joined;throw e;}
}
module.exports={createRelease};
if(require.main===module)participant(process.argv[3],JSON.parse(fs.readFileSync(process.argv[4]))).catch(e=>{console.error(e);process.exitCode=1;});
