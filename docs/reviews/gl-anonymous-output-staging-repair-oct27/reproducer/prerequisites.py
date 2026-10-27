import importlib.util,os,pathlib,json,stat
P=pathlib.Path;H=P(__file__).resolve().parent.parent;R=H/'repo'
s=importlib.util.spec_from_file_location('confinement',R/'test/test-gl-output-file-confinement.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=H/'ops/prerequisite-root';(p/'ops/output').mkdir(parents=True,exist_ok=True);f=m.helper(m.RUNNER)(p)
with f.directory() as d:
 with f.anonymous(d) as fd:
  st=os.fstat(fd);assert st.st_nlink==0 and st.st_uid==os.geteuid() and stat.S_IMODE(st.st_mode)&0o077==0
  a=dict(effectiveUID=os.geteuid(),ownerUID=st.st_uid,mode=oct(stat.S_IMODE(st.st_mode)),linksBeforeWrite=st.st_nlink,device=st.st_dev,procDescriptorTarget=os.readlink('/proc/self/fd/'+str(fd)),capEffective=next(s for s in P('/proc/self/status').read_text().splitlines() if s.startswith('CapEff:')),O_TMPFILE=os.O_TMPFILE,dirFdLink=os.link in os.supports_dir_fd,followSymlinksLink=os.link in os.supports_follow_symlinks)
  os.write(fd,b'prerequisite');f.publish(d,'probe',fd)
assert f.read('probe')==b'prerequisite';(p/'ops/output/probe').unlink();(p/'ops/output').rmdir();(p/'ops').rmdir();p.rmdir()
(H/'ops/linux-prerequisites.json').write_text(json.dumps(a,indent=2));print(json.dumps(a))
