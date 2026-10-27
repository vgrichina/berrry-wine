import pathlib,sys,os,time
d=pathlib.Path(sys.argv[2]);stage=sys.argv[1];(d/(stage+'.started')).write_text('started')
if stage=='startup':
 child=os.fork()
 if child==0:(d/'aggregate-child.pid').write_text(str(os.getpid()))
 block=bytearray(12*1024*1024)
 os.write(2,b'aggregate-rss-participant\n')
 time.sleep(5)
