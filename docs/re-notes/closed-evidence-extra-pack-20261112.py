"""Losslessly pack an explicitly reviewed [size, path] list of closed state gzip files.

Run from the repository root. Only the explicit reviewed historical path allowlist is accepted.
Replacements and their index are fsynced and read back before any unlink.
"""
from pathlib import Path
import argparse, collections, gzip, hashlib, json, lzma, os, sys, tempfile, zlib

if not __debug__:
    raise RuntimeError('Refusing to run with assertion checks disabled')

sha = lambda data: hashlib.sha256(data).hexdigest()
JOURNALS = {'scratch/runs/20261107-aranna-atomic-observation/controls/results.json.gz',
 'scratch/runs/20261107-aranna-hover-journal/controls-draw-churn/results.json.gz',
 'scratch/runs/20261107-aranna-hover-journal/controls/results.json.gz',
 'scratch/runs/20261107-aranna-lock-transition/controls/results.json.gz',
 'scratch/runs/20261107-aranna-map-load/controls/results.json.gz',
 'scratch/runs/20261107-aranna-native-point/controls/results.json.gz',
 'scratch/runs/20261107-aranna-relative-map-load/controls/results.json.gz',
 'scratch/runs/20261107-aranna-transport-window/controls/results.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-attack2.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-continue.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-corridor-return.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-final.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-intro.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-late-guard.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-load-progress.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-loading.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-loading2.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-post-attack.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-startup.json.gz',
 'scratch/runs/20261107-avp2-allocation-cause/remote-evidence/remote-webgl/allocation-world-check.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-cooperative/geometry-120.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-cooperative/geometry-30.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-cooperative/geometry-60.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-cooperative/geometry-final.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-worker/geometry-120.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-worker/geometry-30.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-worker/geometry-60.json.gz',
 'scratch/runs/20261107-boids-visible-flock/recovered/case-worker/geometry-final.json.gz',
 'scratch/runs/20261107-lords2-complete-staging/after-copy-live.json.gz',
 'scratch/runs/20261107-lords2-install-memory/after-continue.json.gz',
 'scratch/runs/20261107-lords2-repaired-cmos-install/after-cdrom-live.json.gz',
 'scratch/runs/20261107-lords2-tempdrive/after-continue.json.gz',
 'scratch/runs/20261107-lords2-tempdrive/after-destination.json.gz',
 'scratch/runs/20261107-lords2-win16-redraw/after-copy-live.json.gz',
 'scratch/runs/20261107-mcm-trace-recovery/sample/production-trace.json.gz',
 'scratch/runs/20261107-q3-repaired-torch-world/retrieved/original/target-torch-before-frame.json.gz',
 'scratch/runs/20261107-q3-repaired-torch-world/retrieved/original/world03-frame.json.gz',
 'scratch/runs/20261107-q3-torch-rendering/retrieved/original/world01-frame.json.gz',
 'scratch/runs/20261108-darkstone-bat-continuation-1910/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-container-room-1810/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-green-route-1717/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-helmet-1621/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-hollow-onward/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-manifest-onward/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-mayor-onward/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-nine-onward/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-outer-road/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-road-onward/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-road-save/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-rozanne-route/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-darkstone-wider-floor-1844/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-recoil-admitted-native/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/custody-history.jsonl.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-10.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-11.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-12.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-13.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-14.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-15.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-16.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-17.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-18.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-19.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-2.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-20.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-21.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-22.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-23.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-24.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-25.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-26.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-27.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-28.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-29.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-3.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-30.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-31.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-32.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-33.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-34.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-35.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-36.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-37.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-38.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-39.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-40.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-41.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-42.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-43.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-44.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-45.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-46.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-47.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-48.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-49.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-5.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-50.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-51.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-52.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-53.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-54.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-55.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-56.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-59.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-6.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-7.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-8.json.gz',
 'scratch/runs/20261108-recoil-original-1702/retrieved-firstfailure/original/source-response-9.json.gz',
 'scratch/runs/20261108-recoil-pixel-latency-repair/attempt1-native-results.json.gz',
 'scratch/runs/20261108-recoil-pixel-latency-repair/attempt2-native-results.json.gz',
 'scratch/runs/20261108-recoil-pixel-latency-repair/native-results.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-c/probe-2/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-c/probe-2/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-c/probe-4/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-c/probe-4/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-d/probe-2/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-d/probe-2/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-d/probe-4/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/local-d/probe-4/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/retrieved/remote-a/probe-2/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/retrieved/remote-a/probe-4/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/retrieved/remote-b/probe-2/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-probe-journal-1753/retrieved/remote-b/probe-4/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-software-native/recovered/custody-history.jsonl.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-12.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-15.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-16.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-19.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-2.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-22.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-23.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-26.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-5.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-8.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/fixture-g/source-response-9.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-11.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-14.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-15.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-18.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-21.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-7.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-a/source-response-8.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-b/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-b/source-response-11.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-b/source-response-14.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-b/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-b/source-response-7.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-b/source-response-8.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-11.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-14.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-15.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-18.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-21.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-22.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-25.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-28.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-7.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-c/source-response-8.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-1.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-11.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-14.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-15.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-18.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-21.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-22.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-25.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-28.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-4.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-7.json.gz',
 'scratch/runs/20261108-recoil-source-transport-1728/retrieved/remote-d/source-response-8.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-down-one-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-down-one-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-down-two-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-down-two-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-settings-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-settings-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-training-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-training-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-wait-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/menu-wait-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/passive-work-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/passive-work-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/play-trace-8163D20B17BADDBB28542A4A6FF729DD.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/play-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/play-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/terminal-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/terminal-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/training-open-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/training-open-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/vehicle-select-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/vehicle-select-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/vehicle-start-trace-85C23A5BBE8DE9117339D28CD318B63E.json.gz',
 'scratch/runs/20261108-redline-batch-continuation-cause/retrieved/original/vehicle-start-trace-E83D36B2AED543D09C3BF031A1A7C2E9.json.gz',
 'scratch/runs/20261108-redline-car-door-native/retrieved/original/menu-down-one-trace-1D05FF577E394200DB5A8BD9AD06DA61.json.gz',
 'scratch/runs/20261108-redline-car-door-native/retrieved/original/menu-down-two-trace-1D05FF577E394200DB5A8BD9AD06DA61.json.gz',
 'scratch/runs/20261108-redline-car-door-native/retrieved/original/menu-settings-trace-1D05FF577E394200DB5A8BD9AD06DA61.json.gz',
 'scratch/runs/20261108-redline-car-door-native/retrieved/original/menu-training-trace-1D05FF577E394200DB5A8BD9AD06DA61.json.gz',
 'scratch/runs/20261108-redline-car-door-native/retrieved/original/training-open-trace-1D05FF577E394200DB5A8BD9AD06DA61.json.gz',
 'scratch/runs/20261108-redline-car-door-native/retrieved/original/vehicle-select-trace-1D05FF577E394200DB5A8BD9AD06DA61.json.gz',
 'scratch/runs/20261108-redline-car-door-native/retrieved/original/vehicle-start-trace-1D05FF577E394200DB5A8BD9AD06DA61.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-down-one-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-down-one-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-down-two-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-down-two-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-settings-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-settings-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-training-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-training-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-wait-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/menu-wait-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/passive-work-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/passive-work-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/play-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/play-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/play-trace-444A3C75032240CF0298B69696ECB50F.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/terminal-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/terminal-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/training-open-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/training-open-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/vehicle-select-trace-319E4C6EABB71F15626239BE9B63E40D.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/vehicle-select-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-clear-executor-cause/retrieved/original/vehicle-start-trace-43756F75E5B349D7DF670CD61BFAC940.json.gz',
 'scratch/runs/20261108-redline-left-consumption/retrieved/original/menu-back-trace-376E2E638748F95AA533B07E8A5ADD48.json.gz',
 'scratch/runs/20261108-redline-left-consumption/retrieved/original/menu-settings-trace-376E2E638748F95AA533B07E8A5ADD48.json.gz',
 'scratch/runs/20261108-redline-left-consumption/retrieved/original/menu-training-trace-376E2E638748F95AA533B07E8A5ADD48.json.gz',
 'scratch/runs/20261108-redline-left-consumption/retrieved/original/training-open-trace-376E2E638748F95AA533B07E8A5ADD48.json.gz',
 'scratch/runs/20261108-redline-left-consumption/retrieved/original/vehicle-select-trace-376E2E638748F95AA533B07E8A5ADD48.json.gz',
 'scratch/runs/20261108-redline-left-consumption/retrieved/original/vehicle-start-trace-376E2E638748F95AA533B07E8A5ADD48.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/align-door-side-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/align-right-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/approach-car-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/approach-side-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/around-rear-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/clear-corner-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/clear-rear-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/face-car-flank-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/face-car-right-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/face-side-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/final-route-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/flank-advance-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/side-settle-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/side-turn-settle-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/terminal-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/toward-known-flank-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/vehicle-start-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-native-vehicle/retrieved/original/walk-right-flank-trace-DEDEE907792555B2A482B86FFFA96692.json.gz',
 'scratch/runs/20261108-redline-observed-poll-turn/retrieved/original/menu-down-one-trace-048EF0F4C4ED7FFD2A8F0D2375056214.json.gz',
 'scratch/runs/20261108-redline-observed-poll-turn/retrieved/original/menu-down-two-trace-048EF0F4C4ED7FFD2A8F0D2375056214.json.gz',
 'scratch/runs/20261108-redline-observed-poll-turn/retrieved/original/menu-settings-trace-048EF0F4C4ED7FFD2A8F0D2375056214.json.gz',
 'scratch/runs/20261108-redline-observed-poll-turn/retrieved/original/menu-training-trace-048EF0F4C4ED7FFD2A8F0D2375056214.json.gz',
 'scratch/runs/20261108-redline-observed-poll-turn/retrieved/original/training-open-trace-048EF0F4C4ED7FFD2A8F0D2375056214.json.gz',
 'scratch/runs/20261108-redline-observed-poll-turn/retrieved/original/vehicle-select-trace-048EF0F4C4ED7FFD2A8F0D2375056214.json.gz',
 'scratch/runs/20261108-redline-observed-poll-turn/retrieved/original/vehicle-start-trace-048EF0F4C4ED7FFD2A8F0D2375056214.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/fire-control-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/fire-control-trace-61BF0570923A94FF6218C2B57F60DC5E.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/fire-settled-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/fire-settled-trace-61BF0570923A94FF6218C2B57F60DC5E.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/firstperson-wait-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/firstperson-wait-trace-61BF0570923A94FF6218C2B57F60DC5E.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/intro-end-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/intro-final-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/intro-next-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/intro-settle-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/stadium-city-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/terminal-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/terminal-trace-61BF0570923A94FF6218C2B57F60DC5E.json.gz',
 'scratch/runs/20261108-redline-ready-firstperson-action/retrieved/original/world-ready-trace-2770350503ECEB6633F5F41085E28732.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/menu-down-one-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/menu-down-two-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/menu-settings-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/menu-training-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/menu-wait-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/passive-work-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/play-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/terminal-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/training-open-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/vehicle-select-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-slice-work-cause/retrieved/original/vehicle-start-trace-E57FB2FD2203417C0D151DC43DB99DBA.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/before-repair-scene-trace-5FB137C261B2D42ADEBB9438893F459A.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-action-settled-trace-767F81FCD213689D4EB0E9707A331304.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-action-settled-trace-FBE8103B9F6D82A989AF3B82ECCAC428.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-action-trace-767F81FCD213689D4EB0E9707A331304.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-action-trace-FBE8103B9F6D82A989AF3B82ECCAC428.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-world-hud-trace-767F81FCD213689D4EB0E9707A331304.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-world-hud-trace-FBE8103B9F6D82A989AF3B82ECCAC428.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-world-trace-767F81FCD213689D4EB0E9707A331304.json.gz',
 'scratch/runs/20261108-redline-texture-realization/retrieved/original/repaired-world-trace-FBE8103B9F6D82A989AF3B82ECCAC428.json.gz',
 'scratch/runs/20261108-redline-texture-realization/traces/before-repair-scene-trace-5FB137C261B2D42ADEBB9438893F459A.json.gz',
 'scratch/runs/20261108-redline-texture-realization/traces/repaired-action-trace-767F81FCD213689D4EB0E9707A331304.json.gz',
 'scratch/runs/20261108-redline-texture-realization/traces/repaired-action-trace-FBE8103B9F6D82A989AF3B82ECCAC428.json.gz',
 'scratch/runs/20261108-redline-texture-realization/traces/repaired-world-trace-767F81FCD213689D4EB0E9707A331304.json.gz',
 'scratch/runs/20261108-redline-texture-realization/traces/repaired-world-trace-FBE8103B9F6D82A989AF3B82ECCAC428.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/assess-end-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/forward-1-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/forward-2-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/forward-3-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/forward-4-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/forward-5-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/forward-6-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/fresh-3-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/fresh-right-2-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/fresh-turn-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/jump-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/jump-once-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/opening-current-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/right-2b-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/right-3b-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/right-4-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/right-5-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/right-6-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/retrieved/webgl/right-fresh-1-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/review/webgl/fresh-right-2-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/review/webgl/fresh-turn-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/review/webgl/right-2b-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward-1544/review/webgl/right-fresh-1-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/five-current-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/seven-after-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/six-after-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/six-current-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/slope-assess-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/slope-four-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/retrieved/webgl/slope-three-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/review/webgl/five-current-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/review/webgl/seven-after-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/review/webgl/six-after-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/review/webgl/six-current-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/review/webgl/slope-assess-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/review/webgl/slope-four-publication.json.gz',
 'scratch/runs/20261108-tr2-alley-onward/review/webgl/slope-three-publication.json.gz',
 'scratch/runs/20261108-tr2-clear-integration-progress/fast-webgl-qualified-before-input-remote-result.json.gz',
 'scratch/runs/20261108-tr2-directx-layer-coverage/fast-webgl-qualified-before-input-remote-result.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-1-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-3-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-4-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-5-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-6-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-7-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-8-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/advance-9-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/align-left-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/align-settle-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/combat-assess-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-check-turn-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-current-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-face-left-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-fire-1-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-fire-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-fire-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-right-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/dog-right-3-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/draw-assess-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/draw-fresh-view-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/draw-settle-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/draw-view-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-check-1-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-check-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-left-1-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-left-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-left-3-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-right-3-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/rear-settle-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/return-left-1-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/return-left-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/right-2-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/right-3-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/right-4-publication.json.gz',
 'scratch/runs/20261108-tr2-dog-encounter-1610/retrieved/webgl/weapon-settled-publication.json.gz',
 'scratch/runs/20261108-tr2-full-facade-native/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-full-facade-native/retrieved/webgl/final-no-qualified-publication.json.gz',
 'scratch/runs/20261108-tr2-full-facade-native/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/final-turned-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/jump-current-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/jump-landed-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/jump-settled-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/slope-1-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/turn-current-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/turn-now-2-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/turn-now-3-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/turned-left-2-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/turned-left-3-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/turned-left-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/retrieved/webgl/turned-settled-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/final-turned-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/jump-current-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/jump-landed-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/jump-settled-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/slope-1-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/turn-current-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/turn-now-2-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/turn-now-3-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/turned-left-2-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/turned-left-3-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/turned-left-publication.json.gz',
 'scratch/runs/20261108-tr2-jump-staged/review/webgl/turned-settled-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/advance-five-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/advance-four-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/advance-one-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/advance-six-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/advance-three-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/advance-two-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/align-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/aligned-left-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/aligned-left-three-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/aligned-left-two-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/alignment-inspect-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/draw-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/draw-native-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/draw-pose-review-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/draw-ready-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/draw-settle-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/right-five-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/right-four-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/right-one-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/right-six-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/right-three-publication.json.gz',
 'scratch/runs/20261108-tr2-observed-control-1717/retrieved/webgl/right-two-publication.json.gz',
 'scratch/runs/20261108-tr2-pending-source-native-progress/fast-webgl-qualified-before-input-remote-result.json.gz',
 'scratch/runs/20261108-tr2-postfence-native-joins/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-predecode-native/retrieved/webgl/final-no-qualified-publication.json.gz',
 'scratch/runs/20261108-tr2-predecode-native/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-predecode-native/review/webgl/final-no-qualified-publication.json.gz',
 'scratch/runs/20261108-tr2-qualified-native-progress/fast-webgl-qualified-before-input-remote-result.json.gz',
 'scratch/runs/20261108-tr2-retained-native/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-retained-native/retrieved/webgl/after-forward-publication.json.gz',
 'scratch/runs/20261108-tr2-retained-native/retrieved/webgl/before-forward-publication.json.gz',
 'scratch/runs/20261108-tr2-retained-native/retrieved/webgl/continued-display-publication.json.gz',
 'scratch/runs/20261108-tr2-retained-native/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-retained-native/retrieved/webgl/settled-after-forward-publication.json.gz',
 'scratch/runs/20261108-tr2-retained-native/review/webgl/after-forward-publication.json.gz',
 'scratch/runs/20261108-tr2-retained-native/review/webgl/before-forward-publication.json.gz',
 'scratch/runs/20261108-tr2-retained-native/review/webgl/continued-display-publication.json.gz',
 'scratch/runs/20261108-tr2-retained-native/review/webgl/settled-after-forward-publication.json.gz',
 'scratch/runs/20261108-tr2-route-ready/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/advance-fresh-one-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/advance-path-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/advance-path-three-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/advance-path-two-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/advance-ready-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/after-observed-control-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/align-four-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/align-left-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/align-right-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/align-right-two-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/alignment-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/alignment-settled-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/alley-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/approach-one-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/heading-ready-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/left-final-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/left-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/left-ready-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/navigation-fresh-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/path-ready-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/turn-one-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/turn-three-publication.json.gz',
 'scratch/runs/20261108-tr2-startup-control-1810/retrieved/webgl/turn-two-publication.json.gz',
 'scratch/runs/20261108-tr2-writer-boundary-native/retrieved/custody-history.jsonl.gz',
 'scratch/runs/20261108-tr2-writer-boundary-native/retrieved/webgl/final-no-qualified-publication.json.gz',
 'scratch/runs/20261108-tr2-writer-boundary-native/retrieved/webgl/publication-final.json.gz',
 'scratch/runs/20261108-tr2-writer-boundary-native/review/webgl/final-no-qualified-publication.json.gz',
 'scratch/runs/20261109-q3-corrected-controls-native-1130/publication-final-seal.json.gz',
 'scratch/runs/20261109-redline-bounded-startup-gameplay-0955/retrieved/original/back-menu-trace-53A270D3FD22F1B8B48023DC1518242C.json.gz',
 'scratch/runs/20261109-redline-bounded-startup-gameplay-0955/retrieved/original/menu-down-trace-53A270D3FD22F1B8B48023DC1518242C.json.gz',
 'scratch/runs/20261109-redline-bounded-startup-gameplay-0955/retrieved/original/newgame-result-trace-53A270D3FD22F1B8B48023DC1518242C.json.gz',
 'scratch/runs/20261109-redline-bounded-startup-gameplay-0955/retrieved/original/startup-menu-trace-53A270D3FD22F1B8B48023DC1518242C.json.gz',
 'scratch/runs/20261109-redline-bounded-startup-gameplay-0955/retrieved/original/training-menu-trace-53A270D3FD22F1B8B48023DC1518242C.json.gz',
 'scratch/runs/20261109-redline-command-trace-deadline-repair-2230/retrieved/native-fixture/native-startup-trace.json.gz',
 'scratch/runs/20261109-redline-command-trace-deadline-repair-2230/retrieved/original/intro-passive-trace-A97F7F2B568B1B4046603EC4DAF84295.json.gz',
 'scratch/runs/20261109-redline-command-trace-deadline-repair-2230/retrieved/original/intro-street-trace-A97F7F2B568B1B4046603EC4DAF84295.json.gz',
 'scratch/runs/20261109-redline-command-trace-deadline-repair-2230/retrieved/original/native-startup-trace.json.gz',
 'scratch/runs/20261109-redline-command-trace-deadline-repair-2230/retrieved/original/stadium-trace-A97F7F2B568B1B4046603EC4DAF84295.json.gz',
 'scratch/runs/20261109-redline-current-lock-menu-route-2210/retrieved/native-fixture/native-startup-trace.json.gz',
 'scratch/runs/20261109-redline-current-lock-menu-route-2210/retrieved/original/intro-wait-trace-0627546DD0DF051862613534721ED7B4.json.gz',
 'scratch/runs/20261109-redline-current-lock-menu-route-2210/retrieved/original/native-startup-trace.json.gz',
 'scratch/runs/20261109-redline-current-lock-menu-route-2210/retrieved/original/skip-intro-trace-0627546DD0DF051862613534721ED7B4.json.gz',
 'scratch/runs/20261109-redline-current-lock-menu-route-2210/retrieved/original/stadium-trace-0627546DD0DF051862613534721ED7B4.json.gz',
 'scratch/runs/20261109-redline-current-lock-menu-route-2210/retrieved/original/training-trace-0627546DD0DF051862613534721ED7B4.json.gz',
 'scratch/runs/20261109-redline-final-startup-service-repair-2145/retrieved/native-fixture/native-startup-trace.json.gz',
 'scratch/runs/20261109-redline-final-startup-service-repair-2145/retrieved/original/native-startup-trace.json.gz',
 'scratch/runs/20261109-redline-final-startup-service-repair-2145/retrieved/original/training-trace-64C76C13BF9A1A9C580114B5B6E067AD.json.gz',
 'scratch/runs/20261109-redline-unlocked-training-native-1120/retrieved/original/training-selection-trace-4917B68CEAC3582316DE1F693854E283.json.gz'}


def syncdir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_new(path, data):
    with path.open('xb') as target:
        target.write(data)
        target.flush()
        os.fsync(target.fileno())


def stream_row(path, wire, stat, offset, compressor, stage, header_size):
    """Stream closed journals, sampling at most 4 MiB to recognize the codec."""
    with gzip.open(path, 'rb') as sample_source:
        sample = sample_source.read(4194304)
    payload = wire[header_size:-8]
    levels = []
    for candidate in (1, 9, 6, 3, 2, 4, 5, 7, 8):
        trial = zlib.compressobj(candidate, zlib.DEFLATED, -15)
        prefix = trial.compress(sample)
        if prefix and payload.startswith(prefix):
            levels.append(candidate)
    if not levels:
        # Some highly repetitive streams emit no complete deflate block in the
        # sample. Compare full streaming hashes instead of guessing a level.
        for candidate in (1, 9, 6, 3, 2, 4, 5, 7, 8):
            trial = zlib.compressobj(candidate, zlib.DEFLATED, -15)
            digest = hashlib.sha256(wire[:header_size])
            with gzip.open(path, 'rb') as source:
                while chunk := source.read(1048576):
                    digest.update(trial.compress(chunk))
            digest.update(trial.flush())
            digest.update(wire[-8:])
            if digest.hexdigest() == sha(wire):
                levels.append(candidate)
                break
    assert levels, 'No matching gzip codec; retain original'
    level = levels[0]
    codec = zlib.compressobj(level, zlib.DEFLATED, -15)
    digest = hashlib.sha256(wire[:header_size])
    raw_digest = hashlib.sha256()
    size = 0
    with gzip.open(path, 'rb') as source:
        while chunk := source.read(1048576):
            raw_digest.update(chunk)
            size += len(chunk)
            digest.update(codec.compress(chunk))
            stage.write(compressor.compress(chunk))
    digest.update(codec.flush())
    digest.update(wire[-8:])
    if digest.hexdigest() != sha(wire):
        # Levels can share a sample prefix yet diverge later. The XZ stage
        # already contains the correct raw bytes; select a fully proven codec.
        matched = False
        for candidate in (1, 9, 6, 3, 2, 4, 5, 7, 8):
            trial = zlib.compressobj(candidate, zlib.DEFLATED, -15)
            full = hashlib.sha256(wire[:header_size])
            with gzip.open(path, 'rb') as source:
                while chunk := source.read(1048576):
                    full.update(trial.compress(chunk))
            full.update(trial.flush())
            full.update(wire[-8:])
            if full.hexdigest() == sha(wire):
                level, matched = candidate, True
                break
        assert matched, 'Stream codec mismatch; retain original'
    return dict(original=dict(path=str(path), size=len(wire), sha256=sha(wire),
                mode=stat.st_mode & 0o7777, mtimeNs=stat.st_mtime_ns, atimeNs=stat.st_atime_ns,
                uid=stat.st_uid, gid=stat.st_gid, ino=stat.st_ino, ctimeNs=stat.st_ctime_ns),
                rawOffset=offset, rawSize=size, rawSHA256=raw_digest.hexdigest(),
                gzipLevel=level, gzipHeaderHex=wire[:header_size].hex(),
                gzipTrailerHex=wire[-8:].hex())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan')
    parser.add_argument('evidence')
    args = parser.parse_args()
    evidence = Path(args.evidence)
    groups = collections.defaultdict(list)
    for size, name in json.loads(Path(args.plan).read_text()):
        path = Path(name)
        assert str(path) in JOURNALS, 'Path outside reviewed closed observations'
        assert not path.is_symlink()
        groups[path.parent].append((size, path))
    for run, files in groups.items():
        for start in range(0, len(files), 12):
            batch = files[start:start + 12]
            stem = 'closed-1455-' + sha(str(batch).encode())[:12]
            pack = evidence / (run.name + '-' + stem + '.raw.xz')
            index = pack.with_suffix('.json')
            rows = []
            offset = 0
            # Only compressed output occupies tmpfs; raw observations stream one at a time.
            with tempfile.TemporaryFile(dir='/dev/shm') as stage:
                compressor = lzma.LZMACompressor(filters=[dict(
                    id=lzma.FILTER_LZMA2, preset=3, dict_size=67108864)])
                for expected_size, path in batch:
                    stat = path.stat()
                    wire = path.read_bytes()
                    assert len(wire) == expected_size
                    assert wire[:3] == b'\x1f\x8b\x08' and wire[3] in (0, 8)
                    header_size = wire.index(b'\0', 10) + 1 if wire[3] == 8 else 10
                    row = stream_row(path, wire, stat, offset, compressor, stage, header_size)
                    rows.append(row)
                    offset += row['rawSize']
                stage.write(compressor.flush())
                stage.seek(0)
                payload = stage.read()
            meta = dict(rawPack=pack.name, rawPackSHA256=sha(payload), packedBytes=len(payload),
                        rawBytes=offset, rows=rows, gzipMtime=0, gzipLevel=9,
                        python=sys.version, zlib=zlib.ZLIB_VERSION, zlibRuntime=zlib.ZLIB_RUNTIME_VERSION,
                        xzFilters='LZMA2 preset=3 dict_size=67108864',
                        originalGzipReconstructionVerified=True,
                        recoveryHelper="docs/re-notes/closed-evidence-state-recover-20261112.py")
            if len(payload) + len(json.dumps(meta, indent=2)) >= sum(r['original']['size'] for r in rows):
                print(json.dumps(dict(skipped='No net space saving', paths=[str(p) for _, p in batch])), flush=True)
                continue
            write_new(pack, payload)
            write_new(index, (json.dumps(meta, indent=2) + '\n').encode())
            syncdir(evidence)
            assert sha(pack.read_bytes()) == meta['rawPackSHA256']
            assert json.loads(index.read_text()) == meta
            with lzma.open(pack, 'rb') as source:
                for row in rows:
                    assert source.tell() == row['rawOffset']
                    codec = zlib.compressobj(row['gzipLevel'], zlib.DEFLATED, -15)
                    digest = hashlib.sha256(bytes.fromhex(row['gzipHeaderHex']))
                    raw_digest = hashlib.sha256()
                    remaining = row['rawSize']
                    while remaining:
                        chunk = source.read(min(1048576, remaining))
                        assert chunk
                        remaining -= len(chunk)
                        raw_digest.update(chunk)
                        digest.update(codec.compress(chunk))
                    digest.update(codec.flush())
                    digest.update(bytes.fromhex(row['gzipTrailerHex']))
                    assert raw_digest.hexdigest() == row['rawSHA256']
                    assert digest.hexdigest() == row['original']['sha256']
                    assert sha(Path(row['original']['path']).read_bytes()) == digest.hexdigest()
                assert not source.read(1)
            for row in rows:
                path = Path(row['original']['path'])
                assert sha(path.read_bytes()) == row['original']['sha256']
                path.unlink()
            syncdir(run)
            print(json.dumps(dict(index=str(index), rows=len(rows),
                                  originalBytes=sum(r['original']['size'] for r in rows),
                                  packedBytes=len(payload), freeBytes=os.statvfs('/home').f_bavail *
                                  os.statvfs('/home').f_frsize)), flush=True)


if __name__ == '__main__':
    main()
