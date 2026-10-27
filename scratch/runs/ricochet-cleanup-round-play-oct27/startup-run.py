import pathlib,subprocess,json,time,resource,shutil
h=pathlib.Path('/tmp/ricochet-cleanup-round-play-oct27');mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
assert mem>=4563402752
p=subprocess.run(['python3','-S',str(h/'remote-supervisor.py'),'startup'],stdout=open(h/'startup-supervisor.stdout','wb'),stderr=open(h/'startup-supervisor.stderr','wb'),timeout=20)
j=json.loads((h/'startup/supervision.json').read_text());t=json.loads((h/'startup/terminal.json').read_text());out=(h/'startup/node.stdout').read_text();err=(h/'startup/node.stderr').read_text();assert p.returncode==0 and j['exit']==0 and not j['stopReason'] and j['cleanupComplete'] and t['returncode']==0 and '"parser":"PASS"' in out and not err,(j,t,out,err)
print(json.dumps(dict(supervision=j,terminal=t,output=json.loads(out),stderr=err)))
