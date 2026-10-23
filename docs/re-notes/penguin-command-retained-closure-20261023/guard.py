import sys,subprocess, pathlib, json, selectors, time, os, signal
BASE=pathlib.Path(__file__).resolve().parent
state=BASE/'capture-meter.json'
n=json.loads(state.read_text()) if state.exists() else {'captured':65000}
p=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);start=time.monotonic()
try:
 while s.get_map():
  assert time.monotonic()-start<60, 'wall guard'
  for key,_ in s.select(0.1):
   b=os.read(key.fileobj.fileno(),4096)
   if not b:s.unregister(key.fileobj);continue
   assert n['captured']+len(b)<=524288, 'aggregate output guard'
   n['captured']+=len(b);state.write_text(json.dumps(n)+'\n');sys.stdout.buffer.write(b);sys.stdout.buffer.flush()
 rc=p.wait(timeout=1);assert rc==0, f'command exit {rc}'
except BaseException:
 os.killpg(p.pid,signal.SIGKILL) if p.poll() is None else None
 p.wait();raise
