#!/usr/bin/env python3
"""Portable source-only fixture replay into a NEW output directory.
Use task-admitted process supervision externally; this is not a runtime launcher.
"""
import argparse,gzip,pathlib,shutil,subprocess,os,json
p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--out',required=True);p.add_argument('--node',required=True);a=p.parse_args()
here=pathlib.Path(__file__).resolve().parent;repo=pathlib.Path(a.repo).resolve();out=pathlib.Path(a.out).resolve();out.mkdir(exist_ok=False)
for name in ['independent-boundary.js','startup.js']:shutil.copyfile(here/name,out/name)
(out/'base-runner.stdout').write_bytes(gzip.decompress((here/'evidence/base-runner.stdout.gz').read_bytes()))
# Deliberately explicit environment; the new receipt qualifies this replay only.
env=dict(PATH='/usr/local/bin:/usr/bin:/bin',HOME=os.environ.get('HOME','/home/user'),LANG='C.UTF-8',TZ='UTC')
commands=[('node-startup-fixed',[str(out/'startup.js')]),('controls',['--controls-only']),('validation',['--validation']),('remaining',['--remaining']),('edges',['--edges'])]
for name,args in commands:
 cmd=[a.node,'--max-old-space-size=512',*(args if name=='node-startup-fixed' else [str(out/'independent-boundary.js'),*args])]
 with (out/(name+'.stdout')).open('wb') as stdout,(out/(name+'.stderr')).open('wb') as stderr:
  r=subprocess.run(cmd,cwd=repo,env=env,stdout=stdout,stderr=stderr)
 (out/(name+'.command.json')).write_text(json.dumps(dict(command=cmd,exit=r.returncode,cwd=str(repo)),indent=2)+'\n')
 if r.returncode:raise SystemExit(r.returncode)
print('PASS source-only fixture replay; retain external supervision receipts separately')
