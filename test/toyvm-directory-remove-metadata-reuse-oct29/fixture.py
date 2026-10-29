import os,json,stat
os.mkdir('/tmp/tvdr/w/domain/D')
os.mkdir('/tmp/tvdr/w/domain/D/E')
assert stat.S_ISDIR(os.stat('/tmp/tvdr/w/domain/D/E').st_mode)
os.rmdir('/tmp/tvdr/w/domain/D/E')
try:os.stat('/tmp/tvdr/w/domain/D/E')
except FileNotFoundError:pass
else:raise AssertionError('removed directory still present')
os.mkdir('/tmp/tvdr/w/domain/D/F')
assert stat.S_ISDIR(os.stat('/tmp/tvdr/w/domain/D/F').st_mode)
print(json.dumps(dict(checkpoint='rmdir-reuse-complete',removedE=True,recreatedF=True)),flush=True)
