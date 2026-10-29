#!/usr/bin/env python3
"""Run unchanged independent fixture/assertions with an explicit new source pin."""
import hashlib
from pathlib import Path
p = Path(__file__).with_name('tuxracer-parent-relative-independent-oct28.py')
source = p.parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
old = '5a47f748777d5b3a322e1c28b6acb78e13e6772f3cdb7d3b3d811c7e145b328e'
new = '69257615178adda7568036fc49e2f20b4ca602c6d3b734f1238caf6143021b17'
assert hashlib.sha256(source.read_bytes()).hexdigest() == new
text = p.read_text()
assert text.count(old) == 1
exec(compile(text.replace(old, new), str(p), 'exec'), dict(__file__=str(p), __name__='__main__'))
