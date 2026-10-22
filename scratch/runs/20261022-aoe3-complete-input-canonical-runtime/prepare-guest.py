from pathlib import Path
import re,json,hashlib,subprocess,os,difflib
E=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22');D=E/'guest'
assert json.loads((E/'build-result.json').read_text())['exitCode']==0
assert (E/'original-pins-after-build.log').read_text().startswith('PASS 373')
assert not D.exists();D.mkdir()
original=(R/'runtime/test/run.js').read_text()
assert hashlib.sha256(original.encode()).hexdigest()=='1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799'
def relocate(m):
    p=m[2]
    if p.startswith('.'):
        return 'require('+json.dumps(os.path.normpath(str(S/'test'/p)))+')'
    return m[0]
text=re.sub(r'''require\((['"])([^'"]+)\1\)''',relocate,original)
text=text.replace('__dirname',json.dumps(str(S/'test')))
(D/'original-run-relocated.js').write_text(text)
(D/'package.json').write_text('{"type":"commonjs"}\n')
(D/'runner-path-relocation.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),text.splitlines(True),fromfile='retained-original-run.js',tofile='original-run-relocated.js')))
subprocess.run(['node','--check',str(D/'original-run-relocated.js')],check=True)
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
js=r'''const fs=require('fs'),M=require('module'),f=process.argv[1],q=M.createRequire(f),t=fs.readFileSync(f,'utf8');let rows=[];for(const m of t.matchAll(/require\(['"]([^'"]+)['"]\)/g)){try{rows.push({request:m[1],resolved:q.resolve(m[1])});}catch(e){if(m[1]!=='skia-canvas')throw e;rows.push({request:m[1],optionalUnavailable:true,route:'decodeMountedImage not requested by explicit original --exe'});}}console.log(JSON.stringify(rows,null,2));'''
p=subprocess.run(['node','-e',js,str(D/'original-run-relocated.js')],cwd=S,env=env,text=True,capture_output=True);assert p.returncode==0,p.stderr
(D/'dependency-resolution.json').write_text(p.stdout)
rows=json.loads((R/'runner-manifest.json').read_text())
for row in rows:
    f=R/row['path'];assert f.stat().st_size==row['size'] and hashlib.sha256(f.read_bytes()).hexdigest()==row['sha256']
module=S/'build/wine-assembly.wasm'
assert hashlib.sha256(module.read_bytes()).hexdigest()=='6ac6b43475d9217ffffa98aaec3f57243de47c78c0647dcd31abef404e008678'
seals={str(p):dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [R/'runtime/test/run.js',R/'runtime/build/wine-assembly.wasm',R/'runtime-pins.json',R/'installed-audit/installed-manifest.json',R/'runner-manifest.json',D/'original-run-relocated.js',S/'lib/host-imports.js',module,Path('/usr/local/bin/node'),R/'installed/System:System/msxml4.dll',R/'installed/System:System/msxml4r.dll',R/'installed/Age of Empires III/age3.exe']}
(D/'identities-before.json').write_text(json.dumps(seals,indent=2)+'\n')
print('Retained original runner relocated by path only; canonical module unchanged; direct dependency resolution and runner manifest PASS. No guest started.')
