from work import *
def is_task_node(parts):
 return bool(parts) and pathlib.Path(parts[0]).name=='node' and any(str(H) in x for x in parts[1:])
assert not is_task_node(['python3','-c','node '+str(H)])
assert not is_task_node(['node','/unrelated/test.js'])
assert is_task_node(['node',str(H/'runner/test/run.js')])
save('cleanup-filter-controls.json',dict(pythonSelfRejected=True,unrelatedNodeRejected=True,taskNodeAccepted=True))
code='''import pathlib,os,json,shutil
h=pathlib.Path('/tmp/maelstrom-poststart-phase-capture-oct24');rows=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  parts=(d/'cmdline').read_bytes().decode(errors='replace').split('\\0');parts=[s for s in parts if s]
  if parts and pathlib.Path(parts[0]).name=='node' and any(str(h) in s for s in parts[1:]):rows.append(dict(pid=int(d.name),argv=parts))
 except OSError:pass
j=dict(taskNode=rows,uid=os.getuid(),free=shutil.disk_usage('/tmp').free,ownedBytes=sum(p.stat().st_size for p in h.rglob('*') if p.is_file()),box='bx_wc4mkcn9',lifecycle='RUNNING; coordinator owns shutdown08:15UTC',expiry='2026-10-24T08:20:57.580Z');assert not rows;print(json.dumps(j))'''
save('cleanup-corrected-api.json',py(code))
