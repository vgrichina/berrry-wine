#!/usr/bin/env python3
"""Explicit native MessageBox BUTTON route after Caesar's game scene.

Uses the same published reviewed controller and existing permanent input owner.
No game-state access, modal-as-main substitution, or readiness override.
"""
import hashlib, json, os, pathlib, subprocess, sys, types
ROOT = pathlib.Path(__file__).resolve().parent.parent

def preflight(s, target, x, y, label):
    rows = s['windows']
    def one(hwnd):
        matches = [w for w in rows if w['hwnd'] == hwnd]
        assert len(matches) == 1
        return matches[0]
    main, modal, button = one(s['mainHwnd']), one(s['modalHwnd']), one(target)
    actor = s['focusWindow']
    for w in (main, modal, button, actor):
        assert w['live'] and w['generation'] not in ('0', '', None)
        assert w['processId'] == main['processId'] and w['threadId'] == main['threadId']
    assert main['visible'] and not main['isChild'] and main['controlClass'] == 0
    assert modal['visible'] and not modal['isChild'] and modal['owner'] == main['hwnd']
    assert modal['controlClass'] == 16 and modal['hwnd'] != main['hwnd']
    box = s['nativeMessageBox']
    assert box and all(box[k] == modal[k] for k in ('hwnd', 'generation', 'processId', 'threadId', 'controlClass'))
    assert s['nativeDialogBox'] is None and s['focusTopLevel'] == modal['hwnd']
    assert actor['hwnd'] == s['focus'] and one(s['focus'])['parent'] == modal['hwnd']
    assert s['physicalUp'] and s['capture'] == '0x0'
    assert button['visible'] and button['isChild'] and button['controlClass'] == 1
    assert button['parent'] == modal['hwnd'] and not button['style'] & 0x08000000
    assert button['nativeTextAvailable'] and button['title'] == label
    assert type(x) is int and type(y) is int
    mapping = s['pointerMapping']
    assert mapping['canvas'] == s['screen']
    if mapping['transform'] is not None:
        assert mapping['sourceHwnd'] == int(main['hwnd'], 16)
    # Use the public production mapper, including bars, cursor clip and every
    # native ancestor client rectangle. The reviewed point is in whole-image
    # canvas units, never assumed to be a native desktop coordinate.
    code = """const fs=require('fs');
const {s,target,x,y}=JSON.parse(fs.readFileSync(0,'utf8'));
const w=s.windows.find(w=>w.hwnd===target);
console.log(JSON.stringify(require('./lib/cli-native-pointer-coordinates').containsPointer(s,w,{x,y})));"""
    p = subprocess.run(['node', '-e', code], cwd=ROOT,
        input=json.dumps(dict(s=s, target=target, x=x, y=y)), text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert p.returncode == 0, p.stderr
    native = json.loads(p.stdout)
    return dict(target=target, generation=button['generation'], processId=button['processId'],
                threadId=button['threadId'], main=main['hwnd'], modal=modal['hwnd'],
                modalGeneration=modal['generation'], x=x, y=y, label=label,
                nativeX=native['x'], nativeY=native['y'])

def validate_receipt(receipt, guard, expected):
    assert receipt['state'] == 'CONSUMED' and receipt['consumed'] is True
    assert receipt['receiptBoundary'] == 'native-button-dispatch-return'
    assert all(receipt[k] == guard[k] for k in ('owner', 'epoch', 'nonce', 'deadline'))
    assert receipt['consumedAt'] < guard['deadline']
    p = receipt['nativeMessage']
    assert p['msg'] == 0x201 and p['hwnd'] == int(guard['intent']['review']['targetHwnd'], 16)
    assert all(str(p[k]) == str(expected[k]) for k in ('processId', 'threadId', 'generation'))
    assert p['parent'] == int(expected['modal'], 16) and p['wParam'] & 1
    assert int(p['nativeSequence']) > 0
    return p

def load(run, working=False):
    pins = json.loads((run/'runtime-inputs.json').read_text())
    name = 'tools/vb5cce-reviewed-control.py'
    body = subprocess.check_output(['git', 'show', pins['gitSHA']+':'+name], cwd=ROOT)
    assert hashlib.sha256(body).hexdigest() == pins['sources'][name]
    m = types.ModuleType('published_native_modal_control'); m.__file__ = str(ROOT/name)
    exec(compile(body, m.__file__, 'exec'), m.__dict__)
    m.R = run; m.PORT = m.read('launch.json')['rootPort']
    own = pathlib.Path(__file__).read_bytes()
    if working:
        assert m.read('launch.json').get('authoredFixture') is True
    else:
        pin = m.read('modal-controller-pin.json')
        assert pin['sha256'] == hashlib.sha256(own).hexdigest()
        assert subprocess.check_output(['git', 'show', pin['gitSHA']+':tools/caesar3-reviewed-modal.py'], cwd=ROOT) == own
        subprocess.run(['git', 'merge-base', '--is-ancestor', pin['gitSHA'], 'origin/main'], cwd=ROOT, check=True)
    def sourcecheck():
        assert pathlib.Path(__file__).read_bytes() == own
        assert hashlib.sha256(body).hexdigest() == pins['sources'][name]
        assert hashlib.sha256((ROOT/'tools/caesar3-current-native.py').read_bytes()).hexdigest() == pins['sources']['tools/caesar3-current-native.py']
        mapping_name = 'lib/cli-native-pointer-coordinates.js'
        assert hashlib.sha256((ROOT/mapping_name).read_bytes()).hexdigest() == pins['sources'][mapping_name]
    m.sourcecheck = sourcecheck
    reviewed = m.reviewed
    def checked(scene):
        rr, r = reviewed(scene); p = m.read(scene+'-button.json')
        assert preflight(rr['snapshot'], r['targetHwnd'], p['x'], p['y'], r['visibleLabel']) == p
        return rr, dict(r, buttonPreflight=p)
    original_checked = checked
    def remember(scene):
        rr, r = original_checked(scene)
        expected[r['targetHwnd']] = r['buttonPreflight']
        return rr, r
    m.reviewed = remember
    call = m.call
    expected = {}
    def checked_call(command, **kwargs):
        if command.get('action') == 'guarded-input':
            target = command['guard']['intent']['review']['targetHwnd']
            assert target in expected
        reply = call(command, **kwargs)
        if command.get('action') == 'guarded-input':
            assert command['cmd'].startswith('mousedown:')
            try: validate_receipt(reply, command['guard'], expected[target])
            except BaseException:
                m.save('rejected-native-button.json', reply)
                raise
        return reply
    m.call = checked_call
    return m

def command(m, args):
    mode = args[0]
    try:
        if mode == 'capture': m.capture(args[1])
        elif mode == 'review':
            scene, description, label, kind, target, x, y = args[1:]
            assert kind in ('install', 'quit')
            rr = m.read(scene+'.json'); p = preflight(rr['snapshot'], target, int(x), int(y), label)
            m.review(scene, description, label, kind, target)
            # Review is immutable; preflight is a separate immutable operand.
            # checked() joins it without rewriting the original review.
            m.save(scene+'-button.json', p)
        elif mode == 'intent':
            name, scene, x, y, kind = args[1:]; x, y = int(x), int(y)
            rr, r = m.reviewed(scene)
            assert (x, y) == (r['buttonPreflight']['x'], r['buttonPreflight']['y'])
            m.intent(name, scene, x, y, kind)
        else: raise AssertionError('unsupported native modal operation')
    except BaseException as e: m.fail('native-modal-'+mode, e); raise

if __name__ == '__main__':
    args = sys.argv[1:]; working = '--working-fixture' in args
    if working: args.remove('--working-fixture')
    m = load(pathlib.Path(os.environ['CAESAR3_RUN']), working)
    command(m, args)
