"""Offline evidence acceptance; never imports or invokes the production backend."""
import ast, base64, copy, errno, hashlib, json, pathlib, struct, textwrap
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parent.parent
PINS=json.loads((HERE/'input-pins.json').read_text())
REASON='filesystem cumulative write limit'
def pin(b):return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def require(ok,why):
    if not ok:raise ValueError(why)
def validate(raw, api, fixture, observer, stop, phase='post-reap'):
    require(phase=='post-reap','not instantaneous counters')
    require(api['success'] is True and api['exitCode']==0 and not any(api[k] for k in ['launcherFailed','oomKilled','timedOut','stdoutTruncated','stderrTruncated']) and api['signal'] is None and not api['stderr'],'API envelope')
    require(json.loads(api['stdout'])==raw,'raw API equality')
    require(raw['candidate']==PINS['candidate'] and raw['pins']==PINS['sourcePins'],'source identity')
    require(raw['sourceAfter']=={k:v['sha256'] for k,v in PINS['sourcePins'].items()},'source after')
    require(raw['fixtureSHA256']==pin(fixture)['sha256'],'fixture identity')
    require(pin(fixture)==PINS['inputs']['fixture.py'] and pin(observer)==PINS['inputs']['runtime-observer.py'],'fixture/observer pins')
    require(raw['productionInvocations']==1 and raw['cliExit']==1 and not raw['cliStderr'],'CLI execution')
    argv=raw['argv'];require(argv[:3]==['/usr/bin/python3','-B','/tmp/tvow/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'],'production boundary')
    require(argv[-4:]==['/usr/bin/python3','-B','-c',fixture.decode()],'unchanged reproducer')
    for key,val in [('live-limit','32768'),('write-limit','16384'),('file-limit','16384'),('work','/tmp/tvow/w')]:require(argv[argv.index('--'+key)+1]==val,key)
    require(raw['socketBytes']==len(b'/tmp/tvow/w/status.sock')<108,'socket contract')
    executables={
      '/usr/bin/python3':dict(bytes=8020928,realpath='/usr/bin/python3.12',sha256='1643dacd9feaedc58f3cc581e4d22577dfe25c09b10282936186ccf0f2e61118'),
      '/usr/bin/fusermount3':dict(bytes=39296,realpath='/usr/bin/fusermount3',sha256='d278775c1528dd32efc85c2cb322423ee93aa8dcf76aaa595f7022d427910704')}
    require(raw['executablePins']==executables,'executable pins')
    report=json.loads(raw['cliStdout']);require(report==raw['report'],'CLI report equality')
    require(all(report[k] is False for k in ['accepted','accountingAccepted','childSucceeded','browserAllowed']),'third write not accepted')
    br=report['backendReceipt'];fs=br['filesystem']
    require(br['stopReason']==fs['failure']==REASON,'exact rejection reason')
    require({k:fs[k] for k in ['live','peak','written','inodes','openHandles','liveLimit','writeLimit','fileLimit']}==dict(live=16384,peak=16384,written=16384,inodes=2,openHandles=0,liveLimit=32768,writeLimit=16384,fileLimit=16384),'final post-reap counters')
    require(br['output']['encoding']=='base64','payload encoding')
    payload=base64.b64decode(br['output']['data'],validate=True).decode()
    require(payload==raw['fixtureOutput'],'output equality')
    require(json.loads(payload)==dict(checkpoint='before-third-write',successfulWriteBytes=16384,fileSize=8192),'checkpoint marker')
    for line in ["assert os.write(fd,b'a'*8192)==8192","assert os.pwrite(fd,b'b'*8192,0)==8192","assert os.fstat(fd).st_size==8192 and os.pread(fd,1,0)==b'b'","os.pwrite(fd,b'c',0)"]:
        require(line in fixture.decode(),'second overwrite proof')
    require(raw['safetyCleanup'] is None and raw['remainingMounts']==[],'no external cleanup/no mount')
    require(report['cleanupComplete'] is True and br['cleanupComplete'] is True,'cleanup receipt')
    fc=br['filesystemCleanup'];require(fc['remainingMounts']==[] and fc['unmountExit']==0 and fc['serverExit']==-15 and not fc['unmountStderr'] and not fc['serverStderr'],'FUSE disconnect/server reap')
    identities=raw['observedIdentities'];require(bool(identities),'identities required')
    ids={(x['pid'],x['start']) for x in identities}
    require(all(x['absentOrReused'] is True and x['finalState'] is None and x['start'].isdigit() for x in identities),'PID start identity cleanup')
    require(bool(br['owned']) and {tuple(x) for x in br['owned']}<=ids,'production owned identities')
    samples={(x['pid'],x['start']) for s in raw['samples'] for x in s['rows']}
    require(ids<=samples,'sampled identities')
    require(any('fuse_backend.py /tmp/tvow/w/domain /tmp/tvow/w/status.sock 32768 16384 16384' in x['cmd'] for s in raw['samples'] for x in s['rows']),'actual backend arguments')
    require(stop['id']=='bx_dngjt3zd' and stop['state']=='stopped' and stop['stop']['status']=='completed' and stop['snapshotVerifiedAt'] and stop['snapshotAvailable'] is True,'actual stopped receipt')
    return True

def fragment(source):
    """Extract only the exact op16 branch, without importing the backend."""
    tree=ast.parse(source)
    node=next(n for n in ast.walk(tree) if isinstance(n,ast.If) and ast.unparse(n.test)=='op == 16')
    f=ast.parse('def write(self,ino,data):\n pass').body[0];f.body=copy.deepcopy(node.body)
    module=ast.fix_missing_locations(ast.Module(body=[f],type_ignores=[]))
    ns=dict(unpack=lambda fmt,b:struct.unpack_from('<'+fmt,b),pack=lambda fmt,*v:struct.pack('<'+fmt,*v),errno=errno)
    exec(compile(module,'<exact-op16-fragment>','exec'),ns)
    return ns['write'],ast.get_source_segment(source,node)

class Model:
    def __init__(self):
        self.nodes={2:dict(data=bytearray())};self.written=0;self.failure=None;self.write_limit=16384;self.file_limit=16384;self.resizeCalls=0
    def resize(self,ino,n):
        self.resizeCalls+=1;self.nodes[ino]['data'].extend(b'\0'*(n-len(self.nodes[ino]['data'])))
    def reject(self,reason):
        self.failure=reason;raise OSError(errno.ENOSPC,reason)

def exercise(source):
    write,segment=fragment(source);m=Model()
    def call(payload):return write(m,2,struct.pack('<QQI',2,0,len(payload))+b'\0'*20+payload)
    require(call(b'a'*8192)==struct.pack('<II',8192,0),'first write response')
    require(call(b'b'*8192)==struct.pack('<II',8192,0),'second response')
    require(m.written==16384 and m.nodes[2]['data']==b'b'*8192,'overwrite accounts full size')
    before=(bytes(m.nodes[2]['data']),m.written,m.resizeCalls)
    try:call(b'c')
    except OSError as e:require(e.errno==errno.ENOSPC and str(e).endswith(REASON),'fragment rejection')
    else:raise ValueError('third write accepted')
    require(before==(bytes(m.nodes[2]['data']),m.written,m.resizeCalls),'guard before mutation')
    return segment

def main():
    for rel,p in PINS['sourcePins'].items():require(pin((REPO/rel).read_bytes())==p,'immutable production source '+rel)
    for rel,p in PINS['inputs'].items():require(pin((HERE/'inputs'/rel).read_bytes())==p,'immutable input '+rel)
    raw=json.loads((HERE/'inputs/evidence/runtime-result.json').read_text());api=json.loads((HERE/'inputs/evidence/runtime-api.stdout').read_text())
    fixture=(HERE/'inputs/fixture.py').read_bytes();observer=(HERE/'inputs/runtime-observer.py').read_bytes();stop=json.loads((HERE/'inputs/stopped.json').read_text())
    validate(raw,api,fixture,observer,stop)
    tests=[]
    def reject(name,edit,**kw):
        r=copy.deepcopy(raw);a=copy.deepcopy(api);edit(r)
        # Rebind envelopes so these adversaries test semantic validation too.
        r['cliStdout']=json.dumps(r['report']);a['stdout']=json.dumps(r)
        try:validate(r,a,kw.get('fixture',fixture),observer,stop,kw.get('phase','post-reap'))
        except (ValueError,KeyError):tests.append(name)
        else:raise AssertionError('adversary accepted '+name)
    reject('wrong reason',lambda r:r['report']['backendReceipt'].__setitem__('stopReason','filesystem allocation limit'))
    reject('accepted third write forged reason',lambda r:r['report'].__setitem__('accepted',True))
    reject('third byte counted with forged reason',lambda r:r['report']['backendReceipt']['filesystem'].__setitem__('written',16385))
    reject('missing marker',lambda r:(r.__setitem__('fixtureOutput','{}'),r['report']['backendReceipt']['output'].__setitem__('data',base64.b64encode(b'{}').decode())))
    reject('missing second overwrite proof',lambda r:None,fixture=fixture.replace(b"assert os.pwrite(fd,b'b'*8192,0)==8192",b'pass'))
    reject('pin mismatch',lambda r:r['sourceAfter'].__setitem__(next(iter(r['sourceAfter'])),'0'*64))
    reject('executable mismatch',lambda r:r['executablePins']['/usr/bin/python3'].__setitem__('sha256','0'*64))
    reject('omitted cleanup',lambda r:r['report']['backendReceipt'].pop('filesystemCleanup'))
    reject('post-reap mislabeled instantaneous',lambda r:None,phase='instantaneous')
    reject('PID start mismatch',lambda r:r['observedIdentities'][0].__setitem__('start','0'))
    reject('external cleanup',lambda r:r.__setitem__('safetyCleanup','kill'))
    source=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text();segment=exercise(source)
    require('raise OSError(errno.ENOSPC,reason)' in source,'source-only errno inference')
    mutations={
      'count only file growth':source.replace("            if self.written+size>self.write_limit", "            growth=max(0,off+size-len(self.nodes[ino]['data']))\n            if self.written+growth>self.write_limit").replace('self.written+=size','self.written+=growth'),
      'guard after write':source.replace("            if self.written+size>self.write_limit:self.reject('filesystem cumulative write limit')\n",'').replace("            self.written+=size\n","            if self.written+size>self.write_limit:self.reject('filesystem cumulative write limit')\n            self.written+=size\n")}
    for name,s in mutations.items():
        try:exercise(s)
        except ValueError:tests.append(name)
        else:raise AssertionError('mutation survived '+name)
    supervise=(REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py').read_text()
    require(supervise.index('result=m.supervise(')<supervise.index('final=snapshot()')<supervise.index("result['filesystem']=final"),'post-reap source phase')
    result=dict(outcome='SCOPED_ACCEPT',candidate=PINS['candidate'],preservedRuntimeValidated=True,newRuntimeInvocations=0,adversariesRejected=tests,fragmentSHA256=hashlib.sha256(segment.encode()).hexdigest(),counterPhase='post-reap',observed=dict(live=16384,peak=16384,written=16384,inodes=2,openHandles=0),limitations=['Exact WRITE fragment with stubbed resize/reject only; not backend execution','No observed syscall errno; ENOSPC is source inference','No general resource, browser or gameplay qualification'],remainingGate='coordinator review; no main/public deployment')
    result['manifest']={str(p.relative_to(HERE)):pin(p.read_bytes()) for p in sorted(HERE.rglob('*')) if p.is_file() and p!=HERE/'canonical.json'}
    (HERE/'canonical.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
