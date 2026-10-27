from common import *
meta=json.loads((H/'actual-capture-plan.json').read_text());start=json.loads((H/'capture-cursor.json').read_text())['next'] if (H/'capture-cursor.json').exists() else 0
t=time.monotonic();cursor=start
while cursor<meta['recordCount'] and time.monotonic()-t<75:
 before=len(list((H/'api').glob('*.raw')))
 j,raw=remote('cat '+shlex.quote(REMOTE+'/transport/'+str(cursor)+'.json'),reserve=meta['frame_limits'][cursor])
 record=contract.strict_json(contract.provider_stdout(raw,1024))
 assert record.get('kind') in ('manifest','chunk','end')
 with (H/'capture-map.jsonl').open('a') as f:f.write(json.dumps(dict(record=cursor,apiIndex=before,rawSHA256=sha(raw),rawBytes=len(raw)))+'\n')
 cursor+=1;save('capture-cursor.json',dict(next=cursor,total=meta['recordCount'],complete=cursor==meta['recordCount']))
print(json.dumps(dict(start=start,next=cursor,total=meta['recordCount'],complete=cursor==meta['recordCount'],used=used())))
