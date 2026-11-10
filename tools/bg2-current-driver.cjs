'use strict';
// BG2-only composition. Historical inputs remain immutable by hash.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PRIOR='scratch/runs/20261108-bg2-native-cage-key';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ACCEPTED={
 'browser-run.cjs':'47346c5c2f2b7c524cc1a6b829272021f25ce9bc2008e1a5ca5b71e9dd28fcdf',
 'bound-input.cjs':'2c167195e6bb59fd8e3668a179fc34c342c8b0d4e634a3c130ae4240359abc43',
 'native-mouse.cjs':'8a4a51ba40b6caaf81bf155c9ee9791aa8527af221b36899bd806dfee77a8844',
 'ordinary-keys.cjs':'f2cd7990daf6fabaa8eaf37475b9beca24bfabd9e600527616b906e531538cda',
 'keyboard-bridge.cjs':'b17df90ee4fa4fca0ba30ed576e69a7af9879c172cfe48ed093245272c25ed0f',
 'transport.cjs':'fec7eddbf469856bbee3df7f410e1b2b52b327d04715aed2d941c55783447c41'
};
function historicalRead(root,name){const b=fs.readFileSync(path.join(root,PRIOR,name));assert.equal(sha(b),ACCEPTED[name],'immutable accepted BG2 input '+name);return b.toString('utf8');}
function exact(s,a,b){assert.equal(s.split(a).length,2,'unique BG2 seam: '+a);return s.replace(a,b);}
function validate(c){
 assert(['capture','click','doubleclick','drag','key','type','quit'].includes(c.action),'BG2 ordinary action');
 if(c.action==='type')assert(typeof c.text==='string'&&/^[A-Z]{1,12}$/.test(c.text),'bounded uppercase name before publication');
 assert(Number.isInteger(c.waitMs)&&c.waitMs>=0&&c.waitMs<=10000,'bounded BG2 wait');
}
function terminalGuard({save,cancel,clear=()=>{}}){
 let error=null;
 return {check(){if(error)throw error;},fail(e){if(!error){error=e instanceof Error?e:Error(String(e));try{clear();save({at:new Date().toISOString(),error:error.stack,noLaterProtocol:true});}finally{cancel();}}return error;},get error(){return error;}};
}
function compose(root){
 let s=historicalRead(root,'browser-run.cjs');
 s=exact(s,'let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;let id=0;',`const bg2=require('../../../tools/bg2-current-driver.cjs');
let guard;
function fail(e){return guard.fail(e);}
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;let id=0;`);
 s=exact(s,'const pending=new Map(),workers=new Map(),workerPromises=[];',`const pending=new Map(),workers=new Map(),workerPromises=[];
guard=bg2.terminalGuard({save:v=>save('terminal-error.json',v),clear:()=>{closing=true;process.exitCode=1;clearTimeout(timer);},cancel:()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(guard.error);}pending.clear();process.kill(process.ppid,'SIGTERM');}});`);
 s=exact(s,'function send(method,params={},sessionId){return new Promise','function send(method,params={},sessionId){try{guard.check();}catch(e){return Promise.reject(e);}return new Promise');
 s=exact(s,"reject(Error('CDP UNKNOWN '+method+'; no replay'));","reject(fail(Error('CDP UNKNOWN '+method+'; no replay')));");
 s=exact(s,'if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));','if(r.exceptionDetails)throw fail(Error(JSON.stringify(r.exceptionDetails)));');
 s=exact(s,'async function event(v){','async function event(v){guard.check();');
 s=exact(s,'async function state(){','async function state(){guard.check();');
 s=exact(s,"async function capture(label){assert(","async function capture(label){guard.check();assert(");
 s=exact(s,"async function close(reason){if(closing)return;","async function close(reason){if(reason!=='ordinary completion')throw fail(Error(reason));guard.check();if(closing)return;");
 s=exact(s,'async function execute(c,markDispatch){','async function execute(c,markDispatch){guard.check();bg2.validate(c);');
 s=exact(s,'await wait(c.waitMs);await capture(c.label);',`guard.check();const previous=latest?.sha256,previousLabel=latest?.label;await wait(c.waitMs);guard.check();await capture(c.label);
 if(c.action!=='capture'){
  assert.notEqual(latest.sha256,previous,'unchanged expected image; terminal');
  const rect=JSON.parse(fs.readFileSync(out+'/'+c.label+'-state.json')).canvas.rect;
  const difference=require('../../../tools/png-diff.js').diffPng(out+'/'+previousLabel+'.png',out+'/'+c.label+'.png',{region:{x:rect.left,y:rect.top,w:rect.width,h:rect.height}});
  save('input-'+c.id+'-image-difference.json',difference);assert(!difference.sizeMismatch&&difference.changed>0,'unchanged game canvas; terminal');
 }`);
 s=exact(s,"v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)","v.error?p.reject(fail(Error(JSON.stringify(v.error)))):p.resolve(v.result)");
 for(const name of ['worker-errors','event-errors'])s=s.replaceAll("log('"+name+".jsonl',","failAndLog('"+name+".jsonl',");
 s=exact(s,'async function event(v){guard.check();',"function failAndLog(n,v){log(n,v);fail(Error(JSON.stringify(v)));}\nasync function event(v){guard.check();");
 s=exact(s,'row.error=String(e);','row.error=String(e);fail(e);');
 const a=s.indexOf(' // Generated native CDP keyboard preflight'),b=s.indexOf(" const selectedApp=",a);
 assert(a>=0&&b>a);s=s.slice(0,a)+' // Qualified ordinary native helpers reused; offline current caller controls precede allocation.\n'+s.slice(b);
 s=exact(s,"})().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure');});","})().catch(e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});fail(e);});");
 return s;
}
function helpers(root){
 const files={};
 for(const n of ['bound-input.cjs','native-mouse.cjs','ordinary-keys.cjs','keyboard-bridge.cjs','transport.cjs'])files[n]=historicalRead(root,n);
 files['bound-input.cjs']=exact(files['bound-input.cjs'],"if (effects || e.code !== 'STALE_SCENE_BEFORE_DISPATCH') closed = true;","closed = true;");
 let t=files['transport.cjs'];
 const a=t.indexOf('  if(ack.status){'),b=t.indexOf('\n }\n}',a);assert(a>=0&&b>a);
 t=t.slice(0,a)+"  assert(!ack.status,'any refusal is terminal');"+t.slice(b);
 t=exact(t,' if(command.action===\'combo\')'," require('../../../tools/bg2-current-driver.cjs').validate(command);\n if(command.action==='combo')");
 const c=t.indexOf("   if(e.code==='STALE_SCENE_BEFORE_DISPATCH'"),d=t.indexOf('\n   throw e;',c);assert(c>=0&&d>c);
 t=t.slice(0,c)+t.slice(d);
 files['transport.cjs']=t;
 return files;
}
function generate(root,out){
 fs.mkdirSync(out,{recursive:true});
 const sources={'browser-run.cjs':compose(root),...helpers(root)},pins=[];
 for(const [name,text] of Object.entries(sources)){fs.writeFileSync(path.join(out,name),text,{flag:'wx'});pins.push({path:name,size:Buffer.byteLength(text),sha256:sha(text)});}
 return pins;
}
function leaseInput(root,run){
 const read=n=>JSON.parse(fs.readFileSync(path.join(run,n)));
 const deadline=read('deadline.json'),allocation=read('allocation.json'),created=read('boat-created.json'),life=read('lifecycle.json');
 assert.equal(allocation.uuid,deadline.uuid,'lease UUID');assert.equal(created.idempotencyKey,deadline.uuid,'create UUID');
 assert.equal(allocation.boxId,created.box.id,'allocated box');assert.equal(life.box,allocation.boxId,'launcher box');
 assert.equal(created.shutdownDelegated,true);assert.equal(life.shutdownDelegated,true);
 assert.equal(life.browserDeadline,Math.trunc((deadline.deadlineEpoch-120)*1000),'original browser deadline');
 assert(Date.now()<life.browserDeadline,'expired lease');
 assert.equal(sha(fs.readFileSync(path.join(run,'deadline.json'))),read('watchdog-ready.json').sha256,'immutable watchdog deadline');
 const file=path.join(run,'lifecycle.json'),relative=path.relative(root,file);
 assert(!path.isAbsolute(relative)&&!relative.split(path.sep).includes('..'),'owned lifecycle within root');
 const bytes=fs.readFileSync(file);return {path:relative,size:bytes.length,sha256:sha(bytes)};
}
function sealLease(root,run){
 // Allocation metadata exists only after allocation. Add it before the first
 // staging upload, and keep the tested source pins unchanged.
 assert(!fs.existsSync(path.join(run,'staging-window.json')),'lease must precede staging');
 const p=leaseInput(root,run),file=path.join(run,'runtime-pins.json'),manifest=JSON.parse(fs.readFileSync(file));
 assert(!manifest.files.some(x=>x.path===p.path),'lease already sealed');
 for(const pin of manifest.files){const b=fs.readFileSync(path.join(root,pin.path));assert.equal(b.length,pin.size,pin.path);assert.equal(sha(b),pin.sha256,pin.path);}
 manifest.files.push(p);manifest.files.sort((a,b)=>a.path.localeCompare(b.path));
 fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(run,'lease-input-seal.json'),JSON.stringify({passed:true,lifecycle:p,manifestSha256:sha(fs.readFileSync(file))},null,2)+'\n',{flag:'wx'});
 return p;
}
module.exports={compose,helpers,generate,validate,terminalGuard,leaseInput,sealLease,PRIOR,sha};
if(require.main===module){const root=path.resolve(__dirname,'..');console.log(JSON.stringify(process.argv[2]==='seal-lease'?sealLease(root,path.resolve(process.argv[3])):generate(root,path.resolve(process.argv[2]))));}
