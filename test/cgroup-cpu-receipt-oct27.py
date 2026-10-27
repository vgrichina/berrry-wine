"""Small cooperative fixtures under exact unchanged trusted enforcement."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
OPS = Path(sys.argv[2]) if len(sys.argv)>2 and sys.argv[1]=='checks' else None

def load(p):
    spec=importlib.util.spec_from_file_location('owned',p)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

k=load(HERE/'helpers/cgroup-cpu-evidence-oct27.py')
u=load(HERE/'unique-cpu-receipt-oct27.py')


def fixture(mode):
    if mode == 'nested-cgroup':
        parent=k.scope(); group=parent/('nested-'+str(os.getpid()))
        group.mkdir(); owned=k.identity(group)
        assert k.counters((group/'cgroup.events').read_text(), ('populated',))['populated']==0
        read,write=os.pipe()
        pid=os.fork()
        if not pid:
            os.close(write)
            assert os.read(read,1)==b'G'
            os.close(read)
            assert k.membership('self')=='/'+str(group.relative_to('/sys/fs/cgroup'))
            u.burn(.20);os._exit(0)
        os.close(read)
        (group/'cgroup.procs').write_text(str(pid));os.write(write,b'G');os.close(write)
        os.waitpid(pid,0)
        assert k.counters((group/'cgroup.events').read_text(), ('populated',))['populated']==0
        final=(group/'cpu.stat').read_text()
        assert k.identity(group)==owned
        group.rmdir()
        print('NESTED '+json.dumps(dict(stat=final,removed=not group.exists())),flush=True)
    elif mode == 'wrapper':
        # A second full invoked trusted supervisor, not imported CPU totals.
        os.execv(sys.executable,[sys.executable,'-S',str(HERE/'helpers/cgroup-cpu-evidence-oct27.py'),'supervise',str(k.scope()),*u.command('nested')])
    elif mode == 'reject':
        # Exercise real unchanged CPU90 branch with synthetic observation only.
        original=k.TRUSTED
        m=load(original)
        snapshot=m.snapshot
        def high():
            rows=snapshot()
            for row in rows.values():
                if row['ppid']==os.getpid():row['cpu']=max(row['cpu'],100)
            return rows
        m.snapshot=high
        r=m.supervise([sys.executable,'-S','-c','import time;time.sleep(.2)'],rss_limit=128*1024**2)
        assert r['stopReason']=='aggregate CPU limit' and r['cpuSeconds']>=100 and r['cleanupComplete']
        r.pop('output'); print('REJECT '+json.dumps(r),flush=True)
    else:
        u.fixture(mode)


def checks():
    assert hashlib.sha256(k.TRUSTED.read_bytes()).hexdigest()==k.PIN
    reuse={}
    if len(sys.argv)>3:
        checkpoint=json.loads(Path(sys.argv[3]).read_text())
        for path,pin in checkpoint['sourcePins'].items():
            assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==pin, 'reuse source changed'
        reuse=checkpoint['receipts']
    rows=[]
    for mode in ('flat','nested','short','siblings','auto-reap','orphan','cleanup','wrapper','nested-cgroup','reject'):
        cmd = u.command('flat') if mode=='flat' else [sys.executable,str(Path(__file__).resolve()),'fixture',mode]
        path=OPS/(mode+'.kernel.json')
        if mode in reuse:
            assert hashlib.sha256(path.read_bytes()).hexdigest()==reuse[mode], 'reused evidence changed'
            r=json.loads(path.read_text())
        else:
            r=k.measure(cmd,path)
        assert r['diagnostic']['status']=='finalized-kernel-boundary',r
        supervisor=r['supervisor']['result']
        assert r['outerExit']==0 and supervisor['exit']==0 and supervisor['stopReason'] is None and supervisor['cleanupComplete'],r
        total=r['diagnostic']['kernelCPUSeconds']
        delta=total-r['outerWait4CPUSeconds']
        if mode=='auto-reap':
            lost=float(next(s.split()[1] for s in supervisor['output'].splitlines() if s.startswith('LOSTCPU ')))
            assert lost>=.25
            assert total>=lost+r['supervisor']['supervisorOwnAtPrint']-.01
            assert delta>lost-.06,(delta,lost)
            r['autoReapedSelfCPUSeconds']=lost
        else:
            # Both use kernel microseconds, not /proc ticks. Allow 60ms for
            # preattachment bootstrap and CPU-stat batching on this small test.
            assert abs(delta)<.06,(mode,total,r['outerWait4CPUSeconds'])
        assert total>=r['supervisor']['supervisorOwnAtPrint']-.01
        if mode=='nested-cgroup':
            nested=json.loads(next(s[7:] for s in supervisor['output'].splitlines() if s.startswith('NESTED ')))
            assert nested['removed'] and k.counters(nested['stat'])['usage_usec']>=200000
            assert total>=.20 and total < r['outerWait4CPUSeconds']+.06
        if mode=='short':
            pids={int(s.split()[1]) for s in supervisor['output'].splitlines() if s.startswith('SHORT ')}
            assert len(pids)==20 and pids-{v[0] for v in supervisor['owned']}
        if mode=='reject':
            inner=json.loads(next(s[7:] for s in supervisor['output'].splitlines() if s.startswith('REJECT ')))
            assert inner['stopReason']=='aggregate CPU limit' and total<10
        r['wait4DifferenceSeconds']=delta
        (OPS/(mode+'.kernel.json')).write_text(json.dumps(r,indent=2)+'\n')
        rows.append(dict(mode=mode,kernelCPUSeconds=total,wait4Seconds=r['outerWait4CPUSeconds'],delta=delta))
    original=r
    controls=[]
    for name,change in (
        ('missing ownership',lambda r:r.pop('ownership')),
        ('altered ownership',lambda r:r.update(ownershipFinal=[0,0,0])),
        ('pre-attachment execution',lambda r:r.update(attachedBeforeRelease=False)),
        ('invalid counter',lambda r:r.update(finalStat='usage_usec nan\n')),
        ('nonmonotonic counter',lambda r:r.update(initialStat='usage_usec 999999999\nuser_usec 0\nsystem_usec 0\n')),
        ('premature populated state',lambda r:r.update(finalEvents={'populated':1})),
        ('failed cleanup',lambda r:r.update(cleanupRemoved=False)),
        ('missing supervisor membership',lambda r:r.update(supervisorIncluded=False))):
        mutant=copy.deepcopy(original);change(mutant);verdict=k.validate(mutant)
        assert verdict['status']=='rejected' and verdict['kernelCPUSeconds'] is None,(name,verdict)
        controls.append(dict(name=name,verdict=verdict))
    (OPS/'mutation-controls.json').write_text(json.dumps(controls,indent=2)+'\n')
    print(json.dumps(dict(result='PASS bounded cooperative fixtures; arbitrary completeness UNKNOWN',rows=rows,controls=controls),indent=2))

if __name__=='__main__':
    if sys.argv[1]=='fixture':fixture(sys.argv[2])
    elif sys.argv[1]=='checks':checks()
    else:raise ValueError(sys.argv)
