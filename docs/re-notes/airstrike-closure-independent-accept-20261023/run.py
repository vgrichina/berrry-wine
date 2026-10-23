import os, sys, subprocess, selectors, pathlib, json, resource
E = pathlib.Path(__file__).resolve().parent
os.environ['GIT_NO_LAZY_FETCH'] = '1'
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
os.environ['GIT_SSH_COMMAND'] = 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'
resource.setrlimit(resource.RLIMIT_FSIZE, (25165824, 25165824))
if pathlib.Path(sys.argv[1]).name == 'node':
    mem = int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
    assert mem >= 805306368
    node = pathlib.Path(sys.argv[1]).resolve()
    import hashlib
    (E/'node-admission.json').write_text(json.dumps({'path':str(node),'bytes':node.stat().st_size,'sha256':hashlib.sha256(node.read_bytes()).hexdigest(),'MemAvailable':mem,'oldspace_MiB':256,'CPU_seconds':60,'wall_seconds':60,'standing_execute_in_place':True})+'\n')
    resource.setrlimit(resource.RLIMIT_CPU, (60,60))
counter = E / 'capture-count.json'
used = json.loads(counter.read_text()) if counter.exists() else 200000
cmd = ['timeout', '60s'] + sys.argv[1:]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
sel = selectors.DefaultSelector(); sel.register(p.stdout, selectors.EVENT_READ)
try:
    while sel.get_map():
        for k, _ in sel.select(1):
            b = os.read(k.fd, min(4096, 524288-used+1))
            if not b: sel.unregister(k.fd); continue
            used += len(b)
            if used > 524288: raise RuntimeError('aggregate capture guard rejected')
            sys.stdout.buffer.write(b); sys.stdout.buffer.flush()
    rc = p.wait()
finally:
    if p.poll() is None: p.kill(); p.wait()
    counter.write_text(json.dumps(used)+'\n')
sys.exit(rc)
