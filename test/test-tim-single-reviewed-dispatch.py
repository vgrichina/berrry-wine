"""One provisional gesture, then a new whole-scene review and explicit confirm.

Proposals are not intents. Capture never confirms or dispatches a proposal.
Only --confirm delegates to the published reviewed-action helper, unchanged.
The operator must discard if ANY part of the provisional scene is inaccurate.
This module contains no interpretation of pixels or game state.
"""
import contextlib
import fcntl
import importlib.util
import json
from pathlib import Path
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reviewed', ROOT / 'test/test-tim-reviewed-action-path.py')
reviewed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reviewed)
tim = reviewed.tim
CONFIRM = 'CONFIRM_ENTIRE_NEW_SCENE_AND_SINGLE_PROPOSAL'
ORCHESTRATION = {
    "proposal": "(async function(scene,target,action,consequence){const p=load(\"timSingle\"),q=s=>\"'\"+String(s).replaceAll(\"'\",\"'\\\"'\\\"'\")+\"'\";const a=[\"python3\",\"-B\",p.helper,\"--propose\",p.root,p.mode,scene,target,consequence,JSON.stringify(action)];const r=await tools.exec_command({cmd:a.map(q).join(\" \"),max_output_tokens:500});if(r.exit_code!==0)throw Error(r.output);const proposal=JSON.parse(r.output);store(\"timProposal\",{...proposal,root:p.root});text(proposal);})",
    "capture": "(async function(){const p=load(\"timSingle\"),v=load(\"timProposal\"),q=s=>\"'\"+String(s).replaceAll(\"'\",\"'\\\"'\\\"'\")+\"'\";if(v.root!==p.root)throw Error(\"foreign proposal\");const t=Date.now(),a=[\"python3\",\"-B\",p.helper,\"--capture\",p.root,v.proposalId];const r=await tools.exec_command({cmd:a.map(q).join(\" \"),max_output_tokens:600});if(r.exit_code!==0)throw Error(r.output);const c=JSON.parse(r.output),h={...c,root:p.root,toolRequestedAt:t,captureToolReturnedAt:Date.now(),imageToolEnteredAt:Date.now()};const im=await tools.view_image({path:c.png,detail:\"original\"});h.imageToolReturnedAt=Date.now();store(\"timHandoff\",h);image(im.image_url);text({frameId:h.frameId,proposalId:h.proposalId});})",
    "explicitPostReviewConfirmation": "(async function(declaration){const p=load(\"timSingle\"),v=load(\"timProposal\"),h=load(\"timHandoff\"),q=s=>\"'\"+String(s).replaceAll(\"'\",\"'\\\"'\\\"'\")+\"'\";if(declaration!==\"confirm\"||h.root!==p.root||h.proposalId!==v.proposalId)throw Error(\"explicit current proposal confirmation required\");h.postReviewToolRequestedAt=Date.now();const a=[\"python3\",\"-B\",p.helper,\"--confirm\",p.root,v.proposalId,h.frameId,\"CONFIRM_ENTIRE_NEW_SCENE_AND_SINGLE_PROPOSAL\",JSON.stringify(h)];text(await tools.exec_command({cmd:a.map(q).join(\" \"),max_output_tokens:1100}));})"
}
ORCHESTRATION['explicitPostReviewConfirmation'] = ORCHESTRATION['explicitPostReviewConfirmation'].replace(
    'text(await tools.exec_command({cmd:a.map(q).join(" "),max_output_tokens:1100}));',
    'const r=await tools.exec_command({cmd:a.map(q).join(" "),max_output_tokens:1100});text(r);'
    'if(r.exit_code===0){const done=JSON.parse(r.output);if(done.postUPScene){const im=await tools.view_image({path:done.postUPScene.png,detail:"original"});image(im.image_url);store("timObservation",done.postUPScene);}}')
for _phase in ('capture', 'explicitPostReviewConfirmation'):
    ORCHESTRATION[_phase] = ORCHESTRATION[_phase].replace(
        'image(im.image_url)',
        'image({type:"image",mimeType:"image/png",data:im.image_url.slice(im.image_url.indexOf(",")+1),_meta:{"codex/imageDetail":"original"}},"original");image({type:"image",mimeType:"image/png",data:im.image_url.slice(im.image_url.indexOf(",")+1),_meta:{"codex/imageDetail":"original"}},"original")')
ORCHESTRATION['capture'] = ORCHESTRATION['capture'].replace(
    'store("timHandoff",h);',
    'h.imageContentMimeType="image/png";h.identicalFullPNGRepresentations=2;h.sourceDataURLPrefix=im.image_url.slice(0,im.image_url.indexOf(",")+1);store("timHandoff",h);')
IDENTITY = ('session', 'programId', 'targetId')


def read(path):
    return json.loads(Path(path).read_text())


def source_pins():
    return {str(p.relative_to(ROOT)): tim.digest(p) for p in
            (Path(__file__), ROOT / 'test/test-tim-reviewed-action-path.py',
             ROOT / 'tools/tim-smart-handle-controller.py')}


def close(root, reason):
    p = root / 'single-dispatch-closed.json'
    if not p.exists():
        tim.exclusive(p, dict(at=time.time(), reason=str(reason), irreversible=True))


@contextlib.contextmanager
def locked(root):
    root = Path(root)
    with (root / 'single-dispatch.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            assert not (root / 'single-dispatch-closed.json').exists(), 'single dispatch permanently closed'
            assert not (root / 'UNKNOWN.json').exists(), 'terminal UNKNOWN'
            assert not (root / 'native-wait.json').exists(), 'native closed'
            for p in root.glob('command-*.json'):
                assert (root / ('consequence-' + read(p)['nonce'] + '.json')).exists(), 'written command still pending'
            yield root
        except Exception as error:
            close(root, error)
            raise


def paths(root, ident):
    assert str(uuid.UUID(ident)) == ident, 'invalid proposal ID'
    return tuple(root / (prefix + ident + '.json') for prefix in
                 ('proposal-', 'proposal-capture-', 'proposal-used-'))


def available(root):
    for p in root.glob('proposal-*.json'):
        suffix = p.name[len('proposal-'):-len('.json')]
        if suffix.startswith(('capture-', 'used-')):
            continue
        assert paths(root, suffix)[2].exists(), 'only ONE provisional proposal allowed'


def propose(directory, mode, scene, target, consequence, raw):
    """Manually supplied SINGLE candidate, before requesting the new capture."""
    with locked(directory) as root:
        available(root)
        assert mode in ('game', 'menu', 'quit')
        assert all(isinstance(s, str) and s.strip() for s in (scene, target, consequence))
        action = tim.parse_gesture(raw)
        if action['kind'] in ('click', 'drag', 'key'):
            assert 80 <= action['holdMs'] <= 1400, 'task gesture hold range'
        old = read(root / 'latest.json')
        assert old['admission']['held'] is False, 'held proposal refused'
        ident = str(uuid.uuid4())
        p, _, _ = paths(root, ident)
        tim.exclusive(p, dict(id=ident, proposedAt=time.time(), provisionalOnly=True,
                             mode=mode, scene=scene, target=target, consequence=consequence,
                             action=action, owner={k: old[k] for k in IDENTITY},
                             sourcePins=source_pins()))
        return dict(proposalId=ident, provisionalOnly=True)


def pending(root, ident):
    p, binding, used = paths(root, ident)
    assert not used.exists(), 'proposal burned; no double confirmation or replay'
    proposal = read(p)
    assert proposal['id'] == ident and proposal['provisionalOnly'] is True
    assert proposal['sourcePins'] == source_pins(), 'source changed'
    current = read(root / 'latest.json')
    assert proposal['owner'] == {k: current[k] for k in IDENTITY}, 'owner changed'
    assert current['admission']['held'] is False, 'held scene'
    return proposal, binding, used, current


def capture(directory, ident):
    """No gesture, intent, review assertion or confirmation is created here."""
    with locked(directory) as root:
        proposal, binding, _, old = pending(root, ident)
        assert not binding.exists(), 'one capture per candidate'
        answer = reviewed.capture(root)
        current = read(root / 'latest.json')
        assert current['frameId'] != old['frameId'], 'new complete scene required'
        assert proposal['owner'] == {k: current[k] for k in IDENTITY}, 'capture owner changed'
        assert current['admission']['held'] is False
        assert answer['frameId'] == current['frameId']
        assert proposal['proposedAt'] <= current['capturedAt'], 'candidate must precede new capture'
        tim.exclusive(binding, dict(proposalSHA256=tim.digest(paths(root, ident)[0]),
                                   capture=current))
        return dict(answer, proposalId=ident)


def confirm(directory, ident, frame, declaration, handoff):
    """ONLY after personally reviewing the entire NEW scene and proposal."""
    entered = time.time()
    with locked(directory) as root:
        proposal, binding, used, current = pending(root, ident)
        assert declaration == CONFIRM, 'explicit whole new scene confirmation required'
        bound = read(binding)
        assert bound['proposalSHA256'] == tim.digest(paths(root, ident)[0]), 'candidate changed'
        assert bound['capture'] == current, 'candidate/scene binding mismatch'
        assert current['frameId'] == frame, 'different reviewed frame'
        h = json.loads(handoff)
        assert h['frameId'] == frame and h['proposalId'] == ident, 'handoff mismatch'
        assert h['capturedAt'] == current['capturedAt'], 'capture anchor changed'
        assert current['capturedAt'] * 1000 <= h['imageToolReturnedAt'] <= h['postReviewToolRequestedAt'] <= entered * 1000
        assert tim.digest(root / current['png']) == current['pngSHA256'], 'reviewed image changed'
        # Burn before calling the unchanged route. This is a NEW choice made
        # now; the pre-capture proposal never carried an intent ID or nonce.
        tim.exclusive(used, dict(at=time.time(), confirmation=declaration, frameId=frame,
                                 proposalSHA256=bound['proposalSHA256'], newIntentOnlyAfterReview=True))
        result = reviewed.gesture(root, frame, proposal['mode'], proposal['scene'], proposal['target'],
                                  proposal['consequence'], json.dumps(proposal['action']), handoff)
        if result.get('postUPExecution') and not result.get('nativeWait'):
            observation = post_observation(root, frame, result['nonce'])
            if observation:
                result['postUPScene'] = observation
        return result


def post_observation(root, frame, nonce):
    """Read an already rendered post-UP scene. Never request another capture."""
    assert (root / ('consequence-' + nonce + '.json')).exists(), 'actual post-UP execution required'
    until = time.monotonic() + 2
    while time.monotonic() < until:
        if (root / 'UNKNOWN.json').exists():
            return None
        current = read(root / 'latest.json')
        if current['frameId'] != frame:
            assert current['admission']['held'] is False, 'post-UP image must be unheld'
            assert tim.digest(root / current['png']) == current['pngSHA256']
            if (root / 'UNKNOWN.json').exists():
                return None
            return dict(png=str((root / current['png']).resolve()), frameId=current['frameId'],
                        capturedAt=current['capturedAt'], nonce=nonce,
                        actualPostUPExecution=True, noNewCaptureRequest=True)
        if (root / 'native-wait.json').exists():
            return None
        time.sleep(.01)
    raise RuntimeError('post-UP renderer handoff missing; no automatic capture or retry')


def discard(directory, ident, reason):
    with locked(directory) as root:
        _, _, used, _ = pending(root, ident)
        assert reason.strip()
        tim.exclusive(used, dict(at=time.time(), discarded=True, reason=reason, noIntent=True))
        close(root, 'candidate/scene mismatch or explicit discard: ' + reason)
        return dict(discarded=True, closed=True, noIntent=True)


def native_controls(directory):
    """Adversarial authored diagnostic only; no automated successful review.

    Each case refuses before intent creation. A terminal diagnostic UNKNOWN
    closes its waiting review separately and is not a native Quit.
    """
    import subprocess
    from unittest.mock import patch
    parent = Path(directory).resolve()
    parent.mkdir()
    proof = read(parent.parent / 'predecessors-verified.json')
    tim.exclusive(parent / 'predecessors-verified.json', proof)
    for mode in ('frame', 'owner', 'source', 'candidate', 'replay', 'held', 'unknown'):
        root = parent / mode
        child = subprocess.Popen([sys.executable, '-B', str(ROOT / 'test/test-tim-reviewed-action-path.py'),
                                  '--fixture', str(root)], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 start_new_session=True)
        failure = None
        try:
            until = time.monotonic() + 20
            while not (root / 'latest.json').exists():
                assert child.poll() is None and time.monotonic() < until, 'fixture startup failed'
                time.sleep(.01)
            ident = propose(root, 'game', 'authored diagnostic; adverse synthetic binding, no personal review',
                            'manually supplied diagnostic tile', 'no input must occur',
                            '{"kind":"click","x":300,"y":155,"button":1,"holdMs":100}')['proposalId']
            c = capture(root, ident)
            current = read(root / 'latest.json')
            h = dict(c, imageToolReturnedAt=time.time()*1000, postReviewToolRequestedAt=time.time()*1000)
            if mode in ('frame', 'owner', 'held'):
                if mode == 'frame': current['frameId'] = str(uuid.uuid4())
                elif mode == 'owner': current['targetId'] = str(uuid.uuid4())
                else: current['admission']['held'] = True
                (root / 'latest.json').write_text(json.dumps(current))
            elif mode == 'candidate':
                p = paths(root, ident)[0]; d = read(p); d['action']['x'] += 1
                p.write_text(json.dumps(d))
            elif mode == 'replay':
                tim.exclusive(paths(root, ident)[2], dict(diagnosticBurnedBeforeIntent=True))
            elif mode == 'unknown':
                tim.exclusive(root / 'UNKNOWN.json', dict(reason='diagnostic permanent UNKNOWN', irreversible=True))
            context = patch(__name__ + '.source_pins', return_value={}) if mode == 'source' else contextlib.nullcontext()
            with context:
                try: confirm(root, ident, c['frameId'], CONFIRM, json.dumps(h))
                except AssertionError as e: failure = str(e)
                else: raise AssertionError('adversarial candidate was admitted')
            before = sorted(p.name for p in root.glob('refresh-*'))
            for operation in (lambda: capture(root, ident),
                              lambda: confirm(root, ident, c['frameId'], CONFIRM, json.dumps(h))):
                try: operation()
                except AssertionError: pass
                else: raise AssertionError('closed candidate permitted later request')
            assert before == sorted(p.name for p in root.glob('refresh-*'))
            assert not list(root.glob('command-*')) and not list(root.glob('decision-*'))
        finally:
            if child.poll() is None and not (root / 'UNKNOWN.json').exists():
                tim.exclusive(root / 'UNKNOWN.json', dict(at=time.time(),
                              reason='diagnostic zero-input closure after refused candidate',
                              irreversible=True, diagnosticCleanup=True, nativeQuit=False))
            wait, out, err = tim.actual_wait(child, root, 'supervisor-child')
            (root / 'supervisor.log').write_bytes(out); (root / 'supervisor.stderr').write_bytes(err)
        result = read(root / 'fixture-result.json')
        assert result['inputCalls'] == [] and result['callbacks'] == 0
        assert result['nativeMouseButtons'] == 0 and result['queuedEvents'] == 0
        for name in ('native-wait.json', 'deadline-watchdog-wait.json', 'supervisor-child-wait.json'):
            assert all(read(root / name)[k] is True for k in ('actualWait', 'stdoutEOF', 'stderrEOF'))
        tim.exclusive(root / 'candidate-control-result.json', dict(mode=mode, refusal=failure,
                      noIntent=True, noNativeInput=True, noLaterCaptureRequests=True,
                      diagnosticTerminalClosureSeparate=True, actualDirectWaitBothEOF=True))
        print('PASS candidate native', mode, 'zero input / no later request / actual wait bothEOF', flush=True)


def pure():
    import tempfile
    import unittest
    from unittest.mock import patch

    class SingleCandidate(unittest.TestCase):
        def setUp(self):
            self.temp = tempfile.TemporaryDirectory()
            self.addCleanup(self.temp.cleanup)
            self.root = Path(self.temp.name)
            self.scene = dict(session='s', programId='program', targetId='owner', frameId='old',
                              digest='scene', capturedAt=time.time(), png='scene.png',
                              pngSHA256=tim.digest(__file__), admission=dict(held=False))
            (self.root / 'scene.png').write_bytes(Path(__file__).read_bytes())
            self.save()
            self.raw = '{"kind":"click","x":10,"y":20,"button":1,"holdMs":100}'
            self.proposal = propose(self.root, 'game', 'entire provisional scene', 'tile', 'marker', self.raw)['proposalId']

        def save(self):
            (self.root / 'latest.json').write_text(json.dumps(self.scene))

        def captured(self):
            def fresh(_):
                self.scene.update(frameId='new', capturedAt=time.time())
                self.save()
                return dict(png=str(self.root / 'scene.png'), frameId='new', capturedAt=self.scene['capturedAt'])
            with patch.object(reviewed, 'capture', side_effect=fresh):
                return capture(self.root, self.proposal)

        def confirm(self, **replace):
            h = dict(frameId='new', proposalId=self.proposal, capturedAt=self.scene['capturedAt'],
                     imageToolReturnedAt=time.time()*1000, postReviewToolRequestedAt=time.time()*1000)
            args = dict(directory=self.root, ident=self.proposal, frame='new', declaration=CONFIRM, handoff=json.dumps(h))
            args.update(replace)
            return confirm(**args)

        def assertClosedNoLaterRequests(self):
            with patch.object(reviewed, 'capture') as c, patch.object(reviewed, 'gesture') as g:
                with self.assertRaises(AssertionError): capture(self.root, self.proposal)
                with self.assertRaises(AssertionError): self.confirm()
                c.assert_not_called(); g.assert_not_called()
            self.assertFalse(list(self.root.glob('command-*')))
            self.assertFalse(list(self.root.glob('decision-*')))

        def test_capture_cannot_create_intent_or_dispatch(self):
            with patch.object(reviewed, 'gesture') as g:
                self.captured(); g.assert_not_called()
            self.assertFalse(paths(self.root, self.proposal)[2].exists())
            p = read(paths(self.root, self.proposal)[0])
            self.assertNotIn('intentId', p); self.assertNotIn('nonce', p)

        def test_confirm_creates_fresh_dispatch_only_after_review(self):
            self.captured()
            def dispatch(*args):
                self.assertTrue(paths(self.root, self.proposal)[2].exists())
                self.assertEqual(args[1], 'new')
                return dict(status='diagnostic-mock')
            with patch.object(reviewed, 'gesture', side_effect=dispatch) as g:
                self.assertEqual(self.confirm()['status'], 'diagnostic-mock'); g.assert_called_once()

        def test_second_candidate_refuses_without_dispatch(self):
            with self.assertRaisesRegex(AssertionError, 'only ONE'):
                propose(self.root, 'game', 'other', 'tile', 'marker', self.raw)
            self.assertClosedNoLaterRequests()

        def test_no_implicit_confirmation(self):
            self.captured()
            with self.assertRaisesRegex(AssertionError, 'explicit'):
                self.confirm(declaration='yes')
            self.assertClosedNoLaterRequests()

        def test_frame_mismatch_closes(self):
            self.captured()
            self.scene['frameId'] = 'other'; self.save()
            with self.assertRaisesRegex(AssertionError, 'binding mismatch'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_owner_change_closes(self):
            self.captured(); self.scene['targetId'] = 'other'; self.save()
            with self.assertRaisesRegex(AssertionError, 'owner changed'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_native_admission_binding_change_refuses_before_intent(self):
            self.captured(); self.scene['admission']['delivery'] = 'UNCERTAIN'; self.save()
            with self.assertRaisesRegex(AssertionError, 'binding mismatch'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_source_change_closes(self):
            with patch(__name__ + '.source_pins', return_value={}):
                with self.assertRaisesRegex(AssertionError, 'source changed'): self.captured()
            self.assertClosedNoLaterRequests()

        def test_double_confirmation_closes(self):
            self.captured()
            with patch.object(reviewed, 'gesture', return_value={}): self.confirm()
            with self.assertRaisesRegex(AssertionError, 'burned'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_held_refuses(self):
            self.captured(); self.scene['admission']['held'] = True; self.save()
            with self.assertRaisesRegex(AssertionError, 'held'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_written_unknown_never_retries(self):
            self.captured()
            with patch.object(reviewed, 'gesture', side_effect=RuntimeError('written UNKNOWN')):
                with self.assertRaises(RuntimeError): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_positive_unsent_consumes_candidate_new_candidate_required(self):
            self.captured()
            with patch.object(reviewed, 'gesture', return_value=dict(status='REFUSED_UNSENT')):
                self.assertEqual(self.confirm()['status'], 'REFUSED_UNSENT')
            fresh = propose(self.root, 'game', 'new scene', 'new tile', 'marker', self.raw)
            self.assertNotEqual(fresh['proposalId'], self.proposal)

        def test_discard_is_zero_dispatch(self):
            self.captured()
            with patch.object(reviewed, 'gesture') as g:
                self.assertTrue(discard(self.root, self.proposal, 'scene differs')['noIntent'])
                g.assert_not_called()
            self.assertClosedNoLaterRequests()

        def test_second_capture_refuses(self):
            self.captured()
            with self.assertRaisesRegex(AssertionError, 'one capture'): self.captured()
            self.assertClosedNoLaterRequests()

        def test_capture_clock_cannot_be_reanchored(self):
            self.captured(); self.scene['capturedAt'] += .01; self.save()
            with self.assertRaisesRegex(AssertionError, 'binding mismatch'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_candidate_change_refuses(self):
            self.captured()
            p = paths(self.root, self.proposal)[0]
            value = read(p); value['action']['x'] += 1
            p.write_text(json.dumps(value))
            with self.assertRaisesRegex(AssertionError, 'candidate changed'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_changed_image_refuses(self):
            self.captured(); (self.root / 'scene.png').write_bytes(b'changed')
            with self.assertRaisesRegex(AssertionError, 'image changed'): self.confirm()
            self.assertClosedNoLaterRequests()

        def test_handoff_mismatch_refuses(self):
            self.captured()
            with self.assertRaisesRegex(AssertionError, 'handoff mismatch'):
                self.confirm(handoff=json.dumps(dict(frameId='old', proposalId=self.proposal)))
            self.assertClosedNoLaterRequests()

        def test_written_pending_blocks_capture_before_native_request(self):
            tim.exclusive(self.root / 'command-old.json', dict(nonce='pending'))
            with patch.object(reviewed, 'capture') as c:
                with self.assertRaisesRegex(AssertionError, 'still pending'): self.captured()
                c.assert_not_called()
            self.assertTrue((self.root / 'single-dispatch-closed.json').exists())

        def test_existing_unknown_blocks_capture_and_confirmation(self):
            tim.exclusive(self.root / 'UNKNOWN.json', dict(irreversible=True))
            with self.assertRaisesRegex(AssertionError, 'terminal UNKNOWN'): self.captured()
            self.assertClosedNoLaterRequests()

        def test_post_image_requires_real_post_up_receipt(self):
            with self.assertRaisesRegex(AssertionError, 'actual post-UP'):
                post_observation(self.root, 'old', 'missing')

        def test_post_image_reads_rendered_scene_without_capture_request(self):
            self.captured()
            tim.exclusive(self.root / 'consequence-diagnostic.json', dict(actualPostUP=True))
            before = sorted(p.name for p in self.root.iterdir())
            with patch.object(reviewed, 'capture') as capture_request:
                image = post_observation(self.root, 'old', 'diagnostic')
                self.assertTrue(image['noNewCaptureRequest'])
                capture_request.assert_not_called()
            self.assertEqual(before, sorted(p.name for p in self.root.iterdir()))

        def test_post_image_stops_at_unknown(self):
            tim.exclusive(self.root / 'consequence-diagnostic.json', dict(actualPostUP=True))
            tim.exclusive(self.root / 'UNKNOWN.json', dict(irreversible=True))
            self.assertIsNone(post_observation(self.root, 'old', 'diagnostic'))

        def test_conversation_capture_never_implicitly_confirms(self):
            import subprocess
            js = r'''
const assert=require('assert/strict'),recipe=JSON.parse(process.argv[1]);
const state=new Map(),calls=[],images=[];
const load=k=>state.get(k),store=(k,v)=>state.set(k,v),image=v=>images.push(v),text=()=>{};
store('timSingle',{root:'/diagnostic',helper:'helper.py',mode:'game'});
const tools={exec_command:async o=>{
 calls.push(o.cmd);
 if(o.cmd.includes('--propose'))return {exit_code:0,output:JSON.stringify({proposalId:'candidate'})};
 if(o.cmd.includes('--capture'))return {exit_code:0,output:JSON.stringify({proposalId:'candidate',frameId:'frame',png:'/diagnostic/frame.png',capturedAt:Date.now()/1000})};
 if(o.cmd.includes('--confirm'))return {exit_code:0,output:JSON.stringify({postUPExecution:false,nativeWait:true})};
 throw Error('unexpected tool');
},view_image:async()=>({image_url:'data:application/octet-stream;base64,UE5HLWJ5dGVz'})};
(async()=>{
 await eval(recipe.proposal)('whole provisional scene','tile',{kind:'click',x:1,y:2,button:1,holdMs:100},'marker');
 await eval(recipe.capture)();
 assert.equal(images.length,2);assert.deepEqual(images[0],images[1]);assert.equal(images[0].type,'image');
 assert.equal(images[0].mimeType,'image/png');assert.equal(images[0].data,'UE5HLWJ5dGVz');
 assert.equal(load('timHandoff').imageContentMimeType,'image/png');
 assert.equal(calls.length,2);assert(calls.every(x=>!x.includes('--confirm')));
 await assert.rejects(eval(recipe.explicitPostReviewConfirmation)('yes'),/explicit/);
 assert.equal(calls.length,2);
 await eval(recipe.explicitPostReviewConfirmation)('confirm');
 assert.equal(calls.length,3);assert(calls[2].includes('--confirm'));
 console.log('capture zero-dispatch; separate explicit confirmation only');
})().catch(e=>{console.error(e);process.exitCode=1});
'''
            result = subprocess.run(['node', '-e', js, json.dumps(ORCHESTRATION)], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr.decode())

    return not unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(SingleCandidate)).wasSuccessful()


if __name__ == '__main__':
    if sys.argv[1] == '--orchestration':
        print(json.dumps(ORCHESTRATION)); raise SystemExit(0)
    if sys.argv[1] == '--pure':
        raise SystemExit(pure())
    if sys.argv[1] == '--native-controls':
        native_controls(sys.argv[2]); raise SystemExit(0)
    function = {'--propose': propose, '--capture': capture, '--confirm': confirm, '--discard': discard}[sys.argv[1]]
    print(json.dumps(function(*sys.argv[2:])))
