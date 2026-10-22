import pathlib,subprocess,json,os,time
r=pathlib.Path('/home/user/aoe3-oleaut-repair-oct22');e=r/'evidence';files=['lib/host-imports.js','src/01-header.wat']; saved={p:(r/p).read_bytes() for p in files}
try:
 for p in files:(r/p).write_bytes((r/'baseline-inputs'/p).read_bytes())
 start=time.time();p=subprocess.run(['node','test/test-getprocaddress-sparse-name.js'],cwd=r,env=dict(os.environ,NODE_PATH='/home/user/aoe3-original-oct22/runner/node_modules'),capture_output=True,text=True,timeout=240)
 (e/'baseline-sparse-regression.log').write_text(p.stdout+'\n'+p.stderr);(e/'baseline-sparse-result.json').write_text(json.dumps(dict(exit=p.returncode,seconds=time.time()-start,command=['node','test/test-getprocaddress-sparse-name.js']),indent=2));print(p.stdout,p.stderr)
 assert p.returncode==1 and 'real named export resolves' in p.stderr and '0 !== 2105344' in p.stderr
finally:
 for path in files:(r/path).write_bytes(saved[path])
print('PASS identical pre-existing baseline sparse GetProcAddress failure; no canonical build attempted')
