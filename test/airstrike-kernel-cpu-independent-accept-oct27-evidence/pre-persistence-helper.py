"""Additive cooperative-workload diagnostic; never an enforcing supervisor.

Boundary: fresh group's initial cpu.stat through verified populated=0. Includes
post-attachment bootstrap, exec/imports, invoked trusted supervisor and descendants.
Pre-attachment bootstrap and outside observer CPU are separate, not covered.
Same-UID migration is possible: arbitrary invocation completeness stays UNKNOWN.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import resource
import select
import stat
import sys
import tempfile
import time
import uuid

TRUSTED = Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
PIN = '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'


def counters(raw, required=('usage_usec', 'user_usec', 'system_usec')):
    result = {}
    for line in raw.splitlines():
        key, value = line.split()
        if key in result or not value.isdecimal():
            raise ValueError('invalid/duplicate counter')
        result[key] = int(value)
    if not set(required) <= result.keys():
        raise ValueError('missing counters')
    return result


def identity(path):
    s = path.lstat()
    if not stat.S_ISDIR(s.st_mode) or s.st_uid != os.getuid():
        raise ValueError('unowned group')
    return [s.st_dev, s.st_ino, s.st_uid]


def membership(pid):
    lines = Path('/proc', str(pid), 'cgroup').read_text().splitlines()
    unified = [line[3:] for line in lines if line.startswith('0::')]
    if len(unified) != 1:
        raise ValueError('no unique unified membership')
    return unified[0]


def scope():
    mounts = [line.split() for line in Path('/proc/self/mountinfo').read_text().splitlines() if ' - cgroup2 ' in line]
    candidates = [m for m in mounts if m[3] == '/' and m[4] == '/sys/fs/cgroup' and 'rw' in m[5].split(',')]
    if len(candidates) != 1:
        raise ValueError('unsupported cgroup2 mount mapping')
    relative = membership('self')
    if '..' in Path(relative).parts:
        raise ValueError('invalid membership')
    parent = Path('/sys/fs/cgroup') / relative.lstrip('/')
    if not os.access(parent, os.W_OK):
        raise PermissionError('current scope not delegated writable')
    return parent


def validate(r):
    """Fail closed: no finalized number on any missing/mutated prerequisite."""
    errors = []
    for flag in ('exclusiveFreshCreation', 'emptyInitially', 'attachedBeforeRelease',
                 'childConfirmedMembership', 'supervisorIncluded', 'quiescent', 'cleanupRemoved'):
        if r.get(flag) is not True:
            errors.append(flag)
    if not r.get('ownership') or r.get('ownership') != r.get('ownershipFinal'):
        errors.append('ownership')
    if r.get('finalEvents', {}).get('populated') != 0:
        errors.append('premature populated state')
    try:
        a, b = counters(r['initialStat']), counters(r['finalStat'])
        if any(b[k] < a[k] for k in ('usage_usec', 'user_usec', 'system_usec')):
            raise ValueError('nonmonotonic counters')
        seconds = (b['usage_usec'] - a['usage_usec']) / 1e6
    except (KeyError, ValueError, TypeError) as e:
        errors.append(str(e)); seconds = None
    return dict(status='rejected' if errors else 'finalized-kernel-boundary',
                kernelCPUSeconds=None if errors else seconds, problems=errors,
                invocationCompleteness='UNKNOWN', diagnosticOnly=True)


def measure(argv, evidence_path):
    assert hashlib.sha256(TRUSTED.read_bytes()).hexdigest() == PIN
    observer = time.process_time()
    parent = scope()
    controls = (parent/'cgroup.subtree_control').read_text()
    group = parent / ('airstrike-cpu-oct27-' + uuid.uuid4().hex)
    r = dict(boundary=__doc__, authoritativeGuardSHA256=PIN, command=argv,
             parent=str(parent), group=str(group), parentControlsBefore=controls)
    # mkdir must be exclusive; never adopt/remove an existing group.
    group.mkdir()
    r.update(exclusiveFreshCreation=True, ownership=identity(group))
    pid = None
    gate_r, gate_w = os.pipe()
    ready_r, ready_w = os.pipe()
    try:
        r['initialStat'] = (group/'cpu.stat').read_text()
        r['initialEvents'] = counters((group/'cgroup.events').read_text(), ('populated',))
        r['emptyInitially'] = (group/'cgroup.procs').read_text().strip() == '' and r['initialEvents']['populated'] == 0
        assert r['emptyInitially'] and counters(r['initialStat'])['usage_usec'] == 0
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            pid = os.fork()
            if pid == 0:
                try:
                    os.close(gate_w); os.close(ready_r)
                    # No fixture or supervisor may run until parent attaches us.
                    u = resource.getrusage(resource.RUSAGE_SELF)
                    os.write(ready_w, json.dumps(dict(pid=os.getpid(), preBarrierOwnCPU=u.ru_utime+u.ru_stime)).encode()+b'\n')
                    os.close(ready_w)
                    if os.read(gate_r, 1) != b'G':
                        os._exit(124)
                    os.close(gate_r)
                    assert membership('self') == '/' + str(group.relative_to('/sys/fs/cgroup'))
                    os.dup2(out.fileno(), 1); os.dup2(err.fileno(), 2)
                    os.execv(sys.executable, [sys.executable, str(Path(__file__).resolve()), 'supervise', str(group), *argv])
                except BaseException as e:
                    os.write(err.fileno(), (repr(e)+'\n').encode()); os._exit(125)
            os.close(gate_r); gate_r = -1
            os.close(ready_w); ready_w = -1
            if not select.select([ready_r], [], [], 5)[0]:
                raise TimeoutError('bootstrap readiness')
            r['bootstrap'] = json.loads(os.read(ready_r, 4096))
            r['beforeAttachmentMembership'] = membership(pid)
            assert r['beforeAttachmentMembership'] != '/' + str(group.relative_to('/sys/fs/cgroup'))
            assert out.tell() == 0 and err.tell() == 0
            r['preAttachmentNoExecOutput'] = True
            r['bootstrapIdentity'] = [pid, Path('/proc', str(pid), 'stat').read_text().rsplit(')', 1)[1].split()[19]]
            assert r['bootstrap']['pid'] == pid
            (group/'cgroup.procs').write_text(str(pid))
            r['attachedMembership'] = membership(pid)
            r['attachedBeforeRelease'] = r['attachedMembership'] == '/' + str(group.relative_to('/sys/fs/cgroup')) and (group/'cgroup.procs').read_text().split() == [str(pid)]
            assert r['attachedBeforeRelease']
            os.write(gate_w, b'G'); os.close(gate_w); gate_w = -1
            _, status, u = os.wait4(pid, 0); pid = None
            r['outerExit'] = os.waitstatus_to_exitcode(status)
            r['outerWait4CPUSeconds'] = u.ru_utime+u.ru_stime
            out.seek(0); err.seek(0)
            r['stderr'] = err.read(2*1024**2).decode()
            r['supervisor'] = json.load(out)
            r['childConfirmedMembership'] = r['supervisor']['membership'] == r['attachedMembership']
            r['supervisorIncluded'] = r['childConfirmedMembership'] and r['supervisor']['guardSHA256'] == PIN
        deadline = time.monotonic()+3
        while (group/'cgroup.events').read_text().split('populated ')[1].split()[0] != '0':
            if time.monotonic() > deadline:
                raise TimeoutError('group still populated: no finalized receipt/removal')
            time.sleep(.01)
        r['finalEvents'] = counters((group/'cgroup.events').read_text(), ('populated',))
        r['quiescent'] = r['finalEvents']['populated'] == 0
        r['ownershipFinal'] = identity(group)
        assert r['ownershipFinal'] == r['ownership']
        r['finalStat'] = (group/'cpu.stat').read_text()
        # No recursive removal, no cgroup.kill, no parent changes.
        group.rmdir(); r['cleanupRemoved'] = not group.exists()
        r['parentControlsAfter'] = (parent/'cgroup.subtree_control').read_text()
        assert r['parentControlsAfter'] == controls
        r['observerOwnCPUSeconds'] = time.process_time()-observer
        r['outsideBoundaryAccounting'] = 'observer measured separately; preBarrierOwnCPU excludes pipe/report/blocking tail; exact preattachment lifetime UNKNOWN, not added to kernel total'
        r['diagnostic'] = validate(r)
        return r
    finally:
        Path(evidence_path).write_text(json.dumps(r, indent=2)+'\n')
        for fd in (gate_r, gate_w, ready_r, ready_w):
            if fd >= 0:
                os.close(fd)
        # An error never removes a populated or identity-changed group. Outer
        # trusted supervisor owns descendant cleanup. Keep causal path evidence.
        if pid is None and group.exists() and identity(group) == r['ownership'] and counters((group/'cgroup.events').read_text(), ('populated',))['populated'] == 0:
            group.rmdir()


if __name__ == '__main__':
    assert sys.argv[1] == 'supervise'
    expected = Path(sys.argv[2])
    assert membership('self') == '/' + str(expected.relative_to('/sys/fs/cgroup'))
    assert hashlib.sha256(TRUSTED.read_bytes()).hexdigest() == PIN
    spec = importlib.util.spec_from_file_location('trusted', TRUSTED)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    result = m.supervise(sys.argv[3:], rss_limit=128*1024**2)
    result['output'] = result['output'].decode()
    own = resource.getrusage(resource.RUSAGE_SELF)
    print(json.dumps(dict(result=result, membership=membership('self'), guardSHA256=PIN,
                         supervisorOwnAtPrint=own.ru_utime+own.ru_stime)), flush=True)
