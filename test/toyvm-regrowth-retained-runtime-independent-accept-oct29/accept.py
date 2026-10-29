"""Offline acceptance of retained actual runtime, plus isolated source fragments.

Never imports or invokes a production backend, supervisor, CLI, fixture or Boat.
Fragment probes exercise only the exact SETATTR growth statements with an
instrumented resize stub; they are not a backend or syscall replay.
"""
import ast,base64,copy,hashlib,json,pathlib,textwrap
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[1]
I=HERE/'inputs'
def load(p):return json.loads(p.read_text())
def pin(data,p):
 assert len(data)==p['bytes'] and hashlib.sha256(data).hexdigest()==p['sha256'],'pin mismatch'
def derive():
 size=written=0;phases=[]
 for name,target in [('create-A',0),('grow8192',8192),('shrink0',0),('regrow8192',8192),('reject8193-before-resize',8193)]:
  growth=max(0,target-size);rejected=written+growth>16384
  if not rejected:size=target;written+=growth
  phases.append(dict(phase=name,rootMetadata=4096,AMetadata=4096,APayload=((size+4095)//4096)*4096,live=8192+((size+4095)//4096)*4096,written=written,size=size,rejected=rejected))
 return dict(phases=phases,postReap=dict(live=16384,peak=16384,written=16384,inodes=2,openHandles=0),observation='post-reap linked A; phase values are source inference, not instantaneous samples',directSyscallTrace=False,errnoObserved=False)
def fragment(source):
 tree=ast.parse(source);cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Backend')
 handle=next(n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name=='handle')
 op4=next(n for n in handle.body if isinstance(n,ast.If) and ast.unparse(n.test)=='op == 4')
 growth=op4.body[1]
 assert ast.unparse(growth.test)=='valid & 8'
 return '\n'.join(ast.get_source_segment(source,n) for n in growth.body)
def probe(code):
 # Resize stub records any premature mutation; no FUSE or production execution.
 class Stub:
  def __init__(self):self.nodes={2:{'data':bytearray()}};self.written=0;self.write_limit=16384;self.mutations=0
  def reject(self,reason):raise ValueError(reason)
  def resize(self,ino,size):self.nodes[ino]['data']=bytearray(size);self.mutations+=1
 s=Stub();states=[]
 for target in [8192,0,8192,8193]:
  before=(len(s.nodes[2]['data']),s.written,s.mutations)
  rejected=False
  try:exec(code,{'self':s,'ino':2,'data':target.to_bytes(8,'little'),'unpack':lambda fmt,data,offset:(int.from_bytes(data,'little'),)})
  except ValueError as e:assert str(e)=='filesystem cumulative write limit';rejected=True
  if target==8193:assert rejected and before==(len(s.nodes[2]['data']),s.written,s.mutations),'over-budget mutation or acceptance'
  else:assert not rejected
  states.append((len(s.nodes[2]['data']),s.written))
 assert states==[(8192,8192),(0,8192),(8192,16384),(8192,16384)],states
def fixture_check(f):
 tree=ast.parse(f);calls=[n for n in ast.walk(tree) if isinstance(n,ast.Call) and ast.unparse(n.func)=='os.ftruncate']
 assert [ast.literal_eval(n.args[1]) for n in sorted(calls,key=lambda n:n.lineno)]==[8192,0,8192,8193]
 assert f.count("assert os.fstat(fd).st_size==8192 and os.pread(fd,1,8191)==b'\\0'")==2,'missing zero-filled proof'
 assert 'assert os.fstat(fd).st_size==0' in f and 'finally:os.close(fd)' in f
 marker=f.index("print(json.dumps(dict(checkpoint='before-regrowth-over-budget'")
 assert f.rindex('os.ftruncate(fd,8192)')<marker<f.index('os.ftruncate(fd,8193)')
def runtime_check(r,f,oracle,pins):
 fixture_check(f)
 assert r['candidate']=='5a88ca099b962e946160afd2d4d71a950bf46db3' and r['productionInvocations']==1
 assert r['pins']==pins and r['sourceAfter']=={k:v['sha256'] for k,v in pins.items()}
 assert r['argv'][-1]==f and r['fixtureSHA256']==hashlib.sha256(f.encode()).hexdigest()
 assert r['argv'][:3]==['/usr/bin/python3','-B','/tmp/tvfg/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py']
 for flag,value in [('--live-limit','32768'),('--write-limit','16384'),('--file-limit','16384')]:assert r['argv'][r['argv'].index(flag)+1]==value
 assert json.loads(r['cliStdout'])==r['report']
 rep=r['report'];br=rep['backendReceipt'];fs=br['filesystem']
 assert r['cliExit']==1 and rep['accepted'] is False and rep['accountingAccepted'] is False and rep['childSucceeded'] is False
 assert br['stopReason']==fs['failure']=='filesystem cumulative write limit'
 assert all(fs[k]==v for k,v in oracle['postReap'].items())
 assert oracle['observation']=='post-reap linked A; phase values are source inference, not instantaneous samples'
 assert 'filesystemFinal' not in rep and 'filesystemFinal' not in br
 payload=base64.b64decode(br['output']['data'],validate=True).decode()
 assert br['output']['encoding']=='base64' and payload==r['fixtureOutput']
 assert json.loads(payload)==dict(checkpoint='before-regrowth-over-budget',successfulGrowthBytes=16384,fileSize=8192,attemptedSize=8193)
 assert r['safetyCleanup'] is None and not r['remainingMounts']
 assert rep['cleanupComplete'] is True and br['cleanupComplete'] is True
 assert br['filesystemCleanup']['unmountExit']==0 and not br['filesystemCleanup']['remainingMounts']
 assert r['observedIdentities'] and all(x['absentOrReused'] and x['finalState'] is None for x in r['observedIdentities'])
 owned={(x['pid'],x['start']) for x in r['observedIdentities']};assert {tuple(x) for x in br['owned']}<=owned and br['owned']
 assert r['productionOwnedIdentityCheck'] is True
 assert set(r['executablePins'])=={'/usr/bin/python3','/usr/bin/fusermount3'}
 for v in r['executablePins'].values():assert len(v['sha256'])==64 and v['bytes']>0 and v['realpath'].startswith('/usr/bin/')
 assert rep['browserAllowanceRemaining']==dict(captures=1,cpuSeconds=35.353183,wallSeconds=101.495550694) and rep['browserAllowed'] is False
def main():
 for rel,p in load(HERE/'input-pins.json').items():pin((I/rel).read_bytes(),p)
 manifest=load(I/'canonical/artifact-manifest.json')
 for rel,p in manifest.items():pin((I/'canonical'/rel).read_bytes(),p)
 d=load(I/'dispatch.json');pins=d['sourcePins']
 for rel,p in pins.items():pin((REPO/rel).read_bytes(),p)
 source=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
 oracle=derive() # Derived before reading the prior phase inference or runtime.
 assert oracle['phases']==load(I/'canonical/evidence/source-review.json')['phases']
 code=fragment(source);probe(code)
 assert "self.charge(((size+4095)//4096-(old+4095)//4096)*4096)" in source
 assert "if size>old:n['data'].extend(b'\\0'*(size-old))" in source
 assert "else:del n['data'][size:]" in source
 adapter=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py').read_text()
 assert adapter.index('result=m.supervise(')<adapter.index('final=snapshot()')<adapter.index("result['filesystem']=final")<adapter.index("q=subprocess.run(")
 r=load(I/'canonical/evidence/runtime-result.json');f=(I/'canonical/fixture.py').read_text();runtime_check(r,f,oracle,pins)
 prelaunch=load(I/'canonical/evidence/remote-prelaunch.json')
 assert prelaunch['pins']==pins and prelaunch['argv']==r['argv'] and prelaunch['executablePins']==r['executablePins']
 api=load(I/'canonical/evidence/production-api-summary.json')
 assert api['success'] is True and api['exitCode']==0 and not any(api[k] for k in ['launcherFailed','oomKilled','timedOut','stdoutTruncated','stderrTruncated'])
 launch=load(I/'canonical/evidence/launch-configuration.json')
 assert launch['mountArgv']==[] and launch['intendedMountFiles']==[] # No filename-bearing guest mount in this task.
 receipt=load(I/'canonicalReceipt.json');assert receipt['filesystem']==r['report']['backendReceipt']['filesystem'] and receipt['postReapObserved'] is True
 stop=load(I/'verifiedStopReceipt.json');assert stop['id']=='bx_t32cdxka' and stop['state']=='stopped' and stop['stop']['status']=='completed' and stop['snapshotVerifiedAt']=='2026-10-29T05:03:38.096Z'
 checks=[]
 def reject(name,fn):
  try:fn()
  except (AssertionError,ValueError,KeyError):checks.append({'case':name,'rejected':True})
  else:raise AssertionError('surviving adversary: '+name)
 reject('shrink-refund',lambda:probe(code.replace('max(0,size-len(self.nodes[ino][\'data\']))','size-len(self.nodes[ino][\'data\'])')))
 lines=code.splitlines();guard=next(x for x in lines if 'self.written+growth>' in x);after='\n'.join([x for x in lines if x!=guard]+[guard])
 reject('guard-after-resize',lambda:probe(after))
 reject('guard-removed',lambda:probe('\n'.join(x for x in lines if x!=guard)))
 def altered(change):
  x=copy.deepcopy(r);change(x);x['cliStdout']=json.dumps(x['report']);runtime_check(x,f,oracle,pins)
 reject('accepted-growth-forged-reason',lambda:altered(lambda x:x['report'].update(accepted=True)))
 def remove_checkpoint(x):
  x['fixtureOutput']='{}';x['report']['backendReceipt']['output']['data']=base64.b64encode(b'{}').decode()
 reject('missing-regrowth-checkpoint',lambda:altered(remove_checkpoint))
 reject('missing-zero-fill-proof',lambda:fixture_check(f.replace(" and os.pread(fd,1,8191)==b'\\0'",'')))
 reject('pin-mismatch',lambda:pin(b'mutated',next(iter(pins.values()))))
 reject('wrong-reason',lambda:altered(lambda x:x['report']['backendReceipt'].update(stopReason='filesystem allocation limit')))
 reject('omitted-cleanup',lambda:altered(lambda x:x['report']['backendReceipt'].pop('cleanupComplete')))
 bad=copy.deepcopy(oracle);bad['observation']='instantaneous phase sample'
 reject('postreap-mislabeled-instantaneous',lambda:runtime_check(r,f,bad,pins))
 out=dict(outcome='SCOPED_ACCEPT',candidate=d['candidate'],oracle=oracle,adversarialChecks=checks,sourceFragmentScope='exact SETATTR growth statements, instrumented resize stub; no backend replay',actualRuntime='retained canonical one-invocation CLI/FUSE evidence; no new execution',sourceUnchanged=True,postReapObservation=True,directSyscallTrace=False,errnoObserved=False,box={'id':stop['id'],'state':stop['state'],'shutdownOwner':'coordinator'},remainingGate='No browser/gameplay/general resource qualification; direct syscall trace and errno unobserved; historical startup wrapper failure retained.')
 (HERE/'result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'outcome':out['outcome'],'adversarialChecks':len(checks)}))
if __name__=='__main__':main()
