from pathlib import Path
import hashlib,json
H=Path(__file__).parent; R=H.parent/'repo'; p=R/'test/fixtures/enigma-controller/original-reproducer.py'
s=p.read_text()
assert hashlib.sha256(p.read_bytes()).hexdigest()=='6665d61da745a7c33546b15b73f5311ccda51b6f978d6905f1e455ab06fea461'
s=s.replace('DELAYS = (14.54351074877195, 16.862725148908794)','DELAYS = (0, 0)')
s=s.replace('    with patch.object(time,', '''    real_path_open = Path.open
    class TimedRead:
        def __init__(self, f): self.f = f
        def __enter__(self): self.f.__enter__(); return self
        def __exit__(self, *args): return self.f.__exit__(*args)
        def read(self, n=-1):
            nonlocal offset
            raw = self.f.read(n)
            if n == 700001:
                offset += 2
            return raw
        def __getattr__(self, name): return getattr(self.f, name)
    def timed_open(path, *args, **kwargs):
        f = real_path_open(path, *args, **kwargs)
        if path.name == 'menu-candidate.png' and args and args[0] == 'rb':
            return TimedRead(f)
        return f
    with patch.object(Path, 'open', timed_open), patch.object(time,''')
s=s.replace("delay=DELAYS[len(reviews)], completed=False", "delay=DELAYS[len(reviews)], transferSeconds=2 if not reviews else 0, completed=False")
dest=R/'test/fixtures/enigma-controller/independent-transfer.py';dest.write_text(s)
(H/'challenge-transform.json').write_text(json.dumps(dict(baseSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),resultSHA256=hashlib.sha256(dest.read_bytes()).hexdigest(),changes='only fixture transport delay placement and delay metadata; production controller/supervisor unchanged'),indent=2)+'\n')
