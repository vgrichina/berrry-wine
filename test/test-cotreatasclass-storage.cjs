'use strict';
// Host storage contract only. Native compiled C clients separately exercise
// public DLL exports and ordinary CreateProcess persistence.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function patched(source,patch,file){
  const lines=patch.split('\n');let active=false,out='',cursor=0;
  const original=source.split(/(?<=\n)/);
  for(let i=0;i<lines.length;i++){
    if(lines[i].startsWith('--- ')){active=lines[i+1]==='+++ b/'+file;continue;}
    if(!active||!lines[i].startsWith('@@ '))continue;
    const h=/^@@ -(\d+)(?:,(\d+))? \+/.exec(lines[i]);assert(h);
    const start=Number(h[1])-1;out+=original.slice(cursor,start).join('');cursor=start;
    while(i+1<lines.length&&!/^(?:@@ |--- )/.test(lines[i+1])){
      const l=lines[++i];if(!l)continue;
      if(l[0]===' '||l[0]==='-'){assert.equal(original[cursor],l.slice(1)+'\n');cursor++;}
      if(l[0]===' '||l[0]==='+')out+=l.slice(1)+'\n';
    }
  }
  return out+original.slice(cursor).join('');
}
function run(source){
  function fixture(){
    let fault='';const backend={};
    Object.defineProperties(backend,{
      getItem:{value:k=>{if(fault==='read')throw Error('denied read');return backend[k]??null;}},
      setItem:{value:(k,v)=>{if(fault==='write')throw Error('denied write');backend[k]=v;}},
      removeItem:{value:k=>{if(fault==='write')throw Error('denied delete');delete backend[k];}},
    });
    const module={exports:{}};
    vm.runInNewContext(source,{module,localStorage:backend,require:require('node:module').createRequire(path.join(root,'lib/storage.js'))});
    const buf=new ArrayBuffer(0x10000),mem=new Uint8Array(buf),view=new DataView(buf);
    const api=module.exports.createStorageImports({getMemory:()=>buf});
    const a=0x1000,b=0x1100,z=0x1200,o=0x1300;
    mem.set([0x78,0x56,0x34,0x12,0xbc,0x9a,0xf0,0xde,0x12,0x34,0x56,0x78,0x9a,0xbc,0xde,0xf0],a);
    mem.set([0x21,0x43,0x65,0x87,0xa9,0xcb,0xed,0x0f,0xf0,0xde,0xbc,0x9a,0x78,0x56,0x34,0x12],b);
    return {...module.exports,api,mem,view,a,b,z,o,backend,fault:v=>{fault=v;}};
  }
  const x=fixture(),old='{12345678-9abc-def0-1234-56789abcdef0}',target='{87654321-cba9-0fed-f0de-bc9a78563412}';
  const key='HKCR\\CLSID\\'+old,treat=key+'\\TreatAs';let checks=0;
  const eq=(a,b)=>{assert.equal(a,b);checks++;};
  const call=(a=x.a,b=x.b,mode=0)=>x.api.com_treat_as_class(a,b,mode)>>>0;
  eq(call(),0x80040154);
  x.setRegValue(key,'unrelated',1,'keep');
  eq(call(),0);const snapshot=x.exportStore();
  eq(JSON.parse(snapshot['reg:'+treat]).values[''].data,target);
  eq(call(x.a,x.o,1),0);assert.deepEqual(x.mem.slice(x.o,x.o+16),x.mem.slice(x.b,x.b+16));checks++;
  x.fault('write');eq(call(x.a,x.z),0x80040151);x.fault('');eq(call(x.a,x.o,1),0);
  x.fault('read');eq(call(),0x80040150);x.fault('');
  eq(call(x.a,x.a),0);eq(call(x.a,x.o,1),1);
  assert.deepEqual(x.mem.slice(x.a,x.a+16),x.mem.slice(x.o,x.o+16));checks++;
  eq(JSON.parse(x.exportStore()['reg:'+key]).values.unrelated.data,'keep');
  x.setRegValue(key+'\\AutoTreatAs','',1,target.toUpperCase());eq(call(x.a,x.a),0);eq(call(x.a,x.o,1),0);
  x.setRegValue(key+'\\AutoTreatAs','',1,'invalid');eq(call(x.a,x.a),0x800401F3);eq(call(x.a,x.o,1),0);
  eq(call(x.a,x.z),0);eq(call(x.a,x.z),0);eq(call(x.a,x.o,1),1);
  eq(call(0,x.b),0x80070057);eq(call(x.a,0),0x80070057);
  const isolated=fixture();eq(isolated.api.com_treat_as_class(isolated.a,isolated.o,1),1);
  isolated.importStore(snapshot);eq(isolated.api.com_treat_as_class(isolated.a,isolated.o,1),0);
  assert.deepEqual(isolated.mem.slice(isolated.o,isolated.o+16),isolated.mem.slice(isolated.b,isolated.b+16));checks++;
  x.importStore(snapshot);x.setRegValue('HKCR\\CLSID\\'+target+'\\TreatAs','',1,old);
  eq(call(x.a,x.o,2),0x800401F3);eq(call(x.a,x.o,1),0);
  return {checks,native:false};
}
module.exports={patched,run};
if(require.main===module){let source=fs.readFileSync(path.join(root,'lib/storage.js'),'utf8');
  if(process.argv[2])source=patched(source,fs.readFileSync(process.argv[2],'utf8'),'lib/storage.js');
  console.log(JSON.stringify(run(source)));}
