"""Retired attach contract: PID, endpoint and inherited FDs grant no authority.

Old attach-success/process-key tests are replaced explicitly, not skipped.
Positive original-supervisor ownership tests live in test_supervised.py.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

spec=importlib.util.spec_from_file_location('old_fixture',Path(__file__).with_name('test_controller.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)

class OwnerCase(unittest.TestCase):
    def test_supplied_process_and_inherited_fd_cannot_attach(self):
        case=f.Case('test_approved_menu_action_then_reserved_evidence_and_quit')
        case.setUp()
        sleeper=subprocess.Popen([sys.executable,'-S','-c','import time; time.sleep(20)'],pass_fds=(case.server.fileno(),))
        registry=Path('/tmp/wine-ops-alien-menu-owners-'+str(os.getuid()))
        before={str(p):p.read_bytes() for p in registry.glob('*.json')}
        try:
            endpoint='http://127.0.0.1:%d/ctl'%case.server.server_port
            process=dict(pid=sleeper.pid,startTicks=Path('/proc/%d/stat'%sleeper.pid).read_text().rsplit(') ',1)[1].split()[19],endpoint=endpoint)
            case.assert_blocked(case.run_cli(process=process),'attachment retired')
            self.assertEqual(case.commands(),[])
            self.assertEqual(before,{str(p):p.read_bytes() for p in registry.glob('*.json')})
        finally:
            sleeper.terminate();sleeper.wait(timeout=2);case.doCleanups()

if __name__=='__main__':
    f.OUT.mkdir(parents=True,exist_ok=False)
    unittest.main(verbosity=2)
