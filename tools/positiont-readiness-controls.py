#!/usr/bin/env python3
import json, os, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parent.parent
E=ROOT/'docs/re-notes/render-positiont-file-log-bounds-readiness-20261023'
env=dict(os.environ,GIT_NO_LAZY_FETCH='1',NODE_OPTIONS='--max-old-space-size=512',NODE_PATH='/home/user/wine-dashboard-deps-20261014/node_modules')
rows=[]
def run(name,argv,expected,needle=None):
 r=subprocess.run(argv,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=30)
 output=r.stdout.decode();assert len(r.stdout)<8192
 assert r.returncode==expected,(name,r.returncode,output)
 if needle:assert needle in output,(name,output)
 rows.append(dict(name=name,argv=argv,exit=r.returncode,output=output))
for f in ['readiness','resource','guard']:
 run('syntax-'+f,['node','--check','tools/positiont-complete-'+f+'.cjs'],0)
run('exact-inputs',['node','tools/positiont-complete-readiness.cjs','--verify-only'],0,'INPUTS COMPLETE')
manifest={r[0]:r[1] for r in json.loads((E/'manifest.json').read_text())}
for row in json.loads((E/'missing-controls.json').read_text()):
 f=row['masked']; h=manifest[f]
 code="const fs=require('fs'),cp=require('child_process'),old=fs.readFileSync,exec=cp.execFileSync;"+f"const file={json.dumps(f)},hash={json.dumps(h)};"+"fs.readFileSync=function(p,...a){if(typeof p==='string'&&p.endsWith('/'+file))throw Error('MASKED INPUT '+file);return old.call(this,p,...a)};cp.execFileSync=function(p,a,...rest){if(a.includes(hash))throw Error('MASKED INPUT '+file);return exec.call(this,p,a,...rest)};require('./tools/positiont-complete-readiness.cjs')"
 run('actual-missing-'+row['class'],['node','-e',code,'--','--verify-only'],1,'MASKED INPUT '+f)
guard=str(ROOT/'tools/positiont-complete-guard.cjs')
for name,code in {
 'nativeModule':"new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]))",
 'nativeCompile':"WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0]))",
 'guest512MiB':"new WebAssembly.Memory({initial:8192,maximum:8192})",
 'fullCompileEntry':"require('./tools/build-compile-wat.js')",
 'unknownWATX':"require('./tools/watx.js').compile('(func $unknown)')",
 'defaultCompiler':"require('./lib/compile-wat.js').compileWat(()=>'(module)')",
}.items():
 run(name,['node','--require',guard,'-e',code],1,'READINESS:')
run('accounting-overrun',['node','-e',"require('./tools/positiont-complete-resource.cjs').calculate(67108864,0,1,9999999999)"],1,'accounting cap exceeded')
(E/'controls.json').write_text(json.dumps(rows,separators=(',',':'))+'\n')
print(json.dumps({'controls':len(rows),'passed':True,'canonicalInvocations':0}))
