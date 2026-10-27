from run import *
import signal
pid=4114750;rows=sup.snapshot();row=rows.get(pid);assert row and row['ppid']==4114088
cmd=pathlib.Path('/proc')/str(pid)/'cmdline';actual=cmd.read_bytes();assert actual==b'tail\x00-n\x000\x00-f\x00messageboard.txt\x00',actual
before=dict(row,argvSHA256=hashlib.sha256(actual).hexdigest(),argv=actual.decode().split('\x00')[:-1],cwd=os.readlink('/proc/'+str(pid)+'/cwd'))
assert before['cwd']==str(ROOT)
sup.signal_owned(row,signal.SIGTERM)
end=time.monotonic()+3
while time.monotonic()<end:
 r=sup.snapshot().get(pid)
 if not r or sup.key(r)!=sup.key(row) or r['state']=='Z':break
 time.sleep(.05)
after=sup.snapshot().get(pid);live=bool(after and sup.key(after)==sup.key(row) and after['state']!='Z');assert not live
dump('owned-cleanup.json',dict(at=time.time(),boardWatcher=before,signal='pidfdSIGTERM',stillLive=live,remoteCompileCleanup=json.loads((H/'remote-evidence/remote-closeout.json').read_text()),coordinatorWatcherTouched=False,boxLifecycleOperations=[],boxLeftRunning=True))
print('owned board watcher cleanup PASS; remote compile owned-live0, no guest/module; box leftRUNNING')
