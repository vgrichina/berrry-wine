import pathlib,sys,hashlib,json,runpy,os,time
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';p=R/'tools/boat-capture-readback.py'
original=p.read_bytes(); mode=sys.argv[1]
s=original.decode()
if mode=='no-subreaper':s=s.replace('libc.prctl(36, 1,','libc.prctl(36, 0,')
if mode=='no-kill':s=s.replace('signal.pidfd_send_signal(fd, signal.SIGKILL)', 'raise RuntimeError("omitted descendant signal hook")')
assert s!=original.decode()
try:
 p.write_text(s)
 os.environ['READBACK_TEST_RESULT']=str(O/(mode+'-results.json'))
 os.environ['READBACK_OWNERSHIP_MODE']='detached'
 sys.argv=[str(R/'test/test-boat-capture-readback.py'),'ReadbackTests.test_09_detached_transport_ownership']
 try:runpy.run_path(sys.argv[0],run_name='__main__');rc=0
 except SystemExit as e:rc=e.code
 assert rc!=0,'Omission challenge failed to reject'
 (O/(mode+'-challenge.json')).write_text(json.dumps(dict(mode=mode,sourceSHA256=hashlib.sha256(s.encode()).hexdigest(),originalSHA256=hashlib.sha256(original).hexdigest(),expectedRejection=True,returncode=rc),indent=2))
finally:p.write_bytes(original)
