"""Offline retained-evidence acceptance. Never mounts or executes production code."""
import ast, base64, copy, hashlib, json
from pathlib import Path
HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
INPUT = REPO / 'test/toyvm-integrated-evidenced-mounted-rename-oct30'

def check(ok, reason):
    if not ok:
        raise ValueError(reason)

def digest(data):
    return dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

def boundary(pins):
    # Earliest applicable boundary is retained CLI dispatch, not a new runtime run.
    for rel, expected in pins.items():
        check(digest((REPO / rel).read_bytes()) == expected, 'source-pin:' + rel)
    g = json.loads((INPUT / 'guards.json').read_text())
    a = g['argv']
    check(a[:3] == ['/usr/bin/python3', '-B', '/tmp/tvmr/repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'], 'runner-identity')
    check(a[3:5] == ['--rename-evidence', '16'], 'evidence-dispatch')
    check(a[a.index('--')+1:] == ['/usr/bin/python3', '-B', '-c', (INPUT / 'fixture.py').read_text(), '/tmp/tvmr/work/domain'], 'unchanged-reproducer')
    check(g['cwd'] == '/tmp/tvmr/repo', 'retained-cwd')
    backend = (REPO / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
    tree = ast.parse(backend)
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Backend')
    fn = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == 'record_rename_callback')
    fields = next(n for n in ast.walk(fn) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'dict')
    check([ast.unparse(k.value) for k in fields.keywords] == ['op', 'unique', 'ino', '-error', 'self.rename_callbacks'], 'serializer-values')
    check([k.arg for k in fields.keywords] == ['opcode', 'unique', 'inode', 'errno', 'callbackCount'], 'serializer-fields')
    check('self.record_rename_callback(op,unique,ino,error)' in backend and "unpack('2I2Q4I',raw)" in backend, 'request-header-source')
    return g

CASES = [('file-to-dir','file','dir',21), ('dir-to-file','dir','file',20),
         ('absent-parent','file','missing/new',2), ('nondirectory-parent','file','file/new',20),
         ('descendant-cycle','tree','tree/child/new',22), ('same-path','file','file',0)]

def accept(g, c, report, lifecycle, manifest, pins):
    check(report['files'] == {Path(k).name:v for k,v in pins.items() if k.startswith(str(INPUT.relative_to(REPO)) + '/') and not k.endswith('/report.json')}, 'report-file-pins')
    check(manifest['sourcePins'] == {k:v for k,v in pins.items() if k in manifest['sourcePins']}, 'manifest-source-pin')
    check(manifest['fixturePin'] == pins[str(INPUT.relative_to(REPO) / 'fixture.py')] and manifest['receiptPin'] == pins[str(INPUT.relative_to(REPO) / 'cancellation-receipt.json')], 'manifest-artifact-pin')
    check(g['exit'] == 0 and g['stderr'] == '' and g['identitiesAfter'] is True, 'execution-success')
    check(g['fixturePin'] == manifest['fixturePin'], 'fixture-identity')
    check(len(g['mountOwnership']) == 1 and ' /tmp/tvmr/work/domain ' in g['mountOwnership'][0] and 'fuse.toyvm-accounting' in g['mountOwnership'][0] and 'user_id=1000' in g['mountOwnership'][0], 'mount-observation')
    r = g['report']; b = r['backendReceipt']; f = b['filesystem']
    check(r['accepted'] is True and r['accountingAccepted'] is True and r['childSucceeded'] is True and r['failures'] == [] and r['browserAllowed'] is False, 'caller-accounting')
    check(b['exit'] == 0 and b['stopReason'] is None, 'backend-success')
    for key, value in dict(inodes=6, live=32768, peak=32768, written=26, openHandles=0, failure=None, liveLimit=262144, writeLimit=32768, fileLimit=32768).items():
        check(f[key] == value, 'accounting:' + key)
    check(0 < b['cpuSeconds'] <= 10 and 0 < b['wallSeconds'] <= 20 and 0 < b['peakRSS'] <= 67108864 and 0 < g['groupPeakRSS'] <= 512*1048576 and g['wall'] <= 90, 'accounting-bounds')
    out = b['output']; check(out['encoding'] == 'base64', 'payload-encoding')
    raw = base64.b64decode(out['data'], validate=True)
    check(len(raw) <= 8192, 'payload-bound')
    lines = raw.decode().splitlines()
    check(lines[-1] == 'MOUNTED_RENAME_GUARDS_COMPLETED' and len(lines) == 9, 'payload-completion')
    rows = [json.loads(line) for line in lines[:-1]]
    initial = rows[0]; check(initial['event'] == 'initial', 'initial-event')
    expected_initial = [['.',1,16832,1,0,None],['dir',2,16877,1,0,None],['file',5,33188,1,13,b'file-original'.hex()],['tree',3,16877,1,0,None],['tree/child',4,16877,1,0,None],['tree/child/leaf',6,33188,1,13,b'leaf-original'.hex()]]
    check(initial['tree'] == expected_initial, 'initial-tree')
    initial_hash = hashlib.sha256(json.dumps(expected_initial).encode()).hexdigest()
    for row, (name, src, dst, err) in zip(rows[1:7], CASES):
        check(row == dict(event='case', name=name, source=src, destination=dst, expected=err, actual=err, unchanged=True, treeSHA256=initial_hash), 'syscall-atomicity:' + name)
    v = rows[7]
    check(v['event'] == 'valid-cross-parent' and v['source'] == 'file' and v['destination'] == 'dir/moved,file', 'valid-route')
    expected_final = sorted([['dir/moved,file'] + row[1:] if row[0] == 'file' else row[:] for row in expected_initial])
    check(v['tree'] == expected_final and v['expectedTree'] == expected_final and v['correct'] is True, 'valid-tree')
    check(v['parents'] == dict(sourceParent=1, destinationParent=2), 'payload-parent-inodes')
    evidence = f['renameEvidence']
    check(evidence['limit'] == 16 and evidence['callbackCount'] == 1 and evidence['countSaturated'] is False and len(evidence['records']) == 1, 'callback-cardinality')
    callback = evidence['records'][0]
    check(callback == dict(opcode=12, unique=2162, inode=1, errno=0, callbackCount=1), 'callback-header')
    check(c['cases'] == rows[1:7] and c['validCrossParent'] == v and c['callback'] == callback and c['PASS'] is True and c['productionMutated'] is False, 'checkpoint-consistency')
    kernel = [x[0] for x in CASES]
    check(c['callbackObserved'] == report['callbackObserved'] == ['valid-cross-parent'] and c['kernelOnly'] == report['kernelOnly'] == kernel and report['callback'] == callback and report['mountedCases'] == 7 and report['PASS'] is True, 'coverage-scope')
    check(r['cleanupComplete'] is True and b['cleanupComplete'] is True and g['observerCleanup'] == dict(remainingMounts=[], workPathProcesses=[]), 'observer-cleanup')
    fc = b['filesystemCleanup']
    check(fc == dict(remainingMounts=[], serverExit=-15, serverStderr='', serverStdout='', unmountExit=0, unmountStderr='', unmountStdout=''), 'filesystem-cleanup')
    s = lifecycle['sandbox']
    check(s['id'] == 'bx_eyhtr684' and s['state'] == 'stopped' and s['snapshotAvailable'] is True and s['lastSnapshotStatus'] == 'completed' and s['snapshotCompletedAt'] == s['snapshotVerifiedAt'] and s['snapshotVerifiedAt'] <= s['stoppedAt'] and s['stop']['status'] == 'completed' and s['stop']['error'] is None and s['stop']['forced'] is False and s['ttlSeconds'] == 1800, 'snapshot-stopped-lifecycle')
    return dict(syscalls=7, callbackCases=['valid-cross-parent'], kernelOnly=kernel, destinationParent=2, destinationParentEvidence='payload tree, absent from callback fields', payloadSHA256=hashlib.sha256(raw).hexdigest(), boat=dict(id=s['id'], state=s['state'], snapshotVerifiedAt=s['snapshotVerifiedAt'], ttlSeconds=s['ttlSeconds']))

def main():
    pins = json.loads((HERE / 'pins.json').read_text())
    g = boundary(pins['files'])
    read = lambda name: json.loads((INPUT / name).read_text())
    args = [g, read('checkpoint.json'), read('report.json'), read('lifecycle.json'), read('manifest.json'), pins['files']]
    result = accept(*args)
    controls = []
    def control(name, reason, mutate):
        altered = copy.deepcopy(args)
        mutate(altered)
        try:
            accept(*altered)
        except ValueError as exc:
            check(str(exc) == reason, 'wrong-control-reason:' + name + ':' + str(exc))
            controls.append(dict(name=name, rejectedFor=str(exc)))
        else:
            raise ValueError('false-acceptance:' + name)
    fs = lambda a: a[0]['report']['backendReceipt']['filesystem']['renameEvidence']
    control('missing-callback', 'callback-cardinality', lambda a: fs(a)['records'].clear())
    control('duplicate-callback', 'callback-cardinality', lambda a: fs(a)['records'].append(copy.deepcopy(fs(a)['records'][0])))
    def bad_tree(a):
        out = a[0]['report']['backendReceipt']['output']
        lines = base64.b64decode(out['data']).decode().splitlines()
        v = json.loads(lines[7]); v['tree'][2][0] = 'dir/wrong,file'; v['expectedTree'] = copy.deepcopy(v['tree'])
        lines[7] = json.dumps(v)
        out['data'] = base64.b64encode(('\n'.join(lines)+'\n').encode()).decode()
        a[1]['validCrossParent'] = copy.deepcopy(v)
    control('self-consistent-wrong-destination-tree', 'valid-tree', bad_tree)
    def bad_pin(a):
        key = next(iter(a[4]['sourcePins']))
        a[4]['sourcePins'][key]['sha256'] = '0'*64
    control('source-pin-drift', 'manifest-source-pin', bad_pin)
    control('observer-residual-process', 'observer-cleanup', lambda a: a[0]['observerCleanup']['workPathProcesses'].append(999))
    control('snapshot-incomplete', 'snapshot-stopped-lifecycle', lambda a: a[3]['sandbox'].update(lastSnapshotStatus='failed'))
    result.update(decision='ACCEPT_RETAINED_SCOPED_EVIDENCE', candidate=pins['candidate'], controls=controls, runtimeReplayed=False, productionMutated=False, boundary='exact retained runner argv and unchanged fixture; pinned serializer AST and request header source', limitations=['No browser/gameplay acceptance', 'Six kernel-only cases have no backend callback coverage', 'Offline evidence consistency; no independent runtime observation or replay', 'Atomicity is retained before/after snapshot evidence, not concurrent visibility proof', 'Lifecycle is the retained API receipt, not a new live query'])
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
