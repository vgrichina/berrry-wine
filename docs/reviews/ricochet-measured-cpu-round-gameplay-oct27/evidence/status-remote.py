import pathlib,json,time
h=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27');out={}
for name in ['serial/checkpoint.json','serial/paused.json','serial/first-failure.json','guest/supervision.json','guest/terminal.json','guest/spawn-or-wait-exception.json']:
 p=h/name
 if p.exists():
  j=json.loads(p.read_text());out[name]=j if name!='serial/checkpoint.json' else {k:v for k,v in j.items() if k!='snapshot'}
for name in ['guest/node.stderr','guest/controller.stderr']:
 p=h/name
 if p.exists():out[name]=p.read_text()[-1200:]
print(json.dumps(out))
