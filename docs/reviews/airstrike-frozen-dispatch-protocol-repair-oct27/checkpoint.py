from run import *
groups=['baseline-production','production-repaired','controller-regress','bridge-regress']
q=dict(base='565ceadbe8e63c88754bda4590df156cbba6bf85',actualGuestStarts=0,groups={name:json.loads((H/(name+'.json')).read_text()) for name in groups},sourcePins={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in R.glob('tools/*.py')},remaining=['missing actual input log rejection','review diff','commit/push/exact remote verification'])
assert all(g['exit']==0 and g['stopReason'] is None and g['cleanupComplete'] for g in q['groups'].values())
dump('checkpoint.json',q)
print('Durable completed groups retained; source/test only, no gameplay claim')
