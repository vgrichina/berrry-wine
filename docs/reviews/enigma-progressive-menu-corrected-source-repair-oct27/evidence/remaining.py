import os,sys,unittest,json,hashlib,pathlib
base=pathlib.Path('/tmp/enigma-progressive-menu-corrected-source-repair-oct27')
os.environ['ENIGMA_SUPERVISED_EVIDENCE']=str(base/'ops/remaining-evidence')
sys.path.insert(0,str(base/'repo/test/fixtures/enigma-controller'))
names=['test_supervised.SupervisedTests.'+n for n in ['test_live_original_competitors_and_changed_outputs_cannot_attach','test_original_supervisor_process_cannot_launch_replacement','test_positive_real_entry_ack_zero_and_reviewed_input','test_send_boundary_death_terminal_and_identity_change']]
names+=['test_progressive.ProgressEntryTests.'+n for n in ['test_loading_to_menu_production_boundary','test_never_ready_quits_with_after_capture_reserved','test_later_pending_step_stops_original_owner_no_replay']]
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromNames(names))
files=list((base/'repo/tools').glob('enigma*.py'))+list((base/'repo/test/fixtures/enigma-controller').glob('*.py'))+[base/'repo/test/run.js']
v=dict(passed=r.wasSuccessful(),tests=r.testsRun,pins={str(p.relative_to(base/'repo')):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},guestInvocations=0,reusedCompleted='regressions.stderr explicit ok lines and verify-progress passing methods; original incidents retained',remaining=['review','publication'])
(base/'ops/remaining-checkpoint.json').write_text(json.dumps(v,indent=2)+'\n')
raise SystemExit(not r.wasSuccessful())
