#!/usr/bin/env python3
"""Explicit assigned-box API transport; no lifecycle operations."""
import base64, json, os, shlex, subprocess, sys
from pathlib import Path
BOX = 'bx_f3gs8qm2'
def remote(command, output, timeout=600):
    assert os.statvfs('/home/user').f_bavail * os.statvfs('/home/user').f_frsize > 2982150144
    p = subprocess.run(['/home/user/.ascii/boat', 'exec', '--json', '--timeout', str(timeout), BOX, command], capture_output=True, text=True)
    Path(output).write_text(p.stdout)
    if p.stderr:
        Path(str(output)+'.stderr').write_text(p.stderr)
    try:
        r = json.loads(p.stdout)
        print(json.dumps({k:r.get(k) for k in ['commandId','exitCode','startedAt','finishedAt','success','timedOut','stdoutTruncated','stderrTruncated']}))
        print(r.get('stdout','')[-5000:]); print(r.get('stderr','')[-3000:])
        return r
    except Exception:
        print(p.stdout[-2000:]); raise
if __name__ == '__main__':
    data = Path(sys.argv[1]).read_bytes()
    cmd = 'python3 -c '+shlex.quote('import base64; exec(compile(base64.b64decode('+repr(base64.b64encode(data).decode())+'),"qualification-script","exec"))')
    r=remote(cmd,sys.argv[2])
    sys.exit(0 if r.get('exitCode') == 0 else 1)
