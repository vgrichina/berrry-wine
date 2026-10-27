"""Listener possession is observational, never original-runtime authority.

The historical shared-parent fixture below proves only attach refusal; the
production entry tests use actual launched children serving their own state.
"""
import os
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
import test_controller as f
from test_ownership import OwnershipTests


class ListenerTests(unittest.TestCase):
    def test_shared_state_alternate_inherited_listener_cannot_attach(self):
        helpers=OwnershipTests()
        with f.FakeProduction(real_delay=True) as server,tempfile.TemporaryDirectory() as tmp:
            alias=type(server.server)(('127.0.0.1',0),server.server.RequestHandlerClass)
            thread=threading.Thread(target=alias.serve_forever,kwargs={'poll_interval':.01},daemon=True)
            idle=subprocess.Popen([sys.executable,'-S','-c','import time;time.sleep(120)'],
                pass_fds=(alias.fileno(),),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            thread.start()
            try:
                before=helpers.registry()
                for i,(pid,port) in enumerate(((os.getpid(),server.server.server_port),(idle.pid,alias.server_port))):
                    c=server.config(Path(tmp),pid=pid,process_start_ticks=f.ctl.process_identity(pid),
                        url=f'http://127.0.0.1:{port}/ctl',evidence_dir=str(Path(tmp)/f'forbidden-{i}'))
                    p=Path(tmp)/f'config-{i}.json';p.write_text(json.dumps(c))
                    helpers.refusal(p)
                    self.assertIsNone(idle.poll())
                    self.assertFalse(Path(c['evidence_dir']).exists())
                self.assertEqual(server.commands,[])
                self.assertEqual(helpers.registry(),before)
            finally:
                idle.terminate();idle.wait(timeout=5)
                alias.shutdown();alias.server_close();thread.join(timeout=5)

    def test_listener_proof_still_rejects_wrong_process(self):
        with f.FakeProduction() as server,tempfile.TemporaryDirectory() as tmp:
            c=server.config(Path(tmp),pid=os.getpid(),process_start_ticks=f.ctl.process_identity(os.getpid()))
            proof=f.ctl.ListenerIdentity(c)
            proof.verify()
            idle=subprocess.Popen([sys.executable,'-S','-c','import time;time.sleep(10)'])
            try:
                c.update(pid=idle.pid,process_start_ticks=f.ctl.process_identity(idle.pid))
                with self.assertRaises(f.ctl.Refusal):
                    f.ctl.ListenerIdentity(c)
                self.assertEqual(server.commands,[])
            finally:
                idle.terminate();idle.wait(timeout=5)


if __name__=='__main__':
    unittest.main()
