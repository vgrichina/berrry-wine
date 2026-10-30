"""Immutable current owner policy adapter; capture and process limits retained."""
import pathlib,hashlib,importlib.util,sys
P=pathlib.Path('/tmp/tuxracer-vertex-color-gameplay-owner-policy-oct30/control-v2.py')
assert hashlib.sha256(P.read_bytes()).hexdigest()=='f5e2cf0889237a5e371009e43be9251ac3e4294135b97e1f72b543eedbbb3d69'
s=importlib.util.spec_from_file_location('progression_control',P);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
c.O=pathlib.Path(__file__).parent
c.LAUNCH=c.ROOT/'scratch/usage-watch/tuxracer-main-menu-race-progression-oct30'
c.ROOTS=[c.R,c.OLD,pathlib.Path('/tmp/tuxracer-glcolor4dv-canonical-enter-runtime-oct30'),P.parent,pathlib.Path('/tmp/tuxracer-vertex-color-isolated-capture-runtime-oct30'),pathlib.Path('/tmp/tuxracer-retained-vertex-runtime-integration-oct30'),c.O,c.LAUNCH,*[c.ROOT/('scratch/usage-watch/'+n) for n in ['tuxracer-retained-vertex-runtime-integration-oct30','tuxracer-vertex-color-gameplay-owner-policy-oct30','tuxracer-vertex-color-isolated-capture-runtime-oct30','tuxracer-accepted-vertex-color-reconciliation-oct30']]]
sys.modules[__name__]=c
