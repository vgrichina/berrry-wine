"""Transfer only the generated diagnostic copy, then dry dependency checks."""
import base64, hashlib, json, pathlib
from remote import run, E
D='/home/user/aoe3-original-oct22/diagnostics-targeted-localization-20261022T1058Z'
run('import pathlib; p=pathlib.Path('+repr(D)+'); assert not p.exists(); p.mkdir()','create-diagnostic-directory')
for p in sorted((E/'harness').iterdir()):
    b=p.read_bytes()
    for offset in range(0,len(b),40000):
        chunk=base64.b64encode(b[offset:offset+40000]).decode()
        run('import pathlib,base64; p=pathlib.Path(%r); p.open(%r).write(base64.b64decode(%r))'%(D+'/'+p.name,'wb' if offset==0 else 'ab',chunk),'transfer-'+p.name+'-'+str(offset))
    run('import pathlib,hashlib; p=pathlib.Path(%r); assert hashlib.sha256(p.read_bytes()).hexdigest()==%r; print(p.stat().st_size)'%(D+'/'+p.name,hashlib.sha256(b).hexdigest()),'verify-transfer-'+p.name)
code=r'''
import pathlib,json,subprocess,os
d=pathlib.Path(D)
env=dict(os.environ,NODE_PATH='/home/user/aoe3-original-oct22/runner/node_modules')
for f in ['diagnostic-run.js','observer.js','instance-hook.js']:
 subprocess.run(['node','--check',str(d/f)],env=env,check=True)
js=r"""
const fs=require('fs'),Module=require('module');
const f=process.argv[1],text=fs.readFileSync(f,'utf8');
const req=Module.createRequire(f);
const literals=[...text.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
const result={resolved:[],missing:[],relative:[]};
for(const s of [...new Set(literals)]) {
 if(s.startsWith('.')) result.relative.push(s);
 try {result.resolved.push({request:s,path:req.resolve(s)});}
 catch(e){result.missing.push({request:s,error:String(e.message)});}
}
// Evaluate only declarations and top-level imports, stopping before arg parsing,
// main(), instantiation, emulator memory, or guest startup.
const prefix=text.slice(0,text.indexOf('// Parse args (need these before autoBuild)'));
try {
 const ready=new Function('require',prefix+'\nreturn {rendererLoadError:String(rendererLoadError),renderer:!!Win98Renderer,canvas:!!createCanvas,png:!!PNG};')(req);
 result.topLevelImports=ready;
 if(!ready.renderer||!ready.canvas||!ready.png)throw Error('required capture dependency missing');
 result.pass=true;
}catch(e){result.pass=false;result.topLevelError=String(e.stack);}
if(result.relative.length||result.missing.length)result.pass=false;
console.log(JSON.stringify(result,null,2));
process.exitCode=result.pass?0:2;
"""
p=subprocess.run(['node','-e',js,str(d/'diagnostic-run.js')],env=env,capture_output=True,text=True)
(d/'dependency-check.json').write_text(p.stdout)
print(p.stdout)
print('DEPENDENCY_EXIT',p.returncode)
'''
r=run('D='+repr(D)+'\n'+code,'dependency-check',60)
print(r['stdout'])
