import fcntl,os,resource,subprocess,sys
with open('/tmp/wine-ops-production-git.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 def limit():resource.setrlimit(resource.RLIMIT_DATA,(512*1048576,512*1048576))
 sys.exit(subprocess.call(['git',*sys.argv[1:]],preexec_fn=limit))
