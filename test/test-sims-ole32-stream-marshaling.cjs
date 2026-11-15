'use strict';

// Public x86 IStream callbacks, including suspension and reentrant marshaling.
// Importing this file never builds a module or launches a guest.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const streamSource = String.raw`
typedef unsigned long U;typedef long H;typedef void*P;
#define API __declspec(dllimport) __stdcall
#define CALL __stdcall
void API ExitProcess(U);void API Sleep(U);void API OutputDebugStringA(const char*);
P API CreateThread(P,U,P,P,U,U*);U API WaitForSingleObject(P,U);U API CloseHandle(P);
U API GetExitCodeThread(P,U*);static volatile U completed;
H API CoMarshalHresult(P,H);H API CoUnmarshalHresult(P,H*);
H API CreateStreamOnHGlobal(P,U,P*);
typedef H(CALL*Marshal)(P,H);typedef H(CALL*Unmarshal)(P,H*);
typedef struct Stream Stream;
typedef struct {P qi;U(CALL*add)(Stream*);U(CALL*release)(Stream*);
 H(CALL*read)(Stream*,P,U,U*);H(CALL*write)(Stream*,P,U,U*);} VT;
struct Stream {const VT*v;U refs,adds,releases,calls,n,mode;H result;unsigned char bytes[4];};
void check(int yes,U code){if(!yes)ExitProcess(code);}
U CALL add(Stream*s){s->adds++;return ++s->refs;}
U CALL release(Stream*s){s->releases++;return --s->refs;}
static const VT vt;
H CALL transfer(Stream*s,P data,U n,U*count,U writing){
 U i;unsigned char*b=data;s->calls++;
 check(n==4&&data!=0&&count==0,20);
 if(s->mode==1)Sleep(20);
 if(s->mode==2){Stream inner={&vt,1,0,0,0,4,0,0,{0}};H out=0;
  check(CoMarshalHresult(&inner,(H)0x87654321)==0,21);
  check(CoUnmarshalHresult(&inner,&out)==0&&(U)out==0x87654321,22);
  check(inner.calls==2&&inner.refs==1&&!inner.adds&&!inner.releases,23);}
 for(i=0;i<s->n;i++){if(writing)s->bytes[i]=b[i];else b[i]=s->bytes[i];}
 return s->result;
}
H CALL read(Stream*s,P b,U n,U*c){return transfer(s,b,n,c,0);}
H CALL write(Stream*s,P b,U n,U*c){return transfer(s,b,n,c,1);}
static const VT vt={0,add,release,read,write};
// fn/stream/value; verify the public stdcall epilogue and every preserved GPR.
__attribute__((naked)) H CALL checked(P fn,P stream,U value){
 __asm__ volatile("pushl %ebx\n pushl %esi\n pushl %edi\n pushl %ebp\n"
  "movl $0x13572468,%ebx\n movl $0x24681357,%esi\n movl $0x76543210,%edi\n movl %esp,%ebp\n"
  "pushl 28(%ebp)\n pushl 24(%ebp)\n calll *20(%ebp)\n"
  "cmpl %esp,%ebp\n jne 1f\n cmpl $0x13572468,%ebx\n jne 1f\n"
  "cmpl $0x24681357,%esi\n jne 1f\n cmpl $0x76543210,%edi\n jne 1f\n"
  "jmp 2f\n 1: movl $0x8004fffd,%eax\n 2: movl %ebp,%esp\n popl %ebp\n popl %edi\n popl %esi\n popl %ebx\n retl $12");
}
U CALL exercise(P ignored){
 static const U patterns[]={0,1,0x80004005,0x80030070,0x7fffffff,0x80000000,0xffffffff,0x12345678};
 static const H statuses[]={0,1,(H)0x80030070,(H)0x80030005,(H)0x8000000a};
 U i,j,k,mode;H out,hr;Stream s={&vt,1,0,0,0,4,0,0,{0}};
 for(mode=0;mode<3;mode++)for(i=0;i<8;i++){
  s.mode=mode;s.n=4;s.result=0;
  hr=checked(CoMarshalHresult,&s,patterns[i]);check(hr==0,30);
  for(k=0;k<4;k++)check(s.bytes[k]==((patterns[i]>>(8*k))&255),31);
  out=0;hr=checked(CoUnmarshalHresult,&s,(U)&out);check(hr==0&&(U)out==patterns[i],32);
 }
 // Exactly one stream operation, with its HRESULT propagated unchanged.
 // Short reads expose only the bytes the actual stream writes; no retry,
 // fabricated completion, or hidden zero-fill is permitted.
 s.mode=0;
 for(i=0;i<5;i++)for(j=0;j<5;j++){
  U before=s.calls,expected=0xa5a5a5a5;s.n=j;s.result=statuses[i];
  for(k=0;k<4;k++)s.bytes[k]=0xcc;
  hr=checked(CoMarshalHresult,&s,0x12345678);check(hr==statuses[i]&&s.calls==before+1,40);
  for(k=0;k<4;k++)check(s.bytes[k]==(k<j?((0x12345678>>(8*k))&255):0xcc),41);
  out=(H)expected;hr=checked(CoUnmarshalHresult,&s,(U)&out);check(hr==statuses[i]&&s.calls==before+2,42);
  for(k=0;k<j;k++)expected=(expected&~(255UL<<(8*k)))|((U)s.bytes[k]<<(8*k));
  check((U)out==expected,43);
 }
 check(s.refs==1&&!s.adds&&!s.releases,44);
 check(CoMarshalHresult(0,0)==(H)0x80030009,45);
 check(CoUnmarshalHresult(0,&out)==(H)0x80030009,46);
 {U calls=s.calls;VT empty={0};Stream bad={&empty,1};
  check(CoUnmarshalHresult(&s,0)==(H)0x80030009&&s.calls==calls,47);
  check(CoMarshalHresult(&bad,0)==(H)0x80030009,48);
  check(CoUnmarshalHresult(&bad,&out)==(H)0x80030009,49);}
 {P local=0;P*v;typedef H(CALL*Seek)(P,long,long,U,P);typedef U(CALL*Release)(P);
  check(CreateStreamOnHGlobal(0,1,&local)==0&&local!=0,50);v=*(P**)local;
  check(checked(CoMarshalHresult,local,0xdeadbeef)==0,51);
  check(((Seek)v[5])(local,0,0,0,0)==0,52);
  out=0;check(checked(CoUnmarshalHresult,local,(U)&out)==0&&(U)out==0xdeadbeef,53);
  // Preserve this repository's existing HGLOBAL EOF result (S_OK, no bytes).
  // The new API must propagate its stream, just as for a private stream.
  out=(H)0xa5a5a5a5;check(checked(CoUnmarshalHresult,local,(U)&out)==0&&(U)out==0xa5a5a5a5,54);
  check(((Release)v[2])(local)==0,55);}
 completed=1;OutputDebugStringA("stream-marshal.all-cases=PASS\n");return 0;
}
void start(void){
#ifdef RUN_WORKER
 U id=0,code=259;P thread=CreateThread(0,0,exercise,0,0,&id);check(thread!=0&&id!=0,60);
 check(WaitForSingleObject(thread,10000)==0,61);
 check(GetExitCodeThread(thread,&code)&&code==0&&completed==1,62);CloseHandle(thread);
 OutputDebugStringA("stream-marshal.all-cases=PASS\n");
#else
 exercise(0);
#endif
 ExitProcess(0);
}
`;

function prepare(directory) {
  const cp = require('node:child_process');
  const out = path.resolve(directory);
  fs.mkdirSync(out, { recursive: true });
  const put = (n, b) => fs.writeFileSync(path.join(out, n), b, { flag: 'wx' });
  let sequence = 0;
  const run = (command, args) => {
    const r = cp.spawnSync(command, args, { encoding: 'utf8' }), name = 'tool-' + ++sequence;
    put(name + '.stdout.log', r.stdout || '');put(name + '.stderr.log', r.stderr || '');
    put(name + '-wait.json', JSON.stringify({ pid: r.pid, exit: r.status, signal: r.signal,
      actualWait: r.status !== null, stdoutEOF: !r.error, stderrEOF: !r.error }) + '\n');
    if (r.error || r.status) throw new Error(command + ': ' + (r.stderr || r.error));
  };
  for (const [dll, names] of Object.entries({
    kernel32: ['ExitProcess@4','Sleep@4','OutputDebugStringA@4','CreateThread@24','WaitForSingleObject@8','CloseHandle@4',
      'GetCurrentProcessId@0','LoadLibraryA@4','GetProcAddress@8','FreeLibrary@4','CreateFileA@28','WriteFile@20','GetStdHandle@4',
      'SetEvent@4','GetCommandLineA@0','GetExitCodeThread@8'],
    ole32: ['CoMarshalHresult@8','CoUnmarshalHresult@8','CreateStreamOnHGlobal@12','CoInitialize@4','CoUninitialize@0',
      'CoTaskMemAlloc@4','CoTaskMemFree@4'],
    oleaut32: ['SysAllocStringLen@8','SysFreeString@4','SysStringLen@4','LoadTypeLib@8','RegisterTypeLib@12'],
    advapi32: ['RegCreateKeyA@12','RegSetValueA@20','RegCloseKey@4'],
  })) {
    put(dll + '.def', 'LIBRARY ' + dll + '.dll\nEXPORTS\n' + names.join('\n') + '\n');
    run('llvm-dlltool', ['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  put('stream.c',streamSource);
  const inputs = [];
  for (const worker of [false,true]) {
    const name = worker ? 'stream-worker' : 'stream-main';
    run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1',
      ...(worker ? ['-DRUN_WORKER=1'] : []),'-c',path.join(out,'stream.c'),'-o',path.join(out,name+'.obj')]);
    run('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp',
      '-o',path.join(out,name+'.exe'),path.join(out,name+'.obj'),path.join(out,'kernel32.lib'),path.join(out,'ole32.lib')]);
    inputs.push({ name, sha256: sha(fs.readFileSync(path.join(out,name+'.exe'))) });
  }
  put('oleaut-loopback.c',actualLoopbackSource());
  run('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1',
    '-c',path.join(out,'oleaut-loopback.c'),'-o',path.join(out,'oleaut-loopback.obj')]);
  run('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp',
    '-o',path.join(out,'oleaut-loopback.exe'),path.join(out,'oleaut-loopback.obj'),
    ...['kernel32','ole32','oleaut32','advapi32'].map(d=>path.join(out,d+'.lib'))]);
  inputs.push({name:'oleaut-loopback',sha256:sha(fs.readFileSync(path.join(out,'oleaut-loopback.exe')))});
  put('prepared.json',JSON.stringify({ inputs, nativeExecution:false },null,2)+'\n');
  return inputs;
}
function actualLoopbackSource() {
  return require('./test-sims-localserver-channel-implementation.cjs').loopbackSource
    .replace('sends!=3', 'sends!=4')
    .replace('P request;H hr;', 'P request;H hr;U byte;')
    .replace('sends++;hr=', 'for(byte=0;byte<m->size;byte++)report("channel.request.byte",((unsigned char*)m->buffer)[byte]);\n sends++;hr=')
    .replace('report("channel.reply.size",m->size);', 'report("channel.reply.size",m->size);\n for(byte=0;byte<m->size;byte++)report("channel.reply.byte",((unsigned char*)m->buffer)[byte]);');
}
function packetsFromLog(log) {
  const packets=[];let packet;
  for (const match of log.matchAll(/channel\.(request\.method|request\.size|request\.byte|reply\.size|reply\.byte)=([0-9a-f]{8})/g)) {
    const field=match[1],value=parseInt(match[2],16);
    if(field==='request.method') {packet={method:value,request:[],reply:[]};packets.push(packet);}
    else if(!packet) throw new Error('packet field before method');
    else if(field==='request.size')packet.requestSize=value;
    else if(field==='reply.size')packet.replySize=value;
    else {if(value>255)throw new Error('invalid logged byte');packet[field==='request.byte'?'request':'reply'].push(value);}
  }
  return packets;
}
module.exports = { streamSource, prepare, actualLoopbackSource, packetsFromLog };

if (require.main === module) {
  const { test } = require('node:test');
  const assert = require('node:assert/strict');
  const run = path.resolve(__dirname,'../scratch/runs/20261115-sims-ole32-stream-marshaling-implementation');
  for (const name of ['stream-main','stream-worker']) test(name+' actual guest callbacks',()=>{
    const log=fs.readFileSync(path.join(run,name,'native.stdout.log'),'utf8');
    assert.match(log,/stream-marshal\.all-cases=PASS/);assert.match(log,/\[Exit\] code=0\b/);
    const receipt=JSON.parse(fs.readFileSync(path.join(run,name,'native-wait.json')));
    assert.equal(receipt.exit,0);
    for(const key of ['actualWait','stdoutEOF','stderrEOF'])assert.equal(receipt[key],true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(run,name,'watchdog-result.json'))).fired,false);
    if(name==='stream-worker') {
      assert.match(log,/guest threads will run in node worker_threads/);
      assert.match(log,/worker thread 1 exited \(ThreadProc return\) DWORD=0x0/);
    }
  });
  test('actual OLEAUT32 returns PID/deep BSTR and reaches owned interface marshaling',()=>{
    const log=fs.readFileSync(path.join(run,'oleaut-loopback','native.stdout.log'),'utf8');
    const error=fs.readFileSync(path.join(run,'oleaut-loopback','native.stderr.log'),'utf8');
    for(const label of ['PS.DllGetClassObject','PS.CreateStub','PS.CreateProxy','proxy.Connect','proxy.Invoke.pid','proxy.Invoke.BSTR'])
      assert(log.includes(label+'=00000000'),label);
    assert(log.includes('BSTR.roundtrip=00000001'));
    const packets=packetsFromLog(log);assert.deepEqual(packets.map(p=>p.method),[7,6,6,6]);
    for(const p of packets)assert.equal(p.request.length,p.requestSize);
    for(const p of packets.slice(0,3))assert.equal(p.reply.length,p.replySize);
    assert.equal(packets[1].requestSize,46);
    const deep=Buffer.from([0x41,0,0,0,0x42,0,0xbb,3]);
    assert(Buffer.from(packets[2].request).includes(deep));
    assert(Buffer.from(packets[2].reply).includes(deep));
    assert.equal(packets[3].replySize,undefined);
    assert.match(error,/UNIMPLEMENTED API: CoMarshalInterface/);
    assert.doesNotMatch(error,/UNIMPLEMENTED API: Co(?:Unmarshal|Marshal)Hresult/);
    assert.doesNotMatch(log,/proxy\.Invoke\.interface=/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(run,'oleaut-loopback','native-wait.json'))).exit,1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(run,'oleaut-loopback','watchdog-result.json'))).fired,false);
  });
  test('missing either exact preload refuses before the runner loads',()=>{
    for(const name of ['missing-source-preload','missing-hostmap-preload']) {
      assert.equal(JSON.parse(fs.readFileSync(path.join(run,name,'native-wait.json'))).exit,1);
      assert.match(fs.readFileSync(path.join(run,name,'native.stderr.log'),'utf8'),/exact two preloads required/);
      assert.doesNotMatch(fs.readFileSync(path.join(run,name,'native.stdout.log'),'utf8'),/PE loaded|Calling DllMain|\[Exit\]/);
    }
  });
}
