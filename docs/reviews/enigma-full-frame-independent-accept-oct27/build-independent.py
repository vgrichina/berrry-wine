from pathlib import Path
import hashlib,json
H=Path(__file__).parent;R=H.parent/'repo';F=R/'test/fixtures/enigma-controller'
s=(F/'independent-transfer.py').read_text()
s=s.replace('DELAYS = (0, 0)', '''DELAYS = (0, 0)
INJECT = json.loads(os.environ.get('INDEPENDENT_INJECT','{}'))
EVENTS = []
CLOCK_LEDGER = []''')
s=s.replace('return real_time()+offset', '''value=real_time()+offset
        caller=sys._getframe(1)
        if caller.f_code.co_filename.endswith('enigma-frozen-gameplay-controller.py') and caller.f_lineno in (479,420,484):
            CLOCK_LEDGER.append(dict(line=caller.f_lineno,value=value))
        return value''')
s=s.replace('nonlocal pending\n        response', 'nonlocal pending, offset\n        response')
s=s.replace("if cmd.get('action') == 'png' and 'menu-candidate' in cmd['path']:", """if cmd.get('action') == 'png' and 'menu-candidate' in cmd['path']:
            slot=len(reviews)+1
            amount=INJECT.get('capture',{}).get(str(slot),0)
            offset+=amount
            if amount: EVENTS.append(dict(kind='capture',slot=slot,seconds=amount))""")
s=s.replace('def __init__(self, f): self.f = f', 'def __init__(self, f, path): self.f, self.path = f, path')
s=s.replace('''if n == 700001:
                offset += 2''','''if n == 700001:
                slot=1 if self.path.name=='menu-candidate.png' else 2
                amount=INJECT.get('read',{}).get(str(slot),0)
                offset+=amount
                if amount: EVENTS.append(dict(kind='read',slot=slot,seconds=amount))
                if INJECT.get('failRead')==slot: raise OSError('independent full-frame read refusal')''')
s=s.replace("if path.name == 'menu-candidate.png' and args and args[0] == 'rb':", "if path.name.startswith('menu-candidate') and path.suffix=='.png' and args and args[0] == 'rb':")
s=s.replace('return TimedRead(f)', 'return TimedRead(f,path)')
s=s.replace("    with patch.object(Path, 'open', timed_open)", '''    real_fsync=os.fsync
    def fsync(fd):
        nonlocal offset
        name=Path(os.readlink('/proc/self/fd/'+str(fd))).name
        amount=INJECT.get('fsync',{}).get(name,0)
        if amount:
            offset+=amount
            EVENTS.append(dict(kind='fsync',name=name,seconds=amount))
        if INJECT.get('failFsync')==name: raise OSError('independent durable evidence refusal')
        return real_fsync(fd)
    with patch.object(os,'fsync',fsync), patch.object(Path, 'open', timed_open)''')
s=s.replace('result=dict(exit=code, reviews=reviews,','result=dict(exit=code, reviews=reviews, independentEvents=EVENTS, clockLedger=CLOCK_LEDGER,')
(F/'independent-latency.py').write_text(s)
(H/'independent-transform.json').write_text(json.dumps(dict(original=hashlib.sha256((F/'independent-transfer.py').read_bytes()).hexdigest(),generated=hashlib.sha256(s.encode()).hexdigest(),scope='Only filesystem/HTTP clock/refusal injection. Production controller/supervisor unmodified.'),indent=2))
print('Independent descriptor fsync/read/capture hooks generated from immutable original; exact production main retained')
