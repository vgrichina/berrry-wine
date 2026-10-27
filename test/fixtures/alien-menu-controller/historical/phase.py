import pathlib,sys,json,subprocess,time,fcntl,os
H=pathlib.Path(__file__).parent
with (H/'control-serial.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 assert not (H/'control-blocked').exists(), 'previous phase uncertain: all control blocked'
 assert not (H/'guest/terminal.json').exists(), 'terminal observed: all control blocked'
 name=sys.argv[1];p=H/'control'/name;p.mkdir(parents=True,exist_ok=False)
 commands=json.loads(sys.argv[2]);(p/'plan.json').write_text(json.dumps(dict(commands=commands)))
 a=['python3',str(H/'runner/test/alien-gameplay-sequence.py'),'--allow-control','--plan',str(p/'plan.json'),'--ledger',str(p/'ledger.json'),'--run-id',H.name+'/'+name,'--endpoint','http://127.0.0.1:18129/ctl','--terminal-file',str(H/'guest/terminal.json')]
 (p/'command.json').write_text(json.dumps(dict(argv=a,at=time.time())))
 try:
  q=subprocess.run(a,capture_output=True,text=True,timeout=25)
  (p/'stdout.log').write_text(q.stdout);(p/'stderr.log').write_text(q.stderr)
  if q.returncode: raise RuntimeError(q.stdout+q.stderr)
  state=json.loads((p/'ledger.json').read_text());assert state['status'] in ['complete','terminal']
  # CLI receipt is compact; exact ACK excerpts + durable state retained.
  print(json.dumps(dict(exit=q.returncode,stdout=q.stdout,status=state['status'],next=state['next'],lastAcknowledgedBatch=state['lastAcknowledgedBatch'],lastFrozenBatch=state['lastFrozenBatch'],lastReceipts=state['receipts'][-2:])))
 except BaseException as e:
  (H/'control-blocked').write_text(json.dumps(dict(phase=name,reason=str(e),at=time.time())))
  print(json.dumps(dict(blocked=True,phase=name,error=str(e)))[:7000]);raise
