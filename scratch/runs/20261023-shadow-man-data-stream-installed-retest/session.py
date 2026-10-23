"""Reuse accepted controls; refreshed complete data/identity gate then one session."""
import pathlib,json,hashlib,sys
E=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(E));import transport as t
D=pathlib.Path('/home/user/wine-assembly-shadow-man-mutable-owner-installed-runtime-oct22/scratch/runs/20261022-shadow-man-mutable-owner-installed-runtime')
for x in json.loads((E/'accepted-controls.json').read_text()):assert hashlib.sha256(pathlib.Path(x['path']).read_bytes()).hexdigest()==x['sha256']
assert json.loads((E/'data-gate-api.json').read_text())['exitCode']==0
gate="""import pathlib,json,os,hashlib,socket,datetime
R=pathlib.Path('/home/user/shadow-man-streamed-installed-runtime-oct22');F=R/'fixed';I=R/'immutable';M=R/'mutable';RT=I/'runtime'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
g=json.loads((F/'owner-preguest-gate.json').read_text());assert g['passAll']
assert not (F/'stream-preguest-gate.json').exists()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,23,0,18,tzinfo=datetime.timezone.utc)
for name,h in [('compile-guard.cjs','e24db898241dc2fe0b91dd99cefb69bca4ece15a00ace7717f74dffc31db5ed8'),('game-observer.cjs','b4d7b9ce72801ae7626e255c07a57e947cc2f6fc97648817076eab1d4dd861c3'),('watchdog.py','01c38d3a5cc61bb7e09760966e82c702b7ac2d6ee075c0b3cb453511c94ee875')]:assert sha(F/name)==h
for name in ['owner-forwarding-fixture.cjs.json','owner-guard-fixture.cjs.json','owner-dependency-preflight.cjs.json','owner-canonical-consumption-fixture.json']:assert json.loads((F/name).read_text())['exit']==0
for x in json.loads((I/'receipts/runtime-manifest.json').read_text()):assert sha(RT/x['path'])==x['sha256']
for x in json.loads((I/'receipts/codec-pins.json').read_text())['files']:assert sha(RT/x['path'].removeprefix('runner/'))==x['sha256']
files=0
for p in (I/'restored/parent-vfs').rglob('*'):
 if p.is_file():assert sha(p)==sha(M/'vfs'/p.relative_to(I/'restored/parent-vfs'));files+=1
assert files==2045
assert sha(M/'registry.json')==sha(I/'restored/parent-registry.json')=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
assert sha(RT/'build/wine-assembly.wasm')==g['moduleSHA256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
assert all(not p.is_symlink() and not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
assert not (M/'output/stop-request.json').exists()
ports=[]
for i in range(2):
 with socket.socket() as s:s.bind(('127.0.0.1',0));ports.append(s.getsockname()[1])
assert ports[0]!=ports[1]
g['command']=[('--control='+str(ports[0])) if x.startswith('--control=') else x for x in g['command']]
g['portsFreeAtGate']=ports
st=os.statvfs(M);assert st.f_blocks*st.f_frsize==939524096 and (st.f_blocks-st.f_bfree)*st.f_frsize+3*177682979+83886080<939524096
assert alloc(F)+16777216<100663296 and alloc(I)<2147483648 and os.statvfs(R).f_bavail*os.statvfs(R).f_frsize>2147483648
g.update(dataGate='27 files 692498 bytes independently rehashed before this gate',cloneFiles=files,completeNonJSClosure=True,originalRegistryPreserved=True,acceptedControlsUnchanged=True)
(F/'stream-preguest-gate.json').write_text(json.dumps(g,indent=2)+'\\n');print(json.dumps(g))
"""
t.run(gate,'complete-gate-api.json');print('COMPLETE GATE PASS',flush=True)
# Reuse the accepted supervision algorithm and unchanged external watchdog;
# use new receipt names so the prior attempt remains intact.
launch=(D/'launch_once.py').read_text().replace('owner-','stream-')
(E/'session-command.py').write_text(launch)
assert len(launch.encode())<16384
r=t.run(launch,'session-api.json',timeout=100)
print(r['stdout'],flush=True)
