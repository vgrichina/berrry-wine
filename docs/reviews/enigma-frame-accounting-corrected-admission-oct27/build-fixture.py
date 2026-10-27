from pathlib import Path
H=Path(__file__).parent; R=H.parent/'repo'; F=R/'test/fixtures/enigma-controller'
s=(F/'independent-transfer.py').read_text()
s=s.replace('DELAYS = (0, 0)', '''DELAYS = (0, 0)
READ_SECONDS = float(os.environ.get('FRAME_READ_SECONDS', '2'))
CAPTURE_SECONDS = float(os.environ.get('FRAME_CAPTURE_SECONDS', '0'))
PERSIST_SECONDS = float(os.environ.get('FRAME_PERSIST_SECONDS', '0'))
PERSIST_TARGET = os.environ.get('FRAME_PERSIST_TARGET', 'menu-candidate.png.json')''')
s=s.replace('nonlocal pending\n        response', 'nonlocal pending, offset\n        response')
s=s.replace("if cmd.get('action') == 'png' and 'menu-candidate' in cmd['path']:", "if cmd.get('action') == 'png' and 'menu-candidate' in cmd['path']:\n            if not reviews: offset += CAPTURE_SECONDS")
s=s.replace('offset += 2', 'offset += READ_SECONDS')
s=s.replace('transferSeconds=2 if not reviews else 0', 'transferSeconds=READ_SECONDS if not reviews else 0')
s=s.replace('    real_path_open = Path.open', '''    real_replace = Path.replace
    def timed_replace(path, *args, **kwargs):
        nonlocal offset
        result = real_replace(path, *args, **kwargs)
        # save() writes a temporary sibling before the atomic replace.
        if path.name == PERSIST_TARGET + '.tmp':
            offset += PERSIST_SECONDS
        return result
    real_path_open = Path.open''')
s=s.replace("with patch.object(Path, 'open', timed_open),", "with patch.object(Path, 'replace', timed_replace), patch.object(Path, 'open', timed_open),")
s=s.split('\nclass ReviewBudgetTests')[0] + '''
if __name__ == '__main__':
    assert sys.argv[1] == '--boundary'
    boundary(Path(sys.argv[2]), float(sys.argv[3]), json.loads(sys.argv[4]))
'''
(F/'full-frame-boundary.py').write_text(s)
print('Fixture derives unchanged production boundary; only latency instrumentation added')
