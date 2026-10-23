'use strict';
// Inherited by every Node process in the canonical pre-compilation shell.
const Module = require('module'), path = require('path'), crypto = require('crypto'), fs = require('fs');
console.error('READINESS_ARGV '+JSON.stringify({pid:process.pid,argv:process.argv}));
process.on('exit',exit=>console.error('READINESS_EXIT '+JSON.stringify({pid:process.pid,exit})));
// Release only fully consumed scanner inputs; preserve compiler provenance
// tests until that gate finishes. Admit each exact input/generation phase.
const entry=process.argv[1] || '';
const phase=entry.endsWith('/tools/toyvm/bundle-browser.js')?'bundle':entry.endsWith('/tools/concat-wat.js')?'concat':null;
if(phase) {
  const result=require('child_process').spawnSync('/usr/bin/python3',[path.join(__dirname,'positiont-readiness-phase-inputs.py'),phase],{stdio:'inherit'});
  if(result.status!==0)throw Error('READINESS: phase input admission failed '+phase);
}
// Every generated write stays within the disk allocation, preserving reserve.
const originalOpen=fs.openSync, originalWrite=fs.writeSync;
const descriptorFiles=new Map();
const root=path.resolve(__dirname,'..');
function footprint(dir) {let n=fs.lstatSync(dir).size;for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);n+=ent.isDirectory()?footprint(f):fs.lstatSync(f).size;}return n;}
const external='/home/user/wine-assembly/scratch/usage-watch/render-positiont-build-readiness-oct23';
fs.openSync=function(file,flags,...rest) {const fd=originalOpen.call(this,file,flags,...rest);if(typeof file==='string'&&file.startsWith(root+'/build/'))descriptorFiles.set(fd,file);return fd;};
fs.writeSync=function(fd,data,...rest) {
  if(descriptorFiles.has(fd)) {
    const growth=typeof data==='string'?Buffer.byteLength(data):data.byteLength;
    if(footprint(root)+footprint(external)+8192+growth+8388608>67108864)throw Error('READINESS: generated output exceeds 64MiB including 8MiB reserve');
    const disk=fs.statfsSync(root);if(disk.bavail*disk.bsize-growth<2982150144)throw Error('READINESS: host free floor');
  }
  return originalWrite.call(this,fd,data,...rest);
};
const original = Module._load;
const forbidden = /(?:^|\/)(?:build-compile-wat\.js|compile-src(?:\.js)?|render-helper(?:\.js)?|positiont-com-module(?:\.js)?)$/;
if (forbidden.test(process.argv[1] || '')) throw Error('READINESS: forbidden compilation/runtime entry');
Module._load = function(request, parent, main) {
  const resolved = Module._resolveFilename(request, parent, main);
  if (forbidden.test(resolved)) throw Error('READINESS: forbidden compilation/runtime import: '+resolved);
  const value = original.apply(this, arguments);
  if (resolved.endsWith('/tools/watx.js') && !value.readinessGuard) {
    const compile = value.compile;
    value.compile = function(source, vfs, options) {
      // Existing region-layout prerequisite only: no main closure, no guest code.
      if (typeof source !== 'string' || source.length > 262144 || vfs.size !== 0 ||
          !source.startsWith('(memory 8192 8192)\n') || source.includes('(include ') ||
          (source.match(/\(func\s/g)||[]).length !== 1 ||
          !source.endsWith('(func $noop (effects heap) (nop))\n(wasm-export "noop" $noop)\n'))
        throw Error('READINESS: full/unknown WATX compilation forbidden');
      const result = compile.apply(this, arguments);
      if (result.wasmBinary && result.wasmBinary.length > 8388608) throw Error('READINESS: region fragment exceeds 8MiB');
      console.error('READINESS_REGION_FRAGMENT '+JSON.stringify({sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),moduleSha256:result.wasmBinary?crypto.createHash('sha256').update(result.wasmBinary).digest('hex'):null,moduleBytes:result.wasmBinary?.length,instantiated:false}));
      return result;
    };
    value.compileAsync = () => {throw Error('READINESS: asynchronous compilation forbidden');};
    value.readinessGuard = true;
  }
  return value;
};
for (const key of ['Module','Instance','Memory','compile','compileStreaming','instantiate','instantiateStreaming'])
  WebAssembly[key] = function() {throw Error('READINESS: WebAssembly execution/allocation forbidden: '+key);};
