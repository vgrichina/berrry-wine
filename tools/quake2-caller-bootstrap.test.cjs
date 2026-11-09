'use strict';
// Actual composed automatic HTTP/bootstrap and send guards, no network/browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);
fs.mkdirSync(out,{recursive:true});
const base='6fe9107fbd7babb6e26c959cb32606b7c330d6e3';
const current=require('./quake2-native-driver-composition.cjs');
const old=new Module(path.join(__dirname,'quake2-native-driver-composition.cjs'),module);
old.filename=path.join(__dirname,'quake2-native-driver-composition.cjs');old.paths=module.paths;
old._compile(cp.execFileSync('git',['show',base+':tools/quake2-native-driver-composition.cjs'],{cwd:root,encoding:'utf8'}),old.filename);

async function scenario(composition,name,when){
 const run=path.join(out,name);fs.mkdirSync(run);
 const source=composition.compose().source;
 const begin=source.indexOf('\n(async()=>{\n'),end=source.indexOf(' const active=',begin);
 assert(begin>0&&end>begin);
 const check=source.slice(source.indexOf('function checkTerminal()'),source.indexOf('function observeTerminal('));
 const rows=[],pending=new Map();let terminalFailure=null;
 const ctx={fs,run,root,Buffer,terminalFailure,pending,require:name=>{
  assert.equal(name,root+'/test/static-server.js');return {startStaticServer:async()=>{
   rows.push('server');return {prependListener(){},address:()=>({port:1})};
  }};
 },observeTerminal:reason=>{ctx.terminalFailure??=Error(String(reason));return ctx.terminalFailure;},
 pins:{httpPins:Array.from({length:6},(_,i)=>({url:'/fixture'+i,sha256:'fixture-sha',size:0}))},
 crypto:{},save(){},log(){},sha:()=> 'fixture-sha',
 fetch:async()=>{rows.push('HTTP');if(when==='during')fs.writeFileSync(run+'/caller-cancelled.json','');return {status:200,arrayBuffer:async()=>Buffer.alloc(0)};},
 cp:{spawn:()=>{rows.push('spawn');throw Error('fixture stop before any browser');}},
 out:run,assert,process:{env:{}},compressedLogs:{},setInterval,setTimeout};
 if(when==='before')fs.writeFileSync(run+'/caller-cancelled.json','');
 vm.createContext(ctx);
 vm.runInContext(check,ctx);
 let error;
 try{await vm.runInContext(source.slice(begin,end)+'\n})()',ctx);}catch(e){error=String(e);}
 assert(error);
 if(name.startsWith('old')){
  assert.equal(rows.filter(v=>v==='HTTP').length,6);assert(rows.includes('spawn'));
 }else{
  assert.equal(rows.filter(v=>v==='HTTP').length,when==='before'?0:1);
  assert(!rows.includes('spawn'));
  const first=ctx.terminalFailure;
  assert(first);
  assert.throws(()=>vm.runInContext('checkTerminal()',ctx));
  assert.equal(ctx.terminalFailure,first,'terminal UNKNOWN stays sticky');
  // Execute the actual production send function. Ordinary calls are blocked,
  // but an independent UP and Browser.close remain usable for cleanup.
  const send=source.slice(source.indexOf('function send('),source.indexOf('async function evaluate('));
  const sent=[];
  Object.assign(ctx,{id:0,ws:{send:s=>sent.push(JSON.parse(s))},clearTimeout});
  vm.runInContext(send,ctx);
  await assert.rejects(vm.runInContext("send('Page.captureScreenshot')",ctx));
  await assert.rejects(vm.runInContext("send('Input.dispatchKeyEvent',{type:'keyDown'})",ctx));
  for(const expression of ["send('Input.dispatchKeyEvent',{type:'keyUp'})","send('Browser.close')"]){
   const promise=vm.runInContext(expression,ctx),row=sent.at(-1),entry=pending.get(row.id);
   assert(entry);clearTimeout(entry.timer);pending.delete(row.id);entry.resolve({});await promise;
  }
  assert.deepEqual(sent.map(v=>v.method),['Input.dispatchKeyEvent','Browser.close']);
 }
 fs.writeFileSync(path.join(run,'result.json'),JSON.stringify({rows,error,oldFAIL:name.startsWith('old'),network:false,browser:false}));
 console.log(name,'PASS',JSON.stringify(rows));
}
(async()=>{
 await scenario(old.exports,'old-six-HTTP-after-revocation','during');
 await scenario(current,'new-prevent-bootstrap','before');
 await scenario(current,'new-cancel-bootstrap','during');
})().catch(e=>{console.error(e);process.exitCode=1;});
