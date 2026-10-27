import pathlib,json,subprocess,time,shutil
h=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27');s=json.loads((h/'preflight.json').read_text());assert s['startup']=='PASS' and not (h/'guest').exists();assert time.time()+190<1793093400
p=subprocess.Popen(['python3','-S',str(h/'remote-supervisor.py'),'guest'],stdout=open(h/'guest-supervisor.stdout','wb'),stderr=open(h/'guest-supervisor.stderr','wb'),start_new_session=True)
print(json.dumps(dict(supervisorPID=p.pid,start=time.time(),state='STARTING',noReplay=True,box='bx_e9mecsag')))
