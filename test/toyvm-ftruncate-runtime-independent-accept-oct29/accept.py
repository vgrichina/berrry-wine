"""Offline independent acceptance. Never imports/runs a backend or observer.

Executes only selected production class source fragments in memory: SETATTR
size dispatch, resize and their scalar accounting dependencies. No FUSE, CLI,
process, socket, mount, fixture replay or syscall invocation occurs here.
"""
import ast,base64,copy,errno,hashlib,json,os,pathlib,stat,struct

NAME='toyvm-ftruncate-runtime-independent-accept-oct29'
OWN=pathlib.Path('/tmp')/NAME
REPO=OWN/'repo'
DISPATCH=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/(NAME+'-dispatch.json')
EVIDENCE=DISPATCH.parent/'toyvm-domain-pinned-ftruncate-file-limit-oct29/retained-evidence'
BACK='test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
MARKER='FTRUNCATE_ATTEMPTED_SIZE:16385\n'
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def require(ok,why):
 if not ok:raise ValueError(why)
def check(raw,d,fixture):
 require(raw['candidate']==d['candidate'],'candidate')
 require(raw['pins']==d['sourcePins'],'source pins')
 require(raw['sourceAfter']=={k:v['sha256'] for k,v in d['sourcePins'].items()},'post source pins')
 require(raw['fixtureSHA256']==hashlib.sha256(fixture.encode()).hexdigest(),'fixture identity')
 a=raw['argv'];sep=a.index('--')
 require(a[0:2]==['/usr/bin/python3','-B'] and a[2]=='/tmp/tvft2/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py','production runner')
 require(a[sep+1:]==['/usr/bin/python3','-B','-c',fixture],'exact reproducer')
 for flag,value in [('--domain','tiny-fixture'),('--live-limit','32768'),('--write-limit','65536'),('--file-limit','16384'),('--work','/tmp/tvft2/w')]:
  require(a[a.index(flag)+1]==value,'argv '+flag)
 require(raw['productionInvocations']==1 and raw['safetyCleanup'] is None,'invocation/safety')
 require(raw['cliExit']==1 and not raw['cliStderr'],'CLI exit/stderr')
 report=json.loads(raw['cliStdout']);require(report==raw['report'],'stdout envelope')
 require(report['accepted'] is False and report['childSucceeded'] is False and report['accountingAccepted'] is False and report['browserAllowed'] is False,'rejected CLI')
 br=report['backendReceipt'];fs=br['filesystem']
 require(br['stopReason']=='filesystem per-file limit' and fs['failure']==br['stopReason'],'limiting reason')
 for k,v in dict(fileLimit=16384,liveLimit=32768,writeLimit=65536,written=0,live=8192,peak=8192,inodes=2,openHandles=0).items():require(type(fs[k]) is int and fs[k]==v,'filesystem '+k)
 output=base64.b64decode(br['output']['data'],validate=True).decode()
 require(br['output']['encoding']=='base64' and output==MARKER and raw['fixtureOutput']==output,'marker consistency')
 cleanup=br['filesystemCleanup']
 require(report['cleanupComplete'] is True and br['cleanupComplete'] is True,'child cleanup')
 require(cleanup['remainingMounts']==[] and cleanup['unmountExit']==0 and cleanup['serverExit'] in (0,-15),'FUSE cleanup')
 require(raw['remainingMounts']==[],'external mounts')
 identities={(x['pid'],x['start']):x for x in raw['observedIdentities']}
 require(bool(identities) and all(x['absentOrReused'] is True and x['finalState'] is None for x in identities.values()),'identity cleanup')
 require(bool(br['owned']) and all(tuple(x) in identities for x in br['owned']),'owned PID/start linkage')
 rows=[x for s in raw['samples'] for x in s['rows']]
 require(any('fuse_backend.py /tmp/tvft2/w/domain /tmp/tvft2/w/status.sock 32768 65536 16384' in x['cmd'] for x in rows),'actual backend argv')
 require(any(x['cmd'].startswith('/usr/bin/python3 -B -c '+fixture) and (x['pid'],x['start']) in {tuple(y) for y in br['owned']} for x in rows),'actual fixture identity')
 require(set(raw['executablePins'])=={'/usr/bin/python3','/usr/bin/fusermount3'},'executables')
 for k,v in raw['executablePins'].items():require(v['bytes']>0 and len(v['sha256'])==64 and v['realpath'].startswith('/usr/bin/'),'executable pin '+k)
 return fs

def fragment(source,mutation=None):
 tree=ast.parse(source);cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Backend')
 methods={n.name:n for n in cls.body if isinstance(n,ast.FunctionDef)}
 resize=methods['resize'];guard=next(n for n in resize.body if isinstance(n,ast.If))
 require(isinstance(guard,ast.If) and ast.unparse(guard.test)=='size > self.file_limit','production resize guard')
 if mutation=='removed':resize.body.remove(guard)
 if mutation=='late':resize.body.remove(guard);resize.body.append(guard)
 # Retain exact SETATTR branch and its dispatch increment, omit other operations.
 handle=methods['handle'];setattr_branch=next(n for n in handle.body if isinstance(n,ast.If) and ast.unparse(n.test)=='op == 4')
 handle.body=[handle.body[0],setattr_branch]
 cls.body=[methods[k] for k in ['__init__','state','reject','charge','attr','resize','handle']]
 module=ast.fix_missing_locations(ast.Module(body=[cls],type_ignores=[]))
 ns=dict(pathlib=pathlib,stat=stat,os=os,errno=errno,pack=lambda fmt,*args:struct.pack('<'+fmt,*args),unpack=lambda fmt,data,offset=0:struct.unpack_from('<'+fmt,data,offset))
 exec(compile(module,BACK+' [selected source fragment]','exec'),ns)
 return ns['Backend']
def exercise(source,mutation=None):
 B=fragment(source,mutation);b=B('/unused-not-created',32768,65536,16384)
 b.nodes[2]=dict(mode=stat.S_IFREG|0o600,data=bytearray(),names={},links=1,opens=1)
 b.live=b.peak=8192;b.handles=1
 before=(bytes(b.nodes[2]['data']),b.live,b.peak,b.written)
 data=bytearray(88);struct.pack_into('<I',data,0,8);struct.pack_into('<Q',data,16,16385)
 try:b.handle(4,2,data)
 except OSError as e:require(e.errno==errno.ENOSPC,'fragment errno')
 else:raise ValueError('fragment accepted growth')
 require(b.failure=='filesystem per-file limit','fragment reason')
 require((bytes(b.nodes[2]['data']),b.live,b.peak,b.written)==before,'guard ran after mutation')
 return True
def main():
 d=json.loads(DISPATCH.read_text());raw=json.loads((EVIDENCE/'runtime-result.json').read_text());canonical=json.loads((EVIDENCE/'canonical-receipt.json').read_text())
 for key,file in [('canonicalReceipt','canonical-receipt.json'),('previousVerifiedReceipt','completion-receipt.json'),('verifiedStopReceipt','coordinator-actual-stopped.json')]:require(pin(EVIDENCE/file)==d[key+'Pin'],'retained '+key)
 require(pin(EVIDENCE/'runtime-result.json')['sha256']==canonical['runtimeSHA256'],'raw envelope hash')
 for rel,expected in d['sourcePins'].items():require(pin(REPO/rel)==expected,'owned source '+rel)
 old=pathlib.Path('/tmp/toyvm-domain-pinned-ftruncate-file-limit-oct29')
 require(pin(old/'fixture.py')==canonical['fixturePin'],'fixture pin');require(pin(old/'runtime-observer.py')==canonical['observerPin'],'observer pin')
 fixture=(old/'fixture.py').read_text();source=(REPO/BACK).read_text()
 fs=check(raw,d,fixture);require(raw['executablePins']==canonical['executablePins'],'canonical executable linkage')
 require(raw['pins']==canonical['sourcePins'],'canonical sources')
 stopped=json.loads((EVIDENCE/'coordinator-actual-stopped.json').read_text())
 require(stopped['id']==canonical['box'] and stopped['state']=='stopped' and stopped['lastSnapshotStatus']=='completed' and stopped['snapshotVerifiedAt'],'exact stopped box')
 tests={'raw anchored contract':True,'exact SETATTR source fragment':exercise(source)}
 def adversary(name,change):
  forged=copy.deepcopy(raw);change(forged)
  try:check(forged,d,fixture)
  except (ValueError,KeyError):tests[name]=True
  else:raise AssertionError('forgery accepted '+name)
 def sync(r):r['cliStdout']=json.dumps(r['report'])
 def report_change(r,fn):fn(r['report']);sync(r)
 adversary('forged missing marker',lambda r:(r.update(fixtureOutput=''),report_change(r,lambda q:q['backendReceipt']['output'].update(data=''))))
 adversary('wrong limiting reason',lambda r:report_change(r,lambda q:q['backendReceipt'].update(stopReason='aggregate RSS limit')))
 adversary('accepted growth',lambda r:report_change(r,lambda q:q['backendReceipt']['filesystem'].update(live=28672,peak=28672,written=16385)))
 adversary('source pin mismatch',lambda r:r['pins'][BACK].update(sha256='0'*64))
 adversary('omitted cleanup',lambda r:report_change(r,lambda q:q['backendReceipt'].pop('filesystemCleanup')))
 for mutation in ['late','removed']:
  try:exercise(source,mutation)
  except ValueError:tests['mutation '+mutation]=True
  else:raise AssertionError('undetected guard mutation '+mutation)
 adapter=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py').read_text()
 require(adapter.index('result=m.supervise(')<adapter.index('final=snapshot()')<adapter.index("result['filesystem']=final")<adapter.index("q=subprocess.run("),'post-reap snapshot ordering')
 result=dict(outcome='SCOPED_ACCEPT',tests=tests,filesystem=fs,candidate=d['candidate'],rawPin=pin(EVIDENCE/'runtime-result.json'),sourcePins=d['sourcePins'],box=dict(id=stopped['id'],state=stopped['state'],expiry='2026-10-29T05:14:53.237Z'),observed='Raw marker, stop reason, filesystem counters, PID/start records, executable pins and FUSE cleanup.',inferred='Unchanged fixture plus unique per-file failure in SETATTR resize supports ftruncate reach; no syscall trace or returned errno was captured.',firstMissingDirectObservation='syscall entry/return trace and fixture errno; not required for this combined source/runtime scoped inference',fragmentScope='Selected SETATTR/resize source only; no backend, CLI, Boat or syscall replay.')
 (OWN/'acceptance-result.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(dict(outcome=result['outcome'],tests=len(tests),PASS=True)))
if __name__=='__main__':main()
