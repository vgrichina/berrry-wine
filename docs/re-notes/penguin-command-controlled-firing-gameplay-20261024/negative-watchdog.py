import os,sys,time,subprocess,signal,json,pathlib,ctypes
ctypes.CDLL(None).prctl(36,1,0,0,0)
p=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print("ready",flush=True);time.sleep(30)'],stdout=subprocess.PIPE,start_new_session=True)
assert p.stdout.readline()==b'ready\n';os.killpg(p.pid,signal.SIGTERM);time.sleep(.15);ignored=p.poll() is None;assert ignored
os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=5)
try:os.killpg(p.pid,0);remaining=True
except ProcessLookupError:remaining=False
j=dict(pid=p.pid,pgid=p.pid,TERM=True,ignoredTERM=ignored,KILL=True,returncode=p.returncode,remainingGroup=remaining,passNegative=ignored and p.returncode==-9 and not remaining)
pathlib.Path(__file__).with_name('negative-watchdog.json').write_text(json.dumps(j,indent=2));assert j['passNegative'];print(json.dumps(j))
