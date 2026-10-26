import importlib.util,pathlib,json,resource
p=pathlib.Path('/tmp/gl-detached-peak-rss-repair-oct26/repo/test/helpers/palette-browser-supervisor.py')
spec=importlib.util.spec_from_file_location('s',p);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
code='const fs=require("fs");console.log(JSON.stringify({executable:process.execPath,version:process.version,flags:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),env:Object.fromEntries(["PALETTE_BROWSER_RESOURCE_CONFIG","GIT_SSH_COMMAND","TMPDIR","NODE_PATH","CHROME"].map(k=>[k,process.env[k]]))}))'
r=s.supervise(['/usr/local/bin/node','--max-old-space-size=64','-e',code],rss_limit=192*1024*1024,wall_limit=5)
o=json.loads(r.pop('output'));print(json.dumps(dict(supervisor=r,node=o)))
assert r['exit']==0 and r['stopReason'] is None and r['cleanupComplete']
for label in ('Max data size','Max address space'):
 assert 'unlimited' in next(l for l in o['limits'].splitlines() if l.startswith(label))
