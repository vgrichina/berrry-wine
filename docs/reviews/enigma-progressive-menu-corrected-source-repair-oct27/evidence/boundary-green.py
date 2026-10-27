import os,sys,unittest
os.environ['ENIGMA_SUPERVISED_EVIDENCE']='/tmp/enigma-progressive-menu-corrected-source-repair-oct27/ops/boundary-green-evidence'
sys.path.insert(0,'/tmp/enigma-progressive-menu-corrected-source-repair-oct27/repo/test/fixtures/enigma-controller')
r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromName('test_progressive.ProgressEntryTests.test_loading_to_menu_production_boundary'))
raise SystemExit(not r.wasSuccessful())
