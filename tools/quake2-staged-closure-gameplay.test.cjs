'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const current=require('./quake2-current-module.cjs'),guard=require('./quake2-staged-closure-gameplay.cjs');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const closure=current.validate({moduleVersion:current.version});
 // Actual 1575 failure: the preparer accepts current CPUs, but the actual
 // browser prepare refuses their canonical bytes before compile/attachment.
 const requests=[];let compiled=0,attached=0;
 const core=require('../lib/quake2-owning-load-core.js');
 const context=vm.createContext({URL,Uint8Array,crypto:crypto.webcrypto,
  self:{location:{href:'http://q2.invalid/lib/guest-worker.js?v=dev'}},
  Quake2OwningLoadCore:{EXE:core.EXE,EXE_SHA:core.EXE_SHA,attach(){attached++;throw Error('unexpected attachment');}},
  WebAssembly:{compile(){compiled++;throw Error('unexpected compile');}},
  fetch:async(url,options)=>{const u=new URL(url),name=u.pathname.slice(1);requests.push({name,version:u.searchParams.get('v'),options});const b=read(name);return {ok:true,arrayBuffer:async()=>Uint8Array.from(b).buffer};}});
 vm.runInContext(read('lib/quake2-browser-load-observer.js').toString(),context,{timeout:1000});
 const observer=context.Quake2BrowserLoadObserver;
 assert.equal(observer.CPU_SHA,'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295');
 assert.equal(hash(read(observer.CPU_PATH)),current.modules[observer.CPU_PATH]);
 await assert.rejects(observer.prepare({version:'dev',slot:0,getExports(){throw Error('no exports');},getMemory(){throw Error('no memory');},nativeWrites:true}),/Quake II canonical PATHHASH build\/wine-assembly.wasm/);
 assert.equal(compiled,0);assert.equal(attached,0);
 assert.deepEqual(requests.map(r=>r.name),[core.EXE,observer.CPU_PATH]);
 for(const r of requests){assert.equal(r.version,'dev');assert.equal(r.options.cache,'no-store');assert.equal(r.options.credentials,'same-origin');}
 assert.throws(()=>guard.validate({moduleVersion:current.version}),/Q2 browser canonical CPU disagrees with staged module/);
 assert.throws(()=>guard.validate(),/explicit supported Q2 module version/);
 assert.throws(()=>guard.browserBinding(closure.files.filter(p=>p.path!=='lib/quake2-browser-load-observer.js')),/undeclared Q2 browser provider/);
 assert.throws(()=>guard.browserBinding(closure.files.map(p=>p.path==='lib/quake2-browser-load-observer.js'?{...p,sha256:'0'.repeat(64)}:p)),/Q2 browser provider SHA/);
 assert.throws(()=>guard.browserBinding(closure.files.filter(p=>p.path!==observer.CPU_PATH)),/undeclared Q2 browser CPU/);
 // Authored policy control only: exact bytes are still required, and the guard
 // never obtains authority to replace the production observer's historical pin.
 const cpu=Buffer.from('authored policy control'),source=Buffer.from(`globalThis.Quake2BrowserLoadObserver=Object.freeze({prepare(){},CPU_PATH:'control.wasm',CPU_SHA:'${hash(cpu)}'});`);
 const fixtures=new Map([['lib/quake2-browser-load-observer.js',source],['control.wasm',cpu]]);
 const pins=[...fixtures].map(([name,b])=>({path:name,size:b.length,sha256:hash(b)}));
 assert.equal(guard.browserBinding(pins,n=>fixtures.get(n)).sha256,hash(cpu));
 assert.throws(()=>guard.browserBinding(pins,n=>n==='control.wasm'?Buffer.from('changed policy control'):fixtures.get(n)),/Q2 browser provider size/);
 console.log(JSON.stringify({passed:true,oldByteClosureAccepted:true,actualBrowserPrepareRefused:true,newPreallocationGuardRefused:true,compiled,attached,requests:requests.map(r=>r.name),nativeQualification:false,providersUnchanged:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
