import os, sys, json, time, signal, resource, subprocess, selectors, pathlib, shutil
base = pathlib.Path(__file__).resolve().parent.parent
ops = base / 'ops'
mode = sys.argv[1]
assert mode in ('cheap', 'native', 'publish')
native = mode == 'native'
admission = json.loads((ops / 'admission.json').read_text())
def allocated(path):
    if path.is_file(): return path.stat().st_blocks * 512
    return sum(p.stat().st_blocks * 512 for p in path.rglob('*') if p.is_file())
positive = sum(max(0, pathlib.Path(p).stat().st_size - before) for p, before in admission['sqliteBaseline'].items() if pathlib.Path(p).exists())
prior = ops / 'sqlite-highwater.json'
highwater = max(positive, json.loads(prior.read_text())['positive'] if prior.exists() else 0)
prior.write_text(json.dumps({'positive': highwater}))
charges = {'owned': allocated(base), 'session': allocated(pathlib.Path(admission['session'])),
 'launcher': allocated(pathlib.Path(admission['launcher'])), 'positiveSQLiteHighwater': highwater,
 'futureGitTempEvidence': 4 * 1048576, 'futureSessionLauncherSQLite': 20 * 1048576, 'reserve': 8 * 1048576}
free = shutil.disk_usage(base).free
mem = int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:'))) * 1024
peak = sum(charges.values())
r = {'charges': charges, 'peak': peak, 'cap': 67108864, 'free': free, 'otherReservation': 67108864,
 'afterProjected': free-peak-67108864, 'floor': 2982150144, 'memAvailable': mem,
 'memMinimum': 2684354560 if native else 805306368}
r['pass'] = peak <= r['cap'] and r['afterProjected'] >= r['floor'] and mem >= r['memMinimum']
(ops / (mode + '-admission.json')).write_text(json.dumps(r, indent=2))
assert r['pass'], r
if mode == 'publish':
    print(json.dumps(r)); sys.exit(0)
commands = {'cheap': ['node', '--max-old-space-size=256', 'test/test-maelstrom-head-yield-observer.js', str(ops/'run.js'), str(ops/'13-exports.wat')],
 'native': ['node', '--max-old-space-size=512', 'test/maelstrom-head-yield-native.cjs', str(ops/'run.js'), str(ops/'13-exports.wat'), '/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm']}
argv = commands[mode]
if native:
    import fcntl
    lock = open('/tmp/wine-ops-heavy-runtime.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    assert not (ops/'native-attempt.json').exists(), 'one native attempt only'
    (ops/'native-attempt.json').write_text(json.dumps({'argv':argv,'time':time.time(),'lock':'/tmp/wine-ops-heavy-runtime.lock'}))
def setup():
    os.setsid()
    resource.setrlimit(resource.RLIMIT_CPU, (90,90) if native else (60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE, (25165824,25165824))
start = time.monotonic()
p = subprocess.Popen(argv, cwd=base/'repo', stdout=subprocess.PIPE, stderr=subprocess.STDOUT, preexec_fn=setup)
s = selectors.DefaultSelector(); s.register(p.stdout, selectors.EVENT_READ)
output = bytearray(); reason = 'natural'; term = False; kill = False
while s.get_map():
    if time.monotonic() - start >= 60: reason = 'wall'; break
    for key, _ in s.select(.1):
        chunk = os.read(key.fileobj.fileno(), 16384)
        if not chunk: s.unregister(key.fileobj); continue
        if len(output) + len(chunk) > 131072: reason = 'output'; break
        output.extend(chunk)
    if reason != 'natural': break
if reason != 'natural':
    term = True; os.killpg(p.pid, signal.SIGTERM)
    try: p.wait(timeout=2)
    except subprocess.TimeoutExpired: kill = True; os.killpg(p.pid, signal.SIGKILL)
try: rc = p.wait(timeout=2)
except subprocess.TimeoutExpired:
    kill = True; os.killpg(p.pid, signal.SIGKILL); rc = p.wait(timeout=1)
try: os.killpg(p.pid, 0); remaining = True
except ProcessLookupError: remaining = False
if remaining:
    term = True; os.killpg(p.pid, signal.SIGTERM)
    time.sleep(.1)
    try: os.killpg(p.pid, 0); kill = True; os.killpg(p.pid, signal.SIGKILL)
    except ProcessLookupError: pass
    try: os.killpg(p.pid, 0); remaining = True
    except ProcessLookupError: remaining = False
(ops / (mode + '.log')).write_bytes(output)
result = {'argv':argv, 'cwd':str(base/'repo'), 'pgid':p.pid, 'returncode':rc, 'reason':reason,
 'TERM':term,'KILL':kill,'remainingGroup':remaining,'waitReaped':p.returncode is not None,
 'elapsed':time.monotonic()-start,'outputBytes':len(output),'memAvailable':mem,
 'limits':{'cpu':90 if native else 60,'wall':60,'heapMiB':512 if native else 256,'linearMiB':512 if native else 0,'pipeOutput':131072,'perFile':25165824}}
(ops / (mode + '-terminal.json')).write_text(json.dumps(result,indent=2))
print(json.dumps(result)); print(output.decode()[:6000])
sys.exit(rc if rc else (0 if reason == 'natural' and not remaining else 1))
