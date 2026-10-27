from common import *
meta=json.loads((H/'actual-capture-plan.json').read_text());entries=[json.loads(x) for x in (H/'capture-map.jsonl').read_text().splitlines()]
assert len(entries)==meta['recordCount'] and [x['record'] for x in entries]==list(range(len(entries)))
records=[contract.strict_json(contract.provider_stdout((H/'api'/(str(x['apiIndex'])+'.raw')).read_bytes(),1024)) for x in entries]
assert contract.sha(contract.wire(records))==meta['recordsSHA256'],'remote plan records digest'
canonical=contract.CapturePlan(capture_budget=8*M,images=meta['images'])
plan=contract.CapturePlan(capture_budget=8*M,canonical=canonical,records=records,**{k:meta[k] for k in ('frame_limits','envelope_overhead','used','tail_reserve','serialized_bytes_limit','total')})
capture=contract.ProviderCapture(plan,capture_budget=8*M)
first=json.loads((H/'capture-ledger-start.json').read_text())['planResponseIndex'];capture_indices={x['apiIndex'] for x in entries};transcript=[]
for i in range(first,len(list((H/'api').glob('*.raw')))):
 raw=(H/'api'/(str(i)+'.raw')).read_bytes();assert not (H/'api'/(str(i)+'.err')).stat().st_size
 kind='capture' if i in capture_indices else 'account';getattr(capture,'accept' if kind=='capture' else 'account')(raw);transcript.append(dict(kind=kind,path='../api/'+str(i)+'.raw'))
images,charged=capture.finish();assert charged==used()
out=H/'restored';out.mkdir(exist_ok=False)
for info,b in zip(meta['images'],images):(out/info['name']).write_bytes(b)
# Replan actual restored files with the unmodified production helper. The independently
# remote-pinned record hash must reproduce byte-for-byte; no alternate decoder.
roundtrip=contract.plan_provider_images([out/i['name'] for i in meta['images']],used=meta['used'],tail_reserve=M,chunk_bytes=4096,envelope_overhead=1024,capture_budget=8*M)
assert contract.wire(roundtrip['records'])==contract.wire(records)
assert roundtrip['frame_limits']==meta['frame_limits'] and roundtrip['total']==meta['total']
save('restore-receipt.json',dict(status='PASS_ACTUAL_PROVIDER_PRODUCTION_HELPER_ROUNDTRIP',chargedOnce=charged,priorUsed=meta['used'],tailRemaining=capture.tail,budget=8*M,images=meta['images'],recordCount=len(records),recordsSHA256=meta['recordsSHA256'],helperSHA256=sha(HELPER.read_bytes()),reconstructedPlan='Pinned CapturePlan from remote actual plan metadata and records bound by remote recordsSHA256; actual provider raw frames consumed chronologically once; production finish decoder; actual restored images independently replanned to exact remote records and bounds.',transcript=transcript))
print(json.dumps(dict(status='PASS',chargedOnce=charged,images=meta['images'])))
