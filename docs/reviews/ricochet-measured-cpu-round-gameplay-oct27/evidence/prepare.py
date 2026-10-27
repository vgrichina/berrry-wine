for name in ['result.json','checkpoint-final.json','remote-owned-cleanup.json']:
 j=json.loads((OLD/'ops'/name).read_text());save('predecessor-'+name,j)
assert json.loads((OLD/'ops/result.json').read_text())['cleanupComplete']
save('historical-incidents.json',dict(originalCPUStop='CPU90 aggregate;61.25wall;batch1281;no gameplay',initialReadDisplayOverage='Initial shell reads exceeded requested8192B display; outputs retained in session; no retrospective compliance. Subsequent outputs constrained.'))
T=O/'remote-tools';T.mkdir(exist_ok=True)
a=json.loads((OLD/'ops/guest-args.json').read_text());a=[v.replace('--max-seconds=116','--max-seconds=176') for v in a];(T/'guest-args.json').write_text(json.dumps(a))
startup=json.loads((OLD/'ops/startup-args.json').read_text());startup[-1]=startup[-1].replace('--max-seconds=116','--max-seconds=176');(T/'startup-args.json').write_text(json.dumps(startup))
s=(OLD/'ops/remote-supervisor.py').read_text().replace('cpu_limit=90,wall_limit=120','cpu_limit=300,wall_limit=180').replace('1793092500','1793093400')
s=s.replace("files=[p for p in H.rglob('*') if p.is_file()]","files=[p for root in [H,pathlib.Path("+repr(str(OLD))+ ")] for p in root.rglob('*') if p.is_file()]")
(T/'remote-supervisor.py').write_text(s)
s=(OLD/'ops/remote-child.py').read_text().replace("str(H/'runner')",repr(str(OLD/'runner'))).replace("cwd=H/'runner'","cwd=pathlib.Path("+repr(str(OLD/'runner'))+")")
(T/'remote-child.py').write_text(s)
s=(OLD/'ops/serial.py').read_text().replace('deadline=start+114','deadline=start+174').replace('last>=1793 or time.monotonic()-start>=72','last>=1537 or time.monotonic()-start>=90')
# At most three captures, each <=1.5MiB; full JSON/base64 envelopes reserved before launch.
s=s.replace('captures<6','captures<3').replace('len(b)<=2097152','len(b)<=1572864')
(T/'serial.py').write_text(s)
shutil.copyfile('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py',T/'trusted-supervisor.py')
config=json.loads((OLD/'ops/configuration.json').read_text());config.update(argv=a,continuation=True,mountConfigurationUnchanged=True,retainedRoot=str(OLD),limits=dict(cpuAggregate=300,wall=180,physicalRSS=3221225472,nodeOldSpaceMiB=2048,DATA='unlimited',AS='unlimited'),capturePlan=dict(count=3,perPNG=1572864,apiEnvelopeReservation=6291456,terminalReserve=1048576,apiCap=8388608),lifecycle=dict(guestCutoff='2026-10-27T09:30:00Z',handback='2026-10-27T09:32:00Z',shutdown='2026-10-27T09:35:00Z',expiry='2026-10-27T09:43:37Z',owner='coordinator'))
config['tools']={p.name:dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in T.iterdir()};save('profile.json',config)
shutil.copyfile(ROOT/'scratch/usage-watch/ricochet-measured-cpu-round-gameplay-oct27/root-ref-digest.json',O/'root-ref-digest.json')
for p in [ROOT/'scratch/usage-watch/ricochet-measured-cpu-round-gameplay-oct27.task.txt',ROOT/'scratch/usage-watch/ricochet-cleanup-round-play-oct27.task.txt']:
 if p.exists():shutil.copyfile(p,O/p.name)
print('profile prepared with retained closure; no guest/build/transfer')
for name in ['work.py','read.py','collect-remote.py']:
 s=(OLD/'ops'/name).read_text().replace(str(OLD),str(H));(O/name).write_text(s)
