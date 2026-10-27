"""Retarget immutable independent assertions to this repair; no assertion edits.

RICOCHET_ACCEPT_OPS must name an owned evidence directory. Historical tests keep
their original bytes and failure target. Explicitly select affected methods;
historical test11 is intentionally still a rejection of the historical writer.
"""
import hashlib
import json
import os
import pathlib
import sys

R = pathlib.Path(__file__).resolve().parents[1]
O = pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS'])
p = R/'test/ricochet-consumed-independent.test.py'
source = p.read_bytes()
assert hashlib.sha256(source).hexdigest() == 'd8fceb1cbf2d08eb7550998aa52d4eff245d0c684c82dff14376ad956c631551'
text = source.decode()
text = text.replace("D=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo')", 'D=pathlib.Path('+repr(str(R))+')')
helper = hashlib.sha256((R/'tools/ricochet/runtime-accounting.py').read_bytes()).hexdigest()
text = text.replace("HELPER:'857e30508c1e4db1c943b765a0e7551842973032cc5431eb08235dabda903364'", 'HELPER:'+repr(helper))
(O/'independent-retarget.json').write_text(json.dumps(dict(originalSHA256=hashlib.sha256(source).hexdigest(), retargetSHA256=hashlib.sha256(text.encode()).hexdigest(), helperSHA256=helper, onlyChanges='D and expected helper pin; all assertions unchanged'), indent=2))
exec(compile(text, str(p), 'exec'), globals())
