import pathlib,os,json,time,sys,resource
import ops
OUT=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-compact-causal-runtime-owner133-oct30')
M=1048576
POLICY={'memoryFloor':2*1024*M,'diskFloor':3*1024*M,'initialEnvelope':256*M,'budget':64*M,'reserve':8*M,'owner':'owner133 causal Enigma','supplementalForecast':False}
def used(p):return p.lstat().st_blocks*512+sum(x.lstat().st_blocks*512 for x in p.rglob('*'))
def admission():
 if (OUT/'first-denial.json').exists():raise RuntimeError('retained denial; stop')
 st=os.statvfs(ops.ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=used(ops.ROOT)+used(OUT)+used(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-start-game-causal-repair-owner133-oct30'))
 remaining=max(0,POLICY['budget']-allocated) # remaining local transfer/publication/raw-log allocation; remote allocation is separate
 a=dict(at=time.time(),MemAvailable=mem,free=st.f_bavail*st.f_frsize,allocated=allocated,remainingGrowth=remaining,policy=POLICY,parent=ops.BASE)
 a['checks']=dict(memory=mem>=POLICY['memoryFloor'],disk=a['free']-remaining>=POLICY['diskFloor'],allocation=allocated+POLICY['reserve']<=POLICY['budget'])
 a['compactBytes']=sum(p.stat().st_size for p in (OUT/'e').rglob('*') if p.is_file())
 a['imageBytes']=sum(p.stat().st_size for p in (OUT/'images').rglob('*') if p.is_file())
 a['checks']['compact']=a['compactBytes']<=M
 a['checks']['images']=a['imageBytes']<=8*M
 if not all(a['checks'].values()):
  with (OUT/'first-denial.json').open('x') as f:json.dump(a,f,indent=2)
  raise RuntimeError('first denial '+str(a['checks']))
 (OUT/'latest-admission.json').write_text(json.dumps(a,indent=2));return a
def setup():
 ops.BASE=ops.configure_parent();ops.E=OUT/'e';ops.admission=admission
 p=OUT/'admission-policy.json'
 if p.exists():assert json.loads(p.read_text())==POLICY
 else:
  with p.open('x') as f:json.dump(POLICY,f,indent=2)
 controls={}
 for k,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-pinned-log-acceptance-publication-oct29/repo'})]:
  try:ops.run('reject-'+k,['/bin/pwd'],**kw)
  except (TypeError,AssertionError):controls[k]='REJECTED BEFORE SPAWN'
  else:raise AssertionError(k)
 (OUT/'controls.json').write_text(json.dumps(controls,indent=2))
if __name__=='__main__':
 setup();name=sys.argv[1];argv=sys.argv[2:];git=argv[0]=='git'
 if git:argv=['git','-C',str(ops.REPO)]+argv[1:]
 rc,_=ops.run(name,argv,cwd=ops.REPO,git=git,wall=120);sys.exit(rc)
