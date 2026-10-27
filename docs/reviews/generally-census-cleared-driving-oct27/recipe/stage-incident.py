from common import *
p=H.parent/'stage-0.tgz'
save('stage-wrapper-incident.json',dict(cause='exec stage script in shared globals replaced loop code with final remote-upload snippet; groups1..9 therefore executed snippet locally',actualRemoteGroups=[0],notGuest=True,artifact=dict(path=str(p),exists=p.exists(),bytes=p.stat().st_size if p.exists() else 0,sha256=sha(p.read_bytes()) if p.exists() else None),repair='isolated exec namespace; no uncertain remote command replay; continue group1'))
if p.exists():p.unlink()
print('incidental owned local staging file hashed then removed; remote group0 retained; continue1')
