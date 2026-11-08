'use strict';

// Offline source composition and explicit preload for the retained Q3 consumer.
// Launch with --require this file BEFORE --require q3-execution-boundary.cjs,
// Q3_NATIVE_COMPOSITION=1 and Q3_EXECUTION_BOUNDARY_OUT=<unique>.jsonl.gz.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const consumerPath = 'scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs';
const adapterPath = 'scratch/runs/20261108-q3-instrumented-webgl-gameplay-2248/adapter.cjs';
const providers = Object.freeze({
  [consumerPath]: '689b05aed1724c2998131818a558dfc2d4e87605df579b97ce2ae3c598883416',
  [adapterPath]: '84c8419f7848fabc8f2c75a7949c6aa6d61a730cb72e71c5e3436f786ce3ac2a',
  'tools/supertux-native-lifecycle.cjs': '56536226dfd28666b50b902df26005f25641718aa9a398daff65aefdcb3e9d06',
  'tools/native-browser-close.cjs': '1f4fe08b501ed27c90f4256e85574a788e7dd8adff60638f2c69d6a3ca2ea9b2',
  'tools/native-devtools-ready.cjs': '9ba9ae8b94ebd8a134045608074403d81f68d3cfdf6c0e3f9dbcb875e0632c1b',
  'tools/q3-execution-boundary.cjs': '1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d',
  'tools/native-command-log.cjs': '979b3a8bbd8625ef6bffb009650778736e20ade2d781918b83f59d9944c88f5e',
  'scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs': '54d7576d40df790ecf72153e289b25c6235b4e92b3f8b7332e480637bf07a9e8',
  'scratch/runs/20261108-q3-gl-readiness-gameplay/trace.cjs': '6f440f2d1bdd9e02598a768ad041681ae1969245e9512939dff24a3970bb8b86',
  'scratch/runs/20261108-q3-gl-readiness-gameplay/bound-input.cjs': '175033bc07bda95dd2d618511729d901908d60a9e8ec970cdbc8d7e2d61dcd70',
  'tools/native_kernel_custody.py': 'fb670a47d4712aa44fd2fae3d2047587374c0e1c2bb4e927ff87572147dfcfff'
});
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'missing/nonunique Q3 integration: ' + before.slice(0, 70));
  return source.replace(before, after);
}
function compose({root = path.resolve(__dirname, '..')} = {}) {
  root = path.resolve(root);
  const references = Object.entries(providers).map(([file, hash]) => {
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(sha(bytes), hash, 'Q3 provider changed: ' + file);
    return {path:file, sha256:hash, size:bytes.length};
  });
  // Execute the owning adapter's exact transform in isolation. It may neither
  // install global hooks nor write back into the historical evidence directory.
  const extensions = {...Module._extensions};
  const localFs = {...fs, writeFileSync() {}};
  vm.runInNewContext(fs.readFileSync(path.join(root, adapterPath), 'utf8'), {
    __dirname:path.dirname(path.join(root, adapterPath)),
    process:{cwd:() => root}, Buffer,
    require(name) {
      if (name === 'node:fs') return localFs;
      if (name === 'node:module') return {_extensions:extensions};
      return require(name);
    }
  }, {filename:path.join(root, adapterPath)});
  let source;
  extensions['.cjs']({_compile(s) { source = s; }}, path.join(root, consumerPath));
  assert.equal(typeof source, 'string');
  const retainedSource = source;
  source = replaceOnce(source,
    "const active=out+'/chrome-profile/DevToolsActivePort';for(let i=0;i<100&&!fs.existsSync(active);i++)await wait(100);const [debugPort,debugPath]=fs.readFileSync(active,'utf8').trim().split('\\n');save('endpoint.json',{debugPort:Number(debugPort),browserPath:debugPath});",
    "const endpoint=await require(root+'/tools/supertux-native-lifecycle.cjs').ready({browser,profile:out+'/chrome-profile',deadline,record:v=>log('startup-browser.jsonl',v)});const debugPort=endpoint.debugPort,debugPath=endpoint.browserPath;save('endpoint.json',endpoint);");
  source = replaceOnce(source, "browser.once('exit',(code,signal)=>save('chrome-exit.json'",
    "browser.once('error',error=>{browser.__q3SpawnError=error;save('chrome-error.json',{error:String(error),noReplay:true});});browser.once('exit',(code,signal)=>save('chrome-exit.json'");
  // Check the actual launch error before and during readiness, rather than
  // allowing ChildProcess 'error' to become an unhandled event or success.
  source = replaceOnce(source, "const endpoint=await require(root+'/tools/supertux-native-lifecycle.cjs').ready(",
    "const endpoint=await require(root+'/tools/q3-native-driver-composition.cjs').ready(");
  const begin = source.indexOf('async function close(reason)');
  const end = source.indexOf('\nasync function executeImpl', begin);
  assert(begin >= 0 && end > begin, 'Q3 real close call site missing');
  source = source.slice(0, begin) + `let closePromise;
function close(reason){
 if(closePromise)return closePromise;
 closing=true;clearTimeout(timer);clearInterval(floorTimer);clearInterval(passive);
 closePromise=(async()=>{
  save('close-reason.json',{at:new Date().toISOString(),reason});
  let receipt,failure;
  try{
   if(browser){receipt=await require(root+'/tools/supertux-native-lifecycle.cjs').close({browser,requestClose:()=>ws?.readyState===1?send('Browser.close'):Promise.reject(Error('endpoint unavailable')),record:v=>log('terminal-browser.jsonl',v)});save('terminal-browser.json',receipt);}
  }catch(error){failure=error;save('close-error.json',{error:String(error),receipt:error.receipt??null,noReplay:true});}
  finally{
   // This rejects actual pending CDP promises; it is never a successful ACK.
   for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('runtime closed; UNKNOWN; no replay'));}pending.clear();
   await new Promise(resolve=>setImmediate(resolve));
   ws?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  }
  if(failure)throw failure;
  if(browser){await commandLogs.drainStreams();commandLogs.close();}
  // Terminal/EOF permits local profile retirement only. Kernel completion and
  // historical UNKNOWN/untraced/nonleader limits remain the supervisor's job.
  fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});
  t.closed(out,browser?.exitCode);console.log('TERMINAL '+reason);
  return receipt;
 })();
 return closePromise;
}` + source.slice(end);
  source = replaceOnce(source, 'floor:5000000000', 'floor:1500000000');
  source = replaceOnce(source, "assert(free>5000000000,'5GB disk floor')", "assert(free>1500000000,'1.5GB disk floor')");
  assert(source.includes('value.configureDiagnostics({enabled:true,maxRecords:64})'), 'GL configure-before-hostimport missing');
  assert(source.indexOf("Page.addScriptToEvaluateOnNewDocument") < source.indexOf("await send('Page.navigate'"), 'GL preload must precede navigation');
  new vm.Script(Module.wrap(source), {filename:path.join(root, consumerPath)});
  return {source, retainedSource, references, hook:extensions['.cjs'], append:localFs.appendFileSync};
}
async function ready(options) {
  // The real consumer records spawn errors before this poll. Throw on the next
  // accepted poll so no losing readiness promise or timer survives a race.
  const browser = new Proxy(options.browser, {get(target, key) {
    if (key === 'exitCode' && target.__q3SpawnError) throw target.__q3SpawnError;
    return Reflect.get(target, key);
  }});
  return require('./supertux-native-lifecycle.cjs').ready({...options, browser});
}
function install({root = path.resolve(__dirname, '..')} = {}) {
  assert.equal(path.resolve(process.argv[1] || ''), path.join(root, consumerPath), 'genuine retained Q3 consumer required');
  assert(process.env.Q3_EXECUTION_BOUNDARY_OUT?.endsWith('.jsonl.gz'), 'execution preload output required');
  const result = compose({root}), original = Module._extensions['.cjs'] || Module._extensions['.js'];
  fs.appendFileSync = result.append;
  Module._extensions['.cjs'] = function(module, filename) {
    if (filename === path.join(root, consumerPath)) {
      assert(globalThis.WebSocket?.name === 'ObservedSocket', 'Q3 execution preload missing or wrong order');
      return module._compile(result.source, filename);
    }
    if (filename === path.join(root, path.dirname(consumerPath), 'bound-input.cjs')) {
      return compileBoundInput(result, module, filename, path.dirname(path.resolve(process.env.Q3_EXECUTION_BOUNDARY_OUT)));
    }
    return original(module, filename);
  };
  return result.references;
}
function compileBoundInput(result, module, filename, evidenceDirectory) {
  const historical = path.join(path.dirname(filename), '../20261108-q3-instrumented-webgl-gameplay-2248/physical-completion.jsonl');
  const destination = path.join(path.resolve(evidenceDirectory), 'physical-completion.jsonl');
  assert.notEqual(destination, historical, 'unique Q3 physical evidence directory required');
  return result.hook({_compile(source, name) {
    return module._compile(replaceOnce(source, JSON.stringify(historical), JSON.stringify(destination)), name);
  }}, filename);
}
module.exports = {compose, ready, install, compileBoundInput, providers, consumerPath, adapterPath, replaceOnce};
if (process.env.Q3_NATIVE_COMPOSITION === '1') install();
