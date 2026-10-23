#!/usr/bin/env python3
"""Reuse reviewed capture/reaping function, never enter donor recipe main."""
import importlib.util, pathlib, sys
sys.dont_write_bytecode = True
H = pathlib.Path(__file__).resolve().parent
s = importlib.util.spec_from_file_location('driver', H/'recipe.py')
d = importlib.util.module_from_spec(s); s.loader.exec_module(d)
d.H = H; d.d.H = H
focused = d.bounded([sys.executable, str(H/'test-static-abi.py')], 'focused-tests', cpu=60, wall=60)
assert focused == 0, focused
rejecting = d.bounded([sys.executable, str(H/'reject-invalid-stride.py')], 'independent-rejecting-test', cpu=60, wall=60)
assert rejecting == 1, rejecting
print('Focused tests exit 0; independent rejecting regression exit 1: concrete acceptance gap. STOP.')
