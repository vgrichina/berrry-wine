"""Actual inert syscalls through the sole published custody owner, offline."""
import hashlib
import gzip
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import types
import unittest
import native_publication_observer as observer

RUN = Path(os.environ.get('OBSERVER_RUN', 'scratch/runs/20261109-redline-publication-syscall-observer-1485')).resolve()
SOURCE = Path(__file__).with_name('native_kernel_custody.py').read_text()
C = r'''
#include <unistd.h>
#include <fcntl.h>
#include <sys/wait.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>
int main(int n,char **v) {
 if(!strcmp(v[1],"childexec")) { int p=fork(); if(!p) execl(v[0],v[0],"same",v[2],NULL); int s;waitpid(p,&s,0);return s; }
 if(!strcmp(v[1],"cancel")) { for(;;) pause(); }
 char path[1024];snprintf(path,sizeof(path),"%s%s",v[2],!strcmp(v[1],"rename")?".tmp":"");
 if(!strcmp(v[1],"failedopen")) strcat(path,"/missing");
 int fd=open(path,O_CREAT|O_WRONLY|O_TRUNC,0600);int e=errno;
 dprintf(1,"open=%d errno=%d\n",fd,fd<0?e:0);
 if(fd<0) return 0;
 if(!strcmp(v[1],"failedwrite")) {close(fd);fd=open(path,O_RDONLY);}
 ssize_t w=write(fd,"9222\n/devtools/browser/inert\n",29);e=errno;
 dprintf(1,"write=%zd errno=%d\n",w,w<0?e:0);
 close(fd);
 // Reuse descriptor for unrelated bytes; no retained fd map may attribute it.
 int other=open("/dev/null",O_WRONLY);write(other,"other",5);close(other);
 if(!strcmp(v[1],"rename")||!strcmp(v[1],"failedrename")) {
  int r=rename(path,!strcmp(v[1],"failedrename")?"/nonexistent-publication-1485/file":v[2]);e=errno;
  dprintf(1,"rename=%d errno=%d\n",r,r<0?e:0);
 }
 return 0;
}
'''

class Actual(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        RUN.mkdir(parents=True, exist_ok=True)
        cls.tmp = tempfile.TemporaryDirectory(dir=RUN)
        cls.base = Path(cls.tmp.name)
        src = cls.base/'writer.c';src.write_text(C)
        cls.exe=cls.base/'writer'
        subprocess.run(['cc','-Wall','-Werror','-O0',str(src),'-o',str(cls.exe)],check=True)
        (RUN/'writer-identity.json').write_text(json.dumps(dict(sha256=hashlib.sha256(cls.exe.read_bytes()).hexdigest(),source='C constant in tools/native_publication_observer_test.py',compiler=subprocess.check_output(['cc','--version'],text=True).splitlines()[0])))

    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()

    def execute(self, mode, cap=4096, byte_cap=4*1024*1024):
        run=RUN/(mode+('-cap' if cap<4096 else '-bytecap' if byte_cap<4*1024*1024 else ''))
        run.mkdir(exist_ok=True)
        for name in ('publication-syscalls.ndjson','kernel-armed.json'):
            (run/name).unlink(missing_ok=True)
        target=self.base/('DevToolsActivePort-'+mode)
        if mode=='failedopen': target.write_bytes(b'existing')
        child=subprocess.Popen([sys.executable,__file__,'--supervise',str(run),str(self.exe),mode,str(target),str(cap),str(byte_cap)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        watchdog=subprocess.Popen([sys.executable,'-c',
            'import os,signal,sys,time; print("ARMED",flush=True);time.sleep(12);os.kill(int(sys.argv[1]),signal.SIGTERM);time.sleep(3);os.kill(int(sys.argv[1]),signal.SIGKILL)',str(child.pid)],stdout=subprocess.PIPE,text=True)
        self.assertEqual(watchdog.stdout.readline().strip(),'ARMED')
        child.stdin.write(b'go\n');child.stdin.flush()
        if mode=='cancel':
            until=time.monotonic()+2
            while not (run/'kernel-armed.json').exists() and time.monotonic()<until: time.sleep(.005)
            self.assertTrue((run/'kernel-armed.json').exists())
            child.send_signal(signal.SIGTERM)
        try:
            out,err=child.communicate(timeout=16)
            self.assertEqual(child.returncode,0,err.decode())
        finally:
            if child.poll() is None: child.kill();child.communicate(timeout=3)
            watchdog.terminate();wr=watchdog.wait(timeout=3)
            eof=watchdog.stdout.read()=='';watchdog.stdout.close()
            (run/'watchdog.json').write_text(json.dumps(dict(armed=True,actualWait=wr,separateEOF=eof,supervisorActualWait=child.returncode,supervisorSeparateEOF=True)))
        data=(run/'publication-syscalls.ndjson').read_bytes()
        self.assertLessEqual(len(data),4*1024*1024)
        rows=observer.validate(data)
        custody={r['sequence']:r for r in map(json.loads,(run/'custody.ndjson').read_text().splitlines())}
        for r in rows:
            if r['kind'] in ('entry','return'):
                waited=custody[r['waitSequence']]
                self.assertEqual((waited['pid'],waited['start'],waited['waitStatus']),(r['pid'],r['start'],r['waitStatus']))
                self.assertEqual(custody[r['custodySequence']]['kind'],'custody')
                raw=bytes.fromhex(r['rawHex'])
                if r['kind']=='entry':
                    self.assertEqual(int.from_bytes(raw[24:32],'little'),r['nr'])
                else:
                    self.assertEqual(int.from_bytes(raw[24:32],'little',signed=True),r['result'])
        drain=json.loads((run/'kernel-drain.json').read_text())
        self.assertTrue(drain['complete']);self.assertTrue(drain['commandLog']['eof'])
        self.assertTrue(drain['reaped']);self.assertFalse(drain['remaining'])
        (run/'file-observation.json').write_text(json.dumps(dict(exists=target.exists(),bytesHex=target.read_bytes().hex() if target.exists() else None,traceJSONExists=(run/'native-startup-trace.json').exists())))
        self.assertFalse((run/'native-startup-trace.json').exists())
        return rows,target,drain

    def test_actual_publication_paths_returns_and_bytes(self):
        for mode in ('same','rename','failedopen','failedwrite','failedrename','childexec'):
            with self.subTest(mode=mode):
                rows,target,drain=self.execute(mode)
                entries={r['observerSequence']:r for r in rows if r['kind']=='entry'}
                calls=[(entries[r['entrySequence']],r) for r in rows if r['kind']=='return' and r['entrySequence'] in entries]
                actual_output=gzip.decompress((RUN/mode/'kernel-command.log.gz').read_bytes())
                if mode=='failedopen': self.assertIn(b'open=-1 errno=20',actual_output)
                if mode=='failedwrite': self.assertIn(b'write=-1 errno=9',actual_output)
                if mode=='failedrename': self.assertIn(b'rename=-1 errno=2',actual_output)
                observed=[(e,r) for e,r in calls if any(bytes.fromhex(p['bytesHex']).decode(errors='replace').startswith(str(target)) for p in e['paths'].values())]
                self.assertTrue(observed)
                if mode=='failedopen':
                    self.assertTrue(any(r['errno']==20 and r['result']==-20 for e,r in observed));self.assertEqual(target.read_bytes(),b'existing')
                elif mode=='failedwrite':
                    self.assertTrue(any(e['nr']==1 and r['errno']==9 and r['result']==-9 and e['fd'].get('link')==str(target) for e,r in calls));self.assertEqual(target.read_bytes(),b'')
                else:
                    self.assertEqual(target.read_bytes(),b'9222\n/devtools/browser/inert\n')
                if mode not in ('failedopen','failedwrite'):
                    self.assertTrue(any(e['nr']==1 and e['fd'].get('link') in (str(target),str(target)+'.tmp') and r['result']==29 and not r['isError'] for e,r in calls))
                if mode in ('rename','failedrename'):
                    self.assertTrue(any(e['nr']==82 and r['result']==(0 if mode=='rename' else -2) for e,r in calls))
                if mode!='failedopen':
                    pubs=[e for e,r in calls if e['nr']==1 and e['fd'].get('link')==str(target)]
                    others=[e for e,r in calls if e['nr']==1 and e['fd'].get('link')=='/dev/null']
                    self.assertTrue(others)
                    if pubs: self.assertEqual(pubs[-1]['fd']['number'],others[-1]['fd']['number'])
                if mode=='childexec': self.assertGreaterEqual(len(drain['owned']),2)
                # exit_group has no fabricated return: explicitly incomplete.
                self.assertIn('unreturned-syscall',rows[-1]['incompleteReasons'])

    def test_cancel_cap_and_lost_records_are_incomplete(self):
        rows,_,_=self.execute('cancel')
        self.assertIn('cancellation-sent',rows[-1]['incompleteReasons'])
        capped,_,_=self.execute('same',cap=12)
        self.assertLessEqual(len(capped),12);self.assertIn('record-cap',capped[-1]['incompleteReasons'])
        byte_capped,_,_=self.execute('same',byte_cap=4096)
        self.assertLessEqual((RUN/'same-bytecap'/'publication-syscalls.ndjson').stat().st_size,4096)
        self.assertIn('byte-cap',byte_capped[-1]['incompleteReasons'])
        lines=(RUN/'same-cap'/'publication-syscalls.ndjson').read_bytes().splitlines(keepends=True)
        # Actual durable bytes damaged as negative controls, never synthetic positives.
        for damaged in (b''.join(lines)[:-3],b''.join(lines[:-1]),b''.join(lines[:2]+lines[3:]),b''.join(lines[:2]+lines[1:])):
            with self.assertRaises((ValueError,KeyError)): observer.validate(damaged)

    def test_synthetic_identity_ambiguity_negative_only(self):
        with tempfile.TemporaryDirectory(dir=RUN) as tmp:
            def forbidden(*args): self.fail('ambiguous identity must not inspect syscalls')
            obj=observer.Observer(tmp,forbidden,lambda pid:dict(start='DIFFERENT'))
            obj.stop(123,'EXPECTED',1,2,0)
            obj.close()
            rows=observer.validate((Path(tmp)/'publication-syscalls.ndjson').read_bytes())
            self.assertFalse(rows[-1]['complete'])
            self.assertIn('identity-ambiguity',rows[-1]['incompleteReasons'])
            self.assertFalse(any(r['kind'] in ('entry','return') for r in rows))

    def test_default_off_exact_pin_and_bounds(self):
        self.assertEqual(observer.candidate(SOURCE),SOURCE)
        enabled=observer.candidate(SOURCE,enabled=True)
        for api in ('os.waitpid(', 'os.waitid(', 'os.fork('): self.assertEqual(enabled.count(api),SOURCE.count(api))
        with self.assertRaises(ValueError):observer.candidate(SOURCE+'\n',enabled=True)
        self.assertEqual(hashlib.sha256(Path(__file__).with_name('native_kernel_custody.py').read_bytes()).hexdigest(),observer.COLLECTOR_SHA256)

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--supervise':
        _,_,directory,exe,mode,target,cap,byte_cap=sys.argv
        assert sys.stdin.readline()=='go\n'
        module=types.ModuleType('candidate')
        exec(compile(observer.candidate(SOURCE,enabled=True,max_records=int(cap),max_bytes=int(byte_cap)),'<pinned-candidate>','exec'),module.__dict__)
        due=time.time()+3
        try: module.supervise(directory,[exe,mode,target],deadline=due,cleanup_deadline=due+3,command_compression='gzip')
        except InterruptedError:
            if mode!='cancel': raise
    else: unittest.main()

