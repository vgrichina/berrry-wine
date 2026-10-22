from pathlib import Path
import json,os,signal,datetime
E=Path('/home/user/aoe3-system-capabilities-diagnosis-oct22/guest');p=json.loads((E/'launch.json').read_text())['pid']
os.kill(p,signal.SIGTERM)
(E/'stop-at-checkpoint.json').write_text(json.dumps(dict(pid=p,signal='SIGTERM',at=datetime.datetime.now(datetime.timezone.utc).isoformat(),reason='native failure return captured, postAccept PNG inspected; no further input'),indent=2))
s=(E/'output.log').read_text().splitlines()
print('\n'.join(x for x in s if any(k in x for k in ['CoCreate','GetFileVersion','VerQuery','0x01aaee99','0x00488b05','[trace'] ))[-16000:])
