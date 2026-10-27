import pathlib,os,json,hashlib,resource,subprocess,importlib.util,sys,shutil,datetime
import contextlib
import os
import pathlib
import stat


class OutputFiles:
    def __init__(self, root):
        self.root = pathlib.Path(root)
        self.identities = None
        self.staging = set()
        with self.directory():
            pass

    @staticmethod
    def identity(st):
        return st.st_dev, st.st_ino

    @staticmethod
    def regular(st):
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
            raise RuntimeError('output must be a single-link regular file')
        return st

    @staticmethod
    def name(name):
        if not name or name in ('.', '..') or '/' in name or '\x00' in name:
            raise ValueError('output name must be a basename')
        return name

    @contextlib.contextmanager
    def directory(self):
        fds = []
        try:
            for name in (self.root, 'ops', 'output'):
                fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                             dir_fd=fds[-1] if fds else None)
                fds.append(fd)
            identities = tuple(self.identity(os.fstat(fd)) for fd in fds)
            if self.identities is None:
                self.identities = identities
            if identities != self.identities:
                raise RuntimeError('output directory identity changed')
            yield fds[-1]
        finally:
            for fd in reversed(fds):
                os.close(fd)

    def verify(self, fd):
        with self.directory() as current:
            if self.identity(os.fstat(current)) != self.identity(os.fstat(fd)):
                raise RuntimeError('output directory replaced')
        names = sorted(os.listdir(fd))
        for name in names:
            self.regular(os.stat(name, dir_fd=fd, follow_symlinks=False))
        return names

    def bound(self, directory, name, fd):
        st = self.regular(os.fstat(fd))
        leaf = self.regular(os.stat(name, dir_fd=directory, follow_symlinks=False))
        if self.identity(st) != self.identity(leaf):
            raise RuntimeError('output file identity changed')
        self.verify(directory)
        return st

    def check(self):
        with self.directory() as directory:
            self.verify(directory)

    @contextlib.contextmanager
    def anonymous(self, directory):
        # Linux O_TMPFILE WITHOUT O_EXCL permits later linkat publication. Never
        # fall back to a named writable inode: a pre/post nlink check races link.
        if not hasattr(os, 'O_TMPFILE'):
            raise RuntimeError('Linux O_TMPFILE output staging required')
        fd = os.open('.', os.O_TMPFILE | os.O_RDWR | os.O_CLOEXEC,
                     0o600, dir_fd=directory)
        self.staging.add(fd)
        try:
            st = os.fstat(fd)
            if not stat.S_ISREG(st.st_mode) or st.st_nlink != 0:
                raise RuntimeError('anonymous output staging required')
            yield fd
        finally:
            self.staging.remove(fd)
            os.close(fd)

    def allocated_staging(self):
        # Once linked, the directory ledger owns the blocks. Before that the
        # live descriptor owns them, including during child check callbacks.
        return sum(os.fstat(fd).st_blocks * 512 for fd in self.staging
                   if os.fstat(fd).st_nlink == 0)

    def publish(self, directory, name, fd):
        self.verify(directory)
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 0:
            raise RuntimeError('anonymous output changed before publication')
        temporary = name + '.new'
        linked = False
        try:
            # With dst_dir_fd Python uses linkat(AT_SYMLINK_FOLLOW). The Linux
            # procfs alternative needs no CAP_DAC_READ_SEARCH (AT_EMPTY_PATH
            # does). No source namespace entry exists while bytes are written.
            os.link('/proc/self/fd/' + str(fd), temporary,
                    dst_dir_fd=directory, follow_symlinks=True)
            linked = True
            self.bound(directory, temporary, fd)
            anchor = pathlib.Path('/proc/self/fd') / str(directory)
            os.replace(anchor / temporary, anchor / name)
            self.bound(directory, name, fd)
            # No producer writes after the first link, even if a later alias is
            # added. Same-user /proc/FD access is outside this userspace guard.
        finally:
            if linked:
                try:
                    leaf = os.stat(temporary, dir_fd=directory, follow_symlinks=False)
                    if self.identity(leaf) == self.identity(os.fstat(fd)):
                        os.unlink(temporary, dir_fd=directory)
                except FileNotFoundError:
                    pass

    @contextlib.contextmanager
    def create(self, name):
        """Child writes an anonymous inode via /proc/PARENT/fd/N.

        The caller must wait for all owned writers to finish before returning.
        Publication happens only on normal context exit, after child cleanup.
        """
        name = self.name(name)
        with self.directory() as directory:
            if name in self.verify(directory):
                raise FileExistsError(name)
            with self.anonymous(directory) as fd:
                yield fd
                self.publish(directory, name, fd)

    def write(self, name, data):
        name = self.name(name)
        with self.directory() as directory:
            self.verify(directory)
            with self.anonymous(directory) as fd:
                remaining = memoryview(data)
                while remaining:
                    count = os.write(fd, remaining)
                    if count <= 0:
                        raise RuntimeError('short output write')
                    remaining = remaining[count:]
                self.publish(directory, name, fd)

    def read(self, name):
        name = self.name(name)
        with self.directory() as directory:
            self.verify(directory)
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                         dir_fd=directory)
            try:
                before = self.bound(directory, name, fd)
                chunks = []
                remaining = before.st_size
                while remaining:
                    chunk = os.read(fd, min(65536, remaining))
                    if not chunk:
                        raise RuntimeError('output shortened during collection')
                    chunks.append(chunk)
                    remaining -= len(chunk)
                if os.read(fd, 1):
                    raise RuntimeError('output grew during collection')
                after = self.bound(directory, name, fd)
                signature = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_nlink,
                                       s.st_size, s.st_mtime_ns, s.st_ctime_ns)
                if signature(before) != signature(after):
                    raise RuntimeError('output changed during collection')
                # Some filesystems coalesce metadata timestamps. Verify the
                # bytes again through the SAME descriptor before returning.
                payload = b''.join(chunks)
                os.lseek(fd, 0, os.SEEK_SET)
                offset = 0
                while offset < len(payload):
                    chunk = os.read(fd, min(65536, len(payload)-offset))
                    if not chunk or chunk != payload[offset:offset+len(chunk)]:
                        raise RuntimeError('output bytes changed during collection')
                    offset += len(chunk)
                if os.read(fd, 1):
                    raise RuntimeError('output grew during collection')
                if signature(before) != signature(self.bound(directory, name, fd)):
                    raise RuntimeError('output changed during collection')
                return payload
            finally:
                os.close(fd)

    def names(self):
        with self.directory() as directory:
            return self.verify(directory)

P=pathlib.Path;M=1048576;H=P('/tmp/gl-published-webgl-api-qualification-oct26');O=H/'ops';R=H/'repo';S=H/'source';NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node';CHROME='/opt/google/chrome/chrome'
# Immutable inputs stay in ops. Only this explicit output subtree may evolve.
# Create it before the ledger pins the required parent namespace and identity.
E=O/'output';E.mkdir(exist_ok=True)
outputs=OutputFiles(H)
def save(n,j):
 outputs.write(n,(json.dumps(j,indent=2)+'\n').encode())
def diagnostic(n,j):
 # A broken output namespace must never mask the original exception. Failure
 # to publish diagnostics is not permission to follow a link or claim bytes.
 try:save(n,j)
 except BaseException:pass
def sha(p):
 h=hashlib.sha256()
 with P(p).open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
def alloc(p):
 if p != H:raise ValueError('unexpected accounting root')
 return disk.allocated()+outputs.allocated_staging()
pins=json.loads((O/'pins.json').read_text());manifest=json.loads((O/'inputs-manifest.json').read_text())
def integrity():
 for r in pins['source']['files']:assert sha(S/r['path'])==r['sha256'],r['path']
 for p,h in pins['fixture']['files'].items():assert sha(R/p)==h,p
 return dict(source149=True,fixture7=True,sourceSnapshot='0d65e6daf568a2b0104fcaea75801e9fcac6d1ae',fixture=pins['fixture']['head'],tree=pins['fixture']['tree'])
os.environ.clear();os.environ.update(PATH='/usr/bin:/bin',HOME='/home/user',LANG='C.UTF-8',NODE_PATH=str(H/'deps/node_modules'),CHROME=CHROME,TMPDIR=str(H/'tmp'),PALETTE_GPU_SOURCE_ROOT=str(S),PALETTE_GPU_EVIDENCE=str(E/'test-result.json'),PALETTE_BROWSER_RESOURCE_CONFIG='{"explicitTaskAccounting":"2048MiB physical runtime;1024MiB complete remote task disk"}',PYTHONDONTWRITEBYTECODE='1')
assert str(R/'test/helpers/palette-browser-supervisor.py') in sys.argv
spec=importlib.util.spec_from_file_location('accepted',R/'test/helpers/palette-browser-supervisor.py');sup=importlib.util.module_from_spec(spec);spec.loader.exec_module(sup)
disk=sup.AllocatedDisk([H],transient_roots=[H/'tmp',E],ceiling=1024*M)
future=(256+64+8+16+8)*M
accounting=dict(samples=0,peakProjected=0,minFree=None,minMem=None)
def check():
 outputs.check()
 used=alloc(H);free=shutil.disk_usage(H).free-future;mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 accounting.update(samples=accounting['samples']+1,peakProjected=max(accounting['peakProjected'],used+future),minFree=min(accounting['minFree'] or free,free),minMem=min(accounting['minMem'] or mem,mem))
 if used+future>1024*M:return 'complete remote disk cap'
 if free<2982150144:return 'remote free floor'
 if mem<768*M:return 'remote host physical remainder'
 return None
def execute(argv,name):
 assert check() is None
 os.chdir(R);rec=sup.supervise(argv,rss_limit=2048*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check);out=rec.pop('output');outputs.write(name+'.log',out);rec.update(argv=argv,limits=dict(physicalRSS=2048*M,CPU=90,wall=120,file=24*M,output=2*M,NodeHeapMiB=512,GitDATAChildOnly=512*M),accounting=accounting.copy());save(name+'-receipt.json',rec)
 return rec,out
try:
 save('integrity-before.json',integrity())
 assert resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1) and resource.getrlimit(resource.RLIMIT_AS)==(-1,-1)
 tools={}
 for name,p in [('node',NODE),('chrome',CHROME)]:
  with P(p).resolve().open('rb') as elf:assert elf.read(4)==b'\x7fELF' and os.access(p,os.X_OK)
  q=subprocess.run([p,'--version'],capture_output=True,timeout=10);assert q.returncode==0 and len(q.stdout)+len(q.stderr)<8192
  tools[name]=dict(path=str(P(p).resolve()),sha256=sha(P(p).resolve()),version=q.stdout.decode().strip(),standingBytes=P(p).stat().st_size)
 save('executables.json',tools)
 mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 gate=dict(memAvailable=mem,required=(2048+768+128)*M,measuredCompleteDisk=alloc(H),prospectiveProfile=256*M,prospectiveTemporary=64*M,prospectiveEvidence=8*M,prospectivePublication=16*M,reserve=8*M,projectedDisk=alloc(H)+future,diskCap=1024*M,projectedFree=shutil.disk_usage(H).free-future,accounting=accounting,environment=dict(os.environ),inheritedLimits=P('/proc/self/limits').read_text())
 gate['passAdmission']=mem>=gate['required'] and check() is None;save('remote-admission.json',gate);assert gate['passAdmission']
 startup='const fs=require("fs"),v8=require("v8");console.log(JSON.stringify({execPath:process.execPath,version:process.version,execArgv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),heapLimit:v8.getHeapStatistics().heap_size_limit,puppeteer:require.resolve("puppeteer"),puppeteerLoaded:!!require("puppeteer").launch,launchConfiguration:require("./test/helpers/palette-browser-launch").launchConfiguration(),environment:process.env}))'
 rec,out=execute([NODE,'--max-old-space-size=512','-e',startup],'node-startup');assert rec['exit']==0 and rec['stopReason'] is None and rec['cleanupComplete'];save('node-startup.json',json.loads(out))
 assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-26T22:35:00+00:00')
 save('invocation-start.json',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),soleInvocation=True,integrity=integrity(),envSHA256=hashlib.sha256(json.dumps(dict(os.environ),sort_keys=True).encode()).hexdigest()))
 assert check() is None
 with outputs.create('test-result.json') as result_fd:
  os.environ['PALETTE_GPU_EVIDENCE']='/proc/'+str(os.getpid())+'/fd/'+str(result_fd)
  rec,out=execute([NODE,'--max-old-space-size=512',str(R/'test/test-d3dim-palette-gpu-web.js')],'test')
  if rec['stopReason'] is not None or not rec['cleanupComplete']:raise RuntimeError('child output writers not safely cleaned up')
 result=outputs.read('test-result.json');j=json.loads(result) if result else {}
 assert j.get('wasmSha256')==pins['moduleSHA256'],j.get('wasmSha256')
 success=rec['exit']==0 and rec['stopReason'] is None and rec['cleanupComplete'] and j.get('stage')=='passed' and len(j.get('results',[]))==2
 if success:
  for v,r in zip([1,2],j['results']):assert r['version']==v and len(r['observations'])==42 and r['stats']['fallbacks']==0
 save('checkpoint.json',dict(success=success,candidate=pins['fixture']['head'],tree=pins['fixture']['tree'],moduleSHA256=j.get('wasmSha256'),oracleSHA256=pins['fixture']['files']['test/test-d3dim-palette-gpu-web.js'],stage=j.get('stage'),observations=[dict(version=r['version'],count=len(r['observations']),renderer=r.get('renderer'),actualVersion=r.get('actualVersion'),stats=r.get('stats')) for r in j.get('results',[])],remaining=['evidence publication'] if success else ['qualification blocked; no replay'],physicalAccountingCaveat='maximum of simultaneous sampled aggregate and waited descendant high-water is lower bound, independent peaks not summed',route=j.get('route'),gameplayClaim=False,priorFailure='95297d0d startup1083064320>1073741824 preserved'))
except BaseException as error:
 diagnostic('failure.json',dict(error=repr(error),at=datetime.datetime.now(datetime.timezone.utc).isoformat()));raise
finally:
 # An integrity failure must not skip final accounting, or claim known bytes.
 # Preserve the primary exception while recording both independent outcomes.
 active=sys.exc_info()[0] is not None;final_error=None
 try:save('integrity-after.json',integrity())
 except BaseException as error:
  final_error=error;diagnostic('integrity-after.json',dict(verified=False,error=repr(error)))
 final=dict(completeBytes=None,projection=None,allocation=1024*M,accounting=accounting,accountingComplete=False,boxLeftRunning=True,expiry='2026-10-26T23:02:04.169Z',shutdownOwner='coordinator')
 try:
  assert check() is None
  # Include the receipt itself, then resample its final replacement. All output
  # blocks and atomic temporary files remain in the same bounded ledger.
  save('remote-final-accounting.json',final)
  for attempt in range(3):
   measured=alloc(H);final.update(completeBytes=measured,projection=measured+future,accountingComplete=True)
   save('remote-final-accounting.json',final);assert check() is None
   if alloc(H)==measured:break
  else:raise RuntimeError('final accounting receipt allocation did not stabilize')
 except BaseException as error:
  final_error=final_error or error
  final.update(completeBytes=None,projection=None,accountingComplete=False,error=repr(error));diagnostic('remote-final-accounting.json',final)
 if final_error is not None and not active:raise final_error
print(json.dumps(json.loads(outputs.read('checkpoint.json'))))
