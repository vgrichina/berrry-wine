"""Independent required-input mutation challenge; exact pinned production callback."""
import ast
import hashlib
import importlib.util
import json
import pathlib
import shutil
import tempfile

P = pathlib.Path
H = P(__file__).resolve().parent.parent
R = H / 'repo'
helper = R / 'test/helpers/palette-browser-supervisor.py'
wrapper = R / 'test/fixtures/gl-transient-accounting/remote-run.py'
spec = importlib.util.spec_from_file_location('accepted', helper)
sup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sup)
M = 1048576

def production(root):
    tree = ast.parse(wrapper.read_bytes())
    nodes = [n for n in tree.body if
             isinstance(n, ast.FunctionDef) and n.name in ('alloc', 'check') or
             isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'disk'
                                               for t in n.targets)]
    ns = dict(H=root, P=P, M=M, sup=sup, shutil=shutil, future=352*M,
              accounting=dict(samples=0, peakProjected=0, minFree=None, minMem=None))
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(wrapper), 'exec'), ns)
    return ns['check'], ns['disk']

def metadata(p):
    s = p.stat()
    return dict(dev=s.st_dev, ino=s.st_ino, size=s.st_size, blocks=s.st_blocks,
                mtime_ns=s.st_mtime_ns, ctime_ns=s.st_ctime_ns)

results = []
for boundary in ('retained-production-callback', 'shared-accounting-check'):
    with tempfile.TemporaryDirectory(dir=H/'ops') as t:
        root = P(t)
        (root/'tmp').mkdir()
        required = root/'required-pinned-input'
        required.write_bytes(b'R'*16384)
        if boundary == 'retained-production-callback':
            check, ledger = production(root)
        else:
            check = sup.accounting_check(dict(roots=[str(root)], transientRoots=[str(root/'tmp')],
                                             reserve=8*M, future=0, walBaseline={}))
            ledger = None
        assert check() is None, 'initial stable required input must pass'
        before = metadata(required)
        # Between accepted samples: same inode, no root/directory replacement.
        # This changes a required input, not an explicitly transient entry.
        with required.open('wb'):
            pass
        after = metadata(required)
        assert (before['dev'],before['ino']) == (after['dev'],after['ino'])
        assert before['blocks'] > 0 and after['blocks'] == 0
        rejected = False
        try:
            actual = check()
        except sup.AccountingUnknown as error:
            rejected = True
            actual = repr(error)
        if actual is not None:
            rejected = True
        results.append(dict(boundary=boundary, before=before, after=after,
                            requiredMutationRejected=rejected, actual=actual,
                            ledgerReceipt=ledger.receipt.copy() if ledger else check.receipt.copy()))
receipt = dict(candidate='9e7b74218b6518534638efdd9a48310df7b6f1ad',
               helperSHA256=hashlib.sha256(helper.read_bytes()).hexdigest(),
               wrapperSHA256=hashlib.sha256(wrapper.read_bytes()).hexdigest(),
               results=results)
(H/'ops/required-cross-sample-result.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt, indent=2))
assert all(r['requiredMutationRejected'] for r in results), 'required input truncation silently accepted at unchanged production/shared boundary'
