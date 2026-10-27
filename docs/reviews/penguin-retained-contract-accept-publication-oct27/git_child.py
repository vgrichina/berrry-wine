import os,resource,sys
resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_OPTIONAL_LOCKS']='0'
os.execvp('git',['git','-C','/tmp/penguin-retained-contract-accept-publication-oct27/repo',*sys.argv[1:]])
