'use strict';
// Source isolation and actual authority/client Workers, with finite independent
// process-group deadlines. No original game or private gameplay state.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
if (process.argv[2] === '--emit-native-fixture') {
  const fs = require('node:fs');
  const b = require('../tools/kernel32-native-fixture').makeFixture();
  const raw = rva => rva - 0x1000 + 0x200, base = 0x400000;
  // Replace the fixture's imports and entry point with an ordinary finite PE:
  // real visible STATIC window, two native guest Workers, public waits, exit.
  const groups = [['kernel32.dll', ['CreateThread', 'WaitForSingleObject', 'Sleep', 'ExitProcess', 'OutputDebugStringA']],
    ['user32.dll', ['CreateWindowExA']]];
  b.fill(0, raw(0x1100), raw(0x1200)); // no fixture export directory
  b.writeUInt32LE(0, 0x80 + 24 + 96); b.writeUInt32LE(0, 0x80 + 24 + 100);
  b.fill(0, raw(0x1800), raw(0x2000));
  let names = 0x1b00; const iat = {};
  groups.forEach(([dll, apis], g) => {
    const desc = raw(0x1800 + 20 * g), table = 0x1900 + g * 64;
    b.writeUInt32LE(table, desc); b.writeUInt32LE(0x1880 + g * 32, desc + 12);
    b.writeUInt32LE(table, desc + 16); b.write(dll + '\0', raw(0x1880 + g * 32));
    apis.forEach((name, i) => {
      b.writeUInt32LE(names, raw(table + i * 4)); b.write(name + '\0', raw(names) + 2);
      iat[name] = base + table + i * 4; names += name.length + 3;
    });
  });
  b.writeUInt32LE(60, 0x80 + 24 + 108);
  const u32 = n => { const v = Buffer.alloc(4); v.writeUInt32LE(n >>> 0); return [...v]; };
  const code = [], push = n => code.push(0x68, ...u32(n));
  const call = name => code.push(0xff, 0x15, ...u32(iat[name]));
  const str = (rva, text) => { b.write(text + '\0', raw(rva)); return base + rva; };
  const klass = str(0x1d00, 'STATIC'), title = str(0x1d20, 'Finite threaded desktop startup fixture');
  const marker = str(0x1d70, 'FINITE_NATIVE_TWO_WORKERS_COMPLETE');
  for (const n of [0,0,0,0,120,320,20,20,0x10000000,title,klass,0]) push(n);
  call('CreateWindowExA');
  for (const slot of [0x1e00, 0x1e04]) {
    for (const n of [0,0,0,base+0x2200,0,0]) push(n);
    call('CreateThread'); code.push(0xa3, ...u32(base + slot));
  }
  for (const slot of [0x1e00, 0x1e04]) {
    push(0xffffffff); code.push(0xff,0x35,...u32(base + slot)); call('WaitForSingleObject');
  }
  push(marker); call('OutputDebugStringA'); push(0); call('ExitProcess');
  Buffer.from(code).copy(b, raw(0x2000));
  Buffer.from([0x68,...u32(5),0xff,0x15,...u32(iat.Sleep),0x31,0xc0,0xc2,4,0]).copy(b,raw(0x2200));
  fs.writeFileSync(process.argv[3], b);
  process.exit(0);
}
const r = spawnSync('python3', ['-B', '-c', String.raw`
import pathlib,subprocess,os,json,hashlib,base64,importlib.util,re,threading,signal
root=pathlib.Path.cwd();s=importlib.util.spec_from_file_location('sup',root/'tools/lmarbles-supervisor.py');sup=importlib.util.module_from_spec(s);s.loader.exec_module(sup)
sha=lambda b:hashlib.sha256(b).hexdigest()
files={};todo=['lib/process-desktop.js']
while todo:
 name=todo.pop()
 if name in files:continue
 body=(root/name).read_bytes();files[name]=body
 for relative in re.findall(rb'require\([\'\"](\.[^\'\"]+)[\'\"]\)',body):
  base=os.path.normpath(str(pathlib.Path(name).parent/relative.decode()))
  for suffix in ('','.js','.json','/index.js'):
   candidate=base+suffix
   if (root/candidate).is_file():todo.append(candidate);break
rows=[dict(path=n,sha256=sha(b),body=base64.b64encode(b).decode()) for n,b in sorted(files.items())]
packed,pin=sup.indexed_source(rows)
code="const fs=require('node:fs');const {ProcessDesktop}=require('./lib/process-desktop');(async()=>{const d=new ProcessDesktop();try{d.call({op:'snapshot'});console.log('HELLO')}finally{await d.close()}})().catch(e=>{console.error(e);process.exitCode=1});"
def run(label,body=packed,index_pin=pin,program=code,module=b'',module_pin=None):
 source=sup.seal('startup-test-source',body);wasm=sup.seal('startup-test-module',module)
 env=os.environ.copy();env.update(NODE_OPTIONS='--require='+str(root/'tools/lmarbles-native-source-view.cjs'),LMARBLES_SOURCE_FD='/proc/self/fd/'+str(source),LMARBLES_SOURCE_INDEX_SHA256=index_pin,LMARBLES_MODULE_FD='/proc/self/fd/'+str(wasm),LMARBLES_MODULE_SHA256=module_pin or sha(module))
 p=subprocess.Popen(['node','-e',program],env=env,pass_fds=(source,wasm),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 fired=[]
 def expire():
  fired.append(True)
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 timer=threading.Timer(12,expire);timer.start()
 try:a,b=p.communicate()
 finally:timer.cancel();timer.join();os.close(source);os.close(wasm)
 assert not fired,(label,'independent watchdog expired')
 return p.returncode,a.decode(),b.decode()
for i in range(3):
 rc,a,b=run('cold-workers');assert rc==0 and 'HELLO' in a,(rc,a,b)
print('PASS three cold authority/client Worker handshakes and closure')
rc,a,b=run('index-tamper',index_pin='0'*64);assert rc!=0 and 'sealed source index differs' in b
size=int.from_bytes(packed[:4],'little');index=json.loads(packed[4:4+size]);entry=next(r for r in index['files'] if r['path']=='lib/process-desktop.js');bad=bytearray(packed);bad[4+size+entry['offset']]^=1
rc,a,b=run('source-tamper',body=bytes(bad));assert rc!=0 and 'sealed source digest differs' in b
missing=[r for r in rows if r['path']!='lib/process-desktop.js'];blob,p= sup.indexed_source(missing)
rc,a,b=run('missing-source',body=blob,index_pin=p);assert rc!=0 and 'unsealed runtime input' in b
for method in ["fs.readFileSync('lib/process-desktop.js')","fs.readFile('lib/process-desktop.js',(e)=>{if(e)throw e})","fs.promises.readFile('lib/process-desktop.js')","fs.createReadStream('lib/process-desktop.js')"]:
 rc,a,b=run('tampered-read',body=bytes(bad),program="const fs=require('node:fs');"+method);assert rc!=0 and 'sealed source digest differs' in b
rc,a,b=run('module-tamper',module=b'bad',module_pin='0'*64,program="require('node:fs').readFileSync('build/wine-assembly.wasm')");assert rc!=0 and 'sealed module differs' in b
print('PASS missing/tampered index/source/module and sync/async/promise/stream fail-closed controls')
`], { encoding: 'utf8', timeout: 120000 });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
assert.equal(r.status, 0, 'sealed threaded desktop startup controls');
