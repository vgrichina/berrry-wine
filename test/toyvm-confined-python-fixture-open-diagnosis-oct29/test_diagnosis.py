#!/usr/bin/env python3
import ast
import json
import unittest
import diagnose as d


class DiagnosisTests(unittest.TestCase):
    def test_prior_real_cli_same_confinement_different_startup(self):
        prior = json.loads((d.HERE/'prior-cli-runtime.json').read_text())
        current = json.loads((d.HERE/'dispatch.json').read_text())
        confine = 'test/toyvm-kernel-profile-accounting-backend-oct28/confine.py'
        self.assertEqual(prior['preflight']['pinsVerified'][confine],current['sourcePins'][confine])
        argv = prior['argv']
        self.assertEqual(argv[argv.index('--')+1:][:3],['/usr/bin/python3','-B','-c'])
        self.assertTrue(prior['PASS'])
        self.assertEqual(prior['cli']['backendReceipt']['filesystem']['failure'],'filesystem per-file limit')
        self.assertGreater(prior['cli']['backendReceipt']['filesystem']['inodes'],1)
        self.assertFalse(prior['cli']['accepted'])  # successful negative test, not positive qualification

    def test_pinned_evidence_and_fixture_transport(self):
        result = d.analyze()
        old = result['childArgv']
        new = result['proposedProductionCLI']
        child = new[new.index('--')+1:]
        self.assertEqual(child[:3], ['/usr/bin/python3','-B','-c'])
        self.assertEqual(child[4:], old[3:])
        self.assertEqual(child[3].encode(), (d.HERE/'fixture.py.txt').read_bytes())
        self.assertFalse(result['proposalRuntimeTested'])

    def test_policy_negative_and_positive_controls(self):
        result = d.analyze()
        allowed = result['allowedSyscalls']
        policy = d.program(allowed)
        self.assertEqual(d.interpret(policy,16),0x50001)
        for call in (2,72,257,262):
            self.assertEqual(d.interpret(policy,call),0x7fff0000)
        self.assertEqual(d.interpret(policy,257,0),0x80000000)
        self.assertEqual(d.interpret(policy,0x40000000|257),0x80000000)
        # Negative control: hypothetical prohibited widening defeats the diagnosis check.
        self.assertNotEqual(d.interpret(d.program(allowed+[16]),16),0x50001)

    def test_wrong_fixture_arguments_rejected(self):
        case = json.loads((d.HERE/'predecessor-case1-result.json').read_text())
        bad = list(case['argv'])
        bad[bad.index('--')+3] = '/tmp/different-fixture.py'
        with self.assertRaises(AssertionError):
            d.propose(bad,(d.HERE/'fixture.py.txt').read_bytes())

    def test_binary_call_chain_and_branch_controls(self):
        # Read retained disassembly only; do not call private C APIs or install a filter.
        main = (d.HERE/'main-fopen.disassembly.txt').read_text()
        fopen = (d.HERE/'python-fopen.disassembly.txt').read_text()
        helper = (d.HERE/'internal-inherit.disassembly.txt').read_text()
        cold = (d.HERE/'eprem-branch.disassembly.txt').read_text()
        wide = (d.HERE/'python-wfopen.disassembly.txt').read_text()
        self.assertIn('call   6bbe40 <_Py_fopen_obj',main)
        self.assertIn('mov    $0x1,%edx',fopen)
        self.assertIn('call   61b6d0',fopen)
        self.assertIn('mov    $0x5451,%eax',helper)
        self.assertIn('call   420310 <ioctl@plt>',helper)
        self.assertIn('cmp    $0x19,%eax',cold)  # ENOTTY
        self.assertIn('cmp    $0xd,%eax',cold)   # EACCES
        self.assertNotIn('cmp    $0x1,%eax',cold)  # EPERM is not a fallback errno
        # Distinguish the nonraising wide-path helper: it disables this ioctl path.
        self.assertIn('xor    %edx,%edx',wide)
        fixture_tree = ast.parse((d.HERE/'fixture.py.txt').read_text())
        indices = [n.slice.value for n in ast.walk(fixture_tree)
                   if isinstance(n,ast.Subscript) and ast.unparse(n.value)=='sys.argv'
                   and isinstance(n.slice,ast.Constant)]
        self.assertEqual(sorted(indices),[1,2])


if __name__ == '__main__':
    unittest.main(verbosity=2)
