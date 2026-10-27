"""Retired attachment regressions; production ownership is in test_supervised.

Old positive CLI-attach tests deliberately no longer apply. Historical sources,
claims and rejecting oracles remain referenced in README.md; no silent skips.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import test_controller as f


class OwnershipTests(unittest.TestCase):
    def refusal(self, path):
        r=subprocess.run([sys.executable,str(f.TOOL),'--config',str(path)],
                         capture_output=True,text=True,timeout=5)
        self.assertEqual(r.returncode,1,r.stderr)
        self.assertIn('existing-guest-attachment-retired',r.stdout)

    def registry(self):
        root=Path('/tmp')/f'enigma-frozen-controller-{os.getuid()}'
        return {x.name:hashlib.sha256(x.read_bytes()).hexdigest() for x in root.glob('*')}

    def test_public_constructor_never_recreates_authority(self):
        with self.assertRaisesRegex(f.ctl.Refusal,'existing-guest-attachment-retired'):
            f.ctl.Controller(dict(pid=os.getpid(),url='http://127.0.0.1:1/ctl'))

    def test_config_is_not_read_or_claimed_even_when_missing(self):
        before=self.registry()
        self.refusal('/nonexistent/enigma-legacy-config.json')
        self.assertEqual(self.registry(),before)

    def test_competing_cli_and_changed_authority_both_refuse(self):
        with f.FakeProduction() as server,tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);c=server.config(root)
            before=self.registry()
            paths=[]
            for i,updates in enumerate(({},dict(pid=os.getpid(),deadline_at=server.now+10000,
                                                max_batches=999999,terminal_path=str(root/'other-terminal')))):
                changed=dict(c,**updates);changed['evidence_dir']=str(root/f'forbidden-{i}')
                path=root/f'config-{i}.json';path.write_text(json.dumps(changed));paths.append(path)
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                list(pool.map(self.refusal,paths))
            self.assertEqual(server.commands,[])
            self.assertIsNone(server.process.poll())
            self.assertEqual(self.registry(),before)
            self.assertFalse(any(root.glob('forbidden-*')))


if __name__=='__main__':
    unittest.main()
