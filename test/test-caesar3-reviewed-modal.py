#!/usr/bin/env python3
"""Focused authored native owned MessageBox route; original media never run."""
import copy, importlib.util, json, os, pathlib, signal, socket, subprocess, sys, time, uuid
ROOT = pathlib.Path(__file__).resolve().parent.parent
def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT/file)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def supervise(run, env):
    c = module('caesar_fixture_runtime', 'tools/caesar3-current-native.py'); c.RUN = run
    (run/'desktop-observations').mkdir(exist_ok=True)
    port = json.loads((run/'launch.json').read_text())['rootPort']
    args = ['node', 'test/run.js', '--exe='+str(run/'modal.exe'), '--no-build', '--threads', '--real-ticks',
        '--native-exit-receipt='+str(run/'native-exit.json'), '--native-invocation-token='+str(uuid.uuid4()),
        '--control='+str(port), '--screen=800x600', '--png-canvas', '--max-seconds=90',
        '--max-batches=1000000000', '--stuck-after=0', '--quiet-api', '--quiet-blocks']
    c.execute_native(args, env, (), port, args[7].split('=', 1)[1], time.time()+95)

def main(run, source_pid, mode="normal"):
    run.mkdir(parents=True)
    tool = module('modal_tool', 'tools/caesar3-reviewed-modal.py')
    env = dict(os.environ)
    if source_pid:
        inherited = pathlib.Path('/proc/'+source_pid+'/environ').read_bytes().split(b'\0')
        env = {r.split(b'=', 1)[0].decode():r.split(b'=', 1)[1].decode() for r in inherited if b'=' in r}
    env.update(CAESAR3_RUN=str(run), WINE_COM_PROTOCOL_DIR=str(run/'children'),
               WINE_PROCESS_DESKTOP_OBSERVE=str(run/'desktop-observations'))
    original = pathlib.Path(os.environ.get('CAESAR3_TEST_INPUTS', str(pathlib.Path(os.environ['CAESAR3_RUN'])/'runtime-inputs.json')))
    (run/'runtime-inputs.json').write_bytes(original.read_bytes())
    # Only this authored PE is edited: visible main + owned Yes/No MessageBox.
    code = """const fs=require('fs'),assert=require('assert');
const b=require('./test/test-vb5-normal-exit-native.cjs').fixture('normal'),raw=r=>r-0x1000+0x200;
// Only authored guest code: finite real-tick tail after native dialog returns.
const wait=b.indexOf(Buffer.from([0x3d,0xf4,1,0,0,0x72]));assert(wait>0);b.writeUInt32LE(50,wait+1);
b.write('Authored modal\\0',raw(0x2570));b.fill(0,raw(0x2540),raw(0x2570));b.write('Quit\\0',raw(0x2540));
b.fill(0,raw(0x2580),raw(0x2600));b.write('Leave the authored fixture?\\0',raw(0x2580));
const at=b.indexOf(Buffer.from([0x68,1,0,0,0,0x68,0x40,0x25,0x40,0]));assert(at>0);b.writeUInt32LE(4,at+1);
fs.writeFileSync(process.argv[1],b,{flag:'wx'});"""
    subprocess.run(['node', '-e', code, str(run/'modal.exe')], cwd=ROOT, env=env, check=True)
    with socket.socket() as sock: sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    start = time.time()
    (run/'launch.json').write_text(json.dumps(dict(at=start, deadline=start+120, gameplayCutoff=start+90,
        reserveSeconds=30, rootPort=port, authoredFixture=True)))
    # Child is waited by this test; runtime independently prearms its watchdog.
    p = subprocess.Popen([sys.executable, '-B', __file__, '--supervise', str(run)],
        cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    m = tool.load(run, working=True)
    try:
        end = time.time()+20
        while True:
            try:
                s = m.call(dict(action='snapshot'))
                if s['nativeMessageBox'] and len(s['windows']) == 5: break
            except (OSError, FileNotFoundError, AssertionError): pass
            assert time.time() < end; time.sleep(.02)
        m.capture('before'); s = m.read('before.json')['snapshot']
        b = next(w for w in s['windows'] if w['controlClass'] == 1 and w['controlId'] == 6)
        x, y = b['screenX']+b['w']//2, b['screenY']+b['h']//2
        baseline = tool.preflight(s, b['hwnd'], x, y, 'Yes')
        negatives = []
        def reject(name, mutate):
            changed = copy.deepcopy(s); mutate(changed)
            try: tool.preflight(changed, b['hwnd'], x, y, 'Yes')
            except (AssertionError, KeyError, TypeError): negatives.append(name)
            else: raise AssertionError('accepted '+name)
        for name, mutate in [
            ('actor', lambda t:t['focusWindow'].update(threadId=99)),
            ('modal-generation', lambda t:t['nativeMessageBox'].update(generation='wrong')),
            ('focus', lambda t:t.update(focusTopLevel=t['mainHwnd'])),
            ('capture', lambda t:t.update(capture='0x10001')),
            ('physical-down', lambda t:t.update(physicalUp=False)),
            ('native-modal', lambda t:t.update(nativeMessageBox=None)),
            ('caption', lambda t:next(w for w in t['windows'] if w['hwnd']==b['hwnd']).update(title='No')),
            ('parent', lambda t:next(w for w in t['windows'] if w['hwnd']==b['hwnd']).update(parent=t['mainHwnd'])),
            ('disabled', lambda t:next(w for w in t['windows'] if w['hwnd']==b['hwnd']).update(style=0x08000000))]:
            reject(name, mutate)
        tool.command(m, ['review', 'before', 'Authored automated native fixture only', 'Yes', 'install', b['hwnd'], str(x), str(y)])
        m.bind('before')
        if mode != 'normal':
            rr,r=m.reviewed('before')
            owner=m.read('input-owner.json');guard={**owner,'nonce':str(uuid.uuid4()),'reviewed':True,
                'intent':dict(review=m.native_review(rr,r)),'deadline':int(time.time()*1000)+500}
            if mode=='foreign-owner':guard['owner']='foreign-owner'
            elif mode=='wrong-actor':guard['identity']='foreign-actor-identity'
            elif mode=='late':guard['deadline']=int(time.time()*1000)-1
            elif mode=='stale':
                time.sleep(max(0,rr['at']+30.05-time.time()))
                guard['deadline']=int(time.time()*1000)+500
            else:raise AssertionError('unknown authored fault mode')
            try:m.call(dict(action='guarded-input',cmd=f'mousedown:{x}:{y}',guard=guard))
            except AssertionError as error:m.fail(mode,error)
            else:raise AssertionError('invalid authored native input accepted')
            if (run/'rejected-native-button.json').exists():
                rejected=m.read('rejected-native-button.json')
                assert not rejected['consumed'] and not rejected['handlerApplied']
            ledger=(run/'requests.jsonl').read_bytes()
            for cleanup in (False,True):
                try:m.call(dict(action='snapshot'),cleanup=cleanup)
                except AssertionError as e:assert 'permanent UNKNOWN' in str(e)
                else:raise AssertionError('post UNKNOWN request')
            assert (run/'requests.jsonl').read_bytes()==ledger
            (run/'assertions.json').write_text(json.dumps(dict(passed=True,authoredOnly=True,
                nativeFault=mode,consumed=False,laterHTTP=0,rebindReplayRetry=False)))
            return
        tool.command(m, ['capture', 'fresh'])
        tool.command(m, ['review', 'fresh', 'Authored fresh complete native modal, finite physical Yes press', 'Yes', 'quit', b['hwnd'], str(x), str(y)])
        tool.command(m, ['intent', 'quit', 'fresh', str(x), str(y), 'quit'])
        assert m.read('quit-observation.json')['outcome'] == 'process-exited'
        down=m.read('quit-down.json')['receipt']; intent=m.read('quit-intent.json')
        guard={**intent['owner'],'nonce':intent['nonce'],'deadline':down['deadline'],
            'intent':dict(review=m.native_review(m.read('fresh.json'),m.read('fresh-review.json')))}
        tool.validate_receipt(down,guard,baseline)
        for field,value in [('processId',99),('threadId',99),('generation','99'),('parent',1)]:
            changed=copy.deepcopy(down);changed['nativeMessage'][field]=value
            try:tool.validate_receipt(changed,guard,baseline)
            except AssertionError:negatives.append('receipt-'+field)
            else:raise AssertionError('foreign native receipt accepted')
        for field,value in [('nonce','foreign'),('state','UNKNOWN'),('consumedAt',guard['deadline']),('receiptBoundary','host-handler')]:
            changed=copy.deepcopy(down);changed[field]=value
            try:tool.validate_receipt(changed,guard,baseline)
            except AssertionError:negatives.append('receipt-'+field)
            else:raise AssertionError('stale/late/UNKNOWN receipt accepted')
        # A closed route forbids identity inspection and HTTP, including cleanup.
        ledger=(run/'requests.jsonl').read_bytes(); m.fail('authored-terminal',AssertionError('authored closure check'))
        for cleanup in (False,True):
            try:m.call(dict(action='snapshot'),cleanup=cleanup)
            except AssertionError as e:assert 'permanent UNKNOWN' in str(e)
            else:raise AssertionError('post UNKNOWN request')
        assert (run/'requests.jsonl').read_bytes()==ledger
        negatives.append('UNKNOWN-zero-later-HTTP')
        (run/'assertions.json').write_text(json.dumps(dict(passed=True, authoredOnly=True,
            directPhysicalButton=True, freshCompleteScene=True, nativeQuit=True, negatives=negatives,
            target=baseline), indent=2))
    finally:
        if p.poll() is None and not (run/'native-wait.json').exists():
            (run/'stop-native.json').write_text('{}')
        a, b = p.communicate(timeout=15)
        (run/'supervisor.stdout.log').write_bytes(a); (run/'supervisor.stderr.log').write_bytes(b)
        (run/'supervisor-wait.json').write_text(json.dumps(dict(exit=p.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True)))
        assert p.returncode == 0, b.decode()
        w = m.read('native-wait.json'); assert w['actualWait'] and w['stdoutEOF'] and w['stderrEOF']
        w = m.read('watchdog-wait.json'); assert w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'] and w['exit'] == 0
    print('PASS owned native MessageBox target checks, physical BUTTON, fresh review, finite Yes and native Quit')

def serve_cli(run):
    """Authored File/Exit fixture; every review/input is a real external CLI."""
    run.mkdir(parents=True)
    (run/'runtime-inputs.json').write_bytes(pathlib.Path(os.environ['CAESAR3_TEST_INPUTS']).read_bytes())
    code=pathlib.Path(os.environ['CAESAR3_CLI_GENERATOR']).read_text()
    subprocess.run(['node','-e',code,str(run/'modal.exe')],cwd=ROOT,check=True)
    with socket.socket() as sock: sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    start=time.time()
    (run/'launch.json').write_text(json.dumps(dict(at=start,deadline=start+160,gameplayCutoff=start+130,
        reserveSeconds=30,rootPort=port,authoredFixture=True)))
    p=subprocess.Popen([sys.executable,'-B',__file__,'--supervise',str(run)],
        cwd=ROOT,env=dict(os.environ,CAESAR3_RUN=str(run)),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    a,b=p.communicate()
    (run/'supervisor.stdout.log').write_bytes(a);(run/'supervisor.stderr.log').write_bytes(b)
    (run/'supervisor-wait.json').write_text(json.dumps(dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True)))
    assert p.returncode==0,b.decode()

if __name__ == '__main__':
    if sys.argv[1] == '--supervise': supervise(pathlib.Path(sys.argv[2]), dict(os.environ))
    elif os.environ.get('CAESAR3_MODAL_CLI')=='1': serve_cli(pathlib.Path(sys.argv[1]).resolve())
    else:
        root=pathlib.Path(sys.argv[1]).resolve();root.mkdir(parents=True)
        for mode in ('wrong-actor','foreign-owner','late','stale','normal'):
            main(root/mode, None, mode)
        (root/'assertions.json').write_text(json.dumps(dict(passed=True,authoredOnly=True,
            sameCoreAllCases=True,modes=['wrong-actor','foreign-owner','late','stale','normal'])))
