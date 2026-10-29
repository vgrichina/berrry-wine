from guard import *
configure_parent()
r=json.load(open(E/'boat-evidence.json'));api=json.loads(r['stdout']);assert api['exitCode']==0 and not api['stdoutTruncated'] and not api['stderrTruncated']
files=json.loads(api['stdout']);dest=ROOT/'remote-evidence';dest.mkdir()
for name,data in files.items():
    assert pathlib.Path(name).name==name
    (dest/name).write_text(data)
accept=json.load(open(dest/'acceptance.json'));assert accept['PASS']
obs=json.load(open(dest/'production-cleanup-observation.json'));assert obs['remaining']=={} and obs['mounts']==[]
safety=json.load(open(dest/'outer-safety-cleanup.json'));assert safety['killed']==[] and safety['reaped']==[] and safety['remaining']=={}
b=accept['report']['backendReceipt'];assert b['filesystem']['openHandles']==0 and b['filesystemCleanup']['remainingMounts']==[]
save('retained-verification.json',dict(PASS=True,authoritativeBackend=b,observer=obs,safety=safety,actualCLIInvocationCount=1))
print(json.dumps(dict(PASS=accept['PASS'],filesystem=b['filesystem'],cleanup=b['filesystemCleanup'],safety=safety,wall=accept['wall'],physicalRSS=accept['physicalRSS'])))
