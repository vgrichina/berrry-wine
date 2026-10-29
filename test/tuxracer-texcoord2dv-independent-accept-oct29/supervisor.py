"""Bounded single-task supervisor; no donor execution or root Git writes."""
import os, sys, json, time, signal, resource, subprocess, pathlib, hashlib, threading
ROOT=pathlib.Path('/tmp/tuxracer-texcoord2dv-independent-accept-oct29/repo')
OUT=ROOT/'test/tuxracer-texcoord2dv-independent-accept-oct29'
M=1048576
sys.path.insert(0,str(OUT))
from limit_contract import configure_parent
INITIAL_DATA=resource.getrlimit(resource.RLIMIT_DATA)
TOPOLOGY=configure_parent()
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','GIT_SSH_COMMAND':SSH,'PYTHONDONTWRITEBYTECODE':'1'}
def save(name,obj):
    (OUT/name).write_text(json.dumps(obj,sort_keys=True,indent=2)+'\n')
def admission(label):
    p=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-texcoord2dv-independent-accept-oct29-admission.json')
    a=json.loads(p.read_text()); st=os.statvfs(ROOT)
    mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    free=st.f_bavail*st.f_frsize
    rec={'at':time.time(),'label':label,'device':os.stat(ROOT).st_dev,'f_bavail':st.f_bavail,'blockSize':st.f_frsize,'free':free,'MemAvailable':mem,'requiredBytes':a['requiredBytes'],'futureGrowth':a['futureGrowthIncludingUncertaintyBuffer'],'aggregateSHA':hashlib.sha256(p.read_bytes()).hexdigest(),'allocation':50331648}
    rec['PASS']=free>=a['requiredBytes'] and free-rec['futureGrowth']>=2982150144 and mem>=a['memRequired']
    with (OUT/'admissions.jsonl').open('a') as f:f.write(json.dumps(rec)+'\n')
    assert rec['PASS'],rec
    return rec
def valid(cwd):
    p=pathlib.Path(os.path.abspath(os.fspath(cwd)))
    if not p.is_relative_to(ROOT):raise ValueError('outside lexical owned repo')
    p=p.resolve(strict=True)
    if not p.is_relative_to(ROOT):raise ValueError('outside real owned repo')
    return p
def limits(kind):
    resource.setrlimit(resource.RLIMIT_DATA,((256*M,256*M) if kind=='git' else ((128*M,128*M) if kind=='python' else INITIAL_DATA)))
    resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
def rss(pid):
    try:return int(next(x.split()[1] for x in pathlib.Path('/proc',str(pid),'status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
    except (OSError,StopIteration):return 0
def run(argv,label,*,cwd,kind='node'):
    pth=valid(cwd)
    if argv[0]=='git':assert argv[1:3]==['-C',str(ROOT)] and kind=='git'
    admission(label)
    start=time.monotonic();peak=0;reason=None
    stdout=OUT/(label+'.stdout');stderr=OUT/(label+'.stderr')
    with stdout.open('wb') as out,stderr.open('wb') as err:
      p=subprocess.Popen(argv,cwd=pth,env=ENV,stdout=out,stderr=err,start_new_session=True,preexec_fn=lambda:limits(kind))
      try:
       while True:
        group=0
        for x in pathlib.Path('/proc').iterdir():
         if not x.name.isdigit():continue
         try:
          st=(x/'stat').read_text().rsplit(')',1)[1].split()
          if int(st[2])==p.pid:group+=rss(x.name)
         except (OSError,ValueError,IndexError):pass
        peak=max(peak,group)
        if group>512*M or rss(os.getpid())>128*M:reason='RSS ceiling'
        if stdout.stat().st_size+stderr.stat().st_size>2*M:reason='capture ceiling'
        if time.monotonic()-start>120:reason='wall ceiling'
        if reason:raise RuntimeError(reason)
        if p.poll() is not None:break
        time.sleep(.03)
      finally:
       try:os.killpg(p.pid,signal.SIGKILL)
       except ProcessLookupError:pass
       p.wait()
    rec={'argv':argv,'cwd':str(pth),'exit':p.returncode,'wall':time.monotonic()-start,'peakGroupRSS':peak,'stdoutBytes':stdout.stat().st_size,'stderrBytes':stderr.stat().st_size,'reason':reason,'cleanup':'group killed/reaped','topology':TOPOLOGY}
    save(label+'.json',rec)
    assert p.returncode==0,(label,rec)
    return stdout.read_text()
def git(args,label):return run(['git','-C',str(ROOT),*args],label,cwd=ROOT,kind='git').strip()
def identity(label):
    assert git(['rev-parse','--show-toplevel'],label+'-root')==str(ROOT)
    assert git(['rev-parse','--absolute-git-dir'],label+'-gitdir')==str(ROOT/'.git')
    assert git(['branch','--show-current'],label+'-branch')=='task/tuxracer-texcoord2dv-independent-accept-oct29'
if __name__=='__main__':
    action=sys.argv[1]
    if action=='startup':
      controls={}
      for n,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-pinned-log-acceptance-publication-oct29/repo'})]:
       try:run(['/bin/pwd'],'must-not-spawn',**kw)
       except (TypeError,ValueError):controls[n]='rejected before spawn'
       else:raise AssertionError(n)
      assert run(['/bin/pwd'],'sentinel',cwd=ROOT).strip()==str(ROOT)
      save('containment.json',controls);identity('initial')
      assert git(['rev-parse','HEAD'],'initial-head')=='f356bcac0727ed3aa5e0fde2f9cc829061fe6a59'
      node='/usr/bin/node'
      js="const fs=require('fs');console.log(JSON.stringify({exec:process.execPath,flags:process.execArgv,environment:process.env,limits:fs.readFileSync('/proc/self/limits','utf8'),startup:true}));"
      run([node,'--max-old-space-size=96','-e',js],'node-startup',cwd=ROOT)
      save('configuration.json',{'node':node,'flags':['--max-old-space-size=96'],'env':ENV,'nodeDATA':INITIAL_DATA,'nodeHeapIsNotRSSCap':True,'ssh':SSH,'mount':'N/A: no guest, mounts, checkout or runtime execution'})
    elif action=='node':run(['/usr/bin/node','--max-old-space-size=96',*sys.argv[3:]],sys.argv[2],cwd=ROOT)
    elif action=='git':
      # Read-only bounded board watcher, active before any staging/commit.
      board=pathlib.Path('/home/user/wine-assembly/messageboard.txt')
      stop=threading.Event(); destination=OUT/('board-'+sys.argv[2]+'.txt')
      def watch():
       with board.open('rb') as f,destination.open('wb') as out:
        f.seek(max(0,board.stat().st_size-8192)); tail=f.read(8192)
        out.write(b'\n'.join(tail.splitlines()[-40:])+b'\n');out.flush()
        while not stop.wait(.1):
         b=f.read(8192)
         if b:
          if out.tell()+len(b)>32768:break
          out.write(b);out.flush()
      watcher=threading.Thread(target=watch);watcher.start()
      try:
       identity('before-'+sys.argv[2]);print(git(sys.argv[3:],sys.argv[2])[:2000])
      finally:stop.set();watcher.join()
