'use strict';
// Public resolved x86 calls in the exact module, analytical pixels, registers,
// independent mask semantics, stack boundaries and optional queued rendering.
// Reuse the period harness without modifying module bytes.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
if(process.env.GL_FOG_MODULE_SHA)assert.strictEqual(require('crypto').createHash('sha256').update(fs.readFileSync(process.env.GL_PERIOD_MODULE)).digest('hex'),process.env.GL_FOG_MODULE_SHA,'pinned loaded module');
const publicABI=String.raw` const stackGuest=e.guest_alloc(4096)+2048;
 const table=req('src/api_table.json'),resolved=new Map();
 function string(s){const p=e.guest_alloc(s.length+1)>>>0;new Uint8Array(memory.buffer,wa(p),s.length+1).set(Buffer.from(s+'\0'));return p;}
 function invoke(p,args){
  e.set_esp(stackGuest);for(const [i,k] of ['eax','ecx','edx','ebx','ebp','esi','edi'].entries())e['set_'+k](0x55660000+i);
  e.call_func(p,...Array.from({length:4},(_,i)=>args[i]||0));const before=e.get_esp()>>>0;
  for(let i=4;i<args.length;i++)dv.setUint32(wa(before)+4*(i+1),args[i]>>>0,true);
  const saved=Buffer.from(new Uint8Array(memory.buffer,wa(before),128));
  for(let n=0;n<100&&e.get_eip();n++)e.run(1000);
  assert.strictEqual(e.get_eip(),0,'bounded production x86 call returned');
  assert.strictEqual(e.get_esp()>>>0,before+4*(args.length+1),'public stdcall cleanup');
  for(const [i,k] of ['eax','ecx','edx','ebx','ebp','esi','edi'].entries())if(i)assert.strictEqual(e['get_'+k]()>>>0,0x55660000+i,'public register '+k);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,wa(before),128)),saved,'public input stack preserved');
  return e.get_eax()>>>0;
 }
 const dll=invoke(dv.getUint32(wa(iat('LoadLibraryA')),true),[string('opengl32.dll')]);assert(dll);
 const gdi=invoke(dv.getUint32(wa(iat('LoadLibraryA')),true),[string('gdi32.dll')]);assert(gdi);
 function call(name,args=[],floats=[]){
  if(!resolved.has(name)){
    const p=invoke(dv.getUint32(wa(iat('GetProcAddress')),true),[name.startsWith('gl')||name.startsWith('wgl')?dll:gdi,string(name)]);
    assert(p,'public resolver '+name);assert.strictEqual(e.thunk_word(p,1),table.find(x=>x.name===name).id,'public thunk identity '+name);resolved.set(name,p);
  }
  args=args.map((v,i)=>{if(!floats.includes(i))return v;const tmp=new DataView(new ArrayBuffer(4));tmp.setFloat32(0,v,true);return tmp.getUint32(0,true);});
  return invoke(resolved.get(name),args);
 }
 const bmi=e.guest_alloc(40),bitsOut=e.guest_alloc(4);new Uint8Array(memory.buffer,wa(bmi),40).fill(0);
 for(const [at,value] of [[0,40],[4,64],[8,-64]])dv.setInt32(wa(bmi)+at,value,true);
 dv.setUint16(wa(bmi)+12,1,true);dv.setUint16(wa(bmi)+14,32,true);
 const fogDc=call('CreateCompatibleDC',[0]),bitmap=call('CreateDIBSection',[fogDc,bmi,0,bitsOut,0,0]);assert(fogDc&&bitmap);call('SelectObject',[fogDc,bitmap]);
 gdiSurfaces.push({id:bitmap,width:64,height:64,pixels:new Uint8ClampedArray(64*64*4)});
`;
const root=process.cwd(),target=path.join(root,'test/test-gl-period-server-state.js');
let text=fs.readFileSync(target,'utf8');
function replace(from,to){assert.strictEqual(text.split(from).length,2,'unique public harness anchor '+from.slice(0,60));text=text.replace(from,to);}
replace('source.init_thread(1,0x400000,0,0,0,0,0);source.heap_init(0x800000);'," const {makeFixture,iat}=req('tools/kernel32-native-fixture');\n const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length),'real PE/thunk initialization');\n");
replace(' let memory,e,owner=1,bridge,render,producer,manager,encoder,delay=false;', ' const gdiSurfaces=[];let memory,e,owner=1,bridge,render,producer,manager,encoder,delay=false;');
replace('softwareFront:e.gl_sw_front()','surfaces:gdiSurfaces,softwareFront:e.gl_sw_front()');
replace("renderer:{windows:","getGdiSurface:id=>{const s=gdiSurfaces.find(s=>s.id===id);return s?{surface:s}:null;},renderer:{windows:");
const begin=text.indexOf(' function call(name,args=[],floats=[])'),end=text.indexOf(' const bind=',begin);assert(begin>0&&end>begin);
text=text.slice(0,begin)+publicABI+text.slice(end);
replace(" const bind=c=>assert.strictEqual(call('wglMakeCurrent',[c?123:0,c]),1);"," const bind=c=>assert.strictEqual(call('wglMakeCurrent',[c?fogDc:0,c]),1);");
// Keep all public-call qualification on the loaded PE's source instance. The
// existing unmodified regression separately tests cross-producer publication.
const otherBegin=text.indexOf('  const other=new WebAssembly.Instance'),otherEnd=text.indexOf('  const checks=',otherBegin);assert(otherBegin>0&&otherEnd>otherBegin);
text=text.slice(0,otherBegin)+text.slice(otherEnd);
replace("  eq('default independent polygon modes',query(0xb40,2),[0x1b02,0x1b02]);",require('./gl-fog-attrib-cases')+'\n  return;');
text=text.replaceAll("call('wglCreateContext',[0])","call('wglCreateContext',[fogDc])");
const m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));m._compile(text,target);
