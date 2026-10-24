import datetime,json,pathlib,subprocess,time
root=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
boxes=[('bx_ts27jq5e','2026-10-24T03:08:00+00:00')]
for box,deadline in boxes:
    target=datetime.datetime.fromisoformat(deadline).timestamp()
    while time.time()<target:time.sleep(min(30,max(0,target-time.time())))
    receipt={'boxId':box,'deadline':deadline,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'owner':'Codex coordinator lifecycle watchdog'}
    for label,args in [('before',['info',box]),('stop',['stop',box]),('after',['info',box])]:
        try:
            r=subprocess.run(['/home/user/.ascii/boat','--no-update','--json']+args,capture_output=True,text=True,timeout=55)
            receipt[label]={'exitCode':r.returncode,'stdout':r.stdout[-12000:],'stderr':r.stderr[-2000:]}
        except Exception as e:receipt[label]={'error':str(e)}
        if label=='before' and receipt[label].get('exitCode')==0:
            try:
                obj=json.loads(receipt[label]['stdout']);state=obj.get('state') or obj.get('sandbox',{}).get('state')
                if state in ['stopped','deleted','archived']:receipt['alreadyStopped']=True;break
            except (ValueError,AttributeError):pass
    (root/(box+'-checkpoint-closeout-oct24.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'boxId':box,'checkpointCompleted':True}),flush=True)
