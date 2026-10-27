import os,sys,pathlib,time,signal
d=pathlib.Path(sys.argv[2]);stage=sys.argv[1]
(d/(stage+'.started')).write_text('started')
if stage=='startup':
 pid=os.fork()
 if pid==0:
  def late(*_):
   os.write(1,b'LATE-OUT');os.write(2,b'LATE-ERR');(d/'late.ack').write_text('written')
  signal.signal(signal.SIGUSR1,late)
  (d/'descendant.pid').write_text(str(os.getpid()));(d/'ready').write_text('ready')
  while True:time.sleep(.05)
 while not (d/'ready').exists():time.sleep(.005)
 os.write(1,b'BASE');os._exit(0)
