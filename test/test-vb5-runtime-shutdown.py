#!/usr/bin/env python3
"""Actual native CLI + independent watchdog + outer signal/error/timeout joins.

Uses the production shutdown functions, not process absence as a wait oracle.
No original media is launched. Each regular output file is closed explicitly.
"""
import importlib.util,json,os,pathlib,signal,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parent.parent
def module():
    spec=importlib.util.spec_from_file_location('runtime',ROOT/'tools/vb5cce-original-runtime.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def child(mode,run,exe):
    m=module();m.RUN=run;m.install_shutdown_handlers();m.seal('shutdown-fixture',b'owned')
    w=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/vb5cce-original-runtime.py'),'watchdog',str(time.time()+4)],
        env=dict(os.environ,DELPHI5_RUN=str(run)),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    p=None;success=False
    try:
        while not (run/'watchdog-armed.json').exists():assert w.poll() is None;time.sleep(.01)
        with (run/'native.stdout.log').open('xb') as out,(run/'native.stderr.log').open('xb') as err:
            p=subprocess.Popen(['node','test/run.js','--exe='+str(exe),'--no-build','--threads','--real-ticks',
                '--max-seconds=30','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks'],
                cwd=ROOT,stdout=out,stderr=err,start_new_session=True)
            info=dict(pid=p.pid,startToken=m.token(p.pid));m.save('current-native-pid.json',info)
            try:
                if mode!='normal':
                    due=time.time()+3
                    while '[MessageBox]' not in (run/'native.stdout.log').read_text():
                        assert p.poll() is None and time.time()<due;time.sleep(.01)
                m.save('ready.json',dict(pid=os.getpid(),native=p.pid,mode=mode))
                if mode=='error':raise RuntimeError('injected outer exception')
                if mode=='term':os.kill(os.getpid(),signal.SIGTERM)
                if mode=='eof':p.send_signal(signal.SIGTERM)
                m.wait_native(p,run,info,timeout=.1 if mode=='timeout' else 8)
            finally:
                if not (run/'native-wait.json').exists():
                    m.terminate_owned(p);m.publish(run/'native-wait.json',dict(**info,exit=p.returncode,actualWait=True))
        success=True
    finally:
        # Native's regular descriptors close on unwinding before watchdog join.
        m.save('pipeline-closed.json',dict(actualNativeWait=(run/'native-wait.json').exists()))
        m.join_watchdog(w)
        for fd in list(m.OWN_FDS):m.close_owned(fd)
        m.save('runtime-release.json',dict(success=success,ownDescriptorsClosed=not m.OWN_FDS,
            nativeOutputClosed=out.closed and err.closed))
def main(run):
    run.mkdir(parents=True)
    exe=run/'modal.exe';normal=run/'normal.exe'
    subprocess.run(['node','-e',"const fs=require('fs');fs.writeFileSync(process.argv[1],require('./test/test-sims-child-mount-native.cjs').untitledModal());const b=require('./tools/kernel32-native-fixture').makeFixture();b.fill(0,0xb00,0xb20);b.writeUInt32LE(0x1a00,0xb00);b.write('ExitProcess\\0',0xc02);b.set([0x6a,0,0xff,0x15,0,0x19,0x40,0],0x1200);fs.writeFileSync(process.argv[2],b);",str(exe),str(normal)],cwd=ROOT,check=True)
    results=[]
    for mode in ('normal','term','error','timeout','eof','watchdog'):
        target=run/mode;target.mkdir()
        p=subprocess.Popen([sys.executable,'-B',__file__,'--child',mode,str(target),str(normal if mode=='normal' else exe)],
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        try:a,b=p.communicate(timeout=20)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid,signal.SIGKILL);a,b=p.communicate();raise
        (target/'outer.stdout.log').write_bytes(a);(target/'outer.stderr.log').write_bytes(b)
        expected=143 if mode=='term' else 1 if mode in ('error','timeout') else 0
        assert p.returncode==expected,(mode,p.returncode,b.decode())
        native=json.loads((target/'native-wait.json').read_text());watch=json.loads((target/'watchdog-wait.json').read_text());release=json.loads((target/'runtime-release.json').read_text())
        assert native['actualWait'] and watch['actualWait'] and watch['stdoutEOF'] and watch['stderrEOF']
        assert watch['exit']==0 and release['ownDescriptorsClosed'] and release['nativeOutputClosed']
        if mode=='normal':assert native['exit']==0
        if mode=='watchdog':assert json.loads((target/'watchdog-exit.json').read_text())['reason']=='independent fixed deadline'
        results.append(dict(mode=mode,outerExit=p.returncode,actualOuterWait=True,stdoutEOF=True,stderrEOF=True,native=native,watchdog=watch,release=release))
    (run/'results.json').write_text(json.dumps(dict(passed=True,cases=results),indent=2)+'\n')
    print('PASS actual native/watchdog/outer TERM143/error/timeout/EOF/deadline joins and descriptor release')
if __name__=='__main__':
    if sys.argv[1]=='--child':child(sys.argv[2],pathlib.Path(sys.argv[3]),pathlib.Path(sys.argv[4]))
    else:main(pathlib.Path(sys.argv[1]).resolve())
