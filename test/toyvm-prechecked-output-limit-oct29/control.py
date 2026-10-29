import os,sys,json,time,pathlib,resource,subprocess,hashlib
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path('/tmp/toyvm-prechecked-output-limit-oct29')
REPO=ROOT/'repo'
configure_parent()
def admit(label):
    a=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-prechecked-output-limit-oct29-admission.json').read_text())
    v=os.statvfs(ROOT); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    r=dict(op=label,at=time.time(),device=ROOT.stat().st_dev,f_bavail=v.f_bavail,blockSize=v.f_frsize,free=v.f_bavail*v.f_frsize,MemAvailable=mem,required=a['requiredBytes'],aggregate=a['aggregate'],PASS=v.f_bavail*v.f_frsize>=a['requiredBytes'] and mem>=a['memRequired'])
    with (ROOT/'operations.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
    if not r['PASS']:raise RuntimeError('admission rejected')
def run(argv,*,cwd,git=False,timeout=30,label='operation'):
    p=pathlib.Path(os.path.abspath(os.fspath(cwd)))
    if not p.is_relative_to(ROOT):raise ValueError('lexical outside owned root')
    p=p.resolve(strict=True)
    if not p.is_relative_to(ROOT):raise ValueError('canonical outside owned root')
    admit(label)
    env=dict(os.environ,GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
    q=subprocess.Popen(argv,cwd=p,env=env,preexec_fn=lambda:child_limits(git),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    start=time.monotonic();out=bytearray();err=bytearray()
    os.set_blocking(q.stdout.fileno(),False);os.set_blocking(q.stderr.fileno(),False)
    while True:
        rows={}
        for entry in pathlib.Path('/proc').iterdir():
            if not entry.name.isdigit():continue
            try:
                s=(entry/'stat').read_text().rsplit(')',1)[1].split();rows[int(entry.name)]=(int(s[1]),int(s[21])*os.sysconf('SC_PAGE_SIZE'))
            except (OSError,ValueError,IndexError):pass
        selected={q.pid};old=set()
        while old!=selected:
            old=set(selected);selected.update(pid for pid,(ppid,rss) in rows.items() if ppid in selected)
        parentrss=rows.get(os.getpid(),(0,0))[1];group=parentrss+sum(rows.get(pid,(0,0))[1] for pid in selected)
        if parentrss>128*1048576 or group>512*1048576:q.kill();raise RuntimeError('physical RSS guard')
        for stream,buf in [(q.stdout,out),(q.stderr,err)]:
            try:buf.extend(os.read(stream.fileno(),65536))
            except BlockingIOError:pass
        if len(out)+len(err)>2*1048576:q.kill();raise RuntimeError('capture cap')
        if time.monotonic()-start>timeout:q.kill();raise RuntimeError('outer wall cap')
        if q.poll() is not None:
            out.extend(q.stdout.read() or b'');err.extend(q.stderr.read() or b'');break
        time.sleep(.02)
    (ROOT/(label+'.stdout')).write_bytes(out);(ROOT/(label+'.stderr')).write_bytes(err)
    return q.returncode,bytes(out),bytes(err)
if __name__=='__main__':
    label=sys.argv[1];rc,out,err=run(sys.argv[2:],cwd=ROOT,label=label)
    print(json.dumps(dict(exit=rc,stdout=out.decode(errors='replace')[:6500],stderr=err.decode(errors='replace')[:500])))
