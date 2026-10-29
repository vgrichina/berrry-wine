"""Offline retained-envelope acceptance and bounded source-fragment checks.

Never imports a production module or invokes a backend, fixture, CLI or guest.
Only charge/collect/resize/reject AST fragments execute in a local model.
"""
import ast,base64,copy,hashlib,json,pathlib,errno
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parent.parent
E=HERE/'evidence'
PINS=json.loads((HERE/'input-pins.json').read_text())
BACK='test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
ADAPTER='test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
SUPERVISOR='test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py'
CALLER='test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
def require(ok,reason):
 if not ok:raise AssertionError(reason)
def filepin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def identity(pins=PINS):
 for rel,pin in pins['sourcePins'].items():require(filepin(REPO/rel)==pin,'source pin '+rel)
 for rel,pin in pins['inputs'].items():require(filepin(HERE/rel)=={k:pin[k] for k in ('bytes','sha256')},'input pin '+rel)
def source_contract(text):
 tree=ast.parse(text);cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Backend')
 methods={n.name:n for n in cls.body if isinstance(n,ast.FunctionDef)}
 h=methods['handle'];branches={ast.unparse(n.test):n for n in h.body if isinstance(n,ast.If)}
 write=ast.unparse(branches['op == 16'])
 require(write.index('self.resize(')<write.index("self.nodes[ino]['data'][off:off + size] = payload")<write.index('self.written += size'),'failed growth must precede payload and written mutations')
 rename=ast.unparse(branches['op in (12, 45)'])
 require(rename.index("self.nodes[previous]['links'] -= 1")<rename.index('self.collect(previous)')<rename.index('dest[new] = source.pop(old)'),'rename accounting ordering')
 release=ast.unparse(branches['op in (18, 29)'])
 require(release.index("self.nodes[ino]['opens'] -= 1")<release.index('self.handles -= 1')<release.index('self.collect(ino)'),'release accounting ordering')
 return methods
def allocation_table(methods):
 metadata=next(n for n in ast.walk(methods['create']) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='charge').args[0].value
 root=next(n.value.value for n in ast.walk(methods['__init__']) if isinstance(n,ast.Assign) and isinstance(n.value,ast.Constant) and any(isinstance(t,ast.Attribute) and t.attr=='live' for t in n.targets))
 block=next(n.right.value for n in ast.walk(methods['resize']) if isinstance(n,ast.BinOp) and isinstance(n.op,ast.FloorDiv))
 require(root==metadata==block==4096,'source metadata, initial root, payload rounding unit')
 require('4096 + (len(n[\'data\']) + 4095) // 4096 * 4096' in ast.unparse(methods['collect']),'collection metadata plus rounded payload')
 # Derive each phase from the source's metadata and rounded payload rules,
 # before consulting a runtime state value. tuple: inode, size, linked, open.
 phases={
  'root': [('root',0,True,False)],
  'AB-created':[('root',0,True,False),('A',0,True,True),('oldB',0,True,True)],
  'AB-written':[('root',0,True,False),('A',8192,True,True),('oldB',8192,True,True)],
  'renamed':[('root',0,True,False),('A-at-B',8192,True,True),('oldB',8192,False,True)],
  'before-C-write':[('root',0,True,False),('A-at-B',8192,True,True),('oldB',8192,False,True),('C',0,True,True)],
  'C-growth-request':[('root',0,True,False),('A-at-B',8192,True,True),('oldB',8192,False,True),('C',4096,True,True)],
  'post-reap':[('root',0,True,False),('A-at-B',8192,True,False),('C',0,True,False)]}
 result={}
 for phase,inodes in phases.items():
  rows=[dict(inode=n,size=s,linked=l,open=o,metadata=metadata,payload=((s+block-1)//block)*block) for n,s,l,o in inodes]
  result[phase]=dict(inodes=rows,total=sum(r['metadata']+r['payload'] for r in rows))
 return result
def fragment_class(methods,mutation=None):
 names=['reject','charge','collect','resize']
 selected=[copy.deepcopy(methods[n]) for n in names]
 if mutation=='premature-collect':
  collect=next(n for n in selected if n.name=='collect');collect.body[1].test=ast.parse("not n['links']",mode='eval').body
 if mutation=='charge-guard':
  charge=next(n for n in selected if n.name=='charge');charge.body=charge.body[1:]
 if mutation=='release-leak':
  collect=next(n for n in selected if n.name=='collect');collect.body=[ast.Pass()]
 cls=ast.ClassDef(name='Fragment',bases=[],keywords=[],body=selected,decorator_list=[])
 module=ast.fix_missing_locations(ast.Module(body=[cls],type_ignores=[]));ns={'errno':errno}
 exec(compile(module,'<pinned-charge-collect-resize-fragments>','exec'),ns)
 return ns['Fragment']
def model_checks(methods,mutation=None):
 f=fragment_class(methods,mutation)();f.live_limit=32768;f.file_limit=16384;f.failure=None;f.written=16384
 f.live=28672;f.peak=28672
 f.nodes={1:dict(data=bytearray(),links=1,opens=0),2:dict(data=bytearray(b'a'*8192),links=1,opens=1),3:dict(data=bytearray(b'b'*8192),links=0,opens=1)}
 f.collect(3)
 require(3 in f.nodes and f.live==28672,'open replaced inode must remain charged on rename')
 f.charge(4096);f.nodes[4]=dict(data=bytearray(),links=1,opens=1)
 before=(f.live,f.peak,f.written,bytes(f.nodes[4]['data']))
 try:f.resize(4,4096)
 except OSError as e:require(e.errno==errno.ENOSPC,'source-fragment errno only')
 else:raise AssertionError('charge guard failed to reject growth')
 require((f.live,f.peak,f.written,bytes(f.nodes[4]['data']))==before,'failed resize mutated charges or payload')
 require(f.failure=='filesystem allocation limit','source-fragment reason')
 f.nodes[3]['opens']-=1;f.collect(3)
 require(3 not in f.nodes and f.live==20480,'last release must reclaim metadata plus payload')
 f.nodes[2]['opens']-=1;f.collect(2);f.nodes[4]['opens']-=1;f.collect(4)
 require(set(f.nodes)=={1,2,4} and f.live==20480,'linked nodes survive close')
def fixture_contract(fixture):
 ast.parse(fixture)
 require(fixture.index('os.rename(')<fixture.index('bs=os.fstat(b)')<fixture.index('os.pread(b,1,0)')<fixture.index("checkpoint='before-C-write'")<fixture.index("os.write(c,b'c'*4096)")<fixture.index('os.close(b)'),'descriptor proof and original B lifetime')
 require("bs.st_nlink==0 and bs.st_size==8192" in fixture and "os.stat(base+'B').st_ino==ai" in fixture,'descriptor and renamed inode assertions')
def validate(raw,stdout,fixture,table):
 fixture_contract(fixture)
 require(raw['candidate']==PINS['candidate'] and raw['pins']==PINS['sourcePins'],'runtime source identity')
 require(raw['sourceAfter']=={p:v['sha256'] for p,v in PINS['sourcePins'].items()},'post runtime source identity')
 require(raw['argv'][-1]==fixture and raw['fixtureSHA256']==hashlib.sha256(fixture.encode()).hexdigest(),'actual argv fixture identity')
 require(raw['argv'][2]=='/tmp/tvrn/repo/'+CALLER,'production entrypoint')
 for opt,value in [('--live-limit','32768'),('--write-limit','65536'),('--file-limit','16384')]:require(raw['argv'][raw['argv'].index(opt)+1]==value,'runtime quota')
 report=json.loads(stdout)
 require(raw['cliStdout']==stdout and raw['report']==report,'raw CLI envelope agreement')
 require(raw['cliExit']==1 and raw['cliStderr']=='' and raw['productionInvocations']==1 and raw['gatePASS'] is False,'historical failure retained')
 require(all(report[x] is False for x in ['accepted','accountingAccepted','browserAllowed','childSucceeded']),'original rejection flags')
 br=report['backendReceipt'];fs=br['filesystem']
 require(br['stopReason']==fs['failure']=='filesystem allocation limit','exact authoritative reason')
 require(fs['live']==table['post-reap']['total'] and fs['peak']==table['before-C-write']['total'] and fs['written']==16384 and fs['inodes']==3 and fs['openHandles']==0,'source-derived final allocation, peak, written, release')
 require((fs['liveLimit'],fs['writeLimit'],fs['fileLimit'])==(32768,65536,16384),'backend quotas')
 payload=base64.b64decode(br['output']['data'],validate=True).decode();require(payload==raw['fixtureOutput'],'marker envelope')
 proof=json.loads(payload)
 require(proof['checkpoint']=='before-C-write' and proof['oldBOpen'] is True and proof['oldBLinks']==0 and proof['oldBSize']==8192 and type(proof['renamedInode']) is int and proof['renamedInode']>1 and proof['renamedInode']==proof['newBInode'],'descriptor proof')
 require(raw['safetyCleanup'] is None and raw['remainingMounts']==[] and report['cleanupComplete'] is True and br['cleanupComplete'] is True,'cleanup')
 require(br['filesystemCleanup']['remainingMounts']==[] and br['filesystemCleanup']['unmountExit']==0,'unmounted')
 identities={(r['pid'],r['start']) for r in raw['observedIdentities']}
 require(raw['observedIdentities'] and all(r['absentOrReused'] and r['finalState'] is None for r in raw['observedIdentities']),'PID/start cleanup')
 require(br['owned'] and set(map(tuple,br['owned']))<=identities and raw['productionOwnedIdentityCheck'] is True,'owned identity join')
def rejected(fn):
 try:fn()
 except (AssertionError,KeyError,ValueError):return
 raise AssertionError('adversarial input accepted')
def main():
 identity();methods=source_contract((REPO/BACK).read_text());table=allocation_table(methods)
 require(table['C-growth-request']['total']>32768,'independent requested growth exceeds limit')
 # The final snapshot is taken after supervise returns, not when check sees failure.
 adapter=(REPO/ADAPTER).read_text();supervisor=(REPO/SUPERVISOR).read_text()
 require(adapter.index('result=m.supervise(')<adapter.index('final=snapshot()')<adapter.index("result['filesystem']=final"),'post-reap snapshot timing')
 require("cleanupComplete=not selected" in supervisor and "os.wait4(candidate['pid'], os.WNOHANG)" in supervisor,'reap boundary')
 raw=json.loads((E/'original-evidence-remote-result.json').read_text());stdout=(E/'original-evidence-remote-cli.stdout').read_text();fixture=(E/'original-fixture.py').read_text()
 validate(raw,stdout,fixture,table);model_checks(methods)
 passed=['pinned-production-boundary-envelope','source-derived-inode-table','failed-growth-order','post-reap-timing','fragment-retained-charge-release']
 for mutation in ['premature-collect','charge-guard','release-leak']:
  rejected(lambda m=mutation:model_checks(methods,m));passed.append('reject-'+mutation)
 p=copy.deepcopy(PINS);p['sourcePins'][BACK]['sha256']='0'*64;rejected(lambda:identity(p));passed.append('reject-sourcepin-mismatch')
 bad=fixture.replace("  os.write(c,b'c'*4096)","  os.close(b)\n  os.write(c,b'c'*4096)");rejected(lambda:fixture_contract(bad));passed.append('reject-close-B-before-C-write')
 def remove_proof(r):
  proof=json.loads(r['fixtureOutput']);del proof['oldBLinks'];payload=json.dumps(proof)+'\n'
  r['fixtureOutput']=payload;r['report']['backendReceipt']['output']['data']=base64.b64encode(payload.encode()).decode()
 for name,edit in [('accepted-C-growth-forged-reason',lambda r:r['report']['backendReceipt']['filesystem'].update(written=20480)),('missing-descriptor-proof',remove_proof),('relabeled-postreap-live',lambda r:r['report']['backendReceipt']['filesystem'].update(live=32768)),('accepted-cli-forged-reason',lambda r:r['report'].update(accepted=True))]:
  r=copy.deepcopy(raw);edit(r)
  # Keep raw report and CLI mutually consistent so semantic guards must reject.
  s=json.dumps(r['report'])+'\n';r['cliStdout']=s
  rejected(lambda:validate(r,s,fixture,table));passed.append('reject-'+name)
 result=dict(decision='PASS_SCOPED_RENAME_CHARGE_LIFETIME',checks=passed,inodeAllocationTable=table,historicalRuntimeGate=False,historicalStartupFailureUnchanged=True,newRuntimeInvocations=0,scope='pinned source fragments plus preserved runtime envelope; no backend or fixture execution',unobserved=['instantaneous live at rejection','runtime errno','general resource/browser/gameplay acceptance'])
 (HERE/'acceptance-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(dict(decision=result['decision'],checks=len(passed))))
if __name__=='__main__':main()
