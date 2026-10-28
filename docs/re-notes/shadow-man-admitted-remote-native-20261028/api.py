import subprocess,pathlib,json,sys
H=pathlib.Path(__file__).resolve().parents[1];label=sys.argv[1];argv=sys.argv[2:]
p=subprocess.run(['boat','--no-update','--json','exec','bx_k4htahnf','--timeout','60',*argv],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=65)
(H/'evidence'/(label+'.api.stdout')).write_bytes(p.stdout);(H/'evidence'/(label+'.api.stderr')).write_bytes(p.stderr)
r=json.loads(p.stdout);assert p.returncode==r['exitCode'],(p.returncode,r); print(json.dumps({k:r.get(k) for k in ['commandId','exitCode','stdout','stderr','timedOut','oomKilled','stdoutTruncated','stderrTruncated']}));assert r['exitCode']==(125 if label in ['control-output','control-wall'] else 1 if label=='control-file' else 0) and not r['stdoutTruncated'] and not r['stderrTruncated']
