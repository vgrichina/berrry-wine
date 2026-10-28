#!/usr/bin/env python3
"""Independent delta acceptance. No Tcl execution or original media.

Expected to fail on the pinned rejected candidate at the first inert-data case.
Run with a fresh owned output directory; first test reuses the unchanged earliest
parent-relative reproducer. Remaining challenges stop at the first defect.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

SOURCE = Path(__file__).resolve().parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == '5a47f748777d5b3a322e1c28b6acb78e13e6772f3cdb7d3b3d811c7e145b328e'
spec = importlib.util.spec_from_file_location('production', SOURCE)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
OUT = Path(sys.argv[1]); OUT.mkdir()
results = []

def record(label, **data):
    results.append(dict(check=label, **data))
    (OUT/'results.json').write_text(json.dumps(results, indent=2)+'\n')

def parent(tool):
    root = OUT/'parent'; root.mkdir(exist_ok=True)
    script = root/'courses/common/moon.tcl'; script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text('source ../common/walk.tcl\n')
    (script.parent/'walk.tcl').write_text('# leaf\n')
    result = tool.literal_sources(root, {'files':[{'path':'courses/common/moon.tcl'}, {'path':'courses/common/walk.tcl'}]})
    assert result['checked'] == [{'script':'courses/common/moon.tcl', 'literal':'../common/walk.tcl', 'candidatesPresent':['courses/common/walk.tcl']}], result
    assert result['unknown'] == [], result
    assert 'not runtime resolution' in result['limitations']
    return result

record('00_exact_production_parent_boundary', outcome='PASS', result=parent(r))
# Independently invert only parent-stack popping: the initial production fixture
# must detect that parent traversal no longer reaches the retained candidate.
source = SOURCE.read_text()
assert source.count('parts.pop()') == 1
mutant = source.replace('parts.pop()', "parts.append('__broken_parent__')")
namespace = dict(r.__dict__)
exec(compile(mutant, str(SOURCE)+':independent-stack-mutation', 'exec'), namespace)
try:
    parent(SimpleNamespace(**namespace))
except (AssertionError, r.Rejected, namespace['Rejected']) as error:
    record('01_parent_stack_mutation', outcome='KILLED', errorType=type(error).__name__, error=str(error))
else:
    raise AssertionError('parent stack mutant survived')

# Tcl braced word contents are data for set, not standalone commands. This is
# a literal script, never evaluated here. The newly supported parent reference
# inside that data must not become a missing dependency or a checked source.
root = OUT/'inert-braced-data'; root.mkdir()
script = root/'courses/common/moon.tcl'; script.parent.mkdir(parents=True)
script.write_bytes(b'set description {\nsource ../common/absent.tcl\n}\n')
inventory = {'files':[{'path':'courses/common/moon.tcl'}]}
(root/'inventory.json').write_text(json.dumps(inventory, indent=2)+'\n')
try:
    result = r.literal_sources(root, inventory)
except r.Rejected as error:
    record('02_inert_braced_data', outcome='REJECT_CANDIDATE', expected='no missing literal dependency from braced set data; conservative unknown is acceptable', actual=str(error), script=str(script), inventory=inventory)
    raise AssertionError('decisive defect: inert braced data falsely rejected as a parent-relative source') from error
assert result['checked'] == [], result
record('02_inert_braced_data', outcome='PASS', result=result)
