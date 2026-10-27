import hashlib
import importlib.util
import json
import pathlib
import shutil
import sys

H = pathlib.Path(__file__).parent
R = H.parent/'repo'
P = pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(P.read_bytes()).hexdigest() == '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
spec = importlib.util.spec_from_file_location('supervisor', P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
baseline = json.loads((H/'admission.json').read_text())
def check():
    used = sum(p.stat().st_blocks*512 for p in H.parent.rglob('*') if p.is_file())
    launch = pathlib.Path(baseline['launcher'])
    external = sum(p.stat().st_blocks*512 for p in launch.rglob('*') if p.is_file())
    if 'session' in baseline:
        external += pathlib.Path(baseline['session']).stat().st_blocks*512
    external += sum(max(0, pathlib.Path(p).stat().st_blocks*512-n) for p,n in baseline['walBaseline'].items())
    if used+external+8*1048576 > 32*1048576:
        return 'task disk ceiling'
    if shutil.disk_usage(H).free-96*1048576 < 2982150144:
        return 'projected free floor'
    mem = int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
    if mem < baseline['memoryRequired']:
        return 'aggregate memory admission'
assert check() is None, check()
result = m.supervise([sys.executable, '-B', str(R/'test/test-airstrike-menu-controller.py')],
                     rss_limit=128*1048576, cpu_limit=90, wall_limit=120,
                     output_limit=2*1048576, check=check)
(H/'tests.log').write_bytes(result.pop('output'))
(H/'tests.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
print((H/'tests.log').read_text()[:8192])
assert result['exit'] == 0 and result['stopReason'] is None and result['cleanupComplete']
