#!/usr/bin/env python3
"""Bounded synchronous small-command supervisor; no native/build fallback."""
import ctypes, json, os, pathlib, resource, selectors, signal, subprocess, time
H = pathlib.Path(__file__).resolve().parent
ROOT = H.parents[2]
EXT = pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-memory-recovered-handler-qualification-oct23')
CAP = 524288
FILE = 25165824
def run(label, argv, cwd=ROOT, expected=(0,), destination=H, native=False):
    seconds = 150 if native else 60
    used = sum(json.loads(p.read_text())['capturedBytes'] for root in [H, EXT] for p in root.glob('*.receipt.json'))
    assert used <= CAP
    assert ctypes.CDLL(None).prctl(36, 1, 0, 0, 0) == 0
    def limits():
        resource.setrlimit(resource.RLIMIT_CPU, (seconds, seconds))
        resource.setrlimit(resource.RLIMIT_FSIZE, (FILE, FILE))
    env = dict(os.environ, GIT_NO_LAZY_FETCH='1', PYTHONDONTWRITEBYTECODE='1')
    env.pop('NODE_OPTIONS', None)
    env['GIT_SSH_COMMAND'] = 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'
    before = dict(argv=argv, cwd=str(cwd), cpuSeconds=seconds, wallSeconds=seconds,
                  fileMax=FILE, aggregateCaptureMax=CAP, previousCaptureBytes=used)
    (destination/(label+'.command.json')).write_text(json.dumps(before, indent=2)+'\n')
    start = time.monotonic()
    p = subprocess.Popen(argv, cwd=cwd, env=env, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, start_new_session=True, preexec_fn=limits)
    sel = selectors.DefaultSelector()
    logs = dict(stdout=bytearray(), stderr=bytearray())
    counts = dict(stdout=0, stderr=0)
    reason = None
    term = None
    def kill(sig):
        try: os.killpg(p.pid, sig)
        except ProcessLookupError: pass
    for name, pipe in [('stdout', p.stdout), ('stderr', p.stderr)]:
        os.set_blocking(pipe.fileno(), False)
        sel.register(pipe, selectors.EVENT_READ, name)
    while sel.get_map() or p.poll() is None:
        now = time.monotonic()
        if reason is None and now-start > seconds: reason = 'wall limit'
        if reason and term is None: kill(signal.SIGTERM); term = now
        if term is not None and now-term >= 5: kill(signal.SIGKILL)
        for key, _ in sel.select(.05):
            b = os.read(key.fileobj.fileno(), 65536)
            if not b:
                sel.unregister(key.fileobj); key.fileobj.close(); continue
            name = key.data
            counts[name] += len(b)
            room = max(0, CAP-used-sum(map(len, logs.values())))
            logs[name].extend(b[:room])
            if used+sum(counts.values()) > CAP: reason = 'aggregate capture overflow'
        for root in [ROOT, EXT]:
            if any(f.stat().st_size > FILE for f in root.rglob('*') if f.is_file()):
                reason = 'regular file overflow'
    code = p.wait()
    kill(signal.SIGTERM)
    deadline = time.monotonic()+5
    while True:
        try:
            while os.waitpid(-1, os.WNOHANG)[0]: pass
        except ChildProcessError: break
        if time.monotonic() >= deadline: kill(signal.SIGKILL); break
        time.sleep(.05)
    kill(signal.SIGKILL)
    try:
        while True: os.waitpid(-1, 0)
    except ChildProcessError: pass
    remaining = []
    for q in pathlib.Path('/proc').iterdir():
        if not q.name.isdigit(): continue
        try:
            f = (q/'stat').read_text().split(') ', 1)[1].split()
            if int(f[2]) == p.pid or int(f[1]) == os.getpid(): remaining.append(int(q.name))
        except (OSError, IndexError): pass
    if remaining: reason = 'unreaped descendants'
    receipt = dict(before, pid=p.pid, childExit=code, exit=125 if reason else code,
                   reason=reason, elapsedSeconds=time.monotonic()-start,
                   streamBytes=counts, capturedBytes=sum(map(len, logs.values())),
                   aggregateAfter=used+sum(counts.values()),
                   termThenKillSeconds=5, subreaper=True, reaped=not remaining,
                   remaining=remaining, stdout=bytes(logs['stdout']).decode(),
                   stderr=bytes(logs['stderr']).decode())
    (destination/(label+'.receipt.json')).write_text(json.dumps(receipt, indent=2)+'\n')
    # No supervisor stdout: the retained source-read denial exhausted capture.
    pass
    if receipt['exit'] not in expected: raise SystemExit(receipt['exit'])
    return receipt
