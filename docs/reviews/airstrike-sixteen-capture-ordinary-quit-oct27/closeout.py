import pathlib,os,json,hashlib,signal,time
import run as c
H=c.H;owned=[]
for p in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
 try:
  a=p.read_bytes().split(b'\0')
  if a[:6]==[b'tail',b'-n',b'0',b'-f',b'messageboard.txt',b''] and os.readlink(p.parent/'fd/1')==str(H/'board-watch.log'):
   pid=int(p.parent.name);fd=os.pidfd_open(pid)
   assert os.readlink(p.parent/'cwd')==str(c.ROOT)
   signal.pidfd_send_signal(fd,signal.SIGTERM);os.close(fd);owned.append(pid)
 except (OSError,ValueError):pass
time.sleep(.1)
absence={str(pid):not pathlib.Path('/proc',str(pid)).exists() for pid in owned}
assert all(absence.values()),absence
assert c.gate() is None
pub=json.loads((H/'publication.json').read_text());result=json.loads((H/'result.json').read_text());result['publication']=pub
result['cleanup'].update(watcherPids=owned,watchersAbsent=absence,boxStopped=False,coordinatorHandback=True)
result['accounting']=json.loads((H/'accounting.json').read_text())
result['apiCaptureBytes']=sum(p.stat().st_size for p in H.glob('api-*.stdout'))
result['priorOversizeDisplayIncident']='setup-incidents.txt; retained, no retrospective compliance'
c.dump('result.json',result)
c.dump('closeout.json',dict(publication=pub,cleanup=result['cleanup'],accounting=result['accounting'],apiCaptureBytes=result['apiCaptureBytes'],sourcePins=json.loads((H/'dispatch-boundary-result.json').read_text()),remaining=result['remaining']))
print(result['status'],pub['commit'],pub['remoteRef'],'verified; box handed back running; owned watcher absent')
