import pathlib,json,hashlib,base64
from api import py,putrows,H,O
from account import admit
OLD='/tmp/maelstrom-original-errno-caller-capture-oct26'
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
admit('before-stage',future=6000000)
# Retain raw loaded bytes before the verifier can reject, without modifying guest state.
p=H/'runner/test/run.js';s=p.read_text();anchor='    const mapping=verifyLoaded(instance.exports,memory.buffer,moduleBases);'
probe="""    fs.appendFileSync(mscFrozenFile,JSON.stringify({kind:'authentic-loader-raw',moduleBases,imageBase:instance.exports.get_image_base(),moduleSHA256:'a77709fb784a21e6775771450f54b709373f0cc8ad2d4878012c949eaae88f69',anchors:[[0x52e430,'e82274ffff83c008c3'],[0x7a32f2,'8b3d10407a00'],[0x40e125,'e8c253000083c40885c0756e'],[0x7a4010,'30e45200']].map(([va,expected])=>({va,expected,actual:Buffer.from(new Uint8Array(memory.buffer,va-0x400000+0x12000,expected.length/2)).toString('hex')}))})+'\\n');
"""
assert s.count(anchor)==1;s=s.replace(anchor,probe+anchor);p.write_text(s)
# Same accepted watchdog/guard recipe; no scheduling changes.
supervise=pathlib.Path(OLD+'/ops/supervise.py').read_text().replace("assert sys.argv[1]=='guest' ","assert sys.argv[1]=='guest'")
(O/'supervise.py').write_text(supervise)
rows=[]
for target in ['runner/test/run.js','runner/tools/maelstrom-original-errno-adapter.cjs','guest-args.json','validate-tree.cjs','ops/supervise.py']:
 p=H/target;b=p.read_bytes();rows.append(dict(target=target,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b)))
save('delta-manifest.json',rows)
# Test the transfer mechanism separately with a tiny owned probe.
putrows([['transfer-probe.txt',base64.b64encode(b'corrected-adapter-delta\n').decode()]])
save('transfer-probe.json',py('import pathlib,json; p=pathlib.Path('+repr(str(H/'transfer-probe.txt'))+');assert p.read_bytes()==b"corrected-adapter-delta\\n";print(json.dumps(dict(verified=True,bytes=p.stat().st_size)))'))
# Standing tree is reused through file links, except VFS uses a directory tree mount.
code='''import pathlib,json,hashlib,shutil
h=pathlib.Path(HOME);old=pathlib.Path(OLD)
m=json.loads((old/'manifest.json').read_text())
skip=set(SKIP)
for x in m:
 if x['target'] in skip or x['target'].startswith('vfs/'):continue
 p=old/x['target'];assert hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'],x['target']
 q=h/x['target'];q.parent.mkdir(parents=True,exist_ok=True);q.symlink_to(p)
(h/'vfs').symlink_to(old/'vfs',target_is_directory=True)
(h/'manifest.json').write_bytes((old/'manifest.json').read_bytes())
print(json.dumps(dict(standingFiles=len(m),standingBytes=16027648,remoteNewBeforeDelta=sum(max(p.lstat().st_size,p.lstat().st_blocks*512) for p in h.rglob('*') if not p.is_dir()))))
'''.replace('HOME',repr(str(H))).replace('OLD',repr(OLD)).replace('SKIP',repr([x['target'] for x in rows]))
save('remote-standing.json',py(code))
for row in rows:
 b=(H/row['target']).read_bytes()
 # Keep every individual API payload below its command/capture guard.
 for off in range(0,len(b),18000):
  enc=base64.b64encode(b[off:off+18000]).decode()
  py('import pathlib,base64;p=pathlib.Path('+repr(str(H/row['target']))+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(enc)+');'+('assert not p.exists();p.write_bytes(b)' if off==0 else 'assert p.stat().st_size=='+str(off)+';p.open("ab").write(b)'))
code='''import pathlib,json,hashlib,subprocess,shutil
h=pathlib.Path(HOME);rows=ROWS
for x in rows:assert hashlib.sha256((h/x['target']).read_bytes()).hexdigest()==x['sha256']
node='/home/user/.nvm/versions/node/v24.22.1/bin/node'
out=[]
for args in [[node,'--max-old-space-size=128','--check',str(h/'runner/test/run.js')],[node,'--max-old-space-size=128',str(h/'validate-tree.cjs')],['python3',str(h/'ops/supervise.py'),'inherited-limit-check']]:
 p=subprocess.run(args,capture_output=True,text=True,timeout=60);out.append(dict(argv=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0,out
module=pathlib.Path('/home/user/maelstrom-errno-api-canonical-native-oct25/ops/errno-latch.wasm');assert module.stat().st_size==1882300;assert hashlib.sha256(module.read_bytes()).hexdigest()=='a77709fb784a21e6775771450f54b709373f0cc8ad2d4878012c949eaae88f69'
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;assert mem>=2684354560
print(json.dumps(dict(controls=out,moduleVerified=True,remoteRAM=mem,freeDisk=shutil.disk_usage('/tmp').free,deltaBytes=sum(max(p.lstat().st_size,p.lstat().st_blocks*512) for p in h.rglob('*') if not p.is_dir()))))
'''.replace('HOME',repr(str(H))).replace('ROWS',repr(rows))
save('remote-ready.json',py(code));admit('before-guest',future=6000000)
print(json.dumps(dict(stagedDeltaOnly=True,checksPassed=True)))
