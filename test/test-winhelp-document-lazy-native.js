'use strict';
// Generated PE calls the public stdcall API; HLP/CNT bytes cross real VFS imports.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {buildPe, X86, checkRestored} = require('./test-edit-winhelp-callback-native');
const {VirtualFS} = require('../lib/filesystem');
const {ChunkCache} = require('../lib/byte-provider');
const {createHostImports} = require('../lib/host-imports');
const ROOT = path.resolve(__dirname, '..'), B = 0x400000, D = B + 0x5000;
const SNAP = D + 0x100, DONE = D + 8, CANARY = 0x51ac0ffe;
const HLP = fs.readFileSync(path.join(ROOT, 'test/binaries/help/freecell.hlp'));
const CNT = fs.readFileSync(path.join(ROOT, 'test/binaries/help/freecell.cnt'));
const FILES = ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm'];
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function image(wide, command = false) {
  const api = wide ? 'WinHelpW' : 'WinHelpA';
  const str = s => Buffer.from(s + '\0', wide ? 'utf16le' : 'latin1');
  return buildPe({imageBase:B, entryRva:0x2000, codeRva:0x2000,
    imports:[['user32.dll',[api]]], extra:[[0x1800,str('c:\\lazy-doc.hlp')],
      [0x1880,str('Contents()')]], code(iat) {
      return new X86().push(CANARY).seed(0x11000000).snapshot(SNAP)
        .push(command ? B+0x1880 : 0).push(command ? 0x102 : 3).push(B+0x1800).push(0)
        .api(iat,api).snapshot(SNAP+32).store(0,D)
        .emit(0x58).store(0,D+4).set(DONE,1).emit(0xeb,0xfe).finish();
    }}).img;
}
async function fixture(file, {wide=false, command=false, lazy='hlp', bad=null, absentCnt=false, absentHlp=false}={}) {
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const vfs = new VirtualFS(), trace=[], reads=[], providers={};
  const mount=(ext,bytes)=>{
    const name='c:\\lazy-doc.'+ext;
    if(lazy===ext) {
      let resolve, reject, requested=0;
      const gate=new Promise((a,b)=>{resolve=a;reject=b;});
      const cache=new ChunkCache({size:bytes.length,readRange(off,len){
        requested++;return gate.then(()=>bytes.slice(off,off+len));
      }},{chunkSize:1024,maxChunks:2,readAhead:0,prefetch:0});
      const entry=vfs.setProviderFile(name,{provider:cache});
      providers[ext]={resolve,reject,requested:()=>requested,cache,entry};
    } else vfs.files.set(name,{data:new Uint8Array(bytes),attrs:32,name});
  };
  const hlp=Buffer.from(HLP);if(bad==='hlp')hlp[0]=0;
  if(!absentHlp)mount('hlp',hlp);
  if(!absentCnt)mount('cnt',bad==='cnt'?Buffer.from('1 Root\n3 Bad\n'):CNT);
  // Deliberately no readFile/readFileAsync: no eager fallback can hide a park.
  const ctx={exports:null,vfs,getMemory:()=>memory.buffer};
  const host=createHostImports(ctx).host;
  let e;
  Object.assign(host,{memory,log(){},log_i32(){},exit(){},exit_thread(){},wait_multiple(){return 0;}});
  const get=a=>new DataView(memory.buffer).getUint32(e.guest_to_wasm(a),true);
  const snap=(label,extra={})=>{
    const row={label,eip:e.get_eip()>>>0,esp:e.get_esp()>>>0,yield:e.get_yield_reason(),
      done:get(DONE),result:get(D),pending:!!vfs.getPendingRead(1),
      window:e.get_help_window(),topicBytes:e.get_help_view_topic_len(),
      file:e.get_help_file_ptr(),cnt:e.get_help_cnt_node_count(),...extra};
    trace.push(row);return row;
  };
  for(const name of ['fs_read_file','fs_read_file_result']) {
    const original=host[name];
    host[name]=(...args)=>{
      const result=original(...args),pending=vfs.getPendingRead(1);
      const row=snap(name,{args,result,handleOpen:!!vfs.getOpenFile(args[0])});
      reads.push({args,result,pending,row});return result;
    };
  }
  const close=host.fs_close_handle;
  host.fs_close_handle=(h,...args)=>{
    snap('before-close',{handle:h,pendingHandle:vfs.getPendingRead(1)?.handle});
    const result=close(h,...args);snap('after-close',{handle:h});return result;
  };
  const moduleBytes=fs.readFileSync(path.join(ROOT,file));
  const result=await WebAssembly.instantiate(moduleBytes,{host});e=ctx.exports=result.instance.exports;
  const exe=image(wide,command),mem=new Uint8Array(memory.buffer);
  mem.set(exe,e.get_staging());e.load_pe(exe.length);
  return {e,vfs,memory,mem,get,snap,trace,reads,providers,exe,module:result.module,moduleSha256:sha256(moduleBytes)};
}
function drive(f) {
  for(let i=0;i<16&&!f.get(DONE)&&!f.e.get_yield_reason();i++) f.e.run(1000);
  return f.snap('guest-boundary');
}
function save(file,mode,f) {
  const dir=process.env.HELP_DOCUMENT_EVIDENCE;if(!dir)return;
  fs.mkdirSync(dir,{recursive:true});
  const pe='public-document'+(mode.includes('wide')?'-wide':'')+(mode.includes('command')?'-command':'')+'.exe';
  fs.writeFileSync(path.join(dir,path.basename(file)+'.'+mode+'.json'),JSON.stringify({file,mode,
    moduleSha256:f.moduleSha256,pe,peSha256:sha256(f.exe),trace:f.trace,
    requests:Object.fromEntries(Object.entries(f.providers).map(([k,v])=>[k,v.requested()]))},null,2)+'\n');
  fs.writeFileSync(path.join(dir,pe),f.exe);
}
async function baseline(file,wide,lazy) {
  const f=await fixture(file,{wide,lazy});
  try {
    drive(f);
    const r=f.reads.find(r=>r.pending);assert(r,'actual document read produced pendingRead before close');
    assert.equal(r.row.handleOpen,true);assert.equal(r.pending.fileRecord.closed,true,'reader closed its pending handle');
    assert.equal(f.vfs.getPendingRead(1),null,'close erased exact pending slot');
    assert.equal(await f.vfs.fillPendingRead(r.pending),false,'exact read cannot fill after close');
    assert.equal(f.providers[lazy].requested(),0,'provider rejected before request');
    assert.equal(f.get(DONE),1,'baseline public API already returned');assert.equal(f.get(D),0);
    assert.equal(f.e.get_help_window(),0);assert.equal(f.e.get_help_view_topic_len(),0);
    f.snap('baseline-exact-fill-refused');
  } finally {save(file,'baseline-'+(wide?'wide-':'ansi-')+lazy,f);}
}
async function run(file,options={}) {
  const {wide=false,lazy='hlp',command=false,bad=null,cancel=false,reject=false,retire=false,terminate=false,absentCnt=false,absentHlp=false}=options;
  const mode=[wide?'wide':'ansi',lazy||'eager',command?'command':'contents',bad||'',cancel?'cancel':'',reject?'reject':'',retire?'retire-'+retire:'',terminate?'terminate':'',absentCnt?'absent-cnt':'',absentHlp?'absent-hlp':''].filter(Boolean).join('-');
  const f=await fixture(file,options);
  try {
    drive(f);let parks=0;const readTargets=new Map();
    while(!f.get(DONE)&&parks<32) {
      assert.equal(f.e.get_yield_reason(),12,'public document call parks on real I/O');
      const pending=f.vfs.getPendingRead(1);assert(pending,'exact pending slot survives public call');
      const r=f.reads.findLast(r=>r.pending===pending);assert(r);
      if(readTargets.has(pending.provider))assert.deepEqual(r.args,readTargets.get(pending.provider),
        'all chunk retries retain the original handle and destinations');
      else readTargets.set(pending.provider,r.args.slice());
      assert.equal(pending.fileRecord,f.vfs.getOpenFile(pending.handle));
      assert.equal(pending.entry,f.vfs.fileEntry(pending.fileRecord));
      assert.equal(pending.provider,pending.entry._provider);
      assert.equal(pending.revision,pending.provider.revision,'provider revision remains admitted');
      f.snap('exact-live-read',{handle:pending.handle,buffer:r.args[1],count:r.args[3],
        fileRecordMatches:true,entryMatches:true,providerMatches:true,
        revision:pending.revision??null,requested:f.providers[lazy].requested()});
      assert.equal(f.e.get_help_macro_suspended_token(),0n,'document park is not a macro callback');
      assert.equal(f.e.get_help_window(),0,'no topic window before complete document');
      assert.equal(f.e.get_help_view_topic_len(),0);
      const stack=f.e.get_esp()>>>0,ip=f.e.get_eip()>>>0;
      // Allocator pressure must not hand another user the parked destinations.
      for(const size of [r.args[2],4,32]) {
        const p=f.e.guest_alloc(size);assert(p);
        assert(p+size<=r.args[1]||p>=r.args[1]+r.args[2],'read destination remains allocated');
        assert(p+size<=r.args[3]||p>=r.args[3]+4,'count destination remains allocated');
      }
      const provider=f.providers[lazy],before=provider.requested();
      const fill=f.vfs.fillPendingRead(pending);
      await Promise.resolve();assert(provider.requested()>before,'exact live read admits provider request');
      if(terminate) {
        f.e.exit_thread_after_dll_unload(91);f.e.run(1000);
        assert.equal(f.e.get_yield_reason(),2);assert.equal(f.e.get_eip(),0);
        assert.equal(f.vfs.getOpenFile(pending.handle),null,'termination closes retained document handle');
        provider.resolve();assert.equal(await fill,false,'terminated read cannot publish');
        assert.equal(f.get(DONE),0);assert.equal(f.e.get_help_window(),0);
        f.snap('terminated-no-resume');return;
      }
      if(retire) {
        if(retire==='same') {
          f.mem.set(f.exe,f.e.get_staging());f.e.load_pe(f.exe.length);
          f.e.invalidate_code_range(B+0x1000,0x6000);
          f.e.run(1); // validated root replacement discards old document state
          assert.equal(f.vfs.getOpenFile(pending.handle),null);
          provider.resolve();assert.equal(await fill,false);
          assert.equal(f.get(DONE),0,'old API cannot complete in replacement');
          f.snap('same-instance-replacement');return;
        }
        const host=createHostImports({vfs:f.vfs,getMemory:()=>f.memory.buffer}).host;
        Object.assign(host,{memory:f.memory,log(){},log_i32(){},exit(){}});
        const replacement=new WebAssembly.Instance(f.module,{host}).exports;
        f.mem.set(f.exe,replacement.get_staging());replacement.load_pe(f.exe.length);
        const state=[f.e.get_eip(),f.e.get_esp(),f.e.get_eax()];
        provider.resolve();await fill;
        assert.throws(()=>f.e.run(1000),WebAssembly.RuntimeError,'retired process cannot resume document continuation');
        assert.deepEqual([f.e.get_eip(),f.e.get_esp(),f.e.get_eax()],state);
        f.vfs.closeHandle(pending.handle);f.snap('retired-no-resume');return;
      }
      if(cancel)f.vfs.closeHandle(pending.handle);
      if(reject)provider.reject(Error('deliberate document provider rejection'));else provider.resolve();
      assert.equal(await fill,!(cancel||reject),'exact fill lifetime result');
      f.snap('exact-fill-complete',{handle:pending.handle,requested:provider.requested(),
        admitted:!(cancel||reject),handleOpen:!!f.vfs.getOpenFile(pending.handle)});
      assert.equal(f.e.get_esp()>>>0,stack);assert.equal(f.e.get_eip()>>>0,ip);
      f.e.clear_yield();drive(f);parks++;
    }
    assert.equal(f.get(DONE),1,'public caller eventually completes');
    const failed=!!(bad||cancel||reject||absentHlp);
    assert.equal(f.get(D),failed?0:1);assert.equal(f.get(D+4),CANARY,'stdcall stack canary');
    checkRestored(f.get,SNAP,0x11000000,failed?0:1);
    if(failed) {
      assert.equal(f.e.get_help_window(),0);assert.equal(f.e.get_help_file_ptr(),0);
      assert.equal(f.e.get_help_cnt_node_count(),0);assert.equal(f.e.get_help_view_topic_len(),0);
      assert.equal(f.e.get_help_last_error(),bad==='cnt'?18:bad==='hlp'?3:7,
        'terminal failure preserves the parser or VFS cause');
    } else {
      assert(f.e.get_help_window());assert.equal(f.e.get_help_view_topic_len(),115);
      assert.equal(f.e.get_help_cnt_node_count(),absentCnt?0:3);
      const ptr=f.e.get_help_document_path_ptr(),len=f.e.get_help_document_path_len();
      assert.equal(Buffer.from(f.mem.subarray(ptr,ptr+len)).toString('latin1'),'c:\\lazy-doc.hlp',
        'owned canonical path survives W normalization and command allocation');
      if(lazy)assert(parks>0,'provider-backed document actually parked');
    }
    assert([...f.vfs.handles.values()].every(h=>h.closed),'all document read handles retired');
    const reads=f.reads.length;f.e.run(1000);assert.equal(f.reads.length,reads,'no duplicate public completion');
    f.snap('completed-once',{parks});
  } finally {save(file,mode,f);}
}
async function failedReplacement(file,wide) {
  const f=await fixture(file,{wide,lazy:null});
  try {
    drive(f);assert.equal(f.get(D),1);assert(f.e.get_help_window());
    f.vfs.files.delete('c:\\lazy-doc.hlp');
    new DataView(f.memory.buffer).setUint32(f.e.guest_to_wasm(DONE),0,true);
    f.e.set_eip(B+0x2000);f.e.clear_yield();drive(f);
    assert.equal(f.get(DONE),1);assert.equal(f.get(D),0);
    assert.equal(f.e.get_help_window(),0,'missing replacement closes existing window');
    assert.equal(f.e.get_help_view_topic_ptr(),0);assert.equal(f.e.get_help_file_ptr(),0);
    assert.equal(f.e.get_help_dispatch_status(),7);
    f.snap('failed-replacement-closes-old-window');
  } finally {save(file,(wide?'wide':'ansi')+'-failed-replacement',f);}
}
if(require.main===module)(async()=>{
  const baselineMode=process.argv.includes('--baseline');
  for(const file of FILES) {
    for(const wide of [false,true]) {
      await run(file,{wide,lazy:null});console.log('PASS eager',file,wide);
      if(baselineMode) {
        for(const lazy of ['hlp','cnt']) {await baseline(file,wide,lazy);console.log('REPRODUCED pending-close',file,wide,lazy);}
        continue;
      }
      for(const lazy of ['hlp','cnt']) {
        for(const command of [false,true])await run(file,{wide,lazy,command});
        for(const option of ['cancel','reject','retire'])await run(file,{wide,lazy,[option]:true});
        await run(file,{wide,lazy,retire:'same'});
        await run(file,{wide,lazy,terminate:true});
        await run(file,{wide,lazy,bad:lazy});
      }
      await run(file,{wide,lazy:null,bad:'hlp'});
      await run(file,{wide,lazy:null,bad:'cnt'});
      await run(file,{wide,lazy:null,absentCnt:true});
      await run(file,{wide,lazy:null,absentHlp:true});
      await failedReplacement(file,wide);
      console.log('PASS document matrix',file,wide);
    }
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={fixture,run,baseline};
