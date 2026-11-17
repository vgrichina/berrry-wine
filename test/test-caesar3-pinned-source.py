#!/usr/bin/env python3
"""Pinned Git host survives moving HEAD; real sealed-loader substitution fails."""
import fcntl, hashlib, importlib.util, json, os, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('adapter',ROOT/'tools/caesar3-current-native.py')
A=importlib.util.module_from_spec(spec);spec.loader.exec_module(A)
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True)
A.RUN=out
os.environ['CAESAR3_PINNED_REVISION']='c993e385cf5be638ffec7594da6ebb392aa1ea22'
os.environ['CAESAR3_COMPONENT_REVISION']='c268de57'
real=A.published_module
captured={}
def published(name,revision):
 m=real(name,revision)
 if name=='tools/vb5cce-original-runtime.py':
  def run():captured.update(m.sources())
  m.run=run
 return m
A.published_module=published
sys.argv=['test','--working-qualification']
A.run()
files=captured
for p in (ROOT/'node_modules/pngjs').rglob('*'):
 if p.is_file() and p.suffix in ('.js','.json'):files[str(p.relative_to(ROOT))]=p.read_bytes()
assert files['lib/host-imports.js']==A.git('show','d1120f026:lib/host-imports.js')
assert files['lib/host-imports.js']!=(ROOT/'lib/host-imports.js').read_bytes()
assert A.component_revision('unused')==A.git('rev-parse','c268de57').decode().strip()
module=A.sha((A.REPAIR_PROOF/'module.wasm').read_bytes())
sourcehash={n:A.sha(b) for n,b in files.items()}
A.verify_components(A.REPAIR_PROOF,sourcehash,module)
for name in ('lib/host-imports.js','lib/region-map.generated.js','host.js','tools/disciples2-current-native-source-view.cjs'):
 changed=dict(sourcehash);changed[name]='0'*64
 try:A.verify_components(A.REPAIR_PROOF,changed,module)
 except AssertionError:pass
 else:raise AssertionError('source substitution accepted: '+name)
route=json.loads((ROOT/'scratch/runs/20261117-caesar3-current-city-food-building-progress/owner-native/proof.json').read_text())
A.verify_owner_adapter(route)
S=real('tools/disciples2-current-supervisor.py','c993e385c')
pool,index,rows=S.indexed_sources(files)
preload=files['tools/disciples2-current-native-source-view.cjs']
def sealed(body):
 fd=os.memfd_create('caesar-pinned-fixture',os.MFD_ALLOW_SEALING);os.write(fd,body)
 fcntl.fcntl(fd,fcntl.F_ADD_SEALS,15);return fd
pre=sealed(preload)
results=[]
for negative in (False,True):
 body=bytearray(pool)
 if negative:
  inventory=json.loads(index)
  row=next(r for r in inventory['files'] if r['path']=='lib/host-imports.js')
  body[4+len(index)+row['offset']]^=1
 fd=sealed(body)
 env=dict(os.environ,DISCIPLES2_ROOT=str(ROOT),DISCIPLES2_PHASE='compile',DISCIPLES2_SOURCE_FD=f'/proc/self/fd/{fd}',DISCIPLES2_SOURCE_INDEX_SHA256=A.sha(index))
 code="const assert=require('assert');const fs=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(fs.readFileSync('lib/host-imports.js')).digest('hex'));console.log(c.createHash('sha256').update(fs.readFileSync('lib/region-map.generated.js')).digest('hex'));"
 code+="assert.deepStrictEqual(fs.readdirSync('src'),"+json.dumps(sorted(pathlib.Path(n).name for n in files if pathlib.Path(n).parent==pathlib.Path('src')))+");assert(!fs.existsSync('src/09a7j-typelib.wat'));"
 p=subprocess.run(['node','--preserve-symlinks','--require',f'/proc/self/fd/{pre}','-e',code],env=env,cwd=ROOT,pass_fds=(pre,fd),capture_output=True)
 (out/('negative' if negative else 'positive')).write_text(p.stdout.decode()+p.stderr.decode())
 if negative:assert p.returncode!=0 and b'sealed source digest differs: lib/host-imports.js' in p.stderr
 else:assert p.returncode==0 and p.stdout.decode().splitlines()==[sourcehash['lib/host-imports.js'],sourcehash['lib/region-map.generated.js']]
 results.append(dict(negative=negative,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=p.stdout.decode(),stderr=p.stderr.decode()))
 os.close(fd)
os.close(pre)
(out/'proof.json').write_text(json.dumps(dict(passed=True,selectedBase=os.environ['CAESAR3_PINNED_REVISION'],component=A.component_revision('unused'),localHEAD=A.git('rev-parse','HEAD').decode().strip(),hostSHA256=sourcehash['lib/host-imports.js'],mapSHA256=sourcehash['lib/region-map.generated.js'],moduleSHA256=module,componentProofReused=True,ownerBodiesExact=True,substitutionRefused=True,loader=results),indent=2))
print('PASS explicit published pin independent of local HEAD/shared host; exact graph/module/map; sealed host substitution refused; unchanged owner/input bodies')
