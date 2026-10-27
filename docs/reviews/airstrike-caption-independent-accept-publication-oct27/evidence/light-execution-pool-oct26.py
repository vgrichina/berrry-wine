#!/usr/bin/env python3
"""Reserve one 128 MiB execution slot (test) or both slots (Git).
Child resource supervision remains mandatory in the invoked command.
"""
import argparse,fcntl,os,subprocess,time
q=argparse.ArgumentParser();q.add_argument('--slots',type=int,choices=(1,2),required=True);q.add_argument('--wait',type=float,default=600);q.add_argument('command',nargs=argparse.REMAINDER);a=q.parse_args()
cmd=a.command[1:] if a.command[:1]==['--'] else a.command
if not cmd:q.error('command required')
end=time.monotonic()+a.wait
while True:
 held=[]
 with open('/tmp/wine-ops-light-pool-mutex','a') as mutex:
  fcntl.flock(mutex,fcntl.LOCK_EX)
  for n in range(2):
   f=open('/tmp/wine-ops-light-pool-slot-'+str(n),'a')
   try:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);held.append(f)
   except BlockingIOError:f.close()
   if len(held)==a.slots:break
  if len(held)!=a.slots:
   for f in held:f.close()
   held=[]
 if held:break
 if time.monotonic()>=end:raise SystemExit('execution pool wait deadline; retain checkpoint')
 time.sleep(2)
try:
 r=subprocess.run(cmd,check=False)
 raise SystemExit(r.returncode)
finally:
 for f in held:f.close()
