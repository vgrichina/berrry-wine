from supervisor import *
from objects import *
import ast,copy,types,sys,struct,contextlib,tempfile,os
from unittest import mock
C='7c20b6d03674ca317b661019977d756efbb08a9d'
B='ac4d15a40ffdf05462b2c92c6625529bd2916437'
P='test/toyvm-kernel-profile-accounting-backend-oct28/'
R=P+'mounted-release-write-callback-oct30/'
def get(name):return json.loads(path(C,R+name)[1])
def module(body,name):
    m=types.ModuleType(name);exec(compile(body,name,'exec'),m.__dict__);return m
def numeric(ev):
    assert set(ev)=={'limit','callbackCount','countSaturated','records'}
    assert type(ev['countSaturated']) is bool
    assert type(ev['limit']) is int and 1<=ev['limit']<=64
    assert len(ev['records'])<=ev['limit']
    assert type(ev['callbackCount']) is int and 0<=ev['callbackCount']<2**64
    for rec in ev['records']:
        assert set(rec)=={'opcode','unique','inode','errno','callbackCount','before','after'}
        for key,val in rec.items():
            if key in ('before','after'):
                assert set(val)=={'live','peak','written','inodes','openHandles'}
                assert all(type(v) is int and 0<=v<2**64 for v in val.values())
            else:assert type(val) is int and 0<=val<2**64
def retained(raw):
    fs=raw['report']['backendReceipt']['filesystem'];ev=fs['ioEvidence'];numeric(ev)
    records=ev['records'];assert len(records)==ev['callbackCount']==7
    assert [v['callbackCount'] for v in records]==list(range(1,8))
    assert len({v['unique'] for v in records})==7
    release=[v for v in records if (v['opcode'],v['unique'],v['inode'])==(18,542,3)]
    write=[v for v in records if (v['opcode'],v['unique'],v['inode'])==(16,858,2)]
    assert len(release)==len(write)==1
    a,b=release[0],write[0];assert records.index(a)<records.index(b)
    # Root metadata + two metadata/payload allocations; unlink retains opens.
    charge=lambda n:4096+4096*((n+4095)//4096)
    live=4096+2*charge(4096);released=live-charge(4096)
    expected=lambda l,i,o,w:dict(live=l,peak=live,inodes=i,openHandles=o,written=w)
    assert a['errno']==b['errno']==0
    assert a['before']==expected(live,3,2,8192)
    assert a['after']==b['before']==expected(released,2,1,8192)
    assert b['after']==expected(released+charge(4097)-charge(4096),2,1,8193)
    steps=raw['syscalls'];assert [v['step'] for v in steps]==['before','retained','closing-old','closed-old','before-reuse','reused','cleanup']
    assert all(steps[i]['at']<steps[i+1]['at'] for i in range(6))
    before,held,closing,closed,ready,reused,clean=steps
    def blob(c):return dict(length=len(c),sha256=hashlib.sha256(c).hexdigest())
    for rec,key,data in [(before,'source',b'S'*4096),(before,'destination',b'D'*4096),(held,'oldDestination',b'D'*4096),(closing,'oldDestination',b'D'*4096),(reused,'source',b'S'*4096+b'X')]:
        for k,v in blob(data).items():assert rec[key][k]==v
    assert before['source']['inode']==2 and before['destination']['inode']==3
    assert held['sourceAbsent'] and held['newDestinationSourceBytes'] and held['oldHandleOldBytes']
    assert reused['exactPrefix'] and reused['newByte'] and reused['destinationSourceBytes'] and clean['empty']
    for lo,hi,state,hasA,hasB in [(held['at'],closing['at'],expected(live,3,2,8192),False,False),(closed['at'],ready['at'],a['after'],True,False),(reused['at'],clean['at'],b['after'],True,True)]:
        samples=[x['state'] for x in raw['counterSamples'] if lo+.05<x['at']<hi-.05];assert samples
        for s in samples:
            assert {k:s[k] for k in state}==state and s['failure'] is None
            trace=s['ioEvidence']['records'];assert (a in trace)==hasA and (b in trace)==hasB
    assert (fs['liveLimit'],fs['writeLimit'],fs['fileLimit'])==(20480,65536,16384)
    assert (fs['live'],fs['inodes'],fs['written'],fs['openHandles'],fs['failure'])==(4096,1,8193,0,None)
    report=raw['report'];backend=report['backendReceipt']
    assert raw['exit']==backend['exit']==0 and raw['violation'] is None
    assert all(report[k] for k in ('accepted','childSucceeded','accountingAccepted','cleanupComplete'))
    assert backend['stopReason'] is None and backend['cleanupComplete']
    assert backend['filesystemCleanup']['unmountExit']==0 and backend['filesystemCleanup']['remainingMounts']==[]
    return a,b
def main():
    old=ROOT.parent/'toyvm-release-write-callback-runtime-oct30'
    assert (ROOT/'supervisor.py').read_text()==(old/'supervisor.py').read_text().replace(old.name,ROOT.name)
    pre=get('preflight.json');assert pre['PASS'] and pre['outputOverflowRejected']
    assert pre['generatedFileControl']==dict(bytes=600000,captureCeiling=524288,FSIZE=12*M)
    pins=get('source-pins.json')
    for rel,want in pins['sourcePins'].items():assert pin(path(C,rel)[1])==want==pin((REPO/rel).read_bytes())
    raw=get('raw-runtime.json');assert raw['argv']==pins['cliArgv']
    # Execute canonical production argument parser before any behavioral suite.
    cp=REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
    # __file__ is needed during module initialization.
    cm=types.ModuleType('caller');cm.__file__=str(cp);exec(compile(cp.read_bytes(),str(cp),'exec'),cm.__dict__)
    captured={};cm.qualify=lambda **kw:captured.update(kw) or dict(accepted=True)
    with contextlib.redirect_stdout(__import__('io').StringIO()):assert cm.main(raw['argv'][3:])==0
    assert captured['io_evidence']==64 and captured['rename_evidence']==64
    assert 'source,retained' in captured['command'][-1] and 'destination,retained' in captured['command'][-1]
    assert raw['cwd']=='/tmp/tvsa-stage/repo' and pre['socketBytes']==len('/tmp/tvsa/status.sock'.encode())==21
    sys.path.insert(0,str(REPO/P));import test_rename_wire as transport
    prod=transport.production
    class Short:
        original=tempfile.TemporaryDirectory
        def __init__(self,*a,**kw):
            self.tmp=self.original(*a,**kw);self.fd=os.open(self.tmp.name,os.O_RDONLY|os.O_DIRECTORY);self.name='/proc/self/fd/'+str(self.fd)
        def cleanup(self):self.tmp.cleanup();os.close(self.fd)
    @contextlib.contextmanager
    def wire(mod=prod,**kw):
        with mock.patch.object(tempfile,'TemporaryDirectory',Short):w=transport.Wire(mod.Backend('/private',20480,65536,16384,**kw))
        try:yield w
        finally:w.close()
    def boundary(mod=prod,enabled=True):
        opts=dict(io_evidence_limit=64,rename_evidence_limit=64,namespace_evidence_limit=64,setattr_evidence_limit=64) if enabled else {}
        with wire(mod,**opts) as w:
            s=w.create(b'source,retained');d=w.create(b'destination,retained');assert (s,d)==(2,3)
            replies=[]
            def call(op,ino,data):
                result=w.call(op,ino,data);replies.append(result);return result
            def wr(ino,data,offset=0):return call(16,ino,struct.pack('<QQI',ino,offset,len(data))+bytes(20)+data)
            assert wr(s,b'S'*4096)==(0,struct.pack('<II',4096,0))
            assert wr(d,b'D'*4096)==(0,struct.pack('<II',4096,0))
            assert w.rename(b'source,retained',b'destination,retained')==0
            assert w.call(14,d)[0]==0
            assert call(18,d,struct.pack('<Q',d))==(0,b'')
            assert w.state()['live']==20480 and w.state()['inodes']==3
            assert call(18,d,struct.pack('<Q',d))==(0,b'')
            assert w.state()['live']==12288 and w.state()['inodes']==2
            assert wr(s,b'X',4096)==(0,struct.pack('<II',1,0))
            assert w.call(15,s,struct.pack('<QQI',s,0,8192))==(0,b'S'*4096+b'X')
            state=w.state()
            if enabled:
                ev=state['ioEvidence'];numeric(ev)
                assert [(v['opcode'],v['unique'],v['inode']) for v in ev['records']]==[(16,4,2),(16,5,3),(18,8,3),(18,9,3),(16,10,2)]
                assert [(v['before']['live'],v['after']['live'],v['before']['written'],v['after']['written']) for v in ev['records']]==[(12288,16384,0,4096),(16384,20480,4096,8192),(20480,20480,8192,8192),(20480,12288,8192,8192),(12288,16384,8192,8193)]
                snap=copy.deepcopy(ev);ev['records'][-1]['before']['live']=0;assert w.state()['ioEvidence']==snap
                assert state['namespaceEvidence']['callbackCount']==2 and state['renameEvidence']['callbackCount']==1
            else:assert 'ioEvidence' not in state
            for key in ('ioEvidence','namespaceEvidence','renameEvidence','setattrEvidence'):state.pop(key,None)
            return replies,state
    # First source behavioral check uses the exact production serve and INIT.
    baseline=module(path(B,P+'fuse_backend.py')[1],'baseline')
    assert boundary()==boundary(enabled=False)==boundary(baseline,False)
    with wire(io_evidence_limit=2) as w:
        ino=w.create(b'private-malformed')
        for op,data,err in [(16,b'',5),(18,b'',5),(16,struct.pack('<QQI',ino+1,0,1)+bytes(20)+b'X',5),(18,struct.pack('<Q',ino+1),9),(16,struct.pack('<QQI',ino,0,2)+bytes(20)+b'X',5)]:
            before=w.state();nodes=copy.deepcopy(w.backend.nodes)
            assert w.call(op,ino,data)==(-err,b'')
            after=w.state();assert w.backend.nodes==nodes
            assert all(after[k]==before[k] for k in ('live','peak','written','inodes','openHandles'))
            assert after['ioEvidence']['records'][-1]['errno']==err
            assert len(after['ioEvidence']['records'])<=2
        w.backend.io_callbacks=2**64-2
        for _ in range(3):assert w.call(18,ino,b'')==(-5,b'')
        ev=w.state()['ioEvidence'];assert ev['callbackCount']==2**64-1 and ev['countSaturated'] and len(ev['records'])==2
    # Bound safety from the permitted schema, maximal uint64 digits and64 records
    # per observer; inflate every integer conservatively, even limit fields.
    full=prod.Backend('/unused',io_evidence_limit=64,setattr_evidence_limit=64,namespace_evidence_limit=64,rename_evidence_limit=64)
    for _ in range(64):
        full.record_io_callback(16,2**64-1,2**64-1,-5,full.accounting_counters())
        full.record_setattr_callback(4,2**64-1,2**64-1,-5,full.accounting_counters())
        full.record_namespace_callback(10,2**64-1,2**64-1,-5)
        full.record_rename_callback(12,2**64-1,2**64-1,-5)
    def maximal(v):
        if type(v) is int:return 2**64-1
        if isinstance(v,dict):return {k:maximal(x) for k,x in v.items()}
        if isinstance(v,list):return [maximal(x) for x in v]
        return v
    maximalState=maximal(full.state());boundBytes=len(json.dumps(maximalState).encode());assert boundBytes<98304
    for key in ('ioEvidence','setattrEvidence'):
        smaller=dict(maximalState);smaller.pop(key);assert len(json.dumps(smaller).encode())<65536
    adapterPath=REPO/P/'supervise_accounted.py'
    adapter=types.ModuleType('adapter');adapter.__file__=str(adapterPath);exec(compile(adapterPath.read_bytes(),str(adapterPath),'exec'),adapter.__dict__)
    # Capture the actual nested snapshot closure before guest dispatch, using
    # a fake server/socket only. No production snapshot code is reconstructed.
    class Captured(Exception):pass
    snapshots=[]
    class Server:
        def poll(self):return None
    for ioFlag,setFlag,limit in [(0,0,8192),(1,0,65536),(0,1,65536),(1,1,98304)]:
        def trace(frame,event,arg):
            if event=='line' and frame.f_code.co_filename==str(adapterPath) and 'snapshot' in frame.f_locals:
                snapshots.append(frame.f_locals['snapshot']);raise Captured()
            return trace
        with mock.patch.object(adapter.subprocess,'Popen',return_value=Server()):
            try:
                sys.settrace(trace)
                adapter.supervise_accounted([],str(ROOT/'unused'),io_evidence=ioFlag,setattr_evidence=setFlag)
            except Captured:pass
            finally:sys.settrace(None)
        snapshot=snapshots[-1]
        for size,ok in [(limit,True),(limit+1,False)]:
            content=json.dumps(dict(live=0,peak=0,written=0,failure=None,openHandles=0)).encode()
            content+=b' '*(size-len(content));chunks=[content[i:i+8192] for i in range(0,size,8192)]+[b'']
            sock=mock.MagicMock();sock.__enter__.return_value=sock;sock.recv.side_effect=chunks
            with mock.patch.object(adapter.socket,'socket',return_value=sock):
                try:state=snapshot()
                except RuntimeError as ex:assert not ok and str(ex)=='filesystem backend receipt too large'
                else:assert ok and state['live']==0
    a,b=retained(raw);controls=[]
    def reject(name,mutate):
        changed=copy.deepcopy(raw);mutate(changed)
        try:retained(changed)
        except AssertionError:controls.append(name)
        else:raise AssertionError('control accepted '+name)
    trace=lambda x:x['report']['backendReceipt']['filesystem']['ioEvidence']['records']
    ai=trace(raw).index(a);bi=trace(raw).index(b)
    reject('missing-release',lambda x:trace(x).pop(ai))
    for key in ('opcode','unique','inode'):
        reject('wrong-'+key,lambda x,k=key:trace(x)[ai].__setitem__(k,0))
    reject('duplicate-release',lambda x:trace(x).append(copy.deepcopy(a)))
    def reorder(x):trace(x)[ai],trace(x)[bi]=trace(x)[bi],trace(x)[ai]
    reject('reordered',reorder)
    reject('accounting',lambda x:trace(x)[ai]['after'].__setitem__('written',8193))
    reject('new-bytes',lambda x:x['syscalls'][5]['source'].__setitem__('sha256',hashlib.sha256(b'S'*4097).hexdigest()))
    reject('retained-old-bytes',lambda x:x['syscalls'][1]['oldDestination'].__setitem__('sha256',hashlib.sha256(b'S'*4096).hexdigest()))
    reject('privacy-path',lambda x:trace(x)[ai].__setitem__('path','secret'))
    source=(REPO/P/'fuse_backend.py').read_text();hook='self.record_io_callback(op,unique,ino,error,before)'
    for name,new in [('missing','pass'),('wrong-id','self.record_io_callback(op,unique+1,ino,error,before)'),('post-as-before','self.record_io_callback(op,unique,ino,error,self.accounting_counters())'),('privacy',hook+'\n                        if op in (16,18): self.io_evidence[-1]["path"]="secret"')]:
        mutant=module(source.replace(hook,new,1),name)
        try:boundary(mutant)
        except AssertionError:controls.append('source-'+name)
        else:raise AssertionError('source control accepted '+name)
    mutant=module(source.replace('io_evidence_limit=0','io_evidence_limit=1',1),'default-on')
    try:boundary(mutant,False)
    except AssertionError:controls.append('source-default-on')
    else:raise AssertionError('default-on control accepted')
    # No duplicate broad regression run: previously executed32 groups remain pinned.
    focused=get('focused-tests.json');assert focused['PASS'] and focused['newIOTests']+focused['existingSetattrTests']+focused['existingRenameNamespaceCreateIntegrationTests']==32
    life=get('lifecycle-proof.json');assert life['id']=='bx_e26vd7dy' and life['state']=='stopped'
    (E/'acceptance.json').write_text(json.dumps(dict(PASS=True,candidate=C,source=pins['candidate'],baseline=B,controlsRejected=controls,retainedRelease=a,retainedWrite=b,canonicalParser=True,defaultOffBaselineWireParity=True,transportExactBoundaryCases=8,conservativeMaxSerializedBytes=boundBytes,malformedAccountingUnchanged=True,saturationAndEviction=True,prior32GroupsReused=pin(path(C,R+'focused-tests.json')[1]),lifecycle=life,allocation=admission()),indent=2))
    print(json.dumps(dict(PASS=True,controls=len(controls))))
if __name__=='__main__':main()
