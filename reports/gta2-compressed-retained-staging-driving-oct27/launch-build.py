assert (O/'extra.execution.json').exists();assert json.loads((O/'extra.execution.json').read_text())['exit']==0
print(py('import pathlib,json,hashlib,shutil,os;h=pathlib.Path('+repr(str(H))+');print(json.dumps(dict(bytes=sum(p.lstat().st_blocks*512 for p in h.rglob("*") if p.is_file()),diskFree=shutil.disk_usage("/tmp").free,nodeExists=pathlib.Path("/home/user/.nvm/versions/node/v24.22.1/bin/node").is_file(),cwd=os.getcwd())))')['stdout'])
# Startup uses actual remote executable/cwd/env and the same process-specific remote limits.
for mode in ['build-startup','guest-startup']:
 q=api('python3 '+shlex.quote(str(O/'remote-job.py'))+' '+mode);save(mode+'-api.json',q)
put(str(O/'preflight.js'),(O/'preflight.js').read_bytes(),'preflight')
plan=json.loads((O/'compressed-transfer-plan.json').read_text());games=[r for g in plan['groups'] for r in g['pins'] if r['kind']=='game'];assert len(games)==71;put(str(O/'game-pins.json'),json.dumps(games).encode(),'game-pins')
# Local admission fresh immediately before sole heavy canonical build.
gate('before-build');q=api('python3 '+shlex.quote(str(O/'remote-job.py'))+' build',detach=True);save('build-launch-api.json',q);print(json.dumps(q))
