"""Bounded read-only evidence retrieval and final assigned-box handback."""
import pathlib,json,sys,base64
E=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(E));import transport as t
code="""import pathlib,json,hashlib,os
R=pathlib.Path('/home/user/shadow-man-streamed-installed-runtime-oct22');F=R/'fixed';I=R/'immutable';M=R/'mutable'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
r=json.loads((F/'data-stream-preparation.json').read_text())
for p,h in r['before'].items():assert sha(I/p)==h,p
assert all(not p.stat().st_mode&0o222 for p in [I,*I.rglob('*')])
clone=0
for p in (I/'restored/parent-vfs').rglob('*'):
 if p.is_file():assert sha(p)==sha(M/'vfs'/p.relative_to(I/'restored/parent-vfs'));clone+=1
assert sha(M/'registry.json')==sha(I/'restored/parent-registry.json')=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
nodes=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes().split(b'\\0')
  if cmd and cmd[0].split(b'/')[-1]==b'node':nodes.append(dict(pid=int(p.name),argv=[x.decode(errors='replace') for x in cmd if x]))
 except OSError:pass
st=os.statvfs(M)
result=dict(passAll=True,preexistingImmutableFilesRehashed=len(r['before']),immutableReadOnly=True,mutableCloneFilesRehashed=clone,registrySHA256=sha(M/'registry.json'),moduleSHA256=sha(I/'runtime/build/wine-assembly.wasm'),immutableAllocated=alloc(I),fixedAllocated=alloc(F),tmpfsUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,tmpfsCap=st.f_blocks*st.f_frsize,mutableUid=M.stat().st_uid,mutableGid=M.stat().st_gid,mutableMode=oct(M.stat().st_mode&0o777),freeBytes=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize,nodeProcesses=nodes,ownedGroups=json.loads((F/'stream-watchdog.json').read_text())['remaining'],outputFiles=[dict(name=p.name,bytes=p.stat().st_size) for p in (M/'output').iterdir() if p.is_file()])
print(json.dumps(result))
"""
r=t.run(code,'handback-api.json');t.save('handback.json',json.loads(r['stdout']))
for name in ['stream-session.log','stream-session-result.json','stream-watchdog.json','stream-operator-stop.json','stream-attempt.json','stream-preguest-gate.json','module-consumption.jsonl']:
 r=t.run("import pathlib,json;p=pathlib.Path("+repr(t.ROOT+'/fixed/'+name)+");assert p.stat().st_size<262144;print(json.dumps(p.read_text()))",'read-'+name.replace('.','-')+'-api.json')
 (E/name).write_text(json.loads(r['stdout']))
# Only the new owned process log; old attempt evidence is preserved remotely.
pid=json.loads((E/'stream-session-result.json').read_text())['pgid']
r=t.run("import pathlib,json;p=pathlib.Path("+repr(t.ROOT+'/mutable/output/parent-'+str(pid)+'.jsonl')+");assert p.stat().st_size<262144;print(json.dumps(p.read_text()))",'observer-api.json');(E/'observer.jsonl').write_text(json.loads(r['stdout']))
t.save('box-final.json',t.api('sandboxes/'+t.BOX))
print(json.dumps(json.loads((E/'handback.json').read_text())))
