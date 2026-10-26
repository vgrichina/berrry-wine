import sys,os,json,importlib.util,pathlib,hashlib
from admission import measure,H,O
j=measure('before '+sys.argv[1]);kind=sys.argv[1];name=sys.argv[2];args=sys.argv[3:]
spec=importlib.util.spec_from_file_location('accepted','/tmp/gl-published-webgl-api-qualification-oct26/repo/test/helpers/palette-browser-supervisor.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
os.environ.update(PYTHONDONTWRITEBYTECODE='1',GIT_NO_LAZY_FETCH='1',GIT_TERMINAL_PROMPT='0',GIT_SSH_COMMAND=j['ssh'])
os.environ['PALETTE_BROWSER_BOOTSTRAP']=str(os.getppid())
os.chdir(H/'repo')
cmd=[sys.executable,str(O/'git-child.py'),*args] if kind=='git' else args
r=s.supervise(cmd,rss_limit=(256 if kind=='git' else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2*1048576)
out=r.pop('output');(O/(name+'.log')).write_bytes(out)
r.update(command=cmd,supervisorSHA256=hashlib.sha256(pathlib.Path(spec.origin).read_bytes()).hexdigest(),limits=dict(physicalMiB=256 if kind=='git' else 128,GitDataMiB=512 if kind=='git' else None,CPU=90,wall=120,fileMiB=24,outputMiB=2,excerpt=8192),python=sys.executable)
(O/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n');sys.stdout.buffer.write(out[:8192]);print('\nRECEIPT',name,r['exit'],r['stopReason'],r['peakAggregateRSS'],flush=True) if 'peakAggregateRSS' in r else print('\nRECEIPT',name,r['exit'],r['stopReason'])
raise SystemExit(1 if r['stopReason'] or not r['cleanupComplete'] else r['exit'] or 0)
