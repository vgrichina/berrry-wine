import json,sys,time,pathlib
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-map-movement-gameplay-oct26')
request=json.loads(sys.argv[1]);request['id']=str(time.time_ns())
with open(R/'control-in.jsonl','a') as f:f.write(json.dumps(request)+'\n')
start=time.monotonic()
while time.monotonic()-start<12:
 for line in (R/'guest.log').read_text(errors='replace').splitlines():
  if line.startswith('[ctl] '):
   try:o=json.loads(line[6:])
   except ValueError:continue
   if o.get('id')==request['id']:
    print(json.dumps(o)[:8192]);sys.exit(0 if o.get('ok') else 1)
 if (R/'guest-receipt.json').exists():print('guest ended; inspect guest.log');sys.exit(2)
 time.sleep(.05)
print('client response timeout; no input retry');sys.exit(3)
