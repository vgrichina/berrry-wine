import pathlib,json,subprocess,sys,os,hashlib
H=pathlib.Path(__file__).parent;R=H.parent/'repo';F=R/'test/fixtures/enigma-controller';results=[]
cases=[
 ('slot2-capture',34,[30,.25],{'capture':{'2':2}},False),
 ('slot2-read',34,[30,.25],{'read':{'2':2}},False),
 ('slot2-frame-fsync',34,[30,.25],{'fsync':{'menu-candidate-002.png.json.tmp':2}},False),
 ('slot2-review-fsync',34,[30,.25],{'fsync':{'review-002.json.tmp':2}},False),
 ('cumulative-two-captures',1,None,{'capture':{'1':.6,'2':.6}},False),
 ('cumulative-two-reads',1,None,{'read':{'1':.6,'2':.6}},False),
 ('cumulative-two-fsyncs',1,None,{'fsync':{'menu-candidate.png.json.tmp':.6,'menu-candidate-002.png.json.tmp':.6}},False),
 ('failed-read-slot2',34,[30,4],{'read':{'2':2},'failRead':2},False),
 ('failed-frame-fsync',34,[4,30],{'fsync':{'menu-candidate.png.json.tmp':2},'failFsync':'menu-candidate.png.json.tmp'},False),
 ('failed-review-fsync',34,[4,30],{'fsync':{'review-001.json.tmp':2},'failFsync':'review-001.json.tmp'},False),
 ('positive-configured',34,[4,30],{'capture':{'1':.2,'2':.2},'read':{'1':.2,'2':.2},'fsync':{'menu-candidate.png.json.tmp':.2,'review-002.json.tmp':.2}},True),
 ('positive-default',4,None,{'capture':{'1':.2,'2':.2},'read':{'1':.2,'2':.2},'fsync':{'menu-candidate.png.json.tmp':.2,'review-002.json.tmp':.2}},True)]
for name,allowance,slots,inject,positive in cases:
 root=H/'independent'/name;root.parent.mkdir(exist_ok=True)
 cmd=[sys.executable,str(F/'independent-latency.py'),'--boundary',str(root),str(allowance),json.dumps(None if slots is None else dict(checkpoint_seconds=slots,progress_seconds=45))]
 env=dict(os.environ,INDEPENDENT_INJECT=json.dumps(inject))
 if not (root/'boundary.json').exists():
  with (root.parent/(name+'.stdout')).open('wb') as out,(root.parent/(name+'.stderr')).open('wb') as err:
   p=subprocess.run(cmd,env=env,stdout=out,stderr=err,timeout=20)
  assert p.returncode==0,(name,p.returncode)
 q=json.loads((root/'boundary.json').read_text());o=q['outcome'];events=q['independentEvents'];spent=sum(x['seconds'] for x in events)
 wire=[json.loads(x) for x in (root/'wire.jsonl').read_text().splitlines()]
 clicks=[x for x in wire if 'cmd' in x['command']]
 assert q['childStarted'] and q['supervisor']['remainingOwnedLive']==[],name
 assert o['clicked']==positive and len(clicks)==int(positive),(name,o,events)
 assert spent>0 and spent<=o['reviewSecondsUsed'],(name,spent,o)
 ledger=q.get('clockLedger')
 if ledger:
  assert len(ledger)%2==0 and all(x['line']==479 for x in ledger[::2]),(name,ledger)
  measured=sum(b['value']-a['value'] for a,b in zip(ledger[::2],ledger[1::2]))
  assert abs(measured-o['reviewSecondsUsed'])<.000001,(name,ledger,o)
 if positive:
  assert wire[-1]['command']=={'action':'quit'},name
  assert len(q['reviews'])==2 and all(x['completed'] for x in q['reviews']),name
 results.append(dict(name=name,positive=positive,outcome=o,events=events,clockLedger=ledger,existingReceiptReused=ledger is None,command=cmd,environmentSHA256=hashlib.sha256(json.dumps(sorted(env.items())).encode()).hexdigest(),cleanup=q['supervisor']['remainingOwnedLive']))
 (H/'acceptance-checkpoint.json').write_text(json.dumps(dict(candidate='37bad5b6a919a62b4e385b72219c2bb2b01a223b',completed=results,remaining=[x[0] for x in cases[len(results):]]),indent=2))
 print(name,'PASS',o['status'],round(o['reviewSecondsUsed'],3),flush=True)
