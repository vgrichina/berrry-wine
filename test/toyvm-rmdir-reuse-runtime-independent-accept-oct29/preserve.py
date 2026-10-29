"""Retain bounded supervisor receipts; no subprocess or runtime execution."""
import pathlib
import shutil
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
out = HERE / 'checks'
out.mkdir(exist_ok=True)
for p in (ROOT / 'e').iterdir():
    if p.is_file():
        shutil.copyfile(p, out / p.name)
for name in ['prelaunch-controls.json', 'dispatch-preflight.json', 'git-readiness.json', 'quota-preflight.json']:
    shutil.copyfile(ROOT / name, out / name)
assert sum(p.stat().st_size for p in HERE.rglob('*') if p.is_file()) < 1024*1024
print('Bounded check/source receipts retained')
