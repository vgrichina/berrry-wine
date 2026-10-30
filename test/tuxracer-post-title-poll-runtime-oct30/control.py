import pathlib,importlib.util,sys
P=pathlib.Path('/tmp/tuxracer-main-menu-race-progression-oct30/input-consumption/control.py')
s=importlib.util.spec_from_file_location('retained_control',P);c=importlib.util.module_from_spec(s);s.loader.exec_module(c);c=sys.modules['retained_control']
c.O=pathlib.Path(__file__).parent
c.ROOTS.append(c.ROOT/'scratch/usage-watch/tuxracer-post-title-poll-runtime-oct30')
sys.modules[__name__]=c
