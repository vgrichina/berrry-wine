import copy,importlib.util,json,os,pathlib,sys,time,uuid
O=pathlib.Path(__file__).parent;R=O.parent/'repo'
s=importlib.util.spec_from_file_location('k',R/'test/helpers/cgroup-cpu-evidence-oct27.py');k=importlib.util.module_from_spec(s);s.loader.exec_module(k)
if len(sys.argv)>1 and sys.argv[1]=='escape-child':
 g=pathlib.Path(sys.argv[2]);assert k.identity(g)==json.loads(sys.argv[3])
 # Only this fresh fixture process moves; destination is a newly owned empty sibling.
 (g/'cgroup.procs').write_text(str(os.getpid()))
 assert k.membership('self')=='/'+str(g.relative_to('/sys/fs/cgroup'))
 start=time.process_time()
 while time.process_time()-start<.25:pass
 print('ESCAPEDCPU',time.process_time()-start,flush=True);sys.exit(0)
def empty_remove(g,identity):
 assert k.identity(g)==identity and k.counters((g/'cgroup.events').read_text(),('populated',))['populated']==0
 assert not (g/'cgroup.procs').read_text().strip()
 final=(g/'cpu.stat').read_text();g.rmdir();assert not g.exists();return final
rows=[]
parent=k.scope();controls=(parent/'cgroup.subtree_control').read_text()
g=parent/('independent-escape-'+uuid.uuid4().hex);g.mkdir();gid=k.identity(g)
try:
 assert not (g/'cgroup.procs').read_text().strip()
 r=k.measure([sys.executable,'-S',str(pathlib.Path(__file__).resolve()),'escape-child',str(g),json.dumps(gid)],O/'escape.kernel.json')
 lost=float(next(l.split()[1] for l in r['supervisor']['result']['output'].splitlines() if l.startswith('ESCAPEDCPU ')))
 assert lost>=.25 and r['diagnostic']['status']=='finalized-kernel-boundary' and r['diagnostic']['invocationCompleteness']=='UNKNOWN'
 outside=k.counters((g/'cpu.stat').read_text())['usage_usec']/1e6
 assert outside>=lost-.01
 assert r['outerWait4CPUSeconds']-r['diagnostic']['kernelCPUSeconds']>.20
 rows.append(dict(case='cooperative escape',kernel=r['diagnostic'],outsideOwnedSiblingCPU=outside,outerWait4=r['outerWait4CPUSeconds'],measuredBurn=lost,sibling=str(g),removed=True))
finally:empty_remove(g,gid)
# Fail attachment without fixture execution. Only freshly created children/groups are used.
for mode in ('denied-migration','wrong-owned-group'):
 g=parent/('independent-barrier-'+uuid.uuid4().hex);g.mkdir();gid=k.identity(g)
 original=pathlib.Path.write_text;ev=O/(mode+'.kernel.json');marker=O/(mode+'.UNEXPECTED-EXEC')
 def write(p,data,*a,**kw):
  if p.name=='cgroup.procs' and p.parent.name.startswith('airstrike-cpu-oct27-'):
   if mode=='denied-migration':raise PermissionError('independent injected attachment failure')
   return original(g/'cgroup.procs',data,*a,**kw)
  return original(p,data,*a,**kw)
 pathlib.Path.write_text=write
 try:
  try:k.measure([sys.executable,'-S','-c',f'open({str(marker)!r},"w").write("executed")'],ev)
  except (PermissionError,AssertionError) as e:failure=type(e).__name__
  else:raise AssertionError('failed attachment finalized')
 finally:pathlib.Path.write_text=original
 a=json.loads(ev.read_text());pid=a['bootstrap']['pid'];_,status,u=os.wait4(pid,0)
 assert os.waitstatus_to_exitcode(status)==124 and not marker.exists() and 'diagnostic' not in a
 measured=pathlib.Path(a['group']);empty_remove(measured,a['ownership']);empty_remove(g,gid)
 rows.append(dict(case=mode,exception=failure,childExit=124,fixtureExecuted=False,finalized=False,ownedGroupsRemoved=True))
# Path authority is lstat inode+device+uid; a symlink is not an owned cgroup directory.
d=O/'owned-dir';d.mkdir(exist_ok=True);link=O/'owned-symlink';link.symlink_to(d)
try:
 try:k.identity(link)
 except ValueError:pass
 else:raise AssertionError('symlink accepted')
finally:link.unlink();d.rmdir()
controls=[]
for name,mutation in (
 ('changed-inode',lambda a:a.update(ownershipFinal=[a['ownership'][0],a['ownership'][1]+1,a['ownership'][2]])),
 ('nonempty-final',lambda a:a.update(finalEvents={'populated':1})),
 ('cleanup-failed',lambda a:a.update(cleanupRemoved=False)),
 ('counter-duplicate',lambda a:a.update(finalStat='usage_usec 1\nusage_usec 2\nuser_usec 0\nsystem_usec 0\n')),
 ('counter-regression',lambda a:a.update(initialStat='usage_usec 999999999\nuser_usec 0\nsystem_usec 0\n')),
 ('supervisor-missing',lambda a:a.update(supervisorIncluded=False))):
 a=copy.deepcopy(r);mutation(a);v=k.validate(a);assert v['status']=='rejected' and v['kernelCPUSeconds'] is None;controls.append(name)
assert (parent/'cgroup.subtree_control').read_text()==r['parentControlsBefore']
(O/'adversarial-summary.json').write_text(json.dumps(dict(rows=rows,mutationsRejected=controls,symlinkRejected=True,parentControlsUnchanged=True),indent=2)+'\n')
print(json.dumps(dict(cases=len(rows),mutationsRejected=controls,result='PASS bounded group; escape proves invocation UNKNOWN')))
