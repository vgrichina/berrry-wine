'use strict';
// Keep the proven original TR3 route and its owner/freshness/module guards.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior='scratch/runs/20261108-tr3-webgl-terrain-translation';
function exact(s,a,b){assert.equal(s.split(a).length,2,'unique TR3 seam: '+a);return s.replace(a,b);}
function compose(root){
 let s=fs.readFileSync(path.join(root,prior,'browser-run.cjs'),'utf8');
 s=exact(s,'let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;',`let terminalError=null;
function fail(error){if(!terminalError){terminalError=error instanceof Error?error:Error(String(error));closing=true;process.exitCode=1;clearTimeout(timer);save('terminal-error.json',{at:new Date().toISOString(),error:String(error),noLaterProtocol:true});for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminalError);}pending.clear();process.kill(process.ppid,'SIGTERM');}return terminalError;}
let browser,server,ws,pageSession,chain,closing=false,latest=null,timer;`);
 s=exact(s,'function send(method,params={},sessionId){return new Promise','function send(method,params={},sessionId){if(terminalError)return Promise.reject(terminalError);return new Promise');
 s=exact(s,"if(!closing)close('first transport UNKNOWN; no replay').catch(e=>console.error(e));",'fail(e);');
 s=exact(s,"if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));","if(r.exceptionDetails)throw fail(Error(JSON.stringify(r.exceptionDetails)));");
 s=exact(s,'async function event(v){','async function event(v){if(terminalError)return;');
 s=exact(s,'async function state(){',"function failAndLog(n,v){log(n,v);fail(Error(JSON.stringify(v)));}\nasync function state(){if(terminalError)throw terminalError;");
 for(const n of ['worker-errors','observer-errors','event-errors'])s=s.replaceAll("log('"+n+".jsonl',","failAndLog('"+n+".jsonl',");
 s=exact(s,'row.error=String(e);','row.error=String(e);fail(e);');
 s=exact(s,'async function close(reason){if(closing)return;',"async function close(reason){if(reason!=='ordinary completion')throw fail(Error(reason));if(terminalError)throw terminalError;if(closing)return;");
 s=exact(s,"v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result)","v.error?p.reject(fail(Error(JSON.stringify(v.error)))):p.resolve(v.result)");
 s=exact(s,"})().catch(async e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});process.exitCode=1;await close('first terminal failure');});","})().catch(e=>{save('first-browser-failure.json',{at:new Date().toISOString(),error:e.stack,noReplay:true});fail(e);});");
 s=exact(s,"['ArrowUp','ArrowLeft','Space','Enter','Escape']","['ArrowUp','ArrowLeft','Space','Enter','Escape','Alt']");
 s=s.replaceAll('nativeKeys.length,10','nativeKeys.length,12').replaceAll('n<10;n+=2','n<12;n+=2');
 // A stale refusal remains zero effect, but this task terminates on its first failure.
 s=exact(s,'await t.consume(out,n,execute);',"await t.consume(out,n,execute);const ack=JSON.parse(fs.readFileSync(out+'/reply-'+n+'.json'));if(ack.status)throw Error('first refusal terminal: '+ack.status);");
 return s;
}
function composeBound(root){
 let s=fs.readFileSync(path.join(root,prior,'bound-input.cjs'),'utf8');
 const begin=s.indexOf('const KEYS = '),end=s.indexOf('async function hold(',begin);assert(begin>0&&end>begin);
 s=s.slice(0,begin)+"const controls=require('../../../tools/native-key-controls.cjs');\n"+s.slice(end);
 const a=s.indexOf('  assert(Array.isArray(keys)'),b=s.indexOf("  assert(typeof sample===",a);assert(a>0&&b>a);
 s=s.slice(0,a)+'  controls.validateHold(keys,holdMs);\n'+s.slice(b);
 const c=s.indexOf('      const base={key:'),d=s.indexOf(' attempted.push(base);',c);assert(c>0&&d>c);
 s=s.slice(0,c)+'      const base=controls.eventForKey(key);'+s.slice(d);
 return s;
}
function emit(root,out){
 fs.mkdirSync(out,{recursive:true});
 for(const n of ['ack-client.cjs','transport.cjs','native-mouse.cjs','keyboard-bridge.cjs','page-observe.js','worker-observe.js','chain-controls.cjs','transport-controls.cjs'])fs.copyFileSync(path.join(root,prior,n),path.join(out,n),fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(path.join(out,'ordinary-keys.cjs'),"module.exports=require('../../../tools/native-key-controls.cjs');\n",{flag:'wx'});
 fs.writeFileSync(path.join(out,'bound-input.cjs'),composeBound(root),{flag:'wx'});
 fs.writeFileSync(path.join(out,'browser-run.cjs'),compose(root),{flag:'wx'});
}
module.exports={compose,composeBound,emit,prior};
if(require.main===module)emit(path.resolve(__dirname,'..'),process.argv[2]);
