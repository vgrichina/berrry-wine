"""Independent offline checks; donor code and fixtures are never written."""
import base64,copy,hashlib,importlib.util,json,os,subprocess,sys,unittest,zlib
from pathlib import Path
ROOT=Path('/tmp/penguin-explicit-budget-independent-accept-oct27')
DONOR=Path('/tmp/penguin-explicit-capture-budget-repair-oct27/repo')
SOURCE=DONOR/'tools/penguin_capture_contract.py'
PIN='efcf3c5656a40800a4add90f1882d24830b8cb142626161dd3535d0027491c0b'
spec=importlib.util.spec_from_file_location('candidate',SOURCE)
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
OPS=Path(os.environ['PENGUIN_ACCEPT_OPS']);OPS.mkdir(exist_ok=True,parents=True)
env=json.loads((DONOR/'test/fixtures/penguin-wire-envelope.json').read_bytes())

def frames(plan):
    return [json.dumps(dict(env,stdout=c.wire(record).decode()+'\n',commandId='independent-'+str(i)),ensure_ascii=False,indent=1).encode() for i,record in enumerate(plan['records'])]

class Independent(unittest.TestCase):
    def setUp(self):
        self.assertEqual(hashlib.sha256(SOURCE.read_bytes()).hexdigest(),PIN)
        self.root=OPS/self._testMethodName;self.root.mkdir()
        self.png=self.root/'independent.png'
        self.data=b'\x89PNG\r\n\x1a\n'+bytes((i*79+i//7)%256 for i in range(1703))
        self.png.write_bytes(self.data)

    def plan(self,budget=8388608,used=41,tail=73):
        return c.plan_provider_images([self.png],used=used,tail_reserve=tail,capture_budget=budget,chunk_bytes=128)

    def closed(self,collector):
        charged=collector.charged
        for op in (lambda:collector.finish(),lambda:collector.account(b'new poll'),lambda:collector.accept(b'{}')):
            with self.assertRaises(c.ContractError):op()
            self.assertEqual(collector.charged,charged)

    def test_first_exact_cli_receipts_and_original_bytes(self):
        default=json.loads((ROOT/'ops/first-production-default.json').read_text())
        self.assertEqual(default['exit'],2);self.assertIsNone(default['stopReason']);self.assertTrue(default['cleanupComplete'])
        self.assertIn('UNSUPPORTED_PLAN', (ROOT/'ops/first-production-default.stdout').read_text())
        result=json.loads((ROOT/'ops/first-production-explicit.stdout').read_text())
        self.assertEqual(result['charged'],3178963);self.assertEqual(result['capture_budget'],8388608);self.assertEqual(result['tail_remaining'],0)
        expected=json.loads((OPS/'production/expected.json').read_text())
        for image in expected['images']:
            data=(OPS/'production/restored'/image['name']).read_bytes()
            self.assertEqual(len(data),image['size']);self.assertEqual(c.sha(data),image['sha256'])

    def test_invalid_profiles_every_supported_entry(self):
        for invalid in (True,False,0,-1,8388609,2**80,1.5,'8388608',None):
            for planner in (c.plan_images,c.plan_provider_images):
                with self.subTest(value=invalid,entry=planner.__name__),self.assertRaises(c.ContractError):
                    planner([self.png],used=0,capture_budget=invalid)
            with self.assertRaises(c.ContractError):c.CapturePlan(capture_budget=invalid)
            with self.assertRaises(c.ContractError):c.restore_provider_transcript([self.png],self.root/'absent',self.root/'out',used=0,capture_budget=invalid)
        self.assertEqual(c.API_BYTES,1048576)
        self.plan()
        self.assertEqual(c.plan_images([self.png],used=0)['capture_budget'],1048576)
        self.assertEqual(c.plan_provider_images([self.png],used=0)['capture_budget'],1048576)

    def test_supported_reconstruction_is_pinned_before_collection(self):
        for budget in (1048576,8388608):
            original=self.plan(budget)
            reconstructed=c.CapturePlan(**copy.deepcopy(dict(original)))
            reconstructed['canonical']=c.CapturePlan(**copy.deepcopy(dict(original['canonical'])))
            self.assertEqual(c.plan_budget(reconstructed,budget),budget)
            capture=c.ProviderCapture(reconstructed,capture_budget=budget)
            raw=frames(reconstructed);capture.account(b'poll')
            for response in raw:capture.accept(response)
            images,charged=capture.finish()
            self.assertEqual(images,[self.data]);self.assertEqual(charged,41+4+sum(map(len,raw)))
            self.assertEqual(capture.tail,69);self.closed(capture)
            canonical=reconstructed['canonical']
            self.assertEqual(c.restore_images(canonical,canonical['frames'],capture_budget=budget)[0],[self.data])
            with self.assertRaisesRegex(c.ContractError,'pinned'):c.ProviderCapture(dict(reconstructed))
            with self.assertRaisesRegex(c.ContractError,'pinned'):c.restore_images(dict(canonical),canonical['frames'])

    def test_snapshot_survives_original_nested_mutation_and_reconstruction(self):
        p=self.plan(1048576);raw=frames(p);capture=c.ProviderCapture(p)
        capture.accept(raw[0]);start=capture.charged
        p['capture_budget']=8388608;p['used']=0;p['canonical']['capture_budget']=8388608
        p['frame_limits'][:]=[0]*len(p['frame_limits']);p['records'].clear()
        replacement=self.plan(8388608,used=0)
        # A fresh reconstruction does not mutate this existing collector.
        c.CapturePlan(**copy.deepcopy(dict(replacement)))
        self.assertEqual(capture.capture_budget,1048576);self.assertEqual(capture.charged,start)
        for response in raw[1:]:capture.accept(response)
        self.assertEqual(capture.finish(),([self.data],41+sum(map(len,raw))))

    def test_nested_reconstruction_cannot_upgrade_consumed_collector(self):
        p=self.plan(1048576);raw=frames(p)
        for mode in ('nested-field','nested-reconstruction','outer-reconstruction','outer-field'):
            capture=c.ProviderCapture(p);capture.account(b'poll');capture.accept(raw[0])
            old=capture.charged
            if mode=='nested-field':capture.plan['canonical']['capture_budget']=8388608
            if mode=='nested-reconstruction':
                fields=copy.deepcopy(dict(capture.plan['canonical']));fields['capture_budget']=8388608
                capture.plan['canonical']=c.CapturePlan(**fields)
            if mode=='outer-reconstruction':capture.plan=self.plan(8388608,used=0)
            if mode=='outer-field':capture.plan['capture_budget']=8388608
            with self.subTest(mode=mode),self.assertRaisesRegex(c.ContractError,'mismatch'):capture.accept(raw[1])
            self.assertEqual(capture.charged,old+len(raw[1]));self.assertTrue(capture.failed);self.closed(capture)

    def test_expected_budget_mismatch_restorer_and_constructor(self):
        for budget,other in ((1048576,8388608),(8388608,1048576)):
            p=self.plan(budget)
            with self.assertRaisesRegex(c.ContractError,'mismatch'):c.ProviderCapture(p,capture_budget=other)
            q=p['canonical']
            with self.assertRaisesRegex(c.ContractError,'mismatch'):c.restore_images(q,q['frames'],capture_budget=other)
            p['canonical']=self.plan(other)['canonical']
            with self.assertRaisesRegex(c.ContractError,'mismatch'):c.ProviderCapture(p)

    def test_raw_poll_error_bytes_once_and_exact_remaining_reserve(self):
        for budget in (1048576,8388608):
            seed=self.plan(budget,used=0,tail=23)
            p=self.plan(budget,used=budget-seed['total'],tail=23)
            raw=frames(p);padded=[r+b' '*(n-len(r)) for r,n in zip(raw,p['frame_limits'])]
            self.assertTrue(all(len(r)==n for r,n in zip(padded,p['frame_limits'])))
            capture=c.ProviderCapture(p)
            for poll in (b'poll!',b'{"error":true}xxxx!'):
                capture.account(poll)
            self.assertEqual(capture.charged,p['used']+23);self.assertEqual(capture.tail,0)
            for r in padded:capture.accept(r)
            self.assertEqual(capture.finish(),([self.data],budget))
            failed=c.ProviderCapture(p)
            with self.assertRaisesRegex(c.ContractError,'reserve'):failed.account(b'x'*24)
            self.assertEqual(failed.charged,p['used']+24);self.assertTrue(failed.failed);self.closed(failed)
            failed=c.ProviderCapture(p)
            for r in padded[:-1]:failed.accept(r)
            with self.assertRaises(c.ContractError):failed.accept(padded[-1]+b' ')
            self.assertEqual(failed.charged,p['used']+sum(map(len,padded))+1);self.closed(failed)

    def test_late_error_is_charged_then_poisoned(self):
        p=self.plan();raw=frames(p)
        for error in (b'{}',c.wire(dict(env,stdout='error\n',exitCode=1,success=False)),b'\xff'):
            capture=c.ProviderCapture(p)
            for response in raw[:-1]:capture.accept(response)
            with self.assertRaises(c.ContractError):capture.accept(error)
            self.assertEqual(capture.charged,41+sum(map(len,raw[:-1]))+len(error));self.assertTrue(capture.failed);self.closed(capture)

    def test_production_cli_failure_never_publishes_partial_restore(self):
        p=self.plan();raw=frames(p);entries=[]
        for i,response in enumerate(raw):
            (self.root/f'{i}.json').write_bytes(response);entries.append(dict(kind='capture',path=f'{i}.json'))
        transcript=self.root/'transcript.json'
        base=[sys.executable,'-B',str(SOURCE),'restore-provider',str(self.png),'--transcript',str(transcript),'--used','41','--tail-reserve','73','--capture-budget','8388608']
        for mode in ('late-error','missing-end','extra-response','invalid-budget','over-budget','bool-budget','negative-budget','reserve-overflow','schema','truncated','decompression','hash'):
            argv=list(base);current=copy.deepcopy(entries)
            for i,response in enumerate(raw):(self.root/f'{i}.json').write_bytes(response)
            if mode=='late-error':(self.root/f'{len(raw)-1}.json').write_bytes(b'{}')
            if mode=='missing-end':current.pop()
            if mode=='extra-response':current.append(entries[-1])
            if mode in ('invalid-budget','over-budget','bool-budget','negative-budget'):argv[-1]={'invalid-budget':'0','over-budget':'8388609','bool-budget':'true','negative-budget':'-1'}[mode]
            if mode=='reserve-overflow':argv[argv.index('--used')+1]=str(8388608-p['serialized_bytes_limit']-73+1)
            if mode in ('schema','truncated'):
                e=json.loads(raw[-1]);e['stdoutTruncated' if mode=='truncated' else 'unknown']=True
                (self.root/f'{len(raw)-1}.json').write_bytes(c.wire(e))
            if mode in ('decompression','hash'):
                e=json.loads(raw[1]);r=json.loads(e['stdout'])
                packed=bytearray(base64.b64decode(r['data']));packed[0 if mode=='decompression' else -1]^=1
                r['data']=base64.b64encode(packed).decode();e['stdout']=c.wire(r).decode()+'\n'
                (self.root/'1.json').write_bytes(c.wire(e))
            transcript.write_bytes(c.wire(current));out=self.root/('out-'+mode)
            argv+=['--output',str(out)]
            # Distinct streams opened before process creation, including parser failures.
            with (self.root/(mode+'.stdout')).open('wb') as stdout,(self.root/(mode+'.stderr')).open('wb') as stderr:
                result=subprocess.run(argv,stdout=stdout,stderr=stderr,timeout=20)
            (self.root/(mode+'.command.json')).write_text(json.dumps(dict(argv=argv,exit=result.returncode),indent=2))
            self.assertEqual(result.returncode,2,mode);self.assertFalse(out.exists(),mode)
            self.assertFalse(list(self.root.glob('.out-*')),mode)

if __name__=='__main__':unittest.main(verbosity=2)
