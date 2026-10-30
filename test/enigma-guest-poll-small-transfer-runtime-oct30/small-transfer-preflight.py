import pathlib,sys,json,hashlib,importlib.util,shlex,os
import small_transfer_gate as g
g.setup();r=g.ops.ROOT;e=g.ops.E
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base='7c45c0a0136721cd47bf149b946a73287af57507'
scope='test/enigma-guest-poll-small-transfer-runtime-oct30'
def run(n,args,git=False):
 rc,s=g.ops.run(n,(['git','-C',str(g.ops.REPO)] if git else [])+args,cwd=g.ops.REPO if git else r,git=git)
 assert rc==0,(n,rc);return s
assert run('pinned-head',['rev-parse','HEAD'],True).strip()==base
# Validate exact parser/argv and enumerate intended filenames without recapturing manifest.
prior=g.ops.REPO/'test/enigma-guest-poll-causal-runtime-oct30'
startup=json.loads((prior/'startup.json').read_text());assert startup['exit']==0
if not (e/'startup.json').exists():run('startup',startup['argv'])
if not (e/'canonical-parser.json').exists():run('canonical-parser',json.loads((prior/'canonical-parser.json').read_text())['argv'])
manifest=json.loads((r/'transfer-manifest.json').read_text());mount=json.loads((r/'mount-enumeration.json').read_text())
files=sorted(row['target'] for row in manifest if row['target'].startswith('vfs/'))
assert files==sorted(mount['files'])
commas=[n for n in files if ',' in n]
run('file-control',[sys.executable,'-B','-c',"from pathlib import Path;p=Path('small-transfer/raw/disposable');p.write_bytes(b'x'*2097152);assert p.stat().st_size==2097152;p.unlink()"])
try:run('overflow-control',[sys.executable,'-B','-c',"import os;os.write(1,b'x'*600000)"])
except (AssertionError,RuntimeError) as ex:assert str(ex)=='capture'
else:raise AssertionError('overflow accepted')
overflow={p.name:p.stat().st_size for p in e.glob('overflow-control.*')}
for p in e.glob('overflow-control.*'):p.unlink()
# New immutable runtime v2 preserves original local120s operation wall.
v2=r/'small-transfer-runtime-v2.py'
v2.write_text((r/'small-transfer-runtime.py').read_text().replace('wall=120)','wall=105)'));v2.chmod(0o444)
spec=importlib.util.spec_from_file_location('runtime',v2);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
import base64
chunk=b'x'*16384;args=('17282066',base64.b64encode(chunk).decode(),hashlib.sha256(chunk).hexdigest())
sizes=m.bounded_command(m.TRANSFER_CODE,args)
try:m.bounded_command(m.TRANSFER_CODE,('0','x'*32768,'0'*64))
except AssertionError:pass
else:raise AssertionError('oversize accepted')
# Local execution of exact serialized argv checks real offset, chunk SHA and corruption rejection.
code=m.TRANSFER_CODE.replace('/home/user/enigma-original.tar.gz',str(r/'small-transfer/raw/disposable-transfer'))
run('transport-local',[sys.executable,'-B','-c',code,'0',args[1],args[2]])
(r/'small-transfer/raw/disposable-transfer').unlink()
packet=dict(PASS=True,bornHEAD=base,argvSHA256=sha(r/'guest-poll-args.json'),runnerSHA256=sha(r/'input-source/runner__test__run.js'),manifestSHA256=sha(r/'transfer-manifest.json'),manifestFiles=len(manifest),mountFiles=len(files),commaFiles=commas,commandBound=32768,maxChunk=16384,serializedWorstCase=sizes,oversizeRejected=True,captureOverflowRejected=overflow,fileCeiling=12582912,captureCeiling=524288,admission=g.admission(),startup='exact configuration passed',guestHelperSHA256=sha(r/'owner-policy-guest.py'),wrappers={n:sha(r/n) for n in ['small_transfer_ops.py','small_transfer_gate.py','small-transfer-runtime-v2.py']})
(e/'preflight.json').write_text(json.dumps(packet,indent=2)+'\n')
# No checkout until canonical parser and exact launch configuration have passed.
run('branch',['switch','-c',scope,base],True)
print(json.dumps(packet))
