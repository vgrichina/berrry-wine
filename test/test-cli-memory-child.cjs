'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { EventEmitter, once } = require('node:events');
const memory = require('../lib/cli-memory-child');
const { VirtualFS } = require('../lib/filesystem');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-memory-test-'));
const retained = process.env.WINE_MEMORY_TEST_EVIDENCE;
const store = () => ({ data: {}, exportStore() { return { ...this.data }; },
  clearStore() { this.data = {}; }, importStore(x) { Object.assign(this.data, x); } });
function write(v, p, text) {
  const h = v.createFile(p, 0x40000000, 2); assert(h);
  v.writeFile(h, Buffer.from(text), text.length); v.closeHandle(h);
}
function read(v, p) { return Buffer.from(v.files.get(p).data).toString(); }
function fixture() {
  const v = new VirtualFS(), s = store();
  write(v, 'c:\\keep', 'old'); write(v, 'c:\\gone', 'delete');
  v.files.get('c:\\keep').attrs = 3;
  v.files.get('c:\\keep').creationTime = { lo: 7, hi: 8 };
  const initial = memory.capture(v, s), b = memory.baseline(initial), child = new VirtualFS(), cs = store();
  memory.restore(child, cs, initial);
  write(child, 'c:\\keep', 'new'); child.deleteFile('c:\\gone'); write(child, 'c:\\receipt', 'read');
  child.createDirectory('c:\\empty');
  child.files.get('c:\\keep').lastWriteTime = { lo: 123, hi: 456 };
  return { v, s, b, child, cs, d: memory.delta(b, memory.capture(child, cs)) };
}
async function units() {
  {
    const { v, s, b, d } = fixture(); write(v, 'c:\\unrelated', 'parent');
    assert.deepEqual(memory.merge(v, s, b, d), { merged: true, written: 2, deleted: 1 });
    assert.equal(read(v, 'c:\\keep'), 'new'); assert(!v.files.has('c:\\gone'));
    assert.equal(read(v, 'c:\\unrelated'), 'parent'); assert(v.dirs.has('c:\\empty'));
    assert.deepEqual(v.files.get('c:\\keep').lastWriteTime, { lo: 123, hi: 456 });
    assert.deepEqual(v.files.get('c:\\keep').creationTime, { lo: 7, hi: 8 });
    assert.equal(v.files.get('c:\\keep').attrs, 3);
  }
  for (const negative of ['bytes', 'metadata', 'open', 'unsafe', 'duplicate', 'whiteout', 'time', 'readonly', 'registry', 'collision', 'second-write', 'second-open']) {
    const { v, s, b, d } = fixture();
    if (negative === 'bytes') write(v, 'c:\\keep', 'parent');
    if (negative === 'metadata') v.files.get('c:\\keep').attrs = 99;
    if (negative === 'open') v.createFile('c:\\keep', 0x80000000, 3);
    if (negative === 'unsafe') d.files[0][0] = 'c:\\..\\escape';
    if (negative === 'duplicate') d.files.push(d.files[0]);
    if (negative === 'whiteout') d.whiteouts.push('c:\\unknown');
    if (negative === 'time') d.files[0][1].creationTime.hi = -1;
    if (negative === 'readonly') v.readOnlyDrives.add('d');
    if (negative === 'registry') { s.data['reg:test'] = 'parent'; d.registry['reg:test'] = 'child'; }
    if (negative === 'collision') v.createDirectory('c:\\receipt');
    if (negative === 'second-write') {
      const original = v.writeFile.bind(v); let calls = 0;
      v.writeFile = (...args) => ++calls === 2 ? { ok: false, bytesWritten: 0, error: 5 } : original(...args);
    }
    if (negative === 'second-open') {
      const original = v.createFile.bind(v); let calls = 0;
      v.createFile = (...args) => ++calls === 2 ? 0 : original(...args);
    }
    const snapshot = negative === 'readonly' ? null : memory.capture(v, s), entries = new Map(v.files), handles = v.handles.size;
    let notified = 0; v._notifyChange = () => notified++;
    const old = read(v, 'c:\\keep');
    assert.equal(memory.merge(v, s, b, d).merged, false, negative);
    assert.equal(read(v, 'c:\\keep'), old, negative + ' must not partially apply'); assert(v.files.has('c:\\gone'));
    if (snapshot) assert.deepEqual(memory.capture(v, s), snapshot, negative + ' restores full namespace/metadata/registry');
    for (const [p, e] of entries) assert.equal(v.files.get(p), e, negative + ' entry identity');
    assert.equal(v.handles.size, handles); assert.equal(notified, 0);
  }
  {
    const v = new VirtualFS(), s = store();
    v.readOnlyDrives.add('d');
    assert.throws(() => memory.capture(v, s), /ownership/);
  }
  // Real chunk decoder negatives: wrong owner, duplicate/order, truncated EOF,
  // malformed metadata/header/digest. A completed packet is not guest success.
  for (const bad of ['owner', 'order', 'eof', 'header', 'digest', 'duplicate']) {
    const c = new EventEmitter(); c.connected = true;
    const receiver = memory.receive(c, 'secret', 'completion', 1000);
    if (bad === 'owner') c.emit('message', { t: 'vfs-memory', token: 'foreign', kind: 'completion' });
    if (bad === 'order') c.emit('message', { t: 'vfs-memory', token: 'secret', kind: 'completion', op: 'end', seq: 0 });
    if (bad === 'eof') c.emit('disconnect');
    if (bad === 'header') c.emit('message', { t: 'vfs-memory', token: 'secret', kind: 'completion', op: 'begin', size: -1 });
    if (bad === 'digest') {
      for (const m of [{ op: 'begin', version: 1, size: 1, hash: '0'.repeat(64) },
        { op: 'chunk', seq: 0, data: Buffer.from('x') }, { op: 'end', seq: 1 }])
        c.emit('message', { t: 'vfs-memory', token: 'secret', kind: 'completion', ...m });
    }
    if (bad === 'duplicate') {
      c.send = (m, cb) => { c.emit('message', m); cb(); };
      await memory.send(c, 'secret', 'completion', { ok: true });
      c.emit('message', { t: 'vfs-memory', token: 'secret', kind: 'completion', op: 'end', seq: 1 });
      assert(receiver.error); receiver.dispose(); continue;
    }
    await assert.rejects(receiver.promise); receiver.dispose();
  }
  console.log('PASS memory snapshot/metadata/whiteout/conflict/ownership/IPC negatives');
}
const api = String.raw`typedef unsigned long U; typedef void *P;
#define API __declspec(dllimport) __stdcall
void API ExitProcess(U);void API OutputDebugStringA(const char*);void API Sleep(U);
U API CreateDirectoryA(const char*,P);P API CreateFileA(const char*,U,U,P,U,U,P);
U API ReadFile(P,P,U,U*,P);U API WriteFile(P,const void*,U,U*,P);U API CloseHandle(P);
U API DeleteFileA(const char*);P API GetCommandLineA(void);U API GetCurrentDirectoryA(U,char*);
U API CreateProcessA(const char*,char*,P,P,U,U,P,P,P,P);U API WaitForSingleObject(P,U);
U API GetExitCodeProcess(P,U*);U API TerminateProcess(P,U);
P API ShellExecuteA(P,const char*,const char*,const char*,const char*,int);
static U eq(const char*a,const char*b){while(*a&&*a==*b){a++;b++;}return *a==*b;}
static void put(const char*p,const void*b,U n){U done=0;P h=CreateFileA(p,0x40000000,1,0,2,0,0);if(h==(P)-1||!WriteFile(h,b,n,&done,0)||done!=n)ExitProcess(90);CloseHandle(h);}
static U receipt(void){U n=0;char b[4];P h=CreateFileA("C:\\MemoryInstall\\receipt.ok",0x80000000,1,0,3,0,0);if(h==(P)-1)return 0;ReadFile(h,b,4,&n,0);CloseHandle(h);return n==4&&b[0]=='R'&&b[3]=='D';}
`;
function command(bin, args) { cp.execFileSync(bin, args, { cwd: root, stdio: 'pipe' }); }
function compile(name, code, mode) {
  fs.writeFileSync(path.join(temp, name + '.c'), code);
  command('clang', ['--target=i686-pc-windows-msvc', '-ffreestanding', '-fno-stack-protector', '-fno-builtin', '-O1',
    '-DMODE=' + mode, '-c', path.join(temp, name + '.c'), '-o', path.join(temp, name + '.obj')]);
  command('ld', ['-mi386pe', '--entry', '_start', '--subsystem', 'console', '--disable-dynamicbase', '--no-insert-timestamp',
    '-o', path.join(temp, name + '.exe'), path.join(temp, name + '.obj'), path.join(temp, 'kernel32.lib'), path.join(temp, 'shell32.lib')]);
}
function build() {
  const names = { kernel32: ['ExitProcess@4','OutputDebugStringA@4','Sleep@4','CreateDirectoryA@8','CreateFileA@28','ReadFile@20','WriteFile@20','CloseHandle@4','DeleteFileA@4','GetCommandLineA@0','GetCurrentDirectoryA@8','CreateProcessA@40','WaitForSingleObject@8','GetExitCodeProcess@8','TerminateProcess@8'], shell32: ['ShellExecuteA@24'] };
  for (const [name, exports] of Object.entries(names)) {
    fs.writeFileSync(path.join(temp, name + '.def'), 'LIBRARY ' + name + '.dll\nEXPORTS\n' + exports.join('\n') + '\n');
    command('llvm-dlltool', ['-m','i386','-k','-d',path.join(temp,name+'.def'),'-l',path.join(temp,name+'.lib')]);
  }
  compile('child', api + String.raw`
void start(void){U n=0,mode;char b[4],cwd[260];const char*args=GetCommandLineA();const char*p=args;
while(*p)p++;mode=(U)(p[-1]-'0');
GetCurrentDirectoryA(260,cwd);if(!eq(cwd,"c:\\memoryinstall"))ExitProcess(81);
if(mode==3)Sleep(5000);else Sleep(50);
P h=CreateFileA("payload.dat",0x80000000,1,0,3,0,0);if(h==(P)-1||!ReadFile(h,b,4,&n,0)||n!=4||b[0]!='M'||b[3]!='!')ExitProcess(82);CloseHandle(h);
OutputDebugStringA("REAL_CHILD_READ_PARENT_BYTES");OutputDebugStringA(args);
put("receipt.ok","READ",4);DeleteFileA("stale.txt");ExitProcess(mode==2?71:23);}`, 0);
  const b = fs.readFileSync(path.join(temp, 'child.exe'));
  const parent = api + 'static const unsigned char child[]={' + [...b].join(',') + '};\n' + String.raw`
void start(void){U si[17]={68},pi[4]={0},code=999,w;static char cmd[]="\"C:\\MemoryInstall\\child.exe\" \"two words\" /mode:0";
char*p=cmd;while(*p)p++;p[-1]='0'+MODE;
CreateDirectoryA("C:\\MemoryInstall",0);put("C:\\MemoryInstall\\child.exe",child,sizeof(child));put("C:\\MemoryInstall\\payload.dat","MEM!",4);put("C:\\MemoryInstall\\stale.txt","gone",4);
if(MODE==4){if((U)ShellExecuteA(0,"open","C:\\MemoryInstall\\child.exe","\"two words\" /mode:4","C:\\MemoryInstall",1)<=32)ExitProcess(83);OutputDebugStringA("PARENT_EARLY_EXIT");ExitProcess(0);}
if(!CreateProcessA(0,cmd,0,0,0,0,0,"C:\\MemoryInstall",si,pi))ExitProcess(84);
if(MODE==1){OutputDebugStringA("PARENT_EARLY_EXIT");ExitProcess(0);}
if(MODE==3){Sleep(300);if(!TerminateProcess((P)pi[0],87))ExitProcess(85);}
w=WaitForSingleObject((P)pi[0],0xffffffff);if(w!=0||!GetExitCodeProcess((P)pi[0],&code)||code!=(MODE==2?71:MODE==3?87:23))ExitProcess(86);
if(MODE==3){if(receipt())ExitProcess(87);OutputDebugStringA("CANCEL_WAIT_REAL_EXIT_OK");}
else{P h;if(!receipt())ExitProcess(88);h=CreateFileA("C:\\MemoryInstall\\stale.txt",0x80000000,1,0,3,0,0);if(h!=(P)-1)ExitProcess(89);OutputDebugStringA("PARENT_WAIT_EXIT_RECEIPT_WHITEOUT_OK");}
CloseHandle((P)pi[0]);CloseHandle((P)pi[1]);ExitProcess(0);}`;
  for (let mode = 0; mode <= 4; mode++) compile('parent' + mode, parent, mode);
  // Parent uses relative receipts, so its process cwd is the installed tree.
  fs.writeFileSync(path.join(temp, 'deny-disk.cjs'), String.raw`const fs=require('node:fs');const old=fs.mkdtempSync;fs.mkdtempSync=function(p){if(String(p).includes('wa-child-'))throw Error('DISK_VFS_HANDOFF_FORBIDDEN');return old.apply(this,arguments);};`);
}
async function execute(mode, extra = [], exe = path.join(temp,'parent'+mode+'.exe')) {
  const env = { ...process.env, WINE_RUN_EXTRA_ARGS: '', WINE_COM_PROTOCOL_DIR: path.join(temp, 'waits' + mode),
    NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require=' + path.join(temp, 'deny-disk.cjs')).trim() };
  const argv = [path.join(root,'test/run.js'), '--exe='+exe, '--no-build', '--no-renderer',
    '--quiet-api','--quiet-blocks','--stuck-after=0','--max-seconds=20','--max-batches=100000000','--spawn-processes','--child-transport=memory',
    '--trace-api=OutputDebugStringA', '--pipe-child-args=--trace-api=OutputDebugStringA', ...extra];
  const proc = cp.spawn(process.execPath, argv, { cwd: root, env, stdio:['ignore','pipe','pipe'] });
  let stdout='', stderr=''; proc.stdout.on('data',b=>stdout+=b);proc.stderr.on('data',b=>stderr+=b);
  const timer=setTimeout(()=>proc.kill('SIGTERM'),35000);
  const result=await new Promise(resolve=>proc.once('close',(code,signal)=>resolve({pid:proc.pid,code,signal,stdoutEOF:proc.stdout.readableEnded,stderrEOF:proc.stderr.readableEnded,stdout,stderr})));
  clearTimeout(timer);
  if(fs.existsSync(env.WINE_COM_PROTOCOL_DIR))for(const file of fs.readdirSync(env.WINE_COM_PROTOCOL_DIR))if(file.startsWith('native-child-')){
    const w=JSON.parse(fs.readFileSync(path.join(env.WINE_COM_PROTOCOL_DIR,file)));
    assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF&&w.closed,JSON.stringify(w));
    assert(w.pid!==proc.pid&&w.parent===proc.pid);assert.throws(()=>process.kill(w.pid,0),/ESRCH/);
  }
  if(retained){fs.mkdirSync(retained,{recursive:true});fs.writeFileSync(path.join(retained,'mode'+mode+'.json'),JSON.stringify({...result,argv},null,2));
    if(fs.existsSync(env.WINE_COM_PROTOCOL_DIR))for(const file of fs.readdirSync(env.WINE_COM_PROTOCOL_DIR))fs.copyFileSync(path.join(env.WINE_COM_PROTOCOL_DIR,file),path.join(retained,'mode'+mode+'-'+file));}
  return result;
}
async function malformed(kind) {
  const token='owned',guest='c:\\probe.exe';
  const child=cp.fork(path.join(root,'test/run.js'),['--exe='+guest,'--exe-guest-path='+guest,
    '--cwd=c:\\','--spawned-child','--child-memory','--child-transport=memory','--child-state-token='+token,
    '--no-build','--no-renderer','--quiet-api'],{cwd:root,serialization:'advanced',stdio:['ignore','pipe','pipe','ipc']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  let closeEvent=false;child.once('close',()=>{closeEvent=true;});
  // Node's explicit parent-side disconnect can suppress ChildProcess 'close'
  // (IPC contributes a pending close count). Join the actual OS exit and both
  // stream EOFs independently, including the actual IPC disconnect event.
  const done=Promise.all([once(child,'exit'),once(child.stdout,'end'),once(child.stderr,'end'),once(child,'disconnect')])
    .then(([[code,signal]])=>({pid:child.pid,code,signal,actualWait:true,closeEvent,
      ipcDisconnected:!child.connected,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr}));
  const timer=setTimeout(()=>child.kill('SIGTERM'),10000);
  if(kind==='owner')child.send({t:'vfs-memory',kind:'launch',token:'foreign',op:'begin'});
  if(kind==='incomplete'){child.send({t:'vfs-memory',kind:'launch',token,op:'begin',version:1,size:100,hash:'0'.repeat(64)},()=>child.disconnect());}
  if(kind==='metadata')await memory.send(child,token,'launch',{guestExe:guest,cwd:'c:\\',image:Buffer.from('MZ'),snapshot:{version:999}});
  const result=await done;clearTimeout(timer);
  assert.equal(result.code,1,JSON.stringify(result));assert(result.stdoutEOF&&result.stderrEOF);
  assert.doesNotMatch(stdout,/PE loaded|\[Exit\]/);assert.match(stderr,/memory (IPC|snapshot)/);
  if(retained)fs.writeFileSync(path.join(retained,'malformed-'+kind+'.json'),JSON.stringify(result,null,2));
  console.log('PASS real child rejects '+kind+' transport before PE execution');
}
(async()=>{
  process.exitCode=1; // An unresolved async test must never silently pass.
  await units(); if(process.argv.includes('--unit-only')){process.exitCode=0;return;}
  build();
  // Parent observes the child's installed receipt through an absolute path.
  // Keep its own cwd unchanged while checking inherited child cwd separately.
  for(let mode=0;mode<=4;mode++){
    const r=await execute(mode); const log=r.stdout+r.stderr;
    assert.equal(r.code,0,log);assert(r.stdoutEOF&&r.stderrEOF);
    assert.match(log,/\[spawn\] CreateProcess.*pid/);
    assert.match(log,/\[Exit\] code=0/,log);
    assert.doesNotMatch(log,/\[Exit\] code=8[1-9]|\[Exit\] code=90|DISK_VFS_HANDOFF_FORBIDDEN/,log);
    if(mode===3){assert.match(log,/CANCEL_WAIT_REAL_EXIT_OK/);assert.match(log,/"merged":false/);}
    else {assert.match(log,/REAL_CHILD_READ_PARENT_BYTES/);assert.match(log,/two words.*\/mode:/);assert.match(log,/"merged":true/);}
    if(mode===0||mode===2)assert.match(log,/PARENT_WAIT_EXIT_RECEIPT_WHITEOUT_OK/);
    if(mode===1||mode===4)assert.match(log,/PARENT_EARLY_EXIT/);
    console.log('PASS actual PE memory child mode '+mode);
  }
  // Real source-owned ISO, empty inherited D: cwd, early installed-DLL
  // DllMain, volume identity, denied readonly writes, C: output and registry.
  const mediaDir=path.join(temp,'media');
  require('./test-sims-inherited-readonly-media-child-context.cjs').prepareNative(mediaDir);
  const mediaResult=await execute('media', ['--iso='+path.join(mediaDir,'control.iso'),
    '--dll-seed='+path.join(mediaDir,'guard.dll')],path.join(mediaDir,'setup.exe'));
  assert.equal(mediaResult.code,0,mediaResult.stdout+mediaResult.stderr);
  assert.equal((mediaResult.stdout.match(/\[Exit\] code=0/g)||[]).length,2,mediaResult.stdout+mediaResult.stderr);
  assert.match(mediaResult.stdout,/"merged":true/);
  assert.doesNotMatch(mediaResult.stdout,/\[max-seconds\]|CRASH|DISK_VFS_HANDOFF_FORBIDDEN/);
  console.log('PASS actual PE memory source-owned readonly context/DllMain/registry');
  for(const kind of ['owner','incomplete','metadata'])await malformed(kind);
  process.exitCode=0;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}));
