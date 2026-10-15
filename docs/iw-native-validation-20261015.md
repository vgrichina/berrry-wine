# Exact candidate native validation

Candidate `17e713cd2ceab10b9b31e4d6d6448b120c3fd43f` cannot reuse the historical
canonical module `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
An actual-file audit on bx_9ef2wdsw verified 212 native/compiler/build paths
against donor `750bc13fd07a59dfed1e49b19533a561ffea1208`; the candidate changes
`src/09a5-handlers-window.wat` by adding the foreign-process synchronous
SendMessage yield-10 path. Both donor module copies are physical 1,803,537-byte
files with the historical SHA. The audit JSON retains this distinction.

After the root's explicit sole-lane grant and independent Jedi postflight /
process inventory verification, prepare a fresh shared clone from
`/home/user/cmr3-software-lines` at `/home/user/wa-iw-native-validation` on that
box, fetch the exact candidate SHA from origin, and detach at that SHA. Link
the donor's node_modules; do not copy or link its build directory. Copy this
controller separately to `/home/user/iw-native-validation.py`. No source edits
or donor module writes are permitted.

Run through the documented Boat exec API, detached:

```
/home/user/.ascii/boat exec bx_9ef2wdsw --detach -- python3 /home/user/iw-native-validation.py --root /home/user/wa-iw-native-validation --out /home/user/iw-native-validation-evidence --grant root-after-Jedi132450-release-20261015T1344Z
```

The controller runs all `tools/build.sh` gates with a 600-second bound; requires
a new physical module inside the fresh build directory; and records its SHA,
size, exact source hashes, engine version, stage exit statuses and logs. First
native test is `WA_TEST_WASM=<new canonical> node test/test-scoped-dll-native.js`
with 90 seconds and one 512 MiB shared memory. Same-module and concurrent-map
tests consume the same physical build path; lifecycle races, Worker message,
import graph and terminal tests receive WA_TEST_WASM. Each suite is serial.
Process-send runtime deliberately recompiles source with a test-only export
and uses two independent 512 MiB memories; this extra compile is explicitly
authorized by the root for this slot and is never represented as canonical.

The 1,200-second overall admission budget reserves each stage's full bound
before starting it. Build is 600 seconds, scoped/readiness/mapping/races/Worker/
imports are each 90, terminal and process-send each 180. Actual early completion
can admit all stages; exhausted budget leaves later stages untested. First
failure stops the suite. Inherited process markers detect and remove stage
descendants, including separately detached children; any needed cleanup fails
the stage. Full tracked source snapshots and postflight survivors are retained.
Canonical module SHA is checked after every native suite. Do not infer scoped
two-owner race coverage or original Invisible War compatibility from these
ordinary-loader tests.

Source checks passed: Python syntax, real inherited-marker process discovery
and cleanup, source-byte mutation detection and exact restoration. No Wasm or
guest execution was involved in those controller checks. Local sparse checkout
keeps available disk above 2 GiB. Remote has 41 GiB free; the existing expiration
14:21:55 UTC exceeds the granted slot starting about 13:45 UTC.
