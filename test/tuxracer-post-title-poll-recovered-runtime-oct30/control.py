import pathlib,sys,importlib.util
P=pathlib.Path('/tmp/tuxracer-main-menu-race-progression-oct30/post-title-poll-runtime/control.py')
s=importlib.util.spec_from_file_location('prev',P);c=importlib.util.module_from_spec(s);s.loader.exec_module(c);c=sys.modules['prev'];c.O=pathlib.Path(__file__).parent
c.ROOTS.append(c.ROOT/'scratch/usage-watch/tuxracer-post-title-poll-recovered-runtime-oct30')
sys.modules[__name__]=c
