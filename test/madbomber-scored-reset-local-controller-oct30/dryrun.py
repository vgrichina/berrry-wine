import pathlib,json,hashlib,time
R=pathlib.Path(__file__).parent
schedule=json.loads((R/'schedule.json').read_text());pending=list(schedule);sent=[]
# Same due-event loop as production, monotonic ticks advanced by 0.1s.
for tick in range(1501):
 elapsed=tick/10
 while pending and pending[0][0]<=elapsed:
  due,event=pending.pop(0);sent.append({'due':due,'elapsed':elapsed,'event':event})
assert not pending and len(sent)==len(schedule)
assert max(x['elapsed']-x['due'] for x in sent)<.101
assert all(x['elapsed']<150 for x in sent)
assert next(x['elapsed'] for x in sent if x['event'].get('cmd')=='keydown:13' and x['elapsed']>65)==69
assert next(x['elapsed'] for x in sent if x['event'].get('path','').endswith('newgame71.png'))==71
s=(R/'local-runtime.py').read_text();assert "while events and events[0][0]<=elapsed: send(events.pop(0)[1])" in s
assert 'time.sleep(.1)' in s and 'max-seconds=150' in s
rec={'PASS':True,'kind':'local dispatch dry run only; no guest execution or behavioral acceptance','events':sent,'lastInputSeconds':max(x['elapsed'] for x in sent),'restartInputSeconds':69,'newgameCaptureSeconds':71,'headroomSeconds':150-71,'basis':'Prior209d443a Fire89.55 yielded score5 by100; idle-before-Fire reduced to25; bucket-left117 reduced39; Fire139.61/GameOver143.79 reduced53/63. Ordinary Escape then Enter from earlier unscored restart retained. Fixed schedule remains a bounded gameplay attempt, not predicted acceptance.','runtimeSHA256':hashlib.sha256(s.encode()).hexdigest(),'scheduleSHA256':hashlib.sha256((R/'schedule.json').read_bytes()).hexdigest()}
(R/'schedule-dryrun.json').write_text(json.dumps(rec,indent=2));print(json.dumps({k:v for k,v in rec.items() if k!='events'}))
