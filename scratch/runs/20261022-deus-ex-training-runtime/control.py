"""Bounded original Training route, using the unchanged registered app/CLI.
Call with ctl arguments; commands and full Boat responses are append logged.
The coordinator owns box shutdown. This driver never changes box lifecycle.
"""
import datetime, json, pathlib, subprocess, sys
E=pathlib.Path(__file__).resolve().parent
args=sys.argv[1:]
command=['boat','exec','bx_2gnkcnac','--timeout','600','--cwd','/home/user/deus-ex-training','--','node','tools/ctl.js',*args]
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
r=subprocess.run(command,capture_output=True,text=True)
row=dict(start=start,end=datetime.datetime.now(datetime.timezone.utc).isoformat(),command=command,returncode=r.returncode,stdout=r.stdout,stderr=r.stderr)
with (E/'input-log.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
print(r.stdout);print(r.stderr,file=sys.stderr)
sys.exit(r.returncode)
