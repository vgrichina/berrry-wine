"""Retain only the assigned acceptance inputs; donors are read-only."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
RETAINED = Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-sparse-supervised-offset-live-charge-oct29/retained-evidence')
DISPATCH = Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-sparse-offset-runtime-independent-accept-oct29-dispatch.json')
MAPPING = {
    'retention-manifest.json': 'retention-manifest.json',
    'fixture.py': 'test/fixture.py',
    'runtime-observer.py': 'test/runtime-observer.py',
    'source-phase-oracle.json': 'test/source-phase-oracle.json',
    'runtime-canonical.json': 'test/runtime-canonical.json',
    'runtime-result.json': 'test/evidence/runtime-result.json',
    'runtime.stdout': 'test/evidence/runtime.stdout',
    'launch-config.json': 'test/evidence/launch-config.json',
    'previous-blocked-incident.json': 'test/evidence/previous-blocked-incident.json',
    'wal-accounting.json': 'test/evidence/wal-accounting.json',
    'coordinator-stopped-info.json': 'coordinator-stopped-info.json',
    'predecessor-REPORT.md': 'test/REPORT.md',
}


def main():
    target = HERE / 'inputs'
    target.mkdir(exist_ok=True)
    for name, source in MAPPING.items():
        (target / name).write_bytes((RETAINED / source).read_bytes())
    (HERE / 'input-map.json').write_text(json.dumps(MAPPING, indent=2) + '\n')
    (HERE / 'dispatch.json').write_bytes(DISPATCH.read_bytes())
    print(json.dumps(dict(retainedFiles=len(MAPPING), bytes=sum(p.stat().st_size for p in target.iterdir()))))


if __name__ == '__main__':
    main()
