import resource,os,sys,json,pathlib
soft,hard=resource.getrlimit(resource.RLIMIT_DATA)
value=512*1048576
resource.setrlimit(resource.RLIMIT_DATA,(min(soft,value) if soft!=-1 else value,min(hard,value) if hard!=-1 else value))
pathlib.Path(os.environ['RICOCHET_GIT_LIMIT_RECEIPT']).write_text(json.dumps({n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']}))
os.execvp('git',['git',*sys.argv[1:]])
