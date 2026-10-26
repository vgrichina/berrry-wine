import pathlib,json,hashlib,shutil,os
N='civ2-win16-map-movement-gameplay-oct26'; B=pathlib.Path('/tmp')/N;R=pathlib.Path('/home/user/wine-assembly/scratch/runs')/N
P=R.parent/'civ2-win16-complete-setup-map-gameplay-oct26'
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
handoff=json.load(open('/home/user/wine-assembly/scratch/usage-watch/'+N+'-handoff.json'))
for e in handoff['pins']:assert pathlib.Path(e['path']).stat().st_size==e['bytes'] and sha(e['path'])==e['sha256'],e['path']
setup=(P/'helpers/setup.py').read_text().replace('civ2-win16-complete-setup-map-gameplay-oct26',N)
# Keep predecessor as the immutable receipt donor, and use the current session.
setup=setup.replace("P=R.parent/'civ2-win16-post-intro-dialog-gameplay-oct26'","P=R.parent/'civ2-win16-post-intro-dialog-gameplay-oct26'")
setup=setup.replace('01a17a1c-d0a2-7323-87df-b94816fe46ca','01a17a26-70c6-73e2-a289-0a54cf0bfc3e').replace('allocation=201326592','allocation=268435456')
(B/'setup.py').write_text(setup)
for name in ['supervise.py','control.py','interact.py','git-op.py']:
 s=(P/'helpers'/name).read_text().replace('civ2-win16-complete-setup-map-gameplay-oct26',N).replace('201326592','268435456').replace('2617245696','3489660928')
 if name=='supervise.py':
  s=s.replace("known={}; peak=0", "controller=None\nif name=='guest':\n controller=subprocess.Popen([node,'--max-old-space-size=64',str(B/'controller.js')],env=env,stdout=open(R/'controller.log','w'),stderr=subprocess.STDOUT)\nknown={}; peak=0")
  s=s.replace("p.wait()\nreceipt.update", "p.wait()\nif controller is not None:\n if controller.poll() is None:controller.terminate()\n controller.wait()\nreceipt.update")
 (B/name).write_text(s)
(R/'handoff.json').write_text(json.dumps(handoff,indent=2)+'\n')
print('handoff exact pins PASS; helpers prepared')
