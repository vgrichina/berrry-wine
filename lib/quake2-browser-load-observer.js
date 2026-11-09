'use strict';
// Loaded only by the opt-in owning Worker. Source URLs and cryptographic pins
// are policy here, never supplied by an observation caller or a page snapshot.
(() => {
const CPU_PATH='build/wine-assembly.wasm';
const CPU_SHA='a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295';
const CURRENT_POLICY_VERSION='quake2-current-primary-3e491c08-v1';
async function prepare({version,slot,getExports,getMemory,nativeWrites}) {
  if(slot!==0)throw Error('Quake II observation requires owning slot zero');
  // Explicit owning-Worker URL selector; no selector retains the historical
  // CPU pin above. The caller cannot supply a path, hash, or module here.
  const selected=new URL(self.location.href).searchParams.getAll('q2BrowserPolicy');
  if(selected.length){
    if(selected.length!==1||selected[0]!==CURRENT_POLICY_VERSION)throw Error('unsupported Q2 browser policy version');
    const url=new URL('quake2-current-browser-policy-v1.js',self.location.href);
    url.searchParams.set('v',version);importScripts(url.href);
    return globalThis.Quake2CurrentBrowserPolicyV1.prepare({version,slot,getExports,getMemory,nativeWrites,policyVersion:selected[0]});
  }
  const core=globalThis.Quake2OwningLoadCore;
  async function canonical(path,expected) {
    const url=new URL('../'+path,self.location.href);
    url.searchParams.set('v',version);
    const response=await fetch(url.href,{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error('Quake II canonical source HTTP '+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer());
    // WebCrypto authenticates the source before compilation/attachment. The
    // synchronous core hashes subsequent owning guest reads without yielding.
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
      b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==expected)throw Error('Quake II canonical PATHHASH '+path);
    return bytes;
  }
  const exe=await canonical(core.EXE,core.EXE_SHA);
  const cpu=await canonical(CPU_PATH,CPU_SHA);
  // Instantiate these authenticated bytes, never authenticate bytes and then
  // instantiate an unrelated caller-supplied WebAssembly.Module.
  const module=await WebAssembly.compile(cpu);
  const observer=core.attach({getExports,getMemory,nativeWrites,canonicalBytes:exe});
  const identity=Object.freeze({path:CPU_PATH,sha256:CPU_SHA,size:cpu.length,
    exeSize:exe.length,source:'canonical verified bytes compiled on owning Worker'});
  return {module,observer:Object.freeze({...observer,
    snapshot:()=>({...observer.snapshot(),binding:identity})})};
}
globalThis.Quake2BrowserLoadObserver=Object.freeze({prepare,CPU_PATH,CPU_SHA,CURRENT_POLICY_VERSION});
})();
