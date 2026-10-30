import control as c,time,json,importlib.util
s=importlib.util.spec_from_file_location('owned_boat',c.O/'boat-run.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
v=json.loads((c.O/'schedule.json').read_text())
while time.time()<v['shutdownEpoch']:
 if (c.O/'snapshot-stop-proof.json').exists():raise SystemExit(0)
 time.sleep(min(30,max(0,v['shutdownEpoch']-time.time())))
b.closeout()
