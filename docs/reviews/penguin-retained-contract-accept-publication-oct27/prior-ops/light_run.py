"""Task outer guard: DATA/AS untouched; limits apply only to child."""
import os,sys,time,subprocess,resource,signal,json,pathlib,hashlib
H=pathlib.Path(__file__).parent
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
name=sys.argv[1]
with open(H/(name+'.log'),'wb') as f:
 p=subprocess.Popen(sys.argv[2:],stdout=f,stderr=f,preexec_fn=limits,start_new_session=True,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
 start=time.monotonic();peak=0;reason='natural'
 while p.poll() is None:
  rss=0
  for q in pathlib.Path('/proc').glob('[0-9]*'):
   try:
    st=(q/'stat').read_text().split(') ',1)[1].split()
    if int(st[2])==p.pid:rss+=int((q/'statm').read_text().split()[1])*4096
   except (OSError,ValueError,IndexError):pass
  peak=max(peak,rss)
  if rss>134217728 or time.monotonic()-start>120 or os.fstat(f.fileno()).st_size>2097152:
   reason='guard';os.killpg(p.pid,signal.SIGKILL);break
  time.sleep(.03)
 p.wait()
j=dict(exitCode=p.returncode,peakGroupRSS=peak,wall=time.monotonic()-start,reason=reason,limits=dict(physical=134217728,cpu=90,wall=120,file=25165824,output=2097152),DATAandAS='unchanged',poolSlots=1,supervisorSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest())
(H/(name+'-supervisor.json')).write_text(json.dumps(j,indent=2)+'\n');print(json.dumps(j));assert p.returncode==0 and reason=='natural'
