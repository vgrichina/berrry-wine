"""Capture observation only; ordinary input is separately authorized after image review."""
import json, pathlib, socket, subprocess, time

def launcher_ready(result):
    try:
        if result['exit'] != 0: return False
        s = json.loads(result['stdout'])
        if s.get('quit') is not False or not isinstance(s.get('windows'), list): return False
        return any(isinstance(w, dict) and w.get('title') == 'ShadowMan Launcher'
                   and w.get('visible') is True and w.get('isChild') is False
                   and w.get('hwnd') == '0x10001' and w.get('w', 0) > 0
                   and w.get('h', 0) > 0 for w in s['windows'])
    except (KeyError, TypeError, ValueError): return False

def capture(ctl, result, output):
    if not launcher_ready(result): return False
    ctl(['png', str(output)], 'launcher-live-png')
    return True

def main():
    R = pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23')
    F = R/'fixed/retest-oct23'; O = R/'mutable/output/retest-oct23'
    g = json.loads((F/'gate.json').read_text()); start = time.monotonic()
    def ctl(args, label):
        p = subprocess.run(['node', str(R/'immutable/runtime/tools/ctl.js'), '-s', ':'+str(g['controlPort']), *args], capture_output=True, text=True, timeout=3, env=g['environment'])
        r = dict(args=args, exit=p.returncode, stdout=p.stdout, stderr=p.stderr, elapsed=time.monotonic()-start)
        (F/(label+'.json')).write_text(json.dumps(r, indent=2)); assert p.returncode == 0, label
        return r
    try:
        while True:
            with socket.socket() as s:
                s.settimeout(.05)
                if s.connect_ex(('127.0.0.1',g['controlPort'])) == 0: break
            assert time.monotonic()-start < 10, 'endpoint timeout'
            time.sleep(.05)
        endpoint = time.monotonic()
        while not capture(ctl, ctl(['snapshot'],'launcher-live-snapshot'), O/'launcher-before.png'):
            assert time.monotonic()-endpoint < 7, 'launcher observation timeout'
            time.sleep(.05)
        (F/'launcher-ready-for-inspection.json').write_text(json.dumps(dict(elapsed=time.monotonic()-start)))
    except Exception as e:
        (F/'live-operator-failure.json').write_text(json.dumps(dict(type=type(e).__name__,detail=str(e),elapsed=time.monotonic()-start)))
        (F/'operator-stop.json').write_text(json.dumps(dict(reason='capture-failure')))

if __name__ == '__main__': main()
