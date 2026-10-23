import pathlib,json,hashlib,os,socket,subprocess,time
R=pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23'); F=R/'fixed/retest-oct23'; O=R/'mutable/output/retest-oct23'; M=R/'mutable'; I=R/'immutable'
assert os.getuid()==1000
assert not F.exists() and not O.exists()
nodes=subprocess.run(['pgrep','-a','node'],capture_output=True,text=True);assert nodes.returncode==1,nodes.stdout
old=json.loads((R/'fixed/preguest-gate.json').read_text());assert old['passAll'] and old['canonicalInputConsumed']
seals={}
for rel,expected in json.loads(SEALS_JSON)['final']['seals'].items():
 p=I/rel;b=p.read_bytes();h=hashlib.sha256(b).hexdigest();assert h==expected['sha256'] and len(b)==expected['bytes'];seals[rel]=dict(bytes=len(b),sha256=h)
assert (M/'registry.json').read_bytes()==(I/'restored/parent-registry.json').read_bytes()
for n in ['d3dconfigutility.exe','mss32.dll','dsetup.dll']:
 p=M/'vfs/program files/acclaim entertainment/shadowman'/n
 assert hashlib.sha256(p.read_bytes()).hexdigest()==old['nativeSHA256'][n]
assert all(not (p.stat().st_mode&0o222) for p in I.rglob('*'))
def allocated(p):return int(subprocess.check_output(['du','-s','-B1',str(p)]).split()[0])
st=os.statvfs(M);free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
allocation=dict(immutable=allocated(I),fixed=allocated(R/'fixed'),tmpfsUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,tmpfsCap=st.f_blocks*st.f_frsize,freeBytes=free)
assert allocation['immutable']<=2*1024**3 and allocation['fixed']<96*1024**2 and free>=2*1024**3
assert allocation['tmpfsCap']==896*1024**2
assert allocation['tmpfsUsed']+3*183566336+50282496+67108864 < allocation['tmpfsCap']
assert allocation['tmpfsCap']+96*1024**2+32*1024**2==1024**3
probe=M/'output/retest-writeprobe';fd=os.open(probe,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.write(fd,b'ordinary uid1000');os.fsync(fd);os.close(fd);probe.unlink()
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
F.mkdir();O.mkdir()
g=dict(old);g['controlPort']=port
g['command']=[x.replace('/fixed/compile-guard.cjs','/fixed/retest-oct23/compile-guard.cjs').replace('/fixed/game-observer.cjs','/fixed/retest-oct23/game-observer.cjs').replace('/output/session/','/output/retest-oct23/') if not x.startswith('--control=') else '--control='+str(port) for x in old['command']]
guard=(R/'fixed/compile-guard.cjs').read_text().replace('/fixed/module-consumption.jsonl','/fixed/retest-oct23/module-consumption.jsonl')
observer=(R/'fixed/game-observer.cjs').read_text().replace('/fixed/compile-guard.cjs','/fixed/retest-oct23/compile-guard.cjs').replace("mutable/output';","mutable/output/retest-oct23';")
(F/'compile-guard.cjs').write_text(guard);(F/'game-observer.cjs').write_text(observer)
launch=(R/'fixed/launch_once.py').read_text()
launch=launch.replace("F=R/'fixed'","F=R/'fixed/retest-oct23'").replace("sys.path.insert(0,str(F))","sys.path.insert(0,str(R/'fixed'))").replace('preguest-gate.json','gate.json').replace('2026,10,23,1,22','2026,10,23,1,24').replace('output/session/','output/retest-oct23/').replace('output/stop-request.json','output/retest-oct23/stop-request.json')
(F/'launch_once.py').write_text(launch);(F/'gate.json').write_text(json.dumps(g,indent=2))
print(json.dumps(dict(passAll=True,uid=os.getuid(),writeProbe=True,noNode=True,seals=seals,allocation=allocation,port=port,command=g['command'],cloneReused=True,registryCloneUnchanged=True)))
