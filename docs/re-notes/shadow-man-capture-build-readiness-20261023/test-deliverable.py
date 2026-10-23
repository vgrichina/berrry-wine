import subprocess,json,pathlib,os,ast
H=pathlib.Path(__file__).resolve().parent
ROOT=H.parents[2]
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
cases=[('missing-input',['python3',str(H/'readiness.py'),'--control-missing','src/main.watx'],3,'masked required input src/main.watx'),('shell-prefix-syntax',['bash','-n',str(H/'canonical-precompile.sh')],0,''),('guard-syntax',['node','--check',str(H/'no-compile.cjs')],0,''),('future-qualifier-syntax',['node','--check',str(H/'qualify-after-admission.cjs')],0,'')]
for name,code,needle in [
 ('canonical-deny',"require('/home/user/wine-assembly/tools/build-compile-wat.js')",'canonical entrypoint'),
 ('native-module-deny','new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]))','WebAssembly.Module'),
 ('native-compile-deny','WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0]))','WebAssembly.compile'),
 ('large-arena-deny','new WebAssembly.Memory({initial:8192,maximum:8192,shared:true})','memory above fixed 8MiB')]:
 cases.append((name,['node','--require',str(H/'no-compile.cjs'),'-e',code],1,'readiness forbids compilation: '+needle))
records=[]
for name,argv,want,needle in cases:
 p=subprocess.run(argv,env=env,cwd=ROOT,capture_output=True,text=True,timeout=30)
 (H/(name+'.log')).write_text(p.stdout+p.stderr)
 passed=p.returncode==want and needle in p.stdout+p.stderr
 records.append(dict(name=name,argv=argv,cwd=str(ROOT),env={'GIT_NO_LAZY_FETCH':'1'},exit=p.returncode,expected=want,timeoutSeconds=30,requiredOutput=needle,pass_=passed))
 if not passed:raise SystemExit(json.dumps(records[-1]))
for f in ['readiness.py','inspect-inputs.py','test-deliverable.py']:ast.parse((H/f).read_text())
(H/'checks.json').write_text(json.dumps(dict(verdict='PASS',records=records,pythonSyntax='AST parse, no py_compile outputs',primaryReadiness=dict(argv=['python3','docs/re-notes/shadow-man-capture-build-readiness-20261023/readiness.py'],cwd=str(ROOT),exit=2,log='readiness.log',verdict='admission BLOCKED; no gates executed')),indent=2)+'\n')
print('PASS: missing-input, canonical/native/memory rejection, syntax; no compilation or arena allocated')
