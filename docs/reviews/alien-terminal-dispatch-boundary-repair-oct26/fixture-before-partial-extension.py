#!/usr/bin/env python3
"""Focused real CLI/HTTP regressions; no guest or runtime allocation.

Run with the prescribed execution pool and whole-tree physical supervisor.
ALIEN_CONTROL_ROOT selects an actual isolated source mutation for controls.
"""
import contextlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import urllib.request

ROOT=Path(os.environ.get('ALIEN_CONTROL_ROOT',Path(__file__).resolve().parents[1]))
def load(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
legacy=load(ROOT/'test/test-alien-control-sequence.py','legacy')

class Boundary(legacy.Case):
    def challenge(self,where,index):
        entry=load(ROOT/'test/alien-gameplay-sequence.py','production_entry')
        plan=legacy.PLAN; values=legacy.VALUES
        endpoint,sends=self.server([dict(value=v) for v in values])
        original_fsync=os.fsync;original_request=urllib.request.Request
        original_connect=http.client.HTTPConnection.connect
        injected=[]
        def terminal():
            state=self.state()
            self.assertEqual(state['pending'],dict(index=index,command=plan[index]))
            self.assertEqual(state['status'],'uncertain')
            # Actual supervisor receipt is an independent external file: it
            # shares no controller flock. Publish file + directory durably.
            with self.terminal.open('w') as stream:
                json.dump(dict(reason='supervisor-ended',returncode=0,batch=4754),stream)
                stream.flush();original_fsync(stream.fileno())
            fd=os.open(self.home,os.O_RDONLY|os.O_DIRECTORY)
            try:original_fsync(fd)
            finally:os.close(fd)
            injected.append(dict(where=where,pending=state['pending']))
        def fsync(fd):
            original_fsync(fd)
            if (where=='durable-intent' and not injected and
                os.readlink('/proc/self/fd/'+str(fd))==str(self.home) and
                self.state().get('pending',{}).get('index')==index):terminal()
        def request(*args,**kwargs):
            result=original_request(*args,**kwargs)
            if where=='request-prepared' and not injected and self.state()['pending']['index']==index:terminal()
            return result
        def connect(connection):
            result=original_connect(connection)
            if where=='connected-before-bytes' and not injected and self.state()['pending']['index']==index:terminal()
            return result
        os.fsync=fsync;urllib.request.Request=request;http.client.HTTPConnection.connect=connect
        try:rc=self.entry_run(plan,endpoint)
        finally:
            os.fsync=original_fsync;urllib.request.Request=original_request;http.client.HTTPConnection.connect=original_connect
        observed=[json.loads(s) for s in sends.read_text().splitlines()] if sends.exists() else []
        state=self.state()
        self.assertEqual(len(injected),1)
        self.assertNotEqual(rc,0)
        self.assertEqual(observed,plan[:index],'request dispatched after durable observed terminal')
        self.assertEqual(state['status'],'terminal')
        self.assertEqual(state['pending'],dict(index=index,command=plan[index]))
        self.assertEqual(state['next'],index)
        self.assertEqual(len(state['receipts']),index)
        self.assertEqual(state['terminalObserved']['batch'],4754)
        before=list(observed)
        self.assertNotEqual(self.entry_run(plan,endpoint),0)
        after=[json.loads(s) for s in sends.read_text().splitlines()] if sends.exists() else []
        self.assertEqual(after,before)
        print(json.dumps(dict(where=where,index=index,action=plan[index],sends=len(observed),pending=state['pending'],restartSentNothing=True)))

    def test_durable_intent(self):
        self.challenge('durable-intent',int(os.environ.get('BOUNDARY_INDEX','3')))

    def test_request_prepared(self):
        self.challenge('request-prepared',int(os.environ.get('BOUNDARY_INDEX','3')))

    def test_connected_before_bytes(self):
        self.challenge('connected-before-bytes',int(os.environ.get('BOUNDARY_INDEX','3')))

class Crashes(legacy.Case):
    def test_custom_transport_post_intent_guard(self):
        original=os.fsync
        for index in range(len(legacy.PLAN)):
            self.ledger=self.home/('custom-'+str(index)+'.json')
            self.terminal.unlink(missing_ok=True)
            sends=[]
            def fsync(fd):
                original(fd)
                if (os.readlink('/proc/self/fd/'+str(fd))==str(self.home)
                    and not self.terminal.exists()
                    and self.state().get('pending',{}).get('index')==index):
                    with self.terminal.open('w') as stream:
                        json.dump(dict(reason='ended',returncode=0,batch=4754),stream)
                        stream.flush();original(stream.fileno())
                    directory=os.open(self.home,os.O_RDONLY|os.O_DIRECTORY)
                    try:original(directory)
                    finally:os.close(directory)
            def transport(command):
                i=len(sends);sends.append(command);return legacy.body(legacy.VALUES[i])
            os.fsync=fsync
            try:
                with self.assertRaises(legacy.control.ControlStopped):
                    legacy.control.Controller(self.ledger,'custom',transport,self.terminal).run(legacy.PLAN)
            finally:os.fsync=original
            self.assertEqual(sends,legacy.PLAN[:index])
            self.assertEqual(self.state()['pending'],dict(index=index,command=legacy.PLAN[index]))

    def test_process_crashes_refuse_restart(self):
        # Real CLI and HTTP object, killed before network; one fresh ledger per
        # crash. No command becomes an ACK merely because its intent persisted.
        for point in ('intent-file-fsync','intent-directory-fsync','request-prepared','terminal-before-latch'):
            with self.subTest(point=point):
                self.ledger=self.home/(point+'.json');self.terminal=self.home/(point+'-terminal.json')
                script='''import importlib.util,json,os,sys,urllib.request
from pathlib import Path
spec=importlib.util.spec_from_file_location('entry',sys.argv[1]);e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
ledger=Path(sys.argv[2]);terminal=Path(sys.argv[3]);point=sys.argv[4]
original=os.fsync;request=urllib.request.Request

def fsync(fd):
 original(fd)
 if point=='intent-file-fsync' and os.readlink('/proc/self/fd/'+str(fd))==str(ledger)+'.new':
  if json.loads(Path(str(ledger)+'.new').read_text()).get('pending'):os._exit(17)
 if os.readlink('/proc/self/fd/'+str(fd))==str(ledger.parent) and ledger.exists() and json.loads(ledger.read_text()).get('pending'):
  if point=='intent-directory-fsync':os._exit(17)
  if point=='terminal-before-latch':
   with terminal.open('w') as f:
    json.dump({'reason':'ended','batch':4754,'returncode':0},f);f.flush();original(f.fileno())
   d=os.open(ledger.parent,os.O_RDONLY|os.O_DIRECTORY);original(d);os.close(d);os._exit(17)
def prepared(*args,**kwargs):
 result=request(*args,**kwargs)
 if point=='request-prepared':os._exit(17)
 return result
os.fsync=fsync;urllib.request.Request=prepared
plan=ledger.with_suffix('.plan');plan.write_text('{"commands":[{"action":"snapshot"}]}')
e.main(['--allow-control','--plan',str(plan),'--ledger',str(ledger),'--run-id','crash','--endpoint','http://127.0.0.1:1/ctl','--terminal-file',str(terminal)])
'''
                r=subprocess.run([sys.executable,'-c',script,str(ROOT/'test/alien-gameplay-sequence.py'),str(self.ledger),str(self.terminal),point],capture_output=True,timeout=5)
                self.assertEqual(r.returncode,17,r.stderr)
                state=self.state()
                self.assertEqual(state['receipts'],[])
                self.assertEqual(state['next'],0)
                if point!='intent-file-fsync':
                    self.assertEqual(state['status'],'uncertain')
                    self.assertEqual(state['pending']['index'],0)
                sends=[]
                with self.assertRaises(legacy.control.ControlStopped):
                    legacy.control.Controller(self.ledger,'restart',lambda c:sends.append(c),self.terminal).run([dict(action='snapshot')])
                self.assertEqual(sends,[])
                print(json.dumps(dict(crash=point,ledgerStatus=state['status'],restartSentNothing=True)))

    def test_lock_and_malformed_terminal_refuse(self):
        import fcntl
        lock=self.ledger.with_name(self.ledger.name+'.lock').open('a')
        try:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError):legacy.control.Controller(self.ledger,'locked',lambda c:self.fail('sent')).run([dict(action='snapshot')])
        finally:lock.close()
        self.terminal.write_text('{broken')
        with self.assertRaises(legacy.control.ControlStopped):legacy.control.Controller(self.ledger,'malformed',lambda c:self.fail('sent'),self.terminal).run([dict(action='snapshot')])
        self.assertEqual(self.state()['status'],'terminal')

if __name__=='__main__':unittest.main()
