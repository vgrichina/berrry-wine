'use strict';
// Explicit Q2 primary browser policy. Compat remains a staged CPU artifact;
// this observer has never selected the compat path.
(() => {
const POLICY_VERSION='quake2-current-primary-3e491c08-v1';
const CPU_PATH='build/wine-assembly.wasm';
const CPU_SHA='3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18';
async function prepare({version,slot,getExports,getMemory,nativeWrites,policyVersion}) {
  if(policyVersion!==POLICY_VERSION)throw Error('unsupported Q2 browser policy version');
  if(slot!==0)throw Error('Quake II observation requires owning slot zero');
  const core=globalThis.Quake2OwningLoadCore;
  async function canonical(path,expected) {
    const url=new URL('../'+path,self.location.href);url.searchParams.set('v',version);
    const response=await fetch(url.href,{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error('Quake II canonical source HTTP '+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer());
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==expected)throw Error('Quake II canonical PATHHASH '+path);
    return bytes;
  }
  const exe=await canonical(core.EXE,core.EXE_SHA);
  const cpu=await canonical(CPU_PATH,CPU_SHA);
  const module=await WebAssembly.compile(cpu);
  const observer=core.attach({getExports,getMemory,nativeWrites,canonicalBytes:exe});
  const identity=Object.freeze({path:CPU_PATH,sha256:CPU_SHA,size:cpu.length,
    exeSize:exe.length,policyVersion,source:'canonical verified bytes compiled on owning Worker'});
  return {module,observer:Object.freeze({...observer,snapshot:()=>({...observer.snapshot(),binding:identity})})};
}
globalThis.Quake2CurrentBrowserPolicyV1=Object.freeze({prepare,POLICY_VERSION,CPU_PATH,CPU_SHA});
})();
