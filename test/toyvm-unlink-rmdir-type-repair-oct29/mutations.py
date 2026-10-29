#!/usr/bin/env python3
"""Focused guard mutations; actual repaired source is read, never overwritten."""
import importlib.util
import json
import pathlib
import types
HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('contract', HERE / 'regression.py')
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)
Backend, pins = contract.load_backend(True)
source = (contract.REPO / contract.BACKEND).read_text()
guards = [line for line in source.splitlines(keepends=True)
          if "raise OSError(errno.EISDIR,'unlink directory')" in line
          or "raise OSError(errno.ENOTDIR,'rmdir non-directory')" in line]
assert len(guards) == 2
without = source.replace(guards[0], '').replace(guards[1], '')
removal = "            del n['names'][name];self.nodes[child]['links']-=1;self.collect(child)\n"
late = "            del n['names'][name]\n" + ''.join(guards) + "            self.nodes[child]['links']-=1;self.collect(child)\n"
assert without.count(removal) == 1
variants = {
    'remove-unlink': (source.replace(guards[0], ''), 4),
    'remove-rmdir': (source.replace(guards[1], ''), 2),
    'remove-both': (without, 6),
    'swap-errno': (source.replace('errno.EISDIR', 'errno.SWAP').replace('errno.ENOTDIR', 'errno.EISDIR').replace('errno.SWAP', 'errno.ENOTDIR'), 6),
    'late-after-namespace-removal': (without.replace(removal, late), 6),
}
results = []
for name, (mutant, expected) in variants.items():
    module = types.ModuleType('guard_mutant')
    exec(compile(mutant, str(contract.REPO / contract.BACKEND), 'exec'), module.__dict__)
    rows = [contract.exercise(module.Backend, case) for case in contract.CASES]
    failed = [r['name'] for r in rows if r['problems']]
    assert len(failed) == expected, (name, failed)
    results.append(dict(name=name, rejected=True, failedCases=failed, expectedFailures=expected))
result = dict(status='PASS', productionFileUnchanged=True, sourcePins=pins, mutations=results)
(HERE / 'mutations.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: all five remove/swap/late guard mutants rejected')
