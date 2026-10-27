const fs=require('fs'),path=require('path'),Module=require('module');
const counts={reads:{},collectDeclarations:0,declarationParses:0,layoutCalls:0,compilerCalls:0};
const read=fs.readFileSync;
fs.readFileSync=function(file,...args) {
 const rel=path.relative(process.cwd(),String(file));
 counts.reads[rel]=(counts.reads[rel]||0)+1;
 return read.call(this,file,...args);
};
const load=Module._load,wrapped=new WeakSet(), results=new WeakSet();
Module._load=function(id,parent,main) {
 const value=load.apply(this,arguments);
 if(value && typeof value==='object' && !wrapped.has(value)) {
  let method,key;
  if(/(?:^|\/)check-region-decls(?:\.js)?$/.test(id)){method='collectDeclarations';key='collectDeclarations';}
  if(/(?:^|\/)region-layout(?:\.js)?$/.test(id)){method='layout';key='layoutCalls';}
  if(/(?:^|\/)watx(?:\.js)?$/.test(id)){method='compile';key='compilerCalls';}
  if(method){const fn=value[method];value[method]=function(...args){counts[key]++;const result=fn.apply(this,args);if(key==='collectDeclarations'&&!results.has(result)){counts.declarationParses++;results.add(result);}return result;};wrapped.add(value);}
 }
 return value;
};
process.on('exit',()=>fs.writeFileSync(path.join(process.cwd(),'measurement.json'),JSON.stringify({counts,usage:process.resourceUsage()},null,2)+'\n'));
