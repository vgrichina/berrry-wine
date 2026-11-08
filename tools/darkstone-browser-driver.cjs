'use strict';

// Versioned, fail-closed adapter for the exact selected Darkstone driver. Keep
// historical run files immutable; no source copy or rewritten historical proof.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const selectedSha = '2535a4fea2ad1acbc245d10fd00cc6c583913095aacdc9cd92462c4d6b346a2f';

function repairDriver(source) {
  if (crypto.createHash('sha256').update(source).digest('hex') !== selectedSha) {
    throw Error('unrecognized Darkstone driver; review revision before repair');
  }
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw Error('ambiguous close repair anchor');
    source = source.replace(before, after);
  };
  replace('async function close(reason){if(closing)return;closing=true;',
    'let closePromise;function close(reason){return closePromise??=(async()=>{closing=true;');
  replace("console.log('TERMINAL '+reason);}", "console.log('TERMINAL '+reason);})();}");
  replace("try{if(ws?.readyState===1)await send('Browser.close');}catch(e){save('close-error.json',{error:String(e)});}if(browser){await Promise.race([new Promise(r=>browser.exitCode!==null?r():browser.once('exit',r)),wait(8000)]);if(browser.exitCode===null)browser.kill('SIGTERM');await Promise.race([new Promise(r=>browser.exitCode!==null?r():browser.once('exit',r)),wait(5000)]);if(browser.exitCode===null)browser.kill('SIGKILL');}",
    "if(browser){const receipt=await require(root+'/tools/native-browser-close.cjs').closeBrowser({browser,requestClose:()=>{if(ws?.readyState!==1)throw Error('CDP disconnected; no replay');return send('Browser.close');},record:r=>log('browser-close.jsonl',r)});save('browser-terminal.json',receipt);}");
  // Preserve the transport's sticky UNKNOWN and all independent input releases.
  // A finite failed drain must release network handles without deleting a live
  // profile or publishing cleanup / quit ACK. The top-level failure path closes
  // admission and keeps its nonzero status.
  replace("if(browser){const receipt=", "if(browser){let receipt;try{receipt=");
  replace("save('browser-terminal.json',receipt);}",
    "save('browser-terminal.json',receipt);}catch(e){process.exitCode=1;save('browser-drain-unknown.json',{error:String(e),receipt:e.receipt,noReplay:true});for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; no replay'));}pending.clear();ws?.close();server?.closeAllConnections();server?.close();throw e;}}");
  // A successful terminal wait proves retirement, not the outcome of an earlier
  // CDP operation. Latch at rejection (including background worker requests),
  // before a late response or concurrent normal close can erase uncertainty.
  replace('async function send(method,params={},sessionId){',
    'async function rawSend(method,params={},sessionId){');
  replace('async function evaluate(expression,sessionId=pageSession){',
    `async function send(...args){try{return await rawSend(...args);}catch(e){rememberFailure(e);throw e;}}
async function evaluate(expression,sessionId=pageSession){`);
  replace('closing=true;clearTimeout(timer);',
    "closing=true;if(reason!=='ordinary completion')rememberFailure(Error(reason));clearTimeout(timer);");
  replace("catch(e){save('native-save-read-error.json'", "catch(e){rememberFailure(e);save('native-save-read-error.json'");
  replace("catch(e){save('post-guard-error.json'", "catch(e){rememberFailure(e);save('post-guard-error.json'");
  replace("fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});",
    "requireHealthyCleanup();fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});");
  replace('async function execute(c,markDispatch){', `function rememberFailure(error){
 if(!close.failure)close.failure={error:String(error),at:new Date().toISOString(),noReplay:true,sticky:true};
 process.exitCode=1;
 if(!fs.existsSync(out+'/transport-closed.json'))save('transport-closed.json',close.failure);
 return close.failure;
}
function requireHealthyCleanup(){
 const faults=['transport-closed.json','client-first-failure.json','first-failure.json','first-browser-failure.json','browser-drain-unknown.json'];
 const fault=faults.find(name=>fs.existsSync(out+'/'+name));
 if(close.failure||fault){
  const failure=rememberFailure(Error('upstream UNKNOWN; profile retained; no cleanup or quit ACK'+(fault?': '+fault:'')));
  save('cleanup-unknown.json',{...failure,profileRetained:true});
  throw Error(failure.error);
 }
}
async function execute(c,markDispatch){`);
  replace(".catch(async e=>{save('first-browser-failure.json'",
    ".catch(async e=>{rememberFailure(e);save('first-browser-failure.json'");
  return source;
}

if (require.main === module) {
  const file = path.resolve(process.argv[2] || '');
  if (path.basename(file) !== 'browser.cjs') throw Error('explicit selected browser.cjs required');
  const source = repairDriver(fs.readFileSync(file, 'utf8'));
  const driver = new Module(file, module);
  driver.filename = file;
  driver.paths = Module._nodeModulePaths(path.dirname(file));
  driver._compile(source, file);
}

module.exports = {repairDriver, selectedSha};
