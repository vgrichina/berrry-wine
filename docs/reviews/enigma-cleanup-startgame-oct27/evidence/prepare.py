gate('prepare')
assert all((O/('verified-group-'+str(i)+'.json')).exists() for i in range(9))
rows=json.loads((ROOT/'scratch/usage-watch/enigma-cleanup-verified-runtime-map-oct27.json').read_text())['files']
manifest=[{k:r[k] for k in ('target','bytes','sha256')} for r in rows];put_bytes(str(O/'runtime-manifest.json'),json.dumps(manifest).encode(),'manifest')
verify='import pathlib,json,hashlib,shutil,time;h=pathlib.Path('+repr(str(H))+');rs=json.loads((h/"ops/runtime-manifest.json").read_text());bad=[]\nfor r in rs:\n p=h/r["target"];b=p.read_bytes();\n if len(b)!=r["bytes"] or hashlib.sha256(b).hexdigest()!=r["sha256"]:bad.append(r["target"])\nv=dict(at=time.time(),files=len(rs),bytes=sum(r["bytes"] for r in rs),mismatches=bad,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage(h).free,allocation=268435456,floor=2982150144);v["projected"]=v["free"]-v["allocation"];(h/"ops/remote-verified.json").write_text(json.dumps(v,indent=2));print(json.dumps(v));assert not bad and v["memAvailable"]>=4563402752 and v["projected"]>=v["floor"]'
save('remote-verified.json',json.loads(py(verify)['stdout']))
old=pathlib.Path('/tmp/enigma-separated-stream-runtime-oct27');c=json.loads((old/'ops/launch-config.json').read_text());c=json.loads(json.dumps(c).replace(str(old),str(H)));c['launch_dir']=str(O/'launch');c['controller']['decision_path']=str(O/'decision.json');c['cutoff_at']=1793092500
save('launch-config.json',c)
parser=(old/'ops/parser-check.cjs').read_text().replace(str(old),str(H));(O/'parser-check.cjs').write_text(parser)
src=(old/'ops/launch.py').read_text().replace(str(old),str(H));src=src.replace('>= 3758096384','>= 4563402752');(O/'launch.py').write_text(src)
save('review-plan.json',dict(historicalInspected=True,historicalPreauthorizesNothing=True,coordinatesCandidate=[343,213],decisionSchema={'reviewed':True,'safeStartGame':True,'frameSHA256':'new actual SHA256','batch':'actual new integer','x':343,'y':213},pollSeconds=.25,transportGateSeconds=json.loads((O/'historical-review.png.receipt.json').read_text())['elapsed'],checkpointSeconds=35,reviewSeconds=25,afterActionSeconds=20,aggregateSeconds=110,cleanupSeconds=10,maxFrames=4,perFrameBytes=2097152,remotePNGBytes=8388608,remainingAcceptance='Actual inspected new menu, exact hash/batch click ACK, actual after-action gameplay review; menu/loading insufficient',ordinaryQuit='Accepted controller action:quit is host control cleanup; never label ordinary guest Quit. No semantic repairs or extra direct input.'))
for name in ['launch-config.json','parser-check.cjs','launch.py','review-plan.json']:
 put_bytes(str(O/name),(O/name).read_bytes(),name.replace('.','-'))
put_bytes(str(O/'trusted-supervisor.py'),pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py').read_bytes(),'trusted-supervisor')
parser_wrapper='''import pathlib,subprocess,sys,json
o=pathlib.Path(OPS)
with (o/'mount-parser.stdout').open('xb') as out,(o/'mount-parser.stderr').open('xb') as err:
 try:
  p=subprocess.Popen(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=2048',str(o/'parser-check.cjs')],stdout=out,stderr=err)
  code=p.wait(timeout=115)
 except BaseException as ex:
  err.write((type(ex).__name__+': '+str(ex)+'\\n').encode());raise
sys.exit(code)
'''.replace('OPS',repr(str(O)))
put_bytes(str(O/'parser-wrapper.py'),parser_wrapper.encode(),'parser-wrapper')
remote='''import pathlib,json,sys,importlib.util,os,time
h=pathlib.Path(HOME);o=h/'ops';env={'HOME':'/home/user','PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'}
s=importlib.util.spec_from_file_location('s',o/'trusted-supervisor.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
# This light canonical-parser operation runs no guest or module instantiation.
os.environ.clear();os.environ.update(env)
r=m.supervise(['/usr/bin/python3',str(o/'parser-wrapper.py')],rss_limit=134217728,cpu_limit=90,wall_limit=120,output_limit=2097152)
out=r.pop('output');(o/'mount-check.json').write_text(json.dumps(r,indent=2));assert r['exit']==0 and not r['stopReason'];print(out[:4096].decode());print(json.dumps(r))
'''.replace('HOME',repr(str(H)))
# parser stderr is retained distinctly from subprocess creation by this owned outer wrapper.
put_bytes(str(O/'mount-preflight.py'),remote.encode(),'mount-preflight')
cmd='python3 '+shlex.quote(str(O/'mount-preflight.py'))+' > '+shlex.quote(str(O/'mount-preflight-api.stdout'))+' 2> '+shlex.quote(str(O/'mount-preflight-api.stderr'))
j=api(cmd);save('mount-preflight-api.json',j)
v=py('import pathlib,json;h=pathlib.Path('+repr(str(O))+');print(json.dumps(dict(receipt=json.loads((h/"mount-check.json").read_text()),stdout=(h/"mount-parser.stdout").read_text(),stderr=(h/"mount-parser.stderr").read_text(),wrapperStderr=(h/"mount-preflight-api.stderr").read_text())))');save('mount-check.json',json.loads(v['stdout']));assert json.loads(v['stdout'])['receipt']['exit']==0
save('checkpoint.json',dict(status='EXACT_CLOSURE_AND_MOUNT_PASS_NO_GUEST',at=time.time(),files=len(rows),bytes=sum(r['bytes'] for r in rows),production='425755ee5ee9be0734c7aca187521100f5487674',acceptedSupervisor='b160b5403e69f28e92e218849cc8165c67776bd2',remaining=['fresh remote/local admission','accepted production supervisor startup and single guest','actual frame inspection and correlated StartGame','after-action gameplay review','evidence and branch publication'],lifecycle=json.loads((ROOT/'scratch/usage-watch/enigma-cleanup-startgame-oct27.task.runtime.json').read_text())))
print('Prepared exact closure and canonical mounts; NO guest yet')
