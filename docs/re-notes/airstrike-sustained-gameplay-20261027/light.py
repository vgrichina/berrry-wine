import subprocess,resource,os,pathlib,time,sys
H=pathlib.Path(__file__).parent
with (H/'light-output.log').open('wb') as f:
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(2*1048576,2*1048576))
 p=subprocess.Popen(sys.argv[1:],stdout=f,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits);start=time.monotonic();peak=0
 while p.poll() is None:
  rss=0
  for x in pathlib.Path('/proc').glob('[0-9]*/stat'):
   try:
    s=x.read_text().rsplit(')',1)[1].split()
    if int(s[2])==p.pid:rss+=int(s[21])*4096
   except (OSError,ValueError):pass
  peak=max(peak,rss)
  if rss>128*1048576 or time.monotonic()-start>120:os.killpg(p.pid,9);raise RuntimeError('light guard')
  time.sleep(.05)
 print('light result',p.returncode,'peak',peak);sys.exit(p.returncode)
