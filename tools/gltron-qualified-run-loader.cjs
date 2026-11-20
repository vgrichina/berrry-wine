'use strict';
const Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Sources are exact, eagerly retained inputs. Never infer an extension, search
// another run, consult require.cache, or fall back to the live repository.
function createExactLoader({root,sources,externals=[]}){
  assert(path.isAbsolute(root));
  const retained=new Map(),cache=new Map(),compiled=[],external=new Set(externals);
  for(const filename of external)assert(path.isAbsolute(filename)&&path.normalize(filename)===filename);
  for(const [filename,input] of sources){
    assert(path.isAbsolute(filename)&&path.normalize(filename)===filename);
    const source=Buffer.from(input.source);
    assert.equal(sha(source),input.sha256,'qualified source identity '+filename);
    retained.set(filename,{source,sha256:input.sha256,identity:input.identity});
  }
  function load(filename){
    assert(path.isAbsolute(filename)&&path.normalize(filename)===filename,'exact absolute module filename required');
    if(cache.has(filename))return cache.get(filename).exports;
    const row=retained.get(filename);
    assert(row,'absent exact qualified dependency '+filename);
    const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
    const native=m.require.bind(m);
    m.require=q=>{
      if(q.startsWith('.')||path.isAbsolute(q)){
        const target=path.resolve(path.dirname(filename),q);
        if(external.has(target))return native(target);
        if(target===root||target.startsWith(root+path.sep)||retained.has(target))return load(target);
        throw Error('dependency outside exact qualified closure '+target);
      }
      return native(q);
    };
    cache.set(filename,m);
    try{m._compile(row.source.toString('utf8'),filename);
      compiled.push({filename,sha256:row.sha256,identity:row.identity,exports:Object.keys(m.exports)});
      return m.exports;
    }catch(error){cache.delete(filename);throw error;}
  }
  function preflight(entries){
    const visited=new Set();
    function visit(filename){
      if(visited.has(filename)||external.has(filename))return;
      const row=retained.get(filename);assert(row,'absent exact qualified dependency '+filename);
      visited.add(filename);
      const source=row.source.toString('utf8');
      new vm.Script(Module.wrap(source),{filename});
      // Conservative: include literal requires even inside lazy function bodies
      // and generated source strings. Dynamic joins also need explicit entries
      // and their actual lazy-body preflight at the call site.
      for(const match of source.matchAll(/\brequire\(\s*(['"])([^'"\n]+)\1\s*\)/g)){
        const q=match[2];if(q.startsWith('.')||path.isAbsolute(q))visit(path.resolve(path.dirname(filename),q));
      }
    }
    for(const filename of entries)visit(filename);
    return [...visited].map(filename=>({filename,sha256:retained.get(filename).sha256}));
  }
  return {load,preflight,compiled,identities:[...retained].map(([filename,r])=>({filename,sha256:r.sha256,identity:r.identity}))};
}
// Check the compiled binary itself before opening any runtime scope. Syntax
// and successful JS imports cannot prove a native controller's Wasm ABI.
function preflightModule(bytes,requiredExports){
  assert(Array.isArray(requiredExports)&&requiredExports.length,'explicit native module exports required');
  const module=new WebAssembly.Module(bytes),exports=WebAssembly.Module.exports(module);
  const missing=requiredExports.filter(row=>!exports.some(e=>e.name===row.name&&e.kind===row.kind));
  assert.equal(missing.length,0,'qualified native module exports unavailable: '+missing.map(e=>e.name+':'+e.kind).join(', '));
  const typed=requiredExports.filter(row=>row.signature!==undefined);
  const signatures=[];
  if(typed.length){
    const decoded=require('./wasm-abi-diff.js').decodeWasm(bytes);
    for(const row of typed){
      assert.equal(row.kind,'function','signature requires a function export');
      const actual=decoded.exports.find(e=>e.name===row.name);
      const signature=decoded.funcSignatures[actual.index];
      assert.equal(signature,row.signature,'qualified native module signature '+row.name);
      signatures.push({name:row.name,signature});
    }
  }
  return {sha256:sha(bytes),bytes:bytes.byteLength,exports,imports:WebAssembly.Module.imports(module),signatures};
}
module.exports={createExactLoader,preflightModule};
