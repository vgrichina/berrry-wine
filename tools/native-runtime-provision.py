"""Individually stage pinned bytes; publish the barrier only after every upload joins.
The caller supplies its newly created runtime transport, never an inherited box.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib,json,subprocess,runpy

def provision(root, run, remote_root, upload, remote):
 root=Path(root).resolve();run=Path(run).resolve()
 assert run.is_relative_to(root), 'runtime outside source root'
 pins=json.loads((run/'position-runtime-pins.json').read_text())
 contract=json.loads((run/'startup-contract.json').read_text())
 directory=run.relative_to(root).as_posix()
 physical=[p['path'] for p in pins['files'] if p['path'].startswith(directory+'/')]
 required=contract['required']
 assert physical and required, 'explicit physical startup contract required'
 targets={p['path'] for p in pins['files']}
 assert all(p in targets for p in required), 'unprovisioned startup contract dependency'
 checker=runpy.run_path(str(Path(__file__).with_name('runtime_helper_closure.py')))
 checker['validate'](pins,root,run,[Path(p).name for p in physical],runtime_environment={'SNAPSHOT_BASELINE':False})
 def provider(pin):
  spec=pin.get('provider') or {}
  if 'git' in spec:data=subprocess.check_output(['git','show',spec['git']+':'+spec['path']],cwd=root)
  elif 'artifact' in spec:data=(root/spec.get('retainedRun','scratch/runs/20261108-recoil-hermetic-native-objective')/spec['artifact']).read_bytes()
  else:data=(root/pin['path']).read_bytes()
  assert len(data)==pin['size'] and hashlib.sha256(data).hexdigest()==pin['sha256'],pin['path']
  return data
 # Validate every selected provider before the first remote effect. Uploads
 # resolve them again, so a changed source cannot silently use this preflight.
 for pin in pins['files']:provider(pin)
 remote_run=remote_root+'/'+str(run.relative_to(root))
 lock="import json,pathlib,time;v=json.loads(pathlib.Path("+repr(remote_run+ '/custody-current.json')+").read_text());assert v['lockHeld'] and v['subreaper'] and not v['launched'] and time.time()-v['at']<2"
 remote('provision-lock-before',lock)
 def transfer(pin):upload(remote_root+'/'+pin['path'],provider(pin))
 # Exiting the pool joins every transfer, including on failure. No barrier can
 # be published by a partial or still-writing provisioning generation.
 with ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(transfer,pins['files']))
 upload(remote_run+'/position-runtime-pins.json',(run/'position-runtime-pins.json').read_bytes())
 code=lock+'\nimport runpy;b=runpy.run_path('+repr(remote_root+'/tools/native-startup-barrier.py')+');b["publish"]('+repr(remote_root)+','+repr(remote_run+'/position-runtime-pins.json')+','+repr(remote_run+'/staging-verified.json')+')'
 return remote('provision-verify-all-before-queue',code)
