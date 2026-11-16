"""Sealed Git source and native module view for renderer startup qualification.

Git and the recorded binary patches remain the source archive. No source tree
or module is copied to a run directory. Foreign shared-tree WIP is not adopted.
"""
from pathlib import Path
import subprocess, os, fcntl, hashlib, json, sys, struct, time, re, base64

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve()
head, kind, args = sys.argv[2], sys.argv[3], sys.argv[4:]
assert re.fullmatch('[a-f0-9]{40}', head) and kind in ['runtime', 'build', 'checks', 'shared', 'hold']
assert out.is_dir() and (args or kind == 'hold')
assert (out/'watchdog-armed.json').is_file(), 'independent supervisor watchdog required'
def seal_module():
    holder_path = os.environ.get('GTA2_MODULE_HOLDER')
    source = root/'build/wine-assembly.wasm'
    if holder_path:
        holder = json.loads(Path(holder_path).read_text())
        stat = Path('/proc/'+str(holder['pid'])+'/stat').read_text()
        assert stat[stat.rindex(')')+2:].split()[19] == holder['startToken']
        assert holder['sealed'] == 15
        # Publishing this lane's tooling does not rebuild guest code. Prove
        # that the retained module's actual Git build inputs remain equal.
        changed = subprocess.check_output(['git','diff','--name-only',holder['head'],head],cwd=root).decode().splitlines()
        lane_tools = {'tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',
                      'tools/gta2-renderer-startup-runtime.py','tools/gta2-renderer-startup-runtime.cjs'}
        assert not [p for p in changed if p.startswith(('src/','lib/','tools/')) and p not in lane_tools], 'module build inputs changed since holder'

        assert not Path(holder['stopFile']).exists(), 'module holder already stopping'
        source = Path(holder['fdPath'])
    with source.open('rb') as stream:
        before = os.fstat(stream.fileno()); body = stream.read(); after = os.fstat(stream.fileno())
    assert (before.st_ino,before.st_size,before.st_mtime_ns) == (after.st_ino,after.st_size,after.st_mtime_ns)
    assert body[:4] == b'\0asm' and len(body) == before.st_size
    digest = hashlib.sha256(body).hexdigest()
    if holder_path: assert digest == holder['sha256']
    handle = os.memfd_create('gta2-native-module', os.MFD_CLOEXEC | os.MFD_ALLOW_SEALING)
    with os.fdopen(os.dup(handle), 'wb') as stream: stream.write(body)
    os.lseek(handle, 0, os.SEEK_SET)
    fcntl.fcntl(handle, fcntl.F_ADD_SEALS, 15)
    assert fcntl.fcntl(handle, fcntl.F_GET_SEALS) == 15
    info = dict(head=head,sha256=digest,size=len(body),storage='sealed transient memfd; no dump',
                fromHolder=holder_path,moduleSourceHead=holder['head'] if holder_path else head,sealed=15)
    (out/'frozen-module.json').write_text(json.dumps(info)+'\n')
    return handle, digest

if kind == 'hold':
    handle, digest = seal_module()
    stat = Path('/proc/'+str(os.getpid())+'/stat').read_text()
    info = dict(head=head,sha256=digest,pid=os.getpid(),sealed=15,
                startToken=stat[stat.rindex(')')+2:].split()[19],
                fdPath='/proc/'+str(os.getpid())+'/fd/'+str(handle),stopFile=str(out/'stop.json'))
    (out/'holder.json').write_text(json.dumps(info)+'\n')
    while not (out/'stop.json').exists(): time.sleep(.05)
    os.close(handle)
    (out/'holder-closed.json').write_text(json.dumps(dict(at=time.time(),closed=True))+'\n')
    sys.exit(0)

owned = ['test/gta2-paired-controller.test.cjs', 'test/test-gta2-renderer-startup-publication.cjs',
         'test/test-gta2-worker-complete-confirmation.cjs',
         'tools/gta2-renderer-startup-runtime.py', 'tools/gta2-renderer-startup-runtime.cjs',
         'docs/re-notes/gta2-renderer-startup-publication-repair-20261116.md',
         'tools/gta2-browser-release-binding.cjs', 'tools/gta2-paired-controller.cjs',
         'tools/gta2-verified-source-view.cjs',
         'tools/gta2-user-readiness-source-view.py', 'test/test-gta2-native-user-readiness.cjs',
         'test/test-gta2-fresh-attestation-prearm.cjs',
         'docs/re-notes/gta2-native-user-readiness-repair-20261116.md',
         'build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm', 'build/combined.wat']
# One deduplicated Git patch per source state, never a source-tree snapshot.
# Build products are recoverable from the recorded source and build command;
# no WASM body or combined source dump is written into evidence.
patches, source_pins = [], {}
for name in owned:
    if name.startswith('build/') or not (root/name).is_file():
        continue
    source_pins[name] = hashlib.sha256((root/name).read_bytes()).hexdigest()
    tracked_path = subprocess.run(['git', 'ls-files', '--error-unmatch', '--', name],
                                  cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    command = (['git', 'diff', '--binary', head, '--', name] if tracked_path else
               ['git', 'diff', '--no-index', '--binary', '--', '/dev/null', name])
    diff = subprocess.run(command, cwd=root, capture_output=True)
    assert diff.returncode in ([0] if tracked_path else [1]) and not diff.stderr
    patches.append(diff.stdout)
patch = b''.join(patches)
patch_sha = hashlib.sha256(patch).hexdigest()
patch_path = out.parent/('source-state-'+patch_sha+'.patch')
if patch_path.exists():
    assert patch_path.read_bytes() == patch
else:
    patch_path.write_bytes(patch)
(out/'source-state.json').write_text(json.dumps(dict(
    head=head, patchPath=os.path.relpath(patch_path, out), patchSHA256=patch_sha,
    sourcePins=source_pins, foreignWIPAdopted=False, sourceArchive='Git plus owned binary patch'))+'\n')
if kind == 'shared':
    assert not os.environ.get('NODE_OPTIONS') and not os.environ.get('GTA2_VIEW_HEAD'), 'shared checks must use live checkout'
    changed = subprocess.check_output(['git', 'diff', '--name-only'], cwd=root).decode().splitlines()
    relevant = [p for p in changed if p.startswith(('src/', 'lib/', 'tools/', 'test/')) or p == 'host.js']
    relevant = [p for p in relevant if not p.startswith('test/binaries/') and re.search(r'\.(?:js|cjs|json|py|wat|watx)$', p)]
    foreign_patch = subprocess.check_output(['git', 'diff', '--binary', head, '--', *relevant], cwd=root) if relevant else b''
    foreign_sha = hashlib.sha256(foreign_patch).hexdigest()
    foreign_path = out.parent/('shared-source-'+foreign_sha+'.patch')
    if foreign_path.exists():
        assert foreign_path.read_bytes() == foreign_patch
    else:
        foreign_path.write_bytes(foreign_patch)
    p = subprocess.Popen(args, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    (out/'source-view-start.json').write_text(json.dumps(dict(
        head=head, kind=kind, args=args, pid=os.getpid(), childPID=p.pid, started=time.time(),
        sourceStorage='live shared checkout; foreign WIP unadopted',
        relevantPatchPath=os.path.relpath(foreign_path, out), relevantPatchSHA256=foreign_sha,
        relevantCurrentPins={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in relevant}))+'\n')
    a, b = p.communicate()
    (out/'source-view-child.stdout.log').write_bytes(a)
    (out/'source-view-child.stderr.log').write_bytes(b)
    (out/'source-view-child-wait.json').write_text(json.dumps(dict(
        pid=p.pid, exit=p.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True, at=time.time()))+'\n')
    sys.exit(p.returncode)
lines = subprocess.check_output(['git', 'ls-tree', '-r', '--format=%(objectname) %(path)', head], cwd=root).decode().splitlines()
tree = [(line[41:], line[:40]) for line in lines]
tracked = [p for p, _ in tree if re.search(r'\.(?:js|cjs|json|html|wat|watx)$', p)
           and not p.startswith(('scratch/', 'test/binaries/'))]


def selected(p):
    if kind != 'runtime':
        return p in tracked
    return re.fullmatch(r'(?:host\.js|index\.html|src/api_table\.json|fonts/substitutions\.json|'
                        r'lib/(?:[^/]+/)*[^/]+\.(?:js|json)|test/static-server\.js|'
                        r'test/gta2-paired-controller\.test\.cjs|test/test-gta2-(?:current-scene-prearm|'
                        r'fresh-attestation-prearm|browser-release-scene-binding|directx-version-causal-repair|'
                        r'worker-complete-confirmation|final-pin-prearm-scheduling)\.cjs)', p)


files = [(p, oid) for p, oid in tree if p not in owned and selected(p)]
raw = subprocess.run(['git', 'cat-file', '--batch'], cwd=root,
                     input=('\n'.join(oid for _, oid in files)+'\n').encode(), capture_output=True, check=True).stdout
cursor, items, bodies = 0, [], []
for name, oid in files:
    end = raw.index(b'\n', cursor)
    got, typ, size = raw[cursor:end].decode().split()
    size, cursor = int(size), end+1
    assert got == oid and typ == 'blob'
    body = raw[cursor:cursor+size]
    cursor += size
    assert len(body) == size and raw[cursor:cursor+1] == b'\n'
    cursor += 1
    assert hashlib.sha1(b'blob '+str(size).encode()+b'\0'+body).hexdigest() == oid
    items.append(dict(path=name, oid=oid, size=size))
    bodies.append(body)
assert cursor == len(raw)
if kind == 'runtime':
    module_fd, module_sha = seal_module()
manifest = json.dumps(dict(head=head, owned=owned, trackedSource=tracked, files=items), separators=(',', ':')).encode()
pool = struct.pack('>I', len(manifest))+manifest+b''.join(bodies)
fd = os.memfd_create('gta2-renderer-startup-sealed-inputs', os.MFD_CLOEXEC | os.MFD_ALLOW_SEALING)
with os.fdopen(os.dup(fd), 'wb') as stream:
    stream.write(pool)
os.lseek(fd, 0, os.SEEK_SET)
seals = fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_SEAL
fcntl.fcntl(fd, fcntl.F_ADD_SEALS, seals)
assert fcntl.fcntl(fd, fcntl.F_GET_SEALS) == seals
env = dict(os.environ, GTA2_VIEW_HEAD=head, GTA2_PIN_VIEW_HEAD=head,
           GTA2_PIN_VIEW_FD='/proc/'+str(os.getpid())+'/fd/'+str(fd), GTA2_PIN_VIEW_OUT=str(out))
preload = root/('tools/gta2-renderer-startup-runtime.cjs' if kind == 'runtime' else 'tools/gta2-verified-source-view.cjs')
preload_sha = hashlib.sha256(preload.read_bytes()).hexdigest()
bootstrap = '''import {createRequire} from 'node:module';
const require=createRequire(%s),Module=require('node:module'),path=require('node:path');
const filename=%s,bytes=require('node:fs').readFileSync(filename);
const hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
if(hash!==%s)throw Error('exact executed source-view preload changed');
Object.defineProperty(globalThis,'__gta2VerifiedViewExecutedSHA256',{value:require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(path.join(path.dirname(filename),'gta2-verified-source-view.cjs'))).digest('hex')});
const exact=new Module(filename);exact.filename=filename;exact.paths=Module._nodeModulePaths(path.dirname(filename));
exact._compile(bytes.toString('utf8'),filename);exact.loaded=true;require.cache[filename]=exact;
''' % (json.dumps(str(preload)), json.dumps(str(preload)), json.dumps(preload_sha))
if kind == 'runtime':
    env['GTA2_FROZEN_MODULE_SHA256'] = module_sha
    env['GTA2_FROZEN_MODULE_FD'] = '/proc/'+str(os.getpid())+'/fd/'+str(module_fd)
env['NODE_OPTIONS'] = '--import=data:text/javascript;base64,'+base64.b64encode(bootstrap.encode()).decode()
p = subprocess.Popen(args, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
(out/'source-view-start.json').write_text(json.dumps(dict(
    head=head, kind=kind, args=args, started=time.time(), pid=os.getpid(), childPID=p.pid,
    gitBlobCount=len(files), poolSHA256=hashlib.sha256(pool).hexdigest(),
    manifestSHA256=hashlib.sha256(pool[:4+len(manifest)]).hexdigest(), bytes=len(pool), seals=seals,
    executedPreloadExpectedSHA256=preload_sha, bootstrapSHA256=hashlib.sha256(bootstrap.encode()).hexdigest(),
    sourceStorage='sealed transient memfd only', ownedBytesRetained=False, perImportGit=False))+'\n')
a, b = p.communicate()
(out/'source-view-child.stdout.log').write_bytes(a)
(out/'source-view-child.stderr.log').write_bytes(b)
(out/'source-view-child-wait.json').write_text(json.dumps(dict(
    pid=p.pid, exit=p.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True, at=time.time()))+'\n')
os.close(fd)
if kind == 'runtime': os.close(module_fd)
sys.exit(p.returncode)
