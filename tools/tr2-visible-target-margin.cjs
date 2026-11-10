'use strict';
// Title-only composition of the retained TR2 caller. Never modify its inputs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const prior='scratch/runs/20261108-tr2-visible-target-damage-2142';
function exact(s,a,b){assert.equal(s.split(a).length,2,'unique TR2 caller seam: '+a);return s.replace(a,b);}
function guard(){
 let failed=null,navigation=0,shot=false;
 const check=()=>{if(failed)throw failed;};
 return {check,fail(e){failed??=e instanceof Error?e:Error(String(e));return failed;},
  validate(c){check();assert(c.action!=='combo','separate keys only');
   if(/^Arrow/.test(c.key||'')){assert(c.action==='key'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(c.key)&&Number.isInteger(c.holdMs)&&c.holdMs>0&&c.holdMs<=300,'navigation request <=300ms');assert(++navigation<=30,'navigation count');}
   if(c.key==='Control'){assert(!shot,'sole shot');assert(c.visibleEnemy===true&&typeof c.enemyReview==='string'&&c.enemyReview.trim(),'reviewed visible enemy required');assert(c.actionObserver===true&&c.weaponObserver===true&&c.untilShot===true&&c.holdMs===1900,'explicit linked shot');shot=true;}
  },hold(c,r){check();if(/^Arrow/.test(c.key||'')){const ms=(r.releaseCompletedAt??r.releaseAt)-r.started;assert(Number.isFinite(ms)&&ms>=0&&ms<=400,'actual navigation exceeds400ms');}},
  image(before,after,c){check();if(c.action!=='capture'&&c.action!=='observe')assert(before!==after,'unchanged expected image; terminal');}};
}
function compose(root){
 let s=fs.readFileSync(path.join(root,prior,'browser-run.cjs'),'utf8');
 s=exact(s,"let browser,server,ws,pageSession,chain,closing=false,latest=null,timer,diskTimer;",`const margin=require('../../../tools/tr2-visible-target-margin.cjs').guard();
let terminalError=null;
function fail(error){if(!terminalError){terminalError=margin.fail(error);closing=true;process.exitCode=1;clearTimeout(timer);clearInterval(diskTimer);save('terminal-error.json',{at:new Date().toISOString(),error:String(error),noLaterProtocol:true});for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminalError);}pending.clear();process.kill(process.ppid,'SIGTERM');}return terminalError;}
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer,diskTimer;`);
 s=exact(s,'function send(method,params={},sessionId){return new Promise','function send(method,params={},sessionId){if(terminalError)return Promise.reject(terminalError);return new Promise');
 s=exact(s,"if(!closing)close('first transport UNKNOWN; no replay').catch(e=>console.error(e));","fail(e);");
 s=exact(s,"const r=await send('Runtime.evaluate'","margin.check();const r=await send('Runtime.evaluate'");
 s=exact(s,"if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));","if(r.exceptionDetails)throw fail(Error(JSON.stringify(r.exceptionDetails)));");
 s=exact(s,"function close(reason){return closePromise??=closeOnce(reason);}","function close(reason){if(reason!=='ordinary completion')return Promise.reject(fail(Error(reason)));margin.check();return closePromise??=closeOnce(reason);}");
 s=exact(s,"require('./shot-options.cjs').validate(c);","margin.validate(c);require('./shot-options.cjs').validate(c);");
 s=exact(s,"async function capture(label){if(chain.nativeMode)","async function capture(label){margin.check();if(chain.nativeMode)");
 s=exact(s,"receipt?.live?.identity?.moduleSha256==='d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc'","receipt?.live?.identity?.moduleSha256===pins.files.find(p=>p.path==='build/wine-assembly.wasm').sha256");
 s=exact(s,"save('input-'+c.id+'-hold.json',held);\n }","save('input-'+c.id+'-hold.json',held);margin.hold(c,held);\n }");
 s=exact(s,"await wait(c.waitMs);await capture(c.label);",`const priorImage=latest?.sha256,priorLabel=latest?.label;await wait(c.waitMs);await capture(c.label);margin.image(priorImage,latest.sha256,c);
 if(!['capture','observe'].includes(c.action)){const rect=JSON.parse(fs.readFileSync(out+'/'+c.label+'-state.json')).canvas.rect;
 const difference=require('../../../tools/png-diff.js').diffPng(out+'/'+priorLabel+'.png',out+'/'+c.label+'.png',{region:{x:rect.left,y:rect.top,w:rect.width,h:rect.height}});
 save('input-'+c.id+'-image-difference.json',difference);assert(!difference.sizeMismatch&&difference.changed>0,'unchanged game canvas; terminal');}`);
 const begin=s.indexOf(' // Trusted browser keys qualify'),end=s.indexOf(" const url='http://",begin);assert(begin>=0&&end>begin);
 s=s.slice(0,begin)+" // Accepted native fixture is reused by verified reference, never rerun.\n"+s.slice(end);
 s=exact(s,"})().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure');});","})().catch(e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});fail(e);});");
 // Every asynchronous error is terminal; no later event issues requests.
 s=exact(s,"async function event(v){","async function event(v){if(terminalError)return;");
 for(const name of ['worker-errors','observer-errors','event-errors'])s=s.replaceAll("log('"+name+".jsonl',", "failAndLog('"+name+".jsonl',");
 s=exact(s,"async function state(){","function failAndLog(n,v){log(n,v);fail(Error(JSON.stringify(v)));}\nasync function state(){margin.check();");
 s=exact(s,"v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)","v.error?p.reject(fail(Error(JSON.stringify(v.error)))):p.resolve(v.result)");
 return s;
}
module.exports={compose,guard,prior};
if(require.main===module)fs.writeFileSync(process.argv[2],compose(path.resolve(__dirname,'..')),{flag:'wx'});
