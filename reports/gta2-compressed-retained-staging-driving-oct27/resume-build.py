assert json.loads((O/'fonts-required.execution.json').read_text())['exit']==0
# Update only task-owned remote wrapper; Node executable/heap/env/rlimits unchanged.
put(str(O/'remote-job-v2.py'),(O/'remote-job.py').read_bytes(),'remote-job-v2')
q=py('import pathlib,json;O=pathlib.Path('+repr(str(O))+');p=O/"build-supervisor.json";r=json.loads(p.read_text());assert r["stopReason"] is None and r["exit"]==1;assert not (O.parent/"repo/build/wine-assembly.wasm").exists();print(json.dumps({k:r[k] for k in ("exit","cpuSeconds","wallSeconds","cleanupComplete")}))');save('build-prefix-terminal.json',q)
gate('before-build-continuation');q=api('python3 '+shlex.quote(str(O/'remote-job-v2.py'))+' build-continuation',detach=True);save('build-continuation-launch-api.json',q);print(json.dumps(q))
