import pathlib,json,subprocess,os,hashlib,time
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-static-dx-harness-qualification';os.chdir(R);E.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
M=R/'build/wine-assembly.wasm';H='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553';assert sha(M)==H
assert int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0])+67108864+8388608<1073741824
old=subprocess.check_output(['git','show','HEAD:test/test-static-dx-version.js']).decode();(E/'original-test.js').write_text(old)
new=(R/'test/test-static-dx-version.js').read_text();assert new==old.replace('  const wasmBytes = compileSrcWasm();','  const wasmPath = process.env.WA_TEST_WASM;\n  const wasmBytes = wasmPath ? fs.readFileSync(wasmPath) : compileSrcWasm();').replace('  const e = instance.exports;','  const e = instance.exports;\n  // Filesystem imports translate guest buffers through the instance exports.\n  ctx.exports = e;')
(E/'module-identities').mkdir(exist_ok=True);env=dict(os.environ,GIT_NO_LAZY_FETCH='1',WA_TEST_WASM=str(M),WA_TEST_WASM_SHA256=H,NODE_OPTIONS='--require='+str(E/'module-observer.js'),WA_IDENTITY_DIR=str(E/'module-identities'))
rows=[]
variants=[('baseline-missing-context',new.replace('  ctx.exports = e;',''),1,'6 passed, 6 failed'),('corrected',new,0,'12 passed, 0 failed'),('reject-absent-mounted-file',new.replace('  ctx.vfs.files.set(filename.toLowerCase(), {data: buildVersionPe(actual), attrs: 0x20});',''),1,'6 passed, 6 failed')]
for name,src,expected,summary in variants:
 p=R/'test/.static-dx-qualification-control.js';p.write_text(src);before=set((E/'module-identities').glob('*'));start=time.time()
 try:
  q=subprocess.run(['node',str(p)],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=30)
 finally:p.unlink()
 text=q.stdout.decode();(E/(name+'.log')).write_text(text);ids=sorted(set((E/'module-identities').glob('*'))-before);events=[ev for i in ids for ev in json.loads(i.read_text())['events']]
 row=dict(name=name,exit=q.returncode,expectedExit=expected,summary=summary,seconds=time.time()-start,sha256=hashlib.sha256(src.encode()).hexdigest(),identityFiles=[str(i.relative_to(E)) for i in ids],events=events);rows.append(row)
 (E/'causal-proof.json').write_text(json.dumps(dict(rows=rows,canonicalSHA256=H,defaultCompileFallbackUnchanged=True),indent=2)+'\n');print(name,q.returncode,text,flush=True)
 assert q.returncode==expected and summary in text
 assert len(events)==1 and events[0]==dict(op='instantiate',sha256=H),events
assert sha(M)==H
