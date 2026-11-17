'use strict';
const assert=require('node:assert/strict'),zlib=require('node:zlib');
const {stream,crc32,inspect}=require('../tools/halflife2-original-package.cjs');
assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
const plain=Buffer.from('authored CRC and boundary fixture'),packed=zlib.deflateRawSync(plain),crc=Buffer.alloc(4);
crc.writeUInt32LE(crc32(plain));
const bytes=Buffer.concat([Buffer.from([17,23]),packed,crc,Buffer.from('next stream')]);
const r=stream(bytes,2,plain.length);assert.deepEqual(r.body,plain);assert.equal(r.next,2+packed.length+4);
assert.throws(()=>stream(bytes,2,plain.length+1),/size/);
const bad=Buffer.from(bytes);bad[2+packed.length]^=1;assert.throws(()=>stream(bad,2),/CRC/);
assert.throws(()=>stream(bytes.subarray(0,2+packed.length+2),2),/CRC/);
if(process.argv[2]&&process.argv[2]!=='--native'){const r=inspect(process.argv[2]);assert.equal(r.record.title,'Steam Install');assert.equal(r.bootstrap.length,165376);assert.equal(r.record.streams[2].sha256,'a87f19f9fee475d2b2e82acfb4589be6d816b613064cd06826e1d4c147beb50a');}
console.log('PASS Wise raw DEFLATE boundary, size, CRC, corruption and original bootstrap identity');
async function native(out){
  const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{once}=require('node:events');
  const {X86,pe,BASE}=require('./test-dll-lifecycle-real-pe');
  fs.mkdirSync(out,{recursive:true});
  const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
  const a=new X86();
  a.push(BASE+0x2800).api('LoadLibraryA').emit(0x85,0xc0).branch([0x0f,0x84],'bad');
  a.emit(0x89,0xc3).push(BASE+0x2840).emit(0x53).api('GetProcAddress').emit(0x85,0xc0).branch([0x0f,0x84],'bad');
  a.emit(0x53).api('FreeLibrary').checkEax(1).push(0).api('ExitProcess');
  a.label('bad').push(71).api('ExitProcess');
  const image=path.join(out,'authored-load.exe');
  fs.writeFileSync(image,pe([[0x2000,a.finish()],[0x2800,'c:\\wise0132.dll\0'],[0x2840,'WiseMain\0']]),{flag:'wx'});
  // This ordinary authored startup calls LoadLibrary/GetProcAddress/FreeLibrary.
  // It never calls the installer export or loads the original EXE.
  const wd=cp.spawn(process.execPath,['-e',`let pid;const timer=setTimeout(()=>{if(pid)try{process.kill(pid,'SIGKILL')}catch{};process.exitCode=2;process.stdin.destroy()},45000);console.log('ARMED');process.stdin.on('data',b=>pid=+b);process.stdin.on('end',()=>clearTimeout(timer));`]);
  let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
  while(!wo.includes('ARMED'))await new Promise(r=>setTimeout(r,2));
  save('watchdog-armed.json',{pid:wd.pid,seconds:45,independent:true,beforeNative:true});
  const args=['test/run.js','--exe='+image,'--vfs-mount='+path.resolve(process.argv[4])+'=c:\\wise0132.dll','--no-build','--threads','--real-ticks','--max-seconds=30','--max-batches=100000000','--stuck-after=0','--quiet-blocks','--native-exit-receipt='+path.join(out,'native-exit.json'),'--native-invocation-token='+require('node:crypto').randomUUID()];
  const p=cp.spawn(process.execPath,args,{stdio:['ignore','pipe','pipe']});wd.stdin.write(String(p.pid));
  let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const [exit,signal]=await once(p,'close');
  fs.writeFileSync(path.join(out,'stdout.log'),stdout);fs.writeFileSync(path.join(out,'stderr.log'),stderr);
  save('native-wait.json',{pid:p.pid,args,exit,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded});
  wd.stdin.end();const [wx,ws]=await ww;
  save('watchdog-wait.json',{pid:wd.pid,exit:wx,signal:ws,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});
  assert.equal(wx,0);assert.equal(exit,0,stdout+stderr);
  const result=JSON.parse(fs.readFileSync(path.join(out,'native-exit.json')));
  assert.equal(result.exitCode,0);
  save('proof.json',{authored:true,originalInstallerInvoked:false,WiseMainInvoked:false,ordinaryWin32LoadAndFree:true,guestThreadMode:'actual CPU Worker',exitReceipt:result});
}
if(process.argv[2]==='--native')native(require('node:path').resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
