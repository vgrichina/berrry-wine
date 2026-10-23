'use strict';
// Defense in depth, in addition to the pinned shell prefix's terminal exit.
const Module = require('node:module');
const deny = name => { throw Error('readiness forbids compilation: '+name); };
if (/[/\\]tools[/\\]build-compile-wat\.js$/.test(process.argv[1]||'')) deny('canonical entrypoint');
const load=Module._load;
Module._load=function(request,parent,isMain) {
  if (/(?:^|[/\\])build-compile-wat(?:\.js)?$/.test(request)) deny('canonical entrypoint');
  const value=load.apply(this,arguments);
  if (value && typeof value.compileSrcWasm==='function') {
    return new Proxy(value,{get(target,key){if(key==='compileSrcWasm')return ()=>deny('compileSrcWasm');return Reflect.get(target,key);}});
  }
  return value;
};
for (const key of ['compile','compileStreaming','instantiate','instantiateStreaming','Module','Instance'])
  WebAssembly[key]=function(){deny('WebAssembly.'+key);};
const Memory=WebAssembly.Memory;
WebAssembly.Memory=new Proxy(Memory,{construct(target,args){
  const d=args[0];
  if(!d || d.initial>128 || d.maximum===undefined || d.maximum>128) deny('memory above fixed 8MiB');
  return Reflect.construct(target,args);
}});
