"""Bounded Boat exec transport; explicit assigned box only, receipts retained."""
import json, pathlib, subprocess
E = pathlib.Path(__file__).resolve().parent
BOX = 'bx_32262dnp'
def run(code, name, timeout=30):
    p = subprocess.run(['boat','exec','--json','--timeout',str(timeout),BOX,'--','python3','-c',code],capture_output=True,text=True)
    try: r=json.loads(p.stdout)
    except Exception:
        (E/(name+'.transport.txt')).write_text(p.stdout+'\n'+p.stderr)
        raise
    (E/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n')
    assert p.returncode==0 and r.get('exitCode')==0, r
    return r
