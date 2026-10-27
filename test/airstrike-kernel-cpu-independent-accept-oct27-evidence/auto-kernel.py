import importlib.util,pathlib,json,sys
r=pathlib.Path('/tmp/airstrike-kernel-cpu-independent-accept-oct27/repo');s=importlib.util.spec_from_file_location('k',r/'test/helpers/cgroup-cpu-evidence-oct27.py');k=importlib.util.module_from_spec(s);s.loader.exec_module(k)
a=k.measure([sys.executable,str(r/'test/unique-cpu-receipt-oct27.py'),'fixture','auto-reap'],pathlib.Path(__file__).with_name('fresh-auto-reap.kernel.json'))
b=a['supervisor'];lost=float(next(l.split()[1] for l in b['result']['output'].splitlines() if l.startswith('LOSTCPU ')))
assert a['diagnostic']['status']=='finalized-kernel-boundary' and a['diagnostic']['invocationCompleteness']=='UNKNOWN'
assert a['diagnostic']['kernelCPUSeconds']>=lost+b['supervisorOwnAtPrint']-.01
assert a['diagnostic']['kernelCPUSeconds']-a['outerWait4CPUSeconds']>lost-.06
assert b['result']['cleanupComplete'] and b['result']['exit']==0
print(json.dumps(dict(kernel=a['diagnostic'],lost=lost,wait4=a['outerWait4CPUSeconds'])))
